import { Router } from "express";

import {
  getRenewals,
  createRenewalOrder,
  getRenewalOrder,
  markRenewalPaid,
  cancelRenewal,
  getInvoices,
  sendRenewalReminder,
} from "../controllers/renewal.controller.js";

import {
  requireAuth,
  requireGymAccess,
} from "../middleware/auth.middleware.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireGymAccess);

router.get("/", getRenewals);

router.get("/invoices", getInvoices);

router.post("/", createRenewalOrder);

router.get("/:renewalId", getRenewalOrder);

router.post("/:renewalId/mark-paid", markRenewalPaid);

router.post("/:renewalId/cancel", cancelRenewal);

router.post("/membership/:membershipId/send-reminder", sendRenewalReminder);

export default router;
