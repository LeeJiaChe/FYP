# Project Assumptions & Design Decisions (NOTES.md)

> These notes include historical implementation assumptions. Unresolved items and
> current recommendations are tracked in
> [`framework/ARCHITECTURE_AUDIT_2026-08-14.md`](./framework/ARCHITECTURE_AUDIT_2026-08-14.md);
> approved Architecture v2 rules belong in
> [`framework/ARCHITECTURE.md`](./framework/ARCHITECTURE.md) or a focused ADR.

1. **Database Provider**: PostgreSQL with Prisma ORM is intentional and must be preserved. Architecture v2 may evolve the schema through forward migrations where correctness requires additional constraints or an approved segment model.

2. **Realtime Service**: Standalone Node.js service running in `/realtime` using Express and Socket.io. Next.js API routes trigger realtime broadcasts via HTTP requests to `http://localhost:4000/emit`. Two env vars are intentionally split:
   - `REALTIME_URL` (server-only, no `NEXT_PUBLIC_` prefix) — used by `lib/realtime-client.ts` in API routes. Never exposed to client bundle.
   - `NEXT_PUBLIC_REALTIME_URL` — used only by the client-side Socket.io connection in the admin/driver dashboard components.

3. **Scheduled Cron Jobs**: Handled by `node-cron` running inside the `/realtime` service on a 1-minute interval. It triggers no-show detection and device health simulation routines via internal API endpoints. The cron endpoints are protected by `x-cron-secret` header in production.

4. **Auth & Tokens**: JWT tokens stored in `fyp_session` HTTP-only cookie. Student dynamic QR codes embed a 60-second signed JWT containing `{ bookingId, seatId, tripId }`, auto-refreshed by the frontend every 45 seconds.

5. **IoT Simulation**: Device health logs (`DeviceStatusLog`) are periodically simulated with occasional `OFFLINE` / `ERROR` signals to demonstrate sensor monitoring on the admin seat matrix. These are explicitly a simulation and documented as such in code comments.

6. **Cross-Module Cascade Safety**:
   - When a `Trip` is `CANCELLED`, all `CONFIRMED` and `WAITLISTED` bookings are transactionally cancelled, seats released, and students notified with `CANCELLED` notification type.
   - When a `Bus` status changes to `RETIRED` or `MAINTENANCE`, upcoming unstarted trips are cancelled in the same transaction.
   - Bus and Route deletion is blocked with a clear 400 error if active/upcoming trips are assigned.

7. **Race Condition Immunity**:
   - Duplicate booking checks are enforced *inside* `$transaction` blocks to prevent two concurrent POST requests from double-booking the same seat.
   - No-show cron re-fetches the student's live credit score inside each per-booking transaction to prevent stale calculation when a student has multiple no-shows in the same cron run.

8. **Directional Routes & Leg-Based Booking Flow**:
   - Routes are single-directional (`->`). Bidirectional routes from the original spec are split into explicit outbound and inbound routes.
   - The current booking wizard displays `Route → Date → From/To Segment → Time & Seat`, but the selected segment is not persisted or sent in the booking request. Whether to persist segment metadata, implement segment-aware capacity, or remove the step is an unresolved product decision; the UI must not imply behavior the model does not support.

9. **Route API Separation**:
   - `GET /api/routes` — public authenticated endpoint (any logged-in role) for reading routes in the student booking UI.
   - `GET/POST/PATCH/DELETE /api/admin/routes` — admin-only CRUD for route management.
   - This separation was NOT in the original spec but is required to avoid giving students access to admin CRUD endpoints.

10. **QR Scanner UI**: The driver's QR scanner currently requires pasting the JWT token string (text input). In a real deployment, this would use a device camera with a barcode scanning library. For demo/FYP purposes, the paste-based scanner is sufficient and is explicitly a simulation.

11. **Platform Strategy**: The specification requires a responsive installable PWA; a native mobile app is not required. Offline trip-list caching remains stretch scope. The current manifest/meta foundation is incomplete because the declared icons are placeholder pixels and installability has not been verified.

12. **Analytics Historical Coverage**: Historical trip data from all buses (including those now RETIRED) is included in analytics aggregations. This is the correct decision for accurate historical demand reporting. Assumption logged here per spec §3 instruction.

13. **Waitlist Auto-Promotion Lead Time**: Currently instant (no time cutoff). The cutoff and the interaction between post-deadline no-show detection and waitlist promotion require an explicit rule. See audit unresolved question Q5.

14. **Driver Account Deletion Handling**: `Trip.driverId` uses `onDelete: SetNull`, so a database-level driver deletion would unassign trips. The application does not currently expose the promised driver deletion flow; Architecture v2 must define authorization, future-trip handling, and audit behavior before implementing it.
