# 🚌 TAR UMT Kuala Lumpur Campus Shuttle Management System

> **Final Year Project (FYP)** — A responsive web application for directional journey search, segment-aware reserved seating, non-guaranteed walk-in boarding, live simulated-GPS location, and transport operations.

> **Architecture v2 status:** Phases 3–9 implement directional topology,
> reserved journeys/waitlist, boarding/walk-in/alighting, progress-based
> penalties, fleet administration, persisted simulated GPS telemetry,
> authenticated realtime invalidation, segment-weighted analytics, and a
> responsive accessible frontend. This is a website, not an installable PWA.

---

## ✨ Features

### 🎓 Student Portal
- **Journey Search** — Guided `From → To → Date → Departure → Seat` flow over directional routes
- **Segment-Aware Reserved Seating** — A specific seat is guaranteed only over the passenger's planned boarding-to-drop-off journey and may be reused on non-overlapping segments
- **Reserved Pass** — Short-lived signed QR backed by a guaranteed Booking
- **Walk-in Pass** — Records intent but clearly does not guarantee standing admission; capacity is claimed only when scanned
- **Journey-Aware Waitlist** — Oldest-compatible-first FIFO; skipped incompatible entries retain priority
- **Live Bus Location** — GPS simulator coordinates displayed honestly as prototype telemetry, not schedule interpolation
- **Booking History** — View all past and upcoming bookings
- **Credit Score** — Tracks reliability; drops on no-shows, triggers booking restrictions
- **Penalty Appeals** — Submit appeals against no-show penalties with written justification
- **Notifications** — In-app alerts for booking confirmations, trip delays, cancellations, promotions, and penalties

### 🚗 Driver Portal
- **Active Trip Dashboard** — View assigned trips and current trip status
- **Boarding Operations** — Validate Reserved and Walk-in passes, with authorized manual fallback
- **Alighting Confirmation** — Exit QR where practical, driver manual fallback, and optional automatic completion after the planned stop is passed
- **Trip Status Control** — `Not Started → Boarding → Departed → Arrived`, with terminal cancellation and separate delay metadata
- **Operational Manifest** — Journey-aware reserved and admitted-standing passenger state for the assigned Trip

### 🛡️ Admin Portal
- **Fleet Management** — Buses have configurable seated and standing capacities
- **Route Management** — Directional ordered routes of approximately 2–5 reusable stops
- **Trip Scheduling** — Derive per-stop planned times from route travel-duration offsets, assign buses/drivers, and record delay metadata
- **Driver Management** — Create driver accounts and assign them to trips
- **Live Operations** — Journey-aware reserved-seat and admitted-standing occupancy without seat-sensor/device-health simulation
- **Analytics Dashboard** — Historical aggregations for ridership, route demand, and fleet utilisation using Recharts
- **Penalty & Appeal Review** — Approve or reject student penalty appeals with admin comments

### ⚡ Real-Time Infrastructure
- **Standalone Socket.io Service** — Decoupled from Next.js; runs on port `4000`
- **Authorized Trip Rooms** — Short-lived signed subscriptions authorize one `trip:<id>` room
- **Scheduled Jobs** — Retry-safe no-show reconciliation, daily location retention, and one server-side GPS simulator tick every five seconds
- **Responsive Website** — Mobile-browser friendly, without PWA installability, service workers, or offline caching

---

## 🏗️ Architecture

The complete product specification is maintained in
[`framework/APP_SPECIFICATION.md`](./framework/APP_SPECIFICATION.md). The canonical
boundary for the two separate individual FYP reports is maintained in
[`framework/INDIVIDUAL_DOCUMENTATION_SCOPE.md`](./framework/INDIVIDUAL_DOCUMENTATION_SCOPE.md);
it documents academic focus within this one integrated application rather than
separate codebases or databases.

The current-state audit and the normative target architecture are documented in
[`framework/ARCHITECTURE_AUDIT_2026-08-14.md`](./framework/ARCHITECTURE_AUDIT_2026-08-14.md)
and [`framework/ARCHITECTURE.md`](./framework/ARCHITECTURE.md). The diagram below
describes the existing runtime at a high level, not the completed Architecture v2.

```
┌─────────────────────────────────────────────────────────────┐
│                    Responsive Web Browser                   │
│         Student Portal | Driver Portal | Admin Portal       │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                   Next.js 16 (App Router)                   │
│                                                             │
│  Pages: /student  /driver  /admin  /login  /register        │
│  API:   /api/auth  /api/bookings  /api/trips                │
│         /api/appeals  /api/penalties  /api/notifications    │
│         /api/analytics  /api/routes                         │
│         /api/admin/{buses,routes,drivers-list,cron}         │
│                                                             │
│  Proxy: optimistic JWT role redirects                       │
│  ORM: Prisma + PostgreSQL                                   │
└──────┬───────────────────────────────────────┬──────────────┘
       │ HTTP POST /emit                        │ Socket.io client
       │ (server→realtime bridge)               │ (browser→realtime)
┌──────▼───────────────────────────────────────▼──────────────┐
│           Standalone Realtime Service (port 4000)           │
│               Node.js + Socket.io + node-cron               │
│                                                             │
│  POST /emit  → authenticated validated room invalidations   │
│  Jobs → no-show reconciliation, GPS simulator, retention    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL via [Prisma ORM](https://prisma.io) 6 |
| Auth | JWT (`jsonwebtoken`) stored in HTTP-only cookies |
| Realtime | Socket.io 4 (standalone Node.js service) |
| Cron | `node-cron` (inside realtime service) |
| Charts | Recharts 3 |
| QR Codes | `qrcode` library |
| QR Camera Decode | `qr-scanner` (native detector where available, worker fallback otherwise) |
| Validation | Zod 4 |
| Icons | Lucide React |

---

## 📦 Prerequisites

- **Node.js** ≥ 20.9 (required by Next.js 16)
- **npm** ≥ 9
- **PostgreSQL** (a reachable development database)

---

## 🚀 Fresh-clone setup

### 1. Clone & Install

```bash
git clone https://github.com/LeeJiaChe/FYP.git
cd FYP
git checkout architecture-v2
npm ci
npx prisma generate
```

### 2. Environment Variables

Copy the documented safe template and replace every secret placeholder with a
distinct random value of at least 32 characters:

```bash
cp .env.example .env
```

Required server values are:

```env
# Durable PostgreSQL development database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fyp_bus_system?schema=public"

# Use separate, strong random secrets outside local development
JWT_SECRET="replace-with-a-strong-session-secret"
QR_SECRET="replace-with-a-different-strong-qr-secret"

# Realtime service (server-side only — never exposed to browser)
REALTIME_URL="http://localhost:4000"
REALTIME_SERVICE_SECRET="replace-with-a-strong-service-secret"

# Realtime service (browser-side Socket.io connection)
NEXT_PUBLIC_REALTIME_URL="http://localhost:4000"
CORS_ORIGIN="http://localhost:3000"

# Internal URL used by realtime service to call Next.js cron endpoints
NEXTJS_INTERNAL_URL="http://localhost:3000"
```

`TEST_DATABASE_URL` and `TEST_DATABASE_CONFIRM` are deliberately absent from
normal development/production setup; they are opt-in fail-closed integration
test settings described in `.env.example`.

### 3. Set up and seed PostgreSQL

```bash
# Apply the committed PostgreSQL migrations
npx prisma migrate deploy

# Confirm the schema and migration state
npx prisma validate
npx prisma migrate status

# Seed with demo data (routes, buses, drivers, students)
npm run db:seed
```

### 4. Run the Application

You need **two terminals** — one for Next.js and one for the standalone realtime service.

**Terminal 1 — Next.js dev server:**
```bash
npm run dev
```

**Terminal 2 — Socket.io realtime service:**
```bash
npm run realtime
```

The standalone process loads the repository's Next.js-style development `.env`
files through `@next/env`; WSL/Windows users do not need to export every value
in the shell. Secret validation remains fail-closed at 32 characters.

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Demo accounts and data

See [`framework/DEMO_ACCOUNTS.md`](./framework/DEMO_ACCOUNTS.md). Those
credentials and identities are **DEMO / DEVELOPMENT ONLY** and are recreated by
reset/reseed. The ten directional Route records use source-based TAR UMT KL
route-family and published stop names. Relative Trip times, coordinates, travel
durations, buses, capacities and passenger records remain synthetic prototype
data; no seeded timetable or coordinate is presented as an official record.

---

## 🗺️ Routes & Pages

| URL | Role | Description |
|---|---|---|
| `/` | Public | Landing page |
| `/login` | Public | Login form |
| `/register` | Public | Student registration |
| `/student` | Student | Dashboard — upcoming bookings, notifications |
| `/driver` | Driver | Assigned trips, QR scanner, seat matrix |
| `/admin` | Admin | Fleet, routes, trips, analytics, penalties |

---

## 🗄️ Database Schema Status

Architecture v2 now uses normalized topology, journey allocation, and durable telemetry:

```
Stop ── RouteStop ── Route ── Trip ── TripStop ── TripSegment
                              └──── TripSeat ── ReservedSeatSegment ── Booking
                              └──── TripLocationSample

User ──┬── Booking ───── Penalty ── PenaltyAppeal
       ├── WaitlistEntry
       ├── Notification
       └── Trip (as driver)

Trip ──── WalkInJourney ──── StandingSegmentClaim
```

`Stop`, ordered `RouteStop`, `TripStop`, `TripSegment`, and `TripSeat` provide the
directional Trip snapshot. `Booking`, `ReservedSeatSegment`, and `WaitlistEntry`
provide segment-aware reservations. Phase 5 adds `WalkInIntent`, admitted
`WalkInJourney`, segment standing claims, dynamic passes, assigned-driver
boarding, alighting evidence, and Trip progress. Phase 8 adds
`TripLocationSample` and removes the obsolete Seat/device schema completely.
See the [Phase 3 report](./framework/PHASE_3_TOPOLOGY_AND_INVENTORY.md),
[Phase 4 report](./framework/PHASE_4_RESERVED_JOURNEYS.md), and
[Phase 5 report](./framework/PHASE_5_BOARDING_AND_WALKIN.md).

---

## ⚙️ npm Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server on `0.0.0.0:3000` |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run realtime` | Start standalone Socket.io service on port `4000` |
| `npm run db:seed` | Seed the database with demo data |
| `npm run lint` | Zero-warning Architecture v2/new-code ESLint gate |
| `npm run lint:legacy` | Report the inherited full-repository lint baseline |
| `npm run typecheck` | Run the strict TypeScript check |
| `npm test` / `npm run test:unit` | Run pure unit/specification tests |
| `npm run test:architecture` | Enforce Architecture v2 dependency boundaries |
| `npm run test:integration` | Run guarded tests against dedicated PostgreSQL (`*_test`) |
| `npm run test:e2e` | Run Playwright browser tests against a prepared isolated environment |
| `npm run verify` | Run the fast non-database Architecture v2 gate |

---

## 🔒 Security Direction

The Phase 2 shared security foundation is documented in
[`framework/PHASE_2_SHARED_FOUNDATION.md`](./framework/PHASE_2_SHARED_FOUNDATION.md).
Implemented controls and honest limitations are recorded in
[`framework/FINAL_SECURITY_EVIDENCE.md`](./framework/FINAL_SECURITY_EVIDENCE.md).

- **JWT sessions** stored in HTTP-only cookies (`fyp_session`) — inaccessible to JavaScript
- **QR tokens** have explicit Reserved/Walk-in/Alighting purposes and short expiry; rotation reduces replay risk but does not guarantee screenshot prevention
- **QR scanning** initializes the available browser camera; it uses native QR detection where supported and the maintained `qr-scanner` decoder fallback otherwise. Token paste/copy remains visibly restricted to development/demo use
- **Internal jobs and realtime publication** authenticate bounded, validated requests in every environment
- **Reserved concurrency** is enforced by unique seat/TripSegment claims in PostgreSQL transactions
- **Walk-in concurrency** locks every requested TripSegment before capacity check and claim

---

## 📐 Design Decisions

See [`NOTES.md`](./NOTES.md) for a full list of assumptions and design decisions, including:
- Why PostgreSQL is the intentional database platform
- How the realtime service is architecturally decoupled from Next.js
- Directional ordered Stops and journey-aware reserved/standing capacity
- Reserved versus non-guaranteed Walk-in passes
- GPS simulator telemetry, removed seat-device scope, and website-only delivery

## 📚 Final release evidence

- [Canonical product specification](./framework/APP_SPECIFICATION.md)
- [Technical architecture](./framework/ARCHITECTURE.md)
- [Individual documentation scope](./framework/INDIVIDUAL_DOCUMENTATION_SCOPE.md)
- [Final ERD](./framework/FINAL_ERD.md) and [runtime architecture](./framework/FINAL_RUNTIME_ARCHITECTURE.md)
- [Passenger sequences](./framework/FINAL_PASSENGER_SEQUENCES.md) and [fleet/GPS sequences](./framework/FINAL_FLEET_SEQUENCES.md)
- [Security](./framework/FINAL_SECURITY_EVIDENCE.md), [concurrency](./framework/FINAL_CONCURRENCY_EVIDENCE.md), and [testing evidence](./framework/FINAL_TESTING_EVIDENCE.md)
- [Demo script](./framework/FINAL_DEMO_SCRIPT.md), [manual checklist](./framework/MANUAL_DEMO_CHECKLIST.md), and [viva guide](./framework/FINAL_VIVA_GUIDE.md)
- [Public/source claim register](./framework/FINAL_SOURCE_REGISTER.md)

## ⚠️ Prototype limitations

- GPS input is simulated and explicitly labelled; no physical GPS hardware is deployed.
- Demo schedules, travel durations, coordinates, capacities, people and demand are synthetic.
- Numbered seat labels and QR validation are proposed operational changes, not current TAR UMT practice.
- TAR UMT SSO, production deployment approval, penetration testing, formal accessibility certification, large-scale load testing, backups and operational monitoring remain outside verified scope.
- Camera scanning uses standard camera APIs with native-or-worker QR decode; current Chromium/Edge is the primary demo target and actual browser/hardware results must be recorded in the manual checklist.

---

## 📁 Project Structure

```
FYPBusSystem/
├── app/
│   ├── admin/          # Admin dashboard page
│   ├── driver/         # Driver dashboard page
│   ├── student/        # Student dashboard page
│   ├── login/          # Login page
│   ├── register/       # Registration page
│   ├── api/            # REST API routes
│   │   ├── admin/      # Admin-only endpoints (buses, routes, cron)
│   │   ├── auth/       # Login / logout / me
│   │   ├── bookings/   # Student booking CRUD
│   │   ├── trips/      # Trip listing & management
│   │   ├── appeals/    # Penalty appeal submission & review
│   │   ├── penalties/  # Penalty listing
│   │   ├── notifications/ # Notification read/unread
│   │   └── analytics/  # Aggregated analytics data
│   ├── globals.css     # Global styles, responsive and focus rules
│   ├── layout.tsx      # Root website layout and metadata
│   └── page.tsx        # Landing page
├── components/
│   ├── Navbar.tsx      # Cross-portal navigation
│   ├── Modal.tsx       # Accessible shared dialog primitive
│   └── SeatGrid.tsx    # Journey-specific seat selection visual
├── src/features/
│   ├── bookings/ui/    # Student journey and reservation UI
│   ├── boarding/ui/    # Driver operations and pass/scanner UI
│   ├── fleet/ui/       # Admin Stop/Route/Bus composition
│   ├── location/ui/    # Persisted telemetry and monitoring UI
│   └── penalties/ui/   # Student/admin appeal UI
├── lib/
│   ├── auth.ts         # JWT helpers & getCurrentUser()
│   ├── prisma.ts       # Prisma client singleton
│   ├── realtime-client.ts # Server-side HTTP bridge to realtime service
│   ├── theme.tsx       # Theme provider
│   └── validations.ts  # Zod schemas
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── seed.ts         # Demo data seeder
├── realtime/
│   └── server.js       # Standalone Socket.io + cron service
├── proxy.ts             # Optimistic JWT role redirects
└── package.json
```

---

## 📄 License

This project is submitted as a Final Year Project for academic assessment at **TAR UMT**. All rights reserved.
