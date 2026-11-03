# Sonoma public station observation contract

The US-only reference card on `/international` supplies public airport-station
context through this module and guarded GET route after an explicit tap. It has
no persistence, automatic fetch, farm-coordinate input, station search,
crop-calendar integration or country-readiness grant. The existing NASA monthly
reference and `lib/site-climate.ts` retain their own questions and authorities.

## Verified source boundary

The [NWS API documentation](https://www.weather.gov/documentation/services-web-api)
states API information is open data free for any purpose, requires an identifying
application User-Agent, and currently requires no API key. Its rate limit is not
published. It documents seven-day observation retention and possible delays;
this module fetches only one latest observation, not a history series or forecast.
The documentation also reports missing 24-hour extrema outside the central time
zone. The adapter preserves missing extrema rather than reconstructing them.

The [official OpenAPI schema](https://api.weather.gov/openapi.json) defines station
metadata, observation GeoJSON and quantitative values with unit and optional MADIS
quality-control flags. A flag is retained, not reinterpreted as farming approval.

On 3 November 2026, new direct HTTPS requests returned HTTP 200 for the docs,
schema, [KSTS metadata](https://api.weather.gov/stations/KSTS) and
[latest observation](https://api.weather.gov/stations/KSTS/observations/latest?require_qc=true).
These establish endpoint responses, distinct from an implemented product surface
or a newly measured observation. HTTP caching may serve unchanged data. No farm
coordinates were sent. Public station metadata identifies Santa Rosa Sonoma
County Airport; no farm-microclimate suitability has been established.

## Public API and ownership

- `NWS_OBSERVATION_PROVIDER`: dated source/attribution/access metadata and the
  application User-Agent, using the canonical URL from `app/layout.tsx`.
- `SONOMA_NWS_REFERENCE`: the sole accepted key `sonoma-ksts`, its station `KSTS`
  and two fixed official HTTPS URLs.
- `decodeNwsObservation(stationPayload, observationPayload, fetchedAtIso)`: pure
  decoder with an explicit retrieval instant, no clock or I/O.
- `parseNwsObservationResult(value)`: validates the normalized unknown server
  envelope and returns a detached result or null. The UI must use this shared
  parser rather than a second set of accepted units, dates or geometry rules.
- `fetchNwsStationReference(referenceKey, { fetcher, timeoutMs?, now? })`: caller
  injects fetch; no ambient fetch default. The server route provides the existing
  authentication/rate-limit policy described below.
- `NwsObservationResult`: available, partial or failed. A failure supplies no
  replacement weather. Available means all selected quantities are numeric in
  supported units; it does not certify source quality, freshness or suitability.

The calling UI must label this as an airport station reference, present the
observation and retrieval times separately, distinguish known values from
Unknown readings, and retain source attribution and QC metadata. The normalized
data preserves missing/invalid/unsupported states separately; the current card
displays all three as Unknown. It must
not imply that choosing a country or obtaining a response approves agronomy.

The normalized-response parser reuses the source decoder's time, Point and
measurement authorities. A temperature tagged with a known wind-speed unit is
still rejected. Value-state quantities must be finite with the exact field unit;
normalized optional QC null is treated as an absent raw-source QC field. Missing,
invalid and unsupported quantities stay null and retain validated state/reason
metadata, never converted into zero or a usable quantity. Available/partial status
must agree with the complete normalized measurement set. Identity, provenance,
source/retrieval instants, observation URI, Point types and timing flag must agree;
freshness must remain `not-assessed`. Failure envelopes also require recognized
reasons and valid provenance/status/retry metadata. Unknown fields are stripped.

## Identity, geometry and time

Station metadata must be a GeoJSON Feature with a Point, the fixed KSTS station
URI and matching station identifier. If an additional `@id` exists it must agree.
Observation station URI must bind KSTS; an optional `stationId` must also agree.
Observation `id` must be the KSTS observation URI for its timestamp; additional
`@id`, if present, must agree. These URIs are never followed as network inputs.

Station metadata and observations actually publish slightly different points.
They remain separate detached `stationPoint` and `observationPoint` values;
neither overwrites the other or any saved geometry. Finite GeoJSON longitude and
latitude must be in range; an optional finite third coordinate is retained.

An observation timestamp and retrieval timestamp must identify real instants with
explicit time offsets; date-only, impossible calendar dates and nonfinite dates
are rejected. Both original strings remain distinct. An observation after the
retrieval instant is flagged `timing: after-retrieval`, not silently accepted as
current or rejected using an invented agricultural threshold. Every successful
result has `freshness: not-assessed`; old observations are never refreshed by
replacing their source time with the request time.

## Quantity contract

`measurements` covers temperature, dewpoint, relative humidity, wind speed/gust/
direction, precipitation for the last one/three/six hours and 24-hour temperature
extrema. These are separate source quantities, not quantities the app calculates.
Supported exact unit codes are Celsius, percent, kilometres/hour, angular degrees
and millimetres, respectively. There are no conversions or inferred totals.

Each measurement retains `unitCode` and `qualityControl` when strings are present:

| State | Meaning |
| --- | --- |
| `value` | A finite numeric quantity with the exact supported unit; zero remains zero. |
| `missing` | Missing/null quantity or object; never interpreted as no rain, no wind or no frost. |
| `invalid` | Malformed shape, number, required numeric-value unit or optional QC flag; no usable numeric value. |
| `unsupported-unit` | A finite quantity exists but its unit is outside this bounded contract; no usable numeric value. |

Missing quantities retain any supplied unit/QC metadata. A missing QC field is
allowed by the schema. Defined QC enum flags are preserved without assigning a
pass/fail meaning; unknown/malformed flags withhold that individual quantity.
Partial/invalid quantities do not erase independent known quantities. A wholly
missing measurement set remains an explicitly partial observation record.

## Transport safeguards

Only the two constant official URLs can be requested, sequentially, at most once
each. Invalid station metadata stops before the second request. There is no URL,
station ID, farmer identity or location parameter in the request input. No account
cookie or credential is sent. Redirects are disabled; returned redirects and
unexpected effective URLs are also rejected. The required application User-Agent
contains the public canonical app URL, not a private account/contact identifier.

The shared operation deadline is at most 12 seconds, including both requests and
body reads. Each response body is capped at 64 KiB, checked against both declared
length and actual streamed bytes. These are app safeguards, not claims about NWS
quotas or farming conditions. Cancellation cannot extend the deadline. Late
completion of an abort-ignoring first request cannot start the second request.

HTTP errors, rate limiting, network errors, invalid JSON/UTF-8/schema, unexpected
units, timeouts and oversized bodies remain explicit. A numeric `Retry-After`
duration is retained when present; the module never retries automatically. No
source body, raw message or private request log is returned or persisted.

## Verification

`tests/international-nws-observation.test.ts` exercises identity mismatch, real
unequal point shapes, zero/missing/invalid/unsupported distinctions, units/QC,
calendar/time behavior, allowlisted requests, identifying headers, no retry,
response URL/redirect policy, streamed/declared size limits and whole-operation
timeout behavior including late responses and stalled cancellation. Country
provider/readiness tests verify the existing reference boundary alongside it.
The US-only country review now calls the guarded route on an explicit tap.
Root inspected a real partial station response on desktop and at 390px phone
width (content width 390px). Source observation and retrieval times, known values
and missing readings were visible. A floating-help overlap found on the phone
was removed using the existing in-flow LimaBar pattern for this exact route;
other international workspaces retain their previous help behavior. Hosted
current-head CI/build and production verification remain separate release gates.

## Guarded route boundary

`GET /api/international/weather-reference?reference=sonoma-ksts` invokes the real
`guardPaidApiRequest(req, '/api/international/weather-reference')` before query
validation or provider requests. The route has one additive `data` cost-class
entry. Authentication mode, verified caller identity, shared budgets, guest-lane
allowlist and limiter behavior remain owned by the existing guard; this route
adds no anonymous exception. In hard-auth mode the sample header alone grants
no access here. In the existing soft mode anonymous access remains rate-limited.

The request must have exactly one query entry, with the exact supported reference
key. Duplicate keys, unknown parameters, unsupported references, coordinate/URL/
station-ID parameters and missing values return a generic structured 400 without
echoing supplied input. None can become an upstream request. Only GET is exposed.

The route injects server fetch into the adapter. Caller bearer tokens, cookies and
identifiers are not forwarded. Route and upstream app caching are disabled, and
every route-produced response—including guard refusals—has `Cache-Control:
no-store`. Provider/proxy caching may still supply unchanged observations; the
source observation time and explicit `freshness: not-assessed` remain visible.

Available/partial decoded references return HTTP 200. Provider timeouts return
504; upstream throttling returns 503 with the `rate-limited` reason, source HTTP
status and a valid numeric retry duration when supplied. This differs from the
guard's 429 for an exhausted caller budget. Other provider failures return 502.
No raw upstream body, token, transport exception text, replacement observation or
crop-readiness approval is returned. Guard status/body/retry policy is preserved.

`tests/international-nws-route.test.ts` runs the real route, guard, shared limiter
and adapter. Only the external Firebase token verifier and HTTP transport are
controlled. Tests prove auth/rate-limit refusals and malformed queries make zero
upstream requests; they check identified fixed requests, missing/zero values,
no-store behavior, error/timeout mapping and unchanged production-readiness gates.
