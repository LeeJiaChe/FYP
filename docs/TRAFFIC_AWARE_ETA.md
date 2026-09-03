# Traffic-Aware Shuttle ETA Integration

## 1. Overview and Operational Purpose

The **Traffic-Aware Shuttle ETA Integration** connects the TAR UMT Campus Shuttle Management System with the **Google Maps Platform Routes API (`Compute Routes` v2)** to deliver real-time, traffic-aware arrival estimates for operational shuttle trips.

Rather than decorative map polylines, this integration answers critical operational questions:
- **Student ("My Journey")**: *"When will the shuttle arrive at MY specific boarding stop?"* (and once checked in, *"When will I reach my drop-off destination?"*).
- **Admin ("Live Fleet Operations")**: *"When will this active shuttle reach its next stop and terminal stop, how does current road traffic affect travel duration, and how does that compare against timetable schedules?"*

---

## 2. API Contract & Google Maps Platform Requirements

- **Official API Endpoint**:
  `POST https://routes.googleapis.com/directions/v2:computeRoutes`
- **Travel Mode**: `DRIVE`
- **Routing Preference**: `TRAFFIC_AWARE` (calculates durations factoring in current road traffic conditions, congestion, and delays).
- **Waypoint Optimization**: `optimizeWaypointOrder: false` (strictly forbidden; the campus shuttle route topology and stop snapshot sequence is authoritative).
- **Minimal Field Mask (`X-Goog-FieldMask`)**:
  `routes.duration,routes.staticDuration,routes.distanceMeters,routes.legs.duration,routes.legs.staticDuration,routes.legs.distanceMeters`
- **Google Attribution Requirement**:
  Per Google Maps Platform Terms of Service, when displaying content from Routes API without a Google Map, attribution to Google is required. The UI explicitly renders "Powered by Google Routes" / "Google Routes" alongside traffic-aware estimates.

---

## 3. Waypoint Cost Guard & Topology Audit

Before implementation, an audit of all active routes was conducted:
- **Wangsa Maju Inbound/Outbound**: 5 stops
- **Teratai Residency Inbound/Outbound**: 5 stops
- **Jalan Genting Klang Inbound/Outbound**: 4 stops
- **Melati Utama Inbound/Outbound**: 5 stops
- **PV10/PV12/PV13 Corridor Inbound/Outbound**: 5 stops

**Finding**: The maximum stop count across all routes in the system is **5 stops**.
In a Compute Routes request from current shuttle location to terminal, intermediate stops number at most 3 stops (well below Google's 25-intermediate-waypoint limits and cost thresholds). Waypoints follow authoritative remaining stops in order without truncation or reordering.

---

## 4. Architectural Boundaries & Safe-by-Default Operation

### 4.1 Server-Side Key Security
- `GOOGLE_MAPS_ROUTES_API_KEY`: Server-only secret. It is **never** prefixed with `NEXT_PUBLIC_*` and is never sent to the browser or leaked in API responses or error logs.
- `GOOGLE_TRAFFIC_ETA_ENABLED`: Defaults to `"false"` in `.env.example`. When disabled, the application builds, starts, and runs normally, falling back cleanly to schedule estimates without making external network calls.

### 4.2 In-Memory Caching & Throttling (Zero DB Migration)
- **Database Safety**: No database tables or columns were created. Google responses are ephemeral and must not pollute the relational schema.
- **Cache TTL (`trafficEtaCacheMs = 45,000 ms`)**: Successful trip ETAs are cached in server memory for 45 seconds. Repeated requests within 45 seconds return the cached estimate with zero external API calls.
- **Failure Throttle Cache (`trafficEtaFailureCacheMs = 15,000 ms`)**: If Google Routes API fails (HTTP 4xx/5xx, timeout, or network glitch), the failure reason is cached for 15 seconds. Repeated calls during this window immediately return the schedule estimate fallback to avoid hammering Google or consuming quota.
- **In-Flight Request Deduplication**: Concurrent requests for the same `tripId` share a single in-flight promise, preventing thundering-herd API spikes.
- **Timeout (`trafficEtaTimeoutMs = 3,000 ms`)**: An `AbortController` enforces a 3-second hard timeout on external Google requests.
- **Separation from GPS Simulator**: The background GPS simulator loop (`gpsSimulatorIntervalMs = 5000 ms`) remains completely independent and **never** calls Google Routes API. ETA is queried strictly on-demand by HTTP consumers.

---

## 5. Domain Metrics & Mathematical Formulations

### 5.1 Traffic Impact Minutes
Exposes the road traffic penalty compared to static free-flow traffic:
$$\text{trafficImpactMinutes} = \max\left(0, \text{round}\left(\frac{\text{trafficDurationSeconds} - \text{staticDurationSeconds}}{60}\right)\right)$$
*Rule*: Never labeled "schedule delay"; this metric measures current traffic conditions.

### 5.2 Schedule Timetable Variance
Measures performance relative to the published timetable:
$$\text{scheduleVarianceMinutes} = \text{round}\left(\frac{\text{estimatedArrivalTimestamp} - \text{TripStop.plannedArrivalTimestamp}}{60,000}\right)$$
- **Positive ($> 0$)**: Running later than timetable schedule.
- **Negative ($< 0$)**: Running ahead of timetable schedule.
- **Zero ($= 0$)**: Exactly on timetable schedule.

---

## 6. Telemetry Freshness & Fallback Modes

When Google Routes API or live telemetry is unavailable, the system never returns 500; it falls back seamlessly to `SCHEDULE_ESTIMATE` with a typed `fallbackReason`:
- `DISABLED`: Integration disabled via `GOOGLE_TRAFFIC_ETA_ENABLED="false"`.
- `NO_API_KEY`: Key missing or empty while enabled.
- `NO_LOCATION`: No `TripLocationSample` recorded for this active trip.
- `STALE_LOCATION`: Latest location sample is older than `trafficEtaMaxLocationAgeMs` (60 seconds).
- `API_TIMEOUT`: External Google API call exceeded 3,000 ms.
- `API_ERROR`: Google returned HTTP error or network failure.
- `NO_ROUTE`: Google returned 0 routes.

### Schedule Fallback Calculation
$$\text{estimatedArrival} = \text{TripStop.plannedArrival} + (\text{Trip.delayMinutes} \times 60,000)$$

---

## 7. User Journeys & Endpoints

### 7.1 Student Journey (`GET /api/bookings/:id/eta`)
- Validates student ownership (`booking.studentId === actor.userId`); rejects unauthorized access with 404.
- Target stop selection:
  - **Before Check-in**: Resolves `booking.boardingTripStopId`.
  - **After Check-in (`checkedInAt`)**: Automatically advances target to `booking.dropOffTripStopId`.
- If the target stop has already departed, returns `isPassed: true` and `minutesAway: null` rather than a misleading distance estimate.
- Renders `StudentBookingEtaCard` in Student Home and My Journeys tabs.

### 7.2 Admin Fleet Operations (`GET /api/trips/:id/eta`)
- Restricted to `ADMIN` (and assigned `DRIVER`); students receive 403 Forbidden.
- Returns comprehensive multi-stop estimates: Next Stop ETA, Terminal ETA, Traffic Impact (+X min), Schedule Variance (+X min / ahead), location freshness, and simulated telemetry disclosure.
- Renders `AdminTripEtaPanel` in Live Fleet Operations monitoring tab.

---

## 8. Academic Honesty & Telemetry Disclosure

Because this prototype operates using simulated GPS coordinates along TAR UMT bus corridors, the UI explicitly discloses:
- **"Based on simulated shuttle location"** whenever `locationSource === "SIMULATED"`.
- The system never claims that TAR UMT has deployed physical GPS hardware trackers or provides fake live hardware guarantees.
