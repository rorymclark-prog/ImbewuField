# US public NWS forecast reference — review delivery

Stacked after draftPR1259 at634a0fe4b5dc79eb0d79b8530c77dd22a1f0ee07.

The country-evidence workspace offers an explicit Washington demonstration check
when United States is selected. This is a public forecast reference, separate
from farm coordinates, observed conditions, weather alerts, crop dates and local
agronomic readiness. No locally reviewed country advice is enabled.

## Actual implementation

A typed Next server action requests the existing public Washington point, then
follows its currently reported official grid forecast. The gateway verifies the
Feature/Point and fixed coordinates, official HTTPS host, exact grid/path mapping
and absence of user URLs, queries, fragments, credentials or redirects before the
second request. The server supplies an identifying application User-Agent;
external requests omit credentials and caches. There are no automatic retries.

A monotonic total deadline covers both requests and body reads, with a separate
64 KiB streamed limit per response. These are software bounds, not provider
quotas. A delayed timer alone cannot authorize a late second request or result.
Retrieval timestamps are captured separately from source generation/update times.

The pure decoder reuses the existing descriptor-safe JSON copy authority. It
checks source SI and numeric Celsius units independently, supports integer and
Celsius QuantitativeValue representations, preserves fractions and offsets, and
keeps zero separate from null/missing measurements. Partial output stays partial;
malformed-present units, unsafe accessors, invalid dates/period order or unsupported
structures withhold the result. The bounded interval contract follows the frozen
NWS schema, including compact offsets; it does not interpret NOW using a hidden
clock. No farming thresholds or expiry interval are invented.

The card makes no request on mount. An explicit request withdraws old values;
a synchronous latch prevents duplicate requests. Leaving the US unmounts it, and
late results cannot populate a new selection. Source prose and quantitative
probabilities remain independent. This changes the country-review screen picture.

## Verification and provenance

- Native Flash authored the pure decoder and22 synthetic cases. Coordinator
  review corrected concrete unit, null/completeness, provenance/reflection,
  source ordinal and interval-contract findings; coordinator added2 remaining
  accessor/reversed-period and missing-value controls. No native execution claim.
- Codex gateway lane initially passed15 cases. Independent actual scheduler-delay
  reproduction failed original code; two added regressions failed before repair
  and all17 then passed. The independent unchanged reproduction passed after it.
- Actual UI lane16 cases and4 real server-action/mount-boundary integration cases
  cover explicit requests, missingness, raw fractional/zero values, failure copy,
  retained callbacks and late/unmounted results. Transport boundaries are stubbed
  for these synthetic checks, not presented as endpoint-fetch receipts.
- Coordinator ordered pinned Node24 typecheck exit0,112/112 across11 affected
  files, zero failures/skips/TODO, whitespace and release gate clean on the first
  integrated snapshot. After replaying onto the bed-window/test-repair parent,
  final ordered typecheck0,610/610 across44 affected files, zero failures/skips/TODO,
  whitespace and release gate passed. Exact decoder/action/UI byte identities
  used for browser QA survived the replay. Compiler-only test narrowing/type
  annotations preserved every assertion. The first rebased run passed605 and
  failed5 from missing tracked regional packets;88 exact baseline files were
  restored before the successful final run. No content or lesson rewrite.
- Actual local desktop and390px phone used the real typed server action and live
  NWS endpoints. It returned14 periods, distinct source/retrieval timestamps,
  exact source offsets and genuine zero precipitation values. A second explicit
  request withdrew the result; switching to Kenya while pending removed the card,
  and returning to US remained idle after completion. The phone document width
  equalled390px and the request button measured44px high. Desktop two-column and
  phone single-column cards were viewed; the existing floating Lima control
  overlaps a small part of mobile content, so no app-wide overlay fix is claimed.
- Temporary preview, its cache and matching public asset link were removed; the
  shared asset target and user tabs were preserved. No real account storage writes.

Primary contracts: [NWS API](https://www.weather.gov/documentation/services-web-api),
[OpenAPI](https://api.weather.gov/openapi.json),
[NWS disclaimer](https://www.weather.gov/disclaimer). Coordinator fetched the
frozen documentation and actual integer/QV demonstration payloads independently;
research handoffs alone were not implementation. Usage exceptions and conditional
third-party copyright notice requirements remain distinct from app integration.

Includes12 unreviewed Codex release-description candidates for four existing
update languages, with explicit source pairs. These are separate from AGY84
bed-window language drafts; no fluent approval or new runtime language is claimed.

## Release gates

Full current-head CI and exact hosted/account review remain required before
production merge. The local reference check is not a production deployment,
customer test, farmer-weather integration, frost service, legal or funder approval.
No PLAN_VERSION, calibrated lesson/quiz, species or measured geometry changes.
