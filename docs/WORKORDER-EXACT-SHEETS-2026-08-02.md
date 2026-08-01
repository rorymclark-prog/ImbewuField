# WORKORDER — Make all nine EXACT plan sheets good (ImbewuField)

Paste this whole file into the Antigravity chat for the ImbewuField repo (`~/ImbewuField`,
branch `main`, or a branch off it — never force-push `main`).

**You are chosen for this specifically because you have a browser and can run the app.** The other
agent on this repo cannot: Chrome aborts in its sandbox, so it can only reason about code it reads.
This job cannot be done that way. It is a *look at it* job.

---

## The ask, in the owner's words

> "the sheets for me on exact are a big issue right now, they're not good. I want someone to work
> on it, improve, check and refine until quality on all sheets is improved."

The **exact** sheets are the free, deterministic, no-AI renders — the "Exact Canvas" /
"Reference Blueprint" path. They cost nothing to generate, they are instant, and they are the
product's most-used output. The owner considers them the thing most likely to win. They are also
the thing he keeps looking at and finding wrong.

The plan set is nine sheets (`docs/PLAN-SET-SPEC.md`):

`01 Site · 02 Sector · 03 Zones · 04 Water · 05 Earthworks · 06 Planting · 07 Structures ·
08 Whole design · 09 Phasing`

---

## The loop you must actually run — this is the whole point

For EACH sheet, in order, do all four steps before moving on. Do not batch the code changes and
look once at the end.

1. **RENDER IT.** Dev server on port 4343 (`npm run dev -- -p 4343`; one may already be running —
   do not start a second). Then:
   - `sessionStorage.imbewu_sample_mode = '1'`
   - open `/design?lat=-27.72623&lon=31.96304`
   - Preview map → pick the sheet → **Reference Blueprint** → **Exact Canvas**
2. **LOOK AT IT.** Screenshot. Zoom in. Actually read it as a farmer would.
3. **FIX** what is unambiguously wrong.
4. **RE-RENDER AND LOOK AGAIN.** Confirm the fix landed and broke nothing else. If it is still
   wrong, go again. That is the refine loop, and it is what has been missing.

⚠️ **The sample farm is small.** It renders a handful of labels where the owner's real farm renders
dozens, so some crowding problems will NOT reproduce on it. Where a defect is about density, build a
denser test case (add trees/beds in the Studio and re-render) rather than concluding it is fixed.

---

## What to look for

Per sheet:

- **Legend vs map agreement.** Does every mark on the map appear in the legend, and vice versa? Do
  the COUNTS match? (Recent real bug: the legend said "Moringa Tree ×5" while the map carried three
  separate compass-prefixed moringa callouts.)
- **Label crowding and collisions.** Leaders crossing each other, leaders crossing the map edge,
  pills overlapping pills or covering the thing they point at. This was JUST worked on — see
  `producerLabelsWithinBudget` in `lib/producer-labels.ts` and commit `407502f`. Judge whether the
  budget of 12 is right, and whether merged callouts still read sensibly.
- **Anything unlabelled** that a farmer could not identify, and anything labelled twice.
- **Text fitting.** Overflow, clipping, type that dwarfs the title, type too small to read. Legend
  sizing was reworked today (`c3ee87e`) — verify it holds on ALL nine, not just the two checked.
- **Legend swatches must look like the thing on the map.** A known-good example to compare against:
  the swale swatch draws the ditch+berm+hachure treatment, matching how the map draws it.
- **Content correctness.** Does the sheet show what its title claims, and only that? Context should
  read quieter than content.
- **Chrome.** Title block, scale bar, north arrow, attribution — present, correct, not overlapping.

Some asymmetries between sheets are DELIBERATE and documented in comments (Blueprint sheets have
never drawn a north arrow; analysis sheets use a lightened base rather than the design sheets'
scrim). Respect anything with a stated reason — report it, do not "harmonise" it.

---

## Fix vs report

**Fix:** legend/map disagreement, wrong or missing counts, clipped or overflowing text, overlapping
chrome, a label pointing at the wrong feature, a swatch contradicting the map, a stale comment.

**Report, do not change:** anything that alters what a farmer sees as a deliberate design decision;
any restyle of colour or typography; any change to which content a sheet includes. When unsure,
report.

---

## Hard constraints

- `npx tsc --noEmit` and `npm test` must BOTH pass. **Baseline is 1548 passing** — check with
  `npm test 2>&1 | grep "pass"` before you start. That number must never go down.
- **NEVER trigger a paid AI render.** Free "Exact Canvas" only. Do not click AI Hybrid or Full
  Treatment. This job must cost nothing.
- **NEVER modify `PLAN_VERSION`** — bumping it re-charges every paid AI render already bought.
- Never change a price, yield, spacing or agronomic figure. Never invent a number that reads as a
  recommendation to a farmer.
- Never touch secrets, `.env*`, `serviceAccount.json`, `firestore.rules`, `storage.rules`.
- **Never `git add -A`** — this checkout is shared with another agent. Stage explicit paths.
- Another agent is working `docs/WORK-QUEUE-2026-08-02.md` at the same time. It is working in
  `app/api/`, `app/calendar/`, `app/ngo/`, `app/funder/`, `app/student/`, `app/farmer/`,
  `components/ContactInbox.tsx`, `components/NgoDashboard.tsx`, `lib/report-doc.ts` and
  `middleware.ts`. **Stay out of those.** Your work is the sheet renderers:
  `components/design/DesignGlossy.tsx`, `lib/producer-labels.ts`, `lib/sheet-legend-layout.ts`,
  `lib/glossy-filters.ts`, `lib/*-cartography.ts`.

---

## Report back

Per sheet: what you looked at, what you changed, what you re-rendered to confirm it, and what you
found and deliberately left. **Include before/after screenshots** — they are the evidence that the
loop actually ran.

Then a final ranked list of everything still wrong, best value-to-effort first.

Commit on a branch and open a PR. Do not push to `main`.
