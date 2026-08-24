# Final Viva Guide

Answers are speaking prompts, not invented research findings.

## Product and problem

**Why build booking when the observed process uses queues?**  
The proposal tests whether advance journey-specific certainty and better live information can reduce passenger uncertainty. It does not claim TAR UMT already operates reservations or that deployment has been approved.

**Does QR scanning slow boarding?**  
It adds an interaction. The design trades some throughput for entitlement validation and reliable capacity/no-show records; production would require a boarding-throughput pilot and keeps a Driver manual fallback.

**Why numbered seats when current buses do not expose selectable numbers?**  
Numbered labels are a proposed deployment prerequisite for guaranteed reserved seats, not a description of current buses.

## Lee passenger module

**Why can one seat be reused within one Trip?**  
A passenger owns it only over traversed adjacent segments. A→B and B→C do not overlap; A→C overlaps both. This increases truthful capacity without changing the bus.

**Why separate WalkInIntent and WalkInJourney?**  
Intent is a non-guaranteed pass and consumes nothing. Journey exists only after a concurrency-safe boarding admission claims standing capacity.

**What prevents two students taking the last reserved seat?**  
The transaction locks the Trip, rereads availability and PostgreSQL uniquely permits only one claim for a TripSeat/TripSegment pair.

**What prevents two Walk-ins taking the final standing place?**  
Requested segments are locked in stable order, live claims are counted, and all claims are inserted atomically only if every segment fits.

**Why is no-show based on actual progress?**  
Traffic can make planned time wrong. A passenger is absent only after their own boarding stop actually departs or passes without check-in.

## Wong fleet and GPS module

**What if the timetable is wrong?**  
Planned time identifies/searches the Trip and opens booking; actual TripStop progress is operational truth. Delay metadata does not create a second Trip.

**Why simulated GPS?**  
Physical hardware is outside FYP scope. The simulator exercises the real authenticated ingestion/persistence/query boundary, so a future adapter can replace only the source.

**Is Socket.io the source of truth?**  
No. PostgreSQL is durable. Socket.io sends scoped invalidations and clients refetch; missed events do not lose state.

**How are scheduling conflicts prevented?**  
Transaction-scoped advisory locks serialize relevant Bus/Driver scheduling keys, then overlap is checked before snapshot creation.

## Database, security and integration

**Why PostgreSQL rather than SQLite?**  
The core assessment includes concurrent locks, partial indexes, composite foreign keys and transactional constraints that PostgreSQL provides directly.

**Why snapshot Route and capacity into a Trip?**  
Changing a Route, Stop name, or Bus later must not rewrite the historical meaning and inventory of an existing Trip.

**Are QR codes encrypted?**  
No. Tokens are signed, purpose-specific and short-lived. The server still rereads durable state; a token alone never authorizes boarding.

**What if the browser does not implement BarcodeDetector?**

The camera still initializes. A maintained browser decoder processes frames and
submits the decoded signed token to the same server verification endpoint; the
security decision remains server-side.

**Why one shared project but two reports?**  
The real workflows depend on shared Trip/capacity/progress contracts. The university requires separate documentation focus, not artificial duplication of the application or database.

**Why were IoT seat sensors removed?**  
They were not necessary for the approved passenger/fleet objectives and would add unverifiable hardware scope. Planned journey claims already provide deterministic capacity semantics.

## Limitations and future work

**What is not proven?**  
No physical GPS deployment, institutional SSO, university production approval, camera test on every browser, penetration test, formal accessibility certification, or large-scale load benchmark is claimed.

**What changes for real deployment?**  
Validate requirements with DSA, confirm routes/timetables/capacities and standing policy, integrate institutional identity, label seats, pilot boarding throughput, supply real GPS hardware, add deployment security/monitoring/backups, and conduct privacy/accessibility/security review.

**How should individual contribution be described?**  
Use the canonical functional documentation scopes. Any coding-contribution claim must be supported separately by truthful evidence rather than inferred from module boundaries.
