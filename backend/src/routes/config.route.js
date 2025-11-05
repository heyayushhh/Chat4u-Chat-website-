import express from "express";
import { getPublicConfig } from "../controllers/config.controller.js";

const router = express.Router();

router.get("/public", getPublicConfig);

export default router;