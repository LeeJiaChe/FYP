import "server-only";

import bcrypt from "bcryptjs";

import { prisma } from "@/shared/db/prisma.server";
import type { CreateDriverInput, UpdateDriverInput } from "../contracts/driver.schemas";

export type DriverPersistenceFailure = "ACTOR_FORBIDDEN" | "NOT_FOUND" | "DUPLICATE";

export class DriverPersistenceError extends Error {
  constructor(readonly code: DriverPersistenceFailure) {
    super(code);
    this.name = "DriverPersistenceError";
  }
}

async function assertAdmin(actorId: string) {
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (actor?.role !== "ADMIN") throw new DriverPersistenceError("ACTOR_FORBIDDEN");
}

const driverSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

export async function listDriverRecords(actorId: string) {
  await assertAdmin(actorId);
  return prisma.user.findMany({
    where: { role: "DRIVER" },
    select: driverSelect,
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

export async function createDriverRecord(actorId: string, input: CreateDriverInput) {
  await assertAdmin(actorId);
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw new DriverPersistenceError("DUPLICATE");
  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, role: "DRIVER" },
    select: driverSelect,
  });
}

export async function updateDriverRecord(actorId: string, input: UpdateDriverInput) {
  await assertAdmin(actorId);
  const driver = await prisma.user.findFirst({
    where: { id: input.id, role: "DRIVER" },
    select: { id: true },
  });
  if (!driver) throw new DriverPersistenceError("NOT_FOUND");
  return prisma.user.update({
    where: { id: driver.id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.email === undefined ? {} : { email: input.email }),
    },
    select: driverSelect,
  });
}
