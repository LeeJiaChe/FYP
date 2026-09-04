# Traffic-Aware Shuttle ETA Integration

## Purpose and request contract

This optional integration uses Google Maps Platform Routes API Compute Routes v2
for operational shuttle arrival estimates. It does not change the authoritative
Trip lifecycle, stop order, timetable, or telemetry model.

- Endpoint: `POST https://routes.googleapis.com/directions/v2:computeRoutes`
- Travel mode: `DRIVE`
- Routing preference: `TRAFFIC_AWARE`
- Waypoint order optimization: disabled; the TripStop snapshot order is authoritative
- Requested fields: route and leg `duration`, `staticDuration`, and `distanceMeters`
- Maximum prototype route size: five stops. This means at most three intermediate
  waypoints from the current bus position to the final remaining stop. Google
  currently permits up to 25 intermediate waypoints per Compute Routes request.

Google documents `TRAFFIC_AWARE` as considering current traffic conditions with
latency-reduction optimizations. For this preference:

- `duration` is the ETA considering current/real-time traffic information.
- `staticDuration` is the ETA considering historical traffic information without
  current live traffic conditions.

The internal `trafficImpactMinutes` field is therefore:

```text
max(0, round((duration - staticDuration) / 60))
```

It is displayed as **Current Traffic Impact — vs historical traffic baseline**.
It is not an empty-road or zero-traffic measurement and does not prove exact
congestion-only causality.

## Pricing classification and cost controls

`TRAFFIC_AWARE` currently triggers the **Routes: Compute Routes Pro** SKU. The
route's low waypoint count avoids the separate 11–25 intermediate-waypoint Pro
trigger, but it does not lower this request to another SKU because
`TRAFFIC_AWARE` is independently a Pro trigger.

**Current at time of implementation — verify Google pricing before deployment.**
On 2026-09-04, Google's global pricing list showed a monthly free usage cap of
5,000 billable events for Routes: Compute Routes Pro and USD $10 per 1,000 events
in the first paid volume tier. Google pricing, caps, discounts, and SKU rules can
change. These figures are documentation only and are not hard-coded into product
logic or UI.

Before enabling the integration, configure and review:

- a Google Cloud Billing budget and alerts;
- suitable Routes API quota limits;
- API usage and billing monitoring.

Google Cloud account settings are not changed by this repository. Quota and
budget controls are the ultimate cost guard.

## Caching compliance and request frequency

Successful Google route results are not cached after a request completes. No
Google-derived duration, distance, ETA, route, leg, or response body is persisted
or stored in process memory, Redis, PostgreSQL/Supabase, files, browser storage,
or `localStorage` for reuse across requests.

The server retains only:

- an active Promise while an identical Trip request is in flight, so concurrent
  callers can await the same provider request; and
- short-lived locally generated failure metadata (`API_TIMEOUT`, `API_ERROR`, or
  `NO_ROUTE`, plus expiry) for retry throttling. It contains no Google response
  Content.

Student and Admin ETA surfaces both refresh from the server every **60 seconds**.
Between server refreshes, a one-second client display timer derives minutes away
from `estimatedArrival - current client time`; the timer does not call the ETA
endpoint. Telemetry age similarly advances locally from `locationRecordedAt`.
The five-second GPS simulator never calls Google.

At a 60-second interval, one continuously viewed active Trip surface normally
makes about 60 Compute Routes requests per hour before coincident in-flight
coalescing. If Student and Admin view the same Trip with perfectly non-overlapping
timing, they can approach 120 requests per hour per server process. In-flight
coalescing only reduces actually overlapping requests.

The normal cost-protection model is:

- `GOOGLE_TRAFFIC_ETA_ENABLED=false` by default;
- a server-only API key;
- 60-second client request intervals;
- in-flight request coalescing;
- failure-metadata retry throttling; and
- Google Cloud quotas, budget alerts, and usage monitoring.

Normal teammate development, CI, and unit tests make zero paid Google calls;
unit tests use fake providers.

## Runtime validation and fallback behavior

Google JSON is treated as untrusted. A traffic-aware result is returned only when:

- `routes` is an array with a first route;
- all requested route and leg duration fields parse as non-negative finite values;
- all requested distance fields are finite non-negative integers;
- `legs` is an array; and
- the leg count exactly equals `remainingStops.length`.

Missing `staticDuration` is invalid rather than being replaced by `duration`.
Missing distance is invalid rather than being replaced by zero. The domain ETA
calculator independently rejects missing, extra, or invalid legs.

Before a provider call, the latest origin and every remaining TripStop coordinate
must be finite and within latitude `[-90, 90]` and longitude `[-180, 180]`.
Invalid local coordinates produce `INVALID_ROUTE_DATA` with zero provider calls.

Fallback reasons are:

- `DISABLED`: optional integration disabled.
- `NO_API_KEY`: enabled without a server key.
- `NO_LOCATION`: no current telemetry.
- `STALE_LOCATION`: location is older than 60 seconds at computation time.
- `INVALID_ROUTE_DATA`: invalid local origin or TripStop coordinates.
- `API_TIMEOUT`: the three-second request deadline elapsed.
- `API_ERROR`: HTTP, network, invalid JSON, malformed metrics, or leg mismatch.
- `NO_ROUTE`: Google returned a valid empty `routes` array.

All fallbacks use timetable plus `Trip.delayMinutes`. A provider response uses a
fresh response-time clock for `generatedAt`, arrival calculations, and telemetry
age. Every settled request is followed by a fresh Trip/location read on the next
request, so terminal status, stop progression, and stale telemetry cannot be
bypassed by a completed-result cache.

`NOT_STARTED` Trips show **Schedule estimate** and do not call Google. `ARRIVED`
and `CANCELLED` Trips return no stop estimates and are rendered as **Trip
completed** or **Trip cancelled**, not as a schedule fallback.

## Attribution

Only `TRAFFIC_AWARE` content displays Google attribution. The compact ETA cards
use Google's permitted text method rather than an altered logo asset. The reusable
UI attribution renders the exact text **Google Maps**, with `translate="no"`, normal
weight and spacing, a permitted color, at least 12px text, and placement inside
the Google-derived ETA container. Schedule fallbacks are not attributed to
Google. The separate **Based on simulated shuttle location** disclosure identifies
the telemetry source and is not combined with the routing attribution.

## Terms and Privacy pre-deployment gate

The repository currently has no publicly accessible application Terms of Use or
Privacy Policy. Do not treat this prototype as meeting that deployment
requirement, and do not invent legal text. Before any deployed production use of
Routes API, the operator must publish suitable Terms and Privacy pages that meet
the then-current Google Maps Platform requirements, including the required
Google references, and obtain appropriate legal review. This is a pre-deployment
checklist item, not legal advice. Keep `GOOGLE_TRAFFIC_ETA_ENABLED=false` in
production until it is resolved.

## Official Google documentation reviewed (2026-09-04)

- [Method: computeRoutes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)
- [Set the level of traffic data](https://developers.google.com/maps/documentation/routes/config_trade_offs)
- [Routes API Usage and Billing](https://developers.google.com/maps/documentation/routes/usage-and-billing)
- [Google Maps Platform API usage details](https://developers.google.com/maps/billing-and-pricing/sku-details)
- [Google Maps Platform core services pricing list](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Policies and attributions for Routes API](https://developers.google.com/maps/documentation/routes/policies)
- [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms)
- [Google Maps Platform Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms)

Pricing and policy documents must be rechecked before deployment because Google
can update them.
