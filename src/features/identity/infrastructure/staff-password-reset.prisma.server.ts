import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/shared/db/prisma.server";
import type { StaffPasswordResetStore } from "../application/staff-password-reset";

export const staffPasswordResetStore: StaffPasswordResetStore = {
  async createIfEligible(input) {
    return prisma.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { email: input.email },
          select: { id: true, email: true, role: true, passwordHash: true },
        });
        if (
          !user ||
          (user.role !== "DRIVER" && user.role !== "ADMIN") ||
          !user.passwordHash
        ) {
          return null;
        }
        await transaction.passwordResetToken.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: input.now },
        });
        await transaction.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
          },
        });
        return { email: user.email };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async consume(input) {
    return prisma.$transaction(
      async (transaction) => {
        const token = await transaction.passwordResetToken.findUnique({
          where: { tokenHash: input.tokenHash },
          select: {
            id: true,
            userId: true,
            expiresAt: true,
            consumedAt: true,
            user: { select: { role: true, passwordHash: true } },
          },
        });
        if (
          !token ||
          token.consumedAt ||
          token.expiresAt <= input.now ||
          (token.user.role !== "DRIVER" && token.user.role !== "ADMIN") ||
          !token.user.passwordHash
        ) {
          return "INVALID" as const;
        }
        const consumed = await transaction.passwordResetToken.updateMany({
          where: {
            id: token.id,
            consumedAt: null,
            expiresAt: { gt: input.now },
          },
          data: { consumedAt: input.now },
        });
        if (consumed.count !== 1) return "INVALID" as const;

        await transaction.user.update({
          where: { id: token.userId },
          data: {
            passwordHash: input.passwordHash,
            sessionVersion: { increment: 1 },
          },
        });
        await transaction.passwordResetToken.updateMany({
          where: { userId: token.userId, consumedAt: null },
          data: { consumedAt: input.now },
        });
        return "RESET" as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },
};
