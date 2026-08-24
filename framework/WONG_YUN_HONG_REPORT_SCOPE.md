# Wong Yun Hong — Individual Report Scope

**Canonical title:** **TAR UMT Kuala Lumpur Campus Shuttle Management System: Fleet Operations and Live Tracking Module**

This individual report focuses on the shared system's operational foundation: directional Stop/Route topology, Bus and Driver administration, conflict-safe Trip scheduling and immutable inventory, Trip progress, simulated GPS ingestion, authenticated realtime invalidation, and fleet monitoring. It supplies Trip, stop, capacity, inventory, progress, and location information to the passenger module; it does not describe a separate application.

## Included scope

- Stop, directional Route, ordered RouteStop, travel durations, deactivation, and history.
- Bus capacities and ACTIVE/MAINTENANCE/RETIRED lifecycle.
- Driver account administration, assignment, role verification, and conflicts.
- Trip scheduling, TripStop/TripSegment snapshots, TripSeat inventory, capacity snapshots, conflict prevention, and safe rescheduling.
- Trip lifecycle, TripStatusHistory, stop progress, delay metadata, cancellation, and Bus-unavailability effects.
- TripLocationSample, LocationSource, simulated GPS, source-neutral ingestion, retention, and student location output.
- Authenticated Socket.io subscription/invalidation, trusted-service operations, and recovery by authoritative refetch.
- Fleet/Trip monitoring, operational capacity utilization, location freshness, and operational analytics.

## Excluded primary scope

ReservedSeatSegment allocation, reservation algorithm, waitlist fairness, WalkInIntent/WalkInJourney business rules, passenger pass authorization, no-show, credit, penalties, and appeals. These may be referenced only as shared dependencies or integration context.

## Allowed integration references

Passenger bookings, segment claims, walk-in journeys and manifests may be shown where needed to explain demand, capacity, cancellation effects or operational projections. Their passenger business rules should remain integration context rather than becoming the report's implementation focus.

## Main database entities

User (driver/admin aspect), Stop, Route, RouteStop, Bus, Trip, TripStop, TripSegment, TripSeat, TripStatusHistory, and TripLocationSample; may reference passenger records only for integrated operational projections.

## Main UI surfaces

Admin Stops, Routes, Buses, Drivers, Trips, scheduling, live monitoring and fleet/location analytics; Driver assigned-Trip and Trip-progress controls; student live-location output as an integration surface.

## Chapter 1–7 emphasis

- Chapter 1: timetable/operational uncertainty, route/fleet/Trip problems, objectives, live tracking, and fleet operations.
- Chapter 2: campus bus tracking, scheduling, GPS, realtime tracking, and operational monitoring literature.
- Chapter 3: fleet/tracking requirements, operational actors/use cases, analysis, and methodology.
- Chapter 4: fleet ERD, snapshots/inventory, lifecycle, conflict logic, GPS ingestion, and realtime architecture.
- Chapter 5: actual fleet/admin/driver operations, simulator, realtime, monitoring, and tests.
- Chapter 6: applicable complete-system deployment/setup, including operational services.
- Chapter 7: achieved fleet/live-tracking objectives, limitations, and future work.

## Common mistakes to avoid

- Do not claim sole coding ownership.
- Do not claim passenger booking/waitlist/penalty algorithms as Wong's primary module.
- Do not reintroduce ESP32, seat sensors, LED indicators, DeviceStatusLog, DeviceSignal, device health, or sensor mismatch detection.
- Do not claim simulated GPS is deployed physical GPS or that Socket.io owns durable state.
- Do not describe the modules as separate applications or databases.
- Do not invent TAR UMT operational facts.

If this file disagrees with `framework/INDIVIDUAL_DOCUMENTATION_SCOPE.md`, the canonical scope file wins.
