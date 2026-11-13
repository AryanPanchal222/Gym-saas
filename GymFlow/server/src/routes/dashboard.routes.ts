import { Router } from "express";

import { getDashboard } from "../controllers/dashboard.controller.js";
import { getRetentionAnalytics } from "../controllers/retention.controller.js";
import {
  requireAuth,
  requireGymAccess,
} from "../middleware/auth.middleware.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireGymAccess);

router.get("/", getDashboard);
router.get("/retention", getRetentionAnalytics);

export default router;
