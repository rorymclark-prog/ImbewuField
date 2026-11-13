# Provisional dated-cycle adoption — 13 November 2026

- Auditor: Codex implementation owner; independent Codex review follows each frozen boundary.
- Starting revision: `31818f4d61d0e2304080582bbe96f839a315107f`, draft PR1352.
- Branch: `codex/provisional-cycle-adoption-20261113`, stacked on PR1352.
- Previous audit: [Full-suite report contracts and save continuity](global-report-ci-contracts-codex.md).
- Scope: receipt-aware full assessments, eligible whole-bed proposals, existing acceptance preparation and historical attachment replay.
- Evidence: actual pure functions, existing whole-proposal coordinator, canonical storage writer/readback and negative controls.
- Status: core checkpoint only; app/controller, consumer/export integration and release gates remain open. Not production approval.

## Findings and implementation

The existing provisional resolver remains the evidence-selection authority. No species,
calendar, timing, spacing or yield defaults were added. The original marked profile and
its original-day source/default/override history remain intact. A distinct versioned
review context records the current source identity, country/region, policy context,
unknown-or-known restriction, saved-copy freshness and UTC review day/time. It is
recorded evidence, not a signature or a private write capability. Catalogue support
is not treated as planting legality.

Full assessment re-resolves the original request at the new review day and each
proposed field-entry date, preserving the original provenance timestamps. Changed
active inputs require a new explicit preview/profile. Date-excluded evidence can
be skipped within the existing finite search budget. Missing grower requirements
remain missing; zero demand creates no cycle. Complete unchanged profiles may
proceed instead of being permanently excluded merely because they retain evidence.

The engine selects eligible profile/bed pairs before preflight and allocation.
A bed-bound profile cannot use another bed, and an unrelated bed cannot invalidate
its valid pair. Whole-source reservations and existing whole-book checks remain.
Spacing uses the existing whole-cell arithmetic and actual bed/area binding;
chosen final stand remains distinct from seed count or rounded density.

The existing assessment snapshot carries the versioned replay review and bed binding.
Historical attachment normalization replays its recorded day and rejects damaged,
future, missing, extra or accessor-backed review evidence. A later wall-clock date
does not rewrite history. Operational use additionally requires matching supplied
current source/country/policy context. Missing operational context holds derived
use while the original record remains available. Compatible unmarked density
snapshots retain their old shape and fingerprints.

| ID | User-visible issue or coverage gap | Status | Evidence / next action |
| --- | --- | --- | --- |
| G04-ADOPTION-CONTEXT | Saved evidence-backed profiles could not reach dated sowing acceptance | Core implemented; full app integration open | Complete density and spacing proposals, guarded preparation, canonical save/reload and historical replay pass; controller, explicit consent and app route still needed |
| G04-ADOPTION-BED | All-bed preflight made a valid bound profile unusable or permitted association loss | Core regression checks pass | Two-bed positive, unavailable-bound-bed negative and all-bed fault injection |
| G04-ADOPTION-TIME | A saved review could be reused outside dated evidence or after source review expiry | Core checks pass; live action guards open | Actual date search and inclusive review-due boundary; original source dates unchanged |
| G04-ADOPTION-CONSUMERS | Current-source discovery, nursery and report paths do not yet carry the new evidence | Open | Update all context producers and member-specific public exports; inspect actual output |
| G04-RESOLVER-COMPATIBILITY | Unsupported future evidence versions cannot replay under an unknown interpreter | Carried open | Exact supported replay only; incompatible raw records retained and held |
| GLOBAL-AGRONOMY-VALIDATION | Regional arithmetic and cited sources do not establish local agricultural accuracy | Open | Independent local validation remains required |
| GLOBAL-EXTERNAL-REVIEW | Restricted AGY service route cannot provide requested provider reviews | Open | No retries, account/auth/provider bypass or fabricated Claude/AGY approval |
| GLOBAL-CURRENT-HEAD-CI | Persistence/farming changes require full current-head CI | Open | Current branch has not been pushed; ancestor31818f full test job remains live separately |

## Verification at the core checkpoint

- Typecheck: `npx tsc --noEmit` clean before affected tests.
- Affected tests: 1,504 pass, zero failures across87 existing registered files,
  with concurrency2. Includes complete marked density and spacing, unknown country,
  incomplete inputs/final stand, date-specific evidence, review-due boundary,
  source/country/restriction mismatches, version/fingerprint/getter corruption,
  actual canonical write/reload and existing whole-proposal preparation.
- Negative controls: the new positive marked-cycle test fails on an assertion with
  the actual31818f engine and separately with all-bed preflight restored. Neither
  failure is an import, transpilation or fixture-setup error.
- Whitespace: clean before checkpoint commit.
- Full suite: not rerun locally. Ancestor CI is not approval of this successor.
- Output inspected: no new visual surface yet. No claim of app adoption, new
  downloadable report, actual parent browser wiring, real account or device/sync.
- This core checkpoint does not change the picture. PLAN_VERSION unchanged.

## Next continuation

Thread live country/policy/source and monotonic private generations through the
controller and final raw writer, including UTC rollover and withdrawn consent.
Wire explicit evidence review in the app, update operational and nursery context
producers, and retain per-member public evidence through saved views and exports.
Exercise positive actual app/writer/reopen/export flows plus stale-action negatives,
inspect originals, obtain independent review of the exact finished delta, then push
and wait for its required current-head CI. The full global milestone remains active.
