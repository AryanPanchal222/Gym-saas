import { Router } from "express";
import { createFollowUp, getFollowUps, } from "../controllers/followUp.controller.js";
import { requireAuth, requireGymAccess, } from "../middleware/auth.middleware.js";
const router = Router({ mergeParams: true });
router.use(requireAuth);
router.use(requireGymAccess);
router.post("/", createFollowUp);
router.get("/", getFollowUps);
export default router;
