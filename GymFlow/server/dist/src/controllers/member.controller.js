import prisma from "../lib/prisma.js";
export async function createMember(req, res) {
    try {
        const gymId = Number(req.params.gymId);
        const { name, email, phone } = req.body;
        if (!Number.isInteger(gymId) || gymId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid gym ID",
            });
        }
        if (!name || typeof name !== "string") {
            return res.status(400).json({
                success: false,
                message: "Member name is required",
            });
        }
        if (email !== undefined &&
            email !== null &&
            typeof email !== "string") {
            return res.status(400).json({
                success: false,
                message: "Email must be a string",
            });
        }
        if (phone !== undefined &&
            phone !== null &&
            typeof phone !== "string") {
            return res.status(400).json({
                success: false,
                message: "Phone must be a string",
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
        const member = await prisma.member.create({
            data: {
                gymId,
                name: name.trim(),
                email: email?.trim() || null,
                phone: phone?.trim() || null,
            },
        });
        return res.status(201).json({
            success: true,
            message: "Member created successfully",
            member,
        });
    }
    catch (error) {
        console.error("Create member error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create member",
        });
    }
}
export async function getMembers(req, res) {
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
        const members = await prisma.member.findMany({
            where: {
                gymId,
            },
            include: {
                memberships: {
                    orderBy: {
                        endDate: "desc",
                    },
                    include: {
                        plan: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return res.json({
            success: true,
            members: members.map(({ faceDescriptor, ...member }) => ({
                ...member,
                hasFaceEnrollment: Array.isArray(faceDescriptor),
            })),
        });
    }
    catch (error) {
        console.error("Get members error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch members",
        });
    }
}
export async function getMemberById(req, res) {
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
        const member = await prisma.member.findFirst({
            where: {
                id: memberId,
                gymId,
            },
            include: {
                memberships: {
                    orderBy: {
                        endDate: "desc",
                    },
                    include: {
                        plan: true,
                    },
                },
                attendances: {
                    orderBy: {
                        checkedInAt: "desc",
                    },
                    include: {
                        membership: {
                            include: {
                                plan: true,
                            },
                        },
                    },
                },
            },
        });
        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found in this gym",
            });
        }
        const { faceDescriptor, ...safeMember } = member;
        return res.json({
            success: true,
            member: { ...safeMember, hasFaceEnrollment: Array.isArray(faceDescriptor) },
        });
    }
    catch (error) {
        console.error("Get member profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch member profile",
        });
    }
}
export async function saveMemberFace(req, res) {
    const gymId = Number(req.params.gymId);
    const memberId = Number(req.params.memberId);
    const descriptor = req.body?.descriptor;
    if (!Number.isInteger(gymId) || !Number.isInteger(memberId) ||
        !Array.isArray(descriptor) || descriptor.length !== 128 ||
        !descriptor.every((value) => typeof value === "number" && Number.isFinite(value))) {
        return res.status(400).json({ success: false, message: "A valid 128-value face descriptor is required" });
    }
    try {
        const member = await prisma.member.findFirst({ where: { id: memberId, gymId } });
        if (!member)
            return res.status(404).json({ success: false, message: "Member not found in this gym" });
        await prisma.member.update({ where: { id: memberId }, data: { faceDescriptor: descriptor } });
        return res.json({ success: true, message: "Face enrollment saved" });
    }
    catch (error) {
        console.error("Save face enrollment error:", error);
        return res.status(500).json({ success: false, message: "Failed to save face enrollment" });
    }
}
export async function getFaceTemplates(req, res) {
    const gymId = Number(req.params.gymId);
    if (!Number.isInteger(gymId) || gymId <= 0)
        return res.status(400).json({ success: false, message: "Invalid gym ID" });
    try {
        const members = await prisma.member.findMany({
            where: { gymId, faceDescriptor: { not: null } },
            select: { id: true, name: true, faceDescriptor: true },
        });
        return res.json({ success: true, members });
    }
    catch (error) {
        console.error("Get face templates error:", error);
        return res.status(500).json({ success: false, message: "Failed to load face enrollments" });
    }
}
