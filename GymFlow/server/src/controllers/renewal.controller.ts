import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

const RENEWAL_WINDOW_DAYS = 14;

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function daysUntil(date: Date) {
  const today = startOfDay(new Date());
  const target = startOfDay(date);

  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Get memberships that are due for renewal.
 *
 * Includes:
 * - memberships expiring within 14 days
 * - already expired memberships
 */
export async function getRenewals(req: Request, res: Response) {
  try {
    const gymId = Number(req.params.gymId);

    if (!Number.isInteger(gymId) || gymId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid gym ID",
      });
    }

    const today = startOfDay(new Date());

    const renewalLimit = new Date(today);
    renewalLimit.setDate(
      renewalLimit.getDate() + RENEWAL_WINDOW_DAYS,
    );

    const memberships = await prisma.membership.findMany({
      where: {
        gymId,
        status: "ACTIVE",
        endDate: {
          lte: renewalLimit,
        },
      },
      include: {
        member: true,
        plan: true,
        renewalOrders: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        endDate: "asc",
      },
    });

    const renewals = memberships.map((membership) => ({
      membershipId: membership.id,
      member: membership.member,
      plan: membership.plan,
      startDate: membership.startDate,
      endDate: membership.endDate,
      status: membership.status,
      daysUntilExpiry: daysUntil(membership.endDate),
      latestRenewalOrder: membership.renewalOrders[0] || null,
    }));

    return res.json({
      success: true,
      renewalWindowDays: RENEWAL_WINDOW_DAYS,
      renewals,
    });
  } catch (error) {
    console.error("Get renewals error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch renewals",
    });
  }
}

/**
 * Create a pending renewal order.
 *
 * This does NOT extend the membership.
 */
export async function createRenewalOrder(
  req: Request,
  res: Response,
) {
  try {
    const gymId = Number(req.params.gymId);
    const membershipId = Number(req.body.membershipId);

    if (!Number.isInteger(gymId) || gymId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid gym ID",
      });
    }

    if (!Number.isInteger(membershipId) || membershipId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid membership ID",
      });
    }

    const membership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        gymId,
      },
      include: {
        member: true,
        plan: true,
      },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Membership not found in this gym",
      });
    }

    if (
      membership.status !== "ACTIVE" &&
      membership.status !== "EXPIRED"
    ) {
      return res.status(400).json({
        success: false,
        message: "Only active or expired memberships can be renewed",
      });
    }

    const existingPendingOrder =
      await prisma.renewalOrder.findFirst({
        where: {
          gymId,
          membershipId,
          status: "PENDING",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (existingPendingOrder) {
      return res.json({
        success: true,
        message: "Pending renewal order already exists",
        renewalOrder: existingPendingOrder,
      });
    }

    const renewalOrder = await prisma.renewalOrder.create({
      data: {
        gymId,
        memberId: membership.memberId,
        membershipId: membership.id,
        amount: membership.plan.price,
        status: "PENDING",
      },
      include: {
        member: true,
        membership: {
          include: {
            plan: true,
          },
        },
        payments: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Renewal order created successfully",
      renewalOrder,
    });
  } catch (error) {
    console.error("Create renewal order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create renewal order",
    });
  }
}

/**
 * Get one renewal order.
 */
export async function getRenewalOrder(
  req: Request,
  res: Response,
) {
  try {
    const gymId = Number(req.params.gymId);
    const renewalId = Number(req.params.renewalId);

    if (!Number.isInteger(gymId) || gymId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid gym ID",
      });
    }

    if (!Number.isInteger(renewalId) || renewalId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid renewal ID",
      });
    }

    const renewalOrder = await prisma.renewalOrder.findFirst({
      where: {
        id: renewalId,
        gymId,
      },
      include: {
        member: true,
        membership: {
          include: {
            plan: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!renewalOrder) {
      return res.status(404).json({
        success: false,
        message: "Renewal order not found",
      });
    }

    return res.json({
      success: true,
      renewalOrder,
    });
  } catch (error) {
    console.error("Get renewal order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch renewal order",
    });
  }
}

/**
 * Manually mark a renewal as paid.
 *
 * This is ONLY for local/admin testing.
 * Later this endpoint will be replaced by verified payment-provider
 * callbacks/webhooks.
 */
export async function markRenewalPaid(
  req: Request,
  res: Response,
) {
  try {
    const gymId = Number(req.params.gymId);
    const renewalId = Number(req.params.renewalId);

    if (!Number.isInteger(gymId) || gymId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid gym ID",
      });
    }

    if (!Number.isInteger(renewalId) || renewalId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid renewal ID",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const renewalOrder = await tx.renewalOrder.findFirst({
        where: {
          id: renewalId,
          gymId,
        },
        include: {
          membership: {
            include: {
              plan: true,
            },
          },
        },
      });

      if (!renewalOrder) {
        throw new Error("RENEWAL_NOT_FOUND");
      }

      /*
       * Idempotency:
       * If this order has already been paid, do not extend
       * the membership again.
       */
      if (renewalOrder.status === "PAID") {
        const existingPayment = await tx.payment.findFirst({
          where: {
            renewalOrderId: renewalOrder.id,
            status: "SUCCESS",
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        return {
          renewalOrder,
          payment: existingPayment,
          alreadyProcessed: true,
        };
      }

      if (renewalOrder.status !== "PENDING") {
        throw new Error("RENEWAL_NOT_PENDING");
      }

      const now = new Date();

      /*
       * If the current membership is still valid,
       * continue from its existing end date.
       *
       * If already expired, start from today.
       */
      const currentEnd = renewalOrder.membership.endDate;

      const extensionStart =
        currentEnd > now ? currentEnd : now;

      const newEndDate = new Date(extensionStart);

      newEndDate.setDate(
        newEndDate.getDate() +
          renewalOrder.membership.plan.durationDays,
      );

      const payment = await tx.payment.create({
        data: {
          gymId,
          memberId: renewalOrder.memberId,
          renewalOrderId: renewalOrder.id,
          amount: renewalOrder.amount,
          status: "SUCCESS",
          provider: "MANUAL",
          paidAt: now,
        },
      });

      const updatedMembership =
        await tx.membership.update({
          where: {
            id: renewalOrder.membershipId,
          },
          data: {
            startDate:
              renewalOrder.membership.startDate,
            endDate: newEndDate,
            status: "ACTIVE",
          },
          include: {
            member: true,
            plan: true,
          },
        });

      const updatedRenewalOrder =
        await tx.renewalOrder.update({
          where: {
            id: renewalOrder.id,
          },
          data: {
            status: "PAID",
            paidAt: now,
          },
          include: {
            member: true,
            membership: {
              include: {
                plan: true,
              },
            },
            payments: true,
          },
        });

      return {
        renewalOrder: updatedRenewalOrder,
        payment,
        membership: updatedMembership,
        alreadyProcessed: false,
      };
    });

    return res.json({
      success: true,
      message: result.alreadyProcessed
        ? "Renewal was already processed"
        : "Renewal payment recorded and membership extended",
      ...result,
    });
  } catch (error) {
    console.error("Mark renewal paid error:", error);

    if (error instanceof Error) {
      if (error.message === "RENEWAL_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "Renewal order not found",
        });
      }

      if (error.message === "RENEWAL_NOT_PENDING") {
        return res.status(400).json({
          success: false,
          message: "Renewal order is not pending",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to process renewal payment",
    });
  }
}

/**
 * Cancel a pending renewal.
 */
export async function cancelRenewal(
  req: Request,
  res: Response,
) {
  try {
    const gymId = Number(req.params.gymId);
    const renewalId = Number(req.params.renewalId);

    if (!Number.isInteger(gymId) || gymId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid gym ID",
      });
    }

    if (!Number.isInteger(renewalId) || renewalId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid renewal ID",
      });
    }

    const renewalOrder = await prisma.renewalOrder.findFirst({
      where: {
        id: renewalId,
        gymId,
      },
    });

    if (!renewalOrder) {
      return res.status(404).json({
        success: false,
        message: "Renewal order not found",
      });
    }

    if (renewalOrder.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only pending renewal orders can be cancelled",
      });
    }

    const updated = await prisma.renewalOrder.update({
      where: {
        id: renewalId,
      },
      data: {
        status: "CANCELLED",
      },
    });

    return res.json({
      success: true,
      message: "Renewal order cancelled",
      renewalOrder: updated,
    });
  } catch (error) {
    console.error("Cancel renewal error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel renewal",
    });
  }
}