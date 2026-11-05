# Environment Agency rainfall public reference

This pilot adds an explicitly requested public-network example to the United Kingdom country review. It does not identify a farmer's gauge, establish national coverage, or turn a reading into irrigation or crop advice. The existing country-readiness and crop-planning authorities remain unchanged.

## Evidence inspected

On 5 November 2026 an independent coordinator lane fetched the official [rainfall documentation](https://environment.data.gov.uk/flood-monitoring/doc/rainfall), [API reference](https://environment.data.gov.uk/flood-monitoring/doc/reference), linked [Open Government Licence v3](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/), and one documentation-derived bounded public readings query. The root coordinator independently matched all four actual body lengths and SHA256 values, read the relevant source passages and inspected the actual JSON item. The [sanitized receipts](pilots/ea-rainfall-reference-receipts-2026-11-05.json) preserve retrieval evidence; raw bodies, headers, logs and station/location details are excluded from publication.

The product-specific documentation offers open access without registration and specifies accumulated precipitation in millimetres for 15-minute periods. Telemetry commonly transfers only once or twice daily. Its `latest` query returns the latest available reading for each included measure. A JSON value may be absent when the underlying reading is NaN; absence is not zero. The inspected one-item response contained a genuine numeric zero, a 900-second total and a reported source time. That individual response is not evidence of complete, nearest-farm or current coverage.

The rainfall page links the licence and supplies the attribution retained in the interface. The fetched licence permits commercial and noncommercial reuse subject to attribution and its exclusions, with no official endorsement or continued-supply guarantee. This records the inspected product terms; it is not blanket permission for other sources or an agronomic, legal or launch-readiness approval.

The inspected documents do not establish rainfall-specific national boundaries, quality-status semantics, whether the reported time marks the start or end of accumulation, or a numerical rainfall-specific quota. A separate flood-forecast coverage statement is not substituted for rainfall evidence.

## Implementation boundary

The [frozen decoder contract](EA-RAINFALL-REFERENCE-CONTRACT.json) requires the exact rainfall/mm/900-second/total metadata. Missing measurements and source times remain unknown; malformed or unsupported responses are held. The source time is intentionally retained as opaque reported text, without claiming calendar or timestamp validation. The retrieval receipt is separate. No source date is converted, compared for freshness or used as an accumulation boundary.

The pure module uses the existing JSON detachment authority. The server transport accepts only the workspace's fixed public query, with one request, a 12-second total deadline and 64 KiB response bound. These are software safeguards, not official quotas. No private coordinates, arbitrary endpoint or station selection enter the action; redirects and automatic retries are not allowed. The component clears old results on a new request and withdraws results when the country selection changes.

## Verification and remaining gates

Ordered coordinator checks passed on the final source tree: Node 24 typecheck, 234 affected checks across 18 files (zero failures, skips or TODOs), whitespace and release notes. These include 14 independent pure-model cases, 19 actual transport cases and 21 actual UI/parent cases. All three new suites are registered. An actual conflicting-MIME acceptance defect was reproduced in isolated memory and repaired; an in-memory removal of that refusal makes its new regression fail. A separate delayed-timer negative control likewise fails without the monotonic deadline. No existing assertions were weakened.

Actual local desktop and 390-pixel phone review requested the real public service and displayed a genuine zero with separate reported and retrieval times. Loading/disabled-button state, attribution, source limits, initially closed details and three protected 44-pixel links were inspected; the document remained 390 pixels wide. Leaving the UK selection removed the card and returning showed no requested result. The existing floating Lima control overlaps some lower-left phone text; no app-wide overlay repair is claimed. Temporary preview resources were released.

Full current-head CI and exact hosted/account review remain required before production release. Affected checks and local live review do not substitute for those gates. No release or complete-country-adaptation claim is made. PLAN_VERSION, species, calibrated lessons and saved geometry are unchanged.
