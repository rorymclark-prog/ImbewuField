# Wave 18 integration close-out — 2026-10-23

- Auditor: Claude (integrator), folding the eight wave 18 Sonnet swarm tracks onto the integration branch.
- Reviewed revision: `claude/zen-rubin-00ndhb` after the folds (the commit that carries this record), on top of `main` at `0d8445cc` (the wave 17 squash, #1074). Track heads folded: `swarm/w18-samples-mel` `aedbb0c9` (#1077), `swarm/w18-teach-tour` `37b1f117` (#1085), `swarm/w18-courses` `804c8db7` (#1078), `swarm/w18-staff-chrome` `4b4ef397` (#1080), `swarm/w18-records` `cb269f1f` (#1079), `swarm/w18-home-titles` `5a265827` (#1081), `swarm/w18-public` `83d09562` (#1084), `swarm/w18-map-reports` `70663c79` (#1083).
- Deployment inspected: not inspected. Deploy happens when the integration PR (#1082) is squash-merged to `main`.
- Previous audit: [Wave 18 rendered re-capture — 23 October 2026](wave-18-recapture-claude.md), which carries every earlier ID and adds `w18-01` to `w18-59`.
- Scope: source review of every folded commit against its finding IDs, the PR descriptions, the targeted tests, and typecheck.
- Evidence type: commit diffs on the eight track branches, PR descriptions, targeted test runs, `npx tsc --noEmit`.

## What was already done

All eight tracks finished their task lists and pushed. Each branch was merged into the
integration branch with a merge commit. The only conflicts were in the `package.json` test list
(every track registered one `tests/w18-<track>.test.ts`); every side was kept, and the list was
checked afterwards for missing files and duplicates (547 entries, none missing or repeated).

No track edited a byte-pinned file. Two tracks first changed `lib/i18n.tsx` (whose dictionary
hash is pinned) and then reverted in favour of existing keys, so nothing needs re-baselining.

Integrator changes on top of the folds:

- `/vision` "Ask Lima" button: the public track moved its fill from fixed `#1F4D2B` to
  `var(--color-forest-800)` but left the label on plain `--on-forest`, which is cream on leaf in
  earth dark (about 1.8:1). `tests/on-forest-contrast.test.ts` caught it on the folded tree; the
  button and its label now use `--on-forest-800`.
- `/offline` (home-titles track): the new chevron CSS was a `<style>` text child. The server escapes
  its `>` to `&gt;`, the browser reads `<style>` raw, so the open-state rule was broken until hydration
  and React logged a hydration mismatch (#425, then #418/#423) on every load. Found in the rendered
  spot check; the CSS now goes through `dangerouslySetInnerHTML`, and
  `tests/inline-style-hydration.test.ts` fails on any `<style>` text child containing `<`, `>` or `&`
  (it fails on the folded track's version of the page).
- `components/ProductTour.module.css` (teach-tour track): moving the font from `.page` to `.scroll`
  put it first in the rule and broke the nav-03 pins (`.scroll{flex:1;overflow-y:auto;padding:…`).
  Same declarations, reordered.
- Two older pins re-baselined to the wave 18 decision w18-29 (one tour entry on /ngo and /funder, via
  the menu): `tests/tap-targets-w16.test.ts` now asserts the header tour link is gone rather than
  sizing it, and `tests/ngo-dashboard-theme.test.ts` checks forest-800 on the active tab, since the
  header link that carried it was removed.
- Release note for the folded build, the `PROGRESS.md` entry, this record and the archive index.

### Track summaries

| Track | PR | Done | Left / caveats |
| --- | --- | --- | --- |
| samples-mel | #1077 | w18-01 to w18-11: /samples header and tab bar edge to edge, hidden file input no longer leaks, real buttons, single back control on /samples/production, pill links, gardens grid, MEL tile type and readable states/dates, one disclosure pattern | isiZulu "Akukavulwa" (not opened yet) is an unreviewed draft |
| teach-tour | #1085 | w18-12 to w18-18: Teach the Teachers in app fonts with chevron disclosures and outline jump links; tour tiles, primary button and header follow the theme | Not rendered in the track's sandbox |
| courses | #1078 | w18-19 to w18-26: English-source line themed; course diagrams follow theme and font; link underline, syllabus numbers, paragraph rhythm; preview cards share a surface; raw record id gone from the scale source table | Dark diagrams use a CSS invert filter |
| staff-chrome | #1080 | w18-27 to w18-34: mentor tab bar offers Assessments, tabs gated by role; FieldVisitGuide tiles themed; one tour entry on /ngo and /funder; cohort h2; one tab style with distinct icons; /network stats grid; TabBar active pill themed; MenuButton tour pill | Header "Take a tour" removed: signed-in non-sample users reach the tour from the menu |
| records | #1079 | w18-35 to w18-41: closed ThemePanel no longer paints a shadow band; records fields themed; lender figures on one line; Picked tab keeps summary cards on desktop; shared kg formatter; sample Account shows the active language; isiZulu invoice dates | isiZulu "Ukubukeka" is an unreviewed draft; not rendered in the track's sandbox |
| home-titles | #1081 | w18-42 to w18-47: one page-title style; /offline hierarchy and chevrons; letter-spacing only on h1/h2; Home quick tiles share one Lucide chip; staff Home links card gated by role; exchange meta row, localised crop name, rand format | Home tile PNG art no longer rendered (files kept in `public/`) |
| public | #1084 | w18-48 to w18-52: /contact send button, icon tiles and practice notice themed; login inputs full opacity, no Tour pill on /login; pitch deck fits above controls; /vision one centred column until a result | Not rendered in the track's sandbox; Ask Lima text fixed by the integrator |
| map-reports | #1083 | w18-53 to w18-59: atlas search fills its wrapper, hint full width; design picker themed; reports crop-plan preview themed; /example land and water cards themed with inline units; /surveys separator, icon and caption | Not rendered in the track's sandbox; CompletionScore card not stretched |

## Findings and disposition

### Assigned to wave 18 tracks

| ID | Status | Evidence |
| --- | --- | --- |
| w18-01 | implemented | `tests/w18-samples-mel.test.ts` (#1077) |
| w18-02 | implemented | `tests/w18-samples-mel.test.ts` (#1077) |
| w18-03 | implemented | `tests/w18-samples-mel.test.ts` (#1077) |
| w18-04 | implemented | `tests/w18-samples-mel.test.ts` (#1077) |
| w18-05 | implemented | `tests/w18-samples-mel.test.ts` (#1077) |
| w18-06 | implemented | `tests/w18-samples-mel.test.ts` (#1077) |
| w18-07 | implemented | `tests/w18-samples-mel.test.ts` (#1077) |
| w18-08 | implemented | `tests/w18-samples-mel.test.ts` (#1077) |
| w18-09 | implemented | `tests/w18-samples-mel.test.ts` (#1077) |
| w18-10 | implemented | `tests/w18-samples-mel.test.ts` (#1077); isiZulu label is an unreviewed draft |
| w18-11 | implemented | `tests/w18-samples-mel.test.ts` (#1077) |
| w18-12 | implemented | `tests/w18-teach-tour.test.ts` (#1085) |
| w18-13 | implemented | `tests/w18-teach-tour.test.ts` (#1085) |
| w18-14 | implemented | `tests/w18-teach-tour.test.ts` (#1085) |
| w18-15 | implemented | `tests/w18-teach-tour.test.ts` (#1085) |
| w18-16 | implemented | `tests/w18-teach-tour.test.ts` (#1085) |
| w18-17 | implemented | `tests/w18-teach-tour.test.ts` (#1085) |
| w18-18 | implemented | `tests/w18-teach-tour.test.ts` (#1085) |
| w18-19 | implemented | `tests/w18-courses.test.ts` (#1078) |
| w18-20 | implemented | `tests/w18-courses.test.ts` (#1078) |
| w18-21 | implemented | `tests/w18-courses.test.ts` (#1078) |
| w18-22 | implemented | `tests/w18-courses.test.ts` (#1078) |
| w18-23 | implemented | `tests/w18-courses.test.ts` (#1078) |
| w18-24 | implemented | `tests/w18-courses.test.ts` (#1078) |
| w18-25 | implemented | `tests/w18-courses.test.ts` (#1078) |
| w18-26 | implemented | `tests/w18-courses.test.ts` (#1078); also closes w17-08 remainder |
| w18-27 | implemented | `tests/w18-staff-chrome.test.ts` (#1080) |
| w18-28 | implemented | `tests/w18-staff-chrome.test.ts` (#1080) |
| w18-29 | implemented | `tests/w18-staff-chrome.test.ts` (#1080) |
| w18-30 | implemented | `tests/w18-staff-chrome.test.ts` (#1080) |
| w18-31 | implemented | `tests/w18-staff-chrome.test.ts` (#1080) |
| w18-32 | implemented | `tests/w18-staff-chrome.test.ts` (#1080) |
| w18-33 | implemented | `tests/w18-staff-chrome.test.ts` (#1080) |
| w18-34 | implemented | `tests/w18-staff-chrome.test.ts` (#1080) |
| w18-35 | implemented | `tests/w18-records.test.ts` (#1079) |
| w18-36 | implemented | `tests/w18-records.test.ts` (#1079) |
| w18-37 | implemented | `tests/w18-records.test.ts` (#1079) |
| w18-38 | implemented | `tests/w18-records.test.ts` (#1079) |
| w18-39 | implemented | `tests/w18-records.test.ts` (#1079) |
| w18-40 | implemented | `tests/w18-records.test.ts` (#1079); isiZulu label is an unreviewed draft |
| w18-41 | implemented | `tests/w18-records.test.ts` (#1079) |
| w18-42 | implemented | `tests/w18-home-titles.test.ts` (#1081) |
| w18-43 | implemented | `tests/w18-home-titles.test.ts` (#1081) |
| w18-44 | implemented | `tests/w18-home-titles.test.ts` (#1081) |
| w18-45 | implemented | `tests/w18-home-titles.test.ts` (#1081) |
| w18-46 | implemented | `tests/w18-home-titles.test.ts` (#1081) |
| w18-47 | implemented | `tests/w18-home-titles.test.ts` (#1081) |
| w18-48 | implemented | `tests/w18-public.test.ts` (#1084) |
| w18-49 | implemented | `tests/w18-public.test.ts` (#1084) |
| w18-50 | implemented | `tests/w18-public.test.ts` (#1084) |
| w18-51 | implemented | `tests/w18-public.test.ts` (#1084) |
| w18-52 | implemented | `tests/w18-public.test.ts` (#1084); integrator moved the Ask Lima button text to `--on-forest-800` |
| w18-53 | implemented | `tests/w18-map-reports.test.ts` (#1083) |
| w18-54 | implemented | `tests/w18-map-reports.test.ts` (#1083) |
| w18-55 | implemented | `tests/w18-map-reports.test.ts` (#1083) |
| w18-56 | implemented | `tests/w18-map-reports.test.ts` (#1083) |
| w18-57 | implemented | `tests/w18-map-reports.test.ts` (#1083) |
| w18-58 | implemented | `tests/w18-map-reports.test.ts` (#1083) |
| w18-59 | implemented | `tests/w18-map-reports.test.ts` (#1083) |
| w17-08 | implemented | remainder closed by w18-26 (no `<small>` record id under the bed label) |

### Unchanged

- Codex-owned: desk-19, staff-19, dark-13, sdesk-15, zu-12, nav-18, zu-10, ux-06, w14-05 / nav-12, /plan (the 158 contrast rows on /plan in the wave 18 sweep), and the small crop text in `components/crops/*` on /samples/production.
- Rory's decision: desk-15, staff-17 and copy-02 ("facilitator" in Study), nav-13 (legend emoji), copy-06 remainder (NavDrawer "Offline and sync"), farmer journal filters in the sidebar at lg+, copy-05 and the isiZulu drafts above (translator).

## Verification

- `npx tsc --noEmit`: clean.
- Targeted runs on the folded tree: the eight `tests/w18-*.test.ts` files, every existing test file a track changed, the history (byte-pin) layers, `tests/theme-token-coverage.test.ts`, `tests/component-text-contrast.test.ts` and `tests/on-forest-contrast.test.ts` — 19 files, all passing after the /vision fix. CI on the pull request is the authoritative full run.
- Full registered suite locally (`--test-concurrency=6`, 5,160 tests): the three regressions above
  were found this way and fixed. The other failures also fail on `origin/main` in this sandbox
  (`course-audio`, `course-deck`, `saved-reports`, `public-route-ssr`, `product-tour`, both `auth-*`
  files), or passed when run alone (`vegetables-assessment-ordinary`). The long course-media
  migration files hit the local 50-minute cap. CI on the pull request is the authoritative full run.
- Rendered spot check: see below.

### Rendered spot check

Production build of the folded tree. Sample mode, earth theme, 18 routes, each in three views: phone
light, phone dark and desktop dark (54 screenshots). Routes: the 14 the tracks could not render, plus
/samples, /home, /mentor and /offline. A computed-contrast pass ran over every visible text node.

- Dark (phone and desktop): no text below its contrast floor on any route. Records, Contact, Tour
  and Teach the Teachers render with themed surfaces, inputs and buttons.
- Light: the flags were checked against the screenshots and are not readable-text failures:
  - "Ask for help" sits on a gradient fill the walker cannot resolve.
  - The Teach the Teachers notice is a translucent tint over the page.
  - The /atlas hint is over the map canvas.
  - The /reports sample-banner line is 2.99:1 at 14px. It is the pre-existing sample banner, not wave 18 work.
  - /mentor's "Follow-up overdue" chip (2.65:1, 12px) comes from `components/FieldTeams.tsx`, which
    no wave 18 track touched. It is carried to the wave 19 re-capture as a contrast candidate.
- /offline logged React hydration errors on every load. Fixed as described above.
- /pitch at phone width shows the "Best viewed on a laptop" fallback by design.

## Next continuation

1. Wave 19 re-capture of the merged wave 18 build, with a sweep diff against the wave 18 one; the routes the tracks could not render first (/student/teach-the-teachers, /tour, /tips, /records, /account, /contact, /login, /pitch, /vision, /atlas, /design, /reports, /example, /surveys), and /mentor's "Follow-up overdue" chip contrast in light.
2. Rory decides the items under *Unchanged*; the translator reviews the two isiZulu drafts.
