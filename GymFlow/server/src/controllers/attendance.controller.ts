import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

export async function checkInMember(req: Request, res: Response) {
  try {
    const { memberId, method } = req.body;

    // Gym ID comes from the protected route:
    // /api/gyms/:gymId/attendance/check-in
    const numericGymId = Number(req.params.gymId);
    const numericMemberId = Number(memberId);

    if (!Number.isInteger(numericGymId) || numericGymId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid gym ID",
      });
    }

    if (!Number.isInteger(numericMemberId) || numericMemberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID",
      });
    }

    const gym = await prisma.gym.findUnique({
      where: {
        id: numericGymId,
      },
    });

    if (!gym) {
      return res.status(404).json({
        success: false,
        message: "Gym not found",
      });
    }

    const member = await prisma.member.findFirst({
      where: {
        id: numericMemberId,
        gymId: numericGymId,
      },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found in this gym",
      });
    }

    if (method === "FACE" && !Array.isArray(member.faceDescriptor)) {
      return res.status(409).json({
        success: false,
        message: "Member does not have face recognition enrolled",
      });
    }

    const now = new Date();

    const membership = await prisma.membership.findFirst({
      where: {
        gymId: numericGymId,
        memberId: numericMemberId,
        status: "ACTIVE",
        startDate: {
          lte: now,
        },
        endDate: {
          gte: now,
        },
      },
      orderBy: {
        endDate: "desc",
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "Member does not have a valid active membership",
      });
    }

    if (method === "FACE") {
      const cooldownMs = 5 * 60 * 1000;
      const checkedInAfter = new Date(now.getTime() - cooldownMs);
      const recentFaceAttendance = await prisma.attendance.findFirst({
        where: {
          gymId: numericGymId,
          memberId: numericMemberId,
          method: "FACE",
          checkedInAt: { gt: checkedInAfter },
        },
        orderBy: { checkedInAt: "desc" },
      });

      if (recentFaceAttendance) {
        const retryAfterSeconds = Math.max(
          0,
          Math.ceil((recentFaceAttendance.checkedInAt.getTime() + cooldownMs - now.getTime()) / 1000),
        );
        const retryMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
        return res.status(409).json({
          success: false,
          message: `Already checked in. Please try again in ${retryMinutes} minute${retryMinutes === 1 ? "" : "s"}.`,
          retryAfterSeconds,
        });
      }
    }

    const attendance = await prisma.attendance.create({
      data: {
        gymId: numericGymId,
        memberId: numericMemberId,
        membershipId: membership.id,
        method: method === "FACE" ? "FACE" : "MANUAL",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Member checked in successfully",
      attendance,
    });
  } catch (error) {
    console.error("Check-in error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check in member",
    });
  }
}

export async function getAttendance(req: Request, res: Response) {
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

    const attendance = await prisma.attendance.findMany({
      where: {
        gymId,
      },
      include: {
        member: true,
        membership: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        checkedInAt: "desc",
      },
    });

    return res.json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error("Get attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
    });
  }
}
