import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { invoiceIssuedEmail, paymentReceiptEmail, renewalReminderEmail } from "../services/email.service.js";
import { getRazorpayClient, verifyPaymentSignature, verifyWebhookSignature } from "../services/razorpay.service.js";

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

function invoiceNumber(gymId: number) {
  return `INV-${gymId}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

async function completeRazorpayRenewal(gymId: number, renewalId: number, providerPaymentId: string, metadata: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    const renewalOrder = await tx.renewalOrder.findFirst({
      where: { id: renewalId, gymId },
      include: { membership: { include: { plan: true } } },
    });
    if (!renewalOrder) throw new Error("RENEWAL_NOT_FOUND");

    if (renewalOrder.status === "PAID") {
      const payment = await tx.payment.findFirst({ where: { renewalOrderId: renewalId, status: "SUCCESS" }, orderBy: { createdAt: "desc" } });
      return { renewalOrder, payment, membership: renewalOrder.membership, alreadyProcessed: true };
    }
    if (renewalOrder.status !== "PENDING") throw new Error("RENEWAL_NOT_PENDING");

    const now = new Date();
    const payment = await tx.payment.create({
      data: {
        gymId,
        memberId: renewalOrder.memberId,
        renewalOrderId: renewalId,
        amount: renewalOrder.amount,
        status: "SUCCESS",
        provider: "RAZORPAY",
        providerPaymentId,
        paidAt: now,
        metadata: JSON.parse(JSON.stringify(metadata)),
      },
    });

    const currentEnd = renewalOrder.membership.endDate;
    const extensionStart = currentEnd > now ? currentEnd : now;
    const newEndDate = new Date(extensionStart);
    newEndDate.setDate(newEndDate.getDate() + renewalOrder.membership.plan.durationDays);
    const membership = renewalOrder.kind === "INITIAL"
      ? renewalOrder.membership
      : await tx.membership.update({ where: { id: renewalOrder.membershipId }, data: { endDate: newEndDate, status: "ACTIVE" }, include: { member: true, plan: true } });

    const updatedRenewalOrder = await tx.renewalOrder.update({
      where: { id: renewalId },
      data: { status: "PAID", paidAt: now, provider: "RAZORPAY" },
      include: { member: true, membership: { include: { plan: true } }, payments: true, invoice: true },
    });
    await tx.invoice.updateMany({ where: { renewalOrderId: renewalId }, data: { status: "PAID", paidAt: now } });
    return { renewalOrder: updatedRenewalOrder, payment, membership, alreadyProcessed: false };
  });
}

export async function createRazorpayOrder(req: Request, res: Response) {
  try {
    const gymId = Number(req.params.gymId);
    const renewalId = Number(req.params.renewalId);
    const renewalOrder = await prisma.renewalOrder.findFirst({ where: { id: renewalId, gymId }, include: { member: true, invoice: true } });
    if (!renewalOrder) return res.status(404).json({ success: false, message: "Renewal order not found" });
    if (renewalOrder.status !== "PENDING") return res.status(400).json({ success: false, message: "Renewal order is not pending" });

    const razorpayOrder = await getRazorpayClient().orders.create({
      amount: Math.round(Number(renewalOrder.amount) * 100),
      currency: "INR",
      receipt: `renewal_${renewalId}`,
      notes: { gymId: String(gymId), renewalId: String(renewalId), invoiceNumber: renewalOrder.invoice?.invoiceNumber || "" },
    });
    await prisma.renewalOrder.update({ where: { id: renewalId }, data: { provider: "RAZORPAY", providerOrderId: razorpayOrder.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
    return res.json({ success: true, keyId: process.env.RAZORPAY_KEY_ID, razorpayOrder, member: renewalOrder.member });
  } catch (error) {
    if (error instanceof Error && error.message === "RAZORPAY_NOT_CONFIGURED") return res.status(503).json({ success: false, message: "Razorpay is not configured on the server" });
    console.error("Create Razorpay order error:", error);
    return res.status(500).json({ success: false, message: "Failed to create Razorpay order" });
  }
}

export async function verifyRazorpayPayment(req: Request, res: Response) {
  try {
    const gymId = Number(req.params.gymId);
    const renewalId = Number(req.params.renewalId);
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body as Record<string, string>;
    const renewalOrder = await prisma.renewalOrder.findFirst({ where: { id: renewalId, gymId } });
    if (!renewalOrder || renewalOrder.providerOrderId !== orderId) return res.status(400).json({ success: false, message: "Invalid Razorpay order" });
    if (!orderId || !paymentId || !signature || !verifyPaymentSignature(orderId, paymentId, signature)) return res.status(400).json({ success: false, message: "Payment signature verification failed" });

    const payment = await getRazorpayClient().payments.fetch(paymentId);
    if (payment.order_id !== orderId || payment.status !== "captured" || Number(payment.amount) !== Math.round(Number(renewalOrder.amount) * 100)) return res.status(400).json({ success: false, message: "Razorpay payment was not captured for this renewal" });
    const result = await completeRazorpayRenewal(gymId, renewalId, paymentId, { orderId, signature });
    return res.json({ success: true, message: result.alreadyProcessed ? "Payment was already processed" : "Payment verified and membership extended", ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "RAZORPAY_NOT_CONFIGURED") return res.status(503).json({ success: false, message: "Razorpay is not configured on the server" });
    console.error("Verify Razorpay payment error:", error);
    return res.status(500).json({ success: false, message: "Failed to verify Razorpay payment" });
  }
}

export async function razorpayWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (typeof signature !== "string" || !verifyWebhookSignature(req.body as Buffer, signature)) return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    const event = JSON.parse((req.body as Buffer).toString("utf8")) as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
    if (event.event === "payment.captured") {
      const paymentEntity = event.payload?.payment?.entity;
      if (paymentEntity?.id && paymentEntity.order_id) {
        const renewalOrder = await prisma.renewalOrder.findFirst({ where: { providerOrderId: paymentEntity.order_id } });
        if (renewalOrder) await completeRazorpayRenewal(renewalOrder.gymId, renewalOrder.id, paymentEntity.id, { source: "webhook" });
      }
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return res.status(400).json({ success: false, message: "Invalid Razorpay webhook" });
  }
}

export async function getInvoices(req: Request, res: Response) {
  try {
    const gymId = Number(req.params.gymId);
    if (!Number.isInteger(gymId) || gymId <= 0) return res.status(400).json({ success: false, message: "Invalid gym ID" });
    const invoices = await prisma.invoice.findMany({
      where: { gymId },
      include: { member: true, renewalOrder: { include: { membership: { include: { plan: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.json({ success: true, invoices });
  } catch (error) {
    console.error("Get invoices error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch invoices" });
  }
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
        OR: [
          { status: "EXPIRED" },
          { status: "ACTIVE", endDate: { lte: renewalLimit } },
        ],
      },
      include: {
        member: true,
        plan: true,
        renewalOrders: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          include: { invoice: true },
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
        gym: true,
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

    const invoice = await prisma.invoice.create({
      data: {
        gymId,
        memberId: membership.memberId,
        renewalOrderId: renewalOrder.id,
        invoiceNumber: invoiceNumber(gymId),
        amount: membership.plan.price,
        dueDate: membership.endDate,
      },
    });

    const invoiceEmailSent = membership.member.email
      ? await invoiceIssuedEmail(membership.member.email, membership.member.name, membership.gym?.name || "GymFlow gym", membership.gym?.email || null, invoice.invoiceNumber, `₹${Number(invoice.amount).toLocaleString("en-IN")}`, membership.endDate.toLocaleDateString("en-IN"), "RENEWAL")
      : false;

    return res.status(201).json({
      success: true,
      message: "Renewal order created successfully",
      renewalOrder: { ...renewalOrder, invoice },
      emailSent: invoiceEmailSent,
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
        invoice: true,
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

      let updatedMembership = renewalOrder.membership;
      if (renewalOrder.kind !== "INITIAL") {
        const currentEnd = renewalOrder.membership.endDate;
        const extensionStart = currentEnd > now ? currentEnd : now;
        const newEndDate = new Date(extensionStart);
        newEndDate.setDate(newEndDate.getDate() + renewalOrder.membership.plan.durationDays);
        updatedMembership = await tx.membership.update({
          where: { id: renewalOrder.membershipId },
          data: { startDate: renewalOrder.membership.startDate, endDate: newEndDate, status: "ACTIVE" },
          include: { member: true, plan: true },
        });
      }

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
            invoice: true,
          },
        });

      await tx.invoice.updateMany({
        where: { renewalOrderId: renewalOrder.id },
        data: { status: "PAID", paidAt: now },
      });

      return {
        renewalOrder: updatedRenewalOrder,
        payment,
        membership: updatedMembership,
        alreadyProcessed: false,
      };
    });

    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true, email: true } });
    const receiptDetails = await prisma.renewalOrder.findUnique({ where: { id: result.renewalOrder.id }, include: { member: true, invoice: true } });
    const receiptEmailSent = receiptDetails?.member.email && receiptDetails.invoice
      ? await paymentReceiptEmail(receiptDetails.member.email, receiptDetails.member.name, gym?.name || "GymFlow gym", gym?.email || null, receiptDetails.invoice.invoiceNumber, `₹${Number(result.payment?.amount || result.renewalOrder.amount).toLocaleString("en-IN")}`, new Date().toLocaleDateString("en-IN"))
      : false;

    return res.json({
      success: true,
      message: result.alreadyProcessed
        ? "Renewal was already processed"
        : "Renewal payment recorded and membership extended",
      ...result,
      emailSent: receiptEmailSent,
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

export async function sendRenewalReminder(req: Request, res: Response) {
  try {
    const gymId = Number(req.params.gymId);
    const membershipId = Number(req.params.membershipId);
    if (!Number.isInteger(gymId) || !Number.isInteger(membershipId)) return res.status(400).json({ success: false, message: "Invalid renewal details" });
    const membership = await prisma.membership.findFirst({ where: { id: membershipId, gymId, status: "ACTIVE" }, include: { gym: true, member: true, plan: true, renewalOrders: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1, include: { invoice: true } } } });
    if (!membership) return res.status(404).json({ success: false, message: "Active membership not found" });
    if (!membership.member.email) return res.status(400).json({ success: false, message: "This member has no email address" });
    const order = membership.renewalOrders[0];
    if (!order?.invoice) return res.status(400).json({ success: false, message: "Create a renewal invoice first" });
    const sent = await renewalReminderEmail(membership.member.email, membership.member.name, membership.gym.name, membership.plan.name, membership.endDate.toLocaleDateString("en-IN"), order.invoice.invoiceNumber, `₹${Number(order.amount).toLocaleString("en-IN")}`);
    return res.json({ success: sent, message: sent ? "Renewal reminder sent" : "SMTP is not configured" });
  } catch (error) {
    console.error("Send renewal reminder error:", error);
    return res.status(500).json({ success: false, message: "Failed to send renewal reminder" });
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
