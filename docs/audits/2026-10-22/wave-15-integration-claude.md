# Wave 15 integration close-out — 2026-10-22

- Auditor: Claude (integrator), folding the five wave 15 Sonnet swarm tracks onto the integration branch.
- Reviewed revision: `claude/zen-rubin-00ndhb` after the folds (the commit that carries this record), on top of `main` at `d99108f1`. The five track heads folded: `swarm/w15-isizulu-records` `3d620da0` (#1061), `swarm/w15-staff-dark` `a46d919c` (#1062), `swarm/w15-farmer-desktop` `39ac9933` (#1063), `swarm/w15-words-titles` `6e0926f0` (#1064), `swarm/w15-study-icons` `d3ce8168` (#1065).
- Deployment inspected: not inspected. Deploy happens when the integration PR (#1060) is squash-merged to `main`.
- Previous audit: [Wave 15 rendered re-capture — 22 October 2026](wave-15-recapture-claude.md), which carries every earlier ID and adds `w15-01` to `w15-03`.
- Scope: source review of every folded commit against its finding IDs, the PR descriptions, the test suite, and typecheck. No new rendered capture this round (see *Verification*).
- Evidence type: commit diffs on the five track branches, PR descriptions, targeted and wide test runs, `npx tsc --noEmit`.

## What was already done

All five tracks finished their task lists and pushed; none hit the session limit this wave.
Each branch was merged into the integration branch with a merge commit. Three merges were
clean; `isizulu-records` and `words-titles` both appended tests to the `package.json` test
list, and both sides were kept (533 test files registered, no duplicates, none missing).

Integrator changes on top of the folds:

- `tests/zulu-draft-pair-separator.test.ts` (the w15-02 test from the re-capture commit) was
  never added to the `package.json` test list, so CI had not been running it. It is registered now.
- `tests/study-ui-due-unlock-history-checks.ts`:
  - The words-titles track replaced the live `lib/i18n.tsx` sha pin with a chain-only check.
    The exact live pin is back, re-baselined to the new bytes, in front of the wave 15 layer
    (`WAVE_15_ENGLISH_REWORDED` plus the `i18n-before-wave-15` fixture).
  - New `WAVE_15_PENDING_REWORDED`: the 17 English-pending labels the track put into sentence
    case in `lib/i18n-pending.ts`. Tshivenda spreads those groups untranslated, so its dated
    dictionary owner now sees the exact pre-wave-15 label again. Each new value is checked
    against the live source line, and the "reject any unlisted change" guard still fires.
- `docs/study-translation-reviews/SESOTHO-STUDENT-WELCOME-UI-DRAFT-REVIEW.md`: the English
  source for `studentOpenDesignStudio` is now "Open design studio", matching the app's existing
  "Design studio" nav label. The Sesotho draft is unchanged.
- `components/exchange/ShareListingButton.tsx`: the share-failed fallback line was 11.5px. The
  farmer-desktop track had added the file to the type floor but not fixed that line. It is 12px now.
- code-12 remainder: `components/Onboarding.tsx` and `components/ThemePanel.tsx` no longer use
  `font-mono`. Both looked the same before and after, because `--font-mono` is Public Sans.
  `font-mono` is now only in the Codex-owned `app/facilitator/crops/page.tsx`.
- nav-16 remainder: `app/facilitator/print/layout.tsx` gives the printable plan its own title,
  "Printable plan — ImbewuField". It also came off `tests/page-titles.test.ts`'s out-of-scope list.
- Release note rewritten for the folded build (five lines, `sha: 'd99108f1'`), plus the
  `PROGRESS.md` entry, this record and the archive index.
- `main` moved to `1fb671ea` (Codex's survey draft recovery, #1066) before the merge, so `main`
  was merged in. The release note is re-stamped `sha: '1fb671ea'`, so the gate on `main` sees one
  unnoted commit (the squash) and not two. It is four lines plus two tour stops (/prices,
  /student), so Codex's survey line still shows and `tests/update-tour.test.ts` passes. The
  five-line note with no tour had pushed every tour stop out of the banner, which fails that test.

### Track summaries

| Track | PR | Done | Left (next wave) |
| --- | --- | --- | --- |
| isizulu-records | #1061 | copy-05 wording, code-12/code-15/code-11 in owned files, nav-17 (/login, /farmer, /prices), desk-18 (/prices), desk-06 (/prices, /calendar), sdesk-03 records/farmer halves, sub-12px in DataPanel and CropPriceGuide | copy-05 key behind `t()`; code-11 in NgoDashboard, CompletionScore, student, ReportView, ReportMapStocktake, DesignCanvas, updates; code-05 (account); 23 BRU group names in isiZulu (translator) |
| staff-dark | #1062 | dark-01 (CohortCharts, CohortDashboard), staff-16 (one line plus "How this is counted"), sdesk-03 NgoDashboard half confirmed already on tokens | Render /mentor, /samples, /reports in dark (not done by the track) |
| farmer-desktop | #1063 | sdesk-03 exchange and /vision fills (`EX.fill*`), desk-13 (/example `CompletionScore` surface, /vision two-column), code-10 (captions to 12px, 16 files on the type floor), code-20, code-12 chart files | `--on-forest` stays cream in dark (new `w15-04`) |
| words-titles | #1064 | copy-06 (journal header and h1), copy-07 (about 60 dictionary values, 14 pending, "My account"), ux-09/nav-09 (first sentence per entry, Show more in Simple), nav-16 confirmed on main | NavDrawer "Offline and sync" vs page name "Saved on this phone"; per-entry farmer wording in release notes |
| study-icons | #1065 | ux-12 arrows (about 40, `ArrowLabel`), nav-17 (/student/finance h1 space), code-20 confirmed, `CourseAudioPlayer` surface | ux-12 one button style per role (`FinanceCourse.module.css` is byte-pinned) |

## Findings and disposition

### Assigned to wave 15 tracks

| ID | Status | Evidence |
| --- | --- | --- |
| dark-01 | implemented | `CohortCharts.tsx` on `--bg-1`/`--border`/text tokens; `CohortDashboard.tsx` hex fallbacks and dark-ink fills removed; rendered dark at 390px on /funder and /assessments (#1062) |
| staff-16 | implemented | chart notes are one line plus a 44px "How this is counted" disclosure; Study pages were done in wave 14 (#1062) |
| sdesk-03 | implemented | records/farmer fills → `color-mix` on tokens (#1061); exchange and /vision fills (#1063); NgoDashboard already on tokens. Pale-on-pale forest fills in dark split out as `w15-04` |
| desk-13 | implemented | /example `CompletionScore` follows the theme; /vision uses the 72rem width with capture and result side by side at md+ (#1063) |
| code-10 | implemented | farmer captions raised to 12px, six routes and 16 files added to `tests/type-floor.test.ts`; ShareListingButton fixed at integration |
| code-20 | implemented | width/height on /home, /tour, /account, /vision and SiteDesign images (#1063); Study images confirmed (#1065) |
| code-12 | implemented | owned files (#1061), chart files (#1063), Onboarding and ThemePanel at integration; only Codex's crops page remains |
| copy-07 | implemented | sentence case across the dictionary, pending labels and NavDrawer; guarded by `tests/sentence-case-labels.test.ts` (#1064) |
| ux-09 | implemented | /updates shows first sentence per entry and Show more in Simple too (#1064) |
| nav-09 | implemented | date grouping confirmed on main; same change as ux-09 (#1064) |
| nav-16 | implemented | every route has a layout title; /facilitator/print added at integration. Codex's cropplan and facilitator/crops stay on the test's list |
| copy-06 | implemented (partial) | /journal uses `navFieldJournal` (#1064); the NavDrawer "Offline and sync" label vs "Saved on this phone" is left (its isiZulu is tied to that wording) |
| copy-05 | implemented (partial) | farmer saved-site error says "Site reports" (#1061); not yet behind `t()` |
| code-15 | implemented (partial) | records, quantity fields, SavedPlaces, CropSelect, MyRecords, LangSwitcher, login (#1061). A file-level grep finds `outline-none` without `focus-visible` only in Codex's crops page; check each input in the next capture |
| code-11 | implemented (partial) | MyRecords and BrandLogo emoji removed, `no-emoji-icons` scans both (#1061); seven files listed in the track table remain |
| code-05 | implemented (partial) | invoice done in wave 14; account disabled fills not reached (file not owned this wave) |
| nav-17 | implemented (partial) | /login "Sign in", /farmer sr-only "Map", /prices visible h1 (#1061), /student/finance (#1065), /account (w15-03). /design, /home, /samples/production, /partners remain; /plan is Codex's |
| desk-18 | implemented (partial) | /prices ends at its content (#1061); /surveys, /assessments, /journal remain |
| desk-06 | implemented (partial) | /prices and /calendar on `AppHeader` + `TabBar hideAtDesktop` (#1061); /records and /farmer keep their own headers by design |
| zu-05 | implemented (partial) | already on main apart from 23 BRU group names, which need a translator, not a coined name |
| ux-12 | implemented (partial) | arrows are Lucide icons via `ArrowLabel`, guarded by `tests/study-arrow-icons.test.ts` (#1065); one button style per role waits on re-baselining the byte-pinned `FinanceCourse.module.css` |

### New in wave 15

| ID | Status | Evidence |
| --- | --- | --- |
| w15-01 | implemented | in the re-capture commit; confirm the printed PDF in the next capture |
| w15-02 | implemented | in the re-capture commit; its test is now registered in `package.json` |
| w15-03 | implemented | in the re-capture commit |
| w15-04 | open | `--on-forest` is `#F7F2E9` in every theme column of `app/globals.css`, while `--color-forest-800` turns leaf in dark. ShareListingButton and /vision pair the two, so their buttons are pale text on a pale fill in dark. Fix it once in `globals.css` (dark `--on-forest`) and check the fills that are pinned dark (`EX.fill`) |

### Unchanged

- Codex-owned: desk-19, staff-19, dark-13, sdesk-15, zu-12, nav-18, zu-10, ux-06, w14-05 / nav-12, and the empty h1 on /plan → /facilitator/crops.
- Rory's decision: desk-15, staff-17 and copy-02 (whether Study keeps the word "facilitator"), nav-13 (legend emoji).

## Verification

- Typecheck: `npx tsc --noEmit` passes on the folded branch.
- Tests:
  - Targeted runs pass for every suite the folds and integrator edits touch. These include study-remaining-controls-next (the Tshivenda layer), core-reading-vegetables-followup, w15-isizulu-records-sweep, farmer-i18n-gaps, type-floor, sentence-case-labels, study-arrow-icons, staff-theme-tokens, theme-token-coverage, zulu-draft-pair-separator, nav-simple-track, community-simple-mode, no-emoji-icons, facilitator-print-scaling, page-titles, account-sample-mode-states and component-text-contrast.
  - A wide run of every test that reads the dictionaries, locales, release notes or the touched components ran as well.
  - The full suite runs in CI on #1060. Locally, the auth, product-tour, public-route-ssr, course-audio, course-deck, saved-reports and Firestore-rules files fail to load in this container on untouched `main` too, so CI decides those.
- Whitespace: not run.
- Output inspected:
  - No rendered capture this round. The track PRs report their own headless checks: staff-dark at 390px dark on /funder and /assessments; farmer-desktop on /example, /vision and /exchange at 1280; isizulu-records on /prices, /calendar and /login; study-icons on /student/finance and a design lesson at 390px light.
  - None of the tracks rendered isiZulu.
- Other limits: nothing in the folded work was reverted or weakened to pass a proof. The history layers were re-baselined to the exact new bytes with named lines and predecessor fixtures.

## Next continuation

1. Squash-merge #1060, confirm the deploy, close #1061–#1065 as folded, and record the SHA on issue #35.
2. Wave 16 re-capture of the merged build. Check:
   - every route in isiZulu (no track rendered it)
   - /mentor, /samples and /reports in dark (dark-01)
   - the exchange and /vision buttons in dark (w15-04)
   - /facilitator/print on a phone with *More options* open, and its printed PDF (w15-01)
   - /updates in Simple (ux-09)
   - the new "Printable plan" tab title
3. Wave 16 tracks from the partial rows:
   - w15-04 `--on-forest` in dark
   - code-11 seven files
   - code-05 account
   - nav-17 and desk-18 remaining routes
   - copy-05 key behind `t()`
   - ux-12 button style with a `FinanceCourse.module.css` re-baseline
4. Rory decides:
   - nav-13 print legend emoji
   - the "facilitator" wording in Study (desk-15, staff-17, copy-02)
   - NavDrawer "Offline and sync" vs "Saved on this phone" (copy-06)
