# Codex work queue — ImbewuField

Read `AGENTS.md` first. It carries the verification commands, the ownership split, the guardrails
and — most importantly — **§5 LOOK AT WHAT YOU MADE**.

**How to work this queue.** Take the top unstarted item. One branch per item, named in the item.
Never push to `main`. When it is pushed, say so and **carry straight on to the next item** — do not
wait for a review. Claude reviews and merges behind you. If a later item touches the same file as
one still unmerged, branch from the unmerged branch and say so in the report.

Every item below was verified to be real before it was written down — the numbers are measured, not
estimated. If you find one is already fixed or the premise is wrong, **say so and skip it**; that is
a useful result, not a failure.

**Three rules that have each cost a day:**

- **Bump `PLAN_VERSION`** (`components/design/DesignGlossy.tsx`, currently `v66`) in the same commit
  as *any* change to how a sheet is drawn, or nobody who has already rendered sees your fix.
  **A prompt change IS a sheet-drawing change.** Last run's item 4 reasoned "prompt-only, no
  deterministic sheet drawing change — no bump", but the prompt is the entire instruction set the
  model draws an AI sheet from, and AI sheets share that cache key. Claude caught it at merge and
  bumped to v65. If your change can alter a pixel on any sheet, exact or AI, bump it.
- **A test that pins today's constant cannot fail when the constant is wrong.** Assert the *rule*,
  not the *number*.
- **A rule that fires on every design is not a finding.** Before shipping a note or a warning, work
  out what fraction of real designs trigger it. See the previous run's water note below.

---

## Done — the previous run

Items 0, 1, 2, 4, 5, 6 merged as `a1a89a4`. **Item 3 was correctly refused** — see item 1 below,
which is that refusal turned into work.

Two things from that run worth carrying forward:

**The `×N` fix had a second home, and item 4 found it.** v63 fixed the designed-element list; the
Water sheet's "what this system serves" clause still said to caption each served bed "exactly as
written above", where above is an inventory reading `Vegetable Bed ×7`. Good audit — that is the
kind of second-order hit the item was written to catch.

**Item 6's storage note was reverted at review.** It compared placed tank capacity against measured
annual roof harvest and warned when capacity fell short. Measured: 100 m² of roof at 800 mm/yr
harvests 64 kL, so it takes **more than ten 10 000 L JoJos** before that comparison goes quiet — it
fires on essentially every real design, and it reads as "your tank is too small" to a farmer who
cannot afford another one. Annual harvest was never a sizing basis; a tank is drawn down and
refilled all year. The overflow advice was the useful half and it survives. The tests you wrote were
otherwise good — the dimensional `mm × m² = L` identity test is exactly right.

---

## 1. The legend does not agree with the map, and you proved it — `codex/legend-map-agreement`

**This is your own finding from last run, promoted to the top of the queue.** You audited sheets
03, 04 and 06, found the exact renderer already violates legend↔map agreement, and reported it
instead of weakening the check to match. That was the right call and this is the follow-through.

What you reported, to save you re-deriving it:

- **sheet 03** draws all saved design items as 20 %-alpha ghosts (`drawFilteredItems(..., 'all')`)
  while its legend contains zones and ground only.
- **sheet 04** draws filtered planting fixtures through `drawContextItems` with no legend rows.
- **sheet 06** draws filtered planting items and routes at 24 % alpha with no legend rows.

So a filtered-off element is on the map but absent from the legend, reproducible against the
checked-in demo design and demo geometry fixtures.

**Decide what the rule should be before writing code, and say which you chose.** There are two
defensible answers and they are not the same product:

1. *Context is not content.* A ghosted, low-alpha element is deliberate context — it is there so
   the reader can orient — and context legitimately carries no legend row. Then the rule is not
   "everything drawn is in the legend" but "everything drawn **at full strength** is in the
   legend", and the fix is to the check, with the alpha threshold as the explicit boundary.
2. *If it is on the page, name it.* Then ghosted elements get their own quiet legend treatment —
   a CONTEXT heading, or a muted row — and the fix is to the renderer.

Option 1 is more likely right, but it is exactly the shape of change that can be used to make a
failing test pass, which is why it needs to be argued rather than assumed. Whichever you pick, the
end state is the same: **an honest assertion that runs over all eight sheets and both fixtures and
passes for the right reason.**

Then look at a rendered sheet 03, 04 and 06 and confirm the reader can actually tell context from
content — because if a farmer cannot, option 1 is wrong regardless of what the code says.

`PLAN_VERSION` only if you change what is drawn.

---

## 2. The two tanks are labelled the other way round on the two styles — `codex/tank-label-identity`

Rory rendered the SAME Water design twice and sent both PNGs at full resolution.

| | top-left tank, on the boundary | middle tank, by the house |
|---|---|---|
| Satellite Overlay (model draws labels) | `JOJO TANK 2500L` | `JOJO TANK 5000L` |
| Extension Blueprint (app draws labels) | `JOJO TANK 5000L` | `JOJO TANK 2500L` |

**One of those sheets tells a farmer to stand the wrong tank on the wrong base.** A 5000L JoJo is a
different footprint, a different plinth and a different delivered price from a 2500L. This is not a
styling complaint.

The app owns the placement in both cases — the model only paints over markers it was given. So the
app-drawn sheet is the one to trust and the model is the likely culprit, but **do not assume that:
prove which is right from the saved design before changing anything.**

Start by rendering the exact (no-AI) Water sheet for the same design and seeing which of the two it
agrees with. Then work out how the other one could disagree at all. Worth checking specifically:
whether the label a marker carries is bound to the marker's own element id all the way through, or
whether anywhere it is matched back by *type* or by index — with two tanks of the same type, an
index or type match is exactly how two labels swap.

If it turns out the model reordered them, that is a finding too, and the fix is that a tank's
capacity is not something a model may letter — it becomes app-drawn chrome like the schedule panel.
Say which of the two it is; do not fix both speculatively.

**READ THIS BEFORE YOU START — the likely cause has been found and fixed, so your job here is to
confirm or refute, not to go hunting.**

`415b8d5` (v66) fixed a **leader-line collision** in both exact drawers. The long horizontal segment
of a leader used to run at the ELEMENT's y and then cut a diagonal to the label. Label rows are
de-collided by `stackLeaderRows`; element positions are not. On the Ubhejane demo the JoJo tank sits
at y≈239 and the compost bay at y≈245, both on the left, so the two runs overlapped into one
unbroken line and `JOJO TANK 2500L` read as pointing at the compost bay three hundred pixels away.
**The data was correct the whole time.** Found by rendering exact sheet 07 and looking at it.

Rory's two tanks are the same shape of complaint, on a sheet where two same-type elements sit at
similar heights. So **start by re-rendering his design on v66 and seeing whether the swap survives.**
If it does not, say so and move on — that is a complete result. If it does, then it is a genuine
identity bug and everything below applies.

Both his PNGs were rendered on `76a63c3`, which a frozen deploy had pinned for 23 commits, so they
predate every label fix.

---

## 3. The legend panel is three-quarters empty — `codex/legend-panel-fill`

Same PNG. On the Extension Blueprint water sheet the legend column carries a title, six rows and
then roughly **two thirds of the panel is blank cream** down to the NOTES block at the very bottom.
Next to the Satellite Overlay render of the same design, where the rows are large and evenly spread
down the column, it reads as unfinished.

Two separate things to fix, and they are worth separating in the report:

1. **Rows do not fill the column.** The panel is now as tall as the map (sheets follow the plot),
   but the row rhythm is still sized as if the panel were short. Space the rows to the column they
   are actually in — the phasing panel already sheds and re-fits content to its own height, so
   there is a pattern in the codebase to follow rather than invent.
2. **Counts appear on some rows and not others.** That sheet shows `Tap Point ×6` but plain
   `JoJo Tank 2500L`, `Buried water pipe`, `Swale / contour water line`. A reader cannot tell
   whether the absence of a number means "one" or "not counted". Pick one rule and apply it to
   every row. The legend is the third of the three `×N` grammars — items 4 and this one are the
   same underlying confusion seen from different ends.

`PLAN_VERSION`. Verify by rendering, at both a wide and a tall boundary.

---

## 4. Snap a whole selection at once — `codex/marquee-snap-all`

**Rory asked for this directly:** *"perhaps consider a cleanup operation via marquee that snaps all
the zone boundaries etc?"*

The pieces already exist. Marquee multi-select and group move are in `components/design/
DesignCanvas.tsx`; single-ring snapping is `lib/snap-edges.ts`, which now works on zones (it did
not until `641fa9d` — the tolerance was sized for tracing a house off a photo, and a corner already
lying on a neighbour's edge was counted as a move). This item joins them: with several rings
selected, snap all of their shared edges in one operation.

**The safety architecture is the whole job, and it is already written — do not weaken it.**
`lib/snap-edges.ts` is guard-then-revert: the boundary is never an eligible neighbour, and
self-intersection, winding, false-join, area-change and movement guards each veto a move. Read that
file before you start.

The new question a bulk operation raises, which the single-ring version never had to answer: **what
happens when one ring in the selection fails its guards?** Snapping four zones and silently
reverting one is the worst outcome — the farmer sees "snapped" and does not know which. Decide, say
which you chose, and make it visible in the confirm summary:

- all-or-nothing (safest, most frustrating on a 6-zone selection), or
- per-ring, with the summary naming exactly which rings moved and which were left alone.

The existing confirm summary is the model to follow — it already reports *"Moves 2 corners to meet
Zone 2. Nothing moves more than 1.1 m"*, which is the right level of specificity. A bulk summary
that just says "Snapped 4 zones" is not good enough.

One undo entry for the whole operation, not one per ring.

Tests: a selection where every ring snaps; a selection where one ring would self-intersect and must
be left untouched while the others still move; and a selection containing the boundary, which must
never be dragged into a zone. Verify in the running app on the demo farm, not only in the unit test.

---

## 5. The app has two different runoff coefficients — `codex/runoff-coefficient-split`

**Measured, not suspected:**

```
lib/water-system.ts:107   const ROOF_RUNOFF_COEFF = 0.8;   // Water plan sheet notes
lib/tank-sizing.ts:52     const RUNOFF_COEFFICIENT = 0.85; // Tank Calculator
```

Same physical quantity — the fraction of rain landing on a roof that reaches the tank. A farmer can
open the Tank Calculator and the Water sheet for the same design and read harvest figures about 6 %
apart, with nothing on either screen explaining why.

**Do not pick one and delete the other.** A coefficient is an agronomic figure: report, do not edit.
What this item wants is:

1. A single shared constant, in one module, imported by both — so the *structure* can no longer
   drift, whatever the value ends up being.
2. A short written case for which value belongs there, with a source, put in the report and in a
   comment next to the constant. 0.8 and 0.85 are both defensible published figures for corrugated
   roofing; the point is that the repo should say which one it chose and why.
3. If the honest answer is "these are different because the two screens model different things"
   (first-flush diversion counted in one and not the other, say) then that is the finding, and the
   fix is that both screens *say so* — not that the numbers silently disagree.

**Flag the value change to Rory rather than shipping it**, exactly as you would a price. Landing the
shared-constant structure with today's two values preserved behind named exports is a complete,
mergeable result on its own.

Tests: both call sites derive from the same source; the identity `1 mm on 1 m² ≤ 1 L` holds for
whatever value is chosen (`tests/water-system.test.ts` already asserts this for one of them).

---

## 6. The Water sheet ignores the real sizing engine — `codex/water-sheet-uses-sizing`

`lib/tank-sizing.ts` does a proper **monthly water balance**: `computeTankSizing` walks twelve
months of rainfall against `DAYS_IN_MONTH × dailyUseL` and works out the storage a household
actually needs to get through the dry season. That is the correct way to answer "is my tank big
enough", and it already exists in this repo, fully written.

It has exactly one consumer:

```
components/design/TankCalculator.tsx:70   computeTankSizing({ monthlyRainfallMm, roofAreaM2, dailyUseL })
```

The Water plan sheet — the thing that gets printed and taken to the field — does none of this. It
multiplies annual rainfall by roof area and stops. Last run's storage note tried to close that gap
by comparing capacity against *annual harvest*, which is not a sizing basis and fired on every
design (see "Done" above); it was reverted at review.

**The gap is real and this is the right way to close it.** Make the Water sheet's storage note come
from the same monthly balance the Tank Calculator uses.

The blocker to solve first, and the reason this is a real piece of work rather than a one-line
import: `computeTankSizing` needs **`dailyUseL`** and **twelve months of rainfall**, and
`deriveWaterSystem` currently receives a single annual `rainfallMm`. So:

- Where does monthly rainfall come from on the sheet path? `lib/nasa-power.ts` already returns
  twelve monthly totals (it correctly multiplies NASA's mm/day climatology by days-in-month — do not
  "fix" that). Find out whether the sheet path has access to it or only to the annual figure.
- `dailyUseL` is a household input, not something to invent. If the design has no household size
  saved, **the note must say what it does not know** rather than assume a figure. "Sizing needs your
  daily household use — set it in the Tank Calculator" is a good note. A guessed default is not.

If it turns out the monthly data genuinely is not available on that path, **stop and report that**
— it is a data-plumbing finding worth knowing, and half-wiring it with an assumed default would
reintroduce exactly the problem review just removed.

`PLAN_VERSION` (sheet notes change).

---

## 7–20. Untested modules, in farmer-risk order

Fourteen modules with no test coverage at all. Measured with a script over `lib/` against `tests/`;
line counts are current. **One branch per module**, named `codex/test-<module>`.

These are not busywork. The last two rounds of this exact item found: crop rotation never rotating,
random ids making identical advice differ run to run, a slope seed deleting Zone 5, and an area of
zero being priced as free. Assume there is something real in each one.

**For every module in this list, the job is the same:**

- Read it and write down what it *promises* — the invariants a farmer's decision rests on.
- Test the rule, never today's constant. If you find yourself writing the current number into an
  assertion, you are pinning a snapshot.
- Zero, negative, missing, `NaN` and `Infinity` inputs must produce sensible farmer-facing output,
  never `NaN` on a printed sheet.
- **If a test fails, that is the result.** Report it. Do not adjust the test until it agrees.
- Do not change a price, a coefficient, an agronomic figure or a species name to make a test pass.

Order matters — work down it. Each line names what makes that module risky, which is what your
tests should aim at:

| # | Branch | Module | Lines | What is actually at stake |
|---|---|---|---|---|
| 7 | `codex/test-tank-sizing` | `lib/tank-sizing.ts` | 197 | The monthly water balance itself. Does a dry-season deficit ever get reported as sufficient? Does `suggestJojoTanks` ever recommend a combination that does not reach the required litres? |
| 8 | `codex/test-water-calc` | `lib/water-calc.ts` | 173 | Second water-figures module. Check first whether it duplicates `water-system` or `tank-sizing` — a third runoff constant would be item 5 all over again. |
| 9 | `codex/test-harvest-reconciliation` | `lib/harvest-reconciliation.ts` | 341 | Yield figures the catalog audit already found to be systematically optimistic. Does reconciliation preserve a shortfall, or average it away? |
| 10 | `codex/test-biome` | `lib/biome.ts` | 225 | Biome classification steers planting advice. What happens at a boundary between biomes, and outside South Africa entirely? |
| 11 | `codex/test-nasa-power` | `lib/nasa-power.ts` | 183 | The mm/day → monthly conversion is correct today (`PRECTOTCORR × DAYS_IN_MONTH`) and must be pinned so nobody "simplifies" it. Also: what happens when the API is down or returns partial months? |
| 12 | `codex/test-report-doc` | `lib/report-doc.ts` | 400 | The 11-section report is the product's differentiator. A section that silently renders empty is worse than one that errors. |
| 13 | `codex/test-facilitator-design` | `lib/facilitator-design.ts` | 394 | Feeds the BOQ. Item 1 of the last run found unmeasured areas priced as free here; look for its siblings. |
| 14 | `codex/test-render-jobs` | `lib/render-jobs.ts` | 248 | The paid-render queue. A job lost, duplicated or double-charged is real money. |
| 15 | `codex/test-offline-cache` | `lib/offline-cache.ts` | 202 | A farmer spends their own airtime in town on these downloads. A deploy must never wipe them (`COURSE_CACHE` is deliberately unversioned — pin that). |
| 16 | `codex/test-design-canvas-sync` | `lib/design-canvas-sync.ts` | 202 | Cross-device sync has already produced duplication once. Shapes must stay JSON strings (Firestore rejects nested arrays). Last-write-wins against a stale device is data loss. |
| 17 | `codex/test-site-progress` | `lib/site-progress.ts` | 206 | Drives what the farmer is told to do next. |
| 18 | `codex/test-task-board` | `lib/task-board.ts` | 263 | Same, for the task-first home screen. |
| 19 | `codex/test-completion-score` | `lib/completion-score.ts` | 148 | A score that can exceed 100 %, or sit at 0 for a finished design, is visible and embarrassing. |
| 20 | `codex/test-design-substeps` | `lib/design-substeps.ts` | 292 | Step gating. A farmer locked out of a step they have completed is a support call. |

If you finish 20, keep going with the same recipe on `lib/lesson-registry.ts` (378),
`lib/sheet-store.ts` (156), `lib/invoices.ts` (115), `lib/site-survey.ts` (191),
`lib/evidence-catalogue.ts` (148) and `lib/design-overlay.ts` (171) — branch
`codex/test-<module>` as above.

---

## 21. The same bug has now appeared FOUR times — `codex/legacy-key-normalisation`

**This is a pattern, not an incident, and it is worth fixing once instead of a fifth time.**

Every one of these was found and patched separately, in one night:

| Where | What older data looked like | What broke |
|---|---|---|
| `ZoneShape.zone` | a **string** `"3"`, not a number | strict `Set.has` missed it — the Zones step read **0 of 4 zones** while rendering fine |
| evidence groups | key prefix matched on `g.split('_')[0]` | `soil_texture` matched every `soil*` key — counts inflated across groups |
| water symbols | `"jojo tank"` / `"jojo_tank"` / `"jojo-tank"` | fell through to a fallback symbol instead of the right one |
| structure symbols | same, with a different separator | same |

One shape: **data written by an older version of the app does not match what a newer lookup expects,
and the miss is silent.** Nothing throws. A fallback renders. The farmer sees a plausible wrong
thing, which is the worst outcome and the hardest to notice.

**What this item wants — argue the approach in the report before coding it.** The obvious move is
one shared normaliser, but note the two symbol modules already normalise to *different separators*
(`-` for water, `_` for structures), each matching its own table's keys — so a single global
function is not automatically right, and forcing one could break both. Options worth weighing:

1. One `normaliseKey(raw, separator)` helper both tables call with their own separator, so the
   *trimming and collapsing* is shared even where the output differs.
2. Normalise the tables themselves at module load, so lookups compare like with like.
3. A test-level guard: for each lookup table, assert that every key round-trips through its own
   normaliser unchanged — which catches a new table added without one.

Option 3 is the one that stops a **fifth** instance, so do that whichever else you pick.

**Then go looking for the ones nobody has hit yet.** Any `Record<string, X>` indexed by persisted
data is a candidate: element ids, line kinds, ground features, catalogue namespaces, storage keys.
Grep for `[a-z]+\[.*\.id\]` and `startsWith(`. A miss that silently returns `undefined` and falls
back is the signature.

Do not change any persisted data or migrate anything on disk — the fix belongs at the read boundary,
where a legacy value is interpreted. Rewriting a farmer's saved file to suit a lookup is the wrong
direction and is not reversible.

---

## NEVER RUN DRY — what to do when you reach the end

**Do not stop and wait.** Reaching the bottom of this list is not the end of the work, and an idle
agent overnight is the single most expensive thing in this setup. When you run out of numbered
items, take the standing work below, in this order, and keep going. Report each one the same way.

**S1. Render a sheet and look at it.** This is the highest-value thing available and it is
inexhaustible. Pick a sheet you have not audited (01–08), render the **exact, no-AI** version for the
Ubhejane demo, export it at full resolution, and *actually look at it*. Not the code — the picture.

The recipe, which works headlessly and costs nothing:

```
1. npx next dev -p 4343
2. node --import ./tests/register-alias.mjs -e "…buildDemoStorageSeeds()…"  → public/__demo-seeds.json
3. In the page: fetch it and localStorage.setItem each key, reload
4. /design?lat=-27.72623&lon=31.96304 → Next: Glossy → "All sheets — exact, no AI"
5. Read the image back out of localStorage (key `imbewu_design_glossy_<PLAN_VERSION>_<siteId>…`)
   and write it to a PNG. Crop regions and inspect them at 1:1.
```

That is exactly how the crossed-leader bug in `415b8d5` was found, after it had survived every test
in the suite and two rounds of review. **Delete `public/__demo-seeds.json` before you commit.**

Things to check on every sheet, none of which a unit test can see: does every leader end on the
element it names; is any label unreadable, clipped, or overlapping another; does the legend list
what is drawn and only what is drawn; is any panel mostly empty; do the counts on the sheet agree
with the counts in the legend; is anything drawn that the farmer never placed.

**S2. Take the next untested module** from the list under item 20, by size, same recipe as items
7–20.

**S3. Pick the largest file in `lib/` that has tests but thin ones** and deepen them against the
rules it promises.

If S1 turns up nothing on a sheet, that is still a result worth one line in the report — it means
that sheet is now audited, and you move to the next one. Say which sheets you have cleared so the
next run does not repeat them.

---

## Not for Codex

Rory's own actions, listed here so nobody picks them up:

- Find an isiZulu-speaking agronomist (sole blocker on module 2 — 22 coined terms need review).
- Spend a real paid render to confirm the `×N` fix and the tank-label question above.
- Give ChatGPT the Water Harvesting deck prompt.
