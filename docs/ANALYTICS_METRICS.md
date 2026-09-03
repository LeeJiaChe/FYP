# Operations Analytics & Decision-Support Metric Definitions

This document outlines the authoritative definitions, mathematical formulations, sample eligibility boundaries, and administrative decision utility for all operational metrics calculated within the **TAR UMT Bus System - Operations Intelligence Dashboard**.

> **Academic Disclosure**: Operational analytics reflect records generated within this prototype system using Malaysia Time (`Asia/Kuala_Lumpur`, UTC+8) and are designed for managerial decision support and FYP defense verification.

---

## 1. Route Direction & Network Semantics

In accordance with the transit architecture, directional metrics and filters are defined strictly as:

* **`OUTBOUND · From TAR UMT`**:
  Shuttle journey departing from the TAR UMT main campus terminal towards an external residential or transit destination (e.g., *TAR UMT Main Campus $\to$ PV18 / Teratai*).
* **`INBOUND · To TAR UMT`**:
  Shuttle journey departing from an external residential or transit location returning towards the TAR UMT campus terminal (e.g., *PV18 / Teratai $\to$ TAR UMT Main Campus*).

---

## 2. Core KPIs & Formulations

### 2.1. Boarded Passengers (Actual Ridership)
* **Definition**: The total number of distinct passenger journeys who physically boarded a shuttle in the selected evaluation period.
* **Formula**:
  $$\text{Boarded Passengers} = \sum (\text{Bookings with } \text{checkedInAt} \neq \text{null}) + \sum (\text{WalkInJourney records})$$
* **Eligible Denominator**: Sum across all operated Trips (`status \in \{\text{BOARDING}, \text{DEPARTED}, \text{ARRIVED}\}` or origin departure recorded).
* **Exclusions**: Unchecked confirmed bookings, cancelled bookings, waitlist entries, pending walk-in intents.
* **Decision Utility**: Identifies gross passenger volume transported across service corridors to assess overall transit demand.
* **Limitations**: Does not capture passengers who boarded without scanning/manual check-in (unauthorized boarders).

---

### 2.2. Reserved Seat-Segment Utilization
* **Definition**: The proportion of available seated capacity across all route segments that was claimed by confirmed passenger reservations.
* **Formula**:
  $$\text{Utilization} = \frac{\sum \text{ReservedSeatSegments}}{\sum (\text{Trip.seatedCapacity} \times |\text{TripSegments}|)} \times 100\%$$
  *(Returns `null` if denominator is 0)*
* **Eligible Denominator**: Total seat-segments on operated Trips in the selected period.
* **Exclusions**: Excludes cancelled Trips, administrative rollover cleanups, and future unperformed Trips to prevent artificial denominator dilution.
* **Decision Utility**: Guides timetable scheduling and vehicle sizing (e.g. assigning 20-seat vs 30-seat shuttles) based on multi-stop segment loads.
* **Limitations**: Measures reservation capacity claims; does not include standing walk-ins (which are tracked separately via standing claims).

---

### 2.3. On-Time Departure Rate
* **Definition**: The percentage of measured Trip departures from the origin stop (`position = 0`) that departed within the approved 5-minute operational tolerance window.
* **Formula**:
  $$\text{On-Time Rate} = \frac{|\{t \mid t.\text{actualDeparture} \le t.\text{plannedDeparture} + 5\text{ min}\}|}{|\{t \mid t.\text{actualDeparture} \neq \text{null}\}|} \times 100\%$$
  *(Returns `null` if denominator is 0)*
* **Tolerance Constant**: `ON_TIME_TOLERANCE_MINUTES = 5`
* **Exclusions**: Trips with no recorded origin departure timestamp, and administrative prototype cleanup cancellations.
* **Decision Utility**: Evaluates timetable realism, turnaround buffer sufficiency, and driver punctuality.
* **Limitations**: Measures origin dispatch punctuality; intermediate stop traffic congestion delays are reflected in overall trip durations.

---

### 2.4. Average & Maximum Departure Delay
* **Definition**: Mean delay (in minutes) past the planned departure time for all measured origin departures.
* **Formula**:
  $$\text{Delay}_t = \max(0, \text{actualDeparture}_t - \text{plannedDeparture}_t)$$
  $$\text{Avg Delay} = \frac{\sum \text{Delay}_t}{|\{t \mid t.\text{actualDeparture} \neq \text{null}\}|}$$
  *(Returns `null` if sample count is 0)*
* **Early Departure Rule**: Early departure does not produce negative delay; clamped at $0$ minutes.
* **Decision Utility**: Pinpoints persistent corridor dispatch delays requiring driver rescheduling or terminal layover adjustment.

---

### 2.5. Reservation No-Show Rate
* **Definition**: The proportion of finalized reservation outcomes where the student reserved a seat but failed to check in or cancel.
* **Formula**:
  $$\text{No-Show Rate} = \frac{|\{b \mid b.\text{status} = \text{'NO\_SHOW'}\}|}{|\{b \mid b.\text{status} \in \{\text{'NO\_SHOW'}, \text{'COMPLETED'}\} \lor (b.\text{checkedInAt} \neq \text{null} \land b.\text{status} = \text{'CONFIRMED'})\}\}| \times 100\%$$
  *(Returns `null` if eligible outcomes is 0)*
* **Eligible Denominator**: All bookings with a definitive attendance outcome.
* **Exclusions**: Future unperformed `CONFIRMED` bookings and user-cancelled bookings (`CANCELLED`).
* **Decision Utility**: Informs the penalty enforcement threshold, student reminder notification timing, cancellation encouragement, and waitlist release effectiveness.
* **Limitations**: Sample confidence requires at least 10 eligible outcomes before triggering automated warnings.

---

### 2.6. Unserved Demand & Finalized Waitlist Promotion Rate
* **Unserved Demand**: The number of student transit attempts that could not be accommodated due to capacity depletion.
  $$\text{Unserved Demand} = |\{w \mid w.\text{status} = \text{'EXPIRED'}\}| + |\{i \mid i.\text{status} = \text{'REJECTED\_FULL'}\}|$$
* **Finalized Waitlist Promotion Rate**: Proportion of definitive waitlist requests that successfully secured a seat:
  $$\text{Promotion Rate} = \frac{|\{w \mid w.\text{status} = \text{'PROMOTED'}\}|}{|\{w \mid w.\text{status} = \text{'PROMOTED'}\}| + |\{w \mid w.\text{status} = \text{'EXPIRED'}\}|} \times 100\%$$
  *(Returns `null` if finalized outcomes is 0)*
* **Exclusions**: `WAITING` entries remain pending (active demand) and are not finalized; user-cancelled waitlists (`CANCELLED`) represent voluntary withdrawal and are excluded from the outcome denominator.
* **Decision Utility**: Quantifies unmet student demand per Service Line to justify additional bus frequency or fleet expansion.

---

### 2.7. Operational Cancellations & Administrative Exclusions
* **Definition**: Cancelled Trips that represent actual shuttle service operational failures.
* **Exclusion Rule**: Trips cancelled with authoritative reasons matching administrative maintenance/rollover (e.g. `"Stale prototype..."`, `"Shared development migration..."`) are classified as `excludedAdministrativeCleanupTrips`.
* **Excluded Metrics**: Administrative cleanup trips are strictly excluded from:
  1. `operatedTrips` and `completedTrips`
  2. `reservedSeatSegmentUtilization` (overview, line, direction, fleet)
  3. `onTimeDepartureRate` and `actualDepartureSamples`
  4. `averageDepartureDelayMinutes` and `maxDepartureDelayMinutes`
  5. `fleetPerformance` (operated trips and service hours)
  6. `operationalCancellationCount`
* **Decision Utility**: Protects historical service reliability metrics from distortion caused by system data cleanup activities while preserving complete audit logs.

---

### 2.8. Fleet Asset Utilization & Service Hours
* **Definition**: Actual active operating time logged per shuttle bus.
* **Formula**:
  $$\text{Actual Service Duration} = \text{terminal TripStop.actualArrival} - \text{origin TripStop.actualDeparture}$$
* **Exclusions**: Trips lacking authentic origin departure or terminal arrival timestamps return `null` rather than estimated/planned durations.
* **Decision Utility**: Balances bus wear-and-tear across the fleet and schedules timely vehicle maintenance.

---

## 3. Rule-Based Operational Insights & Thresholds

The dashboard evaluates deterministic, explainable business rules with minimum sample-size guards:

| Insight Type | Severity | Threshold Conditions | Sample Guard | Recommended Admin Action |
| :--- | :--- | :--- | :--- | :--- |
| **`CAPACITY_PRESSURE`** | `warning` | Utilization $\ge 80\%$ **AND** Unserved Demand $\ge 1$ | Operated Trips $\ge 3$ | Review peak-period departure frequency or assign higher-capacity bus. |
| **`RELIABILITY`** | `warning` / `danger` | On-Time Rate $< 80\%$ (or $< 60\%$ for `danger`) | Departure Samples $\ge 3$ | Adjust terminal layover times or investigate corridor traffic bottlenecks. |
| **`NO_SHOW`** | `warning` / `danger` | No-Show Rate $\ge 10\%$ (or $\ge 20\%$ for `danger`) | Eligible Outcomes $\ge 10$ | Review credit deduction policy and send student reminder notifications. |
| **`INSUFFICIENT_DATA`** | `info` | Completed Trips $< 3$ in selected period | — | Acknowledge baseline data accumulation; avoid premature schedule shifts. |

---

## 4. FYP Defense Questions & Answers

1. **Why is Reserved Seat-Segment Utilization better than raw bus load?**
   * *Answer*: Shuttle routes have multiple stops where passengers alight and board. Simple passenger count divided by bus capacity misrepresents multi-stop lines (e.g. 20 passengers traveling only segment 1-2, and 20 different passengers traveling segment 2-3 on a 20-seat bus is 100% segment utilization, not 200% overloaded).
2. **Why does 0% not mean "No Data"?**
   * *Answer*: A rate of 0% mathematically indicates zero successes out of a positive number of attempts (e.g. 0 on-time departures out of 5 trips). If 0 departures occurred, the rate is mathematically undefined ($0/0$), represented honestly as `null` (`—`) to avoid misleading decision-makers.
3. **How does the system prevent double-counting unserved passengers?**
   * *Answer*: If a student enters the waitlist and is later promoted to a booking, their waitlist status becomes `PROMOTED` (not `EXPIRED`) and their booking is tracked as either boarded or no-show, preventing their request from being counted as both demand and unserved failure.
4. **What is the distinction between OUTBOUND and INBOUND?**
   * *Answer*: `OUTBOUND` originates from the TAR UMT main campus heading towards external stops (From TAR UMT), whereas `INBOUND` originates from external stops returning to the TAR UMT campus (To TAR UMT).
