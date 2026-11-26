import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

const rl = createInterface({ input, output });
try {
  const name = (await rl.question("Name: ")).trim();
  const email = (await rl.question("Email: ")).trim().toLowerCase();
  const password = await rl.question("Password: ");
  if (!name || !email || password.length < 8) throw new Error("Name and email are required; password must be at least 8 characters");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with this email already exists");
  await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "SUPER_ADMIN", gymId: null } });
  console.log("Super Admin created successfully.");
} finally {
  rl.close();
  await prisma.$disconnect();
}
