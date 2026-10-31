import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import prisma from "./lib/prisma.js";
import authRoutes from "./routes/auth.routes.js";
import gymRoutes from "./routes/gym.routes.js";
import planRoutes from "./routes/plan.routes.js";
import memberRoutes from "./routes/member.routes.js";
import membershipRoutes from "./routes/membership.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import noShowRoutes from "./routes/noShow.routes.js";
import qrSessionRoutes from "./routes/qrSession.routes.js";
import followUpRoutes from "./routes/followUp.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import qrCheckInRoutes from "./routes/qrCheckIn.routes.js";
import renewalRoutes from "./routes/renewal.routes.js";
import { requireAuth, requireGymAccess, } from "./middleware/auth.middleware.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
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
    }
    catch (error) {
        console.error("Database error:", error);
        res.status(500).json({
            success: false,
            message: "Database connection failed",
        });
    }
});
/* ================= AUTH ================= */
app.use("/api/auth", authRoutes);
/* ================= GYM ROUTES ================= */
app.use("/api/gyms/:gymId/plans", planRoutes);
app.use("/api/gyms/:gymId/members", memberRoutes);
app.use("/api/gyms/:gymId/members/:memberId/memberships", membershipRoutes);
/* ================= ATTENDANCE ================= */
// General QR attendance endpoint
app.use("/api/attendance", qrCheckInRoutes);
// Gym-scoped attendance endpoints
app.use("/api/gyms/:gymId/attendance", requireAuth, requireGymAccess, attendanceRoutes);
/* ================= NO-SHOWS ================= */
app.use("/api/gyms/:gymId/no-shows", noShowRoutes);
/* ================= FOLLOW-UPS ================= */
app.use("/api/gyms/:gymId/no-shows/:noShowCaseId/follow-ups", followUpRoutes);
/* ================= QR SESSIONS ================= */
app.use("/api/gyms/:gymId/qr-sessions", qrSessionRoutes);
/* ================= DASHBOARD ================= */
app.use("/api/gyms/:gymId/dashboard", dashboardRoutes);
/* ================= GYM PROFILE ================= */
app.use("/api/gyms/:gymId", gymRoutes);
/* ================= GYM RENEWALS ================= */
app.use("/api/gyms/:gymId/renewals", renewalRoutes);
/* ================= SERVER ================= */
app.listen(PORT, () => {
    console.log(`GymFlow API running on http://localhost:${PORT}`);
});
