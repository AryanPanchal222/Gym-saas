import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

function gymIdFrom(req: Request) { return Number(req.params.gymId); }

export async function listExpenses(req: Request, res: Response) {
  const gymId = gymIdFrom(req);
  const expenses = await prisma.expense.findMany({ where: { gymId }, orderBy: { expenseDate: "desc" }, take: 200 });
  return res.json({ success: true, expenses });
}

export async function createExpense(req: Request, res: Response) {
  const gymId = gymIdFrom(req);
  const { title, category, amount, expenseDate, notes } = req.body;
  if (!title || !Number.isFinite(Number(amount))) return res.status(400).json({ success: false, message: "Title and amount are required" });
  const expense = await prisma.expense.create({ data: { gymId, title: String(title).trim(), category: category || "OTHER", amount: Number(amount), expenseDate: expenseDate ? new Date(expenseDate) : new Date(), notes: notes || null } });
  return res.status(201).json({ success: true, expense });
}

export async function listClasses(req: Request, res: Response) {
  const gymId = gymIdFrom(req);
  const classes = await prisma.gymClass.findMany({ where: { gymId }, include: { trainer: { select: { id: true, name: true, email: true } }, bookings: { include: { member: { select: { id: true, name: true, email: true } } } } }, orderBy: { startsAt: "asc" }, take: 200 });
  return res.json({ success: true, classes });
}

export async function createClass(req: Request, res: Response) {
  const gymId = gymIdFrom(req);
  const { name, description, startsAt, endsAt, capacity, trainerId } = req.body;
  if (!name || !startsAt || !endsAt) return res.status(400).json({ success: false, message: "Name, start time, and end time are required" });
  const gymClass = await prisma.gymClass.create({ data: { gymId, name: String(name).trim(), description: description || null, startsAt: new Date(startsAt), endsAt: new Date(endsAt), capacity: Math.max(1, Number(capacity) || 20), trainerId: trainerId ? Number(trainerId) : null } });
  return res.status(201).json({ success: true, class: gymClass });
}

export async function bookClass(req: Request, res: Response) {
  const classId = Number(req.params.classId);
  const memberId = Number(req.body.memberId);
  const gymId = gymIdFrom(req);
  const gymClass = await prisma.gymClass.findFirst({ where: { id: classId, gymId }, include: { bookings: true } });
  if (!gymClass) return res.status(404).json({ success: false, message: "Class not found" });
  if (gymClass.bookings.length >= gymClass.capacity) return res.status(400).json({ success: false, message: "This class is full" });
  const booking = await prisma.classBooking.create({ data: { classId, memberId } });
  return res.status(201).json({ success: true, booking });
}

export async function listTrainers(req: Request, res: Response) {
  const trainers = await prisma.user.findMany({ where: { gymId: gymIdFrom(req), role: "TRAINER", isActive: true }, select: { id: true, name: true, email: true } });
  return res.json({ success: true, trainers });
}

export async function listNotifications(req: Request, res: Response) {
  const gymId = gymIdFrom(req);
  const notifications = await prisma.notification.findMany({ where: { gymId }, orderBy: { createdAt: "desc" }, take: 50 });
  return res.json({ success: true, unread: notifications.filter((item) => !item.isRead).length, notifications });
}

export async function markNotificationRead(req: Request, res: Response) {
  const notification = await prisma.notification.updateMany({ where: { id: Number(req.params.notificationId), gymId: gymIdFrom(req) }, data: { isRead: true } });
  return res.json({ success: notification.count > 0 });
}

export async function operationsSummary(req: Request, res: Response) {
  const gymId = gymIdFrom(req);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [revenue, expenses, unpaidInvoices, renewals, inactiveMembers] = await Promise.all([
    prisma.payment.aggregate({ where: { gymId, status: "SUCCESS", createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { gymId, expenseDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.invoice.count({ where: { gymId, status: { in: ["ISSUED", "OVERDUE"] } } }),
    prisma.membership.count({ where: { gymId, status: "ACTIVE", endDate: { lte: new Date(Date.now() + 14 * 86400000) } } }),
    prisma.member.count({ where: { gymId, attendances: { none: { checkedInAt: { gte: new Date(Date.now() - 30 * 86400000) } } } } }),
  ]);
  return res.json({ success: true, summary: { revenue: revenue._sum.amount || 0, expenses: expenses._sum.amount || 0, unpaidInvoices, renewals, inactiveMembers } });
}
