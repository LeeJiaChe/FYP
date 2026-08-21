# Final Runtime Architecture

```mermaid
flowchart LR
  subgraph Browser[Responsive browser]
    Student[Student portal]
    Driver[Driver portal]
    Admin[Admin portal]
  end

  subgraph Next[Next.js 16 App Router]
    HTTP[Pages and thin Route Handlers]
    Features[Feature application/domain layer]
    Ingest[Authenticated location ingestion]
  end

  DB[(PostgreSQL 16\nDurable source of truth)]
  RT[Standalone Socket.io process\nAuthenticated rooms + scheduled triggers]
  Sim[GPS simulator\nSIMULATED source]

  Browser -->|HTTPS fetch/mutation| HTTP
  HTTP --> Features
  Features -->|Prisma transactions/queries| DB
  Features -->|post-commit bounded invalidation| RT
  RT -->|trip/location/occupancy changed| Browser
  Browser -->|event causes HTTP refetch| HTTP
  Sim -->|trusted request| Ingest
  Ingest --> Features
  Ingest -->|persist sample| DB
  Ingest -->|location.changed after commit| RT
  RT -->|trusted reconciliation/retention/simulator trigger| HTTP
```

The browser never accesses PostgreSQL directly. Socket.io transports minimal,
non-authoritative invalidations; missing events are recovered by HTTP refetch.
The simulator uses the same source-neutral ingestion use case intended for a
future physical GPS adapter.

```mermaid
flowchart LR
  Lee[Passenger Reservation & Boarding\nindividual documentation focus]
  Shared[Shared Trip / TripStop / TripSegment /\nTripSeat / capacity / progress contracts]
  Wong[Fleet Operations & Live Tracking\nindividual documentation focus]
  Lee <--> Shared <--> Wong
```

This second diagram is an academic explanation of integration inside one
application. It does not create separate runtimes, databases, repositories, or
exclusive implementation-ownership claims.
