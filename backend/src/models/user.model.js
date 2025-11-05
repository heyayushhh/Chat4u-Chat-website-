import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    // Password becomes optional for OAuth users until onboarding completes
    hasPassword: {
      type: Boolean,
      default: true,
      index: true,
    },
    password: {
      type: String,
      required: function () {
        return this.hasPassword === true;
      },
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    // Identity and verification
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    oauthProvider: {
      type: String,
      enum: ["google", "github", null],
      default: null,
      index: true,
    },
    oauthId: {
      type: String,
      default: null,
      index: true,
    },
    // Terms & onboarding state
    termsAccepted: {
      type: Boolean,
      default: false,
      index: true,
    },
    termsAcceptedAt: {
      type: Date,
      default: null,
    },
    accountStatus: {
      type: String,
      enum: ["pending_onboarding", "active"],
      default: "active",
      index: true,
    },
    // Phone (with country code) for OTP verification at signup
    countryCode: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      index: true,
      unique: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    // Soft delete fields
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    incomingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    outgoingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Cross-device last-seen maps
    dmLastSeen: {
      type: Map,
      of: Number,
      default: {},
    },
    groupLastSeen: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

// Ensure usernames are unique among active (non-deleted) users only.
// This allows a deleted account's username to be reused by a new user.
// Note: keep email globally unique, but relax username uniqueness for soft-deleted records.
userSchema.index({ username: 1 }, { unique: true, partialFilterExpression: { isDeleted: false }, name: "unique_active_username" });

const User = mongoose.model("User", userSchema);

export default User;
