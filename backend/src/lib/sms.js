import { logger } from "./logger.js";

// Optional Twilio support via env vars; falls back to logger
const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
let twilioClient = null;
if (hasTwilio) {
  try {
    const twilio = (await import("twilio")).default;
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (e) {
    logger.error("Failed to initialize Twilio client:", e);
  }
}

export const sendOtpSms = async ({ to, text }) => {
  if (twilioClient) {
    try {
      await twilioClient.messages.create({ to, from: process.env.TWILIO_FROM_NUMBER, body: text });
      return true;
    } catch (e) {
      logger.error("Twilio send failed:", e);
      return false;
    }
  }
  // Fallback: log only (useful for dev/test without provider)
  logger.log(`[SMS Fallback] to=${to} text=${text}`);
  return true;
};