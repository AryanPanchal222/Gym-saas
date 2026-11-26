import { Router } from "express";

import {
  createMember,
  getMembers,
  getMemberById,
  saveMemberFace,
  deleteMember,
} from "../controllers/member.controller.js";
import { createPortalInvite } from "../controllers/memberPortal.controller.js";

import {
  requireAuth,
  requireGymAccess,
} from "../middleware/auth.middleware.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireGymAccess);

router.post("/", createMember);
router.get("/", getMembers);
router.get("/:memberId", getMemberById);
router.put("/:memberId/face", saveMemberFace);
router.delete("/:memberId", deleteMember);
router.post("/:memberId/portal-invite", createPortalInvite);

export default router;
