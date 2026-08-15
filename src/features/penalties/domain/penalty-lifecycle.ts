export class PenaltyLifecycleError extends Error {
  constructor(readonly code: "NOT_APPEALABLE" | "NOT_PENDING") {
    super(code);
    this.name = "PenaltyLifecycleError";
  }
}

export function assertPenaltyCanBeAppealed(status: string): void {
  if (status !== "ACTIVE") throw new PenaltyLifecycleError("NOT_APPEALABLE");
}

export function penaltyStatusForAppealDecision(
  appealStatus: "APPROVED" | "REJECTED",
): "OVERTURNED" | "UPHELD" {
  return appealStatus === "APPROVED" ? "OVERTURNED" : "UPHELD";
}

export function assertAppealPending(status: string): void {
  if (status !== "PENDING") throw new PenaltyLifecycleError("NOT_PENDING");
}
