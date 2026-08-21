# Demo Accounts and Seed Scenarios

> **DEMO / DEVELOPMENT ONLY.** These credentials are public test fixtures, must
> never be deployed as production credentials, and are recreated whenever
> `npm run db:seed` resets the demo database.

The seed uses synthetic people, capacities, coordinates, and relative-time
Trips. Route/stop labels are drawn from the current TAR UMT DSA KL route page,
but every Route begins with **Demo schedule:** because its times, durations,
coordinates, vehicle plates, and passenger records are prototype data—not an
official timetable or university operational record.

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
