import Call from "../models/call.model.js";
import { logger } from "../lib/logger.js";

export const getCallsWithUser = async (req, res) => {
  try {
    const myId = req.user._id;
    const otherId = req.params.id;

    const calls = await Call.find({
      $or: [
        { callerId: myId, calleeId: otherId },
        { callerId: otherId, calleeId: myId },
      ],
    })
      .sort({ createdAt: -1 })
      .select("callerId calleeId type status startedAt endedAt durationSeconds createdAt");

    res.status(200).json(calls);
  } catch (error) {
    logger.error("Error in getCallsWithUser:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};