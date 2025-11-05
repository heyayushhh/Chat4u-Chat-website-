import { logger } from "./logger.js";

let transporter = null;
const emailService = String(process.env.EMAIL_SERVICE || "").trim().toLowerCase();
const hasSmtpCreds = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
const hasHostConfig = !!(process.env.EMAIL_HOST && process.env.EMAIL_PORT);

if (hasSmtpCreds && (emailService === "gmail" || hasHostConfig)) {
  try {
    const nodemailer = (await import("nodemailer")).default;
    if (emailService === "gmail") {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS, // Use Gmail App Password (not your login password)
        },
      });
    } else {
      const secure = String(process.env.EMAIL_SECURE || "").trim() === "true" || Number(process.env.EMAIL_PORT) === 465;
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    }
    logger.log("Mail transporter initialized");
  } catch (e) {
    logger.error("Failed to initialize mail transporter:", e);
  }
}

export const sendOtpEmail = async ({ to, subject = "Your verification code", text }) => {
  if (transporter) {
    try {
      await transporter.sendMail({ from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to, subject, text });
      logger.log(`[Email Sent] to=${to} subject=${subject}`);
      return true;
    } catch (e) {
      logger.error("SMTP send failed:", e);
      return false;
    }
  }
  // Fallback: only allow in explicit dev/test
  const allowFallback = String(process.env.EMAIL_DEV_FALLBACK || "").trim() === "1" || (process.env.NODE_ENV !== "production");
  if (allowFallback) {
    logger.log(`[Email Fallback] to=${to} subject=${subject} text=${text}`);
    return true;
  }
  return false;
};