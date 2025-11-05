import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, uploadAttachment, getUnreadCountsBulk, getDmLastSeen, updateDmLastSeen, reactToMessage } from "../controllers/message.controller.js";
import { messageRateLimiter } from "../middleware/rateLimiter.middleware.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/last-seen", protectRoute, getDmLastSeen);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, messageRateLimiter, sendMessage);
router.post("/uploads", protectRoute, messageRateLimiter, uploadAttachment);
router.post("/unread-counts", protectRoute, getUnreadCountsBulk);
router.post("/last-seen", protectRoute, updateDmLastSeen);
// React to a specific DM message
router.post("/:messageId/react", protectRoute, reactToMessage);

export default router;
