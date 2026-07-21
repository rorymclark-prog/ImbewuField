// Terrace-method recommendation — the pure rules engine behind the terracing/earthworks feature.
//
// Turns a slope % into the recommended terrace method, an EngineerFlag escalation, and the
// grounded reasoning behind it, so nothing on screen is invented. Pure, no DOM — same rule
// lib/sector.ts and lib/phasing.ts already follow (lib/sector.ts:6, "Pure, no DOM; lib/ never
// imports components/").
//
// See docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md for the full spec this file implements —
// §1 for the decision table and its adversarial-review history, §3 for the effective-slope
// fallback chain. Read that doc's §1 preamble before touching any row: it documents WHY each
// number and flag is what it is, and the specific defect (an inverted risk gradient on row 5)
// that was fixed before this table was ever committed.

import type { ZoneShape } from '@/lib/design-canvas';
import type { SectorSite } from '@/lib/sector';

export type TerraceMethod =
  | 'contour_planting'
  | 'contour_cover'
  | 'vetiver_hedge'
  | 'contour_bank'
  | 'bench_terrace_retained'
  | 'no_dig_engineer_required';

// 'maybe' was retired during adversarial review of the spec this table implements: row 5
// originally carried it, which was a SOFTER flag than rows 3-4's 'ask_local_expert' despite row 5
// sitting closer to the row-6 failure threshold — an inverted risk gradient on the row a farmer
// is most likely to act on literally (row 6 says don't dig at all; row 5 doesn't). Never
// reintroduce a flag weaker than 'ask_local_expert' for any row above row 2 without re-running
// that review (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §1).
export type EngineerFlag = 'no' | 'ask_local_expert' | 'always';

export interface TerraceMethodRow {
  minPct: number;
  maxPct: number | null; // null = no upper bound (row 6)
  method: TerraceMethod;
  label: string; // farmer-facing method name, e.g. 'Bench terrace with retaining riser'
  why: string; // one-line grounded reason, shown under the label
  riserCapM: number | null;
  engineerFlag: EngineerFlag;
  copy: string; // the exact sentence shown on screen
  sources: string[]; // citation keys, e.g. ['FAO-bench-terrace', 'DECISION-THRESHOLDS-row5']
}

// The 6 rows from docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §1, verbatim. Boundaries stay at
// one decimal place so recommendTerraceMethod stays a deterministic, testable pure function — the
// spec's own "false precision" note requires displayed copy to round this to a zone, not a line,
// but the STORED boundary here must stay exact.
export const TERRACE_METHOD_TABLE: TerraceMethodRow[] = [
  {
    minPct: 0,
    maxPct: 2,
    method: 'contour_planting',
    label: 'Plant on contour — no earthworks',
    why: 'Sheet-erosion risk negligible at any soil type; slope too flat to concentrate runoff.',
    riserCapM: null,
    engineerFlag: 'no',
    copy: 'No earthworks needed — plant on contour.',
    sources: ['DECISION-THRESHOLDS-row1', 'FAO-0-5pct-contour'],
  },
  {
    minPct: 2,
    maxPct: 5,
    method: 'contour_cover',
    label: 'No earthworks — contour cultivation, cover crop/mulch',
    why: "FAO's \"gently sloping\" threshold: sheet erosion becomes measurable under bare soil but is fully controlled by cover; contour orientation starts actively mattering.",
    riserCapM: null,
    engineerFlag: 'no',
    copy: 'Contour cultivation with cover crop or mulch — no earthworks needed yet.',
    sources: ['DECISION-THRESHOLDS-row2'],
  },
  {
    minPct: 5,
    maxPct: 10,
    method: 'vetiver_hedge',
    label: 'Vetiver hedge or grass strip on contour',
    why:
      "Conventional threshold (FAO/SA-extension convention, mirrored by SASRI) where unaided sheet flow starts concentrating into rills. KZN's convective-storm rainfall means even a shallow swale needs a protected overflow.",
    riserCapM: 0.2,
    engineerFlag: 'ask_local_expert',
    copy:
      'Vetiver hedge or grass strip on contour. A shallow swale (<~20 cm cut) is acceptable only with an armoured spillway.',
    sources: ['FAO-rill-threshold', 'KZN-REGIONAL-PRACTICE-2', 'DECISION-THRESHOLDS-row3'],
  },
  {
    minPct: 10,
    maxPct: 20,
    method: 'contour_bank',
    label: 'Contour bank / graded terrace',
    why:
      'USDA-NRCS terrace-standard range and where FAO shifts from vegetative-only to structural — also FAO\'s own stated floor for bench terracing (7°≈12%). On residual clay-over-rock, a deeper cut here starts probing the clay/saprolite–rock interface.',
    riserCapM: 0.5,
    engineerFlag: 'ask_local_expert',
    copy:
      'Contour bank / graded terrace, vetiver- or grass-stabilized riser. Keep the cut shallow and balance cut/fill on contour — do not bench yet.',
    sources: ['USDA-NRCS-terrace-standard', 'FAO-bench-terrace', 'DECISION-THRESHOLDS-row4'],
  },
  {
    minPct: 20,
    maxPct: 33,
    method: 'bench_terrace_retained',
    label: 'Bench terrace with mandatory retaining riser',
    // Farmer-facing reason, not provenance notes — an adversarial review of this row found the
    // original text quoting its own review history (a backticked enum name and all) as if that
    // were something a farmer needed to know. What they need to know is why the margin is thin.
    why:
      'This slope sits close to where saturated residual soil starts to fail on its own — the safe margin here is thin, which is why a local check matters even though you can still build this yourself.',
    // The 2 m figure is this app's own cap and is what governs its advice — IS 14458's ~4 m
    // reference is a broader civil-engineering data point about when gabion is generally preferred
    // over dry stone, not a looser ceiling this app permits. Do not read the two figures as
    // alternatives (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §1, row 5).
    riserCapM: 1,
    engineerFlag: 'ask_local_expert',
    // TWO DIFFERENT THRESHOLDS, do not collapse them into one (an adversarial review caught this
    // exact collapse once already — a first draft escalated only "beyond 2 m", which is a full
    // metre less conservative than the spec's actual ~1 m escalation trigger): 2 m is the absolute
    // hard ceiling, never crossed under any circumstance without an engineer; ~1 m is the point at
    // which ANY additional risk factor (seepage, exposed rock, wet season) is enough on its own to
    // treat this as row 6, well before the hard ceiling is reached.
    copy:
      'Bench terrace with a mandatory retaining riser — stone pitching, gabion for tougher/wetter sections, or a mature, already-established (2–3 season) live vetiver hedge only — never cut the full bench and plant vetiver in the same season. Terrace in stages behind an existing, established hedge instead, or use stone/gabion for the interim. Stack benches rather than one tall cut. 2 m TOTAL stacked height across every lift on this riser is a hard ceiling, not per-lift, and must never be crossed. Treat this as the next row (engineer required) well before that hard ceiling — once stacked height passes about 1 m, or if there is any seepage, exposed rock, or you are building in the wet season.',
    sources: ['DECISION-THRESHOLDS-row5', 'GEOTECH-SAFETY-1', 'GEOTECH-SAFETY-3', 'FAO-bench-terrace-25deg'],
  },
  {
    minPct: 33,
    maxPct: null,
    method: 'no_dig_engineer_required',
    label: 'Do not cut or terrace without an engineer',
    why:
      'Exceeds the conservative safe-unsupported-batter-angle rule of thumb for saturated residual soils. This is the gradient band where the April 2022 KZN floods produced widespread translational failures on exactly this soil profile.',
    riserCapM: null,
    engineerFlag: 'always',
    copy:
      'Do not cut or terrace without an engineer. Leave under permanent vegetation / agroforestry, uncultivated, or use an engineer-designed retaining structure only.',
    sources: ['DECISION-THRESHOLDS-row6', 'KZN-april-2022-floods'],
  },
];

/** Pure lookup — no site/network dependency. Clamps negative input to row 1, treats >100 as row 6. */
export function recommendTerraceMethod(slopePct: number): TerraceMethodRow {
  const pct = Math.max(0, slopePct); // defensive clamp — a farmer typo or bad sign shouldn't 500
  for (const row of TERRACE_METHOD_TABLE) {
    if (pct >= row.minPct && (row.maxPct === null || pct < row.maxPct)) return row;
  }
  // Unreachable given the table covers [0, ∞), but keep TypeScript honest and fail safe to the
  // most conservative row rather than throwing.
  return TERRACE_METHOD_TABLE[TERRACE_METHOD_TABLE.length - 1];
}

export interface EffectiveSlope {
  pct: number;
  source: 'measured' | 'whole-site-average';
}

/** Resolves the slope to use for a terrace_bank ring's method recommendation:
 *  1. z.measuredSlopePct if the farmer entered one for THIS ring — 'measured'.
 *  2. site.elevation.slopePct (the same whole-site SRTM plane sector.ts already uses) — 'whole-site-average'.
 *  3. If neither exists, recommendTerraceMethod cannot run — the UI must show the
 *     "walk the site and pace the slope, or open this place on the map to fetch it" prompt
 *     lib/sector.ts's analogous missing-data case uses, not a silent default. */
export function effectiveSlopeForRing(
  ring: Pick<ZoneShape, 'measuredSlopePct'>,
  site: SectorSite | null | undefined,
): EffectiveSlope | null {
  if (ring.measuredSlopePct != null) return { pct: ring.measuredSlopePct, source: 'measured' };
  if (site?.elevation?.slopePct != null) return { pct: site.elevation.slopePct, source: 'whole-site-average' };
  return null;
}
