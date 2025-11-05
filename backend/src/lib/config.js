import dotenv from "dotenv";

dotenv.config();

const envNumber = (name, def) => {
  const v = process.env[name];
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

// Limits in MB
const BODY_LIMIT_MB = envNumber("BODY_LIMIT_MB", 50);
const IMAGE_MAX_MB = envNumber("IMAGE_MAX_MB", 10);
const VIDEO_MAX_MB = envNumber("VIDEO_MAX_MB", 50);
const PDF_MAX_MB = envNumber("PDF_MAX_MB", 25);
const MESSAGE_MAX_LENGTH = envNumber("MESSAGE_MAX_LENGTH", 5000);
const MAX_ATTACHMENTS_PER_MESSAGE = envNumber("MAX_ATTACHMENTS_PER_MESSAGE", 1);
const RATE_LIMIT_WINDOW_MS = envNumber("RATE_LIMIT_WINDOW_MS", 60_000);
const RATE_LIMIT_MAX_REQUESTS = envNumber("RATE_LIMIT_MAX_REQUESTS", 60);
const MESSAGE_RATE_LIMIT_WINDOW_MS = envNumber("MESSAGE_RATE_LIMIT_WINDOW_MS", 10_000);
const MESSAGE_RATE_LIMIT_MAX = envNumber("MESSAGE_RATE_LIMIT_MAX", 10);
const USER_STORAGE_QUOTA_MB = envNumber("USER_STORAGE_QUOTA_MB", 2048); // 2GB default

export const config = {
  limits: {
    bodyLimitBytes: BODY_LIMIT_MB * 1024 * 1024,
    imageMaxBytes: IMAGE_MAX_MB * 1024 * 1024,
    videoMaxBytes: VIDEO_MAX_MB * 1024 * 1024,
    pdfMaxBytes: PDF_MAX_MB * 1024 * 1024,
    messageMaxLength: MESSAGE_MAX_LENGTH,
    maxAttachmentsPerMessage: MAX_ATTACHMENTS_PER_MESSAGE,
    userStorageQuotaBytes: USER_STORAGE_QUOTA_MB * 1024 * 1024,
  },
  rateLimit: {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_REQUESTS,
  },
  messageRateLimit: {
    windowMs: MESSAGE_RATE_LIMIT_WINDOW_MS,
    max: MESSAGE_RATE_LIMIT_MAX,
  },
};

export const publicConfig = {
  limits: {
    imageMaxMB: IMAGE_MAX_MB,
    videoMaxMB: VIDEO_MAX_MB,
    pdfMaxMB: PDF_MAX_MB,
    messageMaxLength: MESSAGE_MAX_LENGTH,
    maxAttachmentsPerMessage: MAX_ATTACHMENTS_PER_MESSAGE,
  },
};