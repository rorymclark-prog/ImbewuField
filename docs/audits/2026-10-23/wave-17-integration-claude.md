# Wave 17 integration close-out — 2026-10-23

- Auditor: Claude (integrator), folding the three wave 17 Sonnet swarm tracks onto the integration branch.
- Reviewed revision: `claude/zen-rubin-00ndhb` after the folds (the commit that carries this record), on top of `main` at `2bddc451` (the wave 16 squash, #1072). Track heads folded: `swarm/w17-dark-forest-2` `0b701416` (#1073), `swarm/w17-text-taps-focus` `ec1f4863` (#1075), `swarm/w17-desk-interiors` `4f34bbe8` (#1076).
- Deployment inspected: not inspected. Deploy happens when the integration PR (#1074) is squash-merged to `main`.
- Previous audit: [Wave 17 rendered re-capture — 23 October 2026](wave-17-recapture-claude.md), which carries every earlier ID and adds `w17-01` to `w17-08`.
- Scope: source review of every folded commit against its finding IDs, the PR descriptions, the targeted tests, and typecheck. No new rendered capture this round (see *Verification*).
- Evidence type: commit diffs on the three track branches, PR descriptions, targeted test runs, `npx tsc --noEmit`.

## What was already done

All three tracks finished their task lists and pushed. Each branch was merged into the
integration branch with a merge commit; the only conflict was the `package.json` test list
(text-taps-focus and desk-interiors each registered a new test file), and both sides were kept.

Integrator changes on top of the folds:

- `app/student/page.tsx` is byte-pinned by the history layers. The dark-forest-2 track moved four
  forest-800 fills there onto `--on-forest-800`. The new `tests/wave-17-history-checks.ts` keeps the
  exact wave 16 bytes as `tests/fixtures/student-page-before-wave-17.tsx.txt`, pins the live file
  byte-exact, and records gone and arrived markers for the four colour swaps. The wave 16 layer
  (and through it the wave 14, wave 13, WebP and blind-reviewed layers) reads the page through it,
  and the blind-reviewed isolated copy carries the new layer and its fixture.
- The widened `tests/on-forest-contrast.test.ts` shipped with four allow-listed hits outside the
  track's files. One was real: own message bubbles in `app/community/messages/[threadId]/page.tsx`
  painted `--on-forest` on a forest-800 fill (cream on leaf in earth dark); now `--on-forest-800`.
  The other three (`GREEN` in `app/design/page.tsx`, `FOREST` in `components/SiteManageMenu.tsx`)
  are fixed `#1F4D2B` constants that never change with the theme, so cream text on them is
  readable. The guard now only treats a named constant as a themed fill when the file declares it
  as `var(--color-forest-800)` or `var(--emerald)`; the allow-list is empty. Reintroducing the old
  bubble colour fails it.
- The text-taps-focus track's focus guard allow-listed seven files as another track's. None was
  another track's:
  - `components/SiteSurveySheet.tsx` (number fields, notes box) and five label editors in
    `components/design/DesignCanvas.tsx` now carry the same `focus-visible` gold ring.
  - Its shared-style pattern only matched a typed `const x: T = {` with no `${...}` inside, so
    `const fieldStyle = {` in DesignCanvas went unseen. Fixed; removing one of the new rings fails it.
  - `/contact` fields keep their own `:focus-visible` box-shadow from `ContactMotion.module.css`;
    the guard accepts them only while the tag carries `motion.field` and the module declares the rule.
  - The four `app/community/**` entries had no offending field; the allow-list is gone.
- `tests/stale-paper-hex.test.ts` accepts `--on-forest-800` as a converted use on `/student`.
- Release note for the folded build, the `PROGRESS.md` entry, this record and the archive index.

### Track summaries

| Track | PR | Done | Left (next wave) |
| --- | --- | --- | --- |
| dark-forest-2 | #1073 | w17-01 (`.studyButton`, Refresher hero/footer links and day headings, four /student fills, /funder CSV button and district chips on `--on-forest-800`; guard scans every `*.tsx` and `*.module.css` under `app/` and `components/`), w17-08 (`DesignScaleDiagram` SVG labels 20–24 units, at least 12px on a phone) | Render dark /student, /student/teach-the-teachers and /funder |
| text-taps-focus | #1075 | w17-02 (`MyRecords` captions on `--text-secondary`), w17-03 (/network sort chip on `--color-forest-800`, at least 5.1:1 in every column), w17-05 (/samples/production print and source links 44px hit area), w17-07 (the six named inputs ring on focus, guard) | Small text inside Codex's `components/crops/*` |
| desk-interiors | #1076 | w17-06 MEL (`.assessmentCards` three to a row at 1280, coverage and result bars capped at 480px); journal filters already in the desktop sidebar for staff | Farmer journal on desktop shows only "Add a note" in the sidebar by Simple-mode design; Rory decides whether filters appear there at lg+ |

## Findings and disposition

### Assigned to wave 17 tracks

| ID | Status | Evidence |
| --- | --- | --- |
| w17-01 | implemented | `tests/on-forest-contrast.test.ts` (whole-tree scan, empty allow-list); CSS modules and `--emerald` fills covered |
| w17-02 | implemented | `tests/w17-text-taps-focus.test.ts` (MyRecords captions) |
| w17-03 | implemented | `tests/samples-network-contrast.test.ts`, `tests/w17-text-taps-focus.test.ts` |
| w17-04 | verified | fixed in the re-capture commit; unchanged here |
| w17-05 | implemented | `tests/w17-text-taps-focus.test.ts` (44px pseudo-element hit area) |
| w17-06 | implemented | `tests/w17-desk-interiors.test.ts`; journal question for Rory above |
| w17-07 | implemented | the six named inputs plus SiteSurveySheet and DesignCanvas; guard covers untyped and templated shared styles |
| w17-08 | implemented | `DesignScaleDiagram` label sizes; also changes the PNG/SVG export labels |
| w16-01 | implemented | completed by w17-01 (CSS modules and emerald fills) |
| desk-18 | implemented | page shells (wave 16) and MEL interiors (wave 17); farmer journal by design |

### Unchanged

- Codex-owned: desk-19, staff-19, dark-13, sdesk-15, zu-12, nav-18, zu-10, ux-06, w14-05 / nav-12, /plan, and the small text in `components/crops/*` on /samples/production.
- Rory's decision: desk-15, staff-17 and copy-02 ("facilitator" in Study), nav-13 (legend emoji), copy-06 remainder (NavDrawer "Offline and sync"), 23 BRU group names and `savedSiteUnavailable` in isiZulu (translator), filters in the farmer journal sidebar on desktop.

## Verification

- `npx tsc --noEmit`: clean.
- Targeted runs on the folded tree: every test that reads a file the tracks or the integrator
  changed (about 60 files), the student-page and history-layer tests, the release-note tests, and
  the three new track tests. Local failures are limited to the known container-only load-hook
  failures listed in the wave 16 record. CI on the pull request is the authoritative full run.
- Not run: a rendered capture of the folded build. The desk-interiors track rendered /assessments
  at 1280×800 and 390×844; the other tracks computed contrast from tokens. The wave 18 re-capture
  checks every row above against pixels.

## Next continuation

1. Wave 18 re-capture of the merged wave 17 build, with a sweep diff against the wave 17 one; dark /student, /student/teach-the-teachers, /funder and /network first.
2. Rory decides the items under *Unchanged*.
