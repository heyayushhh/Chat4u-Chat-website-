import Message from "../models/message.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import { config } from "./config.js";

export const getUserAttachmentUsageBytes = async (userId) => {
  const pipeline = [
    { $match: { senderId: userId, "file.size": { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: "$file.size" } } },
  ];
  const [direct] = await Message.aggregate(pipeline);
  const [group] = await GroupMessage.aggregate(pipeline);
  const total = (direct?.total || 0) + (group?.total || 0);
  return total;
};

export const getUserQuotaBytes = () => config.limits.userStorageQuotaBytes;