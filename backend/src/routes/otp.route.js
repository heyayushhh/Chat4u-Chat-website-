import express from "express";
import { requestOtp, verifyOtp, requestEmailOtp, verifyEmailOtp } from "../controllers/otp.controller.js";

const router = express.Router();

router.post("/request", requestOtp);
router.post("/verify", verifyOtp);
router.post("/email/request", requestEmailOtp);
router.post("/email/verify", verifyEmailOtp);

export default router;