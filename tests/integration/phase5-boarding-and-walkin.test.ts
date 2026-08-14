import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";

import {
  boardManually,
  boardWithPass,
  confirmAlighting,
  getDriverManifest,
  issueAlightingPass,
  issueReservedBoardingPass,
  progressTrip,
} from "../../src/features/boarding/application/boarding";
import { issueSignedPass } from "../../src/features/boarding/infrastructure/pass-token.server";
import { createReservedBooking } from "../../src/features/bookings/application/reservations";
import { scheduleTrip } from "../../src/features/trips/application/schedule-trip";
import {
  createWalkInIntent,
  issueWalkInPass,
} from "../../src/features/walk-ins/application/walk-ins";
import { ApplicationError } from "../../src/shared/application/application-error";
import { prisma } from "../../src/shared/db/prisma.server";

interface Scenario {
  tripId: string;
  departure: Date;
  driverId: string;
  stopIds: readonly string[];
  segmentIds: readonly string[];
  seatIds: readonly string[];
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
const driverActor = (userId: string) => ({ userId, role: "DRIVER" } as const);

async function createUser(role: "STUDENT" | "DRIVER", label: string) {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      name: `Phase 5 ${label}`,
      email:
        role === "STUDENT"
          ? `${label.toLowerCase().replaceAll(" ", "-")}-${suffix}@student.tarc.edu.my`
          : `${label.toLowerCase().replaceAll(" ", "-")}-${suffix}@driver.test`,
      studentId: role === "STUDENT" ? suffix.slice(0, 8).toUpperCase() : null,
      passwordHash: "integration-only",
      role,
    },
  });
  created.userIds.push(user.id);
  return user.id;
}

async function createScenario(standingCapacity = 1): Promise<Scenario> {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const driverId = await createUser("DRIVER", `Driver ${suffix}`);
  const stops = await Promise.all(
    [0, 1, 2].map((position) =>
      prisma.stop.create({
        data: {
          code: `P5_${suffix}_${position}`,
          name: `Phase 5 ${suffix} Stop ${position}`,
          latitude: 3.2 + position / 100,
          longitude: 101.7 + position / 100,
        },
      }),
    ),
  );
  created.stopIds.push(...stops.map((stop) => stop.id));
  const route = await prisma.route.create({
    data: {
      name: `Phase 5 Route ${suffix}`,
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
      plateNumber: `P5-${suffix}`,
      seatedCapacity: 2,
      standingCapacity,
      status: "ACTIVE",
    },
  });
  created.busIds.push(bus.id);
  const departure = new Date(Date.now() + 10 * 60 * 1_000);
  const trip = await scheduleTrip(
    { userId: randomUUID(), role: "ADMIN" },
    {
      routeId: route.id,
      busId: bus.id,
      driverId,
      departureTime: departure.toISOString(),
    },
    fixed(new Date(departure.getTime() - 60 * 60 * 1_000)),
  );
  created.tripIds.push(trip.id);
  return {
    tripId: trip.id,
    departure,
    driverId,
    stopIds: trip.tripStops.map((stop) => stop.id),
    segmentIds: trip.tripSegments.map((segment) => segment.id),
    seatIds: trip.tripSeats.map((seat) => seat.id),
  };
}

async function reserve(studentId: string, scenario: Scenario, dropOffIndex = 2) {
  return createReservedBooking(
    studentActor(studentId),
    {
      tripId: scenario.tripId,
      tripSeatId: scenario.seatIds[0]!,
      boardingTripStopId: scenario.stopIds[0]!,
      dropOffTripStopId: scenario.stopIds[dropOffIndex]!,
    },
    fixed(new Date(scenario.departure.getTime() - 60 * 60 * 1_000)),
  );
}

async function createIntent(
  studentId: string,
  scenario: Scenario,
  boardingIndex = 0,
  dropOffIndex = 2,
) {
  return createWalkInIntent(
    studentActor(studentId),
    {
      tripId: scenario.tripId,
      boardingTripStopId: scenario.stopIds[boardingIndex]!,
      dropOffTripStopId: scenario.stopIds[dropOffIndex]!,
    },
    fixed(new Date(scenario.departure.getTime() - 60 * 60 * 1_000)),
  );
}

async function startBoarding(scenario: Scenario) {
  const now = new Date(scenario.departure.getTime() - 5 * 60 * 1_000);
  await progressTrip(
    driverActor(scenario.driverId),
    scenario.tripId,
    { action: "START_BOARDING" },
    fixed(now),
  );
  return now;
}

async function boardIntent(studentId: string, scenario: Scenario, intentId: string, now: Date) {
  const pass = await issueWalkInPass(
    studentActor(studentId),
    intentId,
    fixed(now),
  );
  return boardWithPass(
    driverActor(scenario.driverId),
    scenario.tripId,
    pass.token,
    fixed(now),
  );
}

function requireWalkInBoarded(
  result: Awaited<ReturnType<typeof boardWithPass>>,
) {
  if (result.outcome !== "BOARDED" || !("walkInJourneyId" in result)) {
    throw new Error(`Expected walk-in boarding, received ${result.outcome}`);
  }
  return result;
}

after(async () => {
  await prisma.deviceStatusLog.deleteMany({ where: { seat: { tripId: { in: created.tripIds } } } });
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
  await prisma.seat.deleteMany({ where: { tripId: { in: created.tripIds } } });
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

describe("Phase 5 PostgreSQL walk-in capacity and pass issuance", () => {
  it("issues an intent/pass with zero standing claims", async () => {
    const scenario = await createScenario();
    const student = await createUser("STUDENT", "Intent Zero Claims");
    const intent = await createIntent(student, scenario);
    const pass = await issueWalkInPass(studentActor(student), intent.id, fixed(scenario.departure));
    assert.ok(pass.token);
    assert.equal(await prisma.walkInJourney.count({ where: { walkInIntentId: intent.id } }), 0);
    assert.equal(await prisma.standingSegmentClaim.count({ where: { tripId: scenario.tripId } }), 0);
  });

  it("admits a valid complete journey and duplicate scan is idempotent", async () => {
    const scenario = await createScenario(2);
    const student = await createUser("STUDENT", "Walkin Complete");
    const intent = await createIntent(student, scenario);
    const now = await startBoarding(scenario);
    const pass = await issueWalkInPass(studentActor(student), intent.id, fixed(now));
    const first = await boardWithPass(
      driverActor(scenario.driverId),
      scenario.tripId,
      pass.token,
      fixed(now),
    );
    const second = await boardWithPass(
      driverActor(scenario.driverId),
      scenario.tripId,
      pass.token,
      fixed(now),
    );
    assert.equal(first.outcome, "BOARDED");
    assert.equal(second.outcome, "ALREADY_BOARDED");
    assert.equal(await prisma.walkInJourney.count({ where: { walkInIntentId: intent.id } }), 1);
    assert.equal(await prisma.standingSegmentClaim.count({ where: { tripId: scenario.tripId } }), 2);
  });

  it("is segment-aware: full A-B does not make B-C full", async () => {
    const scenario = await createScenario(1);
    const [firstStudent, secondStudent] = await Promise.all([
      createUser("STUDENT", "Standing AB"),
      createUser("STUDENT", "Standing BC"),
    ]);
    const [first, second] = await Promise.all([
      createIntent(firstStudent, scenario, 0, 1),
      createIntent(secondStudent, scenario, 1, 2),
    ]);
    const originTime = await startBoarding(scenario);
    assert.equal((await boardIntent(firstStudent, scenario, first.id, originTime)).outcome, "BOARDED");
    await progressTrip(driverActor(scenario.driverId), scenario.tripId, { action: "DEPART_CURRENT_STOP" }, fixed(scenario.departure));
    const atB = new Date(scenario.departure.getTime() + 10 * 60 * 1_000);
    await progressTrip(driverActor(scenario.driverId), scenario.tripId, { action: "ARRIVE_NEXT_STOP" }, fixed(atB));
    assert.equal((await boardIntent(secondStudent, scenario, second.id, atB)).outcome, "BOARDED");
    assert.equal(await prisma.standingSegmentClaim.count({ where: { tripId: scenario.tripId } }), 2);
  });

  it("rejects A-C when either requested segment is full without partial claims", async () => {
    const scenario = await createScenario(1);
    const [holder, requesting] = await Promise.all([
      createUser("STUDENT", "Full Segment Holder"),
      createUser("STUDENT", "Full Segment Request"),
    ]);
    const held = await createIntent(holder, scenario, 0, 1);
    const requested = await createIntent(requesting, scenario, 0, 2);
    const now = await startBoarding(scenario);
    await boardIntent(holder, scenario, held.id, now);
    const result = await boardIntent(requesting, scenario, requested.id, now);
    assert.equal(result.outcome, "FULL");
    assert.equal(await prisma.walkInJourney.count({ where: { walkInIntentId: requested.id } }), 0);
    assert.equal(
      await prisma.standingSegmentClaim.count({ where: { walkInJourney: { walkInIntentId: requested.id } } }),
      0,
    );
  });

  it("serializes concurrent scans for the final standing place", async () => {
    const scenario = await createScenario(1);
    const [firstStudent, secondStudent] = await Promise.all([
      createUser("STUDENT", "Concurrent Standing One"),
      createUser("STUDENT", "Concurrent Standing Two"),
    ]);
    const [first, second] = await Promise.all([
      createIntent(firstStudent, scenario),
      createIntent(secondStudent, scenario),
    ]);
    const now = await startBoarding(scenario);
    const results = await Promise.all([
      boardIntent(firstStudent, scenario, first.id, now),
      boardIntent(secondStudent, scenario, second.id, now),
    ]);
    assert.deepEqual(results.map((result) => result.outcome).sort(), ["BOARDED", "FULL"]);
    assert.equal(await prisma.walkInJourney.count({ where: { tripId: scenario.tripId } }), 1);
    for (const segmentId of scenario.segmentIds) {
      assert.equal(
        await prisma.standingSegmentClaim.count({ where: { tripId: scenario.tripId, tripSegmentId: segmentId } }),
        1,
      );
    }
  });
});

describe("Phase 5 boarding authorization and signed purpose", () => {
  it("rejects wrong-Trip scans and an unassigned driver", async () => {
    const [firstTrip, secondTrip] = await Promise.all([createScenario(), createScenario()]);
    const student = await createUser("STUDENT", "Wrong Trip Walkin");
    const intent = await createIntent(student, firstTrip);
    const now = await startBoarding(firstTrip);
    const pass = await issueWalkInPass(studentActor(student), intent.id, fixed(now));
    await assert.rejects(
      boardWithPass(driverActor(secondTrip.driverId), secondTrip.tripId, pass.token, fixed(now)),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
    await assert.rejects(
      boardWithPass(driverActor(secondTrip.driverId), firstTrip.tripId, pass.token, fixed(now)),
      (error) => error instanceof ApplicationError && error.code === "FORBIDDEN",
    );
  });

  it("boards reserved QR only for the correct durable Trip and makes duplicate manual boarding idempotent", async () => {
    const scenario = await createScenario();
    const other = await createScenario();
    const student = await createUser("STUDENT", "Reserved QR");
    const booking = await reserve(student, scenario);
    const claimsBefore = await prisma.reservedSeatSegment.count({ where: { bookingId: booking.id } });
    const now = await startBoarding(scenario);
    const pass = await issueReservedBoardingPass(studentActor(student), booking.id, fixed(now));
    await assert.rejects(
      boardWithPass(driverActor(other.driverId), other.tripId, pass.token, fixed(now)),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
    const scanned = await boardWithPass(driverActor(scenario.driverId), scenario.tripId, pass.token, fixed(now));
    const manual = await boardManually(
      driverActor(scenario.driverId),
      scenario.tripId,
      { kind: "RESERVED", bookingId: booking.id },
      fixed(now),
    );
    assert.equal(scanned.outcome, "BOARDED");
    assert.equal(manual.outcome, "ALREADY_BOARDED");
    assert.equal(await prisma.reservedSeatSegment.count({ where: { bookingId: booking.id } }), claimsBefore);
    const manifest = await getDriverManifest(
      driverActor(scenario.driverId),
      scenario.tripId,
    );
    assert.equal(manifest.manifest.length, 1);
    assert.deepEqual(Object.keys(manifest.manifest[0]!).sort(), [
      "alighted",
      "boarded",
      "boardingStop",
      "dropOffStop",
      "expectedToAlightHere",
      "kind",
      "passengerName",
      "recordId",
      "seatNumber",
      "studentId",
    ]);
  });

  it("rejects expired, wrong-purpose, and token-record identity claims", async () => {
    const scenario = await createScenario();
    const [student, otherStudent] = await Promise.all([
      createUser("STUDENT", "Token Owner"),
      createUser("STUDENT", "Token Other"),
    ]);
    const booking = await reserve(student, scenario);
    const now = await startBoarding(scenario);
    const expired = await issueSignedPass(
      { purpose: "RESERVED_BOARDING", journeyKind: "RESERVED", recordId: booking.id, studentId: student, tripId: scenario.tripId },
      fixed(new Date(now.getTime() - 2 * 60 * 1_000)),
    );
    await assert.rejects(
      boardWithPass(driverActor(scenario.driverId), scenario.tripId, expired.token, fixed(now)),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
    const wrongPurpose = await issueSignedPass(
      { purpose: "ALIGHTING", journeyKind: "RESERVED", recordId: booking.id, studentId: student, tripId: scenario.tripId },
      fixed(now),
    );
    await assert.rejects(
      boardWithPass(driverActor(scenario.driverId), scenario.tripId, wrongPurpose.token, fixed(now)),
      (error) => error instanceof ApplicationError && error.code === "VALIDATION",
    );
    const wrongStudent = await issueSignedPass(
      { purpose: "RESERVED_BOARDING", journeyKind: "RESERVED", recordId: booking.id, studentId: otherStudent, tripId: scenario.tripId },
      fixed(now),
    );
    await assert.rejects(
      boardWithPass(driverActor(scenario.driverId), scenario.tripId, wrongStudent.token, fixed(now)),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
  });
});

describe("Phase 5 alighting and Trip progress", () => {
  it("records reserved Exit QR and manual walk-in alighting without changing planned claims", async () => {
    const scenario = await createScenario(2);
    const [reservedStudent, walkInStudent] = await Promise.all([
      createUser("STUDENT", "Exit Reserved"),
      createUser("STUDENT", "Exit Walkin"),
    ]);
    const booking = await reserve(reservedStudent, scenario, 1);
    const intent = await createIntent(walkInStudent, scenario, 0, 1);
    const now = await startBoarding(scenario);
    const reservedPass = await issueReservedBoardingPass(studentActor(reservedStudent), booking.id, fixed(now));
    await boardWithPass(driverActor(scenario.driverId), scenario.tripId, reservedPass.token, fixed(now));
    const admitted = requireWalkInBoarded(
      await boardIntent(walkInStudent, scenario, intent.id, now),
    );
    const reservedClaims = await prisma.reservedSeatSegment.count({ where: { bookingId: booking.id } });
    const standingClaims = await prisma.standingSegmentClaim.count({ where: { walkInJourneyId: admitted.walkInJourneyId } });

    await progressTrip(driverActor(scenario.driverId), scenario.tripId, { action: "DEPART_CURRENT_STOP" }, fixed(scenario.departure));
    const atB = new Date(scenario.departure.getTime() + 10 * 60 * 1_000);
    await progressTrip(driverActor(scenario.driverId), scenario.tripId, { action: "ARRIVE_NEXT_STOP" }, fixed(atB));
    const exitPass = await issueAlightingPass(
      studentActor(reservedStudent),
      { kind: "RESERVED", recordId: booking.id },
      fixed(atB),
    );
    await confirmAlighting(
      driverActor(scenario.driverId),
      scenario.tripId,
      { mode: "QR", token: exitPass.token },
      fixed(atB),
    );
    await confirmAlighting(
      driverActor(scenario.driverId),
      scenario.tripId,
      { mode: "MANUAL", kind: "WALK_IN", recordId: admitted.walkInJourneyId! },
      fixed(atB),
    );
    const [completedBooking, completedWalkIn] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }),
      prisma.walkInJourney.findUniqueOrThrow({ where: { id: admitted.walkInJourneyId! } }),
    ]);
    assert.equal(completedBooking.alightingMethod, "QR");
    assert.equal(completedWalkIn.alightingMethod, "MANUAL");
    assert.equal(await prisma.reservedSeatSegment.count({ where: { bookingId: booking.id } }), reservedClaims);
    assert.equal(await prisma.standingSegmentClaim.count({ where: { walkInJourneyId: admitted.walkInJourneyId } }), standingClaims);
  });

  it("auto-completes boarded passengers when their planned drop-off leaves", async () => {
    const scenario = await createScenario(2);
    const [reservedStudent, walkInStudent] = await Promise.all([
      createUser("STUDENT", "Auto Reserved"),
      createUser("STUDENT", "Auto Walkin"),
    ]);
    const booking = await reserve(reservedStudent, scenario, 1);
    const intent = await createIntent(walkInStudent, scenario, 0, 1);
    const start = await startBoarding(scenario);
    await boardManually(driverActor(scenario.driverId), scenario.tripId, { kind: "RESERVED", bookingId: booking.id }, fixed(start));
    const admitted = requireWalkInBoarded(
      await boardIntent(walkInStudent, scenario, intent.id, start),
    );
    await progressTrip(driverActor(scenario.driverId), scenario.tripId, { action: "DEPART_CURRENT_STOP" }, fixed(scenario.departure));
    const atB = new Date(scenario.departure.getTime() + 10 * 60 * 1_000);
    await progressTrip(driverActor(scenario.driverId), scenario.tripId, { action: "ARRIVE_NEXT_STOP" }, fixed(atB));
    const result = await progressTrip(driverActor(scenario.driverId), scenario.tripId, { action: "DEPART_CURRENT_STOP" }, fixed(new Date(atB.getTime() + 60_000)));
    assert.deepEqual(result.autoAlighted, { reserved: 1, walkIn: 1 });
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).alightingMethod, "AUTO_PLANNED_STOP");
    assert.equal((await prisma.walkInJourney.findUniqueOrThrow({ where: { id: admitted.walkInJourneyId! } })).alightingMethod, "AUTO_PLANNED_STOP");
  });

  it("rejects boarding after the planned boarding stop has departed", async () => {
    const scenario = await createScenario();
    const student = await createUser("STUDENT", "Passed Boarding");
    const booking = await reserve(student, scenario);
    const start = await startBoarding(scenario);
    await progressTrip(driverActor(scenario.driverId), scenario.tripId, { action: "DEPART_CURRENT_STOP" }, fixed(scenario.departure));
    await assert.rejects(
      boardManually(driverActor(scenario.driverId), scenario.tripId, { kind: "RESERVED", bookingId: booking.id }, fixed(new Date(start.getTime() + 60_000))),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
  });

  it("rejects illegal transitions and cannot reverse ARRIVED or CANCELLED", async () => {
    const arrived = await createScenario();
    await assert.rejects(
      progressTrip(driverActor(arrived.driverId), arrived.tripId, { action: "ARRIVE_NEXT_STOP" }, fixed(arrived.departure)),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
    await startBoarding(arrived);
    await progressTrip(driverActor(arrived.driverId), arrived.tripId, { action: "DEPART_CURRENT_STOP" }, fixed(arrived.departure));
    for (let position = 1; position <= 2; position += 1) {
      const time = new Date(arrived.departure.getTime() + position * 10 * 60 * 1_000);
      await progressTrip(driverActor(arrived.driverId), arrived.tripId, { action: "ARRIVE_NEXT_STOP" }, fixed(time));
      await progressTrip(driverActor(arrived.driverId), arrived.tripId, { action: "DEPART_CURRENT_STOP" }, fixed(new Date(time.getTime() + 1_000)));
    }
    await assert.rejects(
      progressTrip(driverActor(arrived.driverId), arrived.tripId, { action: "CANCEL", reason: "Too late" }, fixed(new Date(arrived.departure.getTime() + 30 * 60 * 1_000))),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );

    const cancelled = await createScenario();
    await progressTrip(driverActor(cancelled.driverId), cancelled.tripId, { action: "CANCEL", reason: "Vehicle unavailable" }, fixed(cancelled.departure));
    await assert.rejects(
      progressTrip(driverActor(cancelled.driverId), cancelled.tripId, { action: "START_BOARDING" }, fixed(cancelled.departure)),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
  });
});
