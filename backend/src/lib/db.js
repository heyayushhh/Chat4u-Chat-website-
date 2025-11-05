import mongoose from "mongoose";
import { logger } from "./logger.js";
import User from "../models/user.model.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.log(`MongoDB connected: ${conn.connection.host}`);

    // Sync indexes to drop legacy global unique index on username and create partial unique index
    try {
      await User.syncIndexes();
      const indexes = await User.collection.indexes();
      const legacy = indexes.find((i) => i?.name === "username_1" && i?.unique && !i?.partialFilterExpression);
      if (legacy) {
        try {
          await User.collection.dropIndex("username_1");
          logger.log("Dropped legacy username_1 unique index");
          await User.syncIndexes();
        } catch (dropErr) {
          logger.warn("Failed to drop legacy username_1 index:", dropErr?.message || dropErr);
        }
      }
      logger.log("User indexes synced");
    } catch (syncErr) {
      logger.warn("User index sync failed:", syncErr?.message || syncErr);
    }
  } catch (error) {
    logger.error("MongoDB connection error:", error);
  }
};
