  import type { Request, Response } from "express";
  import crypto from "node:crypto";
  import prisma from "../lib/prisma.js";

  const QR_SESSION_DURATION_MINUTES = 5;

  export async function createQrSession(req: Request, res: Response) {
    try {
      const gymId = Number(req.params.gymId);

      if (!Number.isInteger(gymId) || gymId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid gym ID",
        });
      }

      const gym = await prisma.gym.findUnique({
        where: {
          id: gymId,
        },
      });

      if (!gym) {
        return res.status(404).json({
          success: false,
          message: "Gym not found",
        });
      }

      const token = crypto.randomBytes(32).toString("hex");

      const expiresAt = new Date(
        Date.now() + QR_SESSION_DURATION_MINUTES * 60 * 1000,
      );

      // Remove expired sessions for this gym.
      await prisma.qrSession.deleteMany({
        where: {
          gymId,
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      const qrSession = await prisma.qrSession.create({
        data: {
          gymId,
          token,
          expiresAt,
        },
      });

      return res.status(201).json({
        success: true,
        message: "QR session created successfully",
        qrSession: {
          id: qrSession.id,
          gymId: qrSession.gymId,
          token: qrSession.token,
          expiresAt: qrSession.expiresAt,
        },
      });
    } catch (error) {
      console.error("Create QR session error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create QR session",
      });
    }
  }