import GroupCall from "../models/groupCall.model.js";
import { logger } from "../lib/logger.js";
import Group from "../models/group.model.js";

export const getCallsForGroup = async (req, res) => {
  try {
    const myId = req.user._id;
    const groupId = req.params.id;

    const group = await Group.findById(groupId).select("members");
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.members.map(String).includes(String(myId))) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const calls = await GroupCall.find({ groupId })
      .sort({ createdAt: -1 })
      .select("groupId initiatorId type status participantsAccepted participantsActive startedAt endedAt durationSeconds createdAt");

    res.status(200).json(calls);
  } catch (error) {
    logger.error("Error in getCallsForGroup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// List active group calls for the current user across all their groups
export const getActiveCallsForMe = async (req, res) => {
  try {
    const myId = req.user._id;
    // Find groups where the user is a member
    const groups = await Group.find({ members: myId }).select("_id name members");
    const groupIds = groups.map((g) => g._id);
    if (!groupIds.length) return res.status(200).json([]);

    // Find active calls (not ended) in these groups
    const calls = await GroupCall.find({ groupId: { $in: groupIds }, status: "active", endedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .select("groupId initiatorId type status participantsAccepted participantsActive startedAt createdAt");

    res.status(200).json(calls);
  } catch (error) {
    logger.error("Error in getActiveCallsForMe:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};