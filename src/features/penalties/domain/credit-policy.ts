import type { ProductPolicy } from "@/shared/config/policies";

export interface CreditChange {
  readonly score: number;
  readonly pointsChanged: number;
}

export function deductNoShowCredit(
  currentScore: number,
  policy: ProductPolicy,
): CreditChange {
  const score = Math.max(0, currentScore - policy.noShowPenaltyPoints);
  return { score, pointsChanged: currentScore - score };
}

export function restoreCredit(
  currentScore: number,
  points: number,
  policy: ProductPolicy,
): CreditChange {
  const score = Math.min(policy.initialCredit, currentScore + points);
  return { score, pointsChanged: score - currentScore };
}

export function isBookingRestricted(
  creditScore: number,
  policy: ProductPolicy,
): boolean {
  return creditScore < policy.bookingRestrictionBelowCredit;
}
