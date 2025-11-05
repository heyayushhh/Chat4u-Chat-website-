import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createGroup, getMyGroups, getGroupById, addMembers, removeMember, leaveGroup, updateGroupProfile, deleteGroup } from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", protectRoute, createGroup);
router.get("/", protectRoute, getMyGroups);
router.get("/:id", protectRoute, getGroupById);
router.put("/:id", protectRoute, updateGroupProfile);
router.post("/:id/add-members", protectRoute, addMembers);
router.delete("/:id/members/:memberId", protectRoute, removeMember);
router.post("/:id/leave", protectRoute, leaveGroup);
router.delete("/:id", protectRoute, deleteGroup);

export default router;