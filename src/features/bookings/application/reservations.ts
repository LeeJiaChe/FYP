import type {
  CreateReservedBookingInput,
  JoinWaitlistInput,
  JourneySelection,
} from "../contracts/booking.schemas";
import {
  BookingPersistenceError,
  cancelReservedBookingRecord,
  cancelWaitlistEntryRecord,
  createReservedBookingRecord,
  findJourneyAvailabilityRecord,
  joinWaitlistRecord,
  listStudentReservationRecords,
} from "../infrastructure/booking.prisma.server";
import {
  conflict,
  forbidden,
  invariantViolation,
  notFound,
  validationError,
} from "@/shared/application/application-error";
import { productPolicy, type ProductPolicy } from "@/shared/config/policies";
import { systemClock, type Clock } from "@/shared/time/clock";
import { isWalkInIssuanceEligible } from "@/features/boarding/public";
import { resolveStudentBookingEligibility } from "../domain/reservation-policy";

export interface BookingActor {
  readonly userId: string;
  readonly role: string;
}

function requireStudent(actor: BookingActor): void {
  if (actor.role !== "STUDENT") throw forbidden("Student role required");
}

function mapPersistenceFailure(error: BookingPersistenceError): never {
  switch (error.code) {
    case "STUDENT_NOT_FOUND":
      throw forbidden("Active student account required");
    case "TRIP_NOT_FOUND":
      throw notFound("Trip not found");
    case "BOOKING_NOT_FOUND":
      throw notFound("Reservation not found");
    case "INVALID_JOURNEY":
      throw validationError("Boarding and drop-off must form an ordered Trip journey");
    case "SEAT_NOT_ON_TRIP":
      throw validationError("Selected seat does not belong to this Trip");
    case "RESTRICTED":
      throw forbidden("Reserved booking is restricted for this student account");
    case "NOT_BOOKABLE":
      throw conflict("Trip is not open for reserved booking");
    case "TOO_EARLY":
      throw conflict("The reserved booking window has not opened yet");
    case "TOO_LATE":
      throw conflict("Reservations have closed because boarding has started at this stop");
    case "SEAT_UNAVAILABLE":
    case "ALLOCATION_CONFLICT":
      throw conflict("Selected seat is no longer available for the complete journey");
    case "ACTIVE_BOOKING_EXISTS":
      throw conflict("Student already has an active reserved Booking for this Trip");
    case "WAITLIST_EXISTS":
      throw conflict("Student is already waiting for this Trip journey");
    case "SEATS_AVAILABLE":
      throw conflict("A seat is available for this journey; reserve a seat instead");
    case "BOOKING_NOT_CANCELLABLE":
      throw conflict("Reservation is not cancellable in its current state");
    case "CANCELLATION_CUTOFF":
      throw conflict("This reservation can no longer be cancelled because boarding has started at your boarding stop");
    case "ALLOCATION_INCOMPLETE":
      throw invariantViolation("The complete journey allocation could not be created");
  }
}

async function translate<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof BookingPersistenceError) mapPersistenceFailure(error);
    throw error;
  }
}

export async function findJourneyAvailability(
  actor: BookingActor,
  selection: JourneySelection,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  requireStudent(actor);
  const result = await translate(() =>
    findJourneyAvailabilityRecord(actor.userId, selection, clock.now(), policy),
  );
  return {
    tripId: result.tripId,
    journey: {
      boardingTripStopId: result.boardingTripStop.id,
      boardingStopName: result.boardingTripStop.stopName,
      boardingPlannedDeparture: result.boardingTripStop.plannedDeparture,
      dropOffTripStopId: result.dropOffTripStop.id,
      dropOffStopName: result.dropOffTripStop.stopName,
    },
    seats: result.seats,
    hasAvailableSeat: result.seats.length > 0,
    bookingEligibility: resolveStudentBookingEligibility(
      {
        tripStatus: result.tripStatus,
        boardingPlannedDeparture: result.boardingTripStop.plannedDeparture,
        boardingActualArrival: result.boardingTripStop.actualArrival,
        boardingActualDeparture: result.boardingTripStop.actualDeparture,
        boardingPassedAt: result.boardingTripStop.passedAt,
        studentCredit: result.studentCredit,
        now: clock.now(),
      },
      policy,
      {
        hasAvailableSeat: result.seats.length > 0,
        canCreateWalkInIntent: isWalkInIssuanceEligible(
          clock.now(),
          result.tripStatus,
          result.boardingTripStop,
          policy,
        ),
      },
    ),
  };
}

export async function createReservedBooking(
  actor: BookingActor,
  input: CreateReservedBookingInput,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  requireStudent(actor);
  const booking = await translate(() =>
    createReservedBookingRecord(actor.userId, input, clock.now(), policy),
  );
  return {
    id: booking.id,
    status: booking.status,
    tripId: booking.tripId,
    tripSeatId: booking.tripSeatId,
    seatNumber: booking.tripSeat.seatNumber,
    boardingTripStopId: booking.boardingTripStopId,
    dropOffTripStopId: booking.dropOffTripStopId,
  };
}

export async function joinJourneyWaitlist(
  actor: BookingActor,
  input: JoinWaitlistInput,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  requireStudent(actor);
  const entry = await translate(() =>
    joinWaitlistRecord(actor.userId, input, clock.now(), policy),
  );
  return {
    id: entry.id,
    tripId: entry.tripId,
    boardingTripStopId: entry.boardingTripStopId,
    dropOffTripStopId: entry.dropOffTripStopId,
    status: entry.status,
    queuedAt: entry.queuedAt,
  };
}

export async function cancelReservedBooking(
  actor: BookingActor,
  bookingId: string,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  requireStudent(actor);
  return translate(() =>
    cancelReservedBookingRecord(
      actor.userId,
      bookingId,
      clock.now(),
      policy,
    ),
  );
}

export async function cancelJourneyWaitlistEntry(
  actor: BookingActor,
  entryId: string,
) {
  requireStudent(actor);
  await translate(() => cancelWaitlistEntryRecord(actor.userId, entryId));
  return { id: entryId, status: "CANCELLED" as const };
}

export async function listMyReservations(actor: BookingActor) {
  requireStudent(actor);
  const records = await listStudentReservationRecords(actor.userId);
  return {
    bookings: records.bookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
      tripSeatId: booking.tripSeatId,
      seatNumber: booking.tripSeat.seatNumber,
      boardingTripStopId: booking.boardingTripStopId,
      boardingStopName: booking.boardingTripStop.stopName,
      dropOffTripStopId: booking.dropOffTripStopId,
      dropOffStopName: booking.dropOffTripStop.stopName,
      checkedInAt: booking.checkedInAt,
      checkInMethod: booking.checkInMethod,
      actualAlightedAt: booking.actualAlightedAt,
      alightingMethod: booking.alightingMethod,
      createdAt: booking.createdAt,
      trip: {
        id: booking.trip.id,
        routeName: booking.trip.route.name,
        busPlateNumber: booking.trip.bus.plateNumber,
        driverName: booking.trip.driver?.name ?? "Unassigned",
        departureTime: booking.boardingTripStop.plannedDeparture,
        originDepartureTime: booking.trip.departureTime,
        estimatedArrivalTime: booking.trip.estimatedArrivalTime,
        boardingDeadline: booking.boardingTripStop.boardingDeadline,
        status: booking.trip.status,
      },
    })),
    waitlist: records.waitlist.map((entry) => ({
      id: entry.id,
      status: entry.status,
      queuedAt: entry.queuedAt,
      boardingTripStopId: entry.boardingTripStopId,
      boardingStopName: entry.boardingTripStop.stopName,
      dropOffTripStopId: entry.dropOffTripStopId,
      dropOffStopName: entry.dropOffTripStop.stopName,
      promotedBookingId: entry.promotedBookingId,
      trip: {
        id: entry.trip.id,
        routeName: entry.trip.route.name,
        departureTime: entry.boardingTripStop.plannedDeparture,
        status: entry.trip.status,
      },
    })),
  };
}
