# Final Architecture v2 ERD

**Status:** Release-candidate reference diagram  
**Source:** `prisma/schema.prisma` plus committed PostgreSQL constraints

```mermaid
erDiagram
  User ||--o{ Booking : reserves
  User ||--o{ WaitlistEntry : queues
  User ||--o{ WalkInIntent : requests
  User ||--o{ WalkInJourney : boards
  User ||--o{ Penalty : receives
  User ||--o{ Notification : receives
  User ||--o{ Trip : drives
  User ||--o{ TripStatusHistory : acts

  Stop ||--o{ RouteStop : appears_in
  Route ||--o{ RouteStop : orders
  Route ||--o{ Trip : schedules
  Bus ||--o{ Trip : supplies_snapshot
  Stop ||--o{ TripStop : source_for
  Trip ||--|{ TripStop : snapshots
  Trip ||--|{ TripSegment : contains
  Trip ||--|{ TripSeat : inventories
  Trip ||--o{ Booking : carries
  Trip ||--o{ WaitlistEntry : queues
  Trip ||--o{ WalkInIntent : accepts_intent
  Trip ||--o{ WalkInJourney : carries_standing
  Trip ||--o{ TripStatusHistory : audits
  Trip ||--o{ TripLocationSample : records

  TripStop ||--o{ TripSegment : segment_endpoint
  TripStop ||--o{ Booking : boarding_or_dropoff
  TripStop ||--o{ WaitlistEntry : boarding_or_dropoff
  TripStop ||--o{ WalkInIntent : boarding_or_dropoff
  TripStop ||--o{ WalkInJourney : boarding_or_dropoff

  TripSeat ||--o{ Booking : guarantees
  Booking ||--|{ ReservedSeatSegment : claims
  TripSeat ||--o{ ReservedSeatSegment : occupied_on
  TripSegment ||--o{ ReservedSeatSegment : reserved_capacity

  WalkInIntent ||--o| WalkInJourney : becomes_when_admitted
  WalkInJourney ||--|{ StandingSegmentClaim : claims
  TripSegment ||--o{ StandingSegmentClaim : standing_capacity

  Booking ||--o| Penalty : incurs_at_most_one
  Penalty ||--o| PenaltyAppeal : appealed_at_most_once
  User ||--o{ PenaltyAppeal : submits_or_reviews
```

## Reading the shared boundary

- Wong report emphasis: Stop, Route, RouteStop, Bus, Trip, TripStop,
  TripSegment, TripSeat, TripStatusHistory, and TripLocationSample.
- Lee report emphasis: Booking, ReservedSeatSegment, WaitlistEntry,
  WalkInIntent, WalkInJourney, StandingSegmentClaim, Penalty, PenaltyAppeal,
  Notification, and the passenger aspect of User.
- Trip, TripStop, TripSegment, TripSeat, User, and Bus capacity snapshots are
  shared integration concepts. The emphasis is documentation scope, never a
  claim of sole coding ownership.

The removed `Seat`, `SeatStatus`, `DeviceStatusLog`, and `DeviceSignal` models
are intentionally absent. Several same-Trip composite foreign keys and partial
indexes are implemented in migration SQL even where Mermaid cannot express
them.
