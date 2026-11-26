import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

function createMemberToken(member: { id: number; gymId: number }) {
  return jwt.sign(
    { memberId: member.id, gymId: member.gymId, role: "MEMBER", portal: true },
    getJwtSecret(),
    { expiresIn: "7d" },
  );
}

export async function createPortalInvite(req: Request, res: Response) {
  const gymId = Number(req.params.gymId);
  const memberId = Number(req.params.memberId);

  if (!Number.isInteger(gymId) || gymId <= 0 || !Number.isInteger(memberId) || memberId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid gym or member ID" });
  }

  try {
    const member = await prisma.member.findFirst({ where: { id: memberId, gymId } });
    if (!member) return res.status(404).json({ success: false, message: "Member not found in this gym" });
    if (!member.email?.trim()) {
      return res.status(400).json({ success: false, message: "Add an email address to this member before creating a portal invite" });
    }

    const inviteCode = crypto.randomBytes(8).toString("hex").toUpperCase();
    const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const portalInviteHash = await bcrypt.hash(inviteCode, 12);

    await prisma.member.update({
      where: { id: memberId },
      data: {
        portalPasswordHash: null,
        portalInviteHash,
        portalInviteExpiresAt: inviteExpiresAt,
      },
    });

    return res.json({
      success: true,
      message: "Member portal invite created. Share the code with the member; it is shown only once.",
      inviteCode,
      inviteExpiresAt,
      gymId,
      memberId,
    });
  } catch (error) {
    console.error("Create member portal invite error:", error);
    return res.status(500).json({ success: false, message: "Failed to create member portal invite" });
  }
}

export async function activateMemberPortal(req: Request, res: Response) {
  const gymId = Number(req.body?.gymId);
  const memberId = Number(req.body?.memberId);
  const inviteCode = req.body?.inviteCode;
  const password = req.body?.password;

  if (!Number.isInteger(gymId) || gymId <= 0 || !Number.isInteger(memberId) || memberId <= 0) {
    return res.status(400).json({ success: false, message: "A valid gym code and member number are required" });
  }
  if (typeof inviteCode !== "string" || !inviteCode.trim()) {
    return res.status(400).json({ success: false, message: "Invite code is required" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ success: false, message: "Choose a password with at least 8 characters" });
  }

  try {
    const member = await prisma.member.findFirst({ where: { id: memberId, gymId } });
    if (!member || !member.email || !member.portalInviteHash || !member.portalInviteExpiresAt) {
      return res.status(400).json({ success: false, message: "This invite is invalid or has already been used" });
    }
    if (member.portalInviteExpiresAt <= new Date()) {
      return res.status(410).json({ success: false, message: "This invite has expired. Ask your gym to create a new one" });
    }

    const validCode = await bcrypt.compare(inviteCode.trim().toUpperCase(), member.portalInviteHash);
    if (!validCode) return res.status(401).json({ success: false, message: "Invite code is incorrect" });

    const portalPasswordHash = await bcrypt.hash(password, 12);
    await prisma.member.update({
      where: { id: member.id },
      data: { portalPasswordHash, portalInviteHash: null, portalInviteExpiresAt: null },
    });

    return res.status(201).json({
      success: true,
      message: "Member portal activated",
      token: createMemberToken(member),
      member: { id: member.id, name: member.name, email: member.email, gymId: member.gymId },
    });
  } catch (error) {
    console.error("Activate member portal error:", error);
    return res.status(500).json({ success: false, message: "Failed to activate member portal" });
  }
}

export async function loginMemberPortal(req: Request, res: Response) {
  const gymId = Number(req.body?.gymId);
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = req.body?.password;

  if (!Number.isInteger(gymId) || gymId <= 0 || !email || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Gym code, email, and password are required" });
  }

  try {
    const candidates = await prisma.member.findMany({
      where: {
        gymId,
        email: { equals: email, mode: "insensitive" },
        portalPasswordHash: { not: null },
      },
      include: { gym: true },
    });

    const matches = [];
    for (const member of candidates) {
      if (member.portalPasswordHash && await bcrypt.compare(password, member.portalPasswordHash)) {
        matches.push(member);
      }
    }
    if (matches.length !== 1) {
      return res.status(401).json({ success: false, message: "Invalid portal details. Check your gym code, email, and password" });
    }

    const member = matches[0];
    return res.json({
      success: true,
      token: createMemberToken(member),
      member: { id: member.id, name: member.name, email: member.email, gymId: member.gymId },
      gym: { id: member.gym.id, name: member.gym.name },
    });
  } catch (error) {
    console.error("Member portal login error:", error);
    return res.status(500).json({ success: false, message: "Failed to sign in" });
  }
}

export async function getMemberPortalHome(req: Request, res: Response) {
  const memberUser = (req as Request & { memberUser?: { memberId: number; gymId: number } }).memberUser;
  if (!memberUser) return res.status(401).json({ success: false, message: "Member sign-in required" });

  try {
    const member = await prisma.member.findFirst({
      where: { id: memberUser.memberId, gymId: memberUser.gymId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        gym: { select: { id: true, name: true } },
        memberships: {
          orderBy: { endDate: "desc" },
          take: 5,
          include: { plan: { select: { name: true, durationDays: true, price: true } } },
        },
        attendances: {
          orderBy: { checkedInAt: "desc" },
          take: 20,
          include: { membership: { include: { plan: { select: { name: true } } } } },
        },
      },
    });

    if (!member) return res.status(404).json({ success: false, message: "Member account no longer exists" });
    return res.json({ success: true, member });
  } catch (error) {
    console.error("Get member portal home error:", error);
    return res.status(500).json({ success: false, message: "Failed to load member portal" });
  }
}
