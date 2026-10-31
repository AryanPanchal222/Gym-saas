import jwt from "jsonwebtoken";
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return secret;
}
export function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }
        const token = header.slice(7);
        const payload = jwt.verify(token, getJwtSecret());
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token",
        });
    }
}
export function requireGymAccess(req, res, next) {
    const user = req.user;
    const gymId = Number(req.params.gymId);
    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }
    if (!Number.isInteger(gymId) ||
        gymId <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid gym ID",
        });
    }
    if (user.gymId !== gymId) {
        return res.status(403).json({
            success: false,
            message: "You do not have access to this gym",
        });
    }
    next();
}
