import { Router } from "express";
import { createAdminPlan, createCustomer, getOverview, listAdminPlans, listCustomers, resendInvitation, setCustomerStatus, updateCustomer, uploadCustomerLogo } from "../controllers/admin.controller.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.middleware.js";
import { logoUpload } from "../middleware/upload.middleware.js";

const router = Router();
router.use(requireAuth, requireSuperAdmin);
router.get("/customers", listCustomers);
router.post("/customers", createCustomer);
router.patch("/customers/:userId", updateCustomer);
router.post("/customers/:userId/logo", logoUpload.single("logo"), uploadCustomerLogo);
router.patch("/customers/:userId/status", setCustomerStatus);
router.post("/customers/:userId/resend-invitation", resendInvitation);
router.get("/overview", getOverview);
router.get("/plans", listAdminPlans);
router.post("/plans", createAdminPlan);
export default router;
