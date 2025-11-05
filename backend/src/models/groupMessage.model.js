import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    // senderId optional to allow system messages (e.g., user deleted notice)
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: { type: String },
    image: { type: String },
    file: {
      url: { type: String },
      name: { type: String },
      type: { type: String },
      size: { type: Number }
    },
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
export default GroupMessage;