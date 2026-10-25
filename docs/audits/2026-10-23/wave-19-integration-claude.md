# Wave 19 integration close-out — 2026-10-23

- Auditor: Claude (integrator), folding the five wave 19 Sonnet swarm tracks onto the integration branch.
- Reviewed revision: `claude/zen-rubin-00ndhb` after the folds (the commit that carries this record), on top of `main` at `774a3530` (the wave 18 squash, #1082). Track heads folded: `swarm/w19-farmer-chrome` `f093fda8` (#1089), `swarm/w19-records-invoice` `d071c70b` (#1087), `swarm/w19-samples-map` `b1e50898` (#1086), `swarm/w19-study` `da9bf594` (#1088), `swarm/w19-staff-public` `c6dbba23` (no PR was opened; folded from the branch).
- Deployment inspected: not inspected. Deploy happens when the integration PR is squash-merged to `main`.
- Previous audit: [Wave 19 rendered re-capture — 23 October 2026](wave-19-recapture-claude.md), which carries every earlier ID and adds `w19-01` to `w19-42`.
- Scope: source review of every folded commit against its finding IDs, the targeted tests, the pinned-file history checks, and typecheck.
- Evidence type: commit diffs on the five track branches, targeted test runs, a per-file run of the registered suite, `npx tsc --noEmit`.

## What was already done

All five tracks finished their task lists and pushed. Each branch was merged into the integration
branch with a merge commit. The only conflicts were in the `package.json` test list (every track
registered one `tests/w19-<track>.test.ts`); every side was kept.

Integrator changes on top of the folds:

- `tests/w19-farmer-chrome.test.ts` had been added to the `test:storage-rules` emulator script
  instead of `npm test`, so CI would not have run it. It now sits in the `test` script.
- `lib/i18n.tsx` (whose bytes are pinned by `tests/study-ui-due-unlock-history-checks.ts`) changed
  in one line: `loginBackendUnavailableNotice` now says "this device" instead of "this phone" (w19-40).
  This was the staff-public branch's only CI failure. The pin is re-baselined the same way as earlier
  waves: the pre-wave-19 bytes are kept in `tests/fixtures/i18n-before-wave-19.tsx.txt`, the wave 16
  proof is bound to that fixture, and `assertOnlyWaveChanges` allows exactly the one reworded line.
- `tests/w18-public.test.ts` pinned the /design/lite top gap at exactly 56px (w18-50). The
  samples-map track raised it to 72px for w19-26, so the pin now checks the gap is at least 56px,
  which is what w18-50 needs.
- **Desktop nav gap behind w19-01/w19-10.** The finding assumed every page that got
  `<TabBar hideAtDesktop />` already had AppHeader's lg+ links. /journal and staff Home do; /farmer,
  farmer Home, /records and /invoice build their own headers and had none, so at 1024px and up the
  burger would have been their only way out. The lg+ links are now one component,
  `components/layout/DesktopPrimaryNav.tsx` (the same four TabBar destinations, 16px/600, current page
  in forest), placed beside the title in those four headers. On /farmer that also needed room: the
  five-role switcher (about 570px; it also lives in the burger drawer) left the header, the tagline
  shows from 2xl, and the language and account chips from xl (language is the first section of the
  Appearance panel; My account is in the drawer). Before this, /farmer had about 1,590px of header
  content in every bar up to 1,536px, so Settings was clipped off the right edge. The w19-01/w19-10
  tests now also require the links inside each of those headers; `tests/type-floor.test.ts` registers
  the new component.
- Release note for the folded build, the `PROGRESS.md` entry, this record and the archive index.

No track edited `app/student/page.tsx` or any Codex-owned file.

### Track summaries

| Track | PR | Done | Left / caveats |
| --- | --- | --- | --- |
| farmer-chrome | #1089 | w19-01 to w19-09: TabBar hidden at desktop where AppHeader shows its nav, /exchange and staff Home on AppHeader, farmer error banner below the header, sans controls, /offline card spacing and disabled buttons, inline art exempt from the 32px tile minimum, two-column listing meta row, themed account chip, 320px /journal rail | Test registered in the wrong script (fixed by the integrator) |
| records-invoice | #1087 | w19-10 to w19-15: TabBar hidden at desktop on /records and /invoice, plain full-width Picked wrapper, on-screen money uses a no-break space (PDF keeps a plain space), LimaBar in flow on /invoice with the FAB hidden, sans controls, Share PDF and Print once at the bottom | Not rendered in the track's sandbox |
| samples-map | #1086 | w19-16 to w19-26: /samples/production nav, print and themed CTA, plain copy; MiniPlanPlate on CSS variables, two-decimal coordinates; MEL hero and notice in dark; one Tour control, one radius, Lucide arrows, even gaps; Atlas title, sans body, farmer-facing /feedback label; MEL heading weights; themed /design/lite | /design/lite top gap change needed the w18-50 pin re-baselined |
| study | #1088 | w19-27 to w19-37: worked diagram keeps its label size on phone and is themed without an invert filter; chevron on notice disclosures; finance header labels; refresher lists and weights; one card surface on /student; /tips on the shared grid; /manual on AppHeader; balanced headings and one action size; list and caption rhythm; English notice hidden in isiZulu | `app/student/page.tsx` untouched (byte-pinned) |
| staff-public | branch only | w19-38 to w19-42: short header titles and a title that keeps its width at lg, /network strip, list and statuses, /login without a permanent "Connecting…" line and with real placeholders, mentor metric font, due chip and icon, /partners, /contact, /updates and /vision polish | No PR opened; the dictionary pin re-baseline was done by the integrator |

## Findings and disposition

### Assigned to wave 19 tracks

| ID | Status | Evidence |
| --- | --- | --- |
| w19-01 | implemented | `tests/w19-farmer-chrome.test.ts` (#1089) |
| w19-02 | implemented | `tests/w19-farmer-chrome.test.ts` (#1089) |
| w19-03 | implemented | `tests/w19-farmer-chrome.test.ts` (#1089) |
| w19-04 | implemented | `tests/w19-farmer-chrome.test.ts` (#1089) |
| w19-05 | implemented | `tests/w19-farmer-chrome.test.ts` (#1089) |
| w19-06 | implemented | `tests/w19-farmer-chrome.test.ts` (#1089) |
| w19-07 | implemented | `tests/w19-farmer-chrome.test.ts` (#1089) |
| w19-08 | implemented | `tests/w19-farmer-chrome.test.ts` (#1089) |
| w19-09 | implemented | `tests/w19-farmer-chrome.test.ts` (#1089) |
| w19-10 | implemented | `tests/w19-records-invoice.test.ts` (#1087) |
| w19-11 | implemented | `tests/w19-records-invoice.test.ts` (#1087) |
| w19-12 | implemented | `tests/w19-records-invoice.test.ts` (#1087) |
| w19-13 | implemented | `tests/w19-records-invoice.test.ts` (#1087) |
| w19-14 | implemented | `tests/w19-records-invoice.test.ts` (#1087) |
| w19-15 | implemented | `tests/w19-records-invoice.test.ts` (#1087) |
| w19-16 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-17 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-18 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-19 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-20 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-21 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-22 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-23 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-24 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-25 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-26 | implemented | `tests/w19-samples-map.test.ts` (#1086) |
| w19-27 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-28 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-29 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-30 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-31 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-32 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-33 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-34 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-35 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-36 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-37 | implemented | `tests/w19-study.test.ts` (#1088) |
| w19-38 | implemented | `tests/w19-staff-public.test.ts` (`swarm/w19-staff-public`) |
| w19-39 | implemented | `tests/w19-staff-public.test.ts` (`swarm/w19-staff-public`) |
| w19-40 | implemented | `tests/w19-staff-public.test.ts` (`swarm/w19-staff-public`) |
| w19-41 | implemented | `tests/w19-staff-public.test.ts` (`swarm/w19-staff-public`) |
| w19-42 | implemented | `tests/w19-staff-public.test.ts` (`swarm/w19-staff-public`) |

### Carried from wave 18

The wave 18 partials the re-capture assigned to wave 19 IDs close with them, pending the wave 20
re-capture: w18-06 and w18-07 (w19-20, w19-22), w18-12 (w19-31), w18-20 (w19-28), w18-21 to w18-23
(w19-36), w18-25 (w19-32), w18-38 (w19-11), w18-43 (w19-01), w18-46 (w19-09), w18-47 (w19-06),
w18-50 (w19-26), w18-56 (w19-18), w18-59 (w19-24), and the wave 18 note on the /mentor "Follow-up
overdue" chip (w19-41).

### Unchanged

- Codex-owned: /plan, the small text and contrast in `components/crops/*` on /samples/production, and the IDs listed as Codex-owned in the re-capture.
- Rory's decision: desk-15, staff-17 and copy-02 ("facilitator" in Study), nav-13 (legend emoji), copy-06 remainder (NavDrawer "Offline and sync"), farmer journal filters in the sidebar at lg+, the personal Gmail contact on /partners and /pitch, and one staff-dashboard header pattern.
- Translator: copy-05 (`savedSiteUnavailable`), the 23 BRU group names, and the isiZulu drafts added by earlier waves.

## Verification

- `npx tsc --noEmit` clean; `next build` succeeds.
- The five `tests/w19-*.test.ts` files pass, as do the older tests the folds re-baselined (w18-public,
  the i18n byte pin) and every test that reads `app/farmer`, `app/home`, `app/records`,
  `app/invoice` or `components/layout/AppHeader.tsx` (69 files). The only failures are product-tour,
  which fails the same way on the tree without these changes, and the known sandbox-only set
  (course-audio, course-deck, saved-reports, public-route-ssr, auth-account-transition,
  auth-guest-migration). CI runs the full suite on the integration PR.
- Rendered in sample mode with `next start`, the header of /farmer, /home, /records, /invoice and
  /journal is exactly its viewport wide (no overflow) at 768, 1024, 1280 and 1536px. Each of the five
  shows Home, Map, Records and Account in its header from 1024px, with the phone TabBar gone there and
  still present at 390px.

## Next continuation

1. Wave 20 re-capture of the merged wave 19 build, with a sweep diff against the wave 19 one. Start with the desktop navigation (one nav on every AppHeader page), /invoice and /records on phone and desktop, the worked diagram on phone and in dark, and /login.
2. Rory decides the items under *Unchanged*; the translator reviews the isiZulu drafts.
