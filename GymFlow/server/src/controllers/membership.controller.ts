import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { invoiceIssuedEmail } from "../services/email.service.js";

function invoiceNumber(gymId: number) {
  return `INV-${gymId}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}


export async function createMembership(req: Request, res: Response) {
  try {
    const gymId = Number(req.params.gymId);
    const memberId = Number(req.params.memberId);

    const { planId, startDate } = req.body;

    if (!Number.isInteger(gymId) || gymId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid gym ID",
      });
    }

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID",
      });
    }

    const numericPlanId = Number(planId);

    if (!Number.isInteger(numericPlanId) || numericPlanId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: "Start date is required",
      });
    }

    const parsedStartDate = new Date(startDate);

    if (Number.isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start date",
      });
    }

    const [gym, member, plan] = await Promise.all([
      prisma.gym.findUnique({
        where: { id: gymId },
      }),

      prisma.member.findFirst({
        where: {
          id: memberId,
          gymId,
        },
      }),

      prisma.plan.findFirst({
        where: {
          id: numericPlanId,
          gymId,
          isActive: true,
        },
      }),
    ]);

    if (!gym) {
      return res.status(404).json({
        success: false,
        message: "Gym not found",
      });
    }

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found in this gym",
      });
    }

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Active plan not found in this gym",
      });
    }

    const endDate = new Date(parsedStartDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const result = await prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: { gymId, memberId, planId: numericPlanId, startDate: parsedStartDate, endDate, status: "ACTIVE" },
        include: { member: true, plan: true },
      });

      const renewalOrder = await tx.renewalOrder.create({
        data: { gymId, memberId, membershipId: membership.id, amount: plan.price, status: "PENDING", kind: "INITIAL" },
      });

      const invoice = await tx.invoice.create({
        data: { gymId, memberId, renewalOrderId: renewalOrder.id, invoiceNumber: invoiceNumber(gymId), amount: plan.price, dueDate: parsedStartDate },
      });

      return { membership, renewalOrder, invoice };
    });

    const emailSent = result.membership.member.email
      ? await invoiceIssuedEmail(result.membership.member.email, result.membership.member.name, gym.name, gym.email, result.invoice.invoiceNumber, `₹${Number(result.invoice.amount).toLocaleString("en-IN")}`, parsedStartDate.toLocaleDateString("en-IN"), "INITIAL")
      : false;

    return res.status(201).json({
      success: true,
      message: "Membership and initial invoice created successfully",
      ...result,
      emailSent,
    });
  } catch (error) {
    console.error("Create membership error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create membership",
    });
  }
}

export async function getMemberships(req: Request, res: Response) {
  try {
    const gymId = Number(req.params.gymId);
    const memberId = Number(req.params.memberId);

    if (!Number.isInteger(gymId) || gymId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid gym ID",
      });
    }

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID",
      });
    }

    const memberships = await prisma.membership.findMany({
      where: {
        gymId,
        memberId,
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      memberships,
    });
  } catch (error) {
    console.error("Get memberships error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch memberships",
    });
  }
}

