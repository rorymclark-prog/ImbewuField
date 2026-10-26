# Production references and forecast wording: draft evidence

Base: `e3f18d92b3a214a0dce5c2f04da25e02d4893c30` (#1046).
The 15 verified source notes were captured at `231e7bd3`; the intervening parent changes
were test-only. These remain unreviewed AI drafts, not fluent-speaker approval.

`browser-qa.json` records 152 static reader states: 15 full-bearing/yield notes, two
missing-note fallbacks and two earlier forecast-word corrections, in four languages at
390 × 844 and 1440 × 1000. They use actual `buildProductGuidance`/`productGuideText` output,
the real `ReportView` paragraph renderer/CSS and the app fonts. All native paragraphs fit
without clipping or document overflow. Source formula units, arithmetic and quoted spacing
wording are intentionally retained; the per-plant heading itself has native unit wording.

Four actual Reports viewer flows open saved output from the real generation route with
mocked AI/auth/network services. The existing placement adapter emits 12 full-bearing/yield
lines in this fixture: 48 native paragraphs and 414 phone text lines, zero occluded or clipped
lines and no document overflow. Source-group records for granadilla/guava are covered directly
and statically; their eligibility is not changed. Selected saved-body language and stored
report bytes stay exact. The generated reports still contain explicitly marked English
research outside this batch.

Final viewer checks use one disposable browser context per language. They seed explicit
fixture preconditions for completed onboarding/consent and close the contexts afterwards;
they do not claim to verify those real onboarding/consent flows. Earlier attempts exposed
onboarding overlays and one crashed shared test tab. Its only leftover fixture rows were
removed by their test ID, and the previously observed language was restored. Current results
come from the completed isolated runs, not those interrupted attempts. No real user account,
report history or paid generation was used.

The two Xitsonga rainfall/climate cards also use the actual `ReportChartCard` and figure
models, rendered at phone and desktop sizes: four measured card states, with complete
forecast captions. Phone art remains intentionally horizontally scrollable inside its own
container; this is not a claim that every month fits on the phone simultaneously.

`contact-*.png` shows all four target languages side by side for source arithmetic, no-annual-
period cautions, missing-note fallback and earlier forecast corrections. `api-*-3-phone-reading.png`
shows the reader chrome and cultivar-group caution in each language. Forecast-card images
show the corrected Xitsonga caption in context. All these examples were visually inspected.
The lexical sources and exact earlier native before/after values are in
`forecast-word-corrections.json`; they do not approve the full translated sentences.

Final validation: clean typecheck; 391 tests passed across 44 registered files, including
production, source/geometry, historical learning, prior Simple guard and current lexical checks.
Release-note and whitespace checks are clean.

No PDF was created or changed. The full 547-file run at the older `6446f1cb` remains live;
its known failures (update-note length, the old Simple helper-name regex and a stale translator
handoff CSV) were repaired in predecessor heads. That run is not current-head proof. No complete-suite success or
production merge is claimed. This changes the picture; `PLAN_VERSION` is unchanged.
