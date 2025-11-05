import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import PhoneVerification from "../models/phoneVerification.model.js";
import EmailVerification from "../models/emailVerification.model.js";
import User from "../models/user.model.js";
import { logger } from "../lib/logger.js";
import { sendOtpSms } from "../lib/sms.js";
import { sendOtpEmail } from "../lib/mail.js";

const OTP_EXP_MINUTES = Number(process.env.OTP_EXP_MINUTES || 10);

const normalizePhone = (cc, phone) => {
  const c = String(cc || "").trim();
  const p = String(phone || "").replace(/\D/g, "");
  return { cc: c, p };
};

export const requestOtp = async (req, res) => {
  try {
    const { countryCode, phone } = req.body || {};
    const { cc, p } = normalizePhone(countryCode, phone);
    if (!cc || !cc.startsWith("+") || p.length < 6) {
      return res.status(400).json({ message: "Invalid country code or phone" });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(code, salt);
    const expiresAt = new Date(Date.now() + OTP_EXP_MINUTES * 60 * 1000);

    await PhoneVerification.findOneAndUpdate(
      { countryCode: cc, phone: p },
      { countryCode: cc, phone: p, otpHash: hash, expiresAt, verified: false, attempts: 0 },
      { upsert: true, new: true }
    );

    const sent = await sendOtpSms({ to: `${cc}${p}`, text: `Your Chatty verification code is ${code}` });
    if (!sent) {
      return res.status(500).json({ message: "Failed to send OTP" });
    }

    // Dev-only echo of code to simplify local testing
    const includeDevEcho = String(process.env.OTP_DEV_ECHO || "").trim() === "1" || (process.env.NODE_ENV !== "production");
    return res.status(200).json({
      message: "OTP sent",
      expiresInMinutes: OTP_EXP_MINUTES,
      devEchoCode: includeDevEcho ? code : undefined,
    });
  } catch (error) {
    logger.error("Error in requestOtp:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { countryCode, phone, code } = req.body || {};
    const { cc, p } = normalizePhone(countryCode, phone);
    if (!cc || !cc.startsWith("+") || !p || !code) {
      return res.status(400).json({ message: "Invalid verification payload" });
    }
    const record = await PhoneVerification.findOne({ countryCode: cc, phone: p });
    if (!record) return res.status(404).json({ message: "No OTP requested for this phone" });
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      return res.status(410).json({ message: "OTP expired" });
    }
    record.attempts = (record.attempts || 0) + 1;
    const ok = await bcrypt.compare(String(code), record.otpHash);
    if (!ok) {
      await record.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }
    record.verified = true;
    await record.save();
    // Issue short-lived token embedding phone info
    const token = jwt.sign({ cc, p, kind: "phone_verification" }, process.env.JWT_SECRET, { expiresIn: `${OTP_EXP_MINUTES}m` });
    return res.status(200).json({ verificationToken: token });
  } catch (error) {
    logger.error("Error in verifyOtp:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Email OTP: request
export const requestEmailOtp = async (req, res) => {
  try {
    const { email } = req.body || {};
    const e = String(email || "").trim().toLowerCase();
    if (!e || !/\S+@\S+\.\S+/.test(e)) {
      return res.status(400).json({ message: "Invalid email" });
    }

    // OTP is mandatory for brand new users. If email exists and is active, don't send.
    // Allow sending OTP when the email belongs to a soft-deleted account (reactivation path).
    const existing = await User.findOne({ email: e });
    if (existing && !existing.isDeleted) {
      return res.status(400).json({ message: "Email already registered. Please log in." });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(code, salt);
    const expiresAt = new Date(Date.now() + OTP_EXP_MINUTES * 60 * 1000);

    await EmailVerification.findOneAndUpdate(
      { email: e },
      { email: e, otpHash: hash, expiresAt, verified: false, attempts: 0 },
      { upsert: true, new: true }
    );

    const sent = await sendOtpEmail({ to: e, text: `Your Chatty verification code is ${code}` });
    if (!sent) return res.status(500).json({ message: "Failed to send OTP" });

    const includeDevEcho = String(process.env.OTP_DEV_ECHO || "").trim() === "1" || (process.env.NODE_ENV !== "production");
    return res.status(200).json({ message: "OTP sent", expiresInMinutes: OTP_EXP_MINUTES, devEchoCode: includeDevEcho ? code : undefined });
  } catch (error) {
    logger.error("Error in requestEmailOtp:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Email OTP: verify
export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, code } = req.body || {};
    const e = String(email || "").trim().toLowerCase();
    if (!e || !code) return res.status(400).json({ message: "Invalid verification payload" });
    const record = await EmailVerification.findOne({ email: e });
    if (!record) return res.status(404).json({ message: "No OTP requested for this email" });
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      return res.status(410).json({ message: "OTP expired" });
    }
    record.attempts = (record.attempts || 0) + 1;
    const ok = await bcrypt.compare(String(code), record.otpHash);
    if (!ok) {
      await record.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }
    record.verified = true;
    await record.save();
    const token = jwt.sign({ email: e, kind: "email_verification" }, process.env.JWT_SECRET, { expiresIn: `${OTP_EXP_MINUTES}m` });
    return res.status(200).json({ verificationToken: token });
  } catch (error) {
    logger.error("Error in verifyEmailOtp:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};