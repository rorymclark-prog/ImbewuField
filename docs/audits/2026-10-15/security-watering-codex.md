# Security and watering continuation — 2026-10-15

- Auditor: Codex; no delegated reviewers or new linguistic approval.
- Reviewed revision: `43e9e7fcb4d0dd3ca5b83dbf3344545245c2be04` plus the implementation on `codex/security-watering-20261015`, based on main `c56291539ac9268f97923f7bed12f745cfb1b8b3`.
- Deployment inspected: local Next.js development server with fictional Firebase emulator configuration and the public sample farm. This is not a production-release claim. The PR and its exact checks are recorded in issue #35.
- Previous audit: [app-wide gaps and release readiness](app-wide-gap-review-codex.md); carries forward `IF-GAP-001`, `IF-GAP-004` and the release-evidence limits.
- Scope: supported framework/runtime dependencies, their required compatibility changes, weather wording and its rendered regression tests.
- Evidence: dependency audit, typecheck, focused behavioral tests, full-suite execution, local desktop/mobile browser inspection and [sanitized verification checkpoint](evidence/security-watering-verification.json).

## What was already done

The preceding audit established that the production lockfile had ten flagged package buckets and that the live sample turned weather-only reference evapotranspiration into an irrigation prescription. Rory asked to begin fixing those two priorities. This continuation implements those changes; it does not rewrite the original findings or claim that the other app-wide gaps are closed.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| IF-GAP-001 | Unsupported framework and known production dependency advisories. | Production dependency remediation implemented and locally checked; CI/preview release verification required. Build-tool advisories remain open. | Next.js 16.4.1, React/React DOM 19.3.1, React Konva 19.3.2 and Firebase 12.19.0. Compatible transitive security refreshes plus patched gRPC transport. `npm audit --omit=dev --json` reports **zero** vulnerabilities. Full audit retains **7 development/build-tool package buckets: 5 high, 2 moderate**, in Tailwind 3's glob/selector chain. They are not represented as seven deployed runtime vulnerabilities or reproduced attacks. A separate Tailwind migration needs CSS and output verification; `audit fix --force` was not used. |
| IF-GAP-004 | Reference ETo was presented as the amount the farmer should apply. | Implemented; focused behavior and actual desktop/mobile pixels verified locally. Publication pending. | The primary card now says to check soil moisture, crop, growth stage and recent rain. A collapsed optional disclosure labels valid ETo as a weather estimate and explicitly says it is not a watering amount. No irrigation quantity or crop coefficient was invented. Missing/invalid reference data cannot produce a bogus quantity; zero remains valid reference data. |
| IF-GAP-004, language follow-up | Existing weather and hazard wording is English-only. | Remains open. | This patch corrects the unsafe English claim. It does not invent unreviewed isiZulu or other farming translations. Obtain the normal source/language review before expanding this widget's language coverage. |
| IF-GAP-007; IF-GAP-009 | Real signed-in field acceptance and enforced production release gates. | Unchanged coverage/process limits. | Local sample checks and green focused tests do not establish signed-in two-device recovery, physical-phone offline behavior, or production-release permission. The existing main deployment workflow runs independently of Tests. |

## Implementation and compatibility

- Next.js 16 requires awaited dynamic route parameters. Only the three manual page/metadata signatures were migrated; their teaching content and static route inventory are retained.
- The existing manual tracing exclusions moved from the old experimental property to the supported root configuration. This preserves exclusion of the large `public/` directory from manual server functions.
- Development and production explicitly use webpack, retaining the app's existing Mapbox alias. The agent-rules generator is disabled so starting Next does not overwrite the shared project instructions.
- React 19 type changes replace the removed global JSX namespace and allow nullable SVG refs. Recharts' `react-is` version matches React; React Konva and the test renderer match the runtime generation.
- The new test renders the real weather component with a forecast fixture. It fails if the primary guidance becomes a numeric watering prescription again, if the optional reference loses its disclaimer, or if invalid data prints a quantity. Existing tests were not weakened.
- The refresh banner includes a farmer-facing note and a direct watering-card tour stop. Its checkpoint is stamped to the actual implementation commit before publication.

## Verification

- Runtime: Node **24.19.0**, matching the repository's Node 24 test requirement.
- Typecheck: **passed**, including generated Next.js route types.
- Focused checks: **141 passed, 0 failed, 0 TODO**, including account transitions, public-route rendering, course audio/decks, saved reports, manual routes, security headers, release tour and the new weather regressions.
- Full registered suite: launched with `npm test -- --test-concurrency=4`; still running at this checkpoint. Do not replace this with the old main's passing suite. Exact branch CI results must be read before merge.
- Dependency graph: `npm ls next react react-dom react-konva react-is firebase @grpc/grpc-js --depth=2` passed without invalid peers. Production audit is clear; residual build advisories are recorded above.
- Whitespace: `git diff --check` passed during implementation; checked again before push.
- Local browser: public sample farmer card at **1280 × 720** and **390 × 844**, collapsed and expanded reference disclosure; sample Design Studio review drawing, production calendar/graph disclosure and Recharts rainfall bars rendered. Manual contents, Introduction chapter and printable book rendered with their correct page titles. The book's full print pagination was not re-audited. See evidence below for precise scope.
- The local server uses fictional Firebase configuration and no Mapbox token. Consequently the basemap is blank and real Firebase authentication/storage were not exercised. No paid AI generation, private farmer account, browser consent acceptance or production write was performed.
- A production build was not run in the sandbox, per `AGENTS.md`; preview CI supplies build coverage with Google Fonts access. Next's existing middleware convention emits a deprecation warning but remains supported.
- Not verified: production preview/release until CI completes, physical Android/iPhone behavior, offline update/restart on a real device, private account recovery, newly generated exports, all languages/themes or real paid rendering.

This changes the weather card's picture. It changes no plan-sheet geometry, species, lesson/quiz/narration content or `PLAN_VERSION`.

## Browser evidence

- [Desktop watering guidance, expanded reference](evidence/watering-desktop.jpg): the real local sample forecast, with both the qualitative advice and reference disclaimer visible. The blank basemap reflects the intentionally absent local token.
- [Phone-width primary watering card](evidence/watering-mobile.jpg): the weather number is collapsed by default.
- [Phone-width expanded reference](evidence/watering-mobile-expanded.jpg): the disclaimer wraps without clipping.
- [Sample design review smoke check](evidence/security-design-smoke.jpg): the saved public sample drawing renders after the React/runtime upgrade. This is not a new plan-sheet or paid-image quality approval.
- [Rainfall chart smoke check](evidence/security-rainfall-smoke.jpg): the real Recharts rainfall bars and month labels render after the React upgrade; no new rainfall figures are introduced by this patch.

## Sources

[FAO 56 reference/crop evapotranspiration definitions](https://www.fao.org/4/X0490E/x0490e04.htm) and [crop-coefficient method](https://www.fao.org/4/X0490E/x0490e0b.htm) establish why weather-only ETo cannot directly prescribe irrigation. No new agronomic number is introduced here.

[Next.js 16 migration guide](https://nextjs.org/docs/app/guides/upgrading/version-16), [support policy](https://nextjs.org/support-policy), and [React 19 migration guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) informed the runtime and route/type compatibility changes. The dependency audit is a registry advisory snapshot, not a penetration test.

## Next continuation

1. Read the exact branch's Tests/rules and preview-build results; investigate real regressions before release. Verify the preview watering card and manual static pages against its build SHA. Keep the distinction between implementation, checks, merge and production publication.
2. Migrate the remaining Tailwind build chain in a separately verified change, including theme/layout and printed-output comparisons. Do not force a major CSS migration merely to hide the residual advisory count.
3. Continue the existing priority register: release/revalidate survey recovery in dependency order, handle stalled offline navigation, then design the cross-device backup and conflict-safe shape protocols with their owning lane.
4. Complete the current physical-device/signed-in field acceptance record and practitioner/language review. Preserve the original finding IDs and remaining scope limits.
