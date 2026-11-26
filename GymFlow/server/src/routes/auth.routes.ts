import { Router } from "express";

import {
  signup,
  login,
  me,
  activateAccount,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";

import {
  requireAuth,
} from "../middleware/auth.middleware.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/activate-account", activateAccount);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", requireAuth, me);

export default router;
