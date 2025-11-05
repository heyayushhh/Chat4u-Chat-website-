import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  acceptTerms,
  setUsername,
  setPassword,
  completeOnboarding,
} from "../controllers/onboarding.controller.js";

const router = express.Router();

router.post("/terms", protectRoute, acceptTerms);
router.post("/username", protectRoute, setUsername);
router.post("/password", protectRoute, setPassword);
router.post("/complete", protectRoute, completeOnboarding);

export default router;