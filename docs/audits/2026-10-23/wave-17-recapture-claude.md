# Wave 17 rendered re-capture of the wave 16 build — 2026-10-23

- Auditor: Claude (integrator), with the same headless capture as the 17, 22 and 23 October records.
- Reviewed revision: `main` at `2bddc451` (the wave 16 squash, #1072), captured from a production build (`next build` + `next start`) in sample mode.
- Deployment inspected: not inspected. The frames come from a local production build of the same tree.
- Previous audit: [Wave 16 integration close-out — 23 October 2026](wave-16-integration-claude.md) and the [wave 16 re-capture](../2026-10-22/wave-16-recapture-claude.md). Every ID is carried forward; new IDs use the `w17-` prefix.
- Scope: the same 51 English routes for six profiles and the same 51 in isiZulu for the simple farmer, each in light and dark, phone 390×844 and desktop 1280×800: 396 English and 204 isiZulu frames, each paired with its wave 16 frame.
- Evidence type: rendered frames (Playwright, headless Chromium, no WebGL), a pixel diff of every pair, the quality sweep (288 route × profile × mode × viewport rows: text contrast against the painted background, text under 12px, unnamed controls, tap targets under 24px on a phone, h1 count, horizontal overflow), a probe that names each failing element and the ancestor that paints its background, and full-size inspection of the frames named below.

## What was already done

- English: 274 of 396 frames are pixel-identical to wave 16; 122 changed. isiZulu: 128 of 204 identical; 76 changed. Every changed frame is on a route a wave 16 track touched (/student, the four Study design pages, /student/finance, /samples/production, /network, /login, /contact, /pitch, /updates, /journal, /assessments, /facilitator/print, /design) or carries the new /home and /community tap areas. The page shells that grew (/journal +159px, /assessments +100 to +122px on desktop) are the desk-18 shells now ending at their content rather than a fixed height; /login +49px is the w16-08 notice.
- Sweep totals against wave 16: text under 4.5:1 down from 602 to 283 instances, text under 12px down from 2066 to 886, phone overflow gone (/samples/production was 2 rows, now 0), unnamed controls 0. Of the 283 contrast instances, 158 are Codex's /plan and 26 are in Codex's `components/crops/*` on /samples/production.
- Integrator fixes on this branch, both on /farmer (part of `w17-04`):
  - `components/report/CompletionScore.tsx`: the dark scorecard's `faint` text ("Done", "Not started") moves from 55% to 70% of `#F7C97E` (4.39:1 to above 4.5:1 on `#0B120B`), the same strength as its `mid` text.
  - `components/DataPanel.tsx`: the "0.12 ha" label inside the *Full report* button inherits the button's `--on-forest-800` colour instead of a fixed pale green that was 1.51:1 on the leaf fill in dark.

## Findings and disposition

### Carried from wave 16

| ID | Status | Evidence |
| --- | --- | --- |
| w16-01 | partial | TSX components on `--on-forest-800` pass; CSS modules and `--emerald` fills do not (see `w17-01`). `tests/on-forest-contrast.test.ts` scans a fixed TSX list, so it never saw them |
| w16-02 | verified | /design labels and `LessonLink` render on forest-800 without a sweep hit |
| w16-03 | verified | dark /student category labels pass; /student dark contrast instances 90 → 26, all of which are `w17-01` |
| w16-04 | verified | the four Study design pages have no contrast instance in dark |
| w16-05 | verified | /samples/production phone document 390px wide in both modes and languages |
| w16-06 | partial | /network 12px budget holds; the "Attention" chip is new in the sweep (`w17-03`) |
| w16-07 | verified | /example clean; /farmer `DataPanel` overlines pass, remainder fixed here (`w17-04`) |
| w16-08 | verified | /login notice passes in both modes |
| w16-09 | verified | /home "Take a tour" measures 277×48; /home "Mark done" and "Add to calendar" and /invoice "Remove item" have 44px pseudo-element hit areas (`before:-inset-3`, `-inset-[13px]`, `-inset-3.5`), which the sweep's box measurement does not see |
| w16-10 | verified | `/facilitator/print` back control registered |
| w16-11 | verified | manual chapter titles unchanged in the capture index |
| desk-18 | partial | page shells verified (see heights above); `MelDashboard` and `FieldJournal` interiors still full-bleed on desktop (`w17-06`) |
| copy-05 | pending translator | `savedSiteUnavailable` renders the English fallback in isiZulu |

### New in wave 17

| ID | Severity | Where | Finding |
| --- | --- | --- | --- |
| w17-01 | high | `app/student/Studies.module.css` (`.studyButton`), `app/student/page.tsx` (`.markDone` inline), `app/student/teach-the-teachers/Refresher.module.css`, `components/studies/AppGuide.module.css`, `components/studies/FinanceCourse.module.css`, `app/samples/production/ProductionExample.module.css`; /ngo and /funder "Export all as CSV" (`background: var(--emerald)`) | Forest-800 or emerald fill with `--on-forest` text. In earth dark both fills are leaf `#82C844` and `--on-forest` stays cream: 1.83:1. "Start studying" on dark /student, 32 instances on /student/teach-the-teachers. Fix: `--on-forest-800` on these fills, and widen the guard to scan `*.module.css` and `--emerald` fills |
| w17-02 | medium | /records and /finances in dark | `--text-muted` `#A08564` on `--color-surface` `#30271C` is 4.21:1 ("total harvested · Top by weight", "No designs shared with you yet.") |
| w17-03 | medium | `app/network/page.tsx` "Attention" chip, light | `--emerald` `#3A7518` text, 12px, on `rgba(31,77,43,0.12)`: 3.5:1 |
| w17-04 | medium | /farmer, both modes | "Done" / "Not started" 4.39:1 in the dark scorecard; "0.12 ha" 1.51:1 on leaf in dark. **Fixed here** (see above) |
| w17-05 | low | `app/samples/production/page.tsx` | "Print this plan" and the source links are 18px-tall tap targets on a phone (19 rows) |
| w17-06 | low | `components/MelDashboard.tsx` + `.module.css`, `components/journal/FieldJournal.tsx` | desk-18 interiors: progress bars and the journal filter row stretch to 1280px on desktop |
| w17-07 | low | `components/EvidenceSheet.tsx:355`, `components/ProfileSheet.tsx:469,531`, `components/SiteManageMenu.tsx:123`, `components/exchange/ExchangeBoard.tsx:253`, `components/exchange/NewListingForm.tsx:61`, `components/journal/JournalEntrySheet.tsx:393` | Six inline-style inputs with `outline: 'none'` and no focus ring (carried from the wave 16 close-out) |
| w17-08 | low | `/student/design/scale` | 4 labels under 12px in both modes |

### Unchanged

- Codex-owned: /plan (158 contrast and 456 sub-12px instances; h1 count 0 at `/plan` in this capture), the small text and contrast in `components/crops/*` on /samples/production, desk-19, staff-19, dark-13, sdesk-15, zu-12, nav-18, zu-10, ux-06, w14-05 / nav-12.
- Exempt: `/facilitator/print` sheet text (16 instances) is a scaled print preview; the disabled *Send message* on /contact (3.88:1) is a disabled control.
- Rory's decision: desk-15, staff-17 and copy-02 ("facilitator" in Study), nav-13 (legend emoji), copy-06 remainder (NavDrawer "Offline and sync"), 23 BRU group names and `savedSiteUnavailable` in isiZulu (translator).

## Verification

- Capture: 396 English and 204 isiZulu frames, no capture failures; 288 sweep rows.
- `npx tsc --noEmit`: clean after the two `w17-04` fixes. `completion-score`, `farmer-map-simple`, `type-floor`, `w13-sweep-focus-and-floor`, `theme-token-coverage`, `on-forest-contrast` and `theme-text-contrast` tests pass.
- Inspected at full size: dark /student phone ("Start studying" is cream on leaf), /student/teach-the-teachers dark, /farmer dark scorecard.

## Next continuation

1. Wave 17 swarm: `w17-01` (dark-forest CSS modules and emerald fills, wider guard, plus `w17-08`), `w17-02` + `w17-03` + `w17-05` (muted text, network chip, production taps), `w17-07` (focus rings), `w17-06` (desk-18 interiors).
2. Wave 18 re-capture of the merged wave 17 build with a sweep diff; dark /student and /student/teach-the-teachers first.
3. Rory decides the items under *Unchanged*.
