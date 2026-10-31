import prisma from "../lib/prisma.js";
const NO_SHOW_THRESHOLD_DAYS = 10;
export async function getNoShows(req, res) {
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
        const activeMembers = await prisma.member.findMany({
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
            include: {
                attendances: {
                    orderBy: {
                        checkedInAt: "desc",
                    },
                    take: 1,
                },
                memberships: {
                    where: {
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
                    take: 1,
                    include: {
                        plan: true,
                    },
                },
            },
        });
        const noShows = [];
        for (const member of activeMembers) {
            const latestAttendance = member.attendances[0];
            const lastAttendance = latestAttendance?.checkedInAt ?? null;
            const referenceDate = lastAttendance ?? member.createdAt;
            const inactiveDays = Math.floor((now.getTime() - referenceDate.getTime()) /
                (1000 * 60 * 60 * 24));
            if (inactiveDays < NO_SHOW_THRESHOLD_DAYS) {
                continue;
            }
            const latestCase = await prisma.noShowCase.findFirst({
                where: {
                    gymId,
                    memberId: member.id,
                },
                orderBy: {
                    createdAt: "desc",
                },
            });
            // If there is already an open case, update it.
            if (latestCase?.status === "OPEN") {
                const updatedCase = await prisma.noShowCase.update({
                    where: {
                        id: latestCase.id,
                    },
                    data: {
                        lastAttendance,
                        inactiveDays,
                    },
                });
                noShows.push({
                    id: updatedCase.id,
                    memberId: member.id,
                    memberName: member.name,
                    phone: member.phone,
                    email: member.email,
                    lastAttendance,
                    inactiveDays,
                    status: updatedCase.status,
                    detectedAt: updatedCase.detectedAt,
                    membership: member.memberships[0] ?? null,
                });
                continue;
            }
            // If the latest case was resolved, only allow a new case
            // after the member has attended again.
            if (latestCase?.status === "RESOLVED") {
                const attendanceAfterResolution = latestAttendance &&
                    latestAttendance.checkedInAt > latestCase.updatedAt;
                if (!attendanceAfterResolution) {
                    continue;
                }
            }
            // If the latest case was cancelled, don't automatically
            // create another case for the same inactivity period.
            if (latestCase?.status === "CANCELLED") {
                continue;
            }
            const newCase = await prisma.noShowCase.create({
                data: {
                    gymId,
                    memberId: member.id,
                    lastAttendance,
                    inactiveDays,
                    status: "OPEN",
                },
            });
            noShows.push({
                id: newCase.id,
                memberId: member.id,
                memberName: member.name,
                phone: member.phone,
                email: member.email,
                lastAttendance,
                inactiveDays,
                status: newCase.status,
                detectedAt: newCase.detectedAt,
                membership: member.memberships[0] ?? null,
            });
        }
        return res.json({
            success: true,
            thresholdDays: NO_SHOW_THRESHOLD_DAYS,
            count: noShows.length,
            noShows,
        });
    }
    catch (error) {
        console.error("Get no-shows error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch no-show members",
        });
    }
}
export async function resolveNoShowCase(req, res) {
    try {
        const gymId = Number(req.params.gymId);
        const noShowCaseId = Number(req.params.noShowCaseId);
        if (!Number.isInteger(gymId) || gymId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid gym ID",
            });
        }
        if (!Number.isInteger(noShowCaseId) || noShowCaseId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid no-show case ID",
            });
        }
        const noShowCase = await prisma.noShowCase.findFirst({
            where: {
                id: noShowCaseId,
                gymId,
            },
        });
        if (!noShowCase) {
            return res.status(404).json({
                success: false,
                message: "No-show case not found in this gym",
            });
        }
        if (noShowCase.status !== "OPEN") {
            return res.status(400).json({
                success: false,
                message: "No-show case is already closed",
            });
        }
        const resolvedCase = await prisma.noShowCase.update({
            where: {
                id: noShowCaseId,
            },
            data: {
                status: "RESOLVED",
            },
        });
        return res.json({
            success: true,
            message: "No-show case resolved successfully",
            noShowCase: resolvedCase,
        });
    }
    catch (error) {
        console.error("Resolve no-show case error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to resolve no-show case",
        });
    }
}
