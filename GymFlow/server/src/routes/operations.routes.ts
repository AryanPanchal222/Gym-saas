import { Router } from "express";
import { requireAuth, requireGymAccess } from "../middleware/auth.middleware.js";
import { bookClass, createClass, createExpense, listClasses, listExpenses, listNotifications, listTrainers, markNotificationRead, operationsSummary } from "../controllers/operations.controller.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireGymAccess);
router.get("/expenses", listExpenses);
router.post("/expenses", createExpense);
router.get("/classes", listClasses);
router.post("/classes", createClass);
router.post("/classes/:classId/bookings", bookClass);
router.get("/trainers", listTrainers);
router.get("/notifications", listNotifications);
router.patch("/notifications/:notificationId/read", markNotificationRead);
router.get("/summary", operationsSummary);
export default router;
