# Work queue — 2026-08-02 (overnight)

Worked top to bottom. Each item is independent; if one is blocked, say so and move on rather than
stopping the run. Everything is verifiable with `npx tsc --noEmit` + `npm test` alone — no item
here needs a browser, because the agent working this queue does not have one.

Baseline at the time of writing: **1548 tests passing**, tsc clean. That number must never go down.

---

## 1. `/calendar` keeps its own sow-month table

`app/calendar/page.tsx` (~lines 30–84) has a `CropRow.marks` table of sow months that disagrees
with `lib/crop-catalog.ts`'s rain-pattern-aware `sowMonths` for the same crop.

This is the THIRD instance today of the same bug class — a page keeping its own copy of something
the catalog already answers. The other two were real money bugs: the seed BOQ over-ordered up to
7x (fixed, 02df8f5) and `/plan` over-promised harvests on every crop, maize by 8.3x (fixed,
9564678). Read both commits before starting; `/plan` is the pattern to copy.

- Derive the marks from `sowMonths[pattern]`, keyed by CATALOG KEY, never by display name.
- `/plan` already has `CATALOG_KEY_FOR_CROP` — reuse that idea; if the two pages offer the same
  crops, lift the map into a shared module rather than making a second copy of it. (Do not create a
  third rival table while removing the second.)
- The catalog is rain-pattern aware and this page may not be. If the page has no pattern, do NOT
  invent one — report what it would take, and prefer showing the summer-rainfall pattern explicitly
  labelled over silently picking one.
- Extend the guard in `tests/crop-plan.test.ts` ("no page carries its own rival yield table") to
  cover sow-month tables too.

**Do not change any catalog figure.** They are sourced and cited.

---

## 2. The API routes that spend money have no auth

`middleware.ts:10` returns `next()` unconditionally, and no route under `app/api` verifies a
Firebase ID token. `/api/image-producer` and `/api/ai-render` call OpenAI/fal/Gemini with no
ceiling. The careful spend governor in `functions/src/index.ts` (kill switch, per-user and global
daily caps, transactional counters) does not cover them, because
`components/design/DesignGlossy.tsx` calls the HTTP route rather than the queue.

Build `lib/api-auth.ts`: read `Authorization: Bearer <idToken>`, verify with the Admin SDK, return
the uid. Wire it as the first statement of every paid route. Have client call sites attach
`await user.getIdToken()`.

**Gate enforcement behind an env flag `REQUIRE_API_AUTH`, defaulting to LOG-ONLY.** An
unauthenticated call is logged with the route name and still served. A hard cutover done blind
locks every user out of the app; the flag makes the owner's smoke test safe. Also add a body-size
cap (~5 MB).

Finish line: `npx tsc --noEmit` clean in BOTH roots, `npm --prefix functions run build` clean, and
a unit test for the helper against a mocked verifier. You cannot verify a real signed-in browser
call — say so.

---

## 3. Report route: three numbers that are wrong

In `app/api/generate-report/route.ts`:

- **Dry season is hardcoded** as `i >= 4 && i <= 7` (~lines 297–298). Winter-rainfall sites
  (Fynbos, Karoo) are therefore handed their WETTEST months as the dry-season storage gap, so the
  recommended tank is far too small. Derive from `d.rainfall.drySeason` / `pattern`.
- **Roof runoff coefficient is inlined** as `* 90` (~line 294) while `lib/roof-runoff.ts` exports
  the reviewed constant. The app currently quotes three different roof yields. Import the constant.
- **Compass words are literals** — "NORTH"/"south" at ~lines 493, 494, 502 — while a `solar` object
  with the real values is already computed. Use it.

Also capture `stop_reason` in `runBatch` (~611–620) and append a visible marker when the model was
cut short, rather than presenting a truncated report as complete.

Add `tests/generate-report-sections.test.ts` asserting `KNOWN_SECTIONS`, `ALL_SECTIONS` and the
`sections.includes(` template blocks are set-equal.

---

## 4. The AI report has never seen the farmer's design

`components/ReportView.tsx` (~294–311) posts location, photos, boundary area, water area, survey
and evidence — and **no design**. So the Zone Design, Water Harvesting, Plant Guilds and Year 1
Priorities sections are written by a model that has not seen what the farmer drew.

Add a `DESIGN AS DRAWN` block to `buildPrompt` after the water-storage block (`route.ts:~223`):
approved layers with type, name and m², plus the phases from `buildPhasePlan(...)`. Pass
`studio.layers` and the phase plan in the request body.

Same pass: `lib/report-doc.ts:~433–457` has a hardcoded 3-phase array. Take the `PhasePlan` as
input instead, so the report and printed sheet 09 stop giving two different build orders for the
same farm.

Report quality is the owner's to judge on one real run — you cannot.

---

## 5. Role pages are ungated

`app/ngo/page.tsx` and `app/funder/page.tsx` have no role gate — any farmer can open them.
`app/mentor/page.tsx:319–341` shows the correct pattern. Apply it.

Related, in `components/NgoDashboard.tsx`: derive the stat tiles from live `gardens` when `isDemo`
is false; delete the local six-item `COURSES` array in favour of `COURSE_MODULES`; and split the
empty-vs-denied cases (~249–257) so a rules denial stops looking like "no gardens yet".

Note `NgoDashboard.tsx:38` shows "Funds deployed R48.6m · 3,012 livelihoods" as a module constant,
with the demo chip CSS-hidden below 768px — i.e. invisible on a phone. There is no money field
anywhere in `lib/db/types.ts`. **Do not invent one.** Report it; the owner decides whether that
tile exists at all.

---

## 6. Spinners that never stop

Uncaught Firestore reads inside `Promise.all` leave progress rings and panels spinning forever
when a read is denied or offline:

- `app/student/page.tsx:479–506` (`toggle`, `load`)
- `app/farmer/page.tsx:348–361`
- `components/ContactInbox.tsx:74, 92` (both functions)

Wrap each in try/catch/finally with a `.catch` fallback so the UI resolves to a real state. Where
the failure is a permission denial rather than a network error, say so distinctly — "no gardens
yet" and "you do not have access" must not look the same.

---

## 7. Stale comments that are now untrue

Low risk, high value for whoever reads this code next:

- `docs/PLAN-SET-SPEC.md:7–31` — says eight sheets; there are nine (Earthworks is 05).
- `lib/report-doc.ts:1–4` — promises a "Phase B" enrichment that was never built; strip the promise
  and the dead `'enriching'` branch with it.
- `lib/sample-mode.ts:23`, `components/course/DeckPlayer.tsx:26–28`, `lib/offline-pack.ts:99–101`.
- `lib/course-image-briefs.ts:14` — stale reference to a generator script.

---

## Standing rules (all items)

- `npx tsc --noEmit` and `npm test` must BOTH pass. Baseline 1548; never lower.
- NEVER modify `PLAN_VERSION` — it re-charges every paid AI render already bought.
- NEVER trigger a paid AI render. Nothing here needs one.
- Never change a price, yield, spacing or agronomic figure. Never invent a number that reads as a
  recommendation to a farmer.
- Never touch secrets, `.env*`, `serviceAccount.json`, `firestore.rules`, `storage.rules`.
- Never `git add -A` — this checkout is shared.
- If an item needs a decision only the owner can make, STOP that item, write down the decision
  needed, and move to the next one.
