import mongoose from "mongoose";

const phoneVerificationSchema = new mongoose.Schema(
  {
    countryCode: { type: String, required: true },
    phone: { type: String, required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

phoneVerificationSchema.index({ countryCode: 1, phone: 1 }, { unique: true });

const PhoneVerification = mongoose.model("PhoneVerification", phoneVerificationSchema);
export default PhoneVerification;