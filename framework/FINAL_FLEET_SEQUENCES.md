# Final Fleet and GPS Sequence Evidence

These diagrams summarize implemented Wong-scope flows and their passenger-side
integration effects.

## A. Trip scheduling

```mermaid
sequenceDiagram
  actor Admin
  participant HTTP as Trip scheduling route
  participant UseCase as Scheduling use case
  participant DB as PostgreSQL
  Admin->>HTTP: Route + Bus + Driver + origin departure
  HTTP->>UseCase: validated Admin request
  UseCase->>DB: BEGIN; advisory-lock Bus/Driver/Route keys
  UseCase->>DB: verify active topology/assets and overlap
  UseCase->>DB: create Trip capacity snapshot
  UseCase->>DB: create ordered TripStops and N-1 TripSegments
  UseCase->>DB: create seats 1..seatedCapacity as TripSeats
  UseCase->>DB: COMMIT
  HTTP-->>Admin: immutable snapshot projection
```

## B. Trip progress

```mermaid
sequenceDiagram
  actor Driver
  participant HTTP as Progress route
  participant UseCase as Authorized progress use case
  participant DB as PostgreSQL
  participant Passenger as Passenger side-effects
  Driver->>HTTP: start/arrive/depart assigned Trip
  HTTP->>UseCase: actor identity, never client driverId
  UseCase->>DB: lock Trip; validate legal transition
  UseCase->>DB: update actualArrival/actualDeparture/passedAt
  UseCase->>DB: append TripStatusHistory when status changes
  UseCase->>Passenger: auto-alight planned drop-offs and process no-shows
  UseCase->>DB: COMMIT
```

## C. Simulated GPS

```mermaid
sequenceDiagram
  participant Sim as Server GPS simulator
  participant HTTP as Trusted ingest API
  participant Location as Location use case
  participant DB as PostgreSQL
  participant RT as Socket.io process
  participant Student as Student map
  Sim->>HTTP: source=SIMULATED coordinates + service secret
  HTTP->>Location: validated sample
  Location->>DB: verify operational Trip; persist TripLocationSample
  Location->>DB: COMMIT
  Location-->>RT: location.changed(tripId)
  RT-->>Student: authorized room invalidation
  Student->>HTTP: refetch latest persisted sample
```

The student interface never infers position from timetable progress. A future
GPS adapter submits the same ingestion contract.

## D. Bus maintenance or retirement

```mermaid
sequenceDiagram
  actor Admin
  participant Fleet as Fleet use case
  participant Cancel as Trip cancellation coordinator
  participant DB as PostgreSQL
  Admin->>Fleet: set Bus MAINTENANCE/RETIRED
  Fleet->>DB: lock Bus and identify future NOT_STARTED Trips
  loop each affected Trip
    Fleet->>Cancel: cancel with operational reason
    Cancel->>DB: lock Trip; append status history
    Cancel->>DB: cancel confirmed bookings/waiters/intents
    Cancel->>DB: release active reserved claims + notifications
  end
  Fleet->>DB: COMMIT
```

ARRIVED Trips remain historical; active BOARDING/DEPARTED service is not
silently cancelled by a fleet status toggle.
