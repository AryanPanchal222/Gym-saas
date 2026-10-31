import prisma from "../lib/prisma.js";
const VALID_OUTCOMES = [
    "WILL_RETURN",
    "INJURED",
    "TRAVELLING",
    "TIMING_ISSUE",
    "UNHAPPY",
    "NO_RESPONSE",
    "CANCELLED",
];
export async function createFollowUp(req, res) {
    try {
        const gymId = Number(req.params.gymId);
        const noShowCaseId = Number(req.params.noShowCaseId);
        const { outcome, notes, nextActionAt } = req.body;
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
        if (!VALID_OUTCOMES.includes(outcome)) {
            return res.status(400).json({
                success: false,
                message: "Invalid follow-up outcome",
            });
        }
        if (notes !== undefined &&
            notes !== null &&
            typeof notes !== "string") {
            return res.status(400).json({
                success: false,
                message: "Notes must be a string",
            });
        }
        let parsedNextActionAt = null;
        if (nextActionAt !== undefined && nextActionAt !== null) {
            parsedNextActionAt = new Date(nextActionAt);
            if (Number.isNaN(parsedNextActionAt.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid next action date",
                });
            }
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
        const followUp = await prisma.followUp.create({
            data: {
                gymId,
                noShowCaseId,
                memberId: noShowCase.memberId,
                outcome,
                notes: notes?.trim() || null,
                nextActionAt: parsedNextActionAt,
            },
            include: {
                member: true,
                noShowCase: true,
            },
        });
        return res.status(201).json({
            success: true,
            message: "Follow-up created successfully",
            followUp,
        });
    }
    catch (error) {
        console.error("Create follow-up error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create follow-up",
        });
    }
}
export async function getFollowUps(req, res) {
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
        const followUps = await prisma.followUp.findMany({
            where: {
                gymId,
                noShowCaseId,
            },
            include: {
                member: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return res.json({
            success: true,
            noShowCase,
            count: followUps.length,
            followUps,
        });
    }
    catch (error) {
        console.error("Get follow-ups error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch follow-ups",
        });
    }
}
