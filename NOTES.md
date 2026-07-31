# Project Assumptions & Design Decisions (NOTES.md)

1. **Database Provider**: Using SQLite with Prisma ORM (`file:./dev.db`) for zero-dependency local execution. The schema adheres 100% to the specification entities and field names.

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
   - Booking wizard: `Route → Date → From/To Segment → Time & Seat`. Seat availability is checked for the whole trip, but the student's from/to selection is metadata; full per-segment seat reservation is out of scope for FYP (spec §5.3 does not require it).

9. **Route API Separation**:
   - `GET /api/routes` — public authenticated endpoint (any logged-in role) for reading routes in the student booking UI.
   - `GET/POST/PATCH/DELETE /api/admin/routes` — admin-only CRUD for route management.
   - This separation was NOT in the original spec but is required to avoid giving students access to admin CRUD endpoints.

10. **QR Scanner UI**: The driver's QR scanner currently requires pasting the JWT token string (text input). In a real deployment, this would use a device camera with a barcode scanning library. For demo/FYP purposes, the paste-based scanner is sufficient and is explicitly a simulation.

11. **PWA Delivery**: Full PWA support via `/app/manifest.ts`, mobile viewport meta tags, and standalone app shell behavior. `next-pwa` service worker is NOT configured (it is a stretch goal per spec §12). The PWA manifest and Apple meta tags ARE present.

12. **Analytics Historical Coverage**: Historical trip data from all buses (including those now RETIRED) is included in analytics aggregations. This is the correct decision for accurate historical demand reporting. Assumption logged here per spec §3 instruction.

13. **Waitlist Auto-Promotion Lead Time**: Currently instant (no time cutoff). Whether to disable promotion within 15 minutes of departure is a UX decision pending user input. See Audit Report Q1.

14. **Driver Account Deletion Handling**: Currently no cascade logic exists for driver deletion while trips are assigned. `Trip.driverId` uses `onDelete: SetNull` at the schema level, so driver deletion sets the trip to "Unassigned" automatically at the DB level. No additional application-level cascade needed.
