# Wave 16 integration close-out — 2026-10-23

- Auditor: Claude (integrator), folding the five wave 16 Sonnet swarm tracks onto the integration branch.
- Reviewed revision: `claude/zen-rubin-00ndhb` after the folds (the commit that carries this record), on top of `main` at `ed8ed899` (the wave 15 squash, #1060). The five track heads folded: `swarm/w16-study-dark` `207cbbef` (#1067), `swarm/w16-taps-login-account` `2fd80b84` (#1068), `swarm/w16-leftovers` `d660930d` (#1069), `swarm/w16-dark-forest` `3b920bcd` (#1070), `swarm/w16-samples-network-example` `5c3287ea` (#1071).
- Deployment inspected: not inspected. Deploy happens when the integration PR is squash-merged to `main`.
- Previous audit: [Wave 16 rendered re-capture — 22 October 2026](../2026-10-22/wave-16-recapture-claude.md), which carries every earlier ID and adds `w16-01` to `w16-11`.
- Scope: source review of every folded commit against its finding IDs, the PR descriptions, the test suite, and typecheck. No new rendered capture this round (see *Verification*).
- Evidence type: commit diffs on the five track branches, PR descriptions, targeted and full test runs, `npx tsc --noEmit`.

## What was already done

All five tracks finished their task lists and pushed. Each branch was merged into the
integration branch with a merge commit; the only conflicts were in the `package.json` test list
(study-dark, taps-login-account, dark-forest and samples-network-example each registered new
test files; leftovers extended existing ones), and all sides were kept.

Integrator changes on top of the folds:

- `lib/course-modules.ts` is byte-pinned by several history layers (the canonical Sesotho media
  pin, `st-intro-silent-application`, `study-precision`, `study-b-a-c`). The study-dark track
  rewrote its `CATEGORY_TEXT_COLORS` map to tokens there. The file is restored byte-identical and
  the token map lives in the new `lib/category-text-colors.ts`, imported by `/student` and `/mentor`.
- `tests/wave-16-history-checks.ts`: a new layer for `app/student/page.tsx` (exact wave 15 bytes
  kept as `tests/fixtures/student-page-before-wave-16.tsx.txt`, live file pinned byte-exact, with
  gone and arrived markers for the three category icons and the new import). The wave 14 and
  blind-reviewed layers read the page through it.
- `tests/study-ui-due-unlock-history-checks.ts`: the live `lib/i18n.tsx` pin re-baselined after
  the leftovers track added `savedSiteUnavailable`; a wave 16 step (`i18n-before-wave-16` fixture)
  allows that one added key and no rewording.
- `tests/code-06-code-18-code-10.test.ts`: the initials span now uses `--on-forest-800`, which
  the dark-forest track declared in all four theme columns.
- `tests/invoice-share-print-contrast.test.ts` and `tests/ngo-dashboard-theme.test.ts` accept
  `--on-forest-800` on the share pill and NGO badge (the dark-forest track's repointing), and the
  blind-reviewed isolated copy includes the wave 16 layer and its fixture.
- w16-07 `/farmer` remainder (the samples track could not reach it): the two "Site reports"
  overlines in `components/DataPanel.tsx` move from `--gold` (3.85:1 in earth light) to
  `--gold-dim`, and the m² labels from `--text-muted` to `--text-secondary`.
- Release note for the folded build, the `PROGRESS.md` entry, the re-capture record, this record
  and the archive index.

The wave 15 PR (#1060) needed its own follow-up before it could merge: the words-titles track's
sentence case had not reached `components/SiteSurveySheet.tsx` (three survey step labels) or five
tests, and `tests/menu-button-coverage.test.ts` did not count screens built on `AppHeader`. Those
fixes went into #1060 (`ad2a6887`) and are on `main` under this branch.

### Track summaries

| Track | PR | Done | Left (next wave) |
| --- | --- | --- | --- |
| study-dark | #1067 | w16-03 (category text tokens per theme column, `OfflineDownload` on tokens, 12px "Your course"), w16-04 (four Study CSS modules on `--bg-*`/`--text-*`, leaf as border only, 12px diagram labels), ux-12 remainder (`FinanceCourse.module.css` buttons match `.studyButton`), `DeckPlayer` 12px | Render /student and the Study design pages in dark |
| taps-login-account | #1068 | w16-08 (/login notice `--gold-dim`, ink on `--text-secondary`), w16-09 (44px hit areas on /home, /invoice, /contact, /pitch, /login, /funder, /ngo), /records muted text on `--text-secondary`; code-05 already closed on the base | /home "Take a tour" 21px not reproduced; measure in the next capture |
| leftovers | #1069 | code-11 (DesignCanvas ✓ and SiteCropPlanPreview 🌱 to Lucide, scan widened), copy-05 (`savedSiteUnavailable` behind `t()`, isiZulu pending), desk-18 page shells (/surveys, /assessments, /journal end at their content on desktop), w16-10 (print page registers its back control), w16-11 (manual titles), /design and tips/tour 12px | desk-18 inside `MelDashboard` and `FieldJournal` (bar width, journal filters in the sidebar) |
| dark-forest | #1070 | w16-01 (`--on-forest-800` in four columns, about 45 places repointed, guard `tests/on-forest-contrast.test.ts`), w16-02 (`LessonLink` and /design labels on `--color-forest-800`), 12px and paper-hex sweep, focus rings on five community inputs | Six inline-style inputs with `outline: 'none'` and no className (EvidenceSheet, ProfileSheet, SiteManageMenu, ExchangeBoard, NewListingForm, JournalEntrySheet) |
| samples-network-example | #1071 | w16-05 (/samples/production 12px, theme headings, phone overflow fixed at its cause), w16-06 (/network 12px, `--gold-dim`/`--orange`/`--emerald` text), w16-07 /example | w16-07 /farmer (done by the integrator, above); small text left in Codex's `components/crops/*` |

## Findings and disposition

### Assigned to wave 16 tracks

| ID | Status | Evidence |
| --- | --- | --- |
| w16-01 | implemented | `--on-forest-800` declared in all four theme columns (8.70, 9.68, 5.81, 6.52:1 on that column's forest-800); `tests/on-forest-contrast.test.ts` rejects a forest-800 fill with plain `--on-forest` |
| w16-02 | implemented | `components/design/LessonLink.tsx` and the /design labels on `var(--color-forest-800)` |
| w16-03 | implemented | `lib/category-text-colors.ts` (seven `--cat-<name>-text` tokens, every theme column); `OfflineDownload` on theme tokens; 12px labels |
| w16-04 | implemented | `tests/study-dark-cards.test.ts`; the four modules on `tests/theme-leftovers.test.ts` |
| w16-05 | implemented | `ProductionExample.module.css` 12px floor; `.calendarScroll` is `position: relative`, document 390px wide at 390px in English and isiZulu (track measurement) |
| w16-06 | implemented | `/network` and `NetworkMap` budgets at 0 in `tests/type-floor.test.ts`; `tests/samples-network-contrast.test.ts` |
| w16-07 | implemented | /example by the track, /farmer `DataPanel` by the integrator |
| w16-08 | implemented | /login notice on `--gold-dim`, secondary text on `--text-secondary` |
| w16-09 | partial | `tests/tap-targets-w16.test.ts`; /home "Take a tour" not reproduced |
| w16-10 | implemented | `/facilitator/print` calls `useRegisterBackControl()` |
| w16-11 | implemented | `tests/page-titles.test.ts` covers `/manual/[lang]` and the chapter pages |
| code-05 | verified | already closed on the base; `tests/stale-paper-hex.test.ts` covers `#FBF6EC` |
| code-11 | implemented | `tests/no-emoji-icons.test.ts` scans the files the wave 15 close-out listed |
| copy-05 | implemented | `t('savedSiteUnavailable')`; isiZulu pending (English fallback) |
| desk-18 | partial | page shells done; `MelDashboard` and `FieldJournal` interiors left |
| ux-12 | implemented | `FinanceCourse.module.css` buttons match `.studyButton` |

### Unchanged

- Codex-owned: desk-19, staff-19, dark-13, sdesk-15, zu-12, nav-18, zu-10, ux-06, w14-05 / nav-12, /plan, and the small text in `components/crops/*` on /samples/production.
- Rory's decision: desk-15, staff-17 and copy-02 ("facilitator" in Study), nav-13 (legend emoji), copy-06 remainder (NavDrawer "Offline and sync"), 23 BRU group names and `savedSiteUnavailable` in isiZulu (translator).

## Verification

- `npx tsc --noEmit`: clean.
- Full `npm test` on the folded tree, locally: 5157 of 5216 passed before the two-hour local limit stopped
  the run; the files it had not reached were then run one by one and pass. Every remaining local failure
  is the known container-only load-hook failure (`ERR_INVALID_RETURN_PROPERTY_VALUE`: auth-account-transition,
  auth-guest-migration, public-route-ssr, venue-location, product-tour, saved-reports, course-audio,
  course-deck, paired-draft-slides), each identical on the wave 15 base, plus the three tests fixed above.
  CI on the pull request is the authoritative full run.
- Not run: a rendered capture of the folded build. The tracks measured /samples/production, /network and /example in a browser; the rest were not rendered. The wave 17 re-capture checks every row above against pixels.

## Next continuation

1. Wave 17 re-capture of the merged wave 16 build, with a sweep diff against the wave 16 one; dark mode on /student, the Study design pages and every forest-800 button first.
2. Remainders: w16-09 /home tour card, desk-18 interiors, the six inline-style inputs without focus rings.
3. Rory decides the items under *Unchanged*.
