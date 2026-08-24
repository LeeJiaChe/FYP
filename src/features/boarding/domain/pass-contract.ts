import type { Clock } from "@/shared/time/clock";

export const PASS_PURPOSES = [
  "RESERVED_BOARDING",
  "WALK_IN_BOARDING",
  "ALIGHTING",
] as const;

export type PassPurpose = (typeof PASS_PURPOSES)[number];
export type PassengerJourneyKind = "RESERVED" | "WALK_IN";

export interface DurablePassClaims {
  readonly purpose: PassPurpose;
  readonly journeyKind: PassengerJourneyKind;
  readonly recordId: string;
  readonly studentId: string;
  readonly tripId: string;
}

export interface TimedPassClaims extends DurablePassClaims {
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly tokenId: string;
}

export function isPassPurpose(value: unknown): value is PassPurpose {
  return typeof value === "string" && PASS_PURPOSES.includes(value as PassPurpose);
}

export function assertPassPurpose(
  actual: PassPurpose,
  expected: PassPurpose,
): void {
  if (actual !== expected) {
    throw new PassContractError(`Expected ${expected} pass`);
  }
}

export function isPassTimeValid(
  claims: Pick<TimedPassClaims, "issuedAt" | "expiresAt">,
  clock: Clock,
): boolean {
  const nowSeconds = Math.floor(clock.now().getTime() / 1_000);
  return claims.issuedAt <= nowSeconds && nowSeconds < claims.expiresAt;
}

export class PassContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PassContractError";
  }
}
