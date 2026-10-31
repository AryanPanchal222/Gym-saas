import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

export async function getDashboard(req: Request, res: Response) {
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

    const now = new Date();

    // Start and end of today.
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    // Next 7 days.
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Active members.
    const activeMembers = await prisma.member.count({
      where: {
        gymId,
        memberships: {
          some: {
            status: "ACTIVE",
            startDate: {
              lte: now,
            },
            endDate: {
              gte: now,
            },
          },
        },
      },
    });

    // Today's check-ins.
    const todayCheckIns = await prisma.attendance.count({
      where: {
        gymId,
        checkedInAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    // Open no-show cases.
    const openNoShows = await prisma.noShowCase.count({
      where: {
        gymId,
        status: "OPEN",
      },
    });

    // Memberships expiring within the next 7 days.
    const renewalsDue = await prisma.membership.count({
      where: {
        gymId,
        status: "ACTIVE",
        endDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
    });

    // Latest attendance records.
    const recentAttendance = await prisma.attendance.findMany({
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
      take: 5,
    });

    return res.json({
      success: true,

      gym: {
        id: gym.id,
        name: gym.name,
      },

      stats: {
        activeMembers,
        todayCheckIns,
        openNoShows,
        renewalsDue,
      },

      recentAttendance,
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
}