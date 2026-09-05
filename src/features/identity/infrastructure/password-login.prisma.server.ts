import "server-only";

import { prisma } from "@/shared/db/prisma.server";
import type { PasswordLoginStore } from "../application/password-login";

export const passwordLoginStore: PasswordLoginStore = {
  findByIdentifier(identifier) {
    return prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { studentId: identifier }] },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        studentId: true,
        creditScore: true,
        sessionVersion: true,
        passwordHash: true,
        emailVerifiedAt: true,
        studentIdentityAssurance: true,
      },
    });
  },
};
