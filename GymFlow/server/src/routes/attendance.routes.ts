import { Router } from "express";

import { checkInMember, getAttendance } from "../controllers/attendance.controller.js";
import { getFaceTemplates } from "../controllers/member.controller.js";

import {
  requireAuth,
  requireGymAccess,
} from "../middleware/auth.middleware.js";

const router = Router({ mergeParams: true });

// Gym-scoped attendance routes
router.use(requireAuth);
router.use(requireGymAccess);

router.post("/check-in", checkInMember);
router.get("/face-templates", getFaceTemplates);
router.get("/", getAttendance);

export default router;
