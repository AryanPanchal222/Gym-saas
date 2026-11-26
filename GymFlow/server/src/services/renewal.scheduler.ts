import prisma from "../lib/prisma.js";
import { renewalReminderEmail } from "./email.service.js";

const REMINDER_DAYS = [14, 7, 1, 0];

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export async function sendScheduledRenewalReminders() {
  const today = startOfDay(new Date());
  const limit = new Date(today);
  limit.setDate(limit.getDate() + Math.max(...REMINDER_DAYS));

  const memberships = await prisma.membership.findMany({
    where: { status: "ACTIVE", endDate: { gte: today, lte: limit } },
    include: { gym: true, member: true, plan: true, renewalOrders: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1, include: { invoice: true } } },
  });

  for (const membership of memberships) {
    if (!membership.member.email) continue;
    const days = Math.ceil((startOfDay(membership.endDate).getTime() - today.getTime()) / 86400000);
    if (!REMINDER_DAYS.includes(days)) continue;
    let order = membership.renewalOrders[0];
    if (!order) {
      const created = await prisma.renewalOrder.create({ data: { gymId: membership.gymId, memberId: membership.memberId, membershipId: membership.id, amount: membership.plan.price, status: "PENDING" } });
      const invoice = await prisma.invoice.create({ data: { gymId: membership.gymId, memberId: membership.memberId, renewalOrderId: created.id, invoiceNumber: `INV-${membership.gymId}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, amount: membership.plan.price, dueDate: membership.endDate } });
      order = { ...created, invoice };
    }
    if (!order.invoice) continue;
    const reminderType = `renewal-${days}`;
    const existing = await prisma.renewalReminder.findUnique({ where: { membershipId_reminderType: { membershipId: membership.id, reminderType } } });
    if (existing) continue;
    const sent = await renewalReminderEmail(membership.member.email, membership.member.name, membership.gym.name, membership.plan.name, membership.endDate.toLocaleDateString("en-IN"), order.invoice.invoiceNumber, `₹${Number(order.amount).toLocaleString("en-IN")}`).catch(() => false);
    if (sent) await prisma.renewalReminder.create({ data: { gymId: membership.gymId, memberId: membership.memberId, membershipId: membership.id, reminderType } });
  }
}

export function startRenewalReminderScheduler() {
  void sendScheduledRenewalReminders().catch((error) => console.error("Renewal reminder scheduler error:", error));
  setInterval(() => void sendScheduledRenewalReminders().catch((error) => console.error("Renewal reminder scheduler error:", error)), 6 * 60 * 60 * 1000);
}
