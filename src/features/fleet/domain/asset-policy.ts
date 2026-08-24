export type FleetBusStatus = "ACTIVE" | "MAINTENANCE" | "RETIRED";

export class AssetPolicyError extends Error {}

export function assertBusStatusTransition(
  from: FleetBusStatus,
  to: FleetBusStatus,
): void {
  if (from === "RETIRED" && to !== "RETIRED") {
    throw new AssetPolicyError("A retired Bus cannot be reactivated");
  }
}

export function canScheduleBus(status: FleetBusStatus): boolean {
  return status === "ACTIVE";
}

export function unavailableBusCancelsFutureTrips(
  from: FleetBusStatus,
  to: FleetBusStatus,
): boolean {
  return from === "ACTIVE" && (to === "MAINTENANCE" || to === "RETIRED");
}
