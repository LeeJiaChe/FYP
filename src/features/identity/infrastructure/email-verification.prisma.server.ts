import "server-only";

import { prisma } from "@/lib/prisma";

export async function findStudentIdentityRecord(email: string, studentId: string) {
  return prisma.user.findFirst({
    where: { OR: [{ email }, { studentId }] },
    select: { id: true },
  });
}

export async function createUnverifiedStudentRecord(input: {
  name: string;
  email: string;
  studentId: string;
  passwordHash: string;
  tokenHash: string;
  expiresAt: Date;
  initialCredit: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        name: input.name,
        email: input.email,
        studentId: input.studentId,
        passwordHash: input.passwordHash,
        role: "STUDENT",
        creditScore: input.initialCredit,
      },
      select: { id: true, email: true },
    });
    await transaction.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
    return user;
  });
}

export async function consumeEmailVerificationTokenRecord(
  tokenHash: string,
  now: Date,
) {
  return prisma.$transaction(async (transaction) => {
    const token = await transaction.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (!token || token.consumedAt || token.expiresAt <= now) return null;
    const consumed = await transaction.emailVerificationToken.updateMany({
      where: { id: token.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return null;
    await transaction.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: now, sessionVersion: { increment: 1 } },
    });
    return { userId: token.userId };
  });
}
