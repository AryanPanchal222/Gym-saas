import { Router } from "express";
import {
  activateMemberPortal,
  getMemberPortalHome,
  loginMemberPortal,
} from "../controllers/memberPortal.controller.js";
import { requireMemberAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/activate", activateMemberPortal);
router.post("/login", loginMemberPortal);
router.get("/me", requireMemberAuth, getMemberPortalHome);

export default router;
