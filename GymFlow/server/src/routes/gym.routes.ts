import { Router } from "express";

import {
  createGym,
  getGyms,
  getGym,
  updateGym,
} from "../controllers/gym.controller.js";

import {
  requireAuth,
  requireGymAccess,
} from "../middleware/auth.middleware.js";

const router = Router({
  mergeParams: true,
});

/*
 * These routes are protected.
 *
 * The requested :gymId must belong
 * to the authenticated user.
 */
router.use(requireAuth);
router.use(requireGymAccess);

/* Get the authenticated gym */
router.get("/", getGym);

/* Update the authenticated gym */
router.put("/", updateGym);

export default router;