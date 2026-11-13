import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";

export async function createPlan(req: Request, res: Response) {
  try {
    const gymId = Number(req.params.gymId);
    const { name, durationDays, price } = req.body;

    if (!Number.isInteger(gymId) || gymId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid gym ID",
      });
    }

    if (!name || typeof name !== "string") {
      return res.status(400).json({
        success: false,
        message: "Plan name is required",
      });
    }

    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      return res.status(400).json({
        success: false,
        message: "Duration must be a positive number of days",
      });
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number",
      });
    }

    const gym = await prisma.gym.findUnique({
      where: {
        id: gymId,
      },
    });

    if (!gym) {
      return res.status(404).json({
        success: false,
        message: "Gym not found",
      });
    }

    const plan = await prisma.plan.create({
      data: {
        gymId,
        name: name.trim(),
        durationDays,
        price: numericPrice,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan,
    });
  } catch (error) {
    console.error("Create plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create plan",
    });
  }
}

export async function getPlans(req: Request, res: Response) {
  try {
    const gymId = Number(req.params.gymId);

    if (!Number.isInteger(gymId) || gymId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid gym ID",
      });
    }

    const plans = await prisma.plan.findMany({
      where: {
        gymId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Get plans error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
    });
  }
}

export async function deletePlan(req: Request, res: Response) {
  const gymId = Number(req.params.gymId);
  const planId = Number(req.params.planId);

  if (!Number.isInteger(gymId) || gymId <= 0 || !Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid gym or plan ID" });
  }

  try {
    const plan = await prisma.plan.findFirst({ where: { id: planId, gymId } });
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found in this gym" });

    const membershipCount = await prisma.membership.count({ where: { gymId, planId } });
    if (membershipCount > 0) {
      const archivedPlan = await prisma.plan.update({
        where: { id: planId },
        data: { isActive: false },
      });
      return res.json({
        success: true,
        action: "archived",
        message: `“${plan.name}” is used by existing memberships, so it was archived and cannot be assigned to new members.`,
        plan: archivedPlan,
      });
    }

    await prisma.plan.delete({ where: { id: planId } });
    return res.json({ success: true, action: "deleted", message: `“${plan.name}” was deleted.` });
  } catch (error) {
    console.error("Delete plan error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete plan" });
  }
}
