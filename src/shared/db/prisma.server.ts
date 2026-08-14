import "server-only";

import { PrismaClient } from "@prisma/client";

import { serverEnvironment } from "@/shared/config/env.server";

const globalForPrisma = globalThis as typeof globalThis & {
  architectureV2Prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasourceUrl: serverEnvironment.database.url,
    log:
      serverEnvironment.runtime === "production"
        ? ["error"]
        : ["error", "warn"],
  });
}

export const prisma =
  globalForPrisma.architectureV2Prisma ?? createPrismaClient();

if (serverEnvironment.runtime !== "production") {
  globalForPrisma.architectureV2Prisma = prisma;
}
