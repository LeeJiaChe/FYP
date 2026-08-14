# 🚌 TAR UMT Shuttle — Campus Bus Booking & Live Seat Monitoring System

> **Final Year Project (FYP)** — A full-stack digital campus shuttle management platform for TAR UMT, featuring real-time seat monitoring, anti-fraud QR boarding, automated waitlists, and a credit-based penalty system.

---

## ✨ Features

### 🎓 Student Portal
- **Seat Booking Wizard** — Book seats with a guided `Route → Date → Segment → Seat` flow
- **Dynamic QR Boarding Pass** — Auto-refreshing 60-second JWT QR codes that prevent screenshot fraud
- **Waitlist Management** — Automatically promoted when a seat becomes available
- **Booking History** — View all past and upcoming bookings
- **Credit Score** — Tracks reliability; drops on no-shows, triggers booking restrictions
- **Penalty Appeals** — Submit appeals against no-show penalties with written justification
- **Notifications** — In-app alerts for booking confirmations, trip delays, cancellations, promotions, and penalties

### 🚗 Driver Portal
- **Active Trip Dashboard** — View assigned trips and current trip status
- **QR Code Scanner** — Scan (paste) student boarding QR tokens to mark check-ins
- **Trip Status Control** — Update trip status (Boarding → Departed → Arrived)
- **Live Seat Matrix** — Real-time seat occupancy view for the assigned trip

### 🛡️ Admin Portal
- **Fleet Management** — Full CRUD for buses (`ACTIVE`, `MAINTENANCE`, `RETIRED`) with cascade trip cancellation on status change
- **Route Management** — Create/edit directional routes with named stops (JSON)
- **Trip Scheduling** — Schedule trips, assign buses and drivers, update status and delay reasons
- **Driver Management** — Create driver accounts and assign them to trips
- **Real-Time Seat Matrix** — Live per-trip seat grid showing `AVAILABLE`, `RESERVED`, `CHECKED_IN`, `NO_SHOW`, and simulated IoT sensor health signals
- **Analytics Dashboard** — Historical aggregations for ridership, route demand, and fleet utilisation using Recharts
- **Penalty & Appeal Review** — Approve or reject student penalty appeals with admin comments

### ⚡ Real-Time Infrastructure
- **Standalone Socket.io Service** — Decoupled from Next.js; runs on port `4000`
- **Trip Rooms** — Clients subscribe to `trip:<id>` rooms for targeted push events
- **1-Minute Cron Jobs** — Automated no-show detection and IoT device health simulation
- **PWA Support** — Web app manifest and Apple meta tags for mobile home-screen installation

---

## 🏗️ Architecture

The current-state audit and the normative target architecture are documented in
[`framework/ARCHITECTURE_AUDIT_2026-08-14.md`](./framework/ARCHITECTURE_AUDIT_2026-08-14.md)
and [`framework/ARCHITECTURE.md`](./framework/ARCHITECTURE.md). The diagram below
describes the existing runtime at a high level, not the completed Architecture v2.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / PWA                        │
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
│                  /api/admin/cron/device-health              │
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

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@tarumt.edu.my` | Full admin portal access |
| Driver | `driver1@tarumt.edu.my` | Assigned to even-numbered routes |
| Driver | `driver2@tarumt.edu.my` | Assigned to odd-numbered routes |
| Student | `student1@tarumt.edu.my` | Credit score: 100 |
| Student | `student2@tarumt.edu.my` | Credit score: 85 |
| Student | `student3@tarumt.edu.my` | Credit score: 35 — **booking restricted**, has a pending penalty appeal |
| Student | `student4@tarumt.edu.my` | Credit score: 100 — waitlisted on Route 3 |

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

## 🗄️ Database Schema (ERD Summary)

```
User ──┬── Booking ──── Seat ──── Trip ──── Route
       │        └───── Penalty ── PenaltyAppeal
       ├── Notification
       └── Trip (as driver)

Trip ──── Seat ──── DeviceStatusLog
```

Key models: `User`, `Bus`, `Route`, `Trip`, `Seat`, `Booking`, `Penalty`, `PenaltyAppeal`, `Notification`, `DeviceStatusLog`

---

## ⚙️ npm Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server on `0.0.0.0:3000` |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run realtime` | Start standalone Socket.io service on port `4000` |
| `npm run db:seed` | Seed the database with demo data |
| `npm run lint` | Run ESLint |

---

## 🔒 Security Design Notes

- **JWT sessions** stored in HTTP-only cookies (`fyp_session`) — inaccessible to JavaScript
- **QR tokens** embed `{ bookingId, seatId, tripId }` and expire after 60 seconds; auto-refreshed every 45 seconds to prevent screenshot sharing
- **Cron endpoints** (`/api/admin/cron/*`) are protected by `x-cron-secret` header in production
- **Realtime `/emit`** endpoint validates `REALTIME_SERVICE_SECRET` in production
- **Race condition safety** — duplicate booking prevention is enforced inside Prisma `$transaction` blocks

---

## 📐 Design Decisions

See [`NOTES.md`](./NOTES.md) for a full list of assumptions and design decisions, including:
- Why PostgreSQL is the intentional database platform
- How the realtime service is architecturally decoupled from Next.js
- Directional route splitting (bidirectional routes from spec → explicit outbound + inbound)
- Waitlist auto-promotion and no-show detection logic
- IoT simulation approach (explicit simulation, not real hardware)

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
│   ├── manifest.ts     # PWA manifest
│   └── page.tsx        # Landing page
├── components/
│   ├── admin/          # Admin-specific components
│   ├── student/        # Student-specific components
│   ├── BusLocationTracker.tsx
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
├── middleware.ts        # JWT auth guard & role-based routing
└── package.json
```

---

## 📄 License

This project is submitted as a Final Year Project for academic assessment at **TAR UMT**. All rights reserved.
