export interface PositionedTripStop {
  readonly id: string;
  readonly tripId: string;
  readonly position: number;
}

export interface PositionedTripSegment {
  readonly id: string;
  readonly tripId: string;
  readonly position: number;
}

export class JourneyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JourneyValidationError";
  }
}

export function deriveJourneySegments(
  boarding: PositionedTripStop,
  dropOff: PositionedTripStop,
  tripSegments: readonly PositionedTripSegment[],
): readonly PositionedTripSegment[] {
  if (boarding.tripId !== dropOff.tripId) {
    throw new JourneyValidationError(
      "Boarding and drop-off stops must belong to the same Trip",
    );
  }
  if (boarding.position >= dropOff.position) {
    throw new JourneyValidationError(
      "Boarding stop must be before drop-off stop",
    );
  }

  const traversed = tripSegments
    .filter(
      (segment) =>
        segment.tripId === boarding.tripId &&
        segment.position >= boarding.position &&
        segment.position < dropOff.position,
    )
    .sort((left, right) => left.position - right.position);

  const requiredCount = dropOff.position - boarding.position;
  if (
    traversed.length !== requiredCount ||
    traversed.some(
      (segment, index) => segment.position !== boarding.position + index,
    )
  ) {
    throw new JourneyValidationError(
      "Trip topology does not contain every segment for this journey",
    );
  }

  return traversed;
}
