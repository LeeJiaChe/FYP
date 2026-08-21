# Lee Jia Che — Individual Report Scope

**Canonical title:** **TAR UMT Kuala Lumpur Campus Shuttle Management System: Passenger Reservation and Boarding Management Module**

This individual report focuses on the passenger lifecycle within the shared Campus Shuttle Management System: identity for passenger access, journey search, segment-aware reservation and waitlisting, non-guaranteed walk-in admission, boarding/alighting, and no-show consequences. It consumes fleet-created Trip topology, inventory, capacity, and operational progress through shared integration contracts; it does not describe a separate application.

## Included scope

- Student registration/login rules and passenger authorization.
- From → To → Date → Departure search and journey-specific availability.
- Booking, TripSeat selection, ReservedSeatSegment allocation/reuse, history, and cancellation.
- WaitlistEntry fairness, promotion, and cancellation.
- WalkInIntent, Walk-in Pass, WalkInJourney, StandingSegmentClaim, and safe admission.
- Reserved/Walk-in QR contracts, verification, manual fallback, check-in, manifest passenger details, and alighting.
- No-show, credit, restriction, Penalty, PenaltyAppeal, and related notifications.
- Passenger demand, outcomes, waitlist, walk-in, no-show, penalty/appeal, and relevant utilization analytics.

## Excluded primary scope

Stop/Route administration, Bus lifecycle, Driver administration, Trip scheduling and lifecycle implementation, GPS ingestion, realtime location infrastructure, and fleet monitoring. These may be referenced only as shared dependencies or integration context.

## Allowed integration references

Trip, TripStop, TripSegment, TripSeat and Bus capacity snapshots may be shown to explain passenger rules. Trip progress may be shown as the evidence used by booking, boarding and no-show policies. Fleet and location surfaces should remain contextual rather than becoming the report's implementation focus.

## Main database entities

User (student aspect), Booking, ReservedSeatSegment, WaitlistEntry, WalkInIntent, WalkInJourney, StandingSegmentClaim, Penalty, PenaltyAppeal, Notification; consumes Trip, TripStop, TripSegment, TripSeat, and Trip capacity snapshots.

## Main UI surfaces

Student journey/booking, booking history and passes, waitlist, walk-in, penalties/appeals, passenger notifications, passenger-related driver manifest/scanner/alighting controls, and passenger-focused admin analytics/appeals.

## Chapter 1–7 emphasis

- Chapter 1: passenger problem, objectives, reservation uncertainty, Reserved versus Walk-in, lifecycle, integration dependency.
- Chapter 2: passenger service quality, reservation/capacity, waitlisting, QR verification, no-show/penalty and transaction correctness literature.
- Chapter 3: passenger requirements, actors/use cases, analysis, and methodology.
- Chapter 4: passenger ERD/processes, segment allocation, QR trust/security, and Trip/TripStop integration.
- Chapter 5: actual passenger UI, domain/application behavior, and tests.
- Chapter 6: only relevant shared deployment/setup material required by the template.
- Chapter 7: achieved passenger objectives, limitations, issues, and future enhancements.

## Common mistakes to avoid

- Do not claim sole coding ownership.
- Do not describe fleet/GPS implementation as Lee's primary module.
- Do not describe internal TripSegment selection as a passenger-facing step.
- Do not conflate a guaranteed Reserved Pass with a non-guaranteed Walk-in Pass.
- Do not describe whole-Trip seat locking, timetable-only no-show, payment, PWA, physical GPS, or seat sensors as final behavior.
- Do not invent TAR UMT operational facts.

If this file disagrees with `framework/INDIVIDUAL_DOCUMENTATION_SCOPE.md`, the canonical scope file wins.
