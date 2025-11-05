import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getPublicUser } from "../controllers/user.controller.js";

const router = express.Router();

// Fetch public user info by id (authenticated)
router.get("/:id", protectRoute, getPublicUser);

export default router;