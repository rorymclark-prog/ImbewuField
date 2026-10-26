# Wave 25 forms, offline and keyboard capture — 26 October 2026

- Auditor: Claude (integrator).
- Reviewed revision: the wave 24 integration head (`claude/zen-rubin-00ndhb` at `a52289a4`, rorymclark-prog/imbewufield#1125), built with `next build` and served with `next start` in sample mode.
- Deployment inspected: not inspected; wave 24 was still in CI.
- Previous audit: [Wave 24 interaction capture — 26 October 2026](wave-24-interaction-claude.md), `w24-01` to `w24-12`. This record adds `w25-01` to `w25-07`.
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
| w25-03 | Offline, any page → Home (also the other precached routes) | With the service worker active, a page never opened in this build crashes offline: `ChunkLoadError`, then the error screen. Home opened earlier in the same build works. The worker precaches the routes' HTML but not their JS chunks, and its caches reset on every deploy | Swarm track (Sonnet): precache the static assets the precached pages reference | Open |
| w25-04 | The error screen, offline | "Something went wrong — Try again": generic, and Try again cannot help offline | Swarm track: offline-aware copy with a link to saved screens | Open |
| w25-05 | Every filled form | No overflow, no low-contrast text, no page errors; validation messages render in place (the harvest form refuses a non-number, the follow-up date must not precede the visit, the survey's Submit waits for answers) | — | Checked |
| w25-06 | Keyboard, ten pages | Every one of the first 30 stops has a visible ring, light and dark, apart from `w25-02` | — | Checked |
| w25-07 | /home offline | `wasm streaming compile failed … falling back to ArrayBuffer instantiation` in the console; the page renders | — | Checked, not a defect |

### Checked and not a defect

- The field visit's "Value must be 10/28/2026 or later" came from the generic fill putting a follow-up date before the visit date: the follow-up date's `min` is the visit date, as it should be.
- Submit buttons the generic fill could not press were disabled because a required choice was empty.

## Verification

Filled in when the offline track lands and the fixed build is re-measured.

## Next continuation

Re-run the offline lens on the fixed build for each precached route, from a page that never opened
it; then extend the keyboard pass to dialogs (Lima chat, photo viewer, drawer) and the form pages.
