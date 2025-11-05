import User from "../models/user.model.js";
import { logger } from "../lib/logger.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
import { config } from "../lib/config.js";
import { getUserAttachmentUsageBytes, getUserQuotaBytes } from "../lib/storageQuota.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const me = await User.findById(loggedInUserId).select("contacts");
    const filteredUsers = await User.find({ _id: { $in: me.contacts }, isDeleted: false }).select(
      "-password"
    );

    res.status(200).json(filteredUsers);
  } catch (error) {
    logger.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const beforeTs = Number(req.query.beforeTs) || null;

    const filter = {
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    };
    if (beforeTs) {
      filter.createdAt = { $lt: new Date(beforeTs) };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    // return oldest-first for UI simplicity
    messages.reverse();

    res.status(200).json(messages);
  } catch (error) {
    logger.error("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

  export const sendMessage = async (req, res) => {
  try {
    const { text, image, imageUrl, file } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    // Enforce message text length
    if (typeof text === "string") {
      const maxLen = config.limits.messageMaxLength;
      if (text.length > maxLen) {
        return res.status(400).json({ message: `Message text must be ${maxLen} characters or fewer` });
      }
    }

    let resolvedImageUrl;
    let fileData;

    if (imageUrl) {
      // Client pre-uploaded image
      resolvedImageUrl = imageUrl;
    } else if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      resolvedImageUrl = uploadResponse.secure_url;
    }

    if (file && file.url && !file.preview) {
      // Client pre-uploaded file
      fileData = {
        url: file.url,
        name: file.name,
        type: file.type,
        size: file.size,
      };
      // Validate against type-specific limits
      const sizeNum = Number(fileData.size) || 0;
      const isImage = fileData.type?.startsWith("image/");
      const isVideo = fileData.type?.startsWith("video/");
      const isPdf = fileData.type === "application/pdf";
      const maxBytes = isImage
        ? config.limits.imageMaxBytes
        : isVideo
        ? config.limits.videoMaxBytes
        : isPdf
        ? config.limits.pdfMaxBytes
        : 0;
      if (!isImage && !isVideo && !isPdf) {
        return res.status(400).json({ message: "Only images, videos, and PDF documents are supported" });
      }
      if (sizeNum > maxBytes) {
        return res.status(400).json({ message: `File size exceeds limit (${(maxBytes/1024/1024)|0}MB)` });
      }
    } else if (file && file.preview) {
      // Handle file upload to cloudinary
      const isImage = file.type?.startsWith("image/");
      const isVideo = file.type?.startsWith("video/");
      const isPdf = file.type === "application/pdf";
      const sizeNum = Number(file.size) || 0;
      const maxBytes = isImage
        ? config.limits.imageMaxBytes
        : isVideo
        ? config.limits.videoMaxBytes
        : isPdf
        ? config.limits.pdfMaxBytes
        : 0;
      if (sizeNum > maxBytes) {
        return res.status(400).json({ message: `File size exceeds limit (${(maxBytes/1024/1024)|0}MB)` });
      }

      if (!isImage && !isVideo && !isPdf) {
        return res.status(400).json({ message: "Only images, videos, and PDF documents are supported" });
      }

      const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
      const uploadResponse = await cloudinary.uploader.upload(file.preview, {
        resource_type: resourceType,
        folder: "chat_files",
      });
      
      fileData = {
        url: uploadResponse.secure_url,
        name: file.name,
        type: file.type,
        size: file.size
      };
    }

    // Enforce per-user storage quota for file attachments (images tracked separately)
    if (fileData && fileData.size) {
      try {
        const current = await getUserAttachmentUsageBytes(senderId);
        const quota = getUserQuotaBytes();
        if (current + Number(fileData.size || 0) > quota) {
          return res.status(403).json({ message: "Storage quota exceeded. Remove files to free space." });
        }
      } catch (e) {
        // If quota check fails, do not block the request
      }
    }

    // ensure they are contacts
    const me = await User.findById(senderId).select("contacts");
    if (!me.contacts?.map(String).includes(String(receiverId))) {
      return res.status(403).json({ message: "You are not connected with this user" });
    }

    // Block sending to deleted accounts, but allow viewing history elsewhere
    const receiver = await User.findById(receiverId).select("isDeleted");
    if (!receiver || receiver.isDeleted) {
      return res.status(410).json({ message: "User account is no longer active" });
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: resolvedImageUrl,
      file: fileData,
    });

    await newMessage.save();

    // Old behavior: emit only to the receiver's active socketId
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    logger.error("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Pre-upload endpoint to upload attachments and return URL + metadata
export const uploadAttachment = async (req, res) => {
  try {
    const { image, file } = req.body;
    let result;

    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image, {
        resource_type: "image",
      });
      result = {
        url: uploadResponse.secure_url,
        name: "image",
        type: "image/jpeg",
        size: uploadResponse.bytes || 0,
        kind: "image",
      };
    } else if (file && file.preview) {
      const isImage = file.type?.startsWith("image/");
      const isVideo = file.type?.startsWith("video/");
      const isPdf = file.type === "application/pdf";
      const sizeNum = Number(file.size) || 0;
      const maxBytes = isImage
        ? config.limits.imageMaxBytes
        : isVideo
        ? config.limits.videoMaxBytes
        : isPdf
        ? config.limits.pdfMaxBytes
        : 0;
      if (sizeNum > maxBytes) {
        return res.status(400).json({ message: `File size exceeds limit (${(maxBytes/1024/1024)|0}MB)` });
      }
      if (!isImage && !isVideo && !isPdf) {
        return res.status(400).json({ message: "Only images, videos, and PDF documents are supported" });
      }
      const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
      const uploadResponse = await cloudinary.uploader.upload(file.preview, {
        resource_type: resourceType,
        folder: "chat_files",
      });
      result = {
        url: uploadResponse.secure_url,
        name: file.name,
        type: file.type,
        size: file.size,
        kind: isImage ? "image" : isVideo ? "video" : "file",
      };
    }

    if (!result) {
      return res.status(400).json({ message: "No attachment provided" });
    }
    return res.status(201).json(result);
  } catch (error) {
    logger.error("Error in uploadAttachment controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Bulk unread counts for DMs, using client-provided lastSeen map to avoid N+1
export const getUnreadCountsBulk = async (req, res) => {
  try {
    const me = req.user._id;
    const { lastSeen = {} } = req.body || {};
    const userIds = Object.keys(lastSeen || {}).filter(Boolean);
    if (!userIds.length) return res.status(200).json({});

    // Fetch messages from these senders to me after the earliest lastSeen; group by sender
    const minTs = Math.min(...userIds.map((id) => Number(lastSeen[id]) || 0)) || 0;
    const query = {
      receiverId: me,
      senderId: { $in: userIds },
      ...(minTs ? { createdAt: { $gt: new Date(minTs) } } : {}),
    };
    const msgs = await Message.find(query).select("senderId createdAt").lean();
    const counts = {};
    for (const m of msgs) {
      const sid = String(m.senderId);
      const cutoff = Number(lastSeen[sid]) || 0;
      const created = new Date(m.createdAt || 0).getTime();
      if (created > cutoff) counts[sid] = (counts[sid] || 0) + 1;
    }
    res.status(200).json(counts);
  } catch (error) {
    logger.error("Error in getUnreadCountsBulk:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Server-backed DM last-seen
export const getDmLastSeen = async (req, res) => {
  try {
    const me = req.user._id;
    const user = await User.findById(me).select("dmLastSeen");
    const map = user?.dmLastSeen || new Map();
    const obj = typeof map?.entries === "function" ? Object.fromEntries(map.entries()) : {};
    res.status(200).json(obj);
  } catch (error) {
    logger.error("Error in getDmLastSeen:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateDmLastSeen = async (req, res) => {
  try {
    const me = req.user._id;
    const { lastSeen = {} } = req.body || {};
    const user = await User.findById(me).select("dmLastSeen");
    if (!user) return res.status(404).json({ message: "User not found" });
    const incoming = Object.entries(lastSeen || {});
    for (const [uid, ts] of incoming) {
      const prev = Number(user.dmLastSeen.get(uid)) || 0;
      const next = Math.max(prev, Number(ts) || 0);
      user.dmLastSeen.set(uid, next);
    }
    await user.save();
    const obj = Object.fromEntries(user.dmLastSeen.entries());
    res.status(200).json(obj);
  } catch (error) {
    logger.error("Error in updateDmLastSeen:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// React to a DM message with an emoji (non-sender only)
export const reactToMessage = async (req, res) => {
  try {
    const me = req.user._id;
    const { messageId } = req.params;
    const { emoji } = req.body || {};
    if (!emoji || typeof emoji !== "string" || emoji.length === 0) {
      return res.status(400).json({ message: "Emoji is required" });
    }
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    // Allow reacting to own messages (requested feature)
    // Only participants of this DM can react
    const isParticipant = [String(msg.senderId), String(msg.receiverId)].includes(String(me));
    if (!isParticipant) {
      return res.status(403).json({ message: "Not allowed" });
    }
    // Upsert reaction: one per user
    const existing = (msg.reactions || []).filter((r) => String(r.userId) !== String(me));
    msg.reactions = [...existing, { userId: me, emoji, createdAt: new Date() }];
    await msg.save();

    // Emit live update to both participants
    const otherUserId = String(msg.senderId) === String(me) ? String(msg.receiverId) : String(msg.senderId);
    const otherSid = getReceiverSocketId(otherUserId);
    if (otherSid) io.to(otherSid).emit("message:reaction", { messageId: String(msg._id), reactions: msg.reactions });
    const mySid = getReceiverSocketId(String(me));
    if (mySid) io.to(mySid).emit("message:reaction", { messageId: String(msg._id), reactions: msg.reactions });

    res.status(200).json({ _id: msg._id, reactions: msg.reactions });
  } catch (error) {
    logger.error("Error in reactToMessage:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
