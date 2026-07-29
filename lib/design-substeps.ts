// Design Studio — the per-step "step-by-step guide" (Rory's ask: "1st add jojo tanks, great,
// now add tap points, great, now add drip… in a little Lima bubble" + "a step-by-step guide
// through everything so nothing is missed").
//
// Each design step (Base/Water/Zones/Planting/Structures) has an ORDERED list of micro-tasks.
// The StepGuide component walks the farmer through them: shows the current task + a placement
// hint, arms the right tool when they tap "Do this", and auto-ticks each task off as the
// canvas fills in. Content is plain English (the whole Studio is hardcoded English — see
// lib/design-lessons.ts / DesignWizard.tsx for the same convention).

import type { DesignCanvasState, GroundFeatureKind, LineShape, WizardStep } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';

// What tapping "Do this" arms in the palette. `null` = nothing to arm (e.g. a check-only task
// like "confirm your boundary is traced", which is done on the main map).
export type SubStepArm =
  | { kind: 'place'; defId: string }
  | { kind: 'line'; lineKind: LineShape['kind'] }
  | { kind: 'zone'; zone: 0 | 1 | 2 | 3 | 4 | 5 }
  | { kind: 'area'; feature: GroundFeatureKind }
  | null;

// Extra context the completion checks need that doesn't live in DesignCanvasState (boundary /
// house come from the traced reference layers on the page).
export interface SubStepCtx {
  hasBoundary: boolean;
  hasHouse: boolean;
}

export interface SubStep {
  id: string;
  title: string; // short imperative — "Add your rainwater tanks"
  instruction: string; // how — "Tap a tank size, then tap the map next to a roof."
  where: string; // placement advice (the "where" the farmer kept asking for)
  arm: SubStepArm;
  optional?: boolean; // nice-to-have; the guide can complete without it
  done: (s: DesignCanvasState, ctx: SubStepCtx) => boolean;
}

// ── completion helpers ─────────────────────────────────────────────────────────
function hasItem(s: DesignCanvasState, ids: string[]): boolean {
  const set = new Set(ids);
  return s.items.some((it) =>
    set.has(it.defId) && Number.isFinite(it.x) && Number.isFinite(it.y));
}
function hasItemCategory(s: DesignCanvasState, category: string): boolean {
  return s.items.some((it) =>
    ELEMENTS_BY_ID[it.defId]?.category === category
    && Number.isFinite(it.x)
    && Number.isFinite(it.y));
}
function hasFinitePoints(points: Array<[number, number]>, minimum: number): boolean {
  return points.length >= minimum
    && points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}
function hasLine(s: DesignCanvasState, kinds: LineShape['kind'][]): boolean {
  const set = new Set(kinds);
  return s.lines.some((l) => set.has(l.kind) && hasFinitePoints(l.points, 2));
}
function hasZoneN(s: DesignCanvasState, ns: number[]): boolean {
  const set = new Set(ns);
  // Number(z.zone): legacy data can persist zone as a string ("1"), which a strict Set.has
  // never matches — that made a painted Zones step still read "0/4". loadCanvasState now
  // normalises on load; this coercion also covers state already in memory this session.
  return s.zones.some((z) =>
    !z.feature && set.has(Number(z.zone)) && hasFinitePoints(z.points, 3));
}
function hasFeature(s: DesignCanvasState, feats: GroundFeatureKind[]): boolean {
  const set = new Set(feats);
  return s.zones.some((z) =>
    z.feature && set.has(z.feature) && hasFinitePoints(z.points, 3));
}

const TANK_IDS = ['jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000', 'rain_barrel'];
const TREE_IDS = [
  'tree_citrus', 'tree_mango', 'tree_avocado', 'tree_macadamia', 'tree_litchi',
  'tree_guava',
  'tree_pawpaw', 'tree_moringa', 'tree_natal_plum', 'tree_wild_plum', 'tree_waterberry',
  'banana_clump', 'tree_indigenous', 'tree_other', 'banana_circle',
  'tree_apple', 'tree_pear', 'tree_plum', 'tree_peach', 'tree_fig', 'tree_pomegranate', 'tree_olive',
];
const BED_IDS = ['veg_bed', 'raised_bed', 'keyhole_bed', 'herb_spiral'];

// ── the catalog ─────────────────────────────────────────────────────────────────
export const STEP_SUBSTEPS: Record<Exclude<WizardStep, 'glossy' | 'review'>, SubStep[]> = {
  base: [
    {
      id: 'base-boundary',
      title: 'Trace your boundary',
      instruction: 'Already traced your fence line on the main map? You’re done. Otherwise tap "Do this" and trace the outer edge of your land here, corner to corner.',
      where: 'The outer edge of your land, corner to corner.',
      arm: { kind: 'area', feature: 'boundary' },
      done: (s, ctx) => ctx.hasBoundary === true || hasFeature(s, ['boundary']),
    },
    {
      id: 'base-house',
      title: 'Mark your house',
      instruction: 'Tap "Do this", then trace around your house roof on the map.',
      where: 'The building you live in — tanks and Zone 1 go closest to it.',
      arm: { kind: 'area', feature: 'house' },
      done: (s, ctx) => ctx.hasHouse === true || hasFeature(s, ['house']),
    },
    {
      id: 'base-paving',
      title: 'Mark paving & driveway',
      instruction: 'Trace hard surfaces — the driveway, yard paving, or a concrete slab.',
      where: 'Anywhere rain runs straight off instead of soaking in.',
      arm: { kind: 'area', feature: 'patio' },
      optional: true,
      done: (s) => hasFeature(s, ['patio']),
    },
    {
      id: 'base-areas',
      title: 'Mark existing lawn, veg or orchard',
      instruction: 'Trace the ground you already use — a lawn, an old veg patch, existing trees.',
      where: 'What’s already growing, so your plan builds on it.',
      arm: { kind: 'area', feature: 'lawn' },
      optional: true,
      done: (s) => hasFeature(s, ['lawn', 'veg_garden', 'orchard', 'cleared']),
    },
  ],
  // SECTOR — the "analysis before design" reveal. There is NOTHING TO DRAW and nothing to
  // research: the app has already worked the energies out (lib/sector.deriveSectorModel) and
  // shows them on the canvas the moment the farmer lands here. These are LOOK/acknowledge
  // tasks, so each `done` is unconditionally true — the step can never stall a newcomer, and
  // the "Looks right →" affordance (SectorSummary, mounted by StepGuide) advances to Water.
  // arm is null throughout: tapping never picks up a tool. The plain-words, real-direction
  // reveal lives in the SectorSummary card; these three titles orient the eye on the map.
  sector: [
    {
      id: 'sector-sun',
      title: 'Find the sun arc — your beds want the northern sun',
      instruction: 'The gold arc across the top of the map is the sun. In South Africa it swings across the NORTH, so that side gets the most light.',
      where: 'Face your veg beds and tender crops toward the sun side — the north.',
      arm: null,
      done: () => true,
    },
    {
      id: 'sector-fire',
      title: 'Note the fire wedge — plan a firebreak/low fuel on that side',
      instruction: 'The red wedge points to where a veld fire is most likely to come from — the dry-season wind. If it is missing, your site has no wind data yet.',
      where: 'Keep a firebreak clear and the fuel low on the fire side of your land.',
      arm: null,
      done: () => true,
    },
    {
      id: 'sector-water',
      title: 'See the downhill water arrow — swales will go ACROSS it',
      instruction: 'The blue arrow shows which way water runs downhill. Swales and beds work best laid ACROSS that flow, not along it, so rain sinks in.',
      where: 'Later, on the Water step, draw your swale lines across this arrow.',
      arm: null,
      done: () => true,
    },
  ],
  water: [
    {
      id: 'water-tanks',
      title: 'Add your rainwater tanks',
      instruction: 'Tap a JoJo tank size, then tap the map next to a roof.',
      where: 'Within 3 m of a roof downpipe, on level, compacted ground.',
      arm: { kind: 'place', defId: 'jojo_2500' },
      done: (s) => hasItem(s, TANK_IDS),
    },
    {
      id: 'water-taps',
      title: 'Mark your tap points',
      instruction: 'Tap "Do this", then drop a tap point wherever you’ll fill a can or hose.',
      where: 'At bed corners — so a hose reaches without crossing a path.',
      arm: { kind: 'place', defId: 'tap_point' },
      done: (s) => hasItem(s, ['tap_point']),
    },
    {
      id: 'water-swales',
      title: 'Draw swale lines across the slope',
      instruction: 'Draw a line ACROSS the slope (on contour), not down it, so rain sinks in.',
      where: 'Along the hillside, level end to end — above your beds and trees.',
      arm: { kind: 'line', lineKind: 'swale' },
      done: (s) => hasLine(s, ['swale']),
    },
    {
      id: 'water-drip',
      title: 'Add drip or pipe lines',
      instruction: 'Draw where water will travel — a drip line to the beds or a pipe from a tank.',
      where: 'Tank → beds, the shortest sensible run.',
      arm: { kind: 'line', lineKind: 'drip' },
      optional: true,
      done: (s) => hasLine(s, ['drip', 'pipe']),
    },
    {
      id: 'water-store',
      title: 'Add a pond or greywater basin',
      instruction: 'Optional: a pond in a low spot, or a greywater basin off the kitchen outlet.',
      where: 'Ponds in a natural low point; greywater by a fruit tree or banana.',
      arm: { kind: 'place', defId: 'greywater_basin' },
      optional: true,
      done: (s) => hasItem(s, ['pond_small', 'dam', 'greywater_basin', 'borehole']),
    },
  ],
  zones: [
    {
      id: 'zone-1',
      title: 'Zone 1 — nearest the kitchen door',
      instruction: 'Paint the area you can reach in about 20 steps from the door.',
      where: 'Right around the house — herbs, salad, the things you pick daily.',
      arm: { kind: 'zone', zone: 1 },
      done: (s) => hasZoneN(s, [1]),
    },
    {
      id: 'zone-2',
      title: 'Zone 2 — your main veg beds',
      instruction: 'Paint the next ring out — where the bulk of your vegetables grow.',
      where: 'A short walk from the door; visited most days.',
      arm: { kind: 'zone', zone: 2 },
      done: (s) => hasZoneN(s, [2]),
    },
    {
      id: 'zone-3',
      title: 'Zone 3 — orchard & food forest',
      instruction: 'Paint where your fruit trees and bigger plots will live.',
      where: 'Further out — visited weekly, not daily.',
      arm: { kind: 'zone', zone: 3 },
      done: (s) => hasZoneN(s, [3]),
    },
    {
      id: 'zone-45',
      title: 'Zone 4 / 5 — grazing & wild edge',
      instruction: 'Optional: paint low-care land — grazing, woodlot, or a wild buffer strip.',
      where: 'The outer edges you visit least.',
      arm: { kind: 'zone', zone: 4 },
      optional: true,
      done: (s) => hasZoneN(s, [4, 5]),
    },
  ],
  planting: [
    {
      id: 'plant-trees',
      title: 'Place your fruit & nut trees first',
      instruction: 'Trees are biggest and last longest — place them, then fit beds around them.',
      where: 'South or west of veg beds (SA sun is in the north) so they don’t shade them. Give each its full-grown width.',
      arm: { kind: 'place', defId: 'tree_moringa' },
      done: (s) => hasItem(s, TREE_IDS),
    },
    {
      id: 'plant-beds',
      title: 'Add your vegetable beds',
      instruction: 'Drop beds in full sun, within easy reach of a tap and the kitchen.',
      where: 'Open, sunny ground in Zone 1–2 — not under a tree canopy.',
      arm: { kind: 'place', defId: 'veg_bed' },
      done: (s) => hasItem(s, BED_IDS),
    },
    {
      id: 'plant-support',
      title: 'Add support planting',
      instruction: 'Optional: pollinator strips, mulch banks, a banana circle — they feed the system.',
      where: 'Pollinators along orchard edges; mulch banks beside the beds that need it.',
      arm: { kind: 'place', defId: 'pollinator_strip' },
      optional: true,
      done: (s) => hasItem(s, ['pollinator_strip', 'mulch_bank', 'banana_circle', 'spekboom_hedge', 'vetiver_row']),
    },
  ],
  structures: [
    {
      id: 'struct-compost',
      title: 'Set up compost',
      instruction: 'Place a compost bay or worm farm on the path between kitchen and beds.',
      where: 'On the way out with scraps, on the way in with finished compost.',
      arm: { kind: 'place', defId: 'compost_bay' },
      done: (s) => hasItem(s, ['compost_bay', 'worm_farm']),
    },
    {
      id: 'struct-animals',
      title: 'Place animal housing',
      instruction: 'Optional: a chicken coop, kraal or pen — close enough for daily care, downwind of the house.',
      where: 'Downwind and a little downhill; manure feeds the compost.',
      arm: { kind: 'place', defId: 'chicken_coop' },
      optional: true,
      done: (s) => hasItemCategory(s, 'animal') || hasItem(s, ['chicken_coop', 'chicken_tractor', 'kraal']),
    },
    {
      id: 'struct-storage',
      title: 'Add storage & work space',
      instruction: 'Optional: a shed, nursery table or shade house near your main work zone.',
      where: 'By the beds you work most, out of the prevailing rain.',
      arm: { kind: 'place', defId: 'shed' },
      optional: true,
      done: (s) => hasItem(s, ['shed', 'nursery_table', 'shade_house', 'greenhouse_tunnel']),
    },
    {
      id: 'struct-extras',
      title: 'Extras — beehive, bench, gate',
      instruction: 'Optional: finishing touches. Mind the beehive flight path — keep it clear of foot traffic.',
      where: 'Beehive facing east, well clear of paths; benches in the shade.',
      arm: { kind: 'place', defId: 'beehive' },
      optional: true,
      done: (s) => hasItem(s, ['beehive', 'bench', 'gate', 'market_stall']),
    },
  ],
};

export function subStepsForStep(step: WizardStep): SubStep[] {
  if (step === 'glossy' || step === 'review') return [];
  return STEP_SUBSTEPS[step] ?? [];
}
