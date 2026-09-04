export type BusAssignmentTripStatus =
  | "NOT_STARTED"
  | "BOARDING"
  | "DEPARTED"
  | "ARRIVED"
  | "CANCELLED";

export interface BusAssignmentTrip {
  readonly id: string;
  readonly busId: string;
  readonly status: BusAssignmentTripStatus;
  readonly departureTime: string | Date;
  readonly lineCode?: string;
  readonly lineName?: string;
  readonly direction?: "OUTBOUND" | "INBOUND";
  readonly routeName?: string;
  readonly driverName?: string;
}

export type BusOperationalAssignment =
  | {
      readonly state: "NORMAL";
      readonly current: BusAssignmentTrip | null;
      readonly next: BusAssignmentTrip | null;
      readonly conflictTripIds: readonly [];
    }
  | {
      readonly state: "MULTIPLE_ACTIVE_TRIPS";
      readonly current: null;
      readonly next: BusAssignmentTrip | null;
      readonly conflictTripIds: readonly string[];
    };

function compareTrips(left: BusAssignmentTrip, right: BusAssignmentTrip): number {
  const timeDifference =
    new Date(left.departureTime).getTime() -
    new Date(right.departureTime).getTime();
  return timeDifference || left.id.localeCompare(right.id);
}

export function deriveBusOperationalAssignment(
  trips: readonly BusAssignmentTrip[],
  busId: string,
  now: Date,
): BusOperationalAssignment {
  const busTrips = trips.filter((trip) => trip.busId === busId);
  const activeTrips = busTrips
    .filter(
      (trip) => trip.status === "BOARDING" || trip.status === "DEPARTED",
    )
    .sort(compareTrips);
  const next =
    busTrips
      .filter(
        (trip) =>
          trip.status === "NOT_STARTED" &&
          new Date(trip.departureTime).getTime() >= now.getTime(),
      )
      .sort(compareTrips)[0] ?? null;

  if (activeTrips.length > 1) {
    return {
      state: "MULTIPLE_ACTIVE_TRIPS",
      current: null,
      next,
      conflictTripIds: activeTrips.map((trip) => trip.id),
    };
  }

  return {
    state: "NORMAL",
    current: activeTrips[0] ?? null,
    next,
    conflictTripIds: [],
  };
}
