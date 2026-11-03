# Reviewed media preservation test scope

The second synchronous media-preservation tests in the Soil fuller-learner reuse
and Water reviewed-precision suites now each enter the existing
`withBlindReviewedCorrectionReadScope` once around their complete body.

Every original per-file, hash, byte-size, source, changed-byte, format and
manifest-preservation assertion remains unchanged. The helper itself is unchanged:
it validates the complete current blind-reviewed and WebP layers before the
outer callback and again in `finally` afterward. Nested read-only historical
projections share only that synchronous observation. Direct validation outside a
scope still scans; no observation survives the callback and failures are not
cached as success.

The saved Soil and Water inventories contain 1,816 and 1,830 preserved entries.
Opening a complete 1,936-entry inventory at both boundaries for each individual
entry implies at least 14,117,312 redundant stat entries across the two loops,
before additional nested historical checks. One outer scope removes that repeated
boundary work without removing the per-entry preservation checks.

Existing mutation controls use a separate cloned fixture. They change a live
source without changing its size, change an unlisted still without changing its
size, and change a source inside a nested read. The guard must reject the changed
bytes at the outer boundary and again on the next call. Real course content and
media are never mutated by these controls.

This is test execution scope only. No app, course, media, shared helper, package
or verification-workflow change is included. No existing full-suite process was interrupted or restarted; measured local timings are evidence for this selected run, not a
promise about whole-suite or CI speed.

## Measured verification

Node 24 typecheck passed, followed by 13/13 tests across these two suites,
`blind-reviewed-study-corrections.test.ts` and `slide-webp-format.test.ts`.
The selected run exited successfully after 3,211.321 seconds.

| Media callback | Earlier completed full-suite run | This scoped run |
| --- | ---: | ---: |
| Soil preservation | 3,958.641 s | 3,183.510 s |
| Water preservation | 4,020.963 s | 3,178.261 s |

The baseline is commit `59e5e41bf129a5f3c5c7741f4a93af444f23b467`;
eight relevant pre-change helper/test files matched the current-main base exactly.
The baseline log hash and terminal lines were independently checked. The baseline
ran concurrently with the complete application suite; this selected run had
different contention and scope. These observed timings are not a controlled
speedup ratio. Substantial nested historical verification cost remains.
