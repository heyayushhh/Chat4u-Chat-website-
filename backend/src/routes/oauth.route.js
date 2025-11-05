import express from "express";
import { googleRedirect, googleCallback } from "../controllers/oauth.controller.js";

const router = express.Router();

// Google OAuth
router.get("/google/redirect", googleRedirect);
router.get("/google/callback", googleCallback);

export default router;