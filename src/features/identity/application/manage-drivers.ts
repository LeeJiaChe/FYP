import type { CreateDriverInput, UpdateDriverInput } from "../contracts/driver.schemas";
import {
  createDriverRecord,
  DriverPersistenceError,
  listDriverRecords,
  updateDriverRecord,
} from "../infrastructure/driver.prisma.server";
import { conflict, forbidden, notFound } from "@/shared/application/application-error";

export interface IdentityActor {
  readonly userId: string;
  readonly role: string;
}

function requireAdmin(actor: IdentityActor) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
}

function mapFailure(error: unknown): never {
  if (error instanceof DriverPersistenceError) {
    if (error.code === "ACTOR_FORBIDDEN") throw forbidden("Admin role required");
    if (error.code === "NOT_FOUND") throw notFound("Driver not found");
    throw conflict("A user with this email already exists");
  }
  if (error instanceof Error && error.message.includes("Unique constraint")) {
    throw conflict("A user with this email already exists");
  }
  throw error;
}

export async function listDrivers(actor: IdentityActor) {
  requireAdmin(actor);
  try { return await listDriverRecords(actor.userId); } catch (error) { mapFailure(error); }
}

export async function createDriver(actor: IdentityActor, input: CreateDriverInput) {
  requireAdmin(actor);
  try { return await createDriverRecord(actor.userId, input); } catch (error) { mapFailure(error); }
}

export async function updateDriver(actor: IdentityActor, input: UpdateDriverInput) {
  requireAdmin(actor);
  try { return await updateDriverRecord(actor.userId, input); } catch (error) { mapFailure(error); }
}
