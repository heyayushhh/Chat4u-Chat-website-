import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
// using console for logging to avoid extra dependencies

export const acceptTerms = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const updated = await User.findByIdAndUpdate(
      userId,
      { termsAccepted: true, termsAcceptedAt: now },
      { new: true }
    ).select("_id termsAccepted termsAcceptedAt accountStatus username hasPassword");
    res.status(200).json(updated);
  } catch (error) {
    console.error("acceptTerms failed:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const USERNAME_REGEX = /^[a-z0-9_\-]{3,20}$/;
export const setUsername = async (req, res) => {
  try {
    const userId = req.user._id;
    const raw = String(req.body?.username || "").trim().toLowerCase();
    if (!USERNAME_REGEX.test(raw)) {
      return res.status(400).json({ message: "Invalid username format" });
    }
    const exists = await User.findOne({ username: raw }).select("_id");
    if (exists && String(exists._id) !== String(userId)) {
      return res.status(400).json({ message: "Username already taken" });
    }
    const updated = await User.findByIdAndUpdate(
      userId,
      { username: raw },
      { new: true }
    ).select("_id username accountStatus termsAccepted hasPassword");
    res.status(200).json(updated);
  } catch (error) {
    console.error("setUsername failed:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const setPassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const password = String(req.body?.password || "");
    if (password.length < 10) {
      return res.status(400).json({ message: "Password must be at least 10 characters" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const updated = await User.findByIdAndUpdate(
      userId,
      { password: hashed, hasPassword: true },
      { new: true }
    ).select("_id hasPassword accountStatus username termsAccepted");
    res.status(200).json(updated);
  } catch (error) {
    console.error("setPassword failed:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const completeOnboarding = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select(
      "_id username termsAccepted hasPassword accountStatus"
    );
    if (!me) return res.status(404).json({ message: "User not found" });
    if (!me.termsAccepted) {
      return res.status(400).json({ message: "Please accept Terms & Conditions" });
    }
    if (!me.username || me.username.length < 3) {
      return res.status(400).json({ message: "Please choose a valid username" });
    }
    if (!me.hasPassword) {
      return res.status(400).json({ message: "Please set a password" });
    }
    if (me.accountStatus === "active") {
      return res.status(200).json(me);
    }
    me.accountStatus = "active";
    await me.save();
    res.status(200).json(me);
  } catch (error) {
    console.error("completeOnboarding failed:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};