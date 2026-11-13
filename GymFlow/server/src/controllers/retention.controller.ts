import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

const DAY = 24 * 60 * 60 * 1000;
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export async function getRetentionAnalytics(req: Request, res: Response) {
  const gymId = Number(req.params.gymId);
  if (!Number.isInteger(gymId) || gymId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid gym ID" });
  }

  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const attendanceStart = new Date(today.getTime() - 6 * DAY);
    const renewalWindowStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const [attendances, memberships, activeMemberships] = await Promise.all([
      prisma.attendance.findMany({
        where: { gymId, checkedInAt: { gte: attendanceStart, lte: now } },
        select: { checkedInAt: true },
      }),
      prisma.membership.findMany({
        where: { gymId, createdAt: { gte: renewalWindowStart } },
        select: { memberId: true, startDate: true, endDate: true, createdAt: true },
        orderBy: { startDate: "asc" },
      }),
      prisma.membership.findMany({
        where: { gymId, status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } },
        select: {
          memberId: true,
          endDate: true,
          member: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              attendances: { orderBy: { checkedInAt: "desc" }, take: 1, select: { checkedInAt: true } },
            },
          },
        },
      }),
    ]);

    const attendanceByDay = new Map<string, number>();
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(attendanceStart.getTime() + index * DAY);
      attendanceByDay.set(localDateKey(day), 0);
    }
    for (const attendance of attendances) {
      const key = new Date(attendance.checkedInAt);
      key.setHours(0, 0, 0, 0);
      const dayKey = localDateKey(key);
      if (attendanceByDay.has(dayKey)) attendanceByDay.set(dayKey, (attendanceByDay.get(dayKey) ?? 0) + 1);
    }

    const monthlyRenewals = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return { month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`, count: 0 };
    });
    const earlierMemberships = await prisma.membership.findMany({
      where: { gymId, createdAt: { lt: renewalWindowStart } },
      select: { memberId: true, endDate: true },
      orderBy: { endDate: "desc" },
    });
    const previousEndByMember = new Map<number, Date>();
    for (const previous of earlierMemberships) {
      if (!previousEndByMember.has(previous.memberId)) previousEndByMember.set(previous.memberId, previous.endDate);
    }
    for (const membership of memberships) {
      const previousEnd = previousEndByMember.get(membership.memberId);
      if (previousEnd && membership.startDate.getTime() >= previousEnd.getTime() && membership.startDate.getTime() - previousEnd.getTime() <= 60 * DAY) {
        const key = `${membership.createdAt.getFullYear()}-${String(membership.createdAt.getMonth() + 1).padStart(2, "0")}`;
        const month = monthlyRenewals.find((item) => item.month === key);
        if (month) month.count += 1;
      }
      const knownEnd = previousEndByMember.get(membership.memberId);
      if (!knownEnd || membership.endDate > knownEnd) previousEndByMember.set(membership.memberId, membership.endDate);
    }

    const atRiskByMember = new Map<number, { id: number; name: string; phone: string | null; email: string | null; lastAttendance: Date | null; daysSinceVisit: number | null; daysToExpiry: number; reason: string }>();
    for (const membership of activeMemberships) {
      const lastAttendance = membership.member.attendances[0]?.checkedInAt ?? null;
      const daysSinceVisit = lastAttendance ? Math.floor((today.getTime() - new Date(lastAttendance).setHours(0, 0, 0, 0)) / DAY) : null;
      const daysToExpiry = Math.ceil((new Date(membership.endDate).getTime() - today.getTime()) / DAY);
      if ((daysSinceVisit !== null && daysSinceVisit >= 7) || daysToExpiry <= 14) {
        const reasons = [
          daysSinceVisit !== null && daysSinceVisit >= 7 ? `${daysSinceVisit} days without a visit` : "",
          daysToExpiry <= 14 ? `Plan expires in ${Math.max(0, daysToExpiry)} days` : "",
        ].filter(Boolean);
        const existing = atRiskByMember.get(membership.memberId);
        const candidate = { id: membership.member.id, name: membership.member.name, phone: membership.member.phone, email: membership.member.email, lastAttendance, daysSinceVisit, daysToExpiry, reason: reasons.join(" · ") };
        if (!existing || (candidate.daysSinceVisit ?? 9999) > (existing.daysSinceVisit ?? 9999) || candidate.daysToExpiry < existing.daysToExpiry) {
          atRiskByMember.set(membership.memberId, candidate);
        }
      }
    }

    const riskMembers = [...atRiskByMember.values()].sort((a, b) => (b.daysSinceVisit ?? 9999) - (a.daysSinceVisit ?? 9999)).slice(0, 50);
    return res.json({
      success: true,
      attendanceTrend: [...attendanceByDay].map(([date, count]) => ({ date, count })),
      renewalTrend: monthlyRenewals,
      renewalsDueSoon: riskMembers.filter((member) => member.daysToExpiry <= 14).length,
      riskMembers,
    });
  } catch (error) {
    console.error("Retention analytics error:", error);
    return res.status(500).json({ success: false, message: "Failed to load retention analytics" });
  }
}
