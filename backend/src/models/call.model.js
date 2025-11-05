import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    callerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    calleeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["audio", "video"], required: true },
    status: { type: String, enum: ["ringing", "active", "completed", "missed"], default: "ringing" },
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationSeconds: { type: Number },
  },
  { timestamps: true }
);

const Call = mongoose.model("Call", callSchema);

export default Call;