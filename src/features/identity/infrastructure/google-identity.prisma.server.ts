import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/shared/db/prisma.server";
import type {
  GoogleStudentIdentityStore,
  StudentSessionIdentity,
} from "../application/google-student-auth";

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  studentId: true,
  creditScore: true,
  sessionVersion: true,
} as const;

function isUniqueConstraint(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

function isTransactionWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
  );
}

function asStudentSessionIdentity(user: {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "DRIVER" | "ADMIN";
  studentId: string | null;
  creditScore: number;
  sessionVersion: number;
}): StudentSessionIdentity {
  if (user.role !== "STUDENT") throw new Error("Linked identity is not a Student");
  return { ...user, role: "STUDENT" };
}

export const googleStudentIdentityStore: GoogleStudentIdentityStore = {
  async resolveOrLink(identity, now) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const linked = await transaction.externalAuthIdentity.findUnique({
            where: {
              provider_providerSubject: {
                provider: "GOOGLE",
                providerSubject: identity.providerSubject,
              },
            },
            select: { user: { select: sessionUserSelect } },
          });

          if (linked) {
            if (linked.user.role !== "STUDENT") {
              return { kind: "PRIVILEGED_ACCOUNT_CONFLICT" as const };
            }
            if (linked.user.email !== identity.email) {
              const emailOwner = await transaction.user.findUnique({
                where: { email: identity.email },
                select: { id: true },
              });
              if (emailOwner && emailOwner.id !== linked.user.id) {
                return { kind: "EMAIL_CONFLICT" as const };
              }
            }
            const user = await transaction.user.update({
              where: { id: linked.user.id },
              data: {
                email: identity.email,
                emailVerifiedAt: now,
                studentIdentityAssurance: "GOOGLE_WORKSPACE_VERIFIED",
              },
              select: sessionUserSelect,
            });
            return {
              kind: "AUTHENTICATED" as const,
              user: asStudentSessionIdentity(user),
            };
          }

          const emailOwner = await transaction.user.findUnique({
            where: { email: identity.email },
            select: sessionUserSelect,
          });
          if (!emailOwner) return { kind: "ONBOARDING_REQUIRED" as const };
          if (emailOwner.role !== "STUDENT") {
            return { kind: "PRIVILEGED_ACCOUNT_CONFLICT" as const };
          }

          await transaction.externalAuthIdentity.create({
            data: {
              userId: emailOwner.id,
              provider: "GOOGLE",
              providerSubject: identity.providerSubject,
              emailAtLink: identity.email,
            },
          });
          const user = await transaction.user.update({
            where: { id: emailOwner.id },
            data: {
              emailVerifiedAt: now,
              studentIdentityAssurance: "GOOGLE_WORKSPACE_VERIFIED",
            },
            select: sessionUserSelect,
          });
          return {
            kind: "AUTHENTICATED" as const,
            user: asStudentSessionIdentity(user),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isUniqueConstraint(error) || isTransactionWriteConflict(error)) {
        return { kind: "IDENTITY_CONFLICT" as const };
      }
      throw error;
    }
  },

  async completeOnboarding(input) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const existingIdentity =
            await transaction.externalAuthIdentity.findUnique({
              where: {
                provider_providerSubject: {
                  provider: "GOOGLE",
                  providerSubject: input.identity.providerSubject,
                },
              },
              select: { id: true },
            });
          if (existingIdentity) {
            return { kind: "ONBOARDING_STATE_USED" as const };
          }

          const duplicate = await transaction.user.findFirst({
            where: {
              OR: [
                { email: input.identity.email },
                { studentId: input.studentId },
              ],
            },
            select: { email: true, studentId: true },
          });
          if (duplicate?.studentId === input.studentId) {
            return { kind: "STUDENT_ID_CONFLICT" as const };
          }
          if (duplicate) return { kind: "EMAIL_CONFLICT" as const };

          const user = await transaction.user.create({
            data: {
              name: input.name,
              email: input.identity.email,
              studentId: input.studentId,
              passwordHash: null,
              role: "STUDENT",
              creditScore: input.initialCredit,
              emailVerifiedAt: input.now,
              studentIdentityAssurance: "GOOGLE_WORKSPACE_VERIFIED",
              externalAuthIdentities: {
                create: {
                  provider: "GOOGLE",
                  providerSubject: input.identity.providerSubject,
                  emailAtLink: input.identity.email,
                },
              },
            },
            select: sessionUserSelect,
          });
          return {
            kind: "CREATED" as const,
            user: asStudentSessionIdentity(user),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isTransactionWriteConflict(error)) {
        return { kind: "IDENTITY_CONFLICT" as const };
      }
      if (isUniqueConstraint(error)) {
        const target = String(
          (error as Prisma.PrismaClientKnownRequestError).meta?.target ?? "",
        );
        if (target.includes("studentId")) {
          return { kind: "STUDENT_ID_CONFLICT" as const };
        }
        if (target.includes("email")) {
          return { kind: "EMAIL_CONFLICT" as const };
        }
        return { kind: "IDENTITY_CONFLICT" as const };
      }
      throw error;
    }
  },
};
