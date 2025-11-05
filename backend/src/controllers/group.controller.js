import Group from "../models/group.model.js";
import { logger } from "../lib/logger.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import GroupMessage from "../models/groupMessage.model.js";

export const createGroup = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { name, memberIds = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    // include admin and dedupe
    const uniqueMembers = Array.from(new Set([adminId.toString(), ...memberIds.map(String)]));

    if (uniqueMembers.length < 3) {
      return res.status(400).json({ message: "A group must have at least 3 members including admin" });
    }
    if (uniqueMembers.length > 12) {
      return res.status(400).json({ message: "Group cannot exceed 12 members" });
    }

    // Validate users exist
    const count = await User.countDocuments({ _id: { $in: uniqueMembers } });
    if (count !== uniqueMembers.length) {
      return res.status(400).json({ message: "One or more members do not exist" });
    }

    // Initialize joinedAt for all initial members
    const now = new Date();
    const group = new Group({ name: name.trim(), adminId, members: uniqueMembers, joinedAtMap: new Map(uniqueMembers.map((id) => [String(id), now])) });
    await group.save();

    const populated = await Group.findById(group._id)
      .populate("adminId", "fullName username profilePic")
      .populate("members", "fullName username profilePic");

    res.status(201).json(populated);
  } catch (error) {
    logger.error("Error in createGroup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const myId = req.user._id;
    // Include avatar and description so group DPs persist after refresh
    const groups = await Group.find({ members: myId }).select("name adminId members avatar description createdAt");
    // Sanitize member arrays and exclude soft-deleted users to keep counts accurate
    const cleaned = [];
    for (const g of groups) {
      try {
        const seen = new Set();
        const deduped = [];
        for (const m of g.members || []) {
          const key = String(m);
          if (!seen.has(key)) { seen.add(key); deduped.push(key); }
        }
        // Filter out deleted users in response
        const actives = await User.find({ _id: { $in: deduped }, isDeleted: false }).select("_id");
        g.members = actives.map((u) => u._id);
      } catch (_) {}
      cleaned.push(g);
    }
    res.status(200).json(cleaned);
  } catch (error) {
    logger.error("Error in getMyGroups:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id)
      .populate("adminId", "fullName username profilePic")
      .populate({ path: "members", select: "fullName username profilePic isDeleted", match: { isDeleted: false } });
    if (!group) return res.status(404).json({ message: "Group not found" });
    const isMember = (group.members || []).map((m) => String(m?._id || m)).includes(String(req.user._id));
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }
    // Filter out any non-populated (deleted) members for response
    try {
      const filtered = (group.members || []).filter((m) => !!m && typeof m === "object" && !m.isDeleted);
      // Deduplicate by user id to avoid double entries from legacy records
      const seen = new Set();
      const deduped = [];
      for (const m of filtered) {
        const key = String(m._id || m);
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(m);
        }
      }
      group.members = deduped;
    } catch (_) {}
    res.status(200).json(group);
  } catch (error) {
    logger.error("Error in getGroupById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

  export const addMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberIds = [] } = req.body;
    const me = req.user._id;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (String(group.adminId) !== String(me)) {
      return res.status(403).json({ message: "Only admin can add members" });
    }
    const toAdd = memberIds.map(String);
    // Validate IDs: only accept 24-char hex ObjectIds
    const validToAdd = toAdd.filter((v) => /^[0-9a-fA-F]{24}$/.test(String(v)));
    if (validToAdd.length !== toAdd.length) {
      return res.status(400).json({ message: "One or more member IDs are invalid" });
    }
    const existingSet = new Set(group.members.map(String));
    const additions = validToAdd.filter((id) => !existingSet.has(id));
    // Ensure the users exist and are not soft-deleted
    const count = await User.countDocuments({ _id: { $in: additions }, isDeleted: false });
    if (count !== additions.length) {
      return res.status(400).json({ message: "One or more members do not exist" });
    }
    const combined = Array.from(new Set([...existingSet, ...additions]));
    if (combined.length > 12) {
      return res.status(400).json({ message: "Group members limit reached (max 12)" });
    }
    group.members = combined;
    // Set joinedAt for new additions only
    try {
      if (!group.joinedAtMap || typeof group.joinedAtMap.set !== "function") group.joinedAtMap = new Map();
      const now = new Date();
      for (const id of additions) {
        group.joinedAtMap.set(String(id), now);
      }
    } catch (_) {}
    await group.save();
    const populated = await Group.findById(id)
      .populate("adminId", "fullName username profilePic")
      .populate("members", "fullName username profilePic");
    // Deduplicate members in response
    try {
      const seen = new Set();
      const deduped = [];
      for (const m of populated.members || []) {
        const key = String(m._id || m);
        if (!seen.has(key)) { seen.add(key); deduped.push(m); }
      }
      populated.members = deduped;
    } catch (_) {}
    res.status(200).json(populated);
  } catch (error) {
    logger.error("Error in addMembers:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

  export const removeMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const me = req.user._id;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (String(group.adminId) !== String(me)) {
      return res.status(403).json({ message: "Only admin can remove members" });
    }
    if (String(memberId) === String(group.adminId)) {
      return res.status(400).json({ message: "Admin cannot be removed" });
    }
    group.members = group.members.filter((m) => String(m) !== String(memberId));
    try { group.joinedAtMap?.delete(String(memberId)); } catch (_) {}
    await group.save();
    const populated = await Group.findById(id)
      .populate("adminId", "fullName username profilePic")
      .populate("members", "fullName username profilePic");
    // Deduplicate members in response
    try {
      const seen = new Set();
      const deduped = [];
      for (const m of populated.members || []) {
        const key = String(m._id || m);
        if (!seen.has(key)) { seen.add(key); deduped.push(m); }
      }
      populated.members = deduped;
    } catch (_) {}
    res.status(200).json(populated);
  } catch (error) {
    logger.error("Error in removeMember:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

  export const leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user._id;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (String(group.adminId) === String(me)) {
      return res.status(400).json({ message: "Admin cannot leave the group" });
    }
    if (!group.members.map(String).includes(String(me))) {
      return res.status(400).json({ message: "You are not a member of this group" });
    }
    group.members = group.members.filter((m) => String(m) !== String(me));
    try { group.joinedAtMap?.delete(String(me)); } catch (_) {}
    await group.save();
    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    logger.error("Error in leaveGroup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update group profile: avatar (base64) and/or description. Any member can edit.
export const updateGroupProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user._id;
    const { avatar, description } = req.body;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.members.map(String).includes(String(me))) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    let avatarUrl = group.avatar;
    if (avatar) {
      const uploadResponse = await cloudinary.uploader.upload(avatar);
      avatarUrl = uploadResponse.secure_url;
    }

    if (avatar) group.avatar = avatarUrl;
    if (typeof description !== "undefined") group.description = description;

    await group.save();
    const populated = await Group.findById(id)
      .populate("adminId", "fullName username profilePic")
      .populate("members", "fullName username profilePic");
    // Deduplicate members in response
    try {
      const seen = new Set();
      const deduped = [];
      for (const m of populated.members || []) {
        const key = String(m._id || m);
        if (!seen.has(key)) { seen.add(key); deduped.push(m); }
      }
      populated.members = deduped;
    } catch (_) {}
    // Old behavior: emit to a single receiver socketId per member
    try {
      const { io, getReceiverSocketId } = await import("../lib/socket.js");
      for (const memberId of group.members) {
        const sid = getReceiverSocketId(String(memberId));
        if (sid) io.to(sid).emit("group:updated", populated);
      }
    } catch (e) {
      // Log but don't fail the request
    logger.error("Socket emit failed in updateGroupProfile:", e);
    }
    res.status(200).json(populated);
  } catch (error) {
    logger.error("Error in updateGroupProfile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a group completely (admin only). Removes group and its messages.
export const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user._id;

    const group = await Group.findById(id).select("adminId members");
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (String(group.adminId) !== String(me)) {
      return res.status(403).json({ message: "Only admin can delete the group" });
    }

    await GroupMessage.deleteMany({ groupId: id });
    await Group.findByIdAndDelete(id);

    return res.status(200).json({ message: "Group deleted" });
  } catch (error) {
    logger.error("Error in deleteGroup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};