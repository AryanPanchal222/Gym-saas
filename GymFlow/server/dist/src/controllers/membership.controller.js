import prisma from "../lib/prisma.js";
export async function createMembership(req, res) {
    try {
        const gymId = Number(req.params.gymId);
        const memberId = Number(req.params.memberId);
        const { planId, startDate } = req.body;
        if (!Number.isInteger(gymId) || gymId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid gym ID",
            });
        }
        if (!Number.isInteger(memberId) || memberId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid member ID",
            });
        }
        const numericPlanId = Number(planId);
        if (!Number.isInteger(numericPlanId) || numericPlanId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid plan ID",
            });
        }
        if (!startDate) {
            return res.status(400).json({
                success: false,
                message: "Start date is required",
            });
        }
        const parsedStartDate = new Date(startDate);
        if (Number.isNaN(parsedStartDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid start date",
            });
        }
        const [gym, member, plan] = await Promise.all([
            prisma.gym.findUnique({
                where: { id: gymId },
            }),
            prisma.member.findFirst({
                where: {
                    id: memberId,
                    gymId,
                },
            }),
            prisma.plan.findFirst({
                where: {
                    id: numericPlanId,
                    gymId,
                    isActive: true,
                },
            }),
        ]);
        if (!gym) {
            return res.status(404).json({
                success: false,
                message: "Gym not found",
            });
        }
        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found in this gym",
            });
        }
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "Active plan not found in this gym",
            });
        }
        const endDate = new Date(parsedStartDate);
        endDate.setDate(endDate.getDate() + plan.durationDays);
        const membership = await prisma.membership.create({
            data: {
                gymId,
                memberId,
                planId: numericPlanId,
                startDate: parsedStartDate,
                endDate,
                status: "ACTIVE",
            },
            include: {
                member: true,
                plan: true,
            },
        });
        return res.status(201).json({
            success: true,
            message: "Membership created successfully",
            membership,
        });
    }
    catch (error) {
        console.error("Create membership error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create membership",
        });
    }
}
export async function getMemberships(req, res) {
    try {
        const gymId = Number(req.params.gymId);
        const memberId = Number(req.params.memberId);
        if (!Number.isInteger(gymId) || gymId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid gym ID",
            });
        }
        if (!Number.isInteger(memberId) || memberId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid member ID",
            });
        }
        const memberships = await prisma.membership.findMany({
            where: {
                gymId,
                memberId,
            },
            include: {
                plan: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return res.json({
            success: true,
            memberships,
        });
    }
    catch (error) {
        console.error("Get memberships error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch memberships",
        });
    }
}
