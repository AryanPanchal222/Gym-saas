import type { Request, Response } from "express";
import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import { invitationEmail } from "../services/email.service.js";

function inviteUrl(token: string) {
  const base = process.env.FRONTEND_URL || "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/activate-account?token=${encodeURIComponent(token)}`;
}

function publicCustomer(user: any) {
  return {
    id: user.id, name: user.name, email: user.email, phone: user.phone,
    role: user.role, isActive: user.isActive, createdAt: user.createdAt,
    gym: user.gym,
  };
}

export async function listCustomers(_req: Request, res: Response) {
  const customers = await prisma.user.findMany({ where: { role: "OWNER" }, include: { gym: true }, orderBy: { createdAt: "desc" } });
  return res.json({ success: true, customers: customers.map(publicCustomer) });
}

export async function getOverview(_req: Request, res: Response) {
  const [totalCustomers, activeCustomers, gyms, plans] = await Promise.all([
    prisma.user.count({ where: { role: "OWNER" } }),
    prisma.user.count({ where: { role: "OWNER", isActive: true } }),
    prisma.gym.count(),
    prisma.plan.count({ where: { isActive: true } }),
  ]);
  const months = Array.from({ length: 6 }, (_, index) => {
    const start = new Date();
    start.setMonth(start.getMonth() - (5 - index), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { label: start.toLocaleString("en", { month: "short" }), start, end };
  });
  const trends = await Promise.all(months.map(async (month) => {
    const [newCustomers, revenue] = await Promise.all([
      prisma.user.count({ where: { role: "OWNER", createdAt: { gte: month.start, lt: month.end } } }),
      prisma.payment.aggregate({ where: { status: "SUCCESS", createdAt: { gte: month.start, lt: month.end } }, _sum: { amount: true } }),
    ]);
    return { label: month.label, customers: newCustomers, revenue: Number(revenue._sum.amount || 0) };
  }));
  return res.json({ success: true, metrics: { totalCustomers, activeCustomers, inactiveCustomers: totalCustomers - activeCustomers, gyms, activePlans: plans, trends } });
}

export async function listAdminPlans(_req: Request, res: Response) {
  const plans = await prisma.plan.findMany({ include: { gym: true }, orderBy: { createdAt: "desc" } });
  return res.json({ success: true, plans });
}

export async function createAdminPlan(req: Request, res: Response) {
  const gymId = Number(req.body?.gymId);
  const { name, durationDays, price } = req.body || {};
  if (!Number.isInteger(gymId) || gymId <= 0 || typeof name !== "string" || !name.trim() || Number(durationDays) <= 0 || Number(price) < 0) {
    return res.status(400).json({ success: false, message: "Gym, plan name, duration, and price are required" });
  }
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) return res.status(404).json({ success: false, message: "Gym not found" });
  const plan = await prisma.plan.create({ data: { gymId, name: name.trim(), durationDays: Number(durationDays), price: Number(price) } });
  return res.status(201).json({ success: true, plan });
}

export async function updateCustomer(req: Request, res: Response) {
  const id = Number(req.params.userId);
  const customer = await prisma.user.findFirst({ where: { id, role: "OWNER" } });
  if (!customer || !customer.gymId) return res.status(404).json({ success: false, message: "Customer not found" });
  const { ownerName, gymName, phone, address, logoUrl, primaryColor, accentColor } = req.body || {};
  const [owner, gym] = await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { ...(typeof ownerName === "string" && ownerName.trim() ? { name: ownerName.trim() } : {}), ...(typeof phone === "string" ? { phone: phone.trim() || null } : {}) }, include: { gym: true } }),
    prisma.gym.update({ where: { id: customer.gymId }, data: { ...(typeof gymName === "string" && gymName.trim() ? { name: gymName.trim() } : {}), ...(typeof phone === "string" ? { phone: phone.trim() || null } : {}), ...(typeof address === "string" ? { address: address.trim() || null } : {}), ...(typeof logoUrl === "string" ? { logoUrl: logoUrl.trim() || null } : {}), ...(typeof primaryColor === "string" ? { primaryColor: primaryColor.trim() || null } : {}), ...(typeof accentColor === "string" ? { accentColor: accentColor.trim() || null } : {}) } }),
  ]);
  return res.json({ success: true, customer: publicCustomer({ ...owner, gym }) });
}

export async function createCustomer(req: Request, res: Response) {
  try {
    const { gymName, ownerName, email, phone, address } = req.body;
    if (typeof gymName !== "string" || !gymName.trim() || typeof ownerName !== "string" || !ownerName.trim() || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, message: "Gym name, owner name, and email are required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ success: false, message: "A valid email is required" });
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ success: false, message: "An account with this email already exists" });
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const result = await prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({ data: { name: gymName.trim(), email: normalizedEmail, phone: typeof phone === "string" ? phone.trim() || null : null, address: typeof address === "string" ? address.trim() || null : null } });
      const owner = await tx.user.create({ data: { gymId: gym.id, name: ownerName.trim(), email: normalizedEmail, phone: typeof phone === "string" ? phone.trim() || null : null, passwordHash: "", role: "OWNER", inviteTokenHash: tokenHash, inviteExpiresAt: expiresAt } });
      return { gym, owner };
    });
    const invitationUrl = inviteUrl(rawToken);
    const emailSent = await invitationEmail(result.owner.email, result.owner.name, invitationUrl);
    return res.status(201).json({ success: true, message: "Customer created successfully", customer: publicCustomer(result.owner), invitationUrl, invitationExpiresAt: expiresAt, emailSent });
  } catch (error) {
    console.error("Create customer error:", error);
    return res.status(500).json({ success: false, message: "Failed to create customer" });
  }
}

export async function setCustomerStatus(req: Request, res: Response) {
  const id = Number(req.params.userId);
  if (!Number.isInteger(id) || id <= 0 || typeof req.body?.isActive !== "boolean") return res.status(400).json({ success: false, message: "Invalid customer status" });
  const customer = await prisma.user.findFirst({ where: { id, role: "OWNER" } });
  if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
  const updated = await prisma.user.update({ where: { id }, data: { isActive: req.body.isActive }, include: { gym: true } });
  return res.json({ success: true, customer: publicCustomer(updated) });
}

export async function resendInvitation(req: Request, res: Response) {
  const id = Number(req.params.userId);
  const customer = await prisma.user.findFirst({ where: { id, role: "OWNER", passwordHash: "" }, include: { gym: true } });
  if (!customer) return res.status(404).json({ success: false, message: "Pending customer not found" });
  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await prisma.user.update({ where: { id }, data: { inviteTokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"), inviteExpiresAt: expiresAt } });
  const invitationUrl = inviteUrl(rawToken);
  const emailSent = await invitationEmail(customer.email, customer.name, invitationUrl);
  return res.json({ success: true, invitationUrl, invitationExpiresAt: expiresAt, emailSent });
}

export async function uploadCustomerLogo(req: Request, res: Response) {
  const id = Number(req.params.userId);
  const customer = await prisma.user.findFirst({ where: { id, role: "OWNER" } });
  if (!customer?.gymId || !req.file) return res.status(400).json({ success: false, message: "A valid customer and image file are required" });
  const logoUrl = `/uploads/logos/${req.file.filename}`;
  const gym = await prisma.gym.update({ where: { id: customer.gymId }, data: { logoUrl } });
  return res.json({ success: true, logoUrl, gym });
}
