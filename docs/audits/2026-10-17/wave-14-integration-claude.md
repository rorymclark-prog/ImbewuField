# Wave 14 integration close-out — 2026-10-17

- Auditor: Claude (integrator), folding the five wave 14 Sonnet swarm tracks onto the integration branch.
- Reviewed revision: `claude/zen-rubin-00ndhb` after the folds (the commit that carries this record), on top of `main` at `5acf084c`. The five track heads folded: `swarm/w14-dark-leftovers` `0e098ff3` (#1022), `swarm/w14-staff-copy` `2ea06774` (#1024), `swarm/w14-desktop-frame-2` `aebbb4eb` (#1025), `swarm/w14-study` `70756699` (#1026), `swarm/w14-isizulu` `5341fdf1` (#1027).
- Deployment inspected: not inspected. Deploy happens when the integration PR (#1023) is squash-merged to `main`.
- Previous audit: [Wave 14 rendered re-capture — 17 October 2026](wave-14-recapture-claude.md), which carries all wave 13 IDs and adds `w14-01` to `w14-05`.
- Scope: source review of every folded commit against its finding IDs, the test suite, and typecheck. No new rendered capture this round (see *Verification*).
- Evidence type: commit diffs and messages on the five track branches, PR descriptions, targeted and full test runs, `npx tsc --noEmit`.

## What was already done

The five tracks started from the task lists in the re-capture record. All five sessions were
stopped by the account's session limit part-way through their task lists, so each branch holds
the tasks it reached, pushed after every task, and nothing more. The integrator folded the
pushed work as it stood instead of restarting the sessions, and the unreached tasks are listed
per track below so the next wave starts from them.

Integrator changes on top of the folds:

- `app/student/page.tsx` adopts the shared `LanguageDraftNote` under the header (the study track
  left a note to do this once the isiZulu track's component landed) and keeps the course-specific
  isiZulu line beneath it.
- Study proof layers re-baselined to the legitimate new bytes, never weakened:
  `tests/wave-14-study-history-checks.ts` + `tests/fixtures/student-page-before-wave-14.tsx.txt`
  sit on the wave 13 theme layer for `app/student/page.tsx` (named markers: `AppHeader`,
  `TabBar hideAtDesktop`, shared note, Lucide tick, no `font-mono`, no `APP_HEADER_STYLE`);
  `tests/study-ui-due-unlock-history-checks.ts` gains a wave 14 dictionary layer for
  `lib/i18n.tsx` and `lib/locales/zu.ts` (four Study action labels respaced with U+00A0 before the
  arrow, listed by exact line; all other dictionary changes are additions, which the checker
  already proves re-declare nothing) with `*-before-wave-14.*` fixtures.
- Release note rewritten for the folded build (five lines, `sha: '5acf084c'`), `PROGRESS.md` entry,
  this record, and the archive index.

### Track summaries

| Track | PR | Reached | Not reached (next wave) |
| --- | --- | --- | --- |
| dark-leftovers | #1022 | Tasks 1–6: dark-05, dark-10, code-08, dark-11, code-17, nav-12, ux-07, dark-12, code-05, code-15 (invoice), dark-14, desk-16, nav-17 (/design), copy-16; nav-13 and copy-16 verified already landed; nav-01 and ux-06 for the files it owns | Task 7 (desk-06 + ux-01 on its own files; both landed through other tracks), task 8 sweep; desk-13 (files not owned) |
| desktop-frame-2 | #1025 | desk-06 on 14 farmer pages, desk-07 (`hideAtDesktop`), desk-08, staff-09, ux-01/desk-01/staff-03 clearance, desk-18, nav-17 (/home), copy-18, code-20 (vision, SiteDesign), code-15 and font-mono/theme-hex sweep on owned files | sdesk-03, ux-09/nav-09 remainder, the browser check at both viewports the PR promised |
| staff-copy | #1024 | staff-13, sdesk-14, ux-22 (hero eyebrow wording later reverted to keep the pinned acronym), copy-17, ux-01 (mentor), staff-15, sdesk-11, ux-07, code-11, code-12 (51 font-mono removals), staff-16 (CohortCharts footnotes), code-19, code-20, code-15 (CohortDashboard) | staff-16 for the NgoDashboard and funder walls of text; desk-18 on staff pages |
| isizulu | #1027 | Tasks 1–2: zu-01, zu-04 (shared `LanguageDraftNote`), zu-05 (biome names/species/challenges, BRU attribution, demo feature names), zu-11, ux-18 (`lib/produce-label.ts`), zu-03 | Tasks 3–6: copy-05, code-12, code-15, code-11, code-05, desk-18, nav-17, desk-06 on its files; BRU zone names and biome advice paragraphs stay English |
| study | #1026 | Tasks 1–4 and sweep part 1: nav-19 (two root causes), ux-12, zu-06, staff-16 (Study pages), code-19 (confirmed fixed), code-20, code-11, ux-01, desk-06 (/student), zu-04, font-mono/sub-11px/literal-hex sweep | Sweep part 2 and the full `npm test` the track deferred; the arrow-suffix → Lucide `ArrowRight` consolidation across 70+ Study buttons (flagged as follow-up) |

## Findings and disposition

Carried IDs keep their wave 13 wording (see the 16 October audit). The re-capture record's
"partial remainder" heading said 24 but listed 25 IDs; all 25 are dispositioned below, so the
archive now counts 161 wave 13 IDs plus five `w14-` IDs, 166 in all.

### From open (33) in the re-capture record

| ID | Status | Evidence |
| --- | --- | --- |
| ux-07 | implemented | ochre-as-text → `var(--gold-dim)` in /samples/production, /design, CohortCharts, /ngo pill (dark-leftovers `9a286276`, staff-copy `32f30507`) |
| ux-12 | implemented | Study disclaimers collapsed to one line + More; download card moved to the end (study `22bbcc7f`) |
| ux-18 | implemented | `produceLabel(key, lang)` on records, prices, lender card (isizulu `5341fdf1`) |
| dark-05 | implemented | Design Studio picker and design/lite on theme tokens (`d4d2178f`) |
| dark-10 | implemented | /partners on theme tokens outside the forest band (`d4d2178f`) |
| dark-11 | implemented | /samples/production calendar + ChatPanel/Screenshot consumers (`338f3a39`) |
| dark-12 | implemented | invoice preview frame (`080dc078`) |
| dark-14 | implemented | print-preview surround themed, sheet captioned (`e8121cd5`) |
| desk-08 | implemented | Home task list fills the 900px+ right column, one copy per viewport (`e150f878`) |
| desk-16 | implemented | SampleExperience h1 at `clamp(24px,2.4vw,30px)` (`0e098ff3`) |
| staff-09 | implemented | staff-aware Home hero + hidden farmer tiles for mentor/ngo/funder (`e150f878`) |
| staff-13 | implemented | `formatStaffDate`/`formatStaffDateRange`, sentence-case pills (`ebfb5099`) |
| sdesk-14 | implemented | MEL result bars in a responsive grid, FunderAssessments too (`ebfb5099`, `03e11c17`) |
| zu-01 | implemented | day-first isiZulu date from new weekday/month tables; `tests/zu-01-home-date.test.ts` (`d11daa13`) |
| zu-04 | implemented | shared `LanguageDraftNote` on farmer, records, login, prices (`d11daa13`), student (study `ec033ba3` + integrator) |
| zu-06 | implemented | Teach the Teachers card via `DesignDraftCopy` (`22bbcc7f`) |
| zu-11 | implemented | crop names everywhere via `lib/produce-label.ts`; `tests/zu-11-ux-18-produce-label.test.ts` (`5341fdf1`) |
| nav-12 | implemented | /samples/production overflow fixed with the zoom-based SheetScaler, h1 join fixed (`9a286276`); re-capture pending |
| nav-19 | implemented | OfflineDownload render-time `window` read and SVG `<title>` with two children; zero console errors in the track's Playwright re-run (`22bbcc7f`) |
| copy-17 | implemented | mentor h1 'Mentor', module heading, enrolment line order (`ebfb5099`) |
| code-08 | implemented | /partners off the `:root`-only Tailwind constants (`d4d2178f`) |
| code-17 | implemented | /samples/production CSS consumers themed (`338f3a39`) |
| code-19 | implemented | ProgrammeReport attendance table wrapper confirmed; Study tables confirmed (`57e4b067`, `2e3ba866`) |
| ux-06 | implemented (partial) | /samples/production half fixed with nav-12; the clipped bar-chart labels are under `components/crop*` (Codex) |
| ux-22 | implemented (partial) | About-these-counts chevron rows landed; the mentor hero eyebrow wording was reverted to keep the pinned 'ACT · SEF' label (`57e4b067`) |
| staff-16 | implemented (partial) | Study pages and CohortCharts footnotes done; NgoDashboard and funder dashboard walls of text not reached |
| zu-05 | implemented (partial) | biome names, species, challenges, BRU attribution and demo feature names in isiZulu; BRU zone names and biome advice paragraphs stay English |
| nav-01 | implemented (partial) | /design page root and toolbars themed; student, samples and MelDashboard halves were other tracks' files (student done under desk-06) |
| nav-17 | implemented (partial) | h1 on /design, /home, /samples/production; farmer, account, login, BrandLogo, finance not reached |
| code-11 | implemented (partial) | Lucide ticks on Study and staff pages; the isiZulu track's share and BrandLogo not reached |
| code-12 | implemented (partial) | 51 font-mono removals on staff pages, Study sweep; isiZulu track's share not reached |
| code-20 | implemented (partial) | img width/height on Study guides, vision, SiteDesign, report images; other pages not reached |
| desk-15 | blocked (Rory's decision) | 'facilitator' wording in Study, with staff-17 and copy-02 |

### From the partial remainder (25)

| ID | Status | Evidence |
| --- | --- | --- |
| ux-01 | implemented | `var(--lima-fab-clearance)` on example, vision, ExchangeBoard, mentor, student (`692015ca`, `ebfb5099`, `854c7deb`) |
| desk-01 | implemented | same clearance sweep (`692015ca`) |
| desk-06 | implemented | `AppHeader` on account, atlas, community (+profile, messages, u), contact, feedback, journal, network, offline, samples ×3, tips, tour, updates (`e150f878`) and /student (`854c7deb`); /home and /example keep bespoke headers on purpose |
| desk-18 | implemented | journal category chips in the desktop sidebar (`90d72b98`) |
| staff-03 | implemented | clearance sweep (`692015ca`) |
| staff-15 | implemented | `/facilitator` → `/mentor` (`ebfb5099`) |
| sdesk-11 | implemented | surveys jargon, mentor dates, demonstration-records pills (`32f30507`) |
| zu-03 | implemented | `buildCropBoardTasks`/`loadCropBoardTasks` take `lang`; `tests/zu-03-task-board-i18n.test.ts` (`5341fdf1`) |
| copy-16 | implemented | raw sync error no longer spliced into the invoice page; regression guard (`080dc078`) |
| copy-18 | implemented | /samples says sample, not 'practice view'/'Tour mode' (`90d72b98`) |
| ux-09 | implemented (partial) | not reached by desktop-frame-2 |
| dark-01 | implemented (partial) | not assigned this wave; carried |
| desk-13 | implemented (partial) | example, vision, Workspace.module.css not in the dark track's ownership; carried |
| sdesk-03 | implemented (partial) | not reached by desktop-frame-2 |
| nav-09 | implemented (partial) | not reached by desktop-frame-2 |
| nav-16 | implemented (partial) | not assigned this wave; carried |
| copy-05 | implemented (partial) | not reached by isizulu (task 3) |
| copy-06 | implemented (partial) | not assigned this wave; carried |
| copy-07 | implemented (partial) | not assigned this wave; carried |
| code-05 | implemented (partial) | invoice disabled fills done (`080dc078`); isiZulu track's share not reached |
| code-10 | implemented (partial) | not assigned this wave; carried |
| code-15 | implemented (partial) | invoice (18 inputs), owned desktop files, CohortDashboard paired with focus rings; isiZulu track's share not reached |
| staff-17 | blocked (Rory's decision) | 'facilitator' Study wording |
| nav-13 | blocked (Rory's decision) | verified: SheetScaler landed in wave 13; the emoji legend is pinned and waits on Rory |
| copy-02 | blocked (Rory's decision) | 'facilitator' wording |

### Blocked, Codex-owned or Rory's decision (7, unchanged)

dark-13, desk-19, staff-19, sdesk-15, zu-10, zu-12, nav-18.

### New in wave 14

| ID | Status | Evidence |
| --- | --- | --- |
| w14-01 | implemented | /account reads the sample role through `useSampleRole()`; in #1023 |
| w14-02 | implemented | first print sheet draws at 200mm beside the legend; in #1023 |
| w14-03 | implemented | /network district hint wraps below `sm`; in #1023 |
| w14-04 | needs verification | dark phone print preview not opened this round; no re-capture ran |
| w14-05 | implemented | the same /samples/production overflow as nav-12, fixed in `9a286276`; re-capture pending |

Totals: 133 implemented, 21 implemented (partial), 11 blocked or Rory's decision, 1 needs verification; 0 open.

## Verification

- Typecheck: `npx tsc --noEmit` passes on the folded branch.
- Tests: targeted runs of every suite the folds touch pass (study-remaining-controls-next, blind-reviewed-study-corrections, farmer-i18n-gaps, theme-token-coverage, zu-01/zu-03/zu-11, course-translation-drafts-ve, chat-widget-fab-overlap, account-sample-mode-states: 81 tests, 0 failures). The full suite runs in CI on #1023; locally `tests/auth-account-transition.test.ts` and `tests/auth-guest-migration.test.ts` fail identically on untouched `5acf084c` (a Node 24 `load` hook returning `null` in this container), so CI is the verdict for those two.
- Whitespace: not run.
- Output inspected: no rendered capture this round. The track PRs report their own Playwright checks (study: 390×844 light, four routes; desktop-frame-2: none yet). The next capture should re-check /samples/production (nav-12, w14-05), the dark phone print preview (w14-04), and the 14 pages that moved to `AppHeader`.
- Other limits: the swarm sessions could not finish their task lists (session limit), so "not reached" above is a hard stop, not a judgement; nothing in the folded work was reverted or weakened to pass a proof, the two study history layers were re-baselined to the exact new bytes with named markers and predecessor fixtures.

## Next continuation

1. Squash-merge #1023, confirm the deploy and `npm run notes:pending` on `main`, close #1022, #1024–#1027 as superseded, record the SHA on issue #35.
2. Re-capture the merged build with the 16 October script and close w14-04, nav-12/w14-05 and the AppHeader pages against pixels.
3. Wave 15 from the "not reached" column: staff-16 walls of text, sdesk-03, ux-09/nav-09, the isiZulu track's tasks 3–6 (copy-05, code-11/12/15, code-05, desk-18, nav-17, desk-06 on its files), the Study arrow-icon consolidation, and the carried rows never assigned (dark-01, nav-16, copy-06, copy-07, code-10, desk-13).
4. Rory decides: nav-13 print legend emoji; 'facilitator' Study wording (desk-15, staff-17, copy-02).
