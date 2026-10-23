# Site survey: recovered history and continuation — 2 October 2026

- Auditor: Codex.
- Reviewed revision: `94a2fb4baf5bf801a12647ea8c2d53a4af045223` on `origin/main`; archive branch
  `codex/site-survey-audit-archive-20261002`.
- Scope: finding the earlier surveys/report audits, reconciling later merged
  work, and establishing a shared dated archive.
- Evidence: repository documents, source, Git history, GitHub issue #35, the
  original Codex chat and Claude's local records. No new browser/device audit or
  farming-content review was performed for this record.
- Previous audit: [20 September Site Survey](../../SITE-SURVEY-AUDIT-2026-09-20.md).

## Where the earlier work was found

| Source | What it contains | How to use it |
| --- | --- | --- |
| Repository `docs/` | The 20 September survey audit, September report audits and later language-review packets. | Shared source; fetch current main before continuing. See the [date index](../README.md). |
| Claude's Downloads collection | `/Users/roryclark/Downloads/ImbewuField-audits-2026-09-20/INDEX.md`: 30 documents plus the external browser audit. | Historical reading snapshot exported at `a9b3f5a`, not today's implementation status. |
| Original Codex chat | **Improve site survey section**, task `01a0bbde-0dd6-74e1-992c-fc2848b7e6a8`. | Confirms the completed survey/report work and its verification limits. Its durable record is the 20 September audit. |
| Claude's local project records | The ImbewuField entries under `/Users/roryclark/.claude/projects/-Users-roryclark-Claude/`, including `memory/project_imbewufield_sync.md` and the `fix-site-survey-i18n` workflow. | Corroborates survey sync, localisation work and the Downloads collection. Private transcripts and temporary workflow files are not copied into the public archive. |
| Shared release ledger | [GitHub issue #35](https://github.com/rorymclark-prog/ImbewuField/issues/35). | Branch/commit, preview checks and release evidence for subsequent fixes. |

The chat's initial request was already to build on the existing survey rather
than replace it. Preserve that continuity.

## Work already implemented: retain it

The [20 September audit](../../SITE-SURVEY-AUDIT-2026-09-20.md) records PR #444:
illustrated short/comprehensive routes sharing saved answers, soil and roof-water
guidance, production accordions, review cards, validation, explicit save failure
recovery, unsaved-change confirmation, keyboard focus handling and responsive
layouts. It also records report reading editions and PDF checks. Those are the
foundation, not an unfinished new build.

The audit's final paragraph still says PR #445 is ready for release. That is now
historical: [the ledger records its merge and deployment at `a9b3f5a`](https://github.com/rorymclark-prog/ImbewuField/issues/35#issuecomment-5748022444).
The report diagram viewer was shipped. It is not a pending survey task.

Later work present in the reviewed main revision:

| Date | Work | Evidence |
| --- | --- | --- |
| 25 September | Mobile survey dialog is rendered through a body portal; deep-link opening chooses the visible panel. | PR #567, `d39ac418`; [release and phone QA record](https://github.com/rorymclark-prog/ImbewuField/issues/35#issuecomment-5827138081). |
| 25 September | Saved-site survey remains available without a loaded location analysis. | PR #624, `545347ba`; `components/DataPanel.tsx` constructs and renders the survey before its no-analysis return. |
| 25 September | isiZulu survey choices and guidance retain English source pairs across opening, land, production, livestock, income, resources, challenges and review. | PRs #611, #622, #626, #628, #631, #633, #635; source in `SiteSurveySheet`, `SiteSurveyReview` and `SurveyZuluDraftPair`. These are drafts, not fluent approval. |
| 26 September | The orphaned `/survey` wizard was deleted. | PR #696, `491704b2`, deletion commit `fb072f1f`; `app/survey/page.tsx` is absent on current main. The old audit's request to investigate that route is superseded. |
| 26 September | Sesotho/Tshivenda welcome and mode labels use visible draft/source pairs. | PR #713, `2e24930b`; [release verification](https://github.com/rorymclark-prog/ImbewuField/issues/35#issuecomment-5848637269). This does not establish complete language coverage. |

The separately documented Garden Survey dynamic-label and shell drafts should
not be confused with full Site Survey approval. The active site questionnaire is
opened through `/farmer?openSurvey=1`, in `SiteSurveySheet`. Programme survey
answering is another workflow and needs its own scoped audit.

## Open improvements and verification gaps

These IDs begin the shared continuation register. They describe the current
source and recorded verification limits, not newly reproduced device failures.

| ID | Finding or gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| SS-001 | Unsaved questionnaire answers have no persistent recovery after a reload, browser termination or device restart. | Open improvement; confirmed in source | `SiteSurveySheet` initialises from `loadSurvey`, holds edits in React state and writes only in `handleSave`. `beforeunload` warns but does not persist a draft. Add site/account-scoped draft recovery, with deliberate resume/discard and successful-save cleanup. Keep draft answers out of reports until explicitly saved. |
| SS-002 | Survey language drafts and consequential wording have not received the documented fluent/local farming review. | Open review dependency | [25 September review packet](../../studies-review-2026-09-20/SITE-SURVEY-ISIZULU-AGY-REVIEW-PACKET-2026-09-25.md) lists holds for water assumptions, save/discard and production semantics. Later source pairs are present, but no reviewer sign-off was found in the inspected records. Review rendered wording against current source; retain exact English and draft notices until approved. |
| SS-003 | The full integrated signed-in journey needs a fresh check after the later changes. | Needs verification | Earlier records cover sample/isolated-component browser checks. They do not establish today's full signed-in journey: select saved farm, reopen answers, switch routes, save, then read matching report facts. Check on a disposable test site with no paid generation and verify the reviewed/deployed SHA. |
| SS-004 | Physical phone/iPad and Safari ergonomics remain unverified by the original release record. | Needs verification | The September audit explicitly distinguishes Chrome viewport checks from real devices. Exercise keyboard entry, rotation, review scrolling, final Save, cancel/discard and storage-failure retry on physical devices. Preserve detailed answers through mode switching. |

## Next implementation and acceptance checks

The [crop/production audit](crop-production-audit.md) is now archived alongside
this record. Its active implementation is already exploring shared site inputs.
Read that continuation before changing survey schemas or adding production
questions, so both flows build on one set of recorded facts.

Start with SS-001, extending the existing survey storage authority rather than
adding a second source of saved survey truth. Treat this as draft recovery, not
silent autosave of reported facts.

- Recover entered answers after reload; isolate different sites and accounts.
- Resume and discard deliberately; retain the last explicitly saved survey.
- Preserve comprehensive answers when switching to short mode.
- On storage failure, show recovery feedback and retain the current answers.
- Clear only the matching draft after a successful save. A failed save must
  leave a recoverable draft and must not publish new report facts.
- Exercise the real component in a browser and inspect the output; do not rely
  solely on storage-function tests. Continue the same IDs in the next dated audit.

This record adds documentation only. It does not change the survey picture,
saved farm geometry, farming figures, species, lessons or `PLAN_VERSION`.
Historical test/browser results remain attributed to their original audits.

## Archive verification

- Node 24.19.0: `npx tsc --noEmit` passed.
- `npm test`: 4,382 tests, 4,381 pass, zero failures, one existing TODO.
- `git diff --check` passed.
- All 51 local archive links resolve; all 30 original collected audit documents
  are represented in the index.
- The copied crop audit matches the source SHA-256. All nine pages were rendered
  and their layout inspected. The audit PDF itself was not edited.
- No new survey browser session was run. App improvements remain the next work,
  with earlier checks attributed to their original revisions.

PR and remote CI status are recorded in the PR and issue #35.
