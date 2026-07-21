# Terraces, terrace-method recommendation, and the earthworks-layer question — spec, 2026-07-21

Provenance note, stated plainly rather than borrowed: this is not a 53-agent adversarial audit like
`SECTOR-MODEL-SPEC-2026-07-21.md`, or a 36-agent one like `EARTHWORKS-CONTEXT-PLAN-2026-07-21.md`.
It is one research + code-recon pass synthesizing four independently-produced research angles
(permaculture technique, geotechnical safety, KZN regional practice, and a decision-threshold
table that already cross-checked itself against the other three) against the app's actual code.
Where those four disagree or one is thin, that is said below, not smoothed over. Read
`EARTHWORKS-CONTEXT-PLAN-2026-07-21.md` first — its "no 9th sheet" decision is re-examined in §5,
not repeated blind, and its Phase 4 pattern (advisory tip, not auto-placement) is reused directly.

**§1's decision table went through one adversarial safety pass before this doc was committed**,
because it is going to be shown to a farmer with no engineer double-checking it, and the first
draft had a real, specific defect: row 5 (20–33% slope, the DIY-attemptable row closest to the
row-6 "don't dig at all" cliff) carried a *softer* `maybe` flag than the lower-risk rows 3–4's
`ask_local_expert` — an inverted risk gradient on exactly the row where literal misreading is most
consequential. That review found five further concrete problems (an unstated cumulative-height cap
that left room to stack past 2 m, a vetiver-sequencing hazard, false precision at the row 5/6
boundary, no escalation when an already-coarse whole-site-average slope itself lands in the highest
band, and no defined UI treatment for the flags at all). All six are fixed in place below, not
appended as a caveat — search this doc for "adversarially reviewed" to find each fix and its
reasoning.

## 0. What's actually being decided

The product owner's ask, unpacked into three requirements:

1. A farmer must be able to place/trace terraces and lower-level terraces in the Design Studio,
   and see them correctly on at least the **Site** (sheet 01) and **Sector** (sheet 02) sheets —
   matching the benchmark's ground labels ("UPPER LAWN TERRACE", "LOWER CLEARED GROUND", "3 m
   GRASSED BANK / LEVEL CHANGE") and its "TERRACE FALL" arrow (`design/benchmark/README.md:33,40`).
2. Given the slope at the point a farmer is terracing, the app must recommend the **right**
   method — not just hand over an unlabelled polygon tool — using the decision-threshold table in
   §1, which is itself a synthesis of FAO/USDA agricultural-engineering convention, IS 14458
   retaining-wall practice, SASRI's KZN sugarcane erodibility grading, and the KZN April-2022
   floods as the reason to stay conservative, not an invented number.
3. Whether this finally justifies a 9th "Earthworks" sheet, which `EARTHWORKS-CONTEXT-PLAN`
   already decided against once. §5 answers this again, on this feature's own facts, and the
   answer is still **no** — for a new reason specific to terracing, not a rerun of the old one.

**Constraints this design is boxed in by (confirmed against the code, not assumed):**

- **No per-point slope exists anywhere in the app.** `lib/elevation.ts:4-53` fits ONE plane from
  3 SRTM samples ~1 km apart, called once per site; `lib/sector.ts`'s `SectorSite.elevation` is one
  scalar set for the whole property. There is no API, cached value, or code path that answers
  "what's the slope at this specific traced ring." `docs/PLAN-SET-SPEC.md:77-79` and
  `ROADMAP.md:27` already name this gap for terrace *levels* specifically ("needs drone data.
  Parked pending decision") — §3 below gives the honest v1 scope instead of pretending to solve it.
- **No South African engineering code covers small-farm terrace safety.** SANS 10160-5 explicitly
  excludes slope/embankment/retaining-structure design from its scope (verified from the
  standard's own stated scope, GEOTECH-SAFETY research §2). Every numeric threshold in §1 is
  FAO/USDA/IS-14458 agricultural- and civil-engineering convention or a stated rule of thumb —
  never present it as a certified South African standard.
- **The existing `terrace` catalog element already means something else.** `lib/design-elements.ts:403-412`
  has `id: 'terrace'`, a point-placed 2.5 m × 10 m rect ("Terrace / Retaining Bank") — a short bank
  marker you drop and rotate, alongside `berm` (`:392-400`). This is a linear/marker system, not an
  area system, and it stays exactly as-is (§2 explains why the new work doesn't touch it).
- **`EARTHWORKS-CONTEXT-PLAN`'s "no 9th sheet" decision is a decision record, not a backlog** (its
  own line 4-5). Its cost accounting (~20 exhaustive sites, three prose Records, a Cloud Functions
  deploy) was about *placeable elements* moving between sheets. §5 checks whether ground fabric and
  sector annotations — what this feature actually adds — are even subject to that same cost, before
  concluding.
- **The benchmark's legend rows 8 (driveway access) and 9 (terrace fall) are open gaps**, per
  `design/benchmark/README.md:58` and `SECTOR-MODEL-SPEC-2026-07-21.md`'s own note that its
  `NamedWindSector` union doesn't cover either yet. This spec closes row 9 (terrace fall). Row 8
  (driveway access) is out of scope — flagged, not silently solved, in §7.

---

## 1. Decision-threshold table — slope % → recommended method

Synthesized from: FAO Watershed Management Field Manual bench-terrace bands (PERMACULTURE-TECHNIQUE
§0/§2), IS 14458 retaining-wall selection table (GEOTECH-SAFETY §1/§3), SASRI's confirmed
principle of grading by soil erodibility class even though its numeric nomograph output wasn't
retrievable (KZN-REGIONAL-PRACTICE §2), and the DECISION-THRESHOLDS table's own conservative push
for KZN residual-clay-over-rock soils, justified by the April 2022 KZN floods' documented
translational failures at exactly that soil/rock interface. Where DECISION-THRESHOLDS flagged a
number as its own extrapolation (the ~18°/33% "safe unsupported cut" line, the exact 5%/10%/20%
breakpoints), that is carried into the `sources` column below, not hidden.

| # | Slope range | Slope° | Method | Riser cap | Engineer flag | Why (cited) |
|---|---|---|---|---|---|---|
| 1 | 0–2% | 0–1.1° | Plant on contour — no earthworks | n/a | `no` | Sheet-erosion risk negligible at any soil type; slope too flat to concentrate runoff (DECISION-THRESHOLDS row 1; FAO 0–5% "plant on contour" band, PERMACULTURE-TECHNIQUE §0). |
| 2 | 2–5% | 1.1–2.9° | No earthworks — contour cultivation, cover crop/mulch | n/a | `no` | FAO's "gently sloping" threshold: sheet erosion becomes measurable under bare soil but is fully controlled by cover; contour orientation starts actively mattering (DECISION-THRESHOLDS row 2). |
| 3 | 5–10% | 2.9–5.7° | Vetiver hedge or grass strip on contour. A shallow swale (<~20 cm cut) is acceptable only with an armoured spillway. | swale cut ≤0.2 m | `ask_local_expert` | Conventional threshold (FAO/SA-extension convention, mirrored by SASRI) where unaided sheet flow starts concentrating into rills. KZN's convective-storm rainfall (KZN-REGIONAL-PRACTICE §4) means even a shallow swale needs a protected overflow — peak flows arrive fast on clay-over-rock. SASRI's own threshold for strip-cropping on cane is ≥2% slope (KZN-REGIONAL-PRACTICE §2), i.e. even more conservative than this row. |
| 4 | 10–20% | 5.7–11.3° | Contour bank / graded terrace, vetiver- or grass-stabilized riser. Keep the cut shallow and balance cut/fill on contour — do not bench yet. | cut ≤0.3–0.5 m | `ask_local_expert` | This is the USDA-NRCS terrace-standard range and where FAO shifts from vegetative-only to structural (PERMACULTURE-TECHNIQUE §2); it's also FAO's own stated floor for bench terracing (7°≈12%) — below that FAO explicitly says bench terracing is **not recommended**, use broadbase/graded terraces instead. On residual clay-over-rock, a deeper cut here starts probing the clay/saprolite–rock interface — the documented KZN hillslope failure plane once wet (DECISION-THRESHOLDS row 4, citing the April 2022 floods). |
| 5 | 20–33% | 11.3–18.3° | Bench terrace **with a mandatory retaining riser** — stone pitching, gabion for tougher/wetter sections, or a **mature, already-established (2–3 season) live vetiver hedge only — never cut the full bench and plant vetiver in the same season**, since a fresh hedge has ~zero retaining strength; terrace in stages behind an existing, established hedge instead, or use stone/gabion for the interim. Stack benches rather than one tall cut. | ≤0.6–1 m per lift; **2 m TOTAL stacked height across every lift on this riser is a hard ceiling, not per-lift** — beyond it, treat as row 6 (engineer required), regardless of how many lifts you split it into | `ask_local_expert` — and treat as row 6 if the total stacked height will exceed ~1 m, if there's any seepage or exposed rock, or if you're building in the wet season | This band sits at or above the conservative safe-unsupported-cut rule of thumb used for saturated residual/cohesive tropical soils (~1V:3H / 18°, DECISION-THRESHOLDS' own extrapolation, explicitly flagged as a rule of thumb not a KZN-engineered figure) — sitting this close to the row-6 failure threshold is why this row's flag was corrected from an earlier, weaker `maybe` up to `ask_local_expert`: a softer flag on the row closest to the failure boundary inverts the risk gradient against rows 3–4. FAO's bench-terrace band tops out at 25° (47% at the hand-built extreme, but this app caps its DIY recommendation at 33% — see the row-6 rationale). **The 2 m figure is this app's own cap and is what governs its advice** — IS 14458's ~4 m reference (GEOTECH-SAFETY §1/§3) is a broader civil-engineering data point about when gabion is generally preferred over dry stone, not a looser ceiling this app permits; do not read the two figures as alternatives. |
| 6 | >33% | >18.3° | **Do not cut or terrace without an engineer.** Leave under permanent vegetation / agroforestry, uncultivated, or use an engineer-designed retaining structure only. | n/a | `always` | Exceeds the conservative safe-unsupported-batter-angle rule of thumb for saturated residual soils. This is the gradient band where the April 2022 KZN floods produced widespread translational failures on exactly this soil profile — shallow residual soil over rock/saprolite acting as a slip plane once pore pressure builds (DECISION-THRESHOLDS row 6). Cultivation-driven earthworks here raises landslide risk to people/property downslope, not just crop loss. |

**On the FAO 25° vs this table's 33% cutoff:** FAO's own bench-terrace band for hand-built work runs
to 25° (≈47%), i.e. wider than this table's row 6 cutoff of 18.3° (33%). This table deliberately
stops recommending a DIY method 7° earlier than FAO's own ceiling, because DECISION-THRESHOLDS'
conservative push is specific to this app's likely KZN residual-clay-over-rock context and its
sourced failure history — not because FAO's number is wrong in general. **Do not "correct" row 6
back to 25° without re-deriving it for whatever region a given design actually sits in** — see the
regional-gate note below.

**False precision at the row 5/row 6 boundary — adversarially reviewed, fix required.** The internal
lookup table keeps the 11.3°/18.3° (20%/33%) boundaries at one decimal place so
`recommendTerraceMethod` stays a deterministic, testable pure function — that precision is fine in
code. It is NOT fine on screen: the doc itself states this cutoff is "DECISION-THRESHOLDS' own
extrapolation," a rule of thumb, not a KZN-engineered figure — yet a naive UI would show a farmer at
32% slope calm DIY-permissive row-5 copy and a farmer at 34% a hard row-6 stop, a distinction the
source data cannot actually support to the percentage point. **On-screen copy must round to whole
degrees/5%-bands and treat the boundary as a zone, not a line**: *"Treat anything from roughly 25–35%
slope as the steeper band — this line isn't precise enough to trust to the percentage point. If
you're unsure which side of it you're on, that uncertainty itself is the answer: get it checked."*
This applies only to displayed copy; `TERRACE_METHOD_TABLE`'s stored boundaries stay exact so the
function and its tests remain deterministic.

**Region gating — do not ship this table nationally without a caveat.** Exactly the same problem
`SECTOR-MODEL-SPEC-2026-07-21.md` §3 solved for wind sectors applies here: SASRI's own erodibility
grading (KZN-REGIONAL-PRACTICE §2) shows the same slope % should trigger different conservatism by
soil class, and DECISION-THRESHOLDS' conservative push is explicitly reasoned from KZN's residual
clay-over-rock profile and its convective-storm rainfall regime (KZN-REGIONAL-PRACTICE §4), not
from a national soils survey. **v1 ships this exact table nationally, with a footer disclaimer**
(below) rather than inventing a second, unresearched table for e.g. the Western Cape's frontal
winter-rainfall regime, which behaves differently (lower peak intensity, different failure
timing). This is the same honest choice `SECTOR-MODEL-SPEC` made for wind — ship one sourced
region, disclaim the rest, don't extrapolate silently.

### Mandatory on-screen footer (every time a recommendation is shown)

> **Regional note:** these thresholds are tuned conservative for KwaZulu-Natal's clay-over-rock
> hillslopes and high-intensity summer storms. No South African engineering code covers small-farm
> terrace safety — SANS 10160-5 explicitly excludes slope and retaining-wall design from its scope.
> These numbers come from FAO/USDA agricultural-engineering practice and general geotechnical rules
> of thumb, not a certified local standard. **Always confirm locally before cutting**, and treat an
> "ask a local expert" row as a hard prompt to do so, not a formality.

### `EngineerFlag` → required UI treatment (adversarially reviewed, added — was unspecified)

Reviewed and found wanting: the spec named the flag values but never said how they must look, and
on a table where the row closest to the failure boundary (row 5) had the softer of two escalating
flags, that omission is not cosmetic — an implementer who renders every flag the same weight ships
the highest-risk DIY-attemptable row looking exactly as calm as the safest one. Three flags remain
after row 5's correction below (`maybe` is retired — every row now escalates cleanly no → ask →
always, and nothing used `maybe` once row 5 was fixed):

| `EngineerFlag` | Rows | Required UI treatment |
|---|---|---|
| `no` | 1, 2 | No banner. Method + why shown plainly. |
| `ask_local_expert` | 3, 4, 5 | **Persistent amber banner**, not a dismissible tooltip — stays visible while this row's copy is shown, every time, not just first-view. Row 5's banner additionally renders its escalation clause (height/seepage/wet-season → treat as row 6) in the same banner, not a separate collapsed note. |
| `always` | 6 | **Blocking red banner** the farmer must actively dismiss (not auto-hide, not click-through-the-map) before the rest of the terrace-tools UI on that ring is usable. |

### Data model

```ts
// lib/terracing.ts — new file
export type TerraceMethod =
  | 'contour_planting'
  | 'contour_cover'
  | 'vetiver_hedge'
  | 'contour_bank'
  | 'bench_terrace_retained'
  | 'no_dig_engineer_required';

// 'maybe' was retired during adversarial review of this spec: row 5 originally carried it, which
// was a SOFTER flag than rows 3-4's 'ask_local_expert' despite row 5 sitting closer to the row-6
// failure threshold — an inverted risk gradient on the row a farmer is most likely to act on
// literally (row 6 says don't dig at all; row 5 doesn't). Never reintroduce a flag weaker than
// 'ask_local_expert' for any row above row 2 without re-running that review.
export type EngineerFlag = 'no' | 'ask_local_expert' | 'always';

export interface TerraceMethodRow {
  minPct: number;
  maxPct: number | null; // null = no upper bound (row 6)
  method: TerraceMethod;
  label: string;         // farmer-facing method name, e.g. 'Bench terrace with retaining riser'
  why: string;           // one-line grounded reason, shown under the label
  riserCapM: number | null;
  engineerFlag: EngineerFlag;
  copy: string;          // the exact sentence shown on screen (see table above)
  sources: string[];     // citation keys, e.g. ['FAO-bench-terrace', 'DECISION-THRESHOLDS-row5']
}

export const TERRACE_METHOD_TABLE: TerraceMethodRow[]; // the 6 rows above, verbatim

/** Pure lookup — no site/network dependency. Clamps negative input to row 1, treats >100 as row 6. */
export function recommendTerraceMethod(slopePct: number): TerraceMethodRow;
```

### Worked examples (unit-test shape)

```
recommendTerraceMethod(1.5)  → row 1: 'contour_planting',        engineerFlag 'no'
recommendTerraceMethod(4.0)  → row 2: 'contour_cover',            engineerFlag 'no'
recommendTerraceMethod(7.5)  → row 3: 'vetiver_hedge',            engineerFlag 'ask_local_expert'
recommendTerraceMethod(15.0) → row 4: 'contour_bank',             engineerFlag 'ask_local_expert'
recommendTerraceMethod(25.0) → row 5: 'bench_terrace_retained',   engineerFlag 'ask_local_expert'
recommendTerraceMethod(40.0) → row 6: 'no_dig_engineer_required', engineerFlag 'always'
recommendTerraceMethod(10.0) → boundary case, inclusive-low: row 4 (10–20% band), not row 3
recommendTerraceMethod(-2.0) → clamps to row 1 (defensive; a farmer typo or bad sign shouldn't 500)
```

---

## 2. Data model addition

**Decision: reuse `ZoneShape`/`GroundFeatureKind` for terrace platforms; add exactly one new
ground kind for the riser itself; add two optional numeric fields.** Reasoning: the benchmark's
"UPPER LAWN TERRACE" and "LOWER CLEARED GROUND" are not a new kind of thing — they are existing
ground fabric (`lawn`, `cleared`) that happens to sit at a different level. The only genuinely new
*kind* of ground in the reference is the riser band itself: "3 m GRASSED BANK / LEVEL CHANGE"
(`design/benchmark/README.md:40-41`) — a distinct area between two platforms, not a platform. The
existing point-placed `terrace`/`berm` catalog elements (`lib/design-elements.ts:392-412`) stay
untouched — they're the right tool for a short bank segment placed on a print sheet, not for
tracing an irregular riser face across a site.

```ts
// lib/design-canvas.ts:43 — extend the union
export type GroundFeatureKind =
  | 'house' | 'patio' | 'driveway' | 'lawn' | 'veg_garden' | 'orchard' | 'cleared' | 'boundary'
  | 'terrace_bank'; // NEW — the retained/graded riser face between two levels

// lib/design-canvas.ts:45-60 — extend ZoneShape
export interface ZoneShape {
  id: string;
  zone: 0 | 1 | 2 | 3 | 4 | 5;
  points: Array<[number, number]>;
  feature?: GroundFeatureKind;
  name?: string;
  labelDx?: number;
  labelDy?: number;
  // NEW — farmer-entered signed level in metres, relative to a site datum the farmer picks
  // (house-floor-level = 0.0 is the obvious default, but it's whatever the farmer typed against).
  // Only meaningful when `feature` is set; independent of WHICH kind — a lawn, a veg garden, an
  // orchard platform, or a terrace_bank riser can each carry one. Optional so it stays JSON-safe
  // and survives migrateStateToFrame's spread untouched, same reasoning as `feature` itself
  // (comment at design-canvas.ts:46-48).
  levelM?: number;
  // NEW — an optional farmer-PACED slope measurement (%) for this specific ring, used ONLY when
  // feature === 'terrace_bank'. When present, §3's effective-slope function prefers this over the
  // whole-site SRTM average, because it is the farmer's own on-site measurement of the exact spot,
  // not a ~1 km-baseline approximation. Absent by default — most farmers won't pace a slope, and
  // the whole-site fallback (§3) must degrade honestly, not silently assume a farmer input exists.
  measuredSlopePct?: number;
}
```

```ts
// lib/design-elements.ts:85-94 — extend GROUND_FEATURES
export const GROUND_FEATURES: Record<GroundFeatureKind, { label: string; color: string; icon: string }> = {
  // …existing 8 entries unchanged…
  terrace_bank: { label: 'Terrace bank / level change', color: '#8A6D3B', icon: '🪜' },
};
```

```ts
// components/design/DesignGlossy.tsx:2442 — add to the HARD (hatched, not washed) set
const HARD = new Set<GroundFeatureKind>(['patio', 'cleared', 'terrace_bank']);
```

**Why hatched, not a flat wash:** `HARD` currently means "surface, not vegetation" per its own
comment (`:2440-2441`, "Hard / bare surfaces read as SURFACE, not vegetation, so they take a hatch
instead of a solid wash"). A terrace riser is structurally a cut/retained face — even when its
surface finish is grass, it is not open cultivable ground the way an adjoining lawn platform is —
so it should read visually distinct from the flat platforms on either side of it, which is the
whole point of showing a terrace at all. This is a judgment call, flagged as one, not a fact pulled
from the benchmark image (the benchmark's own bank row does show a hatched/textured band distinct
from the flat lawn/cleared-ground fills either side of it).

### Content/context register — confirmed no change needed

`groundRegister` (`lib/glossy-filters.ts:128-131`) is keyed on `GlossyLayerFilter`, not on the
specific `GroundFeatureKind`:

```ts
export function groundRegister(kind: GroundFeatureKind, filter: GlossyLayerFilter): GroundRegister {
  if (kind === 'boundary') return 'absent';
  return filter === 'all' || filter === 'planting' || filter === 'structures' ? 'content' : 'context';
}
```

Adding `'terrace_bank'` to the union is automatically covered by the `!== 'boundary'` branch — it
lands on `'content'` for whole-design/Planting/Structures and `'context'` elsewhere, exactly like
`lawn` or `orchard` today. **No edit to this function.** Same for `layerContentCount`
(`lib/glossy-filters.ts:137-157`, counts via `groundRegister(...) === 'content'`) and
`drawBlueprintGround`'s biggest-ring-first sort/donut-nesting (`DesignGlossy.tsx:2415-2479`,
`groundFillPolys` in `lib/design-canvas.ts`) — both are already generic over `GroundFeatureKind`.

### Per-sheet membership — confirmed no change needed, and this is why §5 answers "no" again

`sheetForElement` (`lib/glossy-filters.ts:49-64`) and its `SHEET_OVERRIDE` table govern **placed
elements** (`PlacedItem`, keyed by `category`/`defId`) — a completely separate path from ground
features (`ZoneShape.feature`, governed only by `groundRegister`). The new `terrace_bank` ground
kind never touches `sheetForElement`, `SHEET_OVERRIDE`, `LEGEND_BY_SHEET`, `SHEET_NO`, or
`ICON_KEYS_BY_SHEET` — the four sites `EARTHWORKS-CONTEXT-PLAN` costed a 9th sheet against. This
feature adds zero new placeable-element category members; the existing `terrace`/`berm` catalog
elements keep routing to `'water'` exactly as before. See §5 for why this matters to the earthworks-
sheet decision.

---

## 3. Slope at the point a farmer is terracing

**Confirmed gap, not assumed:** `lib/elevation.ts:4-53` fits one plane from 3 SRTM samples ~1 km
apart, called once per site (not per shape); `SectorSite.elevation` is one scalar set
(`slopeDeg`/`slopePct`/`aspectDeg`/`aspectLabel`) for the whole property. There is no per-point or
per-polygon slope/elevation query anywhere in the codebase. Building one would mean either (a) a
real per-point DEM query per drawn ring — still SRTM 30 m-class resolution, i.e. still too coarse
to resolve a farm-scale terrace, and explicitly parked pending drone-scale data
(`ROADMAP.md:27`) — or (b) fabricating a fake precision the data can't support. **Neither is v1
scope.**

### v1 scope: whole-site slope, with a farmer override, both clearly labelled

```ts
// lib/terracing.ts — new function
export interface EffectiveSlope {
  pct: number;
  source: 'measured' | 'whole-site-average';
}

/** Resolves the slope to use for a terrace_bank ring's method recommendation:
 *  1. z.measuredSlopePct if the farmer entered one for THIS ring — 'measured'.
 *  2. site.elevation.slopePct (the same whole-site SRTM plane sector.ts already uses) — 'whole-site-average'.
 *  3. If neither exists, recommendTerraceMethod cannot run — the UI must show the
 *     "walk the site and pace the slope, or open this place on the map to fetch it" prompt
 *     lib/sector.ts:70-72 already uses for the analogous missing-data case, not a silent default. */
export function effectiveSlopeForRing(
  ring: Pick<ZoneShape, 'measuredSlopePct'>,
  site: SectorSite | null | undefined,
): EffectiveSlope | null {
  if (ring.measuredSlopePct != null) return { pct: ring.measuredSlopePct, source: 'measured' };
  if (site?.elevation?.slopePct != null) return { pct: site.elevation.slopePct, source: 'whole-site-average' };
  return null;
}
```

**Mandatory on-screen caveat whenever `source === 'whole-site-average'`** (never omit — this is the
single most important disclosure in the whole feature, because a terrace built on a locally-steeper
pocket of a gentle-average site is exactly the failure mode the whole decision table exists to
prevent):

> This uses your whole-site average slope (**{slopePct}%**), not the exact slope at this spot.
> Walk to the spot and check it isn't steeper before you build — a bank on a locally steeper pocket
> needs the NEXT row's method, not this one.

**Escalate, don't just caveat, when the average itself already lands in row 5 or 6 — adversarially
reviewed, added.** The generic caveat above is passive and identical regardless of which row it's
attached to. But `source === 'whole-site-average'` **and** the resulting row being 5 or 6 is the
single highest-uncertainty, highest-consequence combination in this whole feature: a farmer on an
uneven hillside whose average already reads steep is likely to have local pockets steeper still.
When that combination occurs, render the row-5/6 banner (per the `EngineerFlag` UI table above)
with this additional line, not the generic caveat alone:

> Your whole-site average is already in the steepest band this app recommends against DIY-cutting.
> On an uneven hillside, parts of this slope are very likely steeper than the average. Get this
> specific spot checked by a local expert before you cut anything here.

When `source === 'measured'`, drop the whole-site caveat (it's the farmer's own on-site number) but
keep the §1 regional footer and the row's own `EngineerFlag` banner unchanged.

**How the farmer enters a measured slope:** extend the existing inline-rename control
(`components/design/DesignCanvas.tsx:476-478` `editingLabelId`/`editingText` state,
`commitLabelEdit` at `:977-989`) with a second small numeric field, shown only when
`shape.feature === 'terrace_bank'`: "Slope here (%) — pace it with a stick and string, or leave
blank to use the whole-site average ({site.elevation.slopePct ?? '—'}%)." Same commit pattern as
`commitLabelEdit`: write `measuredSlopePct` through `onChange` alongside `name`, no new modal, no
new interaction paradigm. The `levelM` field (§2) gets the same treatment, shown for ANY
`shape.feature`, not just `terrace_bank`: "Level here (m) — e.g. 0.0 for your reference point,
−3.0 for a platform 3 m lower."

**Not solved here, stated plainly:** there is no way for the app to know a farmer's paced
measurement is correct, or that the whole-site average is representative of a specific point on a
real, uneven KZN hillside. This is inherent to the data the app has, not a bug to fix later — see §7.

---

## 4. Rendering — Site, Sector, and the new terrace-fall annotation

### 4a. Ground fabric — platforms and the riser, on Site (sheet 01) and Sector (sheet 02)

**Fill/hatch:** already covered — `drawBlueprintGround` (`DesignGlossy.tsx:2415-2479`) needs no
change beyond the `HARD` set edit in §2; it is already generic over `GroundFeatureKind`, sorts
biggest-ring-first, and nests correctly (`groundFillPolys`).

**Name + level labels — the actual gap, and where it lives today:**
`groundLabelsForSheet` (`DesignGlossy.tsx:2839-2875`) is the function that produces exactly the
benchmark's naming style ("UPPER LAWN TERRACE", "LOWER CLEARED GROUND" — its own comment cites
those names verbatim). **It is called from exactly one place today**: `buildBlueprintSectorMap`
(`DesignGlossy.tsx:4119`), i.e. **sheet 02 (Sector) only**. Sheet 01 ("Existing site & base") is
built via the generic `buildComposite` → `drawMarks` path (`DesignGlossy.tsx:827`, call site at
`:850`), whose traced-ground block (`:573-637`) paints fills only — "NOT gated on drawDesign… Fill
only, at low alpha, with no stroke and no glyph" per its own comment. **Sheet 01 currently has zero
ground name labels.** This is exactly the gap `PLAN-SET-SPEC.md:14,77-79` already names for sheet
01's "Terrace Base" subtitle.

Two changes:

1. **Add the level suffix inside `groundLabelsForSheet`** (`DesignGlossy.tsx:2860`), before the
   per-name dedup filter:
   ```ts
   const levelSuffix = z.levelM != null ? ` ${z.levelM >= 0 ? '+' : ''}${z.levelM.toFixed(1)}M` : '';
   const text = (z.name ?? MAP_NAME[z.feature!] ?? GROUND_FEATURES[z.feature!].label).toUpperCase() + levelSuffix;
   ```
   **This also fixes a latent bug for exactly this use case**: the existing
   `.filter((r, i, all) => all.findIndex((o) => o.text === r.text) === i)` (`:2867`, "One row per
   NAME: two lawns are one label, or the margin fills with repeats") would otherwise collapse an
   upper `lawn` platform and a lower `lawn` platform into a single label — which is precisely wrong
   when the whole point is showing two platforms at different levels. Appending `levelM` to `text`
   before that dedup runs means two same-kind platforms at different levels now correctly produce
   two distinct labels, and two same-kind platforms at the SAME level (a real duplicate) still
   correctly collapse to one.

2. **Wire the same label-pill call into sheet 01.** Inside `drawMarks` (called from
   `buildComposite:850`), immediately after the traced-ground wash block (`:573-637`), add:
   ```ts
   if (!drawDesign && filter === 'all') {
     drawBlueprintLabelPills(ctx, groundLabelsForSheet(state, refLayers, imgW, imgH));
   }
   ```
   gated exactly on the parameters sheet 01's own call site already passes
   (`buildComposite(state, frame, refLayers, 'all', false)`, `DesignGlossy.tsx:5430`), so this
   never fires on the AI-composite paths that reuse `buildComposite` with `drawDesign: true` or a
   narrower `filter`.

### 4b. Terrace-fall annotation on the Sector sheet

**What exists today:** `drawSectorAnalysis` (`DesignGlossy.tsx:3746-3958`) draws one whole-site
downhill arrow (`model.water`, §7 in its own numbered comments) labelled "WATER FLOWS DOWNHILL" —
no separate "TERRACE FALL" arrow or drop/grade figure exists. **What's specified but unbuilt:**
`SECTOR-MODEL-SPEC-2026-07-21.md` §5 (lines 202-211) already designs a *whole-site* terrace-fall
annotation — 3 or 5 parallel arrows at the same `water.downhillBearingDeg`, legend row 8 (later
renumbered 9 per the benchmark transcription) — but that whole spec is itself unimplemented
(`SECTOR-MODEL-SPEC-2026-07-21.md:5`, "Everything below §1 is unimplemented"), and it is a
*decorative*, whole-site claim, not a per-terrace measurement.

**This spec adds a different, narrower thing: a per-terrace fall/grade label, computed from what
the farmer actually drew and entered — not from the whole-site plane.** It is compatible with
either sector implementation (today's single-arrow version or the future parallel-arrows version)
because it anchors to the terrace geometry itself, not to the sheet-wide bearing.

```ts
// New function in components/design/DesignGlossy.tsx, called from drawSectorAnalysis
// immediately after the "7. WATER" block (:3900-3958) and before the frost block, so it
// shares drawArrow/labelAt/claimed[] collision-avoidance already in scope.
function drawTerraceFallAnnotations(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
  drawArrow: (fromVec: [number, number], color: string, width: number, dash: number[], lenIn?: number) => { sxp: number; syp: number },
  labelAt: (x: number, y: number, text: string, color: string) => void,
): void {
  const terraces = state.zones.filter((z) => z.feature && z.levelM != null && z.points.length >= 3);
  // Pair every ring with every OTHER ring at a different level, biggest-drop pairs first, and only
  // draw the strongest pair per ring so two platforms never grow a web of redundant arrows.
  const drawn = new Set<string>();
  for (const upper of terraces) {
    for (const lower of terraces) {
      if (upper.id === lower.id || upper.levelM! <= lower.levelM!) continue;
      if (drawn.has(upper.id) || drawn.has(lower.id)) continue;
      const [ux, uy] = centroidOf(upper.points), [lx, ly] = centroidOf(lower.points);
      const runM = Math.hypot((ux - lx) * frame.imgW, (uy - ly) * frame.imgH) / pxPerM;
      const dropM = upper.levelM! - lower.levelM!;
      if (runM < 0.5) continue; // degenerate/overlapping rings — don't divide by ~0
      const gradePct = Math.round((dropM / runM) * 100);
      const ang = Math.atan2(py(ly) - py(uy), px(lx) - px(ux));
      drawArrow([Math.cos(ang), Math.sin(ang)], '#3A8EC4', Math.max(3, ctx.canvas.width * 0.004), [10, 6], 0);
      labelAt(
        (px(ux) + px(lx)) / 2, (py(uy) + py(ly)) / 2,
        `TERRACE FALL — ${dropM.toFixed(1)} m over ${runM.toFixed(0)} m (${gradePct}%)`,
        '#8FC4E8',
      );
      drawn.add(upper.id); drawn.add(lower.id);
    }
  }
}
```

**Legend slot:** this is legend row 9 in the benchmark's own numbering
(`design/benchmark/README.md:33`, "curved down arrow (blue) — Terrace fall — upper to lower
platform") and row 8/9 in `SECTOR-MODEL-SPEC`'s draft numbering (§4 there already reserves this
slot: "8 TERRACE FALL + contour interval (computed, uniform-fall model)"). Add a row only when
`drawTerraceFallAnnotations` actually draws at least one pair — never a placeholder row for a
design with no terraces, matching the existing rule that "rows for absent sectors are omitted
entirely" (`SECTOR-MODEL-SPEC-2026-07-21.md:238`).

**Provenance of this number, stated on the sheet:** `{dropM} m over {runM} m` is **computed** —
`dropM` from the farmer's own `levelM` entries, `runM` from the farmer's own traced ring positions
and the frame's `mPerPx`. It is not a survey and not SRTM-derived; the caption should read
`TERRACE FALL (from your entered levels) — …` so a farmer doesn't mistake it for a measured survey
figure the app pulled from somewhere authoritative.

**Worked example:** upper ring centroid at normalised (0.42, 0.30), `levelM: 0.0`; lower ring
centroid at (0.58, 0.55), `levelM: -3.0`; frame 960×640 px, `pxPerM = 8` (i.e. 8 px/m). Pixel
distance = `hypot((0.58-0.42)*960, (0.55-0.30)*640)` = `hypot(153.6, 160)` ≈ 221.7 px →
`runM = 221.7 / 8 ≈ 27.7 m`. `dropM = 0 - (-3.0) = 3.0`. `gradePct = round(3.0/27.7*100) = 11%`.
Label: `TERRACE FALL (from your entered levels) — 3.0 m over 28 m (11%)`.

---

## 5. The earthworks-layer decision — still no, for a new reason

**Decision: no 9th "Earthworks" sheet. This feature does not change `EARTHWORKS-CONTEXT-PLAN`'s
conclusion — it reinforces it, because everything this feature adds lives entirely outside the
mechanism that made a 9th sheet expensive in the first place.**

`EARTHWORKS-CONTEXT-PLAN-2026-07-21.md`'s cost accounting (10 elements, 5 surviving
`SHEET_OVERRIDE`, ~20 exhaustive sites, three prose Records, a Cloud Functions deploy, a rules
edit, a print-set renumber) is entirely about **placed elements** — `PlacedItem`s keyed by
`category`/`defId`, routed by `sheetForElement`/`SHEET_OVERRIDE`, captioned via
`LEGEND_BY_SHEET`/`SHEET_NO`/`ICON_KEYS_BY_SHEET`. This feature adds **zero** new placeable-element
category members: the existing `terrace`/`berm` catalog elements are untouched and keep routing to
`'water'`. What this feature actually adds are:

- one new **ground kind** (`terrace_bank`), governed only by `groundRegister` — a function keyed on
  `GlossyLayerFilter`, not on `GroundFeatureKind`, which per §2 needs **no edit at all** to absorb it;
- two new **farmer-entered fields** (`levelM`, `measuredSlopePct`) on `ZoneShape`, which carry no
  sheet-membership question at all — they're attributes of a ring that already has one;
- one **sector-sheet-only computed annotation** (`drawTerraceFallAnnotations`), which lives inside
  `drawSectorAnalysis` and is not a placeable element with a sheet-membership question either;
- one **advisory tip** (§1's recommendation), which per `EARTHWORKS-CONTEXT-PLAN` Phase 4's own
  precedent ("extend the existing advisor, not the canvas" — `lib/design-rules.ts:248-264`) is text
  shown in the Design Studio UI, not a printed sheet element at all.

None of these four things was ever a candidate for a 9th sheet, because none of them is a member of
the `category`-keyed placeable-element system the old decision's cost accounting was actually
about. The product owner's phrase "earthworks layer" describes a *mental model* — "make terracing
visible as its own thing" — that this spec satisfies through ground fabric (visible on Site and
Sector, per §4a), a sector annotation (§4b), and an advisory tip (§1/§6), all riding on machinery
that already exists and already generalizes, without a new `RenderLayer`, a new `GlossyLayerFilter`
member, a new API-side theme, or a new print-set page. **If a future ask specifically wants
terracing broken out as its own numbered, captioned PRINT SHEET** (as opposed to visible-on-existing-
sheets, which is what was actually asked for here), that is a materially different, larger request —
re-open this question then, against that specific ask, rather than reusing this reasoning by
default.

---

## 6. File-by-file change list, in implementation order

1. **`lib/design-canvas.ts`** — extend `GroundFeatureKind` union (`:43`) with `'terrace_bank'`; add
   `levelM?: number` and `measuredSlopePct?: number` to `ZoneShape` (`:45-60`).
2. **`lib/design-elements.ts`** — add the `terrace_bank` entry to `GROUND_FEATURES` (`:85-94`).
3. **`lib/terracing.ts`** (new file) — `TerraceMethod`, `EngineerFlag`, `TerraceMethodRow`,
   `TERRACE_METHOD_TABLE` (§1's 6 rows), `recommendTerraceMethod()`, `EffectiveSlope`,
   `effectiveSlopeForRing()` (§3). Pure, no DOM — same rule `lib/sector.ts` and `lib/phasing.ts`
   already follow (`lib/sector.ts:6`, "Pure, no DOM; lib/ never imports components/").
4. **`components/design/DesignGlossy.tsx`**:
   a. `:2442` — add `'terrace_bank'` to the `HARD` set.
   b. `:2860` — add the `levelM` suffix inside `groundLabelsForSheet`, before the dedup filter (§4a).
   c. `drawMarks` body, after `:637` — wire `groundLabelsForSheet` + `drawBlueprintLabelPills` into
      sheet 01's path, gated on `!drawDesign && filter === 'all'` (§4a).
   d. New `drawTerraceFallAnnotations` function, called from inside `drawSectorAnalysis`
      immediately after its "7. WATER" block (`~:3900-3958`), before the frost block (§4b).
   e. Legend-row builder (wherever the Sector sheet's numbered legend rows are assembled,
      alongside the existing 6-row list referenced in `design/benchmark/README.md:47`) — add the
      "TERRACE FALL" row, gated on `drawTerraceFallAnnotations` having drawn at least one pair.
5. **`components/design/DesignCanvas.tsx`** — extend the inline rename editor
   (`editingLabelId`/`editingText` state at `:476-478`, `commitLabelEdit` at `:977-989`) with:
   a. a "Level (m)" numeric input, shown whenever `shape.feature` is set (any kind), writing
      `levelM` through the same `onChange` pattern;
   b. a "Slope here (%)" numeric input, shown only when `shape.feature === 'terrace_bank'`, writing
      `measuredSlopePct`, with the whole-site average shown inline as a hint/placeholder.
6. **`lib/design-rules.ts`** — extend the existing advisory-tip mechanism
   (`:248-264`, the `banana_circle` proximity-tip pattern `EARTHWORKS-CONTEXT-PLAN` Phase 4 already
   named as "the right home") with a new rule: when a `terrace`/`berm` catalog element is placed,
   OR a `terrace_bank` ground ring is completed, call `effectiveSlopeForRing` +
   `recommendTerraceMethod` and surface the result as a tip — never a blocking gate, per the whole
   app's existing pattern of disclosure over restriction (e.g. `SECTOR-MODEL-SPEC`'s "null is a
   valid, shippable outcome" philosophy, `SECTOR-MODEL-SPEC-2026-07-21.md:162`).
7. **Sector legend row list / `SECTION_BY_ID`-equivalent** — do **not** add a new membership table;
   reuse whichever single list already drives the Sector sheet's rows (`EARTHWORKS-CONTEXT-PLAN`'s
   own "do not build a second membership table" rule, line 68, applies here too).

---

## 7. What is NOT being solved

- **This is not an engineering sign-off, and never claims to be one.** No South African code
  covers this exact scenario (GEOTECH-SAFETY §2, confirmed by SANS 10160-5's own stated scope
  exclusion). Rows 3-5 of §1's table say "ask a local expert" and row 6 says "always" engineer, for
  exactly this reason — the app can point a farmer at the right conservatism band, it cannot certify
  a specific cut safe.
- **No real per-point slope.** §3's whole-site-average fallback is an honest approximation, not a
  fix — the farmer-paced override is the only way to get a genuinely local number, and even that is
  a single stick-and-string measurement, not a survey. A true per-point terrain model needs
  drone-scale data and is explicitly parked (`ROADMAP.md:27`).
- **No soil-erodibility grading.** SASRI's confirmed principle — grade the same slope % differently
  by erodibility class — is NOT implemented in v1. The app has only a free-text `soilType` string
  per biome (`lib/types.ts:11`, `lib/biome.ts:12` etc., e.g. "Red/yellow sandy clay loams, often
  shallow to bedrock"), never designed as a structured erodibility class, and mapping prose to a
  class without an agronomist's sign-off would be exactly the kind of invented precision this whole
  spec is trying to avoid. Surfacing that prose string as a caveat alongside the recommendation
  (not folding it into the row selection) is the honest v1 scope; a real erodibility class is a v2
  candidate requiring either a new structured field or a sourced mapping, agronomist-reviewed.
- **No construction-material differentiation.** The catalog doesn't grow separate "gabion terrace"
  vs "vetiver-only terrace" vs "dry-stone terrace" elements — §1's `why`/`copy` text names the
  construction options in prose; a farmer picks the actual material off-app.
- **Driveway-access sector (benchmark legend row 8) is untouched.** Still an open gap per
  `design/benchmark/README.md:58` — a separate piece of work, not folded into this spec because it
  has nothing to do with terracing.
- **The full `SECTOR-MODEL-SPEC-2026-07-21.md` §5 whole-site parallel-arrow implementation is still
  unimplemented.** §4b's per-terrace annotation is designed to coexist with either today's
  single-arrow sector engine or that future version, but this spec does not implement that other
  document's own remaining work.
- **Regional scope is KZN-tuned and says so on-screen** (§1's mandatory footer) — it is not
  re-derived for the Western Cape's frontal winter-rainfall regime or any other South African
  region. Extrapolating it silently to a design outside KZN would repeat exactly the mistake
  `SECTOR-MODEL-SPEC-2026-07-21.md` §3 already corrected for wind sectors.
