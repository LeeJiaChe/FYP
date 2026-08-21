# Final Source Register

**Audit date:** 2026-08-22  
**Purpose:** Classify evidence for active public/product claims. This is not a
replacement for the students' separately prepared academic bibliographies.

## A. Official TAR UMT public sources

| Source | Supported claim | Boundary |
|---|---|---|
| [TAR UMT DSA — Bus Routes](https://www.tarc.edu.my/dsa/a/transportation/bus-routes/) | KL route groups include Wangsa Maju, Teratai Residency, Jalan Genting Klang, Melati Utama and PV10/PV12/PV13/PV15; public direction text names locations used by the final seed | Does not validate prototype times, durations, coordinates, buses, capacities or passenger workflows |
| [TAR UMT DSA — Bus Schedule](https://www.tarc.edu.my/dsa/a/transportation/bus-schedule/) | TAR UMT publishes period-specific schedules and points users to current service updates | Seed uses relative synthetic times and does not reproduce or claim an official schedule |
| [TAR UMT DSA — Latest update](https://www.tarc.edu.my/dsa/a/transportation/latest-update/) | DSA publishes channels for current shuttle updates | Does not prove internal dispatch, spreadsheet, identity or reservation practices |
| [TAR UMT sustainable transportation](https://sustainability.tarc.edu.my/actions-initiatives/sustainable-transportation) | Public shuttle coverage includes the named KL residential/transit areas | General institutional context only |

## B. Academic publications

No peer-reviewed publication is used as evidence for current TAR UMT operating
facts in active engineering documentation. Literature claims for Chapters 2–7
must be selected, read and cited in the separate individual reports; this
register deliberately does not invent findings from unread papers.

## C. TAR UMT institutional repository FYP references

| Source | Legitimate use | Not evidence of |
|---|---|---|
| [Chua, 2022 — Bus Tracking System: Bus Schedule Recommendation](https://eprints.tarc.edu.my/22473/) | Prior TAR UC FYP context for passenger travel-plan/seat-reservation analytics | Current TAR UMT production system or this project's measured effectiveness |
| [Soo, 2018 — TARUC Bus Tracking System](https://eprints.tarc.edu.my/13028/) | Prior institutional project context for GPS tracking and fleet administration | A deployed 2026 system, current internal process, or this implementation |
| [Koh, 2017 — Bus Schedule Service Mobile Application with GPS Tracking](https://eprints.tarc.edu.my/10806/) | Historical comparison for GPS/passenger-count/scheduling concepts | Validation of this project's architecture or sensor scope |
| [Tan, 2021 — School Bus Tracking System](https://eprints.tarc.edu.my/18677/) | Related tracking and QR project context | TAR UMT KL shuttle policy or requirements |

Repository abstracts are secondary context. Restricted full texts must not be
claimed as read unless the student actually obtained and reviewed them.

## D. Owner observation

`APP_SPECIFICATION.md` Section 2.1 records the project owner's observation of
the KL passenger process: free service, queues, no observed advance seat
reservation/normal QR ticket check, possible standing, non-number-selected
seating, delays and uncertainty. These statements must stay labelled owner
observation and must not be promoted to official institutional policy.

## E. Internal project evidence

| Evidence | Supports |
|---|---|
| `prisma/schema.prisma` and migrations | Implemented durable model and database constraints |
| `src/features/**` | Implemented policies/use cases/infrastructure/UI boundaries |
| `tests/unit`, `tests/architecture`, `tests/integration`, `tests/e2e` | Executable behavior and regression evidence within their stated scope |
| GitHub Actions Verification | Clean Node/PostgreSQL/Chromium execution on the recorded commit |
| `prisma/seed.ts` | Synthetic deterministic demo scenarios only |

## Claim audit result

- Current-reality claims remain explicitly owner-observed.
- No active documentation claims TAR UMT already operates the proposed
  reservation, no-show, credit, appeal, QR, or GPS system.
- The final seed uses verified public location names but labels Routes as
  **Demo schedule:**; its time, duration, coordinate, capacity and demand data
  are prototype-only.
- No spreadsheet/internal dispatch claim is made.
- Historical phase/audit references remain historical and are not converted
  into current academic sources.
