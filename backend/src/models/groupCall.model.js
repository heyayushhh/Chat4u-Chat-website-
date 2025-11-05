import mongoose from "mongoose";

const groupCallSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["audio", "video"], required: true },
    status: { type: String, enum: ["ringing", "active", "completed", "missed"], default: "ringing" },
    participantsAccepted: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Track currently active participants; call ends when this becomes empty
    participantsActive: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationSeconds: { type: Number },
  },
  { timestamps: true }
);

const GroupCall = mongoose.model("GroupCall", groupCallSchema);

export default GroupCall;