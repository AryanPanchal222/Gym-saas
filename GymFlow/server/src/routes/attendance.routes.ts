import { Router } from "express";

import {
  checkInMember,
  getAttendance,
  qrCheckInMember,
} from "../controllers/attendance.controller.js";

import {
  requireAuth,
  requireGymAccess,
} from "../middleware/auth.middleware.js";

const router = Router({ mergeParams: true });

// Gym-scoped attendance routes
router.use(requireAuth);
router.use(requireGymAccess);

router.post("/check-in", checkInMember);
router.get("/", getAttendance);

export default router;