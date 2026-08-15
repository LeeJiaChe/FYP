import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";

import {
  createReservedBooking,
  joinJourneyWaitlist,
} from "../../src/features/bookings/application/reservations";
import {
  processNoShowsAtTripStop,
  reconcileNoShows,
  resolvePenaltyAppeal,
  submitPenaltyAppeal,
} from "../../src/features/penalties/application/penalties";
import { isBookingRestricted } from "../../src/features/penalties/domain/credit-policy";
import { scheduleTrip } from "../../src/features/trips/application/schedule-trip";
import { ApplicationError } from "../../src/shared/application/application-error";
import { productPolicy } from "../../src/shared/config/policies";
import { prisma } from "../../src/shared/db/prisma.server";

interface Scenario {
  readonly tripId: string;
  readonly departure: Date;
  readonly stopIds: readonly string[];
  readonly seatIds: readonly string[];
}

const created = {
  tripIds: [] as string[],
  routeIds: [] as string[],
  stopIds: [] as string[],
  busIds: [] as string[],
  userIds: [] as string[],
};

const fixed = (instant: Date) => ({ now: () => new Date(instant) });
const studentActor = (userId: string) => ({ userId, role: "STUDENT" } as const);
const adminActor = (userId: string) => ({ userId, role: "ADMIN" } as const);

async function createUser(
  role: "STUDENT" | "ADMIN",
  label: string,
  creditScore = productPolicy.initialCredit,
) {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      name: `Phase 6 ${label}`,
      email:
        role === "STUDENT"
          ? `${label.toLowerCase().replaceAll(" ", "-")}-${suffix}@student.tarc.edu.my`
          : `${label.toLowerCase().replaceAll(" ", "-")}-${suffix}@admin.test`,
      studentId: role === "STUDENT" ? suffix.slice(0, 8).toUpperCase() : null,
      passwordHash: "integration-only",
      creditScore,
      role,
    },
  });
  created.userIds.push(user.id);
  return user.id;
}

async function createScenario(seatedCapacity = 1): Promise<Scenario> {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const stops = await Promise.all(
    [0, 1, 2].map((position) =>
      prisma.stop.create({
        data: {
          code: `P6_${suffix}_${position}`,
          name: `Phase 6 ${suffix} Stop ${position}`,
          latitude: 3.2 + position / 100,
          longitude: 101.7 + position / 100,
        },
      }),
    ),
  );
  created.stopIds.push(...stops.map((stop) => stop.id));
  const route = await prisma.route.create({
    data: {
      name: `Phase 6 Route ${suffix}`,
      routeStops: {
        create: stops.map((stop, position) => ({
          stopId: stop.id,
          position,
          travelDurationToNextMinutes: position === 2 ? null : 10,
        })),
      },
    },
  });
  created.routeIds.push(route.id);
  const bus = await prisma.bus.create({
    data: {
      plateNumber: `P6-${suffix}`,
      seatedCapacity,
      standingCapacity: 2,
      status: "ACTIVE",
    },
  });
  created.busIds.push(bus.id);
  const departure = new Date(Date.now() + 4 * 60 * 60 * 1_000);
  const trip = await scheduleTrip(
    { userId: randomUUID(), role: "ADMIN" },
    {
      routeId: route.id,
      busId: bus.id,
      driverId: undefined,
      departureTime: departure.toISOString(),
    },
    fixed(new Date(departure.getTime() - 60 * 60 * 1_000)),
  );
  created.tripIds.push(trip.id);
  return {
    tripId: trip.id,
    departure,
    stopIds: trip.tripStops.map((stop) => stop.id),
    seatIds: trip.tripSeats.map((seat) => seat.id),
  };
}

async function reserve(
  studentId: string,
  scenario: Scenario,
  boardingIndex = 0,
  dropOffIndex = 2,
  seatIndex = 0,
) {
  return createReservedBooking(
    studentActor(studentId),
    {
      tripId: scenario.tripId,
      tripSeatId: scenario.seatIds[seatIndex]!,
      boardingTripStopId: scenario.stopIds[boardingIndex]!,
      dropOffTripStopId: scenario.stopIds[dropOffIndex]!,
    },
    fixed(new Date(scenario.departure.getTime() - 60 * 60 * 1_000)),
  );
}

async function markStopDeparted(
  scenario: Scenario,
  stopIndex: number,
  instant = scenario.departure,
) {
  await prisma.tripStop.update({
    where: { id: scenario.stopIds[stopIndex]! },
    data: { actualDeparture: instant, passedAt: instant },
  });
}

async function createNoShowPenalty(
  studentId: string,
  scenario: Scenario,
  creditScore?: number,
) {
  const booking = await reserve(studentId, scenario);
  if (creditScore !== undefined) {
    await prisma.user.update({ where: { id: studentId }, data: { creditScore } });
  }
  await markStopDeparted(scenario, 0);
  await processNoShowsAtTripStop(
    scenario.tripId,
    scenario.stopIds[0]!,
    fixed(scenario.departure),
  );
  const penalty = await prisma.penalty.findUniqueOrThrow({
    where: { bookingId: booking.id },
  });
  return { booking, penalty };
}

after(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: created.userIds } } });
  await prisma.penaltyAppeal.deleteMany({ where: { studentId: { in: created.userIds } } });
  await prisma.penalty.deleteMany({ where: { studentId: { in: created.userIds } } });
  await prisma.standingSegmentClaim.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.walkInJourney.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.walkInIntent.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripStatusHistory.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.reservedSeatSegment.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.waitlistEntry.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.booking.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripSeat.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripSegment.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripStop.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: created.tripIds } } });
  await prisma.routeStop.deleteMany({ where: { routeId: { in: created.routeIds } } });
  await prisma.route.deleteMany({ where: { id: { in: created.routeIds } } });
  await prisma.stop.deleteMany({ where: { id: { in: created.stopIds } } });
  await prisma.bus.deleteMany({ where: { id: { in: created.busIds } } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.$disconnect();
});

describe("Phase 6 PostgreSQL no-show reconciliation", () => {
  it("penalizes an unboarded reservation after its own stop departs", async () => {
    const scenario = await createScenario();
    const studentId = await createUser("STUDENT", "Progress No Show");
    const booking = await reserve(studentId, scenario);
    await markStopDeparted(scenario, 0);

    const result = await processNoShowsAtTripStop(
      scenario.tripId,
      scenario.stopIds[0]!,
      fixed(scenario.departure),
    );

    assert.equal(result.processed.length, 1);
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, "NO_SHOW");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).creditScore, 85);
    assert.equal(await prisma.penalty.count({ where: { bookingId: booking.id } }), 1);
    assert.equal(await prisma.reservedSeatSegment.count({ where: { bookingId: booking.id } }), 0);
  });

  it("does not penalize a boarded reservation or an unboarded walk-in intent", async () => {
    const scenario = await createScenario(2);
    const [reservedStudent, walkInStudent] = await Promise.all([
      createUser("STUDENT", "Boarded Reserved"),
      createUser("STUDENT", "Unboarded Walkin"),
    ]);
    const booking = await reserve(reservedStudent, scenario);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { checkedInAt: scenario.departure, checkInMethod: "MANUAL" },
    });
    await prisma.walkInIntent.create({
      data: {
        studentId: walkInStudent,
        tripId: scenario.tripId,
        boardingTripStopId: scenario.stopIds[0]!,
        dropOffTripStopId: scenario.stopIds[2]!,
        issuedAt: new Date(scenario.departure.getTime() - 10 * 60 * 1_000),
        expiresAt: new Date(scenario.departure.getTime() + 10 * 60 * 1_000),
      },
    });
    await markStopDeparted(scenario, 0);
    const result = await processNoShowsAtTripStop(
      scenario.tripId,
      scenario.stopIds[0]!,
      fixed(scenario.departure),
    );
    assert.equal(result.processed.length, 0);
    assert.equal(await prisma.penalty.count({ where: { studentId: { in: [reservedStudent, walkInStudent] } } }), 0);
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, "CONFIRMED");
  });

  it("is idempotent and concurrency-safe under repeated processing", async () => {
    const scenario = await createScenario();
    const studentId = await createUser("STUDENT", "Concurrent No Show");
    const booking = await reserve(studentId, scenario);
    await markStopDeparted(scenario, 0);

    await Promise.all([
      processNoShowsAtTripStop(scenario.tripId, scenario.stopIds[0]!, fixed(scenario.departure)),
      processNoShowsAtTripStop(scenario.tripId, scenario.stopIds[0]!, fixed(scenario.departure)),
    ]);
    await processNoShowsAtTripStop(
      scenario.tripId,
      scenario.stopIds[0]!,
      fixed(scenario.departure),
    );

    assert.equal(await prisma.penalty.count({ where: { bookingId: booking.id } }), 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).creditScore, 85);
    assert.equal(
      await prisma.notification.count({
        where: {
          userId: studentId,
          deduplicationKey: { startsWith: "penalty-issued:" },
        },
      }),
      1,
    );
  });

  it("clamps credit at zero and PostgreSQL rejects out-of-range scores", async () => {
    const scenario = await createScenario();
    const studentId = await createUser("STUDENT", "Credit Floor");
    const { penalty } = await createNoShowPenalty(studentId, scenario, 5);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).creditScore, 0);
    assert.equal(penalty.creditPointsDeducted, 5);
    await assert.rejects(
      prisma.user.update({ where: { id: studentId }, data: { creditScore: -1 } }),
    );
    await assert.rejects(
      prisma.user.update({ where: { id: studentId }, data: { creditScore: 101 } }),
    );
  });

  it("enforces the 40-allowed and 39-restricted reservation boundary", async () => {
    const scenario = await createScenario(2);
    const [allowed, restricted] = await Promise.all([
      createUser("STUDENT", "Credit Forty", 40),
      createUser("STUDENT", "Credit Thirty Nine", 39),
    ]);
    await reserve(allowed, scenario, 0, 1, 0);
    await assert.rejects(
      reserve(restricted, scenario, 1, 2, 1),
      (error) => error instanceof ApplicationError && error.code === "FORBIDDEN",
    );
    assert.equal(isBookingRestricted(40, productPolicy), false);
    assert.equal(isBookingRestricted(39, productPolicy), true);
  });

  it("releases claims and promotes the oldest compatible future-stop waiter", async () => {
    const scenario = await createScenario();
    const [holder, passedWaiter, futureWaiter] = await Promise.all([
      createUser("STUDENT", "No Show Holder"),
      createUser("STUDENT", "Passed Waiter"),
      createUser("STUDENT", "Future Waiter"),
    ]);
    const booking = await reserve(holder, scenario);
    const older = await joinJourneyWaitlist(
      studentActor(passedWaiter),
      {
        tripId: scenario.tripId,
        boardingTripStopId: scenario.stopIds[0]!,
        dropOffTripStopId: scenario.stopIds[1]!,
      },
      fixed(new Date(scenario.departure.getTime() - 50 * 60 * 1_000)),
    );
    const compatible = await joinJourneyWaitlist(
      studentActor(futureWaiter),
      {
        tripId: scenario.tripId,
        boardingTripStopId: scenario.stopIds[1]!,
        dropOffTripStopId: scenario.stopIds[2]!,
      },
      fixed(new Date(scenario.departure.getTime() - 45 * 60 * 1_000)),
    );
    await markStopDeparted(scenario, 0);
    const result = await processNoShowsAtTripStop(
      scenario.tripId,
      scenario.stopIds[0]!,
      fixed(scenario.departure),
    );
    const [olderAfter, compatibleAfter] = await Promise.all([
      prisma.waitlistEntry.findUniqueOrThrow({ where: { id: older.id } }),
      prisma.waitlistEntry.findUniqueOrThrow({ where: { id: compatible.id } }),
    ]);
    assert.equal(await prisma.reservedSeatSegment.count({ where: { bookingId: booking.id } }), 0);
    assert.equal(olderAfter.status, "WAITING");
    assert.equal(olderAfter.queuedAt.getTime(), older.queuedAt.getTime());
    assert.equal(compatibleAfter.status, "PROMOTED");
    assert.equal(result.promoted.length, 1);
  });

  it("enforces one Penalty per Booking in PostgreSQL", async () => {
    const scenario = await createScenario();
    const studentId = await createUser("STUDENT", "Unique Penalty");
    const { booking } = await createNoShowPenalty(studentId, scenario);
    await assert.rejects(
      prisma.penalty.create({
        data: {
          bookingId: booking.id,
          studentId,
          type: "RESERVED_NO_SHOW",
          creditPointsDeducted: 15,
          reason: "Duplicate",
        },
      }),
    );
  });

  it("reconciliation is repeatable and ignores a delayed stop still boarding", async () => {
    const [progressed, delayed] = await Promise.all([createScenario(), createScenario()]);
    const [firstStudent, delayedStudent] = await Promise.all([
      createUser("STUDENT", "Reconcile Progressed"),
      createUser("STUDENT", "Reconcile Delayed"),
    ]);
    const progressedBooking = await reserve(firstStudent, progressed);
    const delayedBooking = await reserve(delayedStudent, delayed);
    await markStopDeparted(progressed, 0);
    await prisma.trip.update({
      where: { id: delayed.tripId },
      data: { status: "BOARDING", delayMinutes: 30, delayReason: "Traffic" },
    });

    await reconcileNoShows(fixed(progressed.departure));
    await reconcileNoShows(fixed(progressed.departure));

    assert.equal(await prisma.penalty.count({ where: { bookingId: progressedBooking.id } }), 1);
    assert.equal(await prisma.penalty.count({ where: { bookingId: delayedBooking.id } }), 0);
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: delayedBooking.id } })).status, "CONFIRMED");
  });
});

describe("Phase 6 PostgreSQL penalty appeals", () => {
  it("protects ownership and rejects duplicate appeal submission", async () => {
    const scenario = await createScenario();
    const [owner, other] = await Promise.all([
      createUser("STUDENT", "Appeal Owner"),
      createUser("STUDENT", "Appeal Intruder"),
    ]);
    const { penalty } = await createNoShowPenalty(owner, scenario);
    await assert.rejects(
      submitPenaltyAppeal(studentActor(other), penalty.id, {
        reason: "I should not be able to appeal this penalty.",
      }),
      (error) => error instanceof ApplicationError && error.code === "FORBIDDEN",
    );
    const appeal = await submitPenaltyAppeal(studentActor(owner), penalty.id, {
      reason: "The vehicle departed before I could present my pass.",
    });
    assert.equal(appeal.status, "PENDING");
    assert.equal((await prisma.penalty.findUniqueOrThrow({ where: { id: penalty.id } })).status, "APPEALED");
    await assert.rejects(
      submitPenaltyAppeal(studentActor(owner), penalty.id, {
        reason: "This is a duplicate appeal submission attempt.",
      }),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
  });

  it("approves once under concurrency and restores the recorded points", async () => {
    const scenario = await createScenario();
    const [studentId, firstAdmin, secondAdmin] = await Promise.all([
      createUser("STUDENT", "Concurrent Approval"),
      createUser("ADMIN", "First Reviewer"),
      createUser("ADMIN", "Second Reviewer"),
    ]);
    const { penalty } = await createNoShowPenalty(studentId, scenario);
    const appeal = await submitPenaltyAppeal(studentActor(studentId), penalty.id, {
      reason: "There was a documented operational issue at boarding.",
    });
    const results = await Promise.all([
      resolvePenaltyAppeal(adminActor(firstAdmin), appeal.id, { status: "APPROVED", adminComment: "Evidence accepted" }, fixed(scenario.departure)),
      resolvePenaltyAppeal(adminActor(secondAdmin), appeal.id, { status: "APPROVED", adminComment: "Concurrent retry" }, fixed(scenario.departure)),
    ]);
    assert.equal(results.filter((result) => result.outcome === "RESOLVED").length, 1);
    assert.equal(results.filter((result) => result.outcome === "ALREADY_RESOLVED").length, 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).creditScore, 100);
    assert.equal((await prisma.penalty.findUniqueOrThrow({ where: { id: penalty.id } })).status, "OVERTURNED");
    assert.equal(await prisma.notification.count({ where: { deduplicationKey: `appeal-resolved:${appeal.id}` } }), 1);
  });

  it("caps approved restoration at 100", async () => {
    const scenario = await createScenario();
    const [studentId, adminId] = await Promise.all([
      createUser("STUDENT", "Appeal Credit Cap"),
      createUser("ADMIN", "Cap Reviewer"),
    ]);
    const { penalty } = await createNoShowPenalty(studentId, scenario);
    await prisma.user.update({ where: { id: studentId }, data: { creditScore: 95 } });
    const appeal = await submitPenaltyAppeal(studentActor(studentId), penalty.id, {
      reason: "Please review the supporting operational evidence.",
    });
    await resolvePenaltyAppeal(
      adminActor(adminId),
      appeal.id,
      { status: "APPROVED", adminComment: "Approved with cap" },
      fixed(scenario.departure),
    );
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).creditScore, 100);
  });

  it("rejects an appeal without restoring credit", async () => {
    const scenario = await createScenario();
    const [studentId, adminId] = await Promise.all([
      createUser("STUDENT", "Rejected Appeal"),
      createUser("ADMIN", "Reject Reviewer"),
    ]);
    const { penalty } = await createNoShowPenalty(studentId, scenario);
    const appeal = await submitPenaltyAppeal(studentActor(studentId), penalty.id, {
      reason: "I would like this reservation penalty reviewed.",
    });
    const result = await resolvePenaltyAppeal(
      adminActor(adminId),
      appeal.id,
      { status: "REJECTED", adminComment: "Progress records confirm departure" },
      fixed(scenario.departure),
    );
    assert.equal(result.outcome, "RESOLVED");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: studentId } })).creditScore, 85);
    assert.equal((await prisma.penalty.findUniqueOrThrow({ where: { id: penalty.id } })).status, "UPHELD");
    assert.equal((await prisma.penaltyAppeal.findUniqueOrThrow({ where: { id: appeal.id } })).status, "REJECTED");
  });
});
