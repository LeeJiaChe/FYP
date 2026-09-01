export type DriverOperationTripStatus =
  | "NOT_STARTED"
  | "BOARDING"
  | "DEPARTED"
  | "ARRIVED"
  | "CANCELLED";

export interface DriverOperationCandidate {
  readonly id: string;
  readonly driverId: string | null;
  readonly status: DriverOperationTripStatus;
  readonly departureTime: Date;
}

export type DriverOperationReason =
  | "ONGOING_TRIP"
  | "BOARDING_WINDOW_OPEN"
  | "WAITING_FOR_BOARDING_WINDOW"
  | "NO_ASSIGNED_TRIPS"
  | "MULTIPLE_ACTIVE_TRIPS";

export interface ResolvedDriverOperation<T extends DriverOperationCandidate> {
  readonly state:
    | "CURRENT_OPERATION"
    | "UPCOMING"
    | "NO_ASSIGNMENT"
    | "MULTIPLE_ACTIVE_TRIPS";
  readonly reason: DriverOperationReason;
  readonly currentTrip: T | null;
  readonly nextTrip: T | null;
  readonly activationAt: Date | null;
  readonly conflictTripIds: readonly string[];
}

function byDepartureThenId<T extends DriverOperationCandidate>(left: T, right: T) {
  return (
    left.departureTime.getTime() - right.departureTime.getTime() ||
    left.id.localeCompare(right.id)
  );
}

export function resolveDriverOperation<T extends DriverOperationCandidate>(input: {
  readonly driverId: string;
  readonly trips: readonly T[];
  readonly now: Date;
  readonly boardingOpenLeadMs: number;
}): ResolvedDriverOperation<T> {
  const assigned = input.trips.filter(
    (trip) => trip.driverId === input.driverId,
  );
  const ongoing = assigned
    .filter((trip) => trip.status === "BOARDING" || trip.status === "DEPARTED")
    .sort(byDepartureThenId);

  if (ongoing.length > 1) {
    return {
      state: "MULTIPLE_ACTIVE_TRIPS",
      reason: "MULTIPLE_ACTIVE_TRIPS",
      currentTrip: null,
      nextTrip: null,
      activationAt: null,
      conflictTripIds: ongoing.map((trip) => trip.id),
    };
  }

  const notStarted = assigned
    .filter((trip) => trip.status === "NOT_STARTED")
    .sort(byDepartureThenId);

  if (ongoing[0]) {
    return {
      state: "CURRENT_OPERATION",
      reason: "ONGOING_TRIP",
      currentTrip: ongoing[0],
      nextTrip: notStarted[0] ?? null,
      activationAt: null,
      conflictTripIds: [],
    };
  }

  const nowMs = input.now.getTime();
  const readyIndex = notStarted.findIndex(
    (trip) =>
      trip.departureTime.getTime() - input.boardingOpenLeadMs <= nowMs,
  );
  if (readyIndex >= 0) {
    const currentTrip = notStarted[readyIndex]!;
    return {
      state: "CURRENT_OPERATION",
      reason: "BOARDING_WINDOW_OPEN",
      currentTrip,
      nextTrip: notStarted[readyIndex + 1] ?? null,
      activationAt: new Date(
        currentTrip.departureTime.getTime() - input.boardingOpenLeadMs,
      ),
      conflictTripIds: [],
    };
  }

  const nextTrip = notStarted[0] ?? null;
  if (nextTrip) {
    return {
      state: "UPCOMING",
      reason: "WAITING_FOR_BOARDING_WINDOW",
      currentTrip: null,
      nextTrip,
      activationAt: new Date(
        nextTrip.departureTime.getTime() - input.boardingOpenLeadMs,
      ),
      conflictTripIds: [],
    };
  }

  return {
    state: "NO_ASSIGNMENT",
    reason: "NO_ASSIGNED_TRIPS",
    currentTrip: null,
    nextTrip: null,
    activationAt: null,
    conflictTripIds: [],
  };
}
