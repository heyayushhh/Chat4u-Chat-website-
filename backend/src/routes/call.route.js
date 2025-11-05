import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getCallsWithUser } from "../controllers/call.controller.js";

const router = express.Router();

// Fetch call logs between auth user and a given user
router.get("/:id", protectRoute, getCallsWithUser);

export default router;