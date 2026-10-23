# Core Study Reading body follow-up — 2026-10-04

- Auditor: Codex, scoped drafting and independent semantic helpers.
- Reviewed revision: base `68719a788e0041da32eccfbbf36ca821eadfd321`, branch `codex/regional-reading-body-fuller-20261004`, local changes pending release gates.
- Deployment inspected: production PR937 at `68719a7`; this Reading batch has no preview yet.
- Previous audit: [Introduction follow-up](study-learner-ts-intro-codex.md), carrying `STUDY-RES-001` and `STUDY-RES-002`.
- Scope: source-bound Reading learner bodies and proposed matching silent-deck fields in Sesotho, Tshivenda and Xitsonga.
- Evidence type: canonical/registry source review, independent machine semantic checks, preservation proofs; this batch's browser verification pending.

## What was already done

PR937 published the three missing Xitsonga Introduction image-description pairs and eight existing Introduction/Market assessment fields. Root inspected the exact `67dad349` preview at 390×844; both PR/push test and rules jobs passed. Main test/rules `37236907495` and deployment `37236907486` passed, and production build-info reported `68719a7` with the new notes. The earlier audit's prepublication verification paragraphs remain historical.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-001 | Three Xitsonga Introduction image descriptions lacked regional source pairs. | Verified for the three scoped pairs | PR937 exact-preview alt/source panels, actual image bindings and source-drift tests; this does not imply all app descriptions are translated. |
| STUDY-RES-002 | Ordinary English remains within regional learner and deck drafts. | Partially addressed; open | Nine unique Reading paragraph refinements are implemented and independently rebound to the current resolver. Seven matching deck fields preserve exact paired sources and untouched targets. Initial four-frame render review found that mixed English and regional segments were placed on separate lines, disrupting sentence flow; Inline mixed-text layout repair now wraps complete words across color boundaries, preserving exact text and English-hold colors. Root inspected all four final 1440×5400 compressed frames and accepted readable sentence flow, labels and exact-source panels. The initial punctuation-boundary issue was repaired and tested; only four published still assets changed. |

The second pass rejected a quiet-versus-calm night phrase and ambiguous full-season comparison wording. Those English conditions remain visible. Original whole-paragraph proposals were stale; approved clause recompositions preserve the already localized cold-night observation and adviser-before-permanent-placement conditions. These are machine checks, not fluent approval.

## Verification

- Typecheck: final combined original command passed after an implicit-any callback annotation; assertions unchanged.
- Full test suite: original command passed, 4,604 pass, zero failures and one unchanged TODO (4,605 tests).
- Whitespace: final original command passed.
- Output inspected: final inline-flow contact and all four compressed ST11, TS14, VE14 and VE18 images accepted. Each is 1440×5400, with exact English and visible unreviewed labels. Initial fragmented renders were rejected and replaced. Preview-phone and offline verification remain pending; earlier production evidence is scoped to PR937.
- Limits: exact English source, technical terms, species, quantities, quiz indices, canonical text and ST Introduction media bindings must remain unchanged. No fluent/local farming or Shangani-comprehension approval.

Learner wording and proposed slide text change the picture. `PLAN_VERSION` remains unchanged.

## Next continuation

1. Inspect the composed registry and deck source/target differences, preservation proofs and compressed frames.
2. Run the original ordered gates, save concise notes and push one coherent batch.
3. Verify both exact-head PR/push test and rules jobs, exact preview build, actual 390px source/media UI and representative offline behavior before merge.
4. Verify main jobs, production build-info and issue #35 ledger. Keep the wider residual finding open until current evidence proves the full scope complete.
