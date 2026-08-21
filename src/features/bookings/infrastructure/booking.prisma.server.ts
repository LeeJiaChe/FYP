import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import type {
  CreateReservedBookingInput,
  JoinWaitlistInput,
  JourneySelection,
} from "../contracts/booking.schemas";
import {
  deriveJourneySegments,
  JourneyValidationError,
} from "../domain/journey-segments";
import {
  assertReservationEligibility,
  canPromoteWaitlistEntry,
  canCancelReservedBooking,
  canTransitionReservedBookingToCancelled,
  ReservationPolicyError,
} from "../domain/reservation-policy";
import type { ProductPolicy } from "@/shared/config/policies";
import { prisma } from "@/shared/db/prisma.server";

export type BookingPersistenceFailureCode =
  | "STUDENT_NOT_FOUND"
  | "TRIP_NOT_FOUND"
  | "INVALID_JOURNEY"
  | "NOT_BOOKABLE"
  | "RESTRICTED"
  | "TOO_EARLY"
  | "TOO_LATE"
  | "SEAT_NOT_ON_TRIP"
  | "SEAT_UNAVAILABLE"
  | "ACTIVE_BOOKING_EXISTS"
  | "WAITLIST_EXISTS"
  | "SEATS_AVAILABLE"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_NOT_CANCELLABLE"
  | "CANCELLATION_CUTOFF"
  | "ALLOCATION_CONFLICT"
  | "ALLOCATION_INCOMPLETE";

export class BookingPersistenceError extends Error {
  constructor(readonly code: BookingPersistenceFailureCode) {
    super(code);
    this.name = "BookingPersistenceError";
  }
}

type Transaction = Prisma.TransactionClient;

async function lockTrip(transaction: Transaction, tripId: string): Promise<void> {
  const locked = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Trip" WHERE "id" = ${tripId} FOR UPDATE
  `;
  if (locked.length === 0) throw new BookingPersistenceError("TRIP_NOT_FOUND");
}

async function loadJourney(
  transaction: Transaction,
  studentId: string,
  selection: JourneySelection,
  now: Date,
  policy: ProductPolicy,
) {
  const [student, trip] = await Promise.all([
    transaction.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        role: true,
        creditScore: true,
      },
    }),
    transaction.trip.findUnique({
      where: { id: selection.tripId },
      include: {
        route: { select: { name: true } },
        tripStops: { orderBy: { position: "asc" } },
        tripSegments: { orderBy: { position: "asc" } },
      },
    }),
  ]);
  if (student?.role !== "STUDENT") {
    throw new BookingPersistenceError("STUDENT_NOT_FOUND");
  }
  if (!trip) throw new BookingPersistenceError("TRIP_NOT_FOUND");

  const boarding = trip.tripStops.find(
    (stop) => stop.id === selection.boardingTripStopId,
  );
  const dropOff = trip.tripStops.find(
    (stop) => stop.id === selection.dropOffTripStopId,
  );
  if (!boarding || !dropOff) {
    throw new BookingPersistenceError("INVALID_JOURNEY");
  }

  try {
    const segments = deriveJourneySegments(boarding, dropOff, trip.tripSegments);
    assertReservationEligibility(
      {
        tripStatus: trip.status,
        boardingPlannedDeparture: boarding.plannedDeparture,
        boardingActualArrival: boarding.actualArrival,
        boardingActualDeparture: boarding.actualDeparture,
        boardingPassedAt: boarding.passedAt,
        studentCredit: student.creditScore,
        now,
      },
      policy,
    );
    return { student, trip, boarding, dropOff, segments };
  } catch (error) {
    if (error instanceof JourneyValidationError) {
      throw new BookingPersistenceError("INVALID_JOURNEY");
    }
    if (error instanceof ReservationPolicyError) {
      throw new BookingPersistenceError(error.code);
    }
    throw error;
  }
}

async function availableTripSeats(
  transaction: Transaction,
  tripId: string,
  tripSegmentIds: readonly string[],
) {
  return transaction.tripSeat.findMany({
    where: {
      tripId,
      reservedSeatSegments: {
        none: { tripSegmentId: { in: [...tripSegmentIds] } },
      },
    },
    select: { id: true, seatNumber: true },
    orderBy: { seatNumber: "asc" },
  });
}

async function createConfirmedBooking(
  transaction: Transaction,
  input: {
    studentId: string;
    tripId: string;
    tripSeatId: string;
    boardingTripStopId: string;
    dropOffTripStopId: string;
    tripSegmentIds: readonly string[];
    routeName: string;
    boardingDeparture: Date;
    createConfirmationNotification?: boolean;
  },
) {
  const booking = await transaction.booking.create({
    data: {
      studentId: input.studentId,
      tripId: input.tripId,
      tripSeatId: input.tripSeatId,
      boardingTripStopId: input.boardingTripStopId,
      dropOffTripStopId: input.dropOffTripStopId,
      status: "CONFIRMED",
    },
    include: { tripSeat: { select: { seatNumber: true } } },
  });
  const allocation = await transaction.reservedSeatSegment.createMany({
    data: input.tripSegmentIds.map((tripSegmentId) => ({
      id: randomUUID(),
      bookingId: booking.id,
      tripId: input.tripId,
      tripSeatId: input.tripSeatId,
      tripSegmentId,
    })),
  });
  if (allocation.count !== input.tripSegmentIds.length) {
    throw new BookingPersistenceError("ALLOCATION_INCOMPLETE");
  }
  if (input.createConfirmationNotification !== false) {
    await transaction.notification.create({
      data: {
        userId: input.studentId,
        type: "BOOKING_CONFIRMED",
        message: `Seat ${booking.tripSeat.seatNumber} confirmed for ${input.routeName} from ${input.boardingDeparture.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      },
    });
  }
  return booking;
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function findJourneyAvailabilityRecord(
  studentId: string,
  selection: JourneySelection,
  now: Date,
  policy: ProductPolicy,
) {
  return prisma.$transaction(async (transaction) => {
    const journey = await loadJourney(
      transaction,
      studentId,
      selection,
      now,
      policy,
    );
    const seats = await availableTripSeats(
      transaction,
      selection.tripId,
      journey.segments.map((segment) => segment.id),
    );
    return {
      tripId: selection.tripId,
      boardingTripStop: journey.boarding,
      dropOffTripStop: journey.dropOff,
      seats,
    };
  });
}

export async function createReservedBookingRecord(
  studentId: string,
  input: CreateReservedBookingInput,
  now: Date,
  policy: ProductPolicy,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await lockTrip(transaction, input.tripId);
      const journey = await loadJourney(
        transaction,
        studentId,
        input,
        now,
        policy,
      );
      const existing = await transaction.booking.findFirst({
        where: { studentId, tripId: input.tripId, status: "CONFIRMED" },
        select: { id: true },
      });
      if (existing) throw new BookingPersistenceError("ACTIVE_BOOKING_EXISTS");

      const selectedSeat = await transaction.tripSeat.findFirst({
        where: { id: input.tripSeatId, tripId: input.tripId },
        select: { id: true },
      });
      if (!selectedSeat) throw new BookingPersistenceError("SEAT_NOT_ON_TRIP");
      const freeSeats = await availableTripSeats(
        transaction,
        input.tripId,
        journey.segments.map((segment) => segment.id),
      );
      if (!freeSeats.some((seat) => seat.id === input.tripSeatId)) {
        throw new BookingPersistenceError("SEAT_UNAVAILABLE");
      }

      const booking = await createConfirmedBooking(transaction, {
        studentId,
        tripId: input.tripId,
        tripSeatId: input.tripSeatId,
        boardingTripStopId: input.boardingTripStopId,
        dropOffTripStopId: input.dropOffTripStopId,
        tripSegmentIds: journey.segments.map((segment) => segment.id),
        routeName: journey.trip.route.name,
        boardingDeparture: journey.boarding.plannedDeparture,
      });
      await transaction.waitlistEntry.updateMany({
        where: { studentId, tripId: input.tripId, status: "WAITING" },
        data: { status: "CANCELLED" },
      });
      return booking;
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new BookingPersistenceError("ALLOCATION_CONFLICT");
    }
    throw error;
  }
}

export async function joinWaitlistRecord(
  studentId: string,
  input: JoinWaitlistInput,
  now: Date,
  policy: ProductPolicy,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await lockTrip(transaction, input.tripId);
      const journey = await loadJourney(
        transaction,
        studentId,
        input,
        now,
        policy,
      );
      const booking = await transaction.booking.findFirst({
        where: { studentId, tripId: input.tripId, status: "CONFIRMED" },
        select: { id: true },
      });
      if (booking) throw new BookingPersistenceError("ACTIVE_BOOKING_EXISTS");
      const existing = await transaction.waitlistEntry.findFirst({
        where: {
          studentId,
          tripId: input.tripId,
          boardingTripStopId: input.boardingTripStopId,
          dropOffTripStopId: input.dropOffTripStopId,
          status: "WAITING",
        },
        select: { id: true },
      });
      if (existing) throw new BookingPersistenceError("WAITLIST_EXISTS");
      const seats = await availableTripSeats(
        transaction,
        input.tripId,
        journey.segments.map((segment) => segment.id),
      );
      if (seats.length > 0) throw new BookingPersistenceError("SEATS_AVAILABLE");

      return transaction.waitlistEntry.create({
        data: {
          studentId,
          tripId: input.tripId,
          boardingTripStopId: input.boardingTripStopId,
          dropOffTripStopId: input.dropOffTripStopId,
          queuedAt: now,
          status: "WAITING",
        },
      });
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new BookingPersistenceError("WAITLIST_EXISTS");
    }
    throw error;
  }
}

export async function promoteCompatibleWaitlistInTransaction(
  transaction: Transaction,
  tripId: string,
  now: Date,
  policy: ProductPolicy,
) {
  const entries = await transaction.waitlistEntry.findMany({
    where: { tripId, status: "WAITING" },
    orderBy: [{ queuedAt: "asc" }, { id: "asc" }],
  });
  const promoted: Array<{ entryId: string; bookingId: string; studentId: string }> = [];

  for (const entry of entries) {
    try {
      const [student, trip] = await Promise.all([
        transaction.user.findUnique({
          where: { id: entry.studentId },
          select: { id: true, role: true, creditScore: true },
        }),
        transaction.trip.findUnique({
          where: { id: tripId },
          include: {
            route: { select: { name: true } },
            tripStops: { orderBy: { position: "asc" } },
            tripSegments: { orderBy: { position: "asc" } },
          },
        }),
      ]);
      if (student?.role !== "STUDENT" || !trip) continue;
      const boarding = trip.tripStops.find(
        (stop) => stop.id === entry.boardingTripStopId,
      );
      const dropOff = trip.tripStops.find(
        (stop) => stop.id === entry.dropOffTripStopId,
      );
      if (
        !boarding ||
        !dropOff ||
        !canPromoteWaitlistEntry(
          {
            tripStatus: trip.status,
            boardingActualArrival: boarding.actualArrival,
            boardingActualDeparture: boarding.actualDeparture,
            boardingPassedAt: boarding.passedAt,
            studentCredit: student.creditScore,
          },
          policy,
        )
      ) {
        continue;
      }
      const segments = deriveJourneySegments(
        boarding,
        dropOff,
        trip.tripSegments,
      );
      const journey = { trip, boarding, dropOff, segments };
      const existingBooking = await transaction.booking.findFirst({
        where: { studentId: entry.studentId, tripId, status: "CONFIRMED" },
        select: { id: true },
      });
      if (existingBooking) continue;
      const [seat] = await availableTripSeats(
        transaction,
        tripId,
        journey.segments.map((segment) => segment.id),
      );
      if (!seat) continue;

      const booking = await createConfirmedBooking(transaction, {
        studentId: entry.studentId,
        tripId,
        tripSeatId: seat.id,
        boardingTripStopId: entry.boardingTripStopId,
        dropOffTripStopId: entry.dropOffTripStopId,
        tripSegmentIds: journey.segments.map((segment) => segment.id),
        routeName: journey.trip.route.name,
        boardingDeparture: journey.boarding.plannedDeparture,
        createConfirmationNotification: false,
      });
      await transaction.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: "PROMOTED", promotedBookingId: booking.id },
      });
      await transaction.notification.create({
        data: {
          userId: entry.studentId,
          type: "WAITLIST_PROMOTED",
          message: `Your ${journey.boarding.stopName} to ${journey.dropOff.stopName} waitlist request has been promoted to Seat ${seat.seatNumber}.`,
        },
      });
      promoted.push({
        entryId: entry.id,
        bookingId: booking.id,
        studentId: entry.studentId,
      });
    } catch (error) {
      if (error instanceof BookingPersistenceError) continue;
      throw error;
    }
  }
  return promoted;
}

export async function cancelReservedBookingRecord(
  studentId: string,
  bookingId: string,
  now: Date,
  policy: ProductPolicy,
) {
  return prisma.$transaction(async (transaction) => {
    const initial = await transaction.booking.findUnique({
      where: { id: bookingId },
      select: { tripId: true },
    });
    if (!initial) throw new BookingPersistenceError("BOOKING_NOT_FOUND");
    await lockTrip(transaction, initial.tripId);
    const booking = await transaction.booking.findUnique({
      where: { id: bookingId },
      include: { boardingTripStop: true },
    });
    if (!booking || booking.studentId !== studentId) {
      throw new BookingPersistenceError("BOOKING_NOT_FOUND");
    }
    if (!canTransitionReservedBookingToCancelled(booking.status)) {
      throw new BookingPersistenceError("BOOKING_NOT_CANCELLABLE");
    }
    if (!canCancelReservedBooking({
      bookingStatus: booking.status,
      checkedInAt: booking.checkedInAt,
      boardingActualArrival: booking.boardingTripStop.actualArrival,
      boardingActualDeparture: booking.boardingTripStop.actualDeparture,
      boardingPassedAt: booking.boardingTripStop.passedAt,
    })) {
      throw new BookingPersistenceError("CANCELLATION_CUTOFF");
    }

    await transaction.reservedSeatSegment.deleteMany({ where: { bookingId } });
    await transaction.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    });
    await transaction.notification.create({
      data: {
        userId: studentId,
        type: "CANCELLED",
        message: "Your reserved journey has been cancelled.",
      },
    });
    const promoted = await promoteCompatibleWaitlistInTransaction(
      transaction,
      booking.tripId,
      now,
      policy,
    );
    return { tripId: booking.tripId, bookingId, promoted };
  });
}

export async function cancelWaitlistEntryRecord(
  studentId: string,
  entryId: string,
) {
  const updated = await prisma.waitlistEntry.updateMany({
    where: { id: entryId, studentId, status: "WAITING" },
    data: { status: "CANCELLED" },
  });
  if (updated.count !== 1) throw new BookingPersistenceError("BOOKING_NOT_FOUND");
}

export async function listStudentReservationRecords(studentId: string) {
  const [bookings, waitlist] = await Promise.all([
    prisma.booking.findMany({
      where: { studentId },
      include: {
        tripSeat: { select: { seatNumber: true } },
        boardingTripStop: true,
        dropOffTripStop: true,
        trip: {
          include: {
            route: { select: { name: true } },
            bus: { select: { plateNumber: true } },
            driver: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.waitlistEntry.findMany({
      where: { studentId },
      include: {
        boardingTripStop: true,
        dropOffTripStop: true,
        trip: { include: { route: { select: { name: true } } } },
      },
      orderBy: [{ queuedAt: "asc" }, { id: "asc" }],
    }),
  ]);
  return { bookings, waitlist };
}
