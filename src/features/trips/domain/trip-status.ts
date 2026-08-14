export const TRIP_STATUSES = [
  "NOT_STARTED",
  "BOARDING",
  "DEPARTED",
  "ARRIVED",
  "CANCELLED",
] as const;

export type TripLifecycleStatus = (typeof TRIP_STATUSES)[number];

const allowedTransitions: Readonly<Record<TripLifecycleStatus, readonly TripLifecycleStatus[]>> = {
  NOT_STARTED: ["BOARDING", "CANCELLED"],
  BOARDING: ["DEPARTED", "CANCELLED"],
  DEPARTED: ["ARRIVED", "CANCELLED"],
  ARRIVED: [],
  CANCELLED: [],
};

export class TripTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TripTransitionError";
  }
}

export function assertTripTransition(
  from: TripLifecycleStatus,
  to: TripLifecycleStatus,
  reason?: string | null,
): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new TripTransitionError(`Illegal Trip transition: ${from} -> ${to}`);
  }
  if (from === "DEPARTED" && to === "CANCELLED" && !reason?.trim()) {
    throw new TripTransitionError(
      "Post-departure emergency cancellation requires a reason",
    );
  }
}

export function isTerminalTripStatus(status: TripLifecycleStatus): boolean {
  return status === "ARRIVED" || status === "CANCELLED";
}
