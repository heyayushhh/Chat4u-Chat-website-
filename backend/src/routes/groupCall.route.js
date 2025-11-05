import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getCallsForGroup, getActiveCallsForMe } from "../controllers/groupCall.controller.js";

const router = express.Router();

router.get("/:id", protectRoute, getCallsForGroup);
router.get("/active/me", protectRoute, getActiveCallsForMe);

export default router;