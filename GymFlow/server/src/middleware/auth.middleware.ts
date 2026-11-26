import type {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt from "jsonwebtoken";

type AuthPayload = {
  userId?: number;
  gymId: number;
  role: string;
  portal?: boolean;
};

type MemberPortalPayload = {
  memberId: number;
  gymId: number;
  role: "MEMBER";
  portal: true;
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

    if (payload.portal || !Number.isInteger(payload.userId)) {
      return res.status(401).json({
        success: false,
        message: "Staff authentication required",
      });
    }

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

export function requireMemberAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Member sign-in required" });
    }

    const payload = jwt.verify(header.slice(7), getJwtSecret()) as MemberPortalPayload;
    if (
      payload.portal !== true ||
      payload.role !== "MEMBER" ||
      !Number.isInteger(payload.memberId) ||
      !Number.isInteger(payload.gymId)
    ) {
      return res.status(401).json({ success: false, message: "Invalid member portal session" });
    }

    (req as Request & { memberUser?: MemberPortalPayload }).memberUser = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Member session expired. Please sign in again." });
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
