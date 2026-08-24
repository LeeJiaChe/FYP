/**
 * Executable Architecture v2 specifications for Phase 1.
 *
 * This is deliberately test-only reference behavior, not production domain code.
 * Phase 2+ implementations must satisfy these examples without importing them.
 */

export interface Journey {
  readonly boardingIndex: number;
  readonly dropOffIndex: number;
}

export function journeySegments(journey: Journey, stopCount: number): number[] {
  const { boardingIndex, dropOffIndex } = journey;
  if (
    !Number.isInteger(boardingIndex) ||
    !Number.isInteger(dropOffIndex) ||
    boardingIndex < 0 ||
    dropOffIndex >= stopCount ||
    boardingIndex >= dropOffIndex
  ) {
    throw new RangeError("Journey must board before drop-off on the same route");
  }

  return Array.from(
    { length: dropOffIndex - boardingIndex },
    (_, offset) => boardingIndex + offset,
  );
}

export function isSeatAvailable(
  occupiedSegments: ReadonlySet<number>,
  journey: Journey,
  stopCount: number,
): boolean {
  return journeySegments(journey, stopCount).every(
    (segment) => !occupiedSegments.has(segment),
  );
}

export interface SeatFixture {
  readonly seatNumber: number;
  readonly occupiedSegments: ReadonlySet<number>;
}

export function firstSeatFreeForWholeJourney(
  seats: readonly SeatFixture[],
  journey: Journey,
  stopCount: number,
): SeatFixture | undefined {
  return seats.find((seat) =>
    isSeatAvailable(seat.occupiedSegments, journey, stopCount),
  );
}

export interface WaitlistFixture {
  readonly id: string;
  readonly queuedAt: number;
  readonly journey: Journey;
}

export function oldestCompatibleWaitlistEntry(
  entries: readonly WaitlistFixture[],
  seats: readonly SeatFixture[],
  stopCount: number,
): WaitlistFixture | undefined {
  return [...entries]
    .sort((left, right) => left.queuedAt - right.queuedAt)
    .find(
      (entry) =>
        firstSeatFreeForWholeJourney(seats, entry.journey, stopCount) !==
        undefined,
    );
}

export interface WalkInIntentFixture {
  readonly kind: "WALK_IN";
  readonly journey: Journey;
  readonly standingClaims: readonly number[];
}

export function issueWalkInIntent(journey: Journey): WalkInIntentFixture {
  return { kind: "WALK_IN", journey, standingClaims: [] };
}

export function canAdmitStandingJourney(
  occupancyBySegment: ReadonlyMap<number, number>,
  capacity: number,
  journey: Journey,
  stopCount: number,
): boolean {
  return journeySegments(journey, stopCount).every(
    (segment) => (occupancyBySegment.get(segment) ?? 0) < capacity,
  );
}

export class SerializedStandingAdmissionFixture {
  readonly #occupancy = new Map<number, number>();
  readonly #capacity: number;
  readonly #stopCount: number;
  #transactionTail: Promise<void> = Promise.resolve();

  constructor(capacity: number, stopCount: number) {
    this.#capacity = capacity;
    this.#stopCount = stopCount;
  }

  seed(segment: number, occupancy: number): void {
    this.#occupancy.set(segment, occupancy);
  }

  admit(journey: Journey): Promise<boolean> {
    const transaction = this.#transactionTail.then(() => {
      if (
        !canAdmitStandingJourney(
          this.#occupancy,
          this.#capacity,
          journey,
          this.#stopCount,
        )
      ) {
        return false;
      }

      for (const segment of journeySegments(journey, this.#stopCount)) {
        this.#occupancy.set(segment, (this.#occupancy.get(segment) ?? 0) + 1);
      }
      return true;
    });

    this.#transactionTail = transaction.then(() => undefined);
    return transaction;
  }

  occupancy(segment: number): number {
    return this.#occupancy.get(segment) ?? 0;
  }
}

export type BoardingPassFixture =
  | {
      readonly kind: "RESERVED";
      readonly bookingId: string;
      readonly seatNumber: number;
      readonly guaranteesSeat: true;
    }
  | {
      readonly kind: "WALK_IN";
      readonly intentId: string;
      readonly guaranteesSeat: false;
    };

export interface ReservedJourneyFixture {
  readonly plannedSegments: readonly number[];
  readonly actualAlightedAt: string | null;
}

export function confirmActualAlighting(
  journey: ReservedJourneyFixture,
  actualAlightedAt: string,
): ReservedJourneyFixture {
  return { ...journey, actualAlightedAt };
}

export type LocationSource = "SIMULATOR" | "GPS";

export interface LocationInputFixture {
  readonly tripId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly recordedAt: string;
  readonly source: LocationSource;
}

export type StoredLocationFixture = LocationInputFixture;

export interface ConsumerLocationFixture {
  readonly tripId: string;
  readonly position: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly recordedAt: string;
  readonly prototype: boolean;
}

export function ingestLocation(
  input: LocationInputFixture,
): StoredLocationFixture {
  return { ...input };
}

export function toConsumerLocation(
  stored: StoredLocationFixture,
): ConsumerLocationFixture {
  return {
    tripId: stored.tripId,
    position: {
      latitude: stored.latitude,
      longitude: stored.longitude,
    },
    recordedAt: stored.recordedAt,
    prototype: stored.source === "SIMULATOR",
  };
}
