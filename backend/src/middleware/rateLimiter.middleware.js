import { config } from "../lib/config.js";

// Simple in-memory rate limiter (per key)
// Not suitable for multi-instance deployments; fine for a single node.
const buckets = new Map(); // key -> { count, windowStart }

const now = () => Date.now();

export const createRateLimiter = ({ windowMs, max, keyFn }) => {
  const window = Number(windowMs) || 60_000;
  const limit = Number(max) || 60;
  const kfn = typeof keyFn === "function" ? keyFn : (req) => req.ip;

  return (req, res, next) => {
    try {
      const key = kfn(req) || req.ip;
      const ts = now();
      const bucket = buckets.get(key);
      if (!bucket || ts - bucket.windowStart >= window) {
        buckets.set(key, { count: 1, windowStart: ts });
        return next();
      }
      if (bucket.count < limit) {
        bucket.count += 1;
        return next();
      }
      const retryAfter = Math.ceil((bucket.windowStart + window - ts) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ message: "Too many requests, slow down" });
    } catch (e) {
      // On limiter failure, do not block the request
      return next();
    }
  };
};

// Global API limiter (per IP or user)
export const apiRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  keyFn: (req) => (req.user?._id ? `u:${req.user._id}` : `ip:${req.ip}`),
});

// Message-specific limiter (stricter)
export const messageRateLimiter = createRateLimiter({
  windowMs: config.messageRateLimit.windowMs,
  max: config.messageRateLimit.max,
  keyFn: (req) => (req.user?._id ? `msg:${req.user._id}` : `msgip:${req.ip}`),
});