import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";

import prisma from "./lib/prisma.js";

import authRoutes from "./routes/auth.routes.js";
import gymRoutes from "./routes/gym.routes.js";
import planRoutes from "./routes/plan.routes.js";
import memberRoutes from "./routes/member.routes.js";
import membershipRoutes from "./routes/membership.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import noShowRoutes from "./routes/noShow.routes.js";
import followUpRoutes from "./routes/followUp.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import renewalRoutes from "./routes/renewal.routes.js";
import memberPortalRoutes from "./routes/memberPortal.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import operationsRoutes from "./routes/operations.routes.js";
import { startRenewalReminderScheduler } from "./services/renewal.scheduler.js";
import { razorpayWebhook } from "./controllers/renewal.controller.js";

import {
  requireAuth,
  requireGymAccess,
} from "./middleware/auth.middleware.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.post("/api/payments/razorpay/webhook", express.raw({ type: "application/json" }), razorpayWebhook);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

/* ================= HEALTH ================= */

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "GymFlow API is running 🚀",
  });
});

/* ================= DATABASE TEST ================= */

app.get("/api/db-test", async (_req, res) => {
  try {
    const gyms = await prisma.gym.findMany();

    res.json({
      success: true,
      message: "Database connection is working 🚀",
      gyms,
    });
  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

/* ================= AUTH ================= */

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/member-portal", memberPortalRoutes);

/* ================= GYM ROUTES ================= */

app.use(
  "/api/gyms/:gymId/plans",
  planRoutes,
);

app.use(
  "/api/gyms/:gymId/members",
  memberRoutes,
);

app.use(
  "/api/gyms/:gymId/members/:memberId/memberships",
  membershipRoutes,
);

/* ================= ATTENDANCE ================= */

// Gym-scoped attendance endpoints
app.use(
  "/api/gyms/:gymId/attendance",
  requireAuth,
  requireGymAccess,
  attendanceRoutes,
);

/* ================= NO-SHOWS ================= */

app.use(
  "/api/gyms/:gymId/no-shows",
  noShowRoutes,
);

/* ================= FOLLOW-UPS ================= */

app.use(
  "/api/gyms/:gymId/no-shows/:noShowCaseId/follow-ups",
  followUpRoutes,
);

/* ================= DASHBOARD ================= */

app.use(
  "/api/gyms/:gymId/dashboard",
  dashboardRoutes,
);

/* ================= GYM PROFILE ================= */

app.use(
  "/api/gyms/:gymId",
  gymRoutes,
);

/* ================= GYM RENEWALS ================= */

app.use(
  "/api/gyms/:gymId/renewals",
  renewalRoutes,
);

app.use(
  "/api/gyms/:gymId/operations",
  operationsRoutes,
);




/* ================= SERVER ================= */

app.listen(PORT, () => {
  console.log(
    `GymFlow API running on http://localhost:${PORT}`,
  );
  startRenewalReminderScheduler();
});

