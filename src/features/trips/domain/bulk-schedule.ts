import type { BulkScheduleInput } from "../contracts/trip.schemas";
import { intervalsOverlap, toServiceDateKey } from "./scheduling-policy";
import { mytLocalDateTimeToIso } from "@/shared/time/operational-time";

export interface BulkTripCandidate {
  readonly key: string;
  readonly routeId: string;
  readonly departureTime: Date;
  readonly busId: string;
  readonly driverId?: string;
  readonly blockId?: string;
}

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number) as [number, number];
  return hour * 60 + minute;
}

export function generateBulkTripCandidates(
  input: BulkScheduleInput,
): BulkTripCandidate[] {
  const startMinutes = minutes(input.startTime);
  const endMinutes = minutes(input.endTime);
  if (endMinutes < startMinutes) throw new RangeError("End time must not precede start time");
  const dates: string[] = [];
  const start = new Date(`${input.serviceDateFrom}T00:00:00.000Z`);
  const end = new Date(`${input.serviceDateTo}T00:00:00.000Z`);
  for (let day = start; day <= end; day = new Date(day.getTime() + 86_400_000)) {
    if (input.weekdays.length === 0 || input.weekdays.includes(day.getUTCDay())) {
      dates.push(day.toISOString().slice(0, 10));
    }
  }

  const candidates: BulkTripCandidate[] = [];
  for (const date of dates) {
    for (let departure = startMinutes; departure <= endMinutes; departure += input.headwayMinutes) {
      const hour = String(Math.floor(departure / 60)).padStart(2, "0");
      const minute = String(departure % 60).padStart(2, "0");
      const index = candidates.length;
      const driverId = input.driverIds.length
        ? input.driverIds[index % input.driverIds.length]
        : undefined;
      candidates.push({
        key: `${date}-${hour}${minute}-${index + 1}`,
        routeId: input.routeId,
        departureTime: new Date(mytLocalDateTimeToIso(`${date}T${hour}:${minute}`)),
        busId: input.busIds[index % input.busIds.length]!,
        driverId,
        blockId: input.blockId,
      });
      if (candidates.length > 500) throw new RangeError("Bulk preview cannot exceed 500 Trips");
    }
  }
  return candidates;
}

export function detectBulkResourceConflicts(
  candidate: {
    busId: string;
    driverId?: string | null;
    departureTime: Date;
    estimatedArrivalTime: Date;
  },
  trips: ReadonlyArray<{
    busId: string;
    driverId?: string | null;
    departureTime: Date;
    estimatedArrivalTime: Date;
  }>,
): Array<"BUS_SCHEDULE_CONFLICT" | "DRIVER_SCHEDULE_CONFLICT"> {
  const overlapping = trips.filter((trip) =>
    intervalsOverlap(
      trip.departureTime,
      trip.estimatedArrivalTime,
      candidate.departureTime,
      candidate.estimatedArrivalTime,
    ),
  );
  return [
    ...(overlapping.some((trip) => trip.busId === candidate.busId)
      ? (["BUS_SCHEDULE_CONFLICT"] as const)
      : []),
    ...(candidate.driverId &&
    overlapping.some((trip) => trip.driverId === candidate.driverId)
      ? (["DRIVER_SCHEDULE_CONFLICT"] as const)
      : []),
  ];
}

export function validateBulkServiceBlock(
  candidate: { busId: string; departureTime: Date },
  block: { busId: string; serviceDate: Date } | null,
  blockWasRequested: boolean,
): Array<
  | "SERVICE_BLOCK_NOT_FOUND"
  | "SERVICE_BLOCK_BUS_MISMATCH"
  | "SERVICE_BLOCK_DATE_MISMATCH"
> {
  if (!block) return blockWasRequested ? ["SERVICE_BLOCK_NOT_FOUND"] : [];
  return [
    ...(block.busId !== candidate.busId
      ? (["SERVICE_BLOCK_BUS_MISMATCH"] as const)
      : []),
    ...(toServiceDateKey(block.serviceDate) !==
    toServiceDateKey(candidate.departureTime)
      ? (["SERVICE_BLOCK_DATE_MISMATCH"] as const)
      : []),
  ];
}
