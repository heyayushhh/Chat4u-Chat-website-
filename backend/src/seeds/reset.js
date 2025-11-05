import { config } from "dotenv";
import { connectDB } from "../lib/db.js";
import mongoose from "mongoose";
import { logger } from "../lib/logger.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";

config();

async function reset() {
  try {
    await connectDB();

    const collections = [
      { name: "users", model: User },
      { name: "messages", model: Message },
      { name: "groups", model: Group },
      { name: "groupmessages", model: GroupMessage },
    ];

    const results = {};
    for (const { name, model } of collections) {
      const res = await model.deleteMany({});
      results[name] = res.deletedCount ?? 0;
    }

  logger.log("Database reset complete:", results);
  } catch (err) {
  logger.error("Database reset failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection?.close();
  }
}

reset();