# Operations Correctness Foundation

This note records implementation boundaries introduced by the September 2026
correctness, privacy and operational-realism repair.

## Authoritative decisions

- `ServiceLine -> directional Route -> Trip -> Bus + Driver` is unchanged.
  `ServiceBlock` only orders Trips for one physical Bus.
- The application projection is the privacy boundary. A student Trip response
  omits Driver IDs, ServiceBlock internals and passenger statistics. Seat claims
  belonging to other students become non-identifying unavailable state.
- `resolveStudentBookingEligibility` owns booking-open, operational-close,
  terminal-state, credit and capacity reasons. Intermediate-to-intermediate
  journeys remain valid and segment-aware.
- `useOperationalClock` refreshes classification at a bounded interval;
  `operational-time.ts` owns MYT formatting, service-date keys and day bounds.
  Server validation always uses its own clock.
- Driver manual fallback lists pending current-Trip/current-stop records by
  passenger name, Student ID and journey. Admission still uses the locked
  capacity transaction.
- `Trip.delayMinutes` is backwards-compatible expected/reported delay metadata.
  Actual departure delay is calculated from the origin TripStop's actual versus
  planned departure timestamp.
- `minimumServiceBlockTurnaroundMs` is a named prototype policy (10 minutes).
  Same-terminal short turns and different-terminal deadheads are warnings;
  unknown repositioning duration is never fabricated.
- Bulk generation is preview then confirm. Confirmation re-runs validation and
  transactionally creates ordinary Trips; there is no parallel timetable model.

## Optional infrastructure

`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is separate from the server Routes key.
Restrict it to the Maps JavaScript API and exact HTTPS application referrers.
Missing or failed Maps loading retains the coordinate schematic. All telemetry
is explicitly labelled simulated GPS / prototype.

In-app notifications remain the delivery baseline and may carry a safe local
`contextPath`. No external push dependency is assumed.

Email activation uses one-time random tokens stored only as SHA-256 hashes.
Development/test may expose the token as a preview action. Production disables
registration while the `EmailVerificationDelivery` implementation is
unconfigured; a real provider must implement that interface without placing
credentials in browser variables. `PasswordResetToken` prepares, but does not
pretend to deliver, a future verified-email recovery workflow.

## Migration safety

Prisma owns `20260904120000_verified_student_identity`. It adds verification
and password-reset token tables plus notification context. The migration is not
deployed to the shared Supabase project by this task and must be tested/deployed
only through the repository's guarded isolated-database workflow.
