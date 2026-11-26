import { Router } from "express";

import {
  createPlan,
  getPlans,
  deletePlan,
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
router.delete("/:planId", deletePlan);

export default router;
