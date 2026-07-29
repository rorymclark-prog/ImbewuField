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

## 22. DONE (by Claude, dfe8f35) — `DRIVEWAY` labelled on sheets with no legend row

Fixed on main. The cause was `producerLabels` emitting the pill on every sheet while only the
masterplan's curated callout layer filtered it back out. Gated at source on `filter === 'all'`.
Verified by re-rendering all eight sheets: 05 and 06 changed by 3 473 px each, every other sheet
by 0. Left here for the record — do not redo it. **Item 23 is the same family and is NOT fixed.**

<details><summary>original item</summary>


**Found by rendering the exact sheets and looking at them (v79, Ubhejane demo).**

Sheet **05 (Planting)** and sheet **06 (Small Livestock & Infrastructure)** both draw a `DRIVEWAY`
margin label. Neither legend contains a driveway row:

- 05 legend: Vegetable Bed x7, Avocado x1, Mango x1, Moringa x2, Natal Plum x1.
- 06 legend: Path x1, Compost Bay (3-bin) x1.

So a named thing is on the map and absent from the key — the same disagreement you fixed for
*elements* in `legend-map-agreement`, in the **ground-label channel** this time. It is also a site
feature on a design sheet, which the AI prompt explicitly forbids ("LABEL THE DESIGN, NOT THE SITE
... none on the driveway", rule 10) — so once again the deterministic renderer disagrees with the
app's own written rule.

**The lead, which is most of the work.** `lib/glossy-filters.ts` exports `groundRegister`, described
in `lib/producer-prompt.ts:5` as *"the ONE authority for the ground content/context/absent split"*.
Two of its three consumers honour it:

- `groundRows(state, refLayers, filter)` — the legend. Gated. Correct.
- the AI prompt's `fabric` clause. Gated. Correct.
- **`groundLabelsForSheet(state, refLayers, W, H)` — the map labels. Takes no filter at all.**

That third one is the bug: it labels every traced ground ring regardless of which sheet it is on.

**But do not just add the parameter — first find out how these sheets are reaching it.** The call
inside `buildComposite` is guarded by `if (!drawDesign && filter === 'all')`, which should exclude
planting and structures entirely, yet the label is on both sheets. So either another call site
(`buildBlueprintBaseMap`, or the hybrid path near the bottom of `DesignGlossy.tsx`) is producing
them, or that guard is not doing what it reads like. **Establish which before changing anything** —
the fix is different in each case, and the guard's comment claims a precision it may not have.

**Not established, so do not assume it:** I also suspected the `DRIVEWAY` leader was anchored to the
*house* rather than the driveway. I measured that off a downscaled screenshot and my own numeric
check did not support it. Treat it as unverified. If you want to settle it, note that
`groundLabelsForSheet` anchors on the **average of the ring's vertices**, which is not a polygon
centroid — for an L-shaped or unevenly-sampled ring those differ, and the vertex average can fall
outside the shape. That is worth checking on its own merits whatever the driveway turns out to do.

`PLAN_VERSION` (the sheets change). Verify by rendering 05 and 06 and looking at them.

---

</details>

---

## 23. A grouped tree label matches no legend row — `codex/grouped-label-legend`

**Verified on the rendered sheet, v82, Ubhejane demo. Not fixed.**

Sheet 05 (Planting) labels the two large trees `SOUTHERN TREES` on the map. Its legend lists
`Avocado Tree ×1` and `Mango Tree ×1` as separate rows. Nothing in the legend says "southern
trees", so a farmer reading the legend to decode the map cannot connect the label to either row —
the same failure as item 22, reached by a different route.

Decide which is right and make both sides agree. Either the map should name the species it is
pointing at, or the legend should carry the group. Do NOT invent a third name. Whichever way it
goes, the rule belongs in ONE place that both the label path and the legend path read — that is
the lesson of items 21 and 22, and of `groundRegister`.

Say in your report whether the picture changes. **Do not touch PLAN_VERSION.**

---

## 24. `groundLabelsForSheet` cannot see which sheet it is on — `codex/ground-label-filter`

**Verified by reading the signature. Not fixed.**

`groundLabelsForSheet` in `components/design/DesignGlossy.tsx` (~line 3579) takes
`(state, refLayers, W, H, avoidTopRight?)` — **no `filter`**. So it labels every traced ground
feature the farmer drew, identically, on every sheet that calls it. But `groundRegister` in
`lib/glossy-filters.ts` is documented as "THE single authority" for whether a ground feature is
this sheet's `content`, mere `context`, or `absent` — and context is explicitly "never captioned,
never legended".

A function that cannot see the filter cannot honour that contract. The demo farm has no traced
ground zones, which is the only reason this is not already visible on a rendered sheet — a farmer
who traces a lawn or an orchard would get it labelled on the Water and Zones sheets, where it is
context.

Give it the filter, honour `groundRegister`, and add the fixture the demo lacks so a test can see
it. Same one-authority rule as item 23.

---

## 25. The AI prompt and the legend describe the same sheet — prove it — `codex/prompt-legend-agreement`

**This is now the project's highest priority. Rory, 2026-07-29: "I want a real well produced AI
polished accurate map and design of each layer with the hybrid working too — this is my biggest
goal, steer everything towards this."**

`tests/legend-map-agreement.test.ts` proves the EXACT sheets' legend matches what is drawn. Nothing
proves the same for the AI path, and the AI path is the product. `overlayElementsText` in
DesignGlossy.tsx (~1611) builds the text handed to the image model — the list of what is on this
sheet — while `exactSheetElementLegendGroups` in lib/glossy-filters.ts builds the legend rows. Two
independent lists of the same thing is exactly the shape that produced items 22 and 23.

Export `overlayElementsText` (or extract it to lib/ — better, since it is pure text assembly over
state and belongs beside `glossy-filters`), then table-test all eight sheets: **anything the prompt
names must have a legend row, and anything the legend lists must be named to the model.** Where they
legitimately differ — context features the prompt mentions so the model keeps them visible but the
legend deliberately omits — encode that as a rule with its reason, not as an exception list.

Two known asymmetries to start from, both already in the code and both deliberate:
- `if (refLayers.driveway.length >= 2 && filter === 'all') parts.push('Tarred driveway')` (~1878)
- `if (refLayers.driveway.length >= 2 && filter !== 'all') fabricParts.push('Tarred driveway')` (~1767)

If you find a real disagreement, fix it in ONE place both paths read — the `sheetElementNaming()` /
`groundRegister()` pattern. **Do not touch PLAN_VERSION**; say in your report whether the picture
changes.

---

## 26. Prove the hybrid composite lands where it should — `codex/hybrid-composite-registration`

**Rory's north star includes "with the hybrid working too". This is the part of it that can be
proven for free.**

`lib/locked-polish-flow.ts` defines the three modes and `tests/sheet-render-route.test.ts` already
covers the 24 sheet x mode combinations, so ROUTING is proven. What is not proven is REGISTRATION:
that the exact overlay burned on top of the AI artwork lands on the same ground the AI painted. A
hybrid whose overlay is offset is the worst failure this app has — the farmer gets a beautiful,
confident, wrong plan, and nothing in the pipeline complains.

You do not need a paid render to test this. Feed the compositor a SYNTHETIC "AI" image of the known
frame — a solid field with a marker at an exact known lat/lon, or a checkerboard whose squares map
to known ground coordinates — then composite the exact overlay and assert the overlay's boundary
corners land on the expected pixels, within a tolerance you state and justify. That is the same
trick `tests/basemap-imagery.test.ts` uses to prove the Esri stitch covers the same ground as the
Mapbox still it replaces: assert the GROUND EXTENT, not the pretty picture.

Cover at least: the masterplan and one layer sheet, both `hybrid` and `full`, and the case where the
AI returns an image of a DIFFERENT aspect ratio to the one requested — that last one is where a
silent letterbox or crop would shift everything, and it is the most likely real cause.

`lib/render-difference.ts` already measures whether a paid stage changed anything; this is the
companion question of whether it changed it in the right PLACE.

**Do not touch PLAN_VERSION.** Say in your report whether the picture changes.

---

## 27. Two labels at the same y cross their leaders — `codex/label-row-tiebreak`

**Found by rendering sheet 05 at v84 and looking. Two defects, both visible in one picture.**

**(a) Crossed leaders.** Every label-row sort in the label pipeline orders by `a.cy - b.cy` with NO
tie-break — four sites: `lib/producer-labels.ts:351`, and DesignGlossy `:3430`, `:3454`, `:3629`.
When two labels share a cy the comparator returns 0, so the row order falls back to INSERTION order,
which is catalogue order and has nothing to do with where the elements are.

This is not hypothetical and it is not rare. The demo farm has:

    demo-di-mango    x=0.355083  y=0.650491
    demo-di-avocado  x=0.466558  y=0.650491   <- identical y

Two trees planted on the same line, which is what a row of trees IS. v83 made layer sheets name
elements individually, so where there was one `SOUTHERN TREES` pill there are now two — and on the
rendered sheet AVOCADO TREE sits on the upper row pointing at the FURTHER tree while MANGO TREE sits
below pointing at the NEARER one, so the two leaders cross.

Break the tie on `cx` (and then on id, so the order is total and stable), in ALL FOUR places — or
better, extract the comparator once and have all four call it, since four copies of an ordering rule
is how they drifted apart in the first place. Assert the rule with a fixture that has tied y values;
the demo farm already is one.

**(b) A merged label that matches no legend row and points at neither tree.** The same sheet reads
`SOUTHERN MORINGA TREE ×2` while its legend row reads `Moringa Tree ×2`. Two problems: the map text
and the legend text for the same thing are not the same words, and the two moringas are at x=0.6449
and x=0.4108 — a quarter of the plot apart — merged under one leader. `producer-labels.ts` already
warns about exactly this in its own comment: *"Merging them instead would be wrong — one leader
aimed at the centroid of two distant taps points at empty ground, which is the bug the clustering
exists to prevent."* Check whether the leader lands on a tree or between them, and whether the
compass prefix should apply to a counted group at all.

**Do not touch PLAN_VERSION.** Both of these change the picture — say so in your report.

---

## 28. The FIRE label is drawn and then painted over — `codex/fire-sector-label`

**Sheet 02, v84. Measured, not guessed.**

The sector sheet names every energy on it — SUMMER SUN, WINTER SUN, SUMMER COOLING WIND, COLD-FRONT
WIND, HOT DRY BERG WIND, ACCESS · DUST · NOISE, SLOPE / TERRACE FALL. Every one except **fire**,
which has legend row 6 ("Regional fire approach (NW)") and nothing readable on the map. For a
smallholder in KwaZulu-Natal that is the one sector on the sheet with a safety consequence.

It is not missing from the code. DesignGlossy `:5847` draws it:

    labelAt(cx + lp[0] * R * 0.55, cy + lp[1] * R * 0.55, `FIRE — ${model.fire.fromLabel}`, '#F0A58C');

Counting pixels in the rendered sheet at that exact colour, which is passed inline at that call site
so nothing else on the sheet uses it:

    fire WEDGE  #E7562D : 619 px   <- the wedge renders fine
    fire LABEL  #F0A58C :  20 px   <- a text label at sheet scale should be thousands

So it is drawn and then almost entirely overpainted. The cause is in the comment three lines above
it: fire's bearing EQUALS the berg wind's bearing by construction, so the author moved the label
INSIDE the wedge to dodge the berg LABEL — but the berg ARROW runs down that same ray and is drawn
afterwards, on top. The dodge moved it from one collision into another.

Fix so the farmer can read it. Options worth weighing, not a prescription: offset the fire label off
the shared ray rather than along it; draw fire after the berg arrow; or give fire a leader into the
margin like every other named thing on the sheet. Whatever you choose, **assert it by counting
label pixels in a render**, not by reading the code — the code already looks correct.

**Do not touch PLAN_VERSION.** This changes the picture; say so in your report.

---

## 29. The plan sheets draw fake contours while a real contour engine sits in the repo — `codex/sheets-use-real-contours`

**HIGH VALUE. Rory: "contours have not been good on the other map." They are not good because the
sheets do not use the contour engine this repo already has.**

There are TWO contour systems here and the farmer-facing one is the crude one:

- `lib/contours.ts` — what the PLAN SHEETS use. `lib/elevation.ts` samples **five points** (centre,
  N, S, E, W) from OpenTopoData SRTM 30 m, derives ONE slope and ONE aspect for the whole farm, and
  draws straight parallel lines at that angle. The file says so itself at line 3: *"HONEST SCOPE:
  our elevation source samples only a few points and yields ONE slope + aspect for the whole site."*
  On the rendered sector sheet those "contours" are perfectly straight diagonals. Real contours bend
  around the land; these cannot, because there is only one number behind them.
- `app/api/contours/route.ts` — what the INTERACTIVE MAP uses. Fetches Mapbox terrain-RGB tiles,
  stitches them into a full elevation grid (hundreds of samples), and runs `marchingsquares`
  `isoLines` at any requested interval, with caching. This is a real contour tracer and it already
  works.

**Make the sheets use the real one.** No new data provider, no new cost — terrain-RGB is already
part of the Mapbox usage this app pays for, and the route already caches by bbox.

Care needed, in roughly this order:
1. The route is a server API; the sheet renderer runs in the browser. Fetch it the way the map does.
2. Terrain-RGB has its own resolution limit. Keep `tooFlat` and the `status: 'ok' | 'too-flat' |
   'unavailable'` honesty — a farm the data cannot resolve must SAY so, not draw confident wrong
   lines. That is the whole point of the existing note.
3. The sector sheet's slope arrow and the "~10% · INDICATIVE" figure come from the same 5-point
   derivation. If contours become real, say plainly whether that figure is still the honest one.
4. **Do not invent a contour interval.** The route defaults to 5 m; `lib/contours.ts` computes a
   "nice" interval from the slope. Decide which is right for a smallholding and say why.

This changes the picture on every sheet that shows contours. **Do not touch PLAN_VERSION** — say so
in your report.

---

## 30. DONE — and the premise was WRONG — `codex/sector-label-halos` (merged)

**Do not re-do this item.** The labels were already haloed text, not chips: `labelAt` and the
composed painter both `strokeText` at `lineWidth 3.5` in `rgba(8,14,22,0.9)` and fill the colour
over it, with no `rect`/`roundRect` in either. Codex verified before acting and added a guard test
rather than "fixing" working code. Claude wrote the item below from a DOWNSCALED render, where a
halo reads as a solid block — the lesson is that a picture inspected at the wrong magnification lies
just like code does. Inspect crops at 1:1. The original wording is kept below for the record.

### (original, incorrect, brief)

Rory's reference sheets are the standard for sheet 02. Their direct labels (`HOT DRY BERG WIND / NW`,
`SLOPE / TERRACE FALL`) are **text with a soft dark halo** sitting straight on the photograph. Ours
are text inside an opaque rounded **pill chip**. On a busy aerial the chips read as stickers stuck
over the site — six of them punch six rectangular holes in the very photo the sheet exists to show.

`directLabelAt` and `labelAt` in `drawSectorAnalysis` (components/design/DesignGlossy.tsx) are the
only two places this is decided. Replace the chip with a halo: draw the text several times in a dark
translucent colour at small offsets (or `ctx.strokeText` with a wide `lineWidth` and
`lineJoin: 'round'` under the fill), then the fill on top.

Rules:
- **Legibility is the point, not the chip.** Whatever you build must stay readable over both the
  bright bare-earth and the dark-bush parts of the same photo. Prove it: render sheet 02, crop one
  label over pale ground and one over dark bush at 1:1, and put both in your report.
- Keep every label's colour, wording, position and leader exactly as they are. This is the chip only.
- The legend panel's rows are on cream paper and are fine — do not touch them.
- **Do not touch `PLAN_VERSION`.**

## 31. The sheet-02 footer note is an unbroken wall of 8 pt italic — `codex/sector-notes-box`

`analysis.noteText` renders as ~10 lines of tiny italic under the legend. It carries the honesty of
the whole sheet — which bearings are computed and which are a regional assumption — and nobody will
read it in that form. The reference puts its equivalent in a **bordered box with a short heading**.

Give it a hairline border, internal padding, and a heading (`NOTES & PROVENANCE` or similar — match
the legend's existing type treatment; do not invent a new typeface). The text itself is unchanged:
**do not rewrite, shorten or re-order a single sentence of the provenance wording** — several of
those sentences are the difference between "sourced" and "invented" and they are load-bearing.

If the box will not fit the panel, say so with the measured numbers rather than shrinking the type
below what is already there. **Do not touch `PLAN_VERSION`.**

## 32. Every sector wedge draws two dashed edges that run off the sheet — `codex/sector-wedge-edges`

`drawRegionalWedge` fills a translucent wedge and then strokes **both** its long edges with
`setLineDash([10, 7])`. With three named winds plus fire that is eight dashed rays leaving the plot
in different directions, and at the frame edge they read as unexplained diagonal dashes — Rory:
"why is there so many weird lines?"

The dashed-versus-solid distinction is a real contract and must survive: SECTOR-MODEL-SPEC §4 says
computed geometry (sun arcs, contours, the driveway arrow) is **solid** and regional assumptions are
**dashed**. So keep the dash, but carry it on ONE mark per energy rather than two: the arrow's
centreline is the natural home for it, since every regional energy already draws one.

- Read the §4 contract first and quote the line you are honouring in your report.
- The wedge keeps its fill, its bearing and its half-width. Geometry does not move.
- Check the legend still distinguishes the two registers (`style: 'dashline'` vs `'line'`) — if
  removing the edges makes the legend's dashed swatch describe something no longer on the map, that
  is a finding, and say so instead of quietly changing the legend.
- **Do not touch `PLAN_VERSION`.**

---

## 33. The planting sheet HIDES a spacing conflict instead of showing it — `codex/canopy-overlap-legible`

**This is the most important item in the queue. Rory, on the Planting sheet: "look underneath, it's
a serious issue."**

Mature tree canopies are painted as fully opaque radial-gradient fills with leaf blobs on top
(`DesignGlossy.tsx`, the `def.category === 'growing' && def.shape === 'circle'` branch, ~line 4099).
Where two canopies overlap, the later one simply erases the earlier. On the Ubhejane demo that
produces one merged green mass on the south edge with THREE leader lines pointing into it, and the
farmer cannot tell which tree is which or where to dig.

**Measured on the demo design (frame 89.7 m x 59.8 m), so this is arithmetic, not an impression:**

| pair | planted apart | mature canopy | result |
|---|---|---|---|
| mango ↔ moringa | 5.1 m | 5.0 m radius + 2.0 m radius | **1.9 m overlap** |
| avocado ↔ moringa | 5.1 m | 4.0 m + 2.0 m | **0.9 m overlap** |
| mango ↔ avocado | 10.0 m | 5.0 m + 4.0 m | 1.0 m clearance |

Those canopy figures are correct and SOURCED — `tree_mango` is `wM: 10` with the tip "Mature canopy
can reach 10 m+", avocado 8 m, macadamia 9 m, moringa 4 m. **Do not touch a single one of them, and
do not invent new ones.** The numbers are right; the drawing is wrong.

**The defect is that a real design conflict is being concealed by paint.** Spacing is the whole
point of a permaculture plan. A farmer who plants from this sheet puts a moringa 5.1 m from a mango
that will need 5.0 m of radius, and nothing on the sheet ever told them.

What to do:

1. **Make overlapping canopies individually legible.** The standard landscape-drafting convention is
   a visible canopy EDGE with a fill light enough that what is beneath still reads — beds, paths,
   water lines and the neighbouring canopy. Keep the illustrated look Rory likes; it is the opacity
   and the erasure that have to go, not the artwork.
2. **The overlap must end up visible on the sheet.** If two mature canopies intersect, a farmer
   should be able to see that they do. How you show it is your call — an overlap tint, both edges
   drawn through, whatever reads at 1:1 — but "you can no longer see it because the top tree won"
   is the bug, so a fix that merely reorders which tree wins is not a fix.
3. **Change NOTHING about placement.** Do not move, resize, respace or drop an element. The overlap
   is the farmer's own design and the sheet's job is to show it, not to silently correct it. This
   is a RENDERING change only.
4. Sheet 05 also carries two pale unlabelled grey rectangles over the house/driveway area — the same
   family of defect Claude just removed from sheet 02 in v89. Report what they are; fix only if it
   is genuinely the same one-line cause.

Prove it with 1:1 crops of the south-edge tree cluster before and after — the whole point is whether
a human can now tell three trees apart. If your sandbox cannot run a browser, say so plainly in the
report and leave the crops to Claude rather than claiming a visual result you did not see.

**Do not touch `PLAN_VERSION`.**

---

## 34. STOP TUNING THE POLISH PROMPT — it has never been sent — `codex/benchmark-rubric-from-real-renders`

**Read this before picking up any layer-3 work. It invalidates the premise of the last several
days, mine included.**

Every paid render's INPUT, OUTPUT and MASK have been sitting in Firebase Storage the whole time,
and the exact prompt is stored verbatim on the job doc. Neither of us knew. Both of us have been
reasoning about paid renders we had never looked at — your own item 25 and 26 reports say so
plainly: *"I did not spend a paid AI render, so the model-authored visual result is unverified."*

I read them. Over 300 job docs, ~250 paid sheets, the app's entire history:

```
resultKind:                              hybrid 22 · unset 38 · ai-polished 0
sheets ever sent ANY second-pass prompt:  2   (25 and 26 July, older wording)
sheets ever sent buildFinishedSheetPolishPrompt:  0
```

**`buildFinishedSheetPolishPrompt` has never been sent to the model. Not once.** Every "badly
produced step 2" Rory has reported was step 2, because step 3 has never existed. Tuning that
prompt cannot be validated — the thing it configures does not run. Stop.

**Two more measured facts, so nobody re-derives them:**

1. The layer-2 protect mask on a real planting job measures **72.4% fully protected**. I rebuilt
   the composite from the stored input/output/mask: 72.7% restored from the original satellite,
   27.3% kept from the paid render. The ragged keyhole edges, the house reverting to blurry
   satellite under two white outlines, the leftover emoji slivers — that is where they come from.
   `DesignGlossy.tsx` already says so in a comment: the composite-back path *"always seams the
   model art against the real satellite (visible edges, occasional clipped roof)."*
2. **The benchmark look already works.** Job `…1785068880049_pv9bkm`, Water, 26 July,
   `showcase: true`, `geometryLock: false`, one paid pass, no compositing-back. Title block,
   legend, labels, north arrow, scale bar. It is the `showcase` path, and it is sitting behind a
   toggle while the flow Rory actually uses routes around it.

### How to read a paid render yourself — do this before any claim about model output

Requires `serviceAccount.json` (repo root, gitignored) and `functions/node_modules/firebase-admin`.

```
render_jobs/{jobId}.sheets[]  →  .prompt (verbatim), .resultKind, .status, .inputPath, .outputPath
Storage: renders/{uid}/{jobId}/input-{key}.jpg · output-{key}.png · mask-{key}.png
```

The mask is ALPHA-encoded — alpha 255 = protected, alpha 0 = editable. It renders as a blank white
page in every viewer, so **measure it with `pngjs`, never eyeball it**. Working scripts that do all
of the above are in the session scratchpad; rewrite them under `scripts/` if you want them durable.

### Your actual job

Write `design/BENCHMARK-RUBRIC.md` **against real stored renders, not against imagination.** Pull
the paid outputs listed above plus the ChatGPT sheets in `design/benchmark/`, and define what
"matches the benchmark" means in terms a script can check — panel presence, legend/label
agreement with the element list, text legibility, seam count, proportion of the sheet that is
photographic vs drawn. Cite a real job id for every criterion. A criterion you cannot point at an
actual image for does not go in the file.

**Files: `design/BENCHMARK-RUBRIC.md` and anything new under `scripts/`. Do NOT touch
`components/design/DesignGlossy.tsx` or `lib/locked-polish-flow.ts` — Claude is rewriting the
stage flow there right now and a merge into that file will conflict.** `lib/producer-prompt.ts`
stays yours, but leave the polish builder alone until the flow actually reaches it.

**Do not touch `PLAN_VERSION`.** Do not spend a paid render without asking Rory first — you no
longer need to, because ~250 of them are already on disk.

---

## 35. Now that the flow reaches it: Full Treatment's polish prompt asks the model to EDIT, not repaint — `codex/full-treatment-stage-execution` merged as `dadf7f2` (PLAN_VERSION v92)

Item 34 stopped short of touching the polish builder because the flow never reached it. It reaches
it now. This item is the actual accuracy fix Rory has been asking for since "that image you posted
is amazing just quite inaccurate sadly get it accurate" — read it in full before changing anything.

**Where the polish prompt is chosen:** `components/design/DesignGlossy.tsx:9452-9453`:
```js
const prompt = fullSheetPolish
  ? buildFinishedSheetPolishPrompt(layerLabel, styleKey, placeName)
  : isModelChromeStyle(styleKey)
  ...
  : lockActive
  ? buildLockedIllustrationPrompt(layerLabel, styleKey, elementsText, designBrief)
  ...
```
`fullSheetPolish` (`lockedPolishStage === 'polish'`) is checked first, so Stage 3 always gets
`buildFinishedSheetPolishPrompt` regardless of `lockActive`. That builder (`lib/producer-prompt.ts:1108`)
asks the model to take the FINISHED HYBRID SHEET — labels, legend, north arrow, every drawn
element already in place — and improve it. Nothing constrains the model to keep anything where it
is. It relocates elements, invents new ones, and drops accuracy to zero: this is the exact
"amazing but inaccurate" result Rory flagged, and the reason every prior Stage-3 attempt (drift-
measured this session) either collapsed back to Hybrid or scattered the geometry.

**The candidate fix, proven as a mockup, not yet as a real render:** feed Stage 2 the AI GROUND
ONLY (no labels, no legend, no drawn elements — a bare illustrated satellite), and let the app draw
every fact — boundary, canopy rings, beds, structures, driveway, labels, legend — on top
deterministically, exactly as it already does for the exact/no-AI sheet. `mockup.mjs` (session
scratchpad, not yet in the repo) demonstrated this by classifying a real exact-sheet composite into
"drawn" (saturated yellow boundary, saturated green linework, near-white chrome — labels/legend/
title) vs "photographed" pixels, and compositing the drawn 1.28% over a real paid ground-only
render: crisp boundary, correct 7-strip bed structure, no seams, no patchwork. That is the target
shape for Stage 3: **the model repaints 100% of the ground; the app owns every fact.**

**Two existing builders already attempt "ground only," and they disagree with each other — resolve
this with a fresh real render, not by trusting either claim blindly:**

- `buildLockedBackgroundPrompt` (`lib/producer-prompt.ts:108`) — marked "superseded... kept for an
  instant call-site rollback." Its own docstring (line 56-59) says it was tried and rejected:
  "produced exactly what it asked for: a flat green patch clipped into an untouched satellite photo
  — visibly worse than the deterministic sheet." **This session's own drift-measured test of this
  exact function (Planting sheet, `precision_atlas` style, real paid render) did not see that
  failure** — the output was a fully illustrated ground with real texture variation, the yellow
  boundary ran nearly parallel to the authoritative geometry with only a small offset, the 7-strip
  beds and three dark-roofed buildings registered well. Only large boundary-edge canopy rings and
  the central house area (blurry satellite smear) were off. **This is a real contradiction — find
  out why:** does the style preset matter (this session used `precision_atlas`, the rejection may
  have been on a different default style), was the original rejection tested on a different sheet
  type, or is there a scoring difference between "looks bad in one viewer" and "measures well against
  saved geometry." Don't take either account on faith; render it yourself and measure.
- `buildLockedIllustrationPrompt` (`lib/producer-prompt.ts:66`, already wired at line 9457 for
  `lockActive`) takes a different stance: it DOES paint existing buildings/roofs ("every building as
  its full roof seen from directly above") but invents nothing new, and its own docstring already
  describes exactly the hybrid-finish pattern this item wants: "the app restores protected roof,
  driveway, boundary and context pixels, then reinforces exact feature outlines... over your
  artwork." This may already be the intended Stage-3 builder and simply needs the `fullSheetPolish`
  branch reordered/merged with the `lockActive` branch rather than a new prompt written.

**Your job:** decide which of these (or a new builder) Stage 3 should use, wire it into the
`fullSheetPolish` branch, and validate with a REAL paid render (not a mockup) measured the same way
this session did — overlay the saved boundary/canopy geometry on the output and measure registration,
don't eyeball it. Acceptance: boundary and canopy rings land on the AI ground at least as well as
this session's `precision_atlas` measurement, the sheet reads as fully illustrated (no raw satellite
patch, no seam), and nothing that was invented is a species, count or position the farmer didn't
place. The house-area blur is a known open problem — if you can't fix it in this pass, say so plainly
rather than paper over it with a crop or blur filter.

**Bump `PLAN_VERSION`** in the same commit if you land this — it changes what every AI sheet draws.
Post the before/after (old polish-collapse vs new) and the registration measurement on issue #35.

---

## 36. Failed enqueues leave orphaned uploads forever: the renders write rule breaks delete

Found live during the emulator end-to-end run (evidence on issue #35, 30 July). `storage.rules`:

```
match /renders/{uid}/{allPaths=**} {
  allow read:  if request.auth != null && request.auth.uid == uid;
  allow write: if request.auth != null && request.auth.uid == uid
               && request.resource.size < 12 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');
}
```

`write` covers create, update AND delete — but on a delete `request.resource` is null, so
`request.resource.size` doesn't evaluate to false, it **throws** (emulator log: "EvaluationException
… storage.rules line [43] … Null value error"), and the delete is denied. Consequence:
`enqueueRenderJob`'s rollback path (lib/render-jobs.ts — "on ANY failure every already-uploaded
object is rolled back so no orphans are left") has NEVER actually deleted anything. Every failed
enqueue in production history has left its `input-*.jpg` (and mask) objects orphaned in Storage,
and the code's own comment claims the opposite.

**Fix**: the standard split —

```
allow create, update: if request.auth != null && request.auth.uid == uid
                      && request.resource.size < 12 * 1024 * 1024
                      && request.resource.contentType.matches('image/.*');
allow delete: if request.auth != null && request.auth.uid == uid;
```

Owner-scoped delete is safe here: a user deleting their own render inputs is exactly what rollback
wants, and the worker's outputs are Admin-SDK-written (rules don't bind it) — though note a user
COULD then delete a finished output object they own; the job doc survives, the gallery record
holds its own copy, so that is acceptable. Verify in the emulator (see recipe below) that a forced
enqueue failure now rolls back cleanly. **Do not deploy the rules** — flag it; Rory or Claude
deploys rules in daylight hours.

Optionally also: a small worker or scheduled cleanup for the existing production orphans —
count them first (list `renders/**` objects whose jobId has no `render_jobs` doc or whose doc
never reached 'running') and report the number before deleting anything.

### The emulator render-loop recipe (free, no OpenAI, no production traffic)

What the live verification used; reusable for any render-flow work:

```
1. firebase emulators:start --only auth,firestore,storage --project fieldproof-sa
2. npm run seed:emulator        # test user + profile + app_config/renders kill switch
3. npm run dev:emulator         # port 4243/4244 — NEXT_PUBLIC_USE_FIREBASE_EMULATOR=1
4. Seed demo canvas: buildDemoStorageSeeds() -> localStorage (S1 recipe), open
   /design?lat=-27.72623&lon=31.96304, sign in as test@imbewufield.local / testpass123
5. Renders enqueue to the EMULATOR Firestore/Storage; no worker runs. Complete jobs the way
   functions/src/index.ts does (per-sheet {status:'done', outputPath:'renders/{uid}/{jobId}/
   output-{key}.png'}, then job {status:'complete'}) with the Admin SDK against
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080; storage via the REST endpoint
   http://127.0.0.1:9199 with header 'Authorization: Bearer owner' (the admin bypass —
   the Admin SDK's own GCS client ignores the storage emulator and hangs).
6. Gotcha: input-{key}.jpg contains PNG bytes (data-URL upload) — sniff magic, don't trust
   the extension.
```

---

## 37. PRIORITY — one farmer's saved farm can silently write into another farmer's account on a shared device

Found live during a fresh-signup walkthrough (30 July, emulator). This jumps ahead of items 35/36
in urgency — it is a real cross-account data-integrity bug, proven with a clean repro, not a
quality issue. Read this before continuing 35 if you have a natural stopping point; if you're
mid-render on 35, finish that pass first (don't waste spent money mid-flight) and take this next.

**Proof (reproducible in 2 minutes on the emulator):**
1. Sign out of any account (or just have a browser that's ever had a farmer's data in it — see
   why below, this isn't a contrived setup).
2. `localStorage.setItem('permamap_saved_places', JSON.stringify([{id:'x', name:'FOREIGN PLOT', lat:-33.9, lon:18.4, ...}]))` — standing in for whatever the last real farmer on this device saved.
3. Sign up as a BRAND NEW account. Confirmed via Admin SDK: `user_map_data/{newUid}/data/places`
   does not exist — zero cloud data, genuinely fresh.
4. Open `/farmer` (mounts `components/Map.tsx`, which calls `subscribeUserMapData(uid, ...)`).
5. Check `user_map_data/{newUid}/data/places` again: **it now contains "FOREIGN PLOT"** — written
   by the reconcile transaction itself, permanently, under the new farmer's own uid.

**Root cause** — `lib/user-sync.ts`'s `subscribeUserMapData(uid, handlers)`, Phase 1 reconcile:
```js
const remote = data.places ?? [];                      // correctly scoped: doc path has {uid}
const local = readLocal<SavedPlace>(PLACES_KEY);        // NOT scoped: PLACES_KEY is a bare constant
const { items, deleted } = mergeItems(remote, local, ...);
localStorage.setItem(PLACES_KEY, JSON.stringify(items));
tx.set(placesRef, { places: items, deleted, updatedAt: serverTimestamp() });  // writes union to THIS uid's doc
```
`PLACES_KEY = 'permamap_saved_places'` (`lib/saved-places.ts:36`, re-declared `lib/user-sync.ts:11`)
carries no uid. Whatever the browser's local storage holds — genuinely the previous signed-in
farmer's real data, not a contrived attack — gets merged into whoever is signed in NOW and pushed
to their cloud record the moment the map mounts. `signOutUser` (`lib/auth.tsx:216`) calls Firebase
`signOut()` and clears React state only; it touches no local storage.

**This is not a places-only bug.** The same bare-constant pattern is confirmed on the sibling keys
read by the same reconcile function: `FARM_KEY = 'imbewu_farm_shapes'`, `WATER_KEY =
'imbewu_water_points'` (`lib/user-sync.ts:10-12`), and `DESIGN_STUDIO_KEY = 'imbewu_design_studio_v1'`
(`lib/user-sync.ts:90`). I only ran the live repro against places — verify shapes/water/design
each independently before assuming the fix covers them; each has its own reconcile block in
`subscribeUserMapData` and may behave slightly differently (the shapes block in particular has
different remote-authority semantics — read its comment before touching it).

**Real-world exposure**: this app's own UI targets shared/low-resource use — NGO field workers
demoing to multiple farmers on one tablet, a family or community device, an extension office
computer. That is exactly the scenario this bug fires in, silently, with no confirmation dialog.

**Your job**: fix the isolation, your choice of mechanism — options, not a mandate:
(a) scope every local-first key by uid (touches every read/write call site — the kind of
"second home" sweep item 33's `×N` fix needed), or
(b) track the last-signed-in uid in one small key; on any auth-state change where it differs,
clear the local-first keys before the next reconcile runs (one choke point, smaller diff, but
find every place sign-in/sign-out/account-switch can happen: `lib/auth.tsx`,
`components/AccountButton.tsx`, `components/Map.tsx`, `app/account/page.tsx`).
Whichever you pick, prove it the same way I did: inject foreign data, switch accounts, confirm the
new account's Firestore doc stays empty. Also check what a straight account-switch (not
sign-out-then-sign-in, if the UI has one) does — it may not go through the same path.

**Do not touch**: this doesn't overlap `DesignGlossy.tsx`/`lib/producer-prompt.ts` (item 35's
files) — safe to pick up in parallel or right after.

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
