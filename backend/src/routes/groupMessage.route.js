import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getGroupMessages, sendGroupMessage, getGroupUnreadCountsBulk, getGroupLastSeen, updateGroupLastSeen, reactToGroupMessage } from "../controllers/groupMessage.controller.js";
import { messageRateLimiter } from "../middleware/rateLimiter.middleware.js";

const router = express.Router();

// Place specific routes before parameterized routes
router.post("/unread-counts", protectRoute, getGroupUnreadCountsBulk);
router.get("/last-seen", protectRoute, getGroupLastSeen);
router.post("/last-seen", protectRoute, updateGroupLastSeen);
router.get("/:id/messages", protectRoute, getGroupMessages);
router.post("/:id/messages", protectRoute, messageRateLimiter, sendGroupMessage);
// React to a specific group message
router.post("/:messageId/react", protectRoute, reactToGroupMessage);

export default router;