# Wave 21 rendered re-capture — 24 October 2026

- Auditor: Claude (integrator), re-capturing the wave 20 integration build before it ships.
- Reviewed revision: the wave 20 integration head (`claude/zen-rubin-00ndhb`, #1091), built with `next build` and served with `next start` in sample mode. The fixes below were then applied on top and the same build re-measured.
- Deployment inspected: not inspected. These changes deploy when their PR is squash-merged to `main`.
- Previous audit: [Wave 20 integration close-out — 24 October 2026](wave-20-integration-claude.md), which closes `w20-01` to `w20-46`. This record adds `w21-01` to `w21-11`.
- Scope: every sample-mode route at 390px and 1280px, light and dark, in isiZulu, with `sessionStorage.imbewu_sample_lang` set so sample pages really render in isiZulu. A header sweep at 768, 1024 and 1280px in English and isiZulu for every page with the desktop nav.
- Evidence type: Playwright measurement of horizontal overflow, header row width against the viewport, the `html` `lang` attribute, and text/background contrast per text node, plus screenshots read by hand.

## Method note: what the contrast pass can and cannot see

The contrast pass walks up from each text node to the first opaque background. It resolves `rgb()`
backgrounds correctly. It does not composite `color-mix()` or translucent `color(srgb … / a)`
backgrounds, so it reports dark ink on a light tint as 1.24:1, and `--gold-dim` on a tinted chip as
about 2.6:1. Worked by hand, those pairs are 4.7:1 or better. Every hit on a `color(srgb …)`
background was checked that way and is listed under "Checked and not a defect". Only pairs on solid
backgrounds are reported as findings.

## Findings and disposition

| ID | Where | What the render showed | Fix | Status |
| --- | --- | --- | --- | --- |
| w21-01 | 404 page, dark | "Page not found" in fixed ink `#20190F` on the dark page: 1.14:1. The body line and the draft notice were also fixed hex | `app/not-found.tsx` uses `--text-primary`, `--text-secondary` and `--text-muted`, as `app/error.tsx` already did | Fixed |
| w21-02 | /farmer, isiZulu, 768px | Header row 775px wide in a 768px viewport. "Isitudiyo Sokuklama" (Design Studio) is 218px | The header keeps the 8px gap until `lg` instead of widening to 12px at `md`, which frees 32px | Fixed |
| w21-03 | /network, isiZulu, 1024px | The "Iphothifoliyo yohlelo" pill pushed Settings 39px past the edge, beside the desktop nav | The pill joins the header only from `xl`; below that the strip under the header carries it | Fixed |
| w21-04 | /farmer, /community/profile | The Learn link was a hard-coded English "Learn" | `lang === 'zu' ? 'Funda' : 'Learn'`, the wording the other Learn links use | Fixed |
| w21-05 | Home coach card, dark, isiZulu | The isiZulu guidance note in fixed `#775F3E` on the dark card: 3.09:1. The speak button was also fixed hex | `components/NextStepCoach.tsx` uses `--text-muted` for both | Fixed |
| w21-06 | /assessments, /reports, light | `--emerald` `#3A7518` as text on the page ("Kwabelwe", "Izindawo ezigciniwe"): 4.11:1, under 4.5:1 for 14px text | Earth `--emerald` is `#346A15`: 4.77:1 on the page, and white on it improves | Fixed |
| w21-07 | Rainfall chart (map data panel) | Its labels used `text-text-muted`, `text-text-secondary` and `text-accent-blue`, which Tailwind never defined, so every label inherited the panel colour and the rainfall figures were never blue | Theme-token arbitrary classes | Fixed |
| w21-08 | /student/finance, dark, isiZulu | The machine-draft notice in fixed `#5C5040` on the dark page: 2.67:1 | `--text-secondary` | Fixed |
| w21-09 | /calendar, dark, isiZulu | "isiZulu translation pending — English source:" in `text-stone-600`: 2.44:1 | `text-[var(--text-muted)]` | Fixed |
| w21-10 | /samples/production, dark | Chart legend "Stored / Frozen / Dried / Fermented / Processed" in fixed ink on the dark page (1.14:1). "Include kept food" in fixed `#5C5040` (2.52:1). Month and year labels on the leaf fill | In `components/crops/ProductionAvailabilityGraphs.tsx`, which Codex owns | Handed to Codex, unchanged |
| w21-11 | /assessments, light, desktop | Found by the verification pass. The pressed language button ("isiZulu") in the forest hero: emerald text on the translucent `--badge-bg`, so on forest, 1.49:1. The w20-22 pressed style is fine on the page; only the hero puts forest underneath | `components/MelDashboard.module.css` lays the same tint over the opaque `--input-bg` | Fixed |

### Checked and not a defect

- /exchange chips ("Okunikezwayo", crop names): translucent white chip over the hero photo.
- Dark ink reported at 1.24:1 on /samples/production, /assessments, the Study pages and /atlas: `color-mix()` tints of the card.
- `--gold-dim` text on tinted chips (journal sample note, teach-the-teachers times, the /network pill, mentor "Follow-up overdue"): 4.7:1 or better worked by hand.
- /contact "Umeluleki wami": forest text on a tinted card.
- /student/guides is not a route. It has only `[guide]` pages and nothing links to the index, so the 404 there came from the capture list, not the app.

### Still open, not for this wave

- Mentor and facilitator follow-up labels ("Follow-up overdue", "Follow up today") are English in isiZulu. They sit in `lib/i18n-pending.ts`, which waits on the isiZulu translator.

## Verification

The fixed build was rebuilt with `next build`, served again in sample mode, and re-measured with the
same scripts.

- Header sweep: /farmer in isiZulu at 768px fills 768 of 768px with an 18px spacer left (was 775px).
  The English bar at 768px keeps 115px of spacer. /network in isiZulu at 1024px fits; the
  portfolio pill appears in the header at 1280px and in the strip below it at 1024px.
- Contrast and overflow, desktop light isiZulu: /student, /student/finance, /student/design,
  /student/teach-the-teachers, /tips, /manual/en, /network, /mentor, /login, /pitch, /vision,
  /partners, /funder, /home, /calendar, /prices, /community, /updates, /surveys, /atlas,
  /finances, /facilitator, /contact, /tour, /reports, /farmer and /community/profile show no
  horizontal overflow, `lang="zu"`, and no low-contrast text. These are the routes the first
  capture lost when the server stopped mid-run.
- /assessments showed one remaining pair, logged as `w21-11` and fixed. Worked by hand, the pressed
  button is now emerald `#346A15` on a 10% emerald tint over white: about 5.6:1. A container restart
  lost the served build before that one route could be re-rendered; the next re-capture covers it.
- Dark isiZulu at 1280px and 390px: /student/finance (`w21-08`), /calendar (`w21-09`), /home
  (`w21-05`), the 404 page (`w21-01`) and /farmer show no low-contrast text and no overflow.
- `tests/w21-recapture.test.ts` pins every fix. `tests/w20-samples-map.test.ts` is re-pinned to
  the `w21-11` pressed background, which keeps the w20-22 tint, text colour and border, and
  `tests/w20-staff-public.test.ts` to the `w21-03` breakpoint.

## Next continuation

Re-capture after this wave and the wave 20 integration are both live.
