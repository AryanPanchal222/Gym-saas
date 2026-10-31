import { Router } from "express";
import { createQrSession } from "../controllers/qrSession.controller.js";
import { requireAuth, requireGymAccess, } from "../middleware/auth.middleware.js";
const router = Router({ mergeParams: true });
router.use(requireAuth);
router.use(requireGymAccess);
router.post("/", createQrSession);
export default router;
