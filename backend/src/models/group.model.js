import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Track when each member joined; used to restrict visibility of older messages to new members
    joinedAtMap: { type: Map, of: Date, default: {} },
    avatar: { type: String },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

// Ensure admin is always part of members
groupSchema.pre("save", function (next) {
  const adminIdStr = String(this.adminId);
  const hasAdmin = this.members?.some((m) => String(m) === adminIdStr);
  if (!hasAdmin) this.members.push(this.adminId);
  // Deduplicate members
  try {
    const seen = new Set();
    const deduped = [];
    for (const m of this.members || []) {
      const key = String(m);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(m);
      }
    }
    this.members = deduped;
  } catch (_) {}
  // Ensure joinedAt exists for any present members (do not overwrite existing)
  try {
    const now = new Date();
    if (!this.joinedAtMap || typeof this.joinedAtMap.set !== "function") {
      this.joinedAtMap = new Map();
    }
    for (const mid of this.members) {
      const key = String(mid);
      const existing = this.joinedAtMap.get(key);
      if (!existing) this.joinedAtMap.set(key, now);
    }
  } catch (_) {}
  next();
});

const Group = mongoose.model("Group", groupSchema);
export default Group;