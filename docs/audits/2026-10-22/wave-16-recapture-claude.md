# Wave 16 rendered re-capture of the wave 15 build — 2026-10-22

- Auditor: Claude (integrator), with the same headless capture as the 17 and 22 October records.
- Reviewed revision: `claude/zen-rubin-00ndhb` at `b260f337` (the wave 15 integration head, #1060), captured from a production build (`next build` + `next start`) in sample mode. The squash merged to `main` adds only the re-stamped release note and Codex's survey draft recovery (#1066), which no frame below depends on.
- Deployment inspected: not inspected. The frames come from a local production build of the same tree.
- Previous audit: [Wave 15 rendered re-capture — 22 October 2026](wave-15-recapture-claude.md) and the [wave 15 close-out](wave-15-integration-claude.md). Every ID is carried forward; new IDs use the `w16-` prefix.
- Scope: the same 51 English routes for six profiles and the same 51 in isiZulu for the simple farmer, each in light and dark, phone 390×844 and desktop 1280×800: 396 English and 204 isiZulu frames, each paired with its wave 15 frame.
- Evidence type: rendered frames (Playwright, headless Chromium, no WebGL), the capture index per frame, a pixel diff of every pair, a quality sweep (288 route × profile × mode × viewport rows: text contrast against the painted background, text under 12px, unnamed controls, tap targets under 24px on a phone, h1 count, horizontal overflow), a print probe of `/facilitator/print`, and full-size inspection of the frames named below.

## What was already done

Nothing new was fixed on the branch for this record; it verifies wave 15 and files wave 16.

- English: 322 of 396 frames are pixel-identical to wave 15; 74 changed. isiZulu: 160 of 204 identical; 44 changed. Every changed frame is on a route a wave 15 track touched (/calendar, /prices, /exchange, /ngo, /funder, /updates, /example, /login, /vision, /farmer, /records, /finances, /student/design, /facilitator/print) or Codex's /plan. Inspected side by side: the NGO and funder charts are dark in dark mode (they were white cards), Calendar and Prices share one header, Exchange chips follow the theme, Updates leads with the wave 15 note.
- Console errors: the extra isiZulu error lines (150, was 105) are all `429 Too Many Requests` from the app's own rate limiter during the rapid capture, not a regression.
- Unnamed controls: 0 in every row.

## Findings and disposition

### Carried from wave 15

| ID | Status | Evidence |
| --- | --- | --- |
| w15-01 | verified | `/facilitator/print` on a phone with *More options* open: 7 sheets, document 390px wide, page height 2250 in both modes; phone frame height 844 (was 2431) |
| w15-02 | verified | isiZulu /mentor h1 text is "Umsebenzi wami wasensimini English: My fieldwork" (probed at 390px) |
| w15-03 | verified | /account has one h1 in every profile |
| nav-16 | verified | /facilitator/print tab title is "Printable plan — ImbewuField" |
| nav-17 | verified | every route has exactly one h1, except Codex's /plan → /facilitator/crops |
| dark-01 | verified | /mentor, /samples and /reports in dark show only the w16-01 and w16-02 pairs below |
| ux-09 / nav-09 | verified | /updates in Simple renders date-grouped entries with a *Show more* control (probed at 390px) |
| sdesk-03, desk-13, staff-16, code-10, code-12, code-20, copy-07 | verified | frames on the touched routes match the close-out; code-12 remains only in Codex's crops page |
| w15-04 | open → `w16-01` | `--on-forest` stays `#F7F2E9` in dark while `--color-forest-800` turns leaf: 1.83:1 |
| code-11 | partial | `components/design/DesignCanvas.tsx:2616` still prefixes a layer name with ✓; the other six files in the close-out table remain |
| code-05 | partial | /account disabled fills and `#FBF6EC` card |
| copy-05 | partial | wording right, not behind `t()` |
| desk-18 | partial | /surveys, /assessments, /journal still do not end at their content |
| ux-12 | partial | one button style per role waits on the `FinanceCourse.module.css` re-baseline |

### New in this capture

| ID | Severity | Route · mode | Problem | Fix |
| --- | --- | --- | --- | --- |
| w16-01 | high | /student, /student/design/*, /student/finance, /student/teach-the-teachers, /exchange, /ngo, /funder, /account, /records, /journal, /updates, /invoice, /reports, /farmer · dark | Every `--color-forest-800` fill under `--on-forest` text is 1.83:1 in dark (leaf fill, cream text): "Post", "Export all as CSV", "Sign in", "Share listing", "View summary", "Add a note", "Guide me…", "14 days", "Open funder view", "Generate full report" | New `--on-forest-800` token per theme column (cream in light, dark ink in dark); repoint the ~45 places that pair it with forest-800; keep `--on-forest` where the fill is pinned dark |
| w16-02 | high | ~15 routes · dark | `components/design/LessonLink.tsx` paints "Learn"/"Study" links in fixed `#1F4D2B`: 1.91:1 on the dark ground; /design "Design studio" and "Design →" the same | `var(--color-forest-800)` |
| w16-03 | high | /student · both | Category colours in `lib/course-modules.ts` used as text fail in dark (1.7–3.2:1) and Seeds `#B8860B` fails in light (2.81:1); `OfflineDownload` label is ink on dark (1.07:1); 11px "Your course" labels | Text tone per category from tokens; `OfflineDownload` on `--text-primary`; 12px floor |
| w16-04 | high | /student/design/folder, /scale, /worked · dark | Study CSS modules paint literal light cards (`#E9EFDF`, `#F0F3E9`, `#EEF2E6`) under theme text: 1.07–1.24:1. "Supplied gap" leaf text 1.8:1 in light; 11.2px demo-bed labels | Cards on `--bg-1`/`--bg-2`; leaf as fill only; 12px floor |
| w16-05 | medium | /samples/production · both | 1,210 sub-12px text instances (`ProductionExample.module.css`, 11px); dark ink headings on the dark ground (1.14:1); horizontal overflow on a phone in both languages | 12px floor, theme text tokens, wrap the wide rows |
| w16-06 | medium | /network · both | 324 sub-12px instances (`NetworkMap.tsx`, `app/network/page.tsx` legend and counts); dark-mode ochre text `#9E5C08` 3.25:1 and `#C0531E` 3.98:1 | 12px floor; `--gold` text token in dark |
| w16-07 | medium | /example, /farmer · both | /example: white 85% on `#9A6018` at 12px (4.23:1), `#755942` on tiles (4.29:1), "Likely" water `#235E86` in dark (2.67:1). /farmer: "Site reports" `#9E5C08` 3.85:1 in light, m² labels 4.29:1 | Full-opacity white; `--text-secondary`; `--blue` token |
| w16-08 | medium | /login · both | Light "Sign-in is not available…" ochre `#C07A1E` text (3.19:1); dark "Sign in" `#755942` (2.45:1) and tagline (2.89:1) | `--gold-dim` text in light; theme text tokens in dark |
| w16-09 | medium | /home, /ngo, /funder, /invoice, /pitch, /contact, /login · phone | Tap targets under 24px: /home *Mark done* 20px and *Add to calendar* 18px (32 instances), "View production plan" 18px; "Take a tour" 21px; "Remove item" 22px; "Or read the programme overview" 20px; "+ Add a subject" 20px; "Forgot your password?" 20px | 44px hit area (padding or `::before`), visual size unchanged where it is an icon |
| w16-10 | low | /facilitator/print · phone | The floating "Back" pill overlaps "Back to Design map" | One back control, or offset the pill |
| w16-11 | low | /manual | Title "Permaculture Manual · ImbewuField" uses `·` and title case; every other route uses "Page name — ImbewuField" | "Permaculture manual — ImbewuField" |

Smaller items folded into the tracks: /records muted text 4.21:1 in dark (`#A08564` on `#30271C`); /design "Savanna" and /design/lite labels at 11.5px; /tips and /tour 11px eyebrows. /contact's disabled "Send message" (3.88:1) is exempt as a disabled control.

### Unchanged

- Codex-owned: desk-19, staff-19, dark-13, sdesk-15, zu-12, nav-18, zu-10, ux-06, w14-05 / nav-12, and /plan (52 light and 106 dark contrast rows, 456 sub-12px, empty h1) — reported to Codex, not assigned.
- Rory's decision: desk-15, staff-17 and copy-02 ("facilitator" in Study), nav-13 (legend emoji), copy-06 remainder (NavDrawer "Offline and sync" vs "Saved on this phone"), 23 BRU group names in isiZulu (translator).

## Verification

- Capture: 396 English and 204 isiZulu frames, all HTTP 200/307, no failed navigations.
- Pixel diff: 74 English and 44 isiZulu frames changed; all on wave 15 routes or /plan; inspected side by side for /calendar, /ngo (dark), /updates (Simple) and /exchange (dark).
- Sweep: 602 contrast rows (dominated by /plan, /student and the Study pages in dark), 2,066 sub-12px (1,210 /samples/production, 456 /plan, 324 /network), 92 small tap targets on a phone, 0 unnamed controls, one overflow (/samples/production phone), h1 count 1 everywhere but /plan.
- Print probe: `/facilitator/print` phone, *More options* open, light and dark.
- Not run: a printed PDF of the sheets (headless print to PDF of the scaled sheets was not compared to the screen frames).

## Next continuation

1. Wave 16 tracks (Sonnet swarm, based on `main` after #1060):
   - **dark-forest:** w16-01, w16-02, with a guard test.
   - **study-dark:** w16-03, w16-04, Study 11px, ux-12 (with the `FinanceCourse.module.css` re-baseline).
   - **samples-network-example:** w16-05, w16-06, w16-07.
   - **taps-login-account:** w16-08, w16-09, code-05, /records muted text.
   - **leftovers:** code-11, copy-05, desk-18, w16-10, w16-11, /design 11.5px, /tips and /tour eyebrows.
2. Wave 17 re-capture of the wave 16 build, with a sweep diff against this one.
3. Rory decides the items under *Unchanged*.
