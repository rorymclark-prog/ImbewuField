# Provisional crop preview integration — 12 November 2026

- Auditor: Codex; previous Gemini 3.8 Flash High fixture findings reused, no fresh native review claimed.
- Revision: isolated `codex/global-provisional-preview-20261112` successor of `d688ccf1f7290c91adeaf2e1d25fd275f19cf7f4`; exact finished commit is recorded in the PR and private packet manifest.
- Deployment inspected: none. Actual component bundled with synthetic data and repository CSS, served only on loopback.
- Previous audit: [provisional resolver](../2026-11-11/provisional-global-crop-resolver.md). Retain G01–G05 and GPR-01/02.
- Scope: crop-page preview, existing workflow fresh-source receipt and isolated draft UI. No saved adoption or export feature is added.

## What was already done

The resolver already retains evidence/default conflicts and deliberate overrides, with independently available count, yield and dates. Existing source, arithmetic and original crop export inspections are retained. The earlier Flash High fixtures were largely duplicate core cases; this milestone instead exercises the real consumer and its freshness boundary.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| G04-PREVIEW | The resolver had no app consumer | Implemented; synthetic component verified | Crop page now mounts a preview with measured bed, crop, conditions and editable estimates; full resolver fields expose defaults, conflicts, scope, source metadata, rejections and overrides. No persistence callback is used. |
| G04-FRESHNESS | Cached results could outlive their actor, source or draft | Verified in affected tests | Actor/site/context/source/evidence/crop/edit changes hide results. Calculation re-reads the existing saved-source authority and checks a revocable receipt after the await. Equal-area revision changes, copied DTOs and stale async callbacks are covered. |
| G04-LABELS | Nested select options polluted accessible labels | Corrected and browser verified | Four explicit select labels allow exact accessible-name selection. |
| G03 | Applicable public evidence adapters | Open | Actual page supplies no candidates. Explicit grower estimates produce partial outputs. No source date, reuse permission or agronomic value is inferred from research metadata. |
| G04 | Saved adoption, source-labelled exports and full-page account flow | Open | This milestone is preview only. The synthetic browser harness does not verify actual authentication, storage or hosted full-page behavior. |
| G05 | Same-final-candidate independent review and current CI | Open | Separate finite Flash High and Claude packets are prepared after freezing. No new native execution or approval is claimed. Current policy uses Codex, Claude and authorised Flash High support; unavailable Argon is not a release prerequisite. Historical receipts remain unchanged. |

## Verification

- Whole-checkout typecheck: passed.
- Affected integration group: 136 passed, zero failed/cancelled/skipped. Reused completed run for unchanged logic.
- After accessible-label/release-note edits: 13 affected UI/release-note tests passed, zero failed/cancelled/skipped.
- Whitespace: passed. Release-note drift is addressed in this candidate and checked after commit.
- Full local application suite: not repeated. Current-head CI and full release checks remain required; there is no merge or production approval.
- Actual component output: 1280-pixel desktop and 390-pixel phone light layout inspected. Phone document width equals viewport width. Desktop dark results and reset-to-evidence behavior also inspected. Synthetic 10.5 m² × 2.5 gives 26 whole plants; first harvest 2028-03-02 from the fixture's three-day duration. Yield and entry window remain unknown. Editing hides the previous result; negative density cannot restore its default.
- Private screenshots and fixture hashes are included in the review packet. These engineering values are not recommendations or runtime defaults. Browser fixture supplies no real credentials, no farm/customer records, and no paid generation.
- This changes the crop-page picture. PLAN_VERSION is unchanged. Original crop report/PDF/SVG evidence is separate and reused; no global preview export exists yet.

## Next continuation

Obtain explicit dispositions on the same frozen candidate; resolve findings with affected checks. Verify the actual hosted page and account/source boundary, then build reviewed applicable source adapters and separately scoped adoption/export work. Keep no-merge/no-production gates until required current-head CI and review evidence are satisfied. Model agreement does not establish local agronomic accuracy; the proposed held-out target is not an achieved result.
