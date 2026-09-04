# Admin Operations Intelligence

## Authority and boundaries

The implementation follows this fixed authority pipeline:

`Prisma read model -> deterministic metrics -> analytics snapshot -> deterministic signals -> optional Gemini interpretation -> evidence drill-down`

Operational metrics are calculated deterministically from system records. A
rule-based signal engine identifies material operating conditions. Gemini is
then used as a grounded interpretation layer to explain relationships between
verified metrics and provide evidence-linked administrative recommendations.
Operational decisions and writes remain human-controlled.

The initial `GET /api/analytics/intelligence` request returns deterministic
metrics, the snapshot, signals, focus, and Executive Brief inputs without
waiting for Gemini. It performs only a synchronous application-cache lookup:
a hit is returned as `READY`, while a configured cold cache is returned as
`UPDATING`. After the deterministic dashboard has rendered, the client calls
the separate Admin-only `POST /api/analytics/intelligence/interpret` route.
That route rebuilds the server-authoritative snapshot, verifies the requested
fingerprint, and only then awaits grounded interpretation. It never trusts a
client-supplied snapshot and does not use serverless fire-and-forget work.

Gemini does not calculate authoritative operational metrics and does not
execute operational actions. It receives no Prisma Client, arbitrary SQL,
write endpoint, Student name, Student ID, email, appeal/penalty narrative, or
authentication record. The analytics query selects only aggregated journey
attributes and operational identifiers required for the analysis.

All Intelligence routes require an authenticated Admin. Ask requests are
rate-limited, server-side scopes are validated, and only a fixed read-only tool
allowlist can be called:

- `getNetworkPerformance`
- `getServiceLinePerformance`
- `getDemandPressure`
- `getReliabilityBreakdown`
- `getCapacityEvidence`
- `getFleetUtilisation`
- `getPassengerBehaviour`
- `getOriginDestinationDemand`
- `getSignalEvidence`

## Deterministic snapshot

`AnalyticsSnapshot` contains the selected and previous equal-duration periods,
eligible Trip count, data quality, network overview, Service Line/direction
aggregates, MYT time buckets, OD pairs, segment loads, reliability, capacity,
Trip-derived fleet workload, anonymized passenger outcomes, evidence metrics,
current exceptions, and sorted signals.

The comparison is the immediately preceding period with exactly the same
duration and scope. Rate changes are percentage-point changes; count changes
remain counts. A comparison is absent rather than fabricated when its sample is
empty. No claim of statistical significance is made.

The SHA-256 fingerprint is built from an explicit material payload: selected
period and scope, deterministic metrics/comparisons, data-quality state,
Line/direction and time-bucket values, OD/segment/fleet evidence, Trip evidence,
and normalized signal facts. Exact overdue minutes and stale-telemetry age
remain visible in the live snapshot but are excluded from cache identity while
the same exception state persists. Status transitions, new signals, meaningful
expected-delay values, metric changes, scope changes, and period changes still
produce a new fingerprint. `generatedAt` and relative-time prose never do.
The Gemini context likewise normalizes these two live counters, preventing a
cached interpretation sentence from preserving an obsolete minute value; the
Admin evidence view still receives and displays the exact current value.

## Signal engine

Thresholds live in `analyticsIntelligencePolicy`, not React. Signals include
capacity pressure, increased unserved demand, reliability deterioration or
improvement, recurring late departures, demand shift, fleet
underuse/concentration, turnaround/deadhead advisory, high no-show rate, data
quality limitations, overdue unstarted Trips, missing Driver assignment, stale
telemetry, significant expected delay, multiple active Driver conflicts, and
insufficient sample.

Severity and priority are deterministic. Current safety/operation exceptions
rank ahead of analytical conditions at the same severity. Confidence cannot be
upgraded by Gemini:

- `LOW`: fewer than three relevant observations;
- `MEDIUM`: at least three relevant observations;
- `HIGH`: at least ten observations with a usable comparable period.

Some current exceptions use authoritative one-record evidence and are marked
high confidence because the system is reporting a present state, not inferring
a recurring trend. Recommendations are capped as `OBSERVE`, `REVIEW`,
`CONSIDER`, or `IMMEDIATE_ATTENTION` by deterministic signal state.

## Evidence and operational semantics

- Boarded riders, reserved seat-segment utilisation, actual departure delay,
  on-time departure, no-show, unserved demand, and waitlist promotion retain the
  formulas in `ANALYTICS_METRICS.md`.
- Demand heatmaps use `Asia/Kuala_Lumpur` departure buckets and preserve Line
  and direction.
- OD evidence uses actual checked-in reserved journeys and boarded walk-ins;
  finalized unserved OD demand uses expired waitlist and rejected-full walk-in
  intents. Intermediate external Stop to external Stop journeys remain intact.
- Segment load uses reserved-seat and standing segment claims. It is not
  replaced by passenger-count/Bus-capacity arithmetic.
- Fleet workload is derived from Trip/ServiceBlock records. General same-Bus
  transition advisories use the shared turnaround/deadhead evaluator; Route or
  Driver ownership is never added to Bus.
- Expected delay remains reported operational metadata. Actual departure delay
  always comes from origin planned versus actual departure timestamps.
- Current exceptions are displayed separately and never inserted into
  historical metric denominators.

The Admin UI provides an executive brief, deterministic current focus, Network
Pulse, Line/time heatmap, reliability and capacity context, fleet and passenger
outcomes, OD matrix, segment evidence, evidence drawer, application history,
and secondary Ask workflow. Clicking an insight applies its Line/direction
scope and moves to related analysis. Every important insight references stored
evidence metric keys and sample size.

Executive Brief membership and order always come from the first five sorted
deterministic signals. Gemini output is joined by `signalId` and may replace
only the interpretation sentence for a matching signal. It cannot add, remove,
reorder, reclassify, or change the evidence/recommendation of an Executive item.
The no-exception state is rendered only when the deterministic signal list is
empty.

## Gemini integration and failure mode

The server uses the pinned official `@google/genai` SDK. The configured default
is the stable GA Flash-class `gemini-3.8-flash`; it can be changed explicitly
with `GEMINI_MODEL` without using the mutable `latest` alias.

```dotenv
GEMINI_OPERATIONS_ASSISTANT_ENABLED="false"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-3.8-flash"
```

`GEMINI_API_KEY` is server-only. Enabling the feature without a key fails
closed. Structured responses are constrained with JSON Schema and parsed with
Zod. The grounding validator rejects unknown signal IDs, unknown/unsupported
evidence keys, duplicate IDs, non-requested signal IDs,
severity/category/confidence changes, an overall state inconsistent with the
deterministic signals, invalid drill-down scopes, and numerical claims in
insights or summaries that are absent from referenced evidence. Displayed recommendation
wording remains deterministic, so model prose cannot escalate an `OBSERVE`,
`REVIEW`, or `CONSIDER` condition into a stronger operational action. Model
output is rendered as plain React text, never unchecked HTML/Markdown.

The application cache is keyed by `model + fingerprint`, coalesces concurrent
identical requests, holds at most 50 entries for six hours, and supplies a
bounded in-process history. This initial cache is intentionally non-persistent:
it resets on process restart and avoids a database migration. Historical model
wording never feeds future metrics.

Gemini uses low temperature, concise aggregated inputs, structured output
limits, a seven-second SDK timeout, and no periodic client regeneration. A new
interpretation request occurs only after deterministic rendering and only when
the material fingerprint/model has no cached result. The interpretation and
Ask routes are separately rate-limited; Ask always begins with an approved
read-only function call.

When disabled, unconfigured, timed out, quota-limited, unavailable, malformed,
or ungrounded, the dashboard continues to show deterministic metrics, signals,
focus, charts, evidence, and recommendations. It explicitly reports that AI
interpretation is unavailable and never fabricates a response. A Gemini cold
cache or seven-second timeout therefore cannot delay metrics or charts.

## Data-quality and FYP disclosure

The snapshot explicitly reports sparse samples, missing actual departure
timestamps, missing comparison data, absent OD evidence, unavailable traffic
attribution, and simulated prototype telemetry. It does not claim causal
inference, prediction, autonomous optimization, official TAR UMT GPS, or
autonomous scheduling.
