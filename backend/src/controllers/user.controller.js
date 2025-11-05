import User from "../models/user.model.js";
import { logger } from "../lib/logger.js";

export const getPublicUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("fullName username profilePic description");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    logger.error("Error in getPublicUser:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};