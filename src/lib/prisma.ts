import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function ensureSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.settings.create({
    data: {
      id: 1,
      startingBankroll: 1_000_000,
      currency: "TZS",
      taxRate: 0.12,
      emailEnabled: true,
      alertEmail: "nathanielmwaipopo@gmail.com",
    },
  });
}
