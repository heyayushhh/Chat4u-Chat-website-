import User from "../models/user.model.js";
import { logger } from "../lib/logger.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";

export const sendRequest = async (req, res) => {
  try {
    const requesterId = req.user._id;
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: "Username is required" });

    const target = await User.findOne({ username });
    if (!target) return res.status(404).json({ message: "User not found" });
    if (String(target._id) === String(requesterId)) {
      return res.status(400).json({ message: "You cannot send request to yourself" });
    }

    const requester = await User.findById(requesterId);

    // Already friends
    if (requester.contacts?.includes(target._id)) {
      return res.status(400).json({ message: "Already connected" });
    }
    // Already requested
    if (requester.outgoingRequests?.includes(target._id)) {
      return res.status(400).json({ message: "Request already sent" });
    }
    if (requester.incomingRequests?.includes(target._id)) {
      return res.status(400).json({ message: "User already requested you" });
    }

    requester.outgoingRequests.push(target._id);
    target.incomingRequests.push(requester._id);

    await requester.save();
    await target.save();

    res.status(201).json({ message: "Request sent" });
  } catch (error) {
    logger.error("Error in sendRequest:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getIncomingRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "incomingRequests",
      "fullName username profilePic"
    );
    res.status(200).json(user.incomingRequests || []);
  } catch (error) {
    logger.error("Error in getIncomingRequests:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const approveRequest = async (req, res) => {
  try {
    const approverId = req.user._id;
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ message: "requesterId is required" });

    const approver = await User.findById(approverId);
    const requester = await User.findById(requesterId);
    if (!approver || !requester) return res.status(404).json({ message: "User not found" });

    // Ensure there was a request
    if (!approver.incomingRequests?.includes(requester._id)) {
      return res.status(400).json({ message: "No pending request from this user" });
    }

    // Remove pending, add to contacts (mutual)
    approver.incomingRequests = approver.incomingRequests.filter(
      (id) => String(id) !== String(requester._id)
    );
    requester.outgoingRequests = requester.outgoingRequests.filter(
      (id) => String(id) !== String(approver._id)
    );

    approver.contacts.push(requester._id);
    requester.contacts.push(approver._id);

    await approver.save();
    await requester.save();

    res.status(200).json({ message: "Request approved" });
  } catch (error) {
    logger.error("Error in approveRequest:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Remove a contact mutually: both users lose each other from contacts
export const removeContact = async (req, res) => {
  try {
    const meId = req.user._id;
    const { id: otherId } = req.params;
    if (!otherId) return res.status(400).json({ message: "User id is required" });

    const me = await User.findById(meId);
    const other = await User.findById(otherId);
    if (!me || !other) return res.status(404).json({ message: "User not found" });

    const beforeMeHas = (me.contacts || []).map(String).includes(String(other._id));
    const beforeOtherHas = (other.contacts || []).map(String).includes(String(me._id));
    if (!beforeMeHas && !beforeOtherHas) {
      return res.status(400).json({ message: "Not connected" });
    }

    // Pull each other from contacts and clear pending requests in either direction
    me.contacts = (me.contacts || []).filter((id) => String(id) !== String(other._id));
    other.contacts = (other.contacts || []).filter((id) => String(id) !== String(me._id));

    me.incomingRequests = (me.incomingRequests || []).filter((id) => String(id) !== String(other._id));
    me.outgoingRequests = (me.outgoingRequests || []).filter((id) => String(id) !== String(other._id));
    other.incomingRequests = (other.incomingRequests || []).filter((id) => String(id) !== String(me._id));
    other.outgoingRequests = (other.outgoingRequests || []).filter((id) => String(id) !== String(me._id));

    await me.save();
    await other.save();

    // Optional: clear last-seen to avoid stale unread counts (best-effort)
    try {
      if (typeof me.dmLastSeen?.delete === "function") me.dmLastSeen.delete(String(other._id));
      if (typeof other.dmLastSeen?.delete === "function") other.dmLastSeen.delete(String(me._id));
      await me.save();
      await other.save();
    } catch (_) {}

    // 3) Delete all DM messages and their media between these two users
    try {
      const extractPublicId = (url) => {
        try {
          if (!url) return null;
          const m = String(url).match(/\/upload\/(?:v\d+\/)?(.+?)(\.[a-zA-Z0-9]+)?$/);
          return m ? m[1] : null;
        } catch (_) {
          return null;
        }
      };
      const msgs = await Message.find({
        $or: [
          { senderId: meId, receiverId: otherId },
          { senderId: otherId, receiverId: meId },
        ],
      }).select("image file").lean();
      for (const msg of msgs) {
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
      await Message.deleteMany({
        $or: [
          { senderId: meId, receiverId: otherId },
          { senderId: otherId, receiverId: meId },
        ],
      });
    } catch (delErr) {
      logger.warn("Failed to delete DM messages/media during contact removal:", delErr?.message || delErr);
    }

    return res.status(200).json({ message: "Contact removed" });
  } catch (error) {
    logger.error("Error in removeContact:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};