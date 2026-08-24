# Final 8–12 Minute Demo Script

Reset and seed immediately before rehearsal. Use the accounts in
`DEMO_ACCOUNTS.md`; all schedules and people are prototype data.

| Time | Presenter focus | Demonstration |
|---|---|---|
| 0:00–0:40 | Shared | State the observed queue/uncertainty problem, one integrated system, and prototype limitations. |
| 0:40–2:20 | Lee | Log in as `student6`; search the source-based Wangsa Maju → TAR UMT Route by From → To → Date → Departure, choose a journey-specific seat, confirm, and open Reserved Pass. Briefly explain adjacent segment reuse without opening the database. |
| 2:20–3:05 | Lee | Log in as `student7`; join the deterministic full-journey waitlist and show WAITING. |
| 3:05–3:45 | Lee | Log in as `student8`; generate Walk-in Pass and read the non-guarantee statement aloud. |
| 3:45–5:10 | Shared Driver portal | Log in as `driver1`; select assigned Trip, start boarding, show privacy-limited manifest, use camera if manually verified or manual fallback, then show expected alighting/progress. Wong explains assigned Trip/progress; Lee explains passenger processing. |
| 5:10–6:25 | Wong | Log in as Admin; show Stops, directional Routes, Bus capacities/status, Drivers and scheduled Trips. Schedule a valid future Trip and point out generated times and immutable capacity inventory. |
| 6:25–7:10 | Lee | Open Appeals, review the pending passenger context, resolve it, and state exact recorded-point restoration behavior. |
| 7:10–8:10 | Wong | Open Live Monitoring/Track Bus; show **Simulated GPS / Prototype**, sample time/freshness, and explain simulator → authenticated ingest → PostgreSQL → invalidation → refetch. |
| 8:10–9:10 | Shared | Show analytics. Lee explains passenger/no-show demand; Wong explains segment-weighted fleet/capacity and operational views. |
| 9:10–10:00 | Shared | Close with PostgreSQL concurrency, honest limitations, and the integration boundary between the two individual reports. |

## Presenter guardrails

- Do not call prototype times an official TAR UMT timetable.
- Do not describe simulated telemetry as deployed physical GPS.
- Do not say QR is encrypted or guarantee that it speeds boarding.
- Do not describe Walk-in issuance as capacity reservation.
- Do not claim the application, database, or Driver/Admin pages are split between two systems.
- If realtime fails, refresh authoritative HTTP data. If camera recognition fails, use **Copy demo token** on the student pass and the explicitly labelled Driver fallback; it still invokes the real server verification workflow.
