export interface NoShowEvidence {
  readonly bookingStatus: string;
  readonly checkedInAt: Date | null;
  readonly boardingActualDeparture: Date | null;
  readonly boardingPassedAt: Date | null;
}

export function isReservedNoShow(input: NoShowEvidence): boolean {
  return (
    input.bookingStatus === "CONFIRMED" &&
    input.checkedInAt === null &&
    (input.boardingActualDeparture !== null || input.boardingPassedAt !== null)
  );
}
