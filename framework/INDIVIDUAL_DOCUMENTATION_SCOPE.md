# Individual Documentation Scope

**Status:** Canonical academic/documentation scope source of truth  
**Date:** 2026-08-22  
**Project:** TAR UMT Kuala Lumpur Campus Shuttle Management System  
**Repository:** `LeeJiaChe/FYP`

## 1. Purpose and authority

This document defines the stable functional boundary for the two individual FYP reports. It does not divide the delivered product, repository, database, deployment, or portals. The project remains one responsive web application with one codebase, one PostgreSQL database, and integrated Student, Driver, and Admin portals.

`framework/APP_SPECIFICATION.md` remains authoritative for the complete product and its business rules. `framework/ARCHITECTURE.md` remains authoritative for technical structure and dependencies. This document is authoritative only for individual academic/documentation scope. Academic report boundaries and source-code feature folders do not need to be identical.

Shared entities and interfaces may appear in both reports where needed to explain integration. Each report explains implementation detail within its own functional scope and normally treats the other module as an integration dependency. Use wording such as **“this individual report focuses on…”**. Do not assert that an individual solely implemented or coded a component unless separately supported by truthful contribution evidence.

## 2. Lee Jia Che module

### Canonical title

**TAR UMT Kuala Lumpur Campus Shuttle Management System: Passenger Reservation and Boarding Management Module**

### Primary documentation scope

- Student/passenger identity required for passenger flows: registration and login behavior, TAR UMT student-domain normalization and validation, and passenger authorization.
- Journey search: From, To, Date, Departure, and journey-specific availability.
- Reserved booking: numbered reserved seats, TripSeat consumption, boarding/drop-off TripStop selection, journey-segment derivation, ReservedSeatSegment allocation, one-seat full-journey consistency, non-overlapping reuse, overlap prevention, booking history, and cancellation.
- Waitlist: WaitlistEntry, journey-specific waiting and cancellation, oldest-compatible-first FIFO, retained priority for skipped incompatible entries, and promotion.
- Walk-in passenger management: WalkInIntent, non-guaranteed Walk-in Pass issuance, zero capacity consumption at issuance, standing admission, WalkInJourney, StandingSegmentClaim, concurrency-safe segment capacity, and the Reserved-versus-Walk-in distinction.
- Passenger boarding and alighting: short-lived Reserved/Walk-in QR pass contracts, verification, manual boarding fallback, check-in, passenger aspects of the manifest, expected boarding/alighting, and alighting evidence.
- Passenger no-show and consequences: operational boarding-stop evidence, claim release, credit score, Penalty, PenaltyAppeal, restriction threshold, appeal submission/resolution, and related passenger notifications.
- Passenger-focused analytics: reservation demand, waitlist activity, walk-in admission, reserved outcomes, no-show rate, penalty/appeal statistics, and passenger-oriented capacity utilization where relevant.

Lee may refer to Stop/Route administration, Bus lifecycle, Driver account administration, Trip scheduling, Trip lifecycle/progress implementation, GPS telemetry, realtime location, and fleet monitoring to explain integration. These are not Lee's primary individual documentation scope and must not be presented as Lee-exclusive implementation ownership.

Recommended integration wording:

> The Passenger Reservation and Boarding Management Module consumes scheduled Trip, TripStop, capacity and operational-progress information supplied by the shared Fleet Operations and Live Tracking Module.

## 3. Wong Yun Hong module

### Canonical title

**TAR UMT Kuala Lumpur Campus Shuttle Management System: Fleet Operations and Live Tracking Module**

### Primary documentation scope

- Stop and route topology: Stop, directional Route, ordered RouteStop, travel durations, active/deactivated topology, and historical topology integrity.
- Bus/fleet management: Bus, seatedCapacity, standingCapacity, ACTIVE, MAINTENANCE, RETIRED, and per-Trip capacity snapshots.
- Driver administration and assignment: operational driver accounts, server-side role verification, assignment, and driver scheduling conflicts.
- Trip scheduling and inventory: Trip creation, immutable TripStop and TripSegment snapshots, TripSeat inventory, topology/capacity history, bus and driver conflicts, and safe rescheduling.
- Trip operations: NOT_STARTED, BOARDING, DEPARTED, ARRIVED, CANCELLED, TripStatusHistory, stop progression, actualArrival, actualDeparture, passedAt, delay metadata, cancellation, and future-Trip effects of Bus maintenance/retirement.
- GPS and live tracking: TripLocationSample, LocationSource, simulated GPS adapter, authenticated ingestion, source-neutral future GPS boundary, seven-day retention, and student-facing location data as an integration output.
- Realtime infrastructure: authenticated Trip subscription scope, Socket.io invalidation events such as `location.changed` and `trip.changed`, the standalone realtime process, and trusted-service operational scheduling.
- Fleet/operational monitoring and analytics: Trip monitoring, fleet utilization, seated/standing operational utilization, location freshness, and route/Trip operational statistics.

Wong may refer to passenger reservations, ReservedSeatSegment, waitlist, WalkInIntent/WalkInJourney, passenger passes, boarding, no-show, credit, penalties, and appeals to explain integration. Their algorithms and business processes are not Wong's primary individual documentation scope and must not be presented as Wong-exclusive implementation ownership.

Recommended integration wording:

> The Fleet Operations and Live Tracking Module provides scheduled Trip, stop, capacity and operational-progress information used by the shared Passenger Reservation and Boarding Management Module.

## 4. Shared entities and interfaces

| Shared concept | Wong documentation perspective | Lee documentation perspective |
|---|---|---|
| User | Driver/admin operational identity | Student/passenger identity |
| Trip | Creates, schedules, assigns and operates it | Consumes it as passenger journey context |
| TripStop | Creates immutable snapshots and records progress | Selects boarding/drop-off and uses progress as policy evidence |
| TripSegment | Creates immutable adjacent topology | Uses segments for reserved and standing journey capacity |
| TripSeat | Creates inventory during Trip scheduling | Allocates inventory to reserved journeys |
| Bus capacity | Defines and snapshots seated/standing capacity | Consumes snapshots for passenger capacity decisions |
| Driver portal | Assigned Trip and operational progress | Manifest, QR/manual boarding, passenger boarding/alighting |
| Admin portal | Stops, Routes, Buses, Drivers, Trips, monitoring, fleet/location analytics | Penalties, appeals, and passenger-focused analytics |

A shared page does not assign every function on that page to one report. Diagrams may show both sides of an integration, but detailed explanation should remain proportional to the report's module.

## 5. Superseded Wong IoT scope

The following concepts are permanently superseded and outside the final product and Wong report scope:

- ESP32;
- IoT or physical seat-occupancy sensors;
- LED seat indicators;
- DeviceStatusLog and DeviceSignal;
- device-health monitoring and online/offline/error device state;
- booked-versus-physically-occupied mismatch detection;
- sensor alerts and sensor logs.

Phase 8 removed these concepts from the active system. They must not return in Wong's proposal, Chapters 1–7, presentation, viva, or final architecture claims. Historical phase and audit documents may mention them only as clearly historical or removed scope.

## 6. Academic honesty and contribution evidence

This document defines **individual documentation and functional scope**, not commit ownership or an invented implementation history. Do not write “Lee solely implemented…”, “Wong solely coded…”, “Wong developed the IoT system…”, or equivalent unsupported claims. If the university later requires contribution attribution, prepare it separately from verifiable evidence such as agreed work records, commits, reviews, or supervisor-confirmed responsibilities.

## 7. Chapter 1–7 emphasis

| Chapter | Lee: Passenger Reservation and Boarding | Wong: Fleet Operations and Live Tracking |
|---|---|---|
| 1 | Passenger uncertainty; journey-aware reservation; Reserved vs Walk-in; passenger lifecycle, objectives and integration dependency | Timetable/operational uncertainty; fleet, route and Trip operations; live tracking objectives and scope |
| 2 | Bus reservation and passenger service quality; capacity reservation; waitlisting; QR verification; no-show/penalty approaches; transactional correctness | Campus bus tracking; fleet scheduling; GPS; realtime tracking; transport operational monitoring |
| 3 | Passenger requirements; student/driver/admin passenger use cases; passenger analysis; relevant methodology | Fleet/tracking requirements; operational actors/use cases; relevant methodology |
| 4 | Booking, ReservedSeatSegment, Waitlist, Walk-in and Penalty domain; passenger ERD/processes; segment algorithm; QR trust/security; Trip integration contracts | Stop, Route, Bus, Trip, TripStop, TripSegment and TripSeat; fleet ERD; lifecycle; conflicts; GPS/realtime architecture |
| 5 | Passenger UI and implementation; booking, waitlist, walk-in, boarding, no-show, credit, appeal, and tests | Fleet/admin/driver operations; GPS simulator; realtime; monitoring; and related tests |
| 6 | Complete-system deployment/setup only where the template requires it, emphasizing module-relevant concerns | Complete-system deployment/setup only where the template requires it, emphasizing operational services |
| 7 | Passenger objectives achieved, limitations, issues, and future enhancements | Fleet/live-tracking objectives achieved, limitations, issues, and future work |

## 8. Maintenance rule

The two derived handoff files are concise views of this document. If either disagrees with this canonical scope, this document wins. A future change to the academic boundary must update this file first and must not silently change product behavior or technical feature ownership.
