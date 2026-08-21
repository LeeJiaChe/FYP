# Final Passenger Sequence Evidence

These diagrams summarize implemented Lee-scope flows. Realtime publication is
best effort after durable state succeeds.

## A. Reserved booking

```mermaid
sequenceDiagram
  actor Student
  participant HTTP as Next.js booking route
  participant UseCase as Booking use case
  participant DB as PostgreSQL
  participant RT as Realtime process
  Student->>HTTP: From/To/Trip/TripSeat request
  HTTP->>UseCase: validated actor + journey
  UseCase->>DB: BEGIN; lock Trip FOR UPDATE
  UseCase->>DB: reread TripStops, seat and segment claims
  UseCase->>DB: create Booking + ReservedSeatSegment rows
  Note over DB: UNIQUE(tripSeatId, tripSegmentId)
  UseCase->>DB: COMMIT
  UseCase-->>RT: occupancy.changed
  HTTP-->>Student: confirmed reserved journey
```

## B. Walk-in admission

```mermaid
sequenceDiagram
  actor Student
  actor Driver
  participant HTTP as Boarding route
  participant UseCase as Boarding/Walk-in use case
  participant DB as PostgreSQL
  Student->>HTTP: create WalkInIntent/pass
  HTTP-->>Student: non-guaranteed short-lived pass
  Note over DB: Issuance creates zero standing claims
  Driver->>HTTP: scan pass or manual fallback
  HTTP->>UseCase: authorized assigned Driver
  UseCase->>DB: BEGIN; lock Trip and segments in order
  UseCase->>DB: count claims on every journey segment
  alt every segment fits
    UseCase->>DB: create WalkInJourney + StandingSegmentClaims
    UseCase->>DB: mark intent BOARDED; COMMIT
    HTTP-->>Driver: accepted
  else any segment full
    UseCase->>DB: no journey/claims; consistent rejection
    HTTP-->>Driver: FULL
  end
```

## C. Reserved no-show

```mermaid
sequenceDiagram
  actor Driver
  participant Progress as Trip progress use case
  participant NoShow as Authoritative no-show use case
  participant DB as PostgreSQL
  Driver->>Progress: depart/pass TripStop
  Progress->>DB: persist actual progress
  Progress->>NoShow: process candidates at this boarding stop
  NoShow->>DB: lock Trip, Booking and User
  NoShow->>DB: recheck CONFIRMED + not boarded
  NoShow->>DB: NO_SHOW + release ReservedSeatSegments
  NoShow->>DB: unique Penalty + bounded credit + Notification
  NoShow->>DB: promote compatible future waiter; COMMIT
```

Repeated reconciliation calls enter the same use case; `Penalty.bookingId`
uniqueness and locked rereads prevent duplicate deduction or notification.

## D. Appeal

```mermaid
sequenceDiagram
  actor Student
  actor Admin
  participant API as Penalty routes/use cases
  participant DB as PostgreSQL
  Student->>API: submit own penalty appeal
  API->>DB: lock Penalty; create one PENDING appeal
  Admin->>API: approve or reject pending appeal
  API->>DB: lock Appeal, Penalty and User
  alt approved
    API->>DB: APPROVED/OVERTURNED + restore recorded points once
  else rejected
    API->>DB: REJECTED/UPHELD; no restoration
  end
  API->>DB: durable result notification; COMMIT
```
