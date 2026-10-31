import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

export async function checkInMember(req: Request, res: Response) {
  try {
    const { memberId } = req.body;

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

    const attendance = await prisma.attendance.create({
      data: {
        gymId: numericGymId,
        memberId: numericMemberId,
        membershipId: membership.id,
        method: "MANUAL",
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

export async function qrCheckInMember(req: Request, res: Response) {
  try {
    const { token, phone } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        success: false,
        message: "QR token is required",
      });
    }

    if (!phone || typeof phone !== "string") {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const normalizedPhone = phone.replace(/\D/g, "");

    if (normalizedPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid phone number",
      });
    }

    // Find the QR session.
    // The QR session determines which gym this check-in belongs to.
    const qrSession = await prisma.qrSession.findUnique({
      where: {
        token,
      },
    });

    if (!qrSession) {
      return res.status(404).json({
        success: false,
        message: "Invalid QR session",
      });
    }

    const now = new Date();

    // QR sessions are valid only until their expiry time.
    if (qrSession.expiresAt <= now) {
      return res.status(410).json({
        success: false,
        message: "QR session has expired",
      });
    }

    // Find the member ONLY inside the gym that owns this QR session.
    const members = await prisma.member.findMany({
      where: {
        gymId: qrSession.gymId,
      },
    });

    const member = members.find((item) => {
      const memberPhone = (item.phone || "").replace(/\D/g, "");
      return memberPhone === normalizedPhone;
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "No member found with this phone number",
      });
    }

    // Find a currently active membership for this member.
    const membership = await prisma.membership.findFirst({
      where: {
        gymId: qrSession.gymId,
        memberId: member.id,
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
        message: "Your membership is not currently active",
      });
    }

    // Prevent duplicate check-ins during the same QR session.
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        gymId: qrSession.gymId,
        memberId: member.id,
        checkedInAt: {
          gte: qrSession.createdAt,
        },
        method: "QR",
      },
      orderBy: {
        checkedInAt: "desc",
      },
    });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message: "You have already checked in using this QR session",
        attendance: existingAttendance,
      });
    }

    // Create the attendance record.
    const attendance = await prisma.attendance.create({
      data: {
        gymId: qrSession.gymId,
        memberId: member.id,
        membershipId: membership.id,
        method: "QR",
      },
      include: {
        member: true,
        membership: {
          include: {
            plan: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Check-in successful",
      attendance,
    });
  } catch (error) {
    console.error("QR check-in error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to process QR check-in",
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