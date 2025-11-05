import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { approveRequest, getIncomingRequests, sendRequest, removeContact } from "../controllers/contacts.controller.js";

const router = express.Router();

router.post("/request", protectRoute, sendRequest);
router.get("/incoming", protectRoute, getIncomingRequests);
router.post("/approve", protectRoute, approveRequest);
router.delete("/:id", protectRoute, removeContact);

export default router;