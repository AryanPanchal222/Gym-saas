import { Router } from "express";

import {
  createPlan,
  getPlans,
} from "../controllers/plan.controller.js";

import {
  requireAuth,
  requireGymAccess,
} from "../middleware/auth.middleware.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireGymAccess);

router.post("/", createPlan);
router.get("/", getPlans);

export default router;