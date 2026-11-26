import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import { passwordResetEmail } from "../services/email.service.js";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

function createToken(user: {
  id: number;
  gymId: number | null;
  role: string;
}) {
  return jwt.sign(
    {
      userId: user.id,
      gymId: user.gymId,
      role: user.role,
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
    },
  );
}

export async function signup(req: Request, res: Response) {
  return res.status(403).json({ success: false, message: "Public registration is disabled. Contact GymFlow support." });
  /* istanbul ignore next */
  try {
    const { gymName, ownerName, email, password } = req.body;

    if (
      !gymName ||
      typeof gymName !== "string" ||
      !gymName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Gym name is required",
      });
    }

    if (
      !ownerName ||
      typeof ownerName !== "string" ||
      !ownerName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Owner name is required",
      });
    }

    if (
      !email ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (
      !password ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12,
    );

    const result = await prisma.$transaction(
      async (tx) => {
        const gym = await tx.gym.create({
          data: {
            name: gymName.trim(),
            email: normalizedEmail,
          },
        });

        const user = await tx.user.create({
          data: {
            gymId: gym.id,
            name: ownerName.trim(),
            email: normalizedEmail,
            passwordHash,
            role: "OWNER",
          },
        });

        return { gym, user };
      },
    );

    const token = createToken(result.user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        gymId: result.user.gymId,
      },
      gym: result.gym,
    });
  } catch (error) {
    console.error("Signup error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create account",
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (
      !email ||
      typeof email !== "string" ||
      !password ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      include: {
        gym: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Your account has been deactivated. Please contact GymFlow support." });
    }

    if (!user.passwordHash) {
      return res.status(403).json({ success: false, message: "Activate your account before signing in." });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = createToken(user);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        gymId: user.gymId,
      },
      gym: user.gym,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to login",
    });
  }
}

export async function activateAccount(req: Request, res: Response) {
  try {
    const { token, password } = req.body;
    if (typeof token !== "string" || !token || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ success: false, message: "A valid invitation token and password of at least 8 characters are required" });
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await prisma.user.findFirst({ where: { inviteTokenHash: tokenHash } });
    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "This invitation is invalid or expired" });
    }
    if (user.passwordHash) return res.status(409).json({ success: false, message: "This account has already been activated" });
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, inviteTokenHash: null, inviteExpiresAt: null } });
    return res.json({ success: true, message: "Account activated successfully" });
  } catch (error) {
    console.error("Account activation error:", error);
    return res.status(500).json({ success: false, message: "Failed to activate account" });
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    if (user && user.isActive) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${rawToken}`;
      await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"), resetExpiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
      const emailSent = await passwordResetEmail(user.email, user.name, resetUrl);
      if (!emailSent && process.env.NODE_ENV === "development") return res.json({ success: true, message: "If that email exists, a reset link has been created", resetUrl });
    }
    return res.json({ success: true, message: "If that email exists, a password reset link has been sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.json({ success: true, message: "If that email exists, a password reset link has been sent" });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, password } = req.body || {};
    if (typeof token !== "string" || !token || typeof password !== "string" || password.length < 8) return res.status(400).json({ success: false, message: "A valid token and password of at least 8 characters are required" });
    const user = await prisma.user.findFirst({ where: { resetTokenHash: crypto.createHash("sha256").update(token).digest("hex") } });
    if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) return res.status(400).json({ success: false, message: "This reset link is invalid or expired" });
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12), resetTokenHash: null, resetExpiresAt: null } });
    return res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ success: false, message: "Failed to reset password" });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: Number(userId),
      },
      include: {
        gym: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        gymId: user.gymId,
      },
      gym: user.gym,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch current user",
    });
  }
}
