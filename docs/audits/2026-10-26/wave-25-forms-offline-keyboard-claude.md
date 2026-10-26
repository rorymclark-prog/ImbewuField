# Wave 25 forms, offline and keyboard capture — 26 October 2026

- Auditor: Claude (integrator).
- Reviewed revision: the wave 24 integration head (`claude/zen-rubin-00ndhb` at `a52289a4`, rorymclark-prog/imbewufield#1125), built with `next build` and served with `next start` in sample mode.
- Deployment inspected: not inspected; wave 24 was still in CI.
- Previous audit: [Wave 24 interaction capture — 26 October 2026](wave-24-interaction-claude.md), `w24-01` to `w24-12`. This record adds `w25-01` to `w25-09`.
- Scope, three lenses no earlier wave used:
  - **Forms filled and submitted:** invoice, exchange post, journal note, the Records Picked/Sold/Spent forms, contact, a survey, feedback, the site assessment, a field visit, account. Every visible field was filled generically and the form submitted, at 390 and 1280px, light English and dark isiZulu (48 loads).
  - **Keyboard:** the first 30 Tab stops on ten pages (home, records, exchange, journal, prices, mentor, ngo, funder, student, contact) at 1280px, light and dark. Each stop was checked for a visible focus indicator, being on screen, and not being covered.
  - **Offline:** seven pages loaded online, the browser taken offline, then an in-app link followed. Repeated with the service worker active.
- Evidence type: Playwright measurement and screenshots read by hand.

## Findings and disposition

| ID | Where | What the render showed | Fix | Status |
| --- | --- | --- | --- | --- |
| w25-01 | /contact in practice (sample) mode | The form says "Practice version: your message is kept on this device and is not sent yet", but after Send the success card said "Message sent — Your message has been delivered. You'll hear back within 1–2 working days." Nothing is sent in practice mode (the send is a deliberate fake success) | The card tracks whether the last send was real; a practice send says "Practice message kept" and repeats the form's own practice sentence (its existing isiZulu reused) | Fixed |
| w25-02 | Records → produce photo, and any control drawn as its `<label>` with the input hidden | Tab reaches the hidden 1px file input, so the focus ring is drawn on nothing; the visible "Choose photo…" control shows no focus | `label:has(> input.sr-only:focus-visible)` gets the app's focus ring in `app/globals.css` | Fixed |
| w25-03 | Offline, any page → Home (also the other precached routes) | With the service worker active, a page never opened in this build crashes offline: `ChunkLoadError`, then the error screen. Home opened earlier in the same build works. The worker precaches the routes' HTML but not their JS chunks, and its caches reset on every deploy | `app/sw.js/route.ts`: the install precache (and the explicit "save for offline" download) also stores each precached page's lazily loaded chunks, read from the webpack runtime's chunk tables. Best effort: a chunk that will not download never fails the install. About 1.6 MB more on a first install (gzip; mostly the map engine and the PDF library); unchanged chunks come from the browser's HTTP cache on later deploys (Sonnet track, rorymclark-prog/imbewufield#1132) | Fixed |
| w25-04 | The error screen, offline | "Something went wrong — Try again": generic, and Try again cannot help offline | `app/error.tsx` recognises a chunk failure or an offline phone and says "You're offline — this screen isn't saved on your phone yet", with a link to "Saved on this device"; never the raw error; isiZulu draft labelled (Sonnet track, #1132) | Fixed |
| w25-05 | Every filled form | No overflow, no low-contrast text, no page errors; validation messages render in place (the harvest form refuses a non-number, the follow-up date must not precede the visit, the survey's Submit waits for answers) | — | Checked |
| w25-06 | Keyboard, ten pages | Every one of the first 30 stops has a visible ring, light and dark, apart from `w25-02` | — | Checked |
| w25-07 | /home offline | `wasm streaming compile failed … falling back to ArrayBuffer instantiation` in the console; the page renders | — | Checked, not a defect |
| w25-08 | /farmer offline, found by the verification pass once `w25-03` let it render | The alert banner read the browser's own "Failed to fetch": the site-load `catch` showed any thrown message | Only the page's own site-mismatch message is shown as written; everything else goes through `networkFailureMessage` ("You're offline. Reconnect and try again.") | Fixed |
| w25-09 | Other screens that print a caught error's `.message` | Records delete, account save, the evidence sheet, receipts, the studies downloads and others showed `err.message` when it was an Error — for a network or Firebase failure, developer English ("Failed to fetch", "Missing or insufficient permissions") | Wave 27: see [the wave 27 record](wave-27-raw-errors-claude.md) | Fixed (wave 27) |

### Checked and not a defect

- The field visit's "Value must be 10/28/2026 or later" came from the generic fill putting a follow-up date before the visit date: the follow-up date's `min` is the visit date, as it should be.
- Submit buttons the generic fill could not press were disabled because a required choice was empty.

## Verification

`w25-01` and `w25-02` were re-measured on the fixed build (phone light, desktop dark). After a practice
Send, /contact reads "Practice message kept" and "…is not sent yet", and no longer says "has been delivered".
Tabbing to the hidden produce-photo input on /records now draws a 2px solid ring on its "Choose photo…" label.
`tests/w25-forms-focus.test.ts` pins both.

Offline (`w25-03`, `w25-04`, `w25-08`) was re-measured on the fixed build with the service worker active,
first on the offline branch alone and again after merging it with `main` and wave 27:
- From /records, a page that never opened them, each of /home, /farmer, /student, /prices and /offline opens offline in
  English and isiZulu. Before, every one showed the crash screen.
- A forced chunk failure shows "You're offline" / "Awuxhumekile ku-inthanethi" with "Saved on this device", and no raw
  error text, in light and dark.
- /farmer offline shows "You're offline. Reconnect and try again." in its banner (isiZulu: "Awuxhunyiwe kuxhumano…").
- Install cache on the offline branch: 66 entries / 5.8 MB before, 109 / 11.3 MB after (decoded). The 48 added chunks
  are 1.6 MB gzipped.
- `tests/w25-offline.test.ts` pins the worker, the error screen and `w25-08`. The review also added the new
  history helper to the copy list in `tests/blind-reviewed-study-corrections.test.ts`, which #1132 had missed.

A page never saved offline still falls back to Home's saved copy (the worker's existing navigation fallback). Showing
"Saved on this device" there instead is a design question for later, not changed here.

## Next continuation

Extend the keyboard pass to dialogs (Lima chat, photo viewer, drawer) and the form pages.
