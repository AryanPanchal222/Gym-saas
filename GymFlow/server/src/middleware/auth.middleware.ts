import type {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt from "jsonwebtoken";

type AuthPayload = {
  userId: number;
  gymId: number;
  role: string;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured",
    );
  }

  return secret;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const header =
      req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = header.slice(7);

    const payload = jwt.verify(
      token,
      getJwtSecret(),
    ) as AuthPayload;

    (
      req as Request & {
        user?: AuthPayload;
      }
    ).user = payload;

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired authentication token",
    });
  }
}

export function requireGymAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = (
    req as Request & {
      user?: AuthPayload;
    }
  ).user;

  const gymId = Number(
    req.params.gymId,
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (
    !Number.isInteger(gymId) ||
    gymId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid gym ID",
    });
  }

  if (user.gymId !== gymId) {
    return res.status(403).json({
      success: false,
      message:
        "You do not have access to this gym",
    });
  }

  next();
}