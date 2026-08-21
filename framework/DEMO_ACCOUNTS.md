# Demo Accounts and Seed Scenarios

> **DEMO / DEVELOPMENT ONLY.** These credentials are public test fixtures, must
> never be deployed as production credentials, and are recreated whenever
> `npm run db:seed` resets the demo database.

The seed uses synthetic people, capacities, coordinates, travel durations and
relative-time Trips. It creates ten directional Route catalogue records across
the five source-based TAR UMT KL families: Wangsa Maju, Teratai Residency,
Jalan Genting Klang, Melati Utama and the PV10/PV12/PV13 corridor. Published
stop names are source-based; route topology is limited to the verified subset.
The relative Trip times, coordinates, vehicle assignments and passenger records
are prototype data—not an official timetable, coordinate feed or university
operational record. PV15 and PV16 are intentionally not active Stops because
the current semester schedule states they are no longer boarding locations.

The reset creates thirteen Trip snapshots. One assigned Trip is approximately
five minutes from origin departure for an immediate boarding demonstration, and
one separate Trip is already DEPARTED with a recent SIMULATED location sample
for immediate live-tracking demonstration.

## Primary demonstration accounts

| Portal | Login | Password | Intended demonstration |
|---|---|---|---|
| Admin | `admin1@admin.tarc.edu.my` | `admin1` | Fleet, scheduling, monitoring, analytics, pending appeal |
| Driver | `driver1@tarumt.edu.my` | `password123` | Assigned Trip, progress, manifest, manual/QR boarding |
| Driver | `driver2@tarumt.edu.my` | `password123` | Second assigned schedule |
| Student | `student1@student.tarc.edu.my` | `password123` | Confirmed reserved journey and pass |
| Student | `student2@student.tarc.edu.my` | `password123` | No-show penalty with pending appeal |
| Student | `student3@student.tarc.edu.my` | `password123` | Credit 35 restriction and pending Walk-in intent |
| Student | `student5@student.tarc.edu.my` | `password123` | Existing WAITING journey |

## Deterministic browser-workflow accounts

| Login | Password | Core mutation performed through UI |
|---|---|---|
| `student6@student.tarc.edu.my` | `password123` | New reserved booking and Reserved Pass |
| `student7@student.tarc.edu.my` | `password123` | Join full-journey waitlist |
| `student8@student.tarc.edu.my` | `password123` | Generate non-guaranteed Walk-in Pass |
| `student9@student.tarc.edu.my` | `password123` | Submit appeal; Admin resolves it |
| `student10@student.tarc.edu.my` | `password123` | Driver manual boarding target |

These identities are deterministic preconditions, not TAR UMT SSO accounts or
evidence of real students, drivers, buses, demand, penalties, or schedules.
