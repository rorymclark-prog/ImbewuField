# Wave 20 integration close-out — 2026-10-24

- Auditor: Claude (integrator), folding the five wave 20 Sonnet swarm tracks onto the integration branch that already carried wave 19.
- Reviewed revision: `claude/zen-rubin-00ndhb` after the folds (the commit that carries this record), with `main` at `0858cf13` (#1098, Codex's funder and organisation reports work) merged in. Wave 19 had not been squash-merged yet, so #1091 now carries waves 19 and 20 together. Track heads folded: `swarm/w20-farmer-pages` `91420104` (#1094), `swarm/w20-farmer-data` `2268da87` (#1097), `swarm/w20-samples-map` `d5fb3472` (#1096), `swarm/w20-study` `4f9eaca8` (#1093), `swarm/w20-staff-public` `a2d97994` (#1095).
- Deployment inspected: not inspected. Deploy happens when #1091 is squash-merged to `main`.
- Previous audit: [Wave 20 rendered re-capture — 23 October 2026](../2026-10-23/wave-20-recapture-claude.md), which carries every `w19-` ID and adds `w20-01` to `w20-46`.
- Scope: source review of every folded commit against its finding IDs, the targeted tests, the pinned-file history checks, typecheck, and a rendered pass of the merged build.
- Evidence type: commit diffs on the five track branches, a per-file run of the registered suite, `npx tsc --noEmit`, `next build` + `next start` in sample mode with Playwright at 390 and 1280px (light and dark, English and isiZulu), plus 1024px for the staff headers.

## What was already done

All five tracks finished their task lists and opened PRs. Each branch was merged into the
integration branch with a merge commit; `main` (#1098) was merged in after. The conflicts were the
`package.json` test list (every side kept) and `lib/release-notes.ts` (wave 19's note and Codex's
#1098 note both kept, wave 20's added on top).

Integrator changes on top of the folds:

- **Dictionary pins.** `lib/i18n.tsx` and the isiZulu dictionary are byte-pinned by
  `tests/study-ui-due-unlock-history-checks.ts`. Wave 20 added isiZulu keys (exchange crop chips, the
  Home task board) and no English changes. The pre-wave-20 bytes are kept in
  `tests/fixtures/i18n-before-wave-20.tsx.txt` and `tests/fixtures/zu-before-wave-20.ts.txt`; the
  wave 19 and wave 14 proofs now bind to those fixtures, and the wave 20 check allows additions only.
- **Stale wave 19 pins.** Three wave 20 changes made earlier source pins stale. The tests now check
  the new form with the same intent:
  - w20-30 moved Farm Finance and the facilitator refresher onto the shared `StudyHeader`
    (`tests/w19-study.test.ts`).
  - The Study disclosures use the shared `<Summary>` with its arrow (`tests/student-simple.test.ts`).
  - w20-01 widened the listing identity column to `minmax(min-content, 1fr)`
    (`tests/w19-farmer-chrome.test.ts`).
- **Staff headers from tablet to desktop.** Rendered in isiZulu at 1280px, /funder's Settings sat
  86px past the right edge. At 1024px it overflowed in English as well (16px). At 768px the row was
  73px too wide on /funder in English and 174px in isiZulu. /ngo measured the same at 768px (123px
  over in English, 196px in isiZulu), but its wrapper clips, so the overflow showed as a Settings
  button cut off at the edge rather than a sideways scroll. w20-37 had hidden the duplicate
  "Portfolio map" pill at lg on /ngo, where the desktop nav already links Network, but /funder kept
  its own. Three fixes:
  - The /funder pill is now `lg:hidden` too.
  - A new `data-header-label` marks the text of Settings, the role switcher and the Portfolio map
    pill. From 640 to 1279px, on headers that carry the desktop nav, `app/globals.css` hides those
    labels, so the pills go icon-only. Below 640px the existing phone rule already applies.
  - The Portfolio map link gains an aria-label. Settings and the role switcher already had theirs.
- Release note for the folded build, the `PROGRESS.md` entry, this record and the archive index.

No track edited `app/student/page.tsx` or any Codex-owned file.

### Track summaries

| Track | PR | Done | Left / caveats |
| --- | --- | --- | --- |
| farmer-pages | #1094 | w20-01 to w20-08: exchange kind badge no longer runs under the Sample pill; crop chips and lede in isiZulu, with isiZulu drafts for the Home task board; sans exchange and account controls; inline chips and a phone stat grid; journal fonts on the display token; plain offline copy; a readable measure on journal, calendar and account; the staff Lima strip inset | Not rendered in the track's sandbox; checked here |
| farmer-data | #1097 | w20-09 to w20-15 and w20-26: themed completeness card; DataPanel tabs that wrap and fit, in sans; NextStepCoach on themed tokens; sans CropSelect and MyRecords controls; form card width; themed cards and sparklines; one Invoice pill; the Crèche label | — |
| samples-map | #1096 | w20-16 to w20-25: MEL hero on phone in dark; /samples buttons scoped, one pill radius and an MEL-style notice; /samples/production on forest tokens with 120px phone labels; MEL toggle above the metrics, one accordion style and a "No answers yet" state; reports on the shared width; filled selected tabs; design picker on AppHeader; a 640px feedback form | One w19 pill-radius pin updated by the track; `components/crops/*` dark contrast on /samples/production is Codex-owned and unchanged |
| study | #1093 | w20-27 to w20-36: one shared header on Study pages, arrows on open sections, Lima no longer covers text, card titles and offline strip on /student, teach-the-teachers drift | `app/student/page.tsx` untouched (byte-pinned); three wave 19 pins re-baselined by the integrator |
| staff-public | #1095 | w20-37 to w20-46: AppHeader nav never clips, with the title only below lg and the /ngo pill hidden at lg; /network badge off the phone header, one status colour map, Lucide legend; mentor follow-up dates and metric text; /vision toggle; /partners heading hyphen; cohort Export CSV on the forest fill; login on theme tokens; print sheet tokens; Lucide chevrons on /pitch | /funder pill missed; fixed by the integrator |

## Findings and disposition

### Assigned to wave 20 tracks

| ID | Status | Evidence |
| --- | --- | --- |
| w20-01 | implemented | `tests/w20-farmer-pages.test.ts` (#1094) |
| w20-02 | implemented | `tests/w20-farmer-pages.test.ts` (#1094) |
| w20-03 | implemented | `tests/w20-farmer-pages.test.ts` (#1094) |
| w20-04 | implemented | `tests/w20-farmer-pages.test.ts` (#1094) |
| w20-05 | implemented | `tests/w20-farmer-pages.test.ts` (#1094) |
| w20-06 | implemented | `tests/w20-farmer-pages.test.ts` (#1094) |
| w20-07 | implemented | `tests/w20-farmer-pages.test.ts` (#1094) |
| w20-08 | implemented | `tests/w20-farmer-pages.test.ts` (#1094) |
| w20-09 | implemented | `tests/w20-farmer-data.test.ts` (#1097) |
| w20-10 | implemented | `tests/w20-farmer-data.test.ts` (#1097) |
| w20-11 | implemented | `tests/w20-farmer-data.test.ts` (#1097) |
| w20-12 | implemented | `tests/w20-farmer-data.test.ts` (#1097) |
| w20-13 | implemented | `tests/w20-farmer-data.test.ts` (#1097) |
| w20-14 | implemented | `tests/w20-farmer-data.test.ts` (#1097) |
| w20-15 | implemented | `tests/w20-farmer-data.test.ts` (#1097) |
| w20-16 | implemented | `tests/w20-samples-map.test.ts` (#1096) |
| w20-17 | implemented | `tests/w20-samples-map.test.ts` (#1096) |
| w20-18 | implemented | `tests/w20-samples-map.test.ts` (#1096) |
| w20-19 | implemented | `tests/w20-samples-map.test.ts` (#1096) |
| w20-20 | implemented | `tests/w20-samples-map.test.ts` (#1096) |
| w20-21 | implemented | `tests/w20-samples-map.test.ts` (#1096) |
| w20-22 | implemented | `tests/w20-samples-map.test.ts` (#1096) |
| w20-23 | implemented | `tests/w20-samples-map.test.ts` (#1096) |
| w20-24 | implemented | `tests/w20-samples-map.test.ts` (#1096) |
| w20-25 | implemented | `tests/w20-samples-map.test.ts` (#1096) |
| w20-26 | implemented | `tests/w20-farmer-data.test.ts` (#1097) |
| w20-27 | implemented | `tests/w20-study.test.ts` (#1093) |
| w20-28 | implemented | `tests/w20-study.test.ts` (#1093) |
| w20-29 | implemented | `tests/w20-study.test.ts` (#1093) |
| w20-30 | implemented | `tests/w20-study.test.ts` (#1093) |
| w20-31 | implemented | `tests/w20-study.test.ts` (#1093) |
| w20-32 | implemented | `tests/w20-study.test.ts` (#1093) |
| w20-33 | implemented | `tests/w20-study.test.ts` (#1093) |
| w20-34 | implemented | `tests/w20-study.test.ts` (#1093) |
| w20-35 | implemented | `tests/w20-study.test.ts` (#1093) |
| w20-36 | implemented | `tests/w20-study.test.ts` (#1093) |
| w20-37 | implemented | `tests/w20-staff-public.test.ts` (#1095) |
| w20-38 | implemented | `tests/w20-staff-public.test.ts` (#1095) |
| w20-39 | implemented | `tests/w20-staff-public.test.ts` (#1095) |
| w20-40 | implemented | `tests/w20-staff-public.test.ts` (#1095) |
| w20-41 | implemented | `tests/w20-staff-public.test.ts` (#1095) |
| w20-42 | implemented | `tests/w20-staff-public.test.ts` (#1095) |
| w20-43 | implemented | `tests/w20-staff-public.test.ts` (#1095) |
| w20-44 | implemented | `tests/w20-staff-public.test.ts` (#1095) |
| w20-45 | implemented | `tests/w20-staff-public.test.ts` (#1095) |
| w20-46 | implemented | `tests/w20-staff-public.test.ts` (#1095) |

### Carried from wave 19

The wave 19 partials the re-capture assigned to wave 20 IDs close with them, pending the wave 21
re-capture: w19-03 (w20-03, w20-10, w20-12), w19-05 (w20-04), w19-06 (w20-01), w19-11 (w20-13),
w19-14 (w20-12), w19-19 (w20-16), w19-21 (w20-25), w19-32 (w20-31), w19-38 (w20-37, w20-38),
w19-39 (w20-39) and w19-42 (w20-41, w20-43).

### Found during integration

- `/samples/production` in dark: "Include kept food" and the Stored/Frozen/Dried labels are dark ink
  on the dark page (`components/crops/ProductionAvailabilityGraphs.tsx`). Codex-owned; recorded, not changed.
- The low-contrast heuristic flagged "Ask for help", two Study notices, the exchange chips and the
  /mentor "Follow-up overdue" chip; the screenshots show them legible. These are measurement
  artefacts of translucent backgrounds, not findings.

### Unchanged

- Codex-owned: /plan, `components/crops/*` on /samples/production, and the IDs listed as Codex-owned in the re-capture.
- Rory's decision: desk-15, staff-17 and copy-02 ("facilitator" in Study), nav-13 (legend emoji), copy-06 remainder (NavDrawer "Offline and sync"), farmer journal filters in the sidebar at lg+, the personal Gmail contact on /partners and /pitch, and one staff-dashboard header pattern.
- Translator: copy-05 (`savedSiteUnavailable`), the 23 BRU group names, and the isiZulu drafts added by earlier waves and this one.

## Verification

- `npx tsc --noEmit` clean; `next build` succeeds on the merged tree.
- The five `tests/w20-*.test.ts` files pass, as do the re-baselined pins (the dictionary history
  checks, w19-study, w19-farmer-chrome, student-simple), the release-notes tests, and every test
  that reads AppHeader, RoleSwitcher, SettingsButton, `app/globals.css` or /funder.
- A per-file run of the whole registered suite then found three older pins that the wave 20 tracks
  had broken without updating: `demo-finance` (the sample sheet name is now "Crèche", w20-26),
  `w18-map-reports` w18-55 (the Design Studio picker's title moved to the AppHeader, w20-23) and
  `zu-11-ux-18-produce-label` (the w20-14 sparkline underlay used a `color-mix` of
  `--color-forest-800`, which that guard forbids; it is now the token at 30% stroke opacity, which
  looks the same). All three were fixed on #1091. The remaining failures are the known sandbox-only
  set (course-audio, course-deck, saved-reports, venue-location, public-route-ssr, product-tour,
  auth-account-transition, auth-guest-migration; saved-reports and venue-location fail in the
  sandbox's module loader hook before any assertion runs) and the emulator tests. CI runs the full
  suite on #1091.
- Rendered in sample mode with `next start`: zero horizontal overflow on every swept route at 390px
  and 1280px, light and dark, in English, and at 390px in isiZulu. After the header fix, the AppHeader
  row on /funder, /ngo, /reports, /surveys, /mentor and /assessments fits its own width (no clipped
  or scrolled controls) at 640, 768, 900, 1024, 1280 and 1536px in both languages.
  The isiZulu exchange chips read "Okunikezwayo", "Okufunwayo", "Ushevu" and "Utamatisi".

## Next continuation

1. Wave 21 re-capture of the merged build, with a sweep diff against wave 20. Start with the
   tablet and desktop headers (640 to 1279px) on every staff page, measuring the header's own scroll
   width, since a clipping wrapper hides overflow from the page scroll width, the exchange on phone in isiZulu, /records in dark, and
   the Study pages on the shared header.
2. Rory decides the items under *Unchanged*; the translator reviews the isiZulu drafts.
