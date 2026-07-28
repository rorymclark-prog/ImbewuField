# Codex work queue — ImbewuField

Read `AGENTS.md` first. It carries the verification commands, the ownership split, the guardrails
and — most importantly — **§5 LOOK AT WHAT YOU MADE**.

**How to work this queue.** Take the top unstarted item. One branch per item, named in the item.
Never push to `main`. When it is pushed, say so and stop; Claude reviews and merges, and reviewing
means opening a real render, not reading the diff. Then take the next one.

Every item below was verified to be real before it was written down — the numbers are measured, not
estimated. If you find one is already fixed or the premise is wrong, **say so and skip it**; that is
a useful result, not a failure.

---

## 1. Sheet 08 needs its own panel column — `codex/phasing-column`

**This one change fixes two separate problems, which is why it is first.**

Sheets 01–07 render as `map + legend column`. Sheet 08 draws its schedule panel *on top of* the map
instead, via `phasingPanelRect` in `components/design/DesignGlossy.tsx`.

**Problem A — the plan set does not print evenly.** On the Ubhejane demo, sheets 01–07 come out at
1.98:1 and sheet 08 at 1.53:1, because 08 has no column added to its width. `DesignPrint` letterboxes
each sheet into A4/A3, so the odd one gets a visibly different band of white.

**Problem B — sheet 08 can exceed the 3:1 AI limit.** `calculateBoundaryPresentationLayout` caps the
*sheet* at 3:1, and for 01–07 the legend column widens the sheet back toward square. Sheet 08 has no
column, so its **map aspect is its sheet aspect** and the cap never applies to it. Measured:

| plot | sheet 08 today | sheets 01–07 |
|---|---|---|
| 1:4 tall | **4.00:1 — over** | 2.74:1 |
| 1:6 tall | **4.45:1 — over** | 3.00:1 |
| 4:1 wide | 2.35:1 ok | 2.96:1 |

`gpt-image-2` rejects anything past 3:1, so `pickSize` in `functions/src/index.ts` silently falls
back to `'auto'` and the AI sheet comes back the wrong shape.

**The work:** widen sheet 08's canvas to `mapW + styleSheetLegendWidth(mapW)`, draw the map into the
left `mapW`, and put the schedule in the right column — structurally identical to every other sheet.

**The trap, and why this was not done already.** Every font in that panel is sized off *canvas*
width (`W * 0.0165`, `W * 0.0112`, `W * 0.0092` and friends, around line 6800). Widening the canvas
rescales the schedule type as a side effect. Separate `mapW` from the sheet width and keep the panel
type sized off the **panel**, then check the schedule still fits — six phases with chips, week
ranges and hold points, plus critical order and site rules.

**Also update together or the model sees real dates:** `buildImplementationMap`,
`composePhasingSheet`, `buildPhasingHybridInput`, `blankPhasingPanel`'s caller and
`buildPhasingProtectMask` all size themselves from `phasingSheetSize`. If the canvas changes shape,
the blank-out and the protect mask must move with it.

**Bump `PLAN_VERSION`** in the same commit or nobody who has already rendered a sheet will see any
of this — the cache keys on siteId + style + layer with no content hash.

**Verify by rendering**, not by tests: seed `buildDemoStorageSeeds()` from `lib/demo-farm.ts` into
localStorage, open `/design?lat=-27.72623&lon=31.96304`, go to the Glossy step, press
"All sheets — exact, no AI", and confirm sheet 08's aspect now matches 01–07 and the schedule is
readable. Then do it again for a long-thin boundary.

---

## 2. Map callout type does not scale with the sheet — `codex/callout-type-scale`

`components/design/DesignGlossy.tsx` line ~2326:

```ts
const fontSize = Math.max(19, Math.round(W * 0.011));
```

The floor wins at every realistic width, so callout type is effectively **fixed at 19px** no matter
how large or small the sheet is. That was harmless while every sheet was 1920px wide. Now that
sheets take the shape of the plot, a tall narrow farm renders a 744px-wide map where 19px type is
proportionally enormous, and a wide farm gets 2400px where it is small.

`lib/leader-labels.ts` already shrinks a label that would not fit its margin, so the overflow is
handled — this is about the type reading at a consistent *size relative to the sheet*.

Work out what the floor is actually protecting against (probably legibility on a phone preview) and
express that directly instead of as a hard 19. Check a square, a 3:1 wide and a 1:4 tall plot.

---

## 3. Do the other sheets collide their labels? — `codex/label-collision-audit`

`lib/leader-labels.ts` and `tests/leader-labels.test.ts` fixed callout placement for the **water**
sheet only, after a long name was found running off the sheet edge.

`lib/producer-labels.ts` is a separate, older engine used by the other sheets. Nobody has checked
whether it has the same class of bug. **Audit, then fix only what is real** — if it is sound, say so
and close the item.

Look for: a label drawn wider than the space its placement assumed; two labels overlapping at high
element density; a leader crossing another leader; a label over the legend or off the page. The
useful test is the one that would have caught the water bug: render at several canvas widths with
the longest names in the catalog (`GREYWATER DIVERTER & FILTER` is 27 characters) and assert nothing
lands outside the sheet.

---

## 4. The driveway-gate break has never been looked at — `codex/gate-break-verify`

`docs/RENDER-GEOMETRY-CLEANUP-TODO.md` records commit `c8ec653` as done, with the note "not yet
visually confirmed against a real render". A gate is supposed to create a measured break in the
drawn fence line, at the gate's real width and orientation.

Render it. The demo fixture has a traced driveway. If the break is wrong, missing, the wrong width or
in the wrong place, fix it; if it is right, update that line in the TODO doc so nobody re-checks it.

---

## 5. Render-only polygon polish — `codex/polygon-polish`

From `docs/RENDER-GEOMETRY-CLEANUP-TODO.md`, still open:

- Smooth visibly shaky polygon and line segments **in the exported illustration only**.
- Add restrained corner joining and antialiasing so exact polygons read as one clean plan shape.

**Saved geometry is never touched** — every stored vertex stays exactly as the farmer drew it. This
is paint-time only. Keep corners that communicate a real boundary, building or terrace break; the
goal is to remove hand-jitter, not to round a building into a blob.

Show a before/after of the same plot in the report.

---

## Not for Codex

- **Course content** — `docs/narration/*`, `lib/course-*.ts`, slides, audio, animations. Claude's
  lane, and `tests/narration-scripts.test.ts` enforces some of it.
- **A real Full Treatment render.** The paid-difference gate now covers every sheet, but only Rory
  can spend a paid render to exercise it.
- **Vegetables & Staples module 2.** Blocked on an isiZulu-speaking agronomist reviewing 22 coined
  terms — see `docs/narration/vegetables-staples.zu.md`. Not an engineering task.
