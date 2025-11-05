import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

import path from "path";

import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";
import oauthRoutes from "./routes/oauth.route.js";
import onboardingRoutes from "./routes/onboarding.route.js";
import messageRoutes from "./routes/message.route.js";
import contactsRoutes from "./routes/contacts.route.js";
import groupRoutes from "./routes/group.route.js";
import groupMessageRoutes from "./routes/groupMessage.route.js";
import userRoutes from "./routes/user.route.js";
import callRoutes from "./routes/call.route.js";
import groupCallRoutes from "./routes/groupCall.route.js";
import otpRoutes from "./routes/otp.route.js";
import { app, server } from "./lib/socket.js";
import { logger } from "./lib/logger.js";
import { config } from "./lib/config.js";
import configRoutes from "./routes/config.route.js";
import { apiRateLimiter } from "./middleware/rateLimiter.middleware.js";

dotenv.config();

const PORT = process.env.PORT;
const __dirname = path.resolve();

// Body size limit from env-config (supports base64 uploads)
const bodyLimitBytes = config.limits.bodyLimitBytes;
app.use(express.json({ limit: bodyLimitBytes }));
app.use(express.urlencoded({ extended: true, limit: bodyLimitBytes }));
app.use(cookieParser());
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

const CLIENT_URL = process.env.CLIENT_URL; // set by Render later (your Netlify URL)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin (no origin header)
      if (!origin) return callback(null, true);

      // Allow local dev origins or the configured production client URL
      if (DEV_ORIGINS.includes(origin) || (CLIENT_URL && origin === CLIENT_URL)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);


// Apply a global API rate limiter (per user/IP) for write operations only
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "OPTIONS" || req.method === "HEAD") return next();
  return apiRateLimiter(req, res, next);
});

app.use("/api/auth", authRoutes);
app.use("/api/auth/oauth", oauthRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/config", configRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/contacts", contactsRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/group-messages", groupMessageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/group-calls", groupCallRoutes);
app.use("/api/otp", otpRoutes);

// Lightweight health check for uptime monitoring and local diagnostics
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

import fs from "fs";

// -------------------------------
// Serve frontend only if it exists
// -------------------------------
const frontendDist = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  app.get("/*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });

  logger.log("✅ Frontend static assets found — serving from ", frontendDist);
} else {
  logger.log("⚠️ Frontend dist not found. Skipping static file serving (backend-only mode).");
  // In backend-only deployments (e.g., Render), redirect root to CLIENT_URL if provided
  app.get("/", (req, res) => {
    if (CLIENT_URL) return res.redirect(CLIENT_URL);
    return res.status(200).json({
      status: "backend-only",
      message: "Frontend is not bundled on this server. Set CLIENT_URL to your deployed frontend.",
    });
  });
}


server.listen(PORT, () => {
  logger.log("server is running on PORT:" + PORT);
  connectDB();
});
