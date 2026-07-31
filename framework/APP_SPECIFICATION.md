# School Bus Booking and Management System — Full Technical Specification

This document is a complete build specification for an FYP (Final Year Project) web application. Follow it precisely. Where a decision is not specified, choose the simplest reasonable implementation and note the assumption in a `NOTES.md` file at the project root rather than silently deviating from anything that IS specified here.

---

## 1. Project Summary

A web application that digitizes campus bus seat booking and gives the transport department real-time visibility into bus occupancy. The system has two integrated modules that share one database:

1. **Bus Booking System** — student-facing booking, QR boarding validation, no-show/penalty logic.
2. **Monitoring, Administration & Analytics System** — real-time seat/bus status (via a simulated IoT layer), an admin portal for managing routes/buses/drivers, and demand analytics.

Both modules operate on one shared data model (trip, seat, booking, penalty). Do not build them as two separate apps — they are one system with two functional areas.

---

## 2. Tech Stack (use exactly this unless a listed library is unavailable)

- **Framework:** Next.js (App Router, TypeScript) — single codebase for frontend + REST API routes.
- **Database:** PostgreSQL.
- **ORM:** Prisma.
- **Real-time layer:** A small standalone Node.js + Socket.io service (`/realtime` folder, separate process) that broadcasts seat/bus status changes. The Next.js API writes to Postgres, then emits an event to this service (via HTTP call or shared Redis pub/sub — HTTP call is fine, keep it simple) whenever seat/booking/trip status changes. The frontend dashboard connects to this Socket.io service directly for live updates.
- **Styling:** Tailwind CSS.
- **Auth:** Credentials-based (email or student ID + password), hashed with bcrypt, session via JWT stored in an HTTP-only cookie. This simulates "TAR UMT account login" — do NOT attempt real university SSO integration.
- **QR codes:** `qrcode` npm package to render, `jsonwebtoken` to generate short-lived signed tokens embedded in the QR (see §6.3 for exact logic).
- **Charts (for analytics dashboard):** `recharts`.
- **Validation:** `zod` for all API input validation.
- **Background jobs:** a simple cron-style scheduled task (using `node-cron` inside the realtime service, or a Next.js API route triggered by an external scheduler) for no-show detection (§6.5) and waitlist promotion (§6.6).
- **Delivery target:** responsive web app installable as a Progressive Web App (PWA) — NOT a native/React Native app. See §12 for exact PWA setup.

---

## 3. User Roles

| Role | Description |
|---|---|
| **Student** | Books seats, boards via QR, views own history/penalties. |
| **Driver** | Logs in, views own trip's manifest/seat status, manually checks in students, reports delays/breakdowns. |
| **Transport Admin (Staff)** | Manages routes, timetables, buses, driver assignments; reviews penalty appeals; views analytics. |

All three roles log into the same app but see different dashboards after login, based on a `role` field on the `User` table.

---

## 4. Data Model

Implement exactly these entities in `prisma/schema.prisma`. Field names below are the source of truth — use them as-is in the schema and API.

### 4.1 `User`
- `id` (uuid, pk)
- `studentId` (string, unique, nullable — only for students)
- `name` (string)
- `email` (string, unique)
- `passwordHash` (string)
- `role` (enum: `STUDENT`, `DRIVER`, `ADMIN`)
- `creditScore` (int, default 100 — used for tiered penalty priority, students only)
- `isBookingRestricted` (boolean, default false — set true if creditScore drops below a threshold, e.g. 40)
- `createdAt`, `updatedAt`

### 4.2 `Bus`
- `id` (uuid, pk)
- `plateNumber` (string, unique)
- `capacity` (int)
- `status` (enum: `ACTIVE`, `MAINTENANCE`, `RETIRED`)

### 4.3 `Route`
- `id` (uuid, pk)
- `name` (string)
- `stops` (string[] or a related `RouteStop` table if you want ordered stops with names — simple string array is acceptable for FYP scope)

### 4.4 `Trip`
A trip is one scheduled run of a bus on a route at a specific date/time. This is the central entity everything else hangs off.
- `id` (uuid, pk)
- `routeId` (fk → Route)
- `busId` (fk → Bus)
- `driverId` (fk → User, role DRIVER, nullable until assigned)
- `departureTime` (datetime)
- `estimatedArrivalTime` (datetime)
- `boardingDeadline` (datetime — departureTime minus a configurable buffer, e.g. 5 minutes; after this, unboarded bookings become no-shows)
- `status` (enum: `NOT_STARTED`, `BOARDING`, `DEPARTED`, `ARRIVED`, `DELAYED`, `CANCELLED`)
- `delayReason` (string, nullable)
- `createdAt`, `updatedAt`

### 4.5 `Seat`
Represents one physical seat position on a specific trip (regenerated per trip from the bus's capacity).
- `id` (uuid, pk)
- `tripId` (fk → Trip)
- `seatNumber` (int)
- `status` (enum: `AVAILABLE`, `RESERVED`, `CHECKED_IN`, `NO_SHOW`) — this field is what drives the real-time dashboard colors (white/red/green as per your original spec: white=available, red=reserved-not-checked-in, green=checked-in).

### 4.6 `Booking`
- `id` (uuid, pk)
- `studentId` (fk → User)
- `tripId` (fk → Trip)
- `seatId` (fk → Seat, unique — one booking per seat)
- `status` (enum: `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`, `WAITLISTED`)
- `waitlistPosition` (int, nullable — only set when status is WAITLISTED)
- `qrTokenIssuedAt` (datetime, nullable)
- `checkedInAt` (datetime, nullable)
- `createdAt`, `updatedAt`

### 4.7 `Penalty`
- `id` (uuid, pk)
- `bookingId` (fk → Booking)
- `studentId` (fk → User)
- `creditPointsDeducted` (int)
- `reason` (string, default "No-show")
- `status` (enum: `ACTIVE`, `APPEALED`, `OVERTURNED`, `UPHELD`)
- `createdAt`

### 4.8 `PenaltyAppeal`
- `id` (uuid, pk)
- `penaltyId` (fk → Penalty)
- `studentId` (fk → User)
- `reason` (text — student's explanation)
- `status` (enum: `PENDING`, `APPROVED`, `REJECTED`)
- `reviewedByAdminId` (fk → User, nullable)
- `adminComment` (text, nullable)
- `createdAt`, `resolvedAt`

### 4.9 `Notification`
- `id` (uuid, pk)
- `userId` (fk → User)
- `type` (enum: `BOOKING_CONFIRMED`, `DEPARTURE_REMINDER`, `CANCELLED`, `NO_SHOW`, `WAITLIST_PROMOTED`, `PENALTY_ISSUED`, `APPEAL_RESOLVED`, `TRIP_DELAYED`)
- `message` (string)
- `isRead` (boolean, default false)
- `createdAt`

### 4.10 `DeviceStatusLog` (simulated IoT layer)
Represents the simulated sensor/indicator state for a seat, logged over time — this is what the "IoT" module reads/writes instead of talking to real hardware.
- `id` (uuid, pk)
- `seatId` (fk → Seat)
- `simulatedSignal` (enum: `OK`, `OFFLINE`, `ERROR`)
- `recordedAt` (datetime)

### Relationships summary
`Route` 1—* `Trip` *—1 `Bus`; `Trip` 1—* `Seat`; `Seat` 1—1 `Booking` (nullable); `Booking` *—1 `User`(student); `Booking` 1—* `Penalty` (usually 0 or 1); `Penalty` 1—1 `PenaltyAppeal` (nullable); `Trip` *—1 `User`(driver, nullable).

---

## 5. Module 1 — Bus Booking System (Student-Facing)

### 5.1 Authentication
- Register/login with student ID + email + password (bcrypt hashed). No real SSO.
- JWT stored in HTTP-only cookie, containing `userId` and `role`. Middleware protects all `/student/*` routes, checks `role === STUDENT`.

### 5.2 View Schedule & Availability
- Student sees a list of upcoming trips (route, departure time, estimated arrival) filtered by route and date.
- Each trip shows: total seats, seats available, seats reserved, seats checked-in (read from the `Seat` table aggregated by status).

### 5.3 Booking with Waitlist
Logic to implement exactly:
1. Student selects a trip and an `AVAILABLE` seat → seat is locked (use a DB transaction with row-level lock to prevent double-booking) → seat status set to `RESERVED`, `Booking` created with status `CONFIRMED`.
2. If no seats are `AVAILABLE`, student may join the waitlist instead: create a `Booking` with status `WAITLISTED` and `waitlistPosition` = current max position + 1 for that trip. No seat is assigned yet.
3. **Waitlist promotion trigger:** whenever a `CONFIRMED` booking is cancelled OR a booking is marked `NO_SHOW` **before** the boarding deadline has fully passed (i.e., a cancellation happens with enough lead time) — release that seat back to `AVAILABLE`, then immediately look up the `WAITLISTED` booking with the lowest `waitlistPosition` for that trip, assign it that seat, set its status to `CONFIRMED`, clear `waitlistPosition`, and send a `WAITLIST_PROMOTED` notification.
4. `isBookingRestricted` check: if true, block new bookings and return a clear error message to the frontend.

### 5.4 Manage Booking
- View current booking(s), cancel before a configurable cutoff (e.g. 30 minutes before departure) — cancelling triggers §5.3 step 3.
- Booking history list with filterable status: `COMPLETED`, `CANCELLED`, `NO_SHOW`.

### 5.5 Dynamic QR Boarding Verification
Exact logic:
1. When a student opens "My Booking" for a `CONFIRMED` booking whose trip is within a configurable window before departure (e.g. 15 minutes), the frontend requests a QR token from `POST /api/bookings/:id/qr-token`.
2. Backend generates a JWT signed with a server secret, payload = `{ bookingId, seatId, tripId, issuedAt, exp: issuedAt + 60 seconds }`. Store `qrTokenIssuedAt` on the booking. Return the token encoded as a QR image (via `qrcode` package) to the frontend.
3. The frontend **must re-request a new token automatically every 45–50 seconds** while the QR screen is open, so the displayed QR is always close to expiry — this is what makes it "dynamic" and prevents screenshot sharing.
4. Driver or a boarding scanner endpoint (`POST /api/trips/:id/scan`) receives the scanned token string, verifies signature + expiry + that `bookingId`/`tripId` match the trip being scanned, and that the booking status is `CONFIRMED` (not already checked in). If valid: set `Seat.status = CHECKED_IN`, `Booking.checkedInAt = now()`, `Booking.status = COMPLETED`. If invalid/expired: return a clear error (`"QR expired, please refresh"` / `"Already checked in"` / `"Invalid token"`).
5. Every successful scan must emit a real-time event to the Socket.io service so the monitoring dashboard updates immediately (see §6.1).

### 5.6 No-Show Detection (scheduled job)
Runs periodically (e.g. every 1 minute):
1. Find all `Trip`s where `boardingDeadline < now()` and `status` is not yet `DEPARTED`/`CANCELLED`.
2. For each such trip, find all `Booking`s with status `CONFIRMED` where `checkedInAt IS NULL` → set `Booking.status = NO_SHOW`, `Seat.status = NO_SHOW`.
3. For each new no-show, create a `Penalty` (see §5.7) and send a `NO_SHOW` notification.
4. Set the trip's `status` to `DEPARTED` once boarding closes (unless already delayed/cancelled).

### 5.7 Penalty Management
1. On no-show: create `Penalty` with `creditPointsDeducted` (e.g. 15), deduct from `User.creditScore`, clamped at 0.
2. If `User.creditScore` falls below a threshold (e.g. 40): set `isBookingRestricted = true` and notify the student.
3. **Appeal flow:** student can submit a `PenaltyAppeal` with a reason, while `Penalty.status` becomes `APPEALED`. Admin reviews (§7.5): if `APPROVED`, restore the deducted credit points, set `Penalty.status = OVERTURNED`, unset `isBookingRestricted` if score is now above threshold. If `REJECTED`, `Penalty.status = UPHELD`.

### 5.8 Notifications
- Create a `Notification` row for every event listed in §4.9's enum, at the point each event occurs in the logic above.
- Simple in-app notification bell/list is sufficient; email is optional/stretch goal — do not build email sending unless time permits, and if built, keep it a thin wrapper that never blocks the main transaction.

---

## 6. Module 2 — Monitoring, Administration & Analytics System

### 6.1 Real-Time Dashboard (simulated IoT layer)
- The standalone Socket.io service listens for internal HTTP "emit" calls from the Next.js API (triggered by: booking created/cancelled, QR scan/check-in, no-show detection, trip status change).
- On each such event, it broadcasts a `seat-update` or `trip-update` event over the relevant trip's Socket.io "room" (room name = `trip:{tripId}`).
- The admin dashboard frontend joins the room for whichever trip(s) it's viewing and re-renders seat colors instantly: white = `AVAILABLE`, red = `RESERVED`, green = `CHECKED_IN`, grey = `NO_SHOW`.
- Dashboard also shows aggregate counts per trip: total/reserved/checked-in/available/no-show.

### 6.2 Simulated Device Health
- A scheduled job randomly (or based on a simple rule, e.g. every Nth seat) writes a `DeviceStatusLog` row with `simulatedSignal = OFFLINE` occasionally, to demonstrate the "device health monitoring" feature. Dashboard flags any seat whose latest `DeviceStatusLog` is `OFFLINE`/`ERROR` with a warning icon. This is a simulation for demo purposes — document this clearly in code comments.

### 6.3 Driver Features
- Driver logs in (role `DRIVER`), sees only trips assigned to them (`Trip.driverId === self`).
- Driver view shows the live seat manifest for their current trip (reusing §6.1's real-time data).
- **Manual check-in override:** driver can tap a student's name/seat in the manifest to manually mark them `CHECKED_IN` (for when QR scanning fails) — this calls the same logic as §5.5 step 4 but skips token verification; log that this was a manual override (add a `checkInMethod` enum field on `Booking`: `QR`, `MANUAL`).
- **Delay/breakdown reporting:** driver can set `Trip.status = DELAYED` or `CANCELLED` with a `delayReason`. This triggers `TRIP_DELAYED` notifications to all students with `CONFIRMED`/`WAITLISTED` bookings on that trip, and should also be visible on the admin dashboard.

### 6.4 Bus Status Monitoring
- Trip status enum drives a simple state indicator on both the driver's view and the admin dashboard: `NOT_STARTED → BOARDING → DEPARTED → ARRIVED`, with `DELAYED`/`CANCELLED` as branches.

### 6.5 Admin / Transport Staff Portal
CRUD screens for:
- **Buses:** create/edit/retire buses (`plateNumber`, `capacity`, `status`).
- **Routes:** create/edit routes and their stops.
- **Trips/Timetable:** schedule a trip (route + bus + departure time) — on creation, auto-generate `Seat` rows equal to the bus's `capacity`, all `AVAILABLE`.
- **Driver assignment:** assign a `User` with role `DRIVER` to a `Trip`.
- **Penalty appeal review:** list `PENDING` appeals, approve/reject (see §5.7 step 3).

### 6.6 Data Analytics
- Historical view (not real-time) aggregating: bookings per route/time-slot over the past N weeks, no-show rate per route/time-slot, average seat utilization %.
- Use `recharts` bar/line charts. Data can be computed with straightforward Prisma aggregate queries (`groupBy`) — no need for a separate analytics pipeline at FYP scope.
- Optionally surface a simple rule-based suggestion (e.g. "Route X at 8am has >90% utilization over the last 4 weeks — consider adding a trip") — this can be a simple threshold check in code, not real ML, and should be labeled as a rule-based suggestion in the UI, not "AI-powered," to avoid overclaiming.

---

## 7. API Route Summary (Next.js App Router — adjust exact paths as needed, but cover all of these)

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/trips                      (list/filter, students+admin)
GET    /api/trips/:id
POST   /api/trips                      (admin only)
PATCH  /api/trips/:id                  (admin/driver: status, delay, cancel)

POST   /api/bookings                   (create booking or join waitlist)
GET    /api/bookings/mine              (student's own bookings)
PATCH  /api/bookings/:id/cancel
POST   /api/bookings/:id/qr-token
POST   /api/trips/:id/scan             (QR check-in, driver)
POST   /api/trips/:id/manual-checkin   (driver override)

GET    /api/penalties/mine
POST   /api/penalties/:id/appeal
GET    /api/appeals                    (admin)
PATCH  /api/appeals/:id                (admin approve/reject)

GET    /api/admin/buses  POST  PATCH  DELETE
GET    /api/admin/routes POST  PATCH  DELETE
GET    /api/admin/drivers-list
GET    /api/analytics/utilization
GET    /api/analytics/no-show-rate

GET    /api/notifications/mine
PATCH  /api/notifications/:id/read
```

---

## 8. Pages/Screens

**Student:** Login/Register, Trip List, Trip Detail + Booking, My Bookings, QR Boarding Screen, Booking History, Penalties + Appeal Form, Notifications.

**Driver:** Login, My Trips, Live Manifest (manual check-in, delay/breakdown reporting).

**Admin:** Login, Dashboard (live seat/trip status across all active trips), Buses CRUD, Routes CRUD, Trips/Timetable CRUD, Driver Assignment, Appeal Review Queue, Analytics Dashboard.

---

## 9. Non-Functional Requirements
- All API inputs validated with `zod`; return 4xx with a clear message on validation failure.
- All booking/seat state changes that touch more than one row (booking + seat, or no-show + penalty) must be wrapped in a Prisma transaction to avoid race conditions — this matters most for §5.3 (booking) and §5.6 (no-show batch job).
- Passwords always bcrypt-hashed, never logged in plaintext.
- Seed script (`prisma/seed.ts`) must create: a handful of routes/buses/drivers, several trips at different times (some in the near future for live demo purposes), and a few demo student accounts with varying credit scores — so the app is demo-ready immediately after setup.

---

## 10. Folder Structure (suggested)

```
/app                 - Next.js App Router pages + API routes
/prisma              - schema.prisma, seed.ts, migrations
/realtime            - standalone Socket.io service
/lib                 - shared utilities (auth, qr, db client, validation schemas)
/components          - shared React components
NOTES.md             - log any assumption made where this spec was ambiguous
```

---

## 11. Explicitly Out of Scope (do not build)
- Real hardware/IoT integration (this is simulated, per §6.1–6.2).
- Real TAR UMT SSO integration.
- Payment processing (service is free).
- Real SMS/push notification infrastructure (in-app notifications only, per §5.8).
- GPS/live location tracking.
- Native mobile app (React Native, Flutter, or App Store/Play Store distribution of any kind). The product is a responsive web app with PWA install support — see §12. Do not scaffold a separate mobile project.

## 12. PWA (Progressive Web App) Setup

The app must be installable to a phone's home screen and behave like an app shell when opened (no browser address bar), while remaining the same Next.js codebase — do not create a second frontend project.

1. **Manifest:** add `/app/manifest.ts` (Next.js App Router supports this natively) exporting a `MetadataRoute.Manifest` object with `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `background_color`, `theme_color`, and an `icons` array (at least 192x192 and 512x512 PNG icons, placed in `/public`).
2. **Service worker:** use the `next-pwa` package (or `@ducanh2912/next-pwa`, which has better App Router support) to generate a service worker at build time. Configure it to cache static assets and API GET responses for trip listings so the trip list still renders (with a "showing cached data" note) if the connection briefly drops — this is a stretch goal, not required for core grading, but the manifest + "Add to Home Screen" install prompt IS required.
3. **Meta tags:** ensure `/app/layout.tsx` includes the standard PWA meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, viewport settings for mobile) so iOS Safari's "Add to Home Screen" also produces a clean full-screen icon, not just Android/Chrome.
4. **Responsive design:** all pages (student, driver, admin) must be built mobile-first with Tailwind's responsive utilities — students and drivers will realistically use this on a phone, admin more likely on a laptop, but nothing should break on a small screen.
5. **Testing note:** PWA install prompts do not appear on `localhost` in all browsers reliably — test installability via a deployed preview (e.g. Vercel preview URL) rather than assuming local dev server behavior reflects the real install experience.
