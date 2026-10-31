import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

function createToken(user: {
  id: number;
  gymId: number;
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
  try {
    const {
      gymName,
      ownerName,
      email,
      password,
    } = req.body;

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