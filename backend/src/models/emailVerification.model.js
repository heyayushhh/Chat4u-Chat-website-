import mongoose from "mongoose";

const emailVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

emailVerificationSchema.index({ email: 1 }, { unique: true });

const EmailVerification = mongoose.model("EmailVerification", emailVerificationSchema);
export default EmailVerification;