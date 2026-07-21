# Sector Analysis (sheet 02) — model spec, 2026-07-21

53 agents, every finding adversarially verified: 23 confirmed, 25 refuted. The three §0 defects
were live on shipped sheets; the fire one is fixed in 4e6eaae, the other two are OPEN.
Everything below §1 is unimplemented.

# SHEET 02 — SECTOR ANALYSIS: IMPLEMENTATION SPEC

Files: `/Users/roryclark/ImbewuField/lib/sector.ts` (engine), `/Users/roryclark/ImbewuField/components/design/DesignGlossy.tsx:3746-3958` (`drawSectorAnalysis`), `/Users/roryclark/ImbewuField/lib/contours.ts`, `/Users/roryclark/ImbewuField/lib/elevation.ts`, new `/Users/roryclark/ImbewuField/lib/solar.ts`, new `/Users/roryclark/ImbewuField/lib/regional-wind.ts`.

---

## 0. THREE THINGS THAT MUST BE FIXED BEFORE ANYTHING IS ADDED

These are live defects on the shipped sheet. Enriching around them multiplies the error.

**0.1 — The fire sector points at KZN's wettest, coolest wind. Delete the derivation.**
`lib/sector.ts:90` sets `fire = windWinter` for summer-rainfall sites. At the reference site NASA POWER WD10M JJA = JUN 260.3°, JUL 247.3°, AUG 211.6°; circular mean 240.0° → `aspectLabel` → `WSW`. `DesignGlossy.tsx:3820-3833` then paints a 48° wedge labelled `FIRE — WSW`. SW/WSW is the post-cold-front onshore flow — the rain-bearing, cooling wind (Kruger 2014, *Ugu Lwethu*, pp.15-16). The sheet currently tells a KZN farmer to put the firebreak on the wet side.
Action: `fire` is no longer derived from `windWinter`. It comes from the regional table (§3) or is `null`.

**0.2 — `middayFrom: sh ? 'N' : 'S'` (`lib/sector.ts:106`) is false inside the tropics.** Northernmost South Africa ≈ −22.13°, north of the Tropic of Capricorn (−23.4359°). Replace with the per-solstice signed test δ > φ (§1). Same false claim in prose at `app/api/generate-report/route.ts:177` and `app/api/ai-render/route.ts:101,295` — fix all three from one helper.

**0.3 — The vector mean of a bimodal wind rose points where the wind never blows.** `lib/nasa-power.ts:145-149` takes `circularMeanDeg` over three monthly means. Kruger 2014 documents the KZN rose as two-lobed (NE and SW). A circular mean of two lobes lands in the gap. The high resultant lengths I computed (DJF R=1.00, JJA R=0.94) are an artefact of averaging three already-averaged months — they are not evidence of coherence.
Action: **NASA `WD10M` no longer places any arrow on this sheet.** It is demoted to a cross-check: if the regional table's sector and the NASA mean differ by >45°, push a data note. `WS2M` speed is still used for arrow weight.

---

## 1. SOLAR — 100% COMPUTED, NEW `lib/solar.ts`

Latitude and obliquity only. No network, no data source, no failure mode except |φ| ≥ 66.56°.

```ts
// lib/solar.ts — every field PROVENANCE: computed
export const OBLIQUITY_DEG = 23.4359; // mean obliquity, epoch 2026 (Meeus, Astronomical Algorithms 2e, ch.22)

export interface SunPath {
  season: 'december' | 'june' | 'equinox';
  declDeg: number;
  sunriseAzDeg: number | null;   // deg clockwise from TRUE north; null inside polar circles
  sunsetAzDeg: number | null;    // = 360 - sunrise, exact mirror
  riseLabel16: string | null;    // 16-point, e.g. 'ESE'
  setLabel16: string | null;
  sweepDeg: number | null;       // = 2 * sunriseAz
  noonAltitudeDeg: number;       // always defined (may be negative)
  noonSide: 'N' | 'S' | 'overhead';
  shadowRatio: number | null;    // 1/tan(alt); null when alt <= 0
}
export interface SolarModel {
  summer: SunPath; winter: SunPath; equinox: SunPath;
  middayFrom: 'N' | 'S' | 'mixed';   // 'mixed' inside the tropics — both solstices differ
  usable: boolean;                    // false when |lat| >= 90 - OBLIQUITY
}
export function deriveSolar(latDeg: number): SolarModel;
```

Formulae (Meeus ch.13/15; NOAA GML solar calculator equations). Geometric horizon, h₀ = 0:

```
cos A_rise = sin δ / cos φ            (φ signed, negative south — works unchanged in SH)
A_rise     = acos(clamp(cosA, -1, 1))     ∈ [0°,180°], eastern half
A_set      = 360° - A_rise
h_noon     = 90° - |φ - δ|
noonSide   = δ > φ ? 'N' : δ < φ ? 'S' : 'overhead'
```
Southern summer/winter map to δ = −ε / +ε when φ < 0, and swap when φ > 0. `usable = |φ| < 90 − ε = 66.5641°`; when `|sin δ / cos φ| > 1`, azimuths are `null` and a note reads "Sun does not rise/set at this latitude at this season."

### Unit-test table — φ = −29.783°, ε = 23.4359°, tolerance ±0.05°

| quantity | December (SH summer) | June (SH winter) | equinox |
|---|---|---|---|
| δ | −23.4359° | +23.4359° | 0° |
| cos A | −0.458329 | +0.458329 | 0 |
| sunrise az | **117.27°** | **62.73°** | **90.00°** |
| sunset az | **242.73°** | **297.27°** | **270.00°** |
| 16-pt rise / set | **ESE / WSW** | **ENE / WNW** | E / W |
| sweep | 234.55° | 125.45° | 180.00° |
| noon altitude | **83.65°** | **36.78°** | 60.22° |
| noon side | N | N | N |
| shadow ratio | 0.110 | 1.338 | 0.571 |

Intermediate constants to assert: `cos φ = 0.867913`, `sin ε = 0.397789`.

Extra cases to pin: φ = 0 → rise 113.44°/246.56°, both solstices; φ = −22.0° (inside SA, inside tropics) → June noon side = **S**, `middayFrom = 'mixed'`; φ = −70° → `usable = false`, azimuths null, June noon altitude −3.44°.

### Sheet labels (these correct the reference sheet)
- `SUMMER SUN · ESE → N → WSW · noon 84°`
- `WINTER SUN · ENE → N → WNW · noon 37°`

The reference sheet's "SE → N → SW" / "NE → N → NW" has the **seasonal sense right** — summer rise/set south of due E/W, winter north of it, both peaking north. That is the thing usually drawn backwards. But 117.27° is only 4.8° inside the SE octant and is squarely ESE; a reader who paces SE for the summer sunrise line is ~18° out. Ship the computed 16-point label plus the numeric bearing; never the octant.

**Not knowable, and must be stated:** this is astronomical sunrise against a flat sea-level horizon. The app holds no horizon profile — `lib/elevation.ts:4-52` samples three points ~1 km apart and returns one plane. In broken KZN terrain a 10° ridge delays effective sunrise 45-60 min and shifts the visible rise point along the horizon. Fixed caption under the sun band: *"Astronomical sun path for this latitude. Ridges and trees will delay first and last light — check on site."*

---

## 2. SECTORMODEL — EXACT ADDITIONS

```ts
export type Provenance = 'computed' | 'regional-assumption';

export interface NamedWindSector {
  id: 'summer_cooling' | 'cold_front' | 'berg' | 'storm_onshore';
  title: string;          // 'SUMMER COOLING WIND'
  fromLabel: string;      // 'NE'
  bearingDeg: number;     // centre, deg from TRUE north
  halfWidthDeg: number;   // rendered wedge half-angle
  season: string;         // 'Sep–Mar'
  effect: string;         // one line: what it does to the design
  provenance: 'regional-assumption';   // NEVER 'computed' — none of these are measured here
  sourceKey: keyof typeof SECTOR_SOURCES;
  regionKey: string;      // 'kzn-coastal'
}

export interface SectorModel {
  southernHemisphere: boolean;
  solar: SolarModel;                     // computed — replaces sun.middayFrom
  sun: { middayFrom: 'N' | 'S' | 'mixed' };  // kept for back-compat, now from solar

  namedWind: NamedWindSector[];          // regional-assumption; [] when no region rule matches
  regionKey: string | null;              // null ⇒ no named sectors, and say so on the sheet
  windNasaCrossCheck: { summerDeg: number | null; winterDeg: number | null; disagreesDeg: number | null } | null;

  windSummer: …unchanged shape…          // DEMOTED: no longer drawn as an arrow (see §0.3)
  windWinter: …unchanged shape…

  fire: { bearingDeg: number; halfWidthDeg: number; seasonNote: string;
          provenance: 'regional-assumption'; sourceKey: string } | null;   // absent unless region rule fires

  water: {
    downhillBearingDeg: number; slopeDeg: number; slopePct: number;
    indicative: boolean;
    fallModel: 'uniform-plane';          // computed, but a MODEL not a survey
    sampleBaselineM: 1000;               // literal — elevation.ts:6, d = 0.01°
    contourIntervalM: number | null;     // computed, from contours.ts intervalM
    arrowCount: number;                  // 3 or 5 — parallel, see §5
  } | null;

  frost: { downhillBearingDeg: number; indicative: boolean;
           confidence: 'inferred-from-1km-aspect' } | null;

  flat: boolean;
  dataNotes: string[];
  assumptionNotes: string[];             // NEW — printed in the regional-assumption footer verbatim
}
```

Field-by-field provenance:

| field | class |
|---|---|
| `solar.*` (all azimuths, altitudes, sides, sweeps) | **computed** |
| `water.downhillBearingDeg`, `slopeDeg`, `slopePct`, `contourIntervalM` | **computed** (from a ~1 km plane fit) |
| `water.arrowCount`, contour line positions | **computed** (single bearing, replicated) |
| `namedWind[*]`, `fire` | **regional-assumption** |
| `windNasaCrossCheck` | **computed**, diagnostic only, never drawn |
| `frost.downhillBearingDeg` | **regional-assumption** in effect — it is 1 km aspect, not a cold-air model |
| per-arrow local runoff, storm intensity, berg-wind frequency, local horizon, magnetic declination | **absent** |

---

## 3. REGIONAL CLAIMS — WHAT SHIPS WHERE

New `lib/regional-wind.ts`: a static, sourced table keyed by region, plus a `resolveRegion(lat, lon, biome, rainfallPattern)` that returns `null` when it cannot place the site. **`null` is a valid, shippable outcome:** the sheet then draws sun + water + frost only and prints "No regional wind sectors for this area — record wind directions on site."

### SHIP NATIONALLY (no gate)
Nothing meteorological. Only the solar band, the compass ring, water/contour, and the caveat footer are national. **A single national wind rule would be wrong for roughly half the country:** KZN summer NE / winter SW versus Cape summer SE ("the Cape Doctor", South Atlantic High, Sep-Mar) / winter NW. A Durban-tuned rule applied at Stellenbosch is ~110° out.

### SHIP, GATED ON REGION (`regionKey === 'kzn-coastal'`, i.e. KZN, seaward of the escarpment, ≲60 km from the coast)

| sector | bearing | season | source | status |
|---|---|---|---|---|
| `summer_cooling` — onshore/sea-breeze | **NE**, half-width 30° | Sep–Mar | Kruger 2014, *Ugu Lwethu* pp.15-16: "north-easterly winds dominate during spring and summer"; sea breezes "deflected increasingly to the 'left', to become north-easterly winds" | **SHIP.** Corrects the app, which currently draws ESE here. |
| `cold_front` — post-coastal-low SW | **SW**, half-width 30° | Mar–Aug | Kruger 2014: "During autumn and winter, winds from the southwest are dominant"; near-weekly frontal passages, NE veering SW | **SHIP as a wind/rain/damage sector. Label it "COLD FRONT — DRIVING RAIN". Never as fire.** |
| `berg` — descending föhn off the escarpment | **NW**, half-width 25° | May–Aug, episodic | Berg winds are by definition plateau→coast descent across the Great Escarpment (AMS Glossary, "Berg wind"); Kruger 2014 places them in the coastal synoptic sequence | **SHIP ONLY under the coast+escarpment gate.** At a Highveld, Free State or Karoo site the farm is the *source* region — there is no berg wind and no bearing. Drawing one there is fabrication. |
| `fire` | = `berg` bearing, NW, dashed-ray fan | dry-season, May–Aug | as above | **SHIP only where `berg` fires and `rainfallPattern === 'summer'`.** Otherwise `null`. |

### DO NOT SHIP
- **"SUMMER STORMS & DRIVING RAIN from E/NE" as a general sector.** Two mechanisms, opposite approaches, both real. Extreme coastal rain events (cut-off lows, coastal meso-lows, tropical systems) *do* draw a strong onshore low-level jet from E/NE/SE — the April 2022 Durban floods are the canonical case (Tshabalala et al., *Atmosphere* 14(1):78; >300 mm/24 h, onshore flow over the Agulhas Current interacting with the escarpment). Ordinary summer convective storms at an Outer West Durban site do not: SAWS severe-convection advisories consistently name the *western* parts of KZN. Shipping "storms from E/NE" as the rule puts the storm arrow ~180° wrong for the common case.
  - Permitted alternative: a single non-directional band under the legend — *"Summer convective storms and hail: frequent Oct–Mar. Approach direction varies; extreme onshore rain events arrive from E/NE."* No arrow, no wedge.
- **Any wind sector outside the `kzn-coastal` gate** until a second region is sourced with the same rigour. Western Cape (summer SE / winter NW) is well documented and is the obvious next region, but it must be authored and reviewed separately, not extrapolated.
- **Fire anywhere the berg gate does not fire.** No fire sector is better than a wrong one.
- **Magnetic declination printed as a number.** Site declination is ≈26-27° W here, and it is real and it matters — a farmer with a handheld compass will be that far out. But it is a time-varying field requiring a WMM/IGRF evaluation the app does not have. Print the qualitative warning only: *"All bearings are TRUE north. A magnetic compass reads well west of true in South Africa — correct before pacing anything out."* Adding the number is a separate task with a real dependency.

---

## 4. HOW EVERY REGIONAL ASSUMPTION IS LABELLED ON THE SHEET

Three visible mechanisms, all mandatory:

1. **Line style is the register.** Computed geometry is **solid** (sun arcs, water arrows, contour lines). Regional assumptions are **dashed** (all four `namedWind` wedges, the fire ray-fan). One glance separates the two.
2. **Every regional legend row carries a superscript `ᴬ`** after its title — `2. SUMMER COOLING WIND — NE ᴬ`. Computed rows carry none.
3. **A footer band** across the bottom of the map, always drawn when `namedWind.length > 0`, verbatim:
   > **ᴬ REGIONAL SECTOR ASSUMPTIONS** — wind, berg and fire directions are the documented regional pattern for coastal KwaZulu-Natal, not measurements at this site. Confirm local wind, fire and runoff directions by on-site observation before siting windbreaks or firebreaks. Sun path is computed from latitude. Bearings are TRUE north.

Plus a `SOURCES` line in the data strip listing the source keys actually used (`Kruger 2014 · Meeus ch.13`), so the sheet is self-citing.

Wording corrections in existing notes:
- `lib/sector.ts:101` — replace "Slope from SRTM 30 m" with **"Slope estimated from SRTM elevation sampled about 1 km apart — one average fall for the whole hillside, not your plot."** The raster is 30 m; our sampling baseline is ~1 km (`lib/elevation.ts:6`, `const d = 0.01`). Naming 30 m understates the footprint ~30×.
- `lib/sector.ts:102` — same fix for the "reads ~flat" note.

---

## 5. TERRACE FALL, CONTOURS, FROST

**Multiple downhill arrows are honest — if they are parallel, never fanned.** The sheet already draws ~8 parallel contour lines from that same single aspect value (`DesignGlossy.tsx:3875`, `computeContourLines(...)`) and labels them "ON CONTOUR — SWALES RUN THIS WAY". Downhill arrows are the exact perpendicular of those lines — the same claim, rotated 90°. Fanned arrows would be a *new* claim (that fall direction varies across the plot) that we cannot support from one plane fit.

Spec: 3 arrows if `boundary` bbox aspect ratio < 1.6, else 5. All at `water.downhillBearingDeg`, evenly spaced along the contour direction, each spanning `-0.35·siteR … +0.45·siteR` about its own centre. One shared label: `FALL ~{slopePct}% — UNIFORM FALL ASSUMED`.

**Free wins already computed and currently discarded:** `ContourResult.intervalM` (snapped by `niceInterval`, contours.ts:94-101) and per-line `elevM` (contours.ts:11-16, 89). Sheet 02 draws the lines and labels only the middle one with a static string (`DesignGlossy.tsx:3884-3892`). Add a `CONTOUR INTERVAL ~{intervalM} m` caption and `+2 / 0 / −2` labels on alternate lines. Zero new claims, biggest single step toward the reference sheet's density.

**Frost.** `model.frost.downhillBearingDeg` is literally `aspectDeg` again (`lib/sector.ts:99`) and the pocket ellipse is planted at `siteR*0.85` (`DesignGlossy.tsx:3899-3916`) — a definite pocket at a definite spot, from a 1 km hillside aspect. Cold-air pooling is set by micro-topography (a 1 m dip, a hedge, a wall), none of which we hold. Downgrade: no ellipse; a dashed open-ended chevron toward the low side labelled `COLD AIR DRAINS THIS WAY — POCKETS FORM IN LOW SPOTS (CHECK ON SITE)`. Also: frost and water are collinear by construction (both from `sector.ts:96` and `:99`); once fall becomes several arrows, offset the frost chevron laterally onto the outermost arrow's flank so it does not overprint.

---

## 6. DRAW ORDER AND PLACEMENT

Frame: `SCALE=2` (`DesignGlossy.tsx:391`) over the default 960×640 (`lib/design-canvas.ts:324-325`) ⇒ W=1920, H=1280, cx=960, cy=640, `pad=38`, `rowH=50`, `margin=67`, `arrowLen=106`, ring cap R=467.

Back to front:
1. `drawAnalysisBase` satellite wash → `drawBlueprintGround` fills/hatch → house → driveway → boundary (unchanged, `DesignGlossy.tsx:3983-3995`).
2. Contour lines, clipped to boundary (existing) + interval caption + elevM labels.
3. Terrace-fall parallel arrows (solid blue).
4. Frost chevron.
5. Regional wedges, dashed, painted in this order so the weaker sits under the stronger: `storm_onshore` (if ever enabled) → `summer_cooling` → `cold_front` → `berg` → fire ray-fan.
6. Compass ring + ticks.
7. Solar band: **two arcs**, summer at `R + arrowLen*0.30`, winter at `R + arrowLen*0.62` (≈34 px apart at cap R — the minimum that reads as two).
8. Numeral badges on the map.
9. Numbered legend panel, then footer assumption band, scale bar, north arrow, title.

**Placement rule — numerals on the map, words in the legend.** This is the fix for the collisions that already exist and the ones the enrichment would add:

- Wind/energy labels are placed today at radius `R + arrowLen` with **no bounds test** (`DesignGlossy.tsx:3838, 3843`). At cap R that ring is 573. An ENE label (67.5°) lands at (1489, 421) — 125 px inside the legend panel's left edge (rect x 1364..1882, y 38..568). It prints on top of the legend rows. NE (45°) grazes it. This is live today for any site whose wind reads NE/ENE — which is exactly what the corrected KZN rule will produce.
- The summer-cooling (NE, 45°) and any storm sector (E/NE) are 11-22° apart; their text is guaranteed to overprint.
- The second sun arc collides with the `N` glyph (y=148, `DesignGlossy.tsx:3742`), the apex dot (y 104..146) and the `MIDDAY SUN` label (y=90) — the dot and the N glyph are already 2 px apart today.

Rule: each map element gets a **numbered disc only** at `R + arrowLen*0.55`. Reuse the existing badge visual — `badge(cx, cy, color, n)` at `DesignGlossy.tsx:3008-3022` (filled disc r = max(15, W*0.011) = 21 px, 2.5 px white stroke, bold white numeral at r*1.1), used by the zone map at 3023-3030 — **extracted to a module-level helper first** so sheets 02 and 03 read as one plan set. All words live in the numbered legend. Before drawing any badge, run a keep-out test against: legend rect, title block, data strip, footer band, and previously placed badges (min centre separation 2.4r = 50 px); on collision, step the badge inward along its own ray in 24 px increments, max 3 steps, then skip the badge and rely on the legend row alone. No text is ever drawn outside the ring.

Legend numbering (1-9), which doubles as the on-map numerals:
1 SUMMER SUN (computed) · 2 WINTER SUN (computed) · 3 MIDDAY SUN + noon altitudes (computed) · 4 SUMMER COOLING WIND ᴬ · 5 COLD FRONT — DRIVING RAIN ᴬ · 6 BERG WIND ᴬ · 7 FIRE APPROACH ᴬ · 8 TERRACE FALL + contour interval (computed, uniform-fall model) · 9 COLD-AIR DRAINAGE (inferred). Rows for absent sectors are omitted entirely — never greyed, never placeholder.

---

## 7. MUST NOT BE BUILT

- Per-location runoff arrows, variable fall, or any fan of runoff directions. Three SRTM samples ~1 km apart give one plane. A denser SRTM grid at plot scale would be sampling the DEM's own vertical noise.
- A fire sector derived from NASA wind. Delete that path (`lib/sector.ts:90-91`).
- A national wind rule, or extrapolating `kzn-coastal` to any other region.
- A "summer storms from E/NE" arrow or wedge.
- A berg-wind arrow at any interior site.
- A frost-pocket ellipse at a specific spot.
- A printed magnetic-declination number.
- Redrawing bearings anywhere a second time — `drawSectorAnalysis` is deliberately the single geometry path shared with the AI-composited overlay (`DesignGlossy.tsx:3735-3745`, per `docs/RENDER-INVESTIGATION-2026-07-20.md` sector-ai finding 4). All new sectors go through it, not into a parallel function.
- Any label whose text is drawn outside the compass ring.

---

## 8. NEEDS A METEOROLOGIST, NOT A DEVELOPER

1. **The `resolveRegion` boundary itself.** "KZN, seaward of the escarpment, ≲60 km from coast" is my construction, not a sourced boundary. Where the NE/SW coastal regime hands over to the interior regime needs a climatologist's line, and until it exists the gate should be deliberately conservative (fire and berg only well inside it).
2. **Wedge half-widths.** 25-30° is a drafting choice, not a statistic. Real directional spread should come from a station wind rose (SAWS Durban / Mount Edgecombe), not from me.
3. **Whether berg-wind NW is the right single bearing for this specific site**, given local escarpment orientation — the descent direction is terrain-controlled and my confidence here is lower than for the NE/SW pair.
4. **Fire-season sector for KZN generally.** The berg-wind→fire link is mechanistically sound and sourced, but frequency and severity at an Outer West Durban smallholding is not something I can quantify, and the sheet implies it is worth a firebreak.
5. **Whether any storm-approach statement should appear at all**, given the two-mechanism problem in §3.
6. **The second region (Western Cape).** Summer SE / winter NW is well documented, but authoring it to this standard — including its inverted summer fire season — is a sourced-content task, not a coding one.