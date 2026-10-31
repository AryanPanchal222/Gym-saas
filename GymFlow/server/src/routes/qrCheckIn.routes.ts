import { Router } from "express";

import { qrCheckInMember } from "../controllers/attendance.controller.js";

const router = Router();

/*
 * PUBLIC MEMBER CHECK-IN
 *
 * Members do NOT need an admin/staff login.
 * The QR token itself identifies the gym session.
 */
router.post("/qr-check-in", qrCheckInMember);

export default router;