import prisma from "../lib/prisma.js";
export async function createGym(req, res) {
    try {
        const { name, email, phone, address } = req.body;
        if (typeof name !== "string" ||
            name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Gym name is required.",
            });
        }
        const gym = await prisma.gym.create({
            data: {
                name: name.trim(),
                email: typeof email === "string"
                    ? email.trim() || null
                    : null,
                phone: typeof phone === "string"
                    ? phone.trim() || null
                    : null,
                address: typeof address === "string"
                    ? address.trim() || null
                    : null,
            },
        });
        return res.status(201).json({
            success: true,
            gym,
        });
    }
    catch (error) {
        console.error("Create gym error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to create gym.",
        });
    }
}
export async function getGyms(_req, res) {
    try {
        const gyms = await prisma.gym.findMany({
            orderBy: {
                createdAt: "desc",
            },
        });
        return res.json({
            success: true,
            gyms,
        });
    }
    catch (error) {
        console.error("Get gyms error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load gyms.",
        });
    }
}
/* ================= GET SINGLE GYM ================= */
export async function getGym(req, res) {
    try {
        const gymId = Number(req.params.gymId);
        if (!Number.isInteger(gymId) || gymId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid gym ID.",
            });
        }
        const gym = await prisma.gym.findUnique({
            where: {
                id: gymId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!gym) {
            return res.status(404).json({
                success: false,
                message: "Gym not found.",
            });
        }
        return res.json({
            success: true,
            gym,
        });
    }
    catch (error) {
        console.error("Get gym error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load gym information.",
        });
    }
}
/* ================= UPDATE GYM ================= */
export async function updateGym(req, res) {
    try {
        const gymId = Number(req.params.gymId);
        if (!Number.isInteger(gymId) || gymId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid gym ID.",
            });
        }
        const { name, phone, address, ownerName, } = req.body;
        /* ---------- VALIDATE GYM NAME ---------- */
        if (typeof name !== "string" ||
            name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Gym name is required.",
            });
        }
        if (name.trim().length > 100) {
            return res.status(400).json({
                success: false,
                message: "Gym name must be 100 characters or less.",
            });
        }
        /* ---------- GET AUTH USER ---------- */
        const authUser = req.user;
        if (!authUser?.userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }
        /* ---------- UPDATE GYM ---------- */
        const gym = await prisma.gym.update({
            where: {
                id: gymId,
            },
            data: {
                name: name.trim(),
                phone: typeof phone === "string"
                    ? phone.trim() || null
                    : null,
                address: typeof address === "string"
                    ? address.trim() || null
                    : null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        /* ---------- UPDATE OWNER NAME ---------- */
        if (typeof ownerName === "string" &&
            ownerName.trim().length > 0) {
            await prisma.user.update({
                where: {
                    id: Number(authUser.userId),
                },
                data: {
                    name: ownerName.trim(),
                },
            });
        }
        return res.json({
            success: true,
            message: "Gym profile updated successfully.",
            gym,
        });
    }
    catch (error) {
        console.error("Update gym error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update gym profile.",
        });
    }
}
