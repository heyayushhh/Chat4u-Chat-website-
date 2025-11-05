import Group from "../models/group.model.js";
import User from "../models/user.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import { logger } from "../lib/logger.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
import { config } from "../lib/config.js";
import { getUserAttachmentUsageBytes, getUserQuotaBytes } from "../lib/storageQuota.js";

export const getGroupMessages = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const myId = req.user._id;
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const beforeTs = Number(req.query.beforeTs) || null;
    const group = await Group.findById(groupId).select("members joinedAtMap createdAt");
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.members.map(String).includes(String(myId))) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const filter = { groupId };
    // Visibility rule: new members should not see messages before they joined.
    let joinedAt = null;
    try {
      const key = String(myId);
      if (group.joinedAtMap && typeof group.joinedAtMap.get === "function") {
        joinedAt = group.joinedAtMap.get(key) || null;
      }
    } catch (_) {}
    // Fallback: if joinedAt is missing (legacy groups/members), do not restrict history
    const createdFilter = {};
    if (beforeTs) createdFilter.$lt = new Date(beforeTs);
    if (joinedAt instanceof Date) createdFilter.$gte = joinedAt;
    if (Object.keys(createdFilter).length) filter.createdAt = createdFilter;
    const messages = await GroupMessage.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    messages.reverse();
    res.status(200).json(messages);
  } catch (error) {
    logger.error("Error in getGroupMessages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { text, image, imageUrl, file } = req.body;
    const senderId = req.user._id;

    // Enforce message text length
    if (typeof text === "string") {
      const maxLen = config.limits.messageMaxLength;
      if (text.length > maxLen) {
        return res.status(400).json({ message: `Message text must be ${maxLen} characters or fewer` });
      }
    }

    const group = await Group.findById(groupId).select("members");
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.members.map(String).includes(String(senderId))) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    let resolvedImageUrl;
    let fileData;

    // Support pre-uploaded images or base64 uploads
    if (imageUrl) {
      resolvedImageUrl = imageUrl;
    } else if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image, { resource_type: "image" });
      resolvedImageUrl = uploadResponse.secure_url;
    }

    // Support pre-uploaded files (file.url) and base64 previews (file.preview)
    if (file && file.url && !file.preview) {
      fileData = {
        url: file.url,
        name: file.name,
        type: file.type,
        size: file.size,
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

      fileData = {
        url: uploadResponse.secure_url,
        name: file.name,
        type: file.type,
        size: file.size,
      };
    }

    // Enforce per-user storage quota for file attachments
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

    const newMessage = new GroupMessage({ groupId, senderId, text, image: resolvedImageUrl, file: fileData });
    await newMessage.save();

    // Old behavior: emit to a single receiver socketId per member
    for (const memberId of group.members) {
      const sid = getReceiverSocketId(String(memberId));
      if (sid && String(memberId) !== String(senderId)) {
        io.to(sid).emit("group:newMessage", newMessage);
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    logger.error("Error in sendGroupMessage:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Bulk unread counts for groups, requires client-provided lastSeen per group
export const getGroupUnreadCountsBulk = async (req, res) => {
  try {
    const me = req.user._id;
    const { lastSeen = {} } = req.body || {};
    const groupIds = Object.keys(lastSeen || {}).filter(Boolean);
    if (!groupIds.length) return res.status(200).json({});
    const minTs = Math.min(...groupIds.map((id) => Number(lastSeen[id]) || 0)) || 0;
    const query = {
      groupId: { $in: groupIds },
      ...(minTs ? { createdAt: { $gt: new Date(minTs) } } : {}),
    };
    const msgs = await GroupMessage.find(query).select("groupId senderId createdAt").lean();
    const counts = {};
    for (const m of msgs) {
      const gid = String(m.groupId);
      const cutoff = Number(lastSeen[gid]) || 0;
      const created = new Date(m.createdAt || 0).getTime();
      const isFromOther = String(m.senderId) !== String(me);
      if (isFromOther && created > cutoff) counts[gid] = (counts[gid] || 0) + 1;
    }
    res.status(200).json(counts);
  } catch (error) {
    logger.error("Error in getGroupUnreadCountsBulk:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Server-backed Group last-seen
export const getGroupLastSeen = async (req, res) => {
  try {
    const me = req.user._id;
    const user = await User.findById(me).select("groupLastSeen");
    const map = user?.groupLastSeen || new Map();
    const obj = typeof map?.entries === "function" ? Object.fromEntries(map.entries()) : {};
    res.status(200).json(obj);
  } catch (error) {
    logger.error("Error in getGroupLastSeen:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateGroupLastSeen = async (req, res) => {
  try {
    const me = req.user._id;
    const { lastSeen = {} } = req.body || {};
    const user = await User.findById(me).select("groupLastSeen");
    if (!user) return res.status(404).json({ message: "User not found" });
    const incoming = Object.entries(lastSeen || {});
    for (const [gid, ts] of incoming) {
      const prev = Number(user.groupLastSeen.get(gid)) || 0;
      const next = Math.max(prev, Number(ts) || 0);
      user.groupLastSeen.set(gid, next);
    }
    await user.save();
    const obj = Object.fromEntries(user.groupLastSeen.entries());
    res.status(200).json(obj);
  } catch (error) {
    logger.error("Error in updateGroupLastSeen:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// React to a group message (non-sender only, members only)
export const reactToGroupMessage = async (req, res) => {
  try {
    const me = req.user._id;
    const { messageId } = req.params;
    const { emoji } = req.body || {};
    if (!emoji || typeof emoji !== "string" || emoji.length === 0) {
      return res.status(400).json({ message: "Emoji is required" });
    }
    const msg = await GroupMessage.findById(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    const group = await Group.findById(msg.groupId).select("members");
    if (!group) return res.status(404).json({ message: "Group not found" });
    const isMember = group.members.map(String).includes(String(me));
    if (!isMember) return res.status(403).json({ message: "You are not a member of this group" });
    // Allow reacting to own messages (requested feature)

    // Upsert reaction: one per user
    const existing = (msg.reactions || []).filter((r) => String(r.userId) !== String(me));
    msg.reactions = [...existing, { userId: me, emoji, createdAt: new Date() }];
    await msg.save();

    // Emit to all group members except sender; include me for multi-device sync
    for (const memberId of group.members) {
      const sid = getReceiverSocketId(String(memberId));
      if (sid) io.to(sid).emit("group:reaction", { messageId: String(msg._id), groupId: String(msg.groupId), reactions: msg.reactions });
    }

    res.status(200).json({ _id: msg._id, reactions: msg.reactions });
  } catch (error) {
    logger.error("Error in reactToGroupMessage:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};