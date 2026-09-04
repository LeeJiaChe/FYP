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
  The same transition evaluator applies to every adjacent same-Bus assignment,
  with or without a ServiceBlock. Schedule overlap is a hard conflict;
  same-terminal short turns and different-terminal deadheads are advisories.
  Unknown repositioning duration is never fabricated.
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

Student identity assurance is explicit rather than inferred from an email
suffix. Students present before this unapplied migration become
`LEGACY_PROTOTYPE`: they retain prototype access while remaining clearly not
mailbox verified. New self-registered Students start `EMAIL_UNVERIFIED`, cannot
authenticate, and become `EMAIL_VERIFIED` only after consuming a valid token.
Self-registration requires both the TAR UMT student email and an explicit
Student ID; it never synthesizes one. Resend returns a generic response for
unknown, legacy, and already-verified identities. For a pending identity it
atomically consumes previous usable tokens, creates a new hashed token, and
uses the same fail-closed delivery adapter and expiry policy.

Admin `datetime-local` values are parsed as Malaysia civil time by
`mytLocalDateTimeToIso`, independent of the browser timezone. A scheduled
departure such as `2026-09-10T08:30` therefore always means
`2026-09-10T00:30:00.000Z`.

Student tracking classifies a late `NOT_STARTED` Trip as
`AWAITING_OPERATION`, not historical. It remains selectable with schedule and
expected-delay context, while the UI avoids implying that live telemetry is
available before operational progress begins.

The browser map initializes once. Stop markers, route polyline, and viewport
change only with route topology; telemetry updates only move the shuttle's
Advanced Marker. Failure still returns to the labelled coordinate schematic.

## Migration safety

Prisma owns `20260904120000_verified_student_identity`. Because repository
history records it as unapplied, the migration itself now adds the identity
assurance enum alongside verification/password-reset tokens and notification
context. The migration is not
deployed to the shared Supabase project by this task and must be tested/deployed
only through the repository's guarded isolated-database workflow.
