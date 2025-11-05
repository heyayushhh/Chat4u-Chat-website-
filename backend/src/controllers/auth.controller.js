import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { logger } from "../lib/logger.js";
import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import Message from "../models/message.model.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

export const signup = async (req, res) => {
  const { fullName, email, password, username, termsAccepted } = req.body;
  try {
    if (!fullName || !email || !password || !username) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Enforce terms acceptance
    if (!termsAccepted) {
      return res.status(400).json({ message: "You must accept Terms & Conditions" });
    }

    // Normalize email and username
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Normalize and validate username
    const normalizedUsername = String(username || "").trim().toLowerCase();
    const USERNAME_REGEX = /^[a-z0-9_\-]{3,20}$/;
    if (!USERNAME_REGEX.test(normalizedUsername)) {
      return res.status(400).json({ message: "Invalid username format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    // Enforce global uniqueness: one email cannot have multiple users
    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      return res.status(400).json({ message: "Email already exists" });
    }
    // Keep username uniqueness policy as-is (active users); adjust if business rules change
    const activeUsernameUser = await User.findOne({ username: normalizedUsername, isDeleted: false });
    if (activeUsernameUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Hard-delete semantics: do not reactivate soft-deleted accounts.
    // Allow re-signup; if legacy soft-deleted docs cause duplicate keys, purge during save.

    // Note: no generic 'existing' check here; we already checked for active conflicts

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email: normalizedEmail,
      username: normalizedUsername,
      password: hashedPassword,
    });

    if (newUser) {
      // generate jwt token here
      generateToken(newUser._id, res);
      try {
        await newUser.save();
      } catch (saveErr) {
        // Duplicate key errors surface global uniqueness constraints
        if (saveErr?.code === 11000) {
          const key = Object.keys(saveErr?.keyPattern || {})[0] || "field";
          const msg = key === "username" ? "Username already exists" : key === "email" ? "Email already exists" : "Duplicate value";
          return res.status(409).json({ message: msg });
        }
        throw saveErr;
      }

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        username: newUser.username,
        profilePic: newUser.profilePic,
        accountStatus: newUser.accountStatus,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    logger.error("Error in signup controller", error.message);
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    if (error?.code === 11000) {
      const key = Object.keys(error?.keyPattern || {})[0] || "field";
      const msg = key === "username" ? "Username already exists" : key === "email" ? "Email already exists" : "Duplicate value";
      return res.status(409).json({ message: msg });
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.isDeleted) {
      return res.status(403).json({ message: "Account is deleted. Please sign up to reactivate." });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      profilePic: user.profilePic,
      accountStatus: user.accountStatus,
    });
  } catch (error) {
    logger.error("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, description } = req.body;
    const userId = req.user._id;

    const update = {};
    // Handle optional profile photo update
    if (profilePic) {
      const uploadResponse = await cloudinary.uploader.upload(profilePic);
      update.profilePic = uploadResponse.secure_url;
    }

    // Handle optional description update with 20-word validation
    if (typeof description !== "undefined") {
      const words = String(description || "").trim().split(/\s+/).filter(Boolean);
      if (words.length > 20) {
        return res.status(400).json({ message: "Description must be 20 words or fewer" });
      }
      update.description = String(description || "").trim();
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No profile updates provided" });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true });

    // Broadcast profile changes to all contacts in real-time
    try {
      const { io, getReceiverSocketId } = await import("../lib/socket.js");
      // Ensure we have contact ids
      let contactIds = updatedUser?.contacts;
      if (!Array.isArray(contactIds)) {
        const me = await User.findById(userId).select("contacts");
        contactIds = me?.contacts || [];
      }

      const payload = {
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        username: updatedUser.username,
        profilePic: updatedUser.profilePic,
        description: updatedUser.description,
      };

      for (const cid of contactIds) {
        const sid = getReceiverSocketId(String(cid));
        if (sid) io.to(sid).emit("user:profileUpdated", payload);
      }
    } catch (emitErr) {
      logger.error("Socket emit failed in updateProfile:", emitErr);
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    logger.error("error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    logger.error("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Delete account (hard-delete): remove user, relationships, messages, groups, and media
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("_id username fullName");
    if (!user) return res.status(404).json({ message: "User not found" });
    // Helper: extract Cloudinary public_id from secure URL
    const extractPublicId = (url) => {
      try {
        if (!url) return null;
        const m = String(url).match(/\/upload\/(?:v\d+\/)?(.+?)(\.[a-zA-Z0-9]+)?$/);
        return m ? m[1] : null;
      } catch (_) {
        return null;
      }
    };

    // 1) Collect and delete DM attachments for this user's conversations
    try {
      const dmMsgs = await Message.find({ $or: [{ senderId: userId }, { receiverId: userId }] })
        .select("image file")
        .lean();
      for (const msg of dmMsgs) {
        if (msg.image) {
          const pid = extractPublicId(msg.image);
          if (pid) {
            try { await cloudinary.uploader.destroy(pid, { resource_type: "image" }); } catch (_) {}
          }
        }
        const f = msg.file;
        if (f && f.url) {
          const pid = extractPublicId(f.url);
          if (pid) {
            const isImage = (f.type || "").startsWith("image/");
            const isVideo = (f.type || "").startsWith("video/");
            const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
            try { await cloudinary.uploader.destroy(pid, { resource_type: resourceType }); } catch (_) {}
          }
        }
      }
      await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] });
    } catch (e) {
      logger.warn("Failed to delete DM messages/media:", e?.message || e);
    }

    // 2) Delete this user's group messages and their media
    try {
      const gmMsgs = await GroupMessage.find({ senderId: userId }).select("image file groupId").lean();
      for (const msg of gmMsgs) {
        if (msg.image) {
          const pid = extractPublicId(msg.image);
          if (pid) { try { await cloudinary.uploader.destroy(pid, { resource_type: "image" }); } catch (_) {} }
        }
        const f = msg.file;
        if (f && f.url) {
          const pid = extractPublicId(f.url);
          if (pid) {
            const isImage = (f.type || "").startsWith("image/");
            const isVideo = (f.type || "").startsWith("video/");
            const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
            try { await cloudinary.uploader.destroy(pid, { resource_type: resourceType }); } catch (_) {}
          }
        }
      }
      await GroupMessage.deleteMany({ senderId: userId });
    } catch (e) {
      logger.warn("Failed to delete group messages/media:", e?.message || e);
    }

    // 3) Clear relationships across users: contacts and requests
    try {
      await Promise.all([
        User.updateMany({ contacts: userId }, { $pull: { contacts: userId } }),
        User.updateMany({ incomingRequests: userId }, { $pull: { incomingRequests: userId } }),
        User.updateMany({ outgoingRequests: userId }, { $pull: { outgoingRequests: userId } }),
      ]);
    } catch (relErr) {
      logger.warn("Failed to clear relationships:", relErr?.message || relErr);
    }

    // 4) Handle groups membership and groups administered by this user
    try {
      // Remove member from non-admin groups and delete their joinedAtMap entry
      const memberGroups = await Group.find({ members: userId, adminId: { $ne: userId } })
        .select("_id members joinedAtMap");
      for (const g of memberGroups) {
        try {
          g.members = (g.members || []).filter((m) => String(m) !== String(userId));
          try { g.joinedAtMap?.delete(String(userId)); } catch (_) {}
          await g.save();
        } catch (e) {
          logger.warn("Failed to update group membership:", e?.message || e);
        }
      }

      // Delete groups where this user is admin, including avatars and group messages
      const adminGroups = await Group.find({ adminId: userId }).select("_id avatar");
      for (const g of adminGroups) {
        try {
          // Delete group messages media first
          const msgs = await GroupMessage.find({ groupId: g._id }).select("image file").lean();
          for (const m of msgs) {
            if (m.image) {
              const pid = extractPublicId(m.image);
              if (pid) { try { await cloudinary.uploader.destroy(pid, { resource_type: "image" }); } catch (_) {} }
            }
            const f = m.file;
            if (f && f.url) {
              const pid = extractPublicId(f.url);
              if (pid) {
                const isImage = (f.type || "").startsWith("image/");
                const isVideo = (f.type || "").startsWith("video/");
                const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
                try { await cloudinary.uploader.destroy(pid, { resource_type: resourceType }); } catch (_) {}
              }
            }
          }
          await GroupMessage.deleteMany({ groupId: g._id });

          // Delete group avatar media
          if (g.avatar) {
            const pid = extractPublicId(g.avatar);
            if (pid) { try { await cloudinary.uploader.destroy(pid, { resource_type: "image" }); } catch (_) {} }
          }

          await Group.findByIdAndDelete(g._id);
        } catch (e) {
          logger.warn("Failed to delete admin group:", e?.message || e);
        }
      }
    } catch (grpErr) {
      logger.warn("Failed to process groups:", grpErr?.message || grpErr);
    }

    // 5) Finally delete the user document and invalidate auth
    try {
      await User.findByIdAndDelete(userId);
    } catch (e) {
      logger.warn("Failed to delete user document:", e?.message || e);
    }

    res.cookie("jwt", "", { maxAge: 0 });
    return res.status(200).json({ message: "Account deleted permanently" });
  } catch (error) {
    logger.error("Error in deleteAccount controller", error);
    res.status(500).json({ message: error?.message || "Internal Server Error" });
  }
};
