# 🚌 TAR UMT Shuttle — Campus Shuttle Booking & Live Operations System

> **Final Year Project (FYP)** — A responsive web application for directional journey search, segment-aware reserved seating, non-guaranteed walk-in boarding, live simulated-GPS location, and transport operations.

> **Architecture v2 status:** The approved target below is not yet fully
> implemented. Reserved journeys and journey-aware waitlist are now migrated.
> The current prototype still contains legacy boarding/device Seat status, PWA
> artifacts, schedule-interpolated location, and seat-device simulation that are
> scheduled for migration/removal. See the linked audit before treating current
> behavior as product truth.

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
- **Live Seat Matrix** — Real-time seat occupancy view for the assigned trip

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
- **Trip Rooms** — Clients subscribe to `trip:<id>` rooms for targeted push events
- **Scheduled Jobs** — Retry-safe no-show, reminder, waitlist, and optional automatic-alighting triggers
- **Responsive Website** — Mobile-browser friendly, without PWA installability, service workers, or offline caching

---

## 🏗️ Architecture

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
│           Node.js + Express + Socket.io + node-cron         │
│                                                             │
│  POST /emit  →  broadcast to trip:<id> rooms                │
│  Cron (1 min) → /api/admin/cron/no-show                     │
│                  legacy device-health call (remove later)    │
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
| Validation | Zod 4 |
| Icons | Lucide React |

---

## 📦 Prerequisites

- **Node.js** ≥ 20.9 (required by Next.js 16)
- **npm** ≥ 9
- **PostgreSQL** (a reachable development database)

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd FYPBusSystem
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fyp_bus?schema=public"

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

### 3. Set Up the Database

```bash
# Apply the committed PostgreSQL migrations
npx prisma migrate deploy

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

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Demo Accounts

All accounts use the password: **`password123`**

> Phase 3 reseeds students with normalized `@student.tarc.edu.my` addresses.
> Admin and driver accounts use role-specific demo addresses.

| Role | Email | Notes |
|---|---|---|
| Admin | `admin1@admin.tarc.edu.my` | Full admin portal access |
| Driver | `driver1@tarumt.edu.my` | Assigned to even-numbered routes |
| Driver | `driver2@tarumt.edu.my` | Assigned to odd-numbered routes |
| Student | `student1@student.tarc.edu.my` | Credit score: 100 |
| Student | `student2@student.tarc.edu.my` | Credit score: 85 |
| Student | `student3@student.tarc.edu.my` | Credit score: 35 — booking restricted |

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

Phase 3 implements topology/inventory and Phase 4 implements reserved journeys:

```
Stop ── RouteStop ── Route ── Trip ── TripStop ── TripSegment
                              └──── TripSeat ── ReservedSeatSegment ── Booking

User ──┬── Booking ───── Penalty ── PenaltyAppeal
       ├── WaitlistEntry
       ├── Notification
       └── Trip (as driver)

Trip ──── Seat ──── DeviceStatusLog
```

`Stop`, ordered `RouteStop`, `TripStop`, `TripSegment`, and `TripSeat` are now
implemented. `Booking`, `ReservedSeatSegment`, and separate `WaitlistEntry` now
provide segment-aware reservations. `WalkInIntent`, `WalkInJourney`,
`StandingSegmentClaim`, and `TripLocationSample` remain later phases.
`Seat.status` and device models are temporary compatibility and never determine
reserved availability. See the [Phase 3 report](./framework/PHASE_3_TOPOLOGY_AND_INVENTORY.md)
and [Phase 4 report](./framework/PHASE_4_RESERVED_JOURNEYS.md).

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
| `npm test` | Run pure unit/specification tests |
| `npm run test:architecture` | Enforce Architecture v2 dependency boundaries |
| `npm run test:integration` | Run guarded tests against dedicated PostgreSQL (`*_test`) |
| `npm run verify` | Run the fast non-database Architecture v2 gate |

---

## 🔒 Security Direction

The Phase 2 shared security foundation is documented in
[`framework/PHASE_2_SHARED_FOUNDATION.md`](./framework/PHASE_2_SHARED_FOUNDATION.md).
The product-specific items below remain Architecture v2 requirements, not claims
that the prototype already satisfies the full audit:

- **JWT sessions** stored in HTTP-only cookies (`fyp_session`) — inaccessible to JavaScript
- **QR tokens** have explicit Reserved/Walk-in/Alighting purposes and short expiry; rotation reduces replay risk but does not guarantee screenshot prevention
- **QR scanning** uses a real browser camera in the final product; token paste is only a development/demo fallback
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
- GPS simulator telemetry and later seat-device/PWA removal

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
│   ├── globals.css     # Global styles & Tailwind base
│   ├── layout.tsx      # Root layout
│   ├── manifest.ts     # Legacy PWA artifact; scheduled for deletion
│   └── page.tsx        # Landing page
├── components/
│   ├── admin/          # Admin-specific components
│   ├── student/        # Student-specific components
│   ├── BusLocationTracker.tsx # Schedule interpolation; scheduled for replacement
│   ├── DynamicQRModal.tsx
│   ├── Navbar.tsx
│   ├── PenaltyAppealModal.tsx
│   ├── QRScannerModal.tsx
│   └── SeatGrid.tsx
├── lib/
│   ├── auth.ts         # JWT helpers & getCurrentUser()
│   ├── prisma.ts       # Prisma client singleton
│   ├── qr.ts           # QR token generation & verification
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
