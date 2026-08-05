// ── The farm's own measured facts, as report input ───────────────────────────────────────────
//
// WHY THIS EXISTS. The generated site report was generic BY CONSTRUCTION, and not because the
// prompt was weak. Two branches in app/api/generate-report/route.ts were structurally dead:
//
//   1. `studioLayers.some(l => l.approved)` — nothing in the app ever sets `approved: true`, and
//      `saveDesignStudioState` is never called, so `studioLayers` is always []. Every report ever
//      generated printed the else-branch: "No approved Design Studio layers were supplied. Do not
//      describe a drawn layout as if one exists."
//   2. The BUILD PHASES block was nested INSIDE that dead branch, so a six-phase plan the client
//      computed and sent was silently discarded on every run.
//
// The farmer's real plan — 7 beds, 4 staple plots, 5 trees, a 2 500 L tank, 34 m of on-contour
// swale — sat in DesignCanvasState one accessor away, and the report told the model it did not
// exist. Combined with the (correct, keep it) anti-invention system prompt, the model was
// instructed to ignore the tank that is visibly on the plan and then recommend buying one.
//
// This module is the fact carrier. It is PURE — no window, no storage, no fetch, no react — so
// the API route can import it. The COLLECTOR that reads localStorage lives next door in
// lib/report-site-facts-collect.ts and only the client imports it.
//
// THE ONE RULE. Absence is a fact and must be printed as one. Every optional field below means
// "not drawn and not recorded", and every renderer here says so in words rather than substituting
// a plausible default. The hardcoded `100m² roof` this replaces is exactly that failure: a farm
// with no traced roof was given someone else's roof and a rainwater yield computed from it.

import { ASSURANCE_PARAGRAPHS, ASSURANCE_TITLE } from '@/lib/plan-assurance';
import { WATER_SHEET_ROOF_RUNOFF_COEFFICIENT, roofHarvestLitres } from '@/lib/roof-runoff';

// ── Types ─────────────────────────────────────────────────────────────────────────────────────

export type FactStatus = 'existing' | 'proposed' | 'mixed';

/** A group of placed elements sharing one display name — the legend's own grouping rule. */
export interface FactElementGroup {
  name: string;
  category: string;
  count: number;
  status: FactStatus;
  /**
   * The catalog id from lib/design-elements.ts ('jojo_5000', 'tree_citrus', …).
   *
   * `name` is the DISPLAY name and the farmer may rename any item, so it is not a key — two
   * farmers' "Big tank" are not the same product, and one farmer's renamed tank stops matching
   * itself. The BOQ prices off this id (lib/report-boq.ts) precisely so a rename cannot change
   * a cost. Optional because a report generated before this field shipped has no id, and an
   * unpriced line is the correct outcome there rather than a guess from the label.
   */
  defId?: string;
}

export interface FactRoute {
  label: string;
  count: number;
  totalLengthM: number;
  /**
   * The traced line's kind ('swale' | 'fence' | 'path' | 'pipe' | 'drip' | 'windbreak' |
   * 'bedpath' | 'greywater'), carried for the same reason as `defId` above: `label` is prose
   * ("Swale (on-contour earthwork)") and prose is not a rate key.
   */
  kind?: string;
}

/** A rotation unit: an item bed, or a traced staple plot. */
export interface FactBed {
  label: string;
  areaM2: number;
  kind: 'bed' | 'plot';
}

export interface FactTank {
  name: string;
  count: number;
  /** Litres stated by the catalog name. NULL means the size is genuinely unknown — never guessed. */
  statedLitres: number | null;
  status: FactStatus;
}

export interface FactWaterPoint {
  name: string;
  category: string;
}

export interface FactZone {
  zone: number;
  label: string;
  areaM2: number;
  /** Display names of the elements whose centre falls inside this ring. */
  contains: string[];
  /** Traced staple plots whose centre falls inside this ring. */
  staplePlots: number;
}

export interface FactMeasuredArea {
  areaM2: number;
  perimeterM?: number;
  /** Human-readable provenance, printed verbatim beside the figure. */
  source: string;
  label?: string;
}

export interface FactDesign {
  beds: FactBed[];
  bedCount: number;
  bedAreaM2: number;
  plotCount: number;
  plotAreaM2: number;
  growingAreaM2: number;
  /** Everything placed that is NOT a bed (trees, tanks, structures), grouped by name. */
  elements: FactElementGroup[];
  routes: FactRoute[];
  zones: FactZone[];
  savedAt?: string;
}

export interface FactWater {
  tanks: FactTank[];
  /** Sum of the capacities that are actually stated. Tanks of unknown size are NOT counted. */
  statedStorageLitres: number;
  tanksOfUnknownCapacity: number;
  mapPoints: FactWaterPoint[];
  /** Water BODIES found in either source — a dam, pond, borehole, spring or well. */
  bodies: FactWaterPoint[];
}

export interface FactMeasurements {
  /** The farmer's own ground-scale correction. Present only when they actually set one. */
  scaleFactor?: number;
  localWindFrom?: string;
  localWindStrongestFrom?: string;
  dailyWaterUseL?: number;
}

export interface FactCropPlan {
  plantingCount: number;
  bedsPlanted: number;
  /** One row per crop the farmer actually put in the plan. No yields — see the note below. */
  crops: Array<{ name: string; sowMonths: string[]; bedLabels: string[]; alreadyGrowing: boolean }>;
}

export interface ReportSiteFacts {
  farmName?: string;
  design?: FactDesign;
  water?: FactWater;
  roof?: FactMeasuredArea;
  boundary?: FactMeasuredArea;
  measurements?: FactMeasurements;
  crop?: FactCropPlan;
}

// ── Formatting ────────────────────────────────────────────────────────────────────────────────
// Locale-independent on purpose: this text is built on a server whose locale is not the reader's,
// and it is also drawn into a jsPDF document whose default font is WinAnsi-only. Commas and plain
// ASCII spaces survive both; Intl's narrow no-break space does not.

function group(n: number): string {
  const rounded = Math.round(n);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function m2(n: number): string {
  return `${group(n)} m²`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** "34 m" / "12.6 m" — a tenth only where it carries information. */
function metres(n: number): string {
  const r = round1(n);
  return `${Number.isInteger(r) ? r : r.toFixed(1)} m`;
}

function litres(n: number): string {
  return `${group(n)} L`;
}

function listAnd(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// ── Validation (server side) ──────────────────────────────────────────────────────────────────
// The facts arrive over HTTP from a client we do not control. A NaN or an Infinity reaching a
// template literal prints "NaN m²" in a document a farmer spends money against, and an unbounded
// array is a cheap way to inflate every parallel prompt. Everything below is clamped or dropped.

const MAX_ROWS = 40;
const MAX_TEXT = 80;

function isRec(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, { min = 0, max = 1e9 }: { min?: number; max?: number } = {}): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function text(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function rows<T>(value: unknown, map: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value.slice(0, MAX_ROWS)) {
    const mapped = map(item);
    if (mapped) out.push(mapped);
  }
  return out;
}

function status(value: unknown): FactStatus {
  return value === 'existing' || value === 'mixed' ? value : 'proposed';
}

/**
 * Parse an untrusted `siteFacts` body field into the typed facts, or null.
 *
 * Deliberately lossy: an unparseable row is DROPPED rather than defaulted, because a defaulted
 * row is exactly the silent substitution this whole module exists to prevent.
 */
export function normaliseReportSiteFacts(value: unknown): ReportSiteFacts | null {
  if (!isRec(value)) return null;
  const facts: ReportSiteFacts = {};

  const farmName = text(value.farmName, 60);
  if (farmName) facts.farmName = farmName;

  if (isRec(value.design)) {
    const d = value.design;
    const beds = rows<FactBed>(d.beds, (item) => {
      if (!isRec(item)) return null;
      const label = text(item.label, 40);
      const areaM2 = num(item.areaM2, { min: 0.01, max: 1e7 });
      if (!label || areaM2 === null) return null;
      return { label, areaM2: round1(areaM2), kind: item.kind === 'plot' ? 'plot' : 'bed' };
    });
    const elements = rows<FactElementGroup>(d.elements, (item) => {
      if (!isRec(item)) return null;
      const name = text(item.name, 48);
      const count = num(item.count, { min: 1, max: 10000 });
      if (!name || count === null) return null;
      const defId = text(item.defId, 40);
      return {
        name,
        category: text(item.category, 20) ?? 'other',
        count: Math.round(count),
        status: status(item.status),
        ...(defId ? { defId } : {}),
      };
    });
    const routes = rows<FactRoute>(d.routes, (item) => {
      if (!isRec(item)) return null;
      const label = text(item.label, 48);
      const totalLengthM = num(item.totalLengthM, { min: 0.1, max: 1e6 });
      const count = num(item.count, { min: 1, max: 10000 });
      if (!label || totalLengthM === null || count === null) return null;
      const kind = text(item.kind, 24);
      return {
        label,
        count: Math.round(count),
        totalLengthM: round1(totalLengthM),
        ...(kind ? { kind } : {}),
      };
    });
    const zones = rows<FactZone>(d.zones, (item) => {
      if (!isRec(item)) return null;
      const zone = num(item.zone, { min: 0, max: 5 });
      const areaM2 = num(item.areaM2, { min: 0.01, max: 1e8 });
      if (zone === null || areaM2 === null) return null;
      const contains = rows<string>(item.contains, (name) => text(name, 48));
      const staplePlots = num(item.staplePlots, { min: 0, max: 1000 }) ?? 0;
      return {
        zone: Math.round(zone),
        label: text(item.label, 40) ?? `Zone ${Math.round(zone)}`,
        areaM2: Math.round(areaM2),
        contains,
        staplePlots: Math.round(staplePlots),
      };
    });

    const bedRows = beds.filter((b) => b.kind === 'bed');
    const plotRows = beds.filter((b) => b.kind === 'plot');
    const bedAreaM2 = round1(bedRows.reduce((sum, b) => sum + b.areaM2, 0));
    const plotAreaM2 = round1(plotRows.reduce((sum, b) => sum + b.areaM2, 0));

    if (beds.length || elements.length || routes.length || zones.length) {
      facts.design = {
        beds,
        bedCount: bedRows.length,
        bedAreaM2,
        plotCount: plotRows.length,
        plotAreaM2,
        growingAreaM2: round1(bedAreaM2 + plotAreaM2),
        elements,
        routes,
        zones,
        ...(text(d.savedAt, 40) ? { savedAt: text(d.savedAt, 40)! } : {}),
      };
    }
  }

  if (isRec(value.water)) {
    const w = value.water;
    const tanks = rows<FactTank>(w.tanks, (item) => {
      if (!isRec(item)) return null;
      const name = text(item.name, 48);
      const count = num(item.count, { min: 1, max: 10000 });
      if (!name || count === null) return null;
      const stated = num(item.statedLitres, { min: 1, max: 1e7 });
      return { name, count: Math.round(count), statedLitres: stated, status: status(item.status) };
    });
    const point = (item: unknown): FactWaterPoint | null => {
      if (!isRec(item)) return null;
      const name = text(item.name, 48);
      if (!name) return null;
      return { name, category: text(item.category, 24) ?? 'Other' };
    };
    const mapPoints = rows<FactWaterPoint>(w.mapPoints, point);
    const bodies = rows<FactWaterPoint>(w.bodies, point);
    if (tanks.length || mapPoints.length || bodies.length) {
      facts.water = {
        tanks,
        statedStorageLitres: tanks.reduce((sum, t) => sum + (t.statedLitres ?? 0) * t.count, 0),
        tanksOfUnknownCapacity: tanks.filter((t) => t.statedLitres === null).length,
        mapPoints,
        bodies,
      };
    }
  }

  const area = (value_: unknown): FactMeasuredArea | null => {
    if (!isRec(value_)) return null;
    const areaM2 = num(value_.areaM2, { min: 0.01, max: 1e9 });
    const source = text(value_.source, 60);
    if (areaM2 === null || !source) return null;
    const perimeterM = num(value_.perimeterM, { min: 0.1, max: 1e6 });
    return {
      areaM2,
      source,
      ...(perimeterM !== null ? { perimeterM } : {}),
      ...(text(value_.label, 48) ? { label: text(value_.label, 48)! } : {}),
    };
  };
  const roof = area(value.roof);
  if (roof) facts.roof = roof;
  const boundary = area(value.boundary);
  if (boundary) facts.boundary = boundary;

  if (isRec(value.measurements)) {
    const m = value.measurements;
    const measurements: FactMeasurements = {};
    const scaleFactor = num(m.scaleFactor, { min: 0.01, max: 100 });
    if (scaleFactor !== null && scaleFactor !== 1) measurements.scaleFactor = scaleFactor;
    const windFrom = text(m.localWindFrom, 8);
    if (windFrom) measurements.localWindFrom = windFrom;
    const strongest = text(m.localWindStrongestFrom, 8);
    if (strongest) measurements.localWindStrongestFrom = strongest;
    const dailyWater = num(m.dailyWaterUseL, { min: 1, max: 1e6 });
    if (dailyWater !== null) measurements.dailyWaterUseL = dailyWater;
    if (Object.keys(measurements).length) facts.measurements = measurements;
  }

  if (isRec(value.crop)) {
    const c = value.crop;
    const crops = rows<FactCropPlan['crops'][number]>(c.crops, (item) => {
      if (!isRec(item)) return null;
      const name = text(item.name, 40);
      if (!name) return null;
      return {
        name,
        sowMonths: rows<string>(item.sowMonths, (month) => text(month, 12)),
        bedLabels: rows<string>(item.bedLabels, (label) => text(label, 40)),
        alreadyGrowing: item.alreadyGrowing === true,
      };
    });
    const plantingCount = num(c.plantingCount, { min: 1, max: 10000 });
    if (crops.length && plantingCount !== null) {
      facts.crop = {
        plantingCount: Math.round(plantingCount),
        bedsPlanted: Math.round(num(c.bedsPlanted, { min: 0, max: 10000 }) ?? 0),
        crops,
      };
    }
  }

  return Object.keys(facts).length ? facts : null;
}

/** True when there is enough drawn geometry to describe a real plan. */
export function hasDrawnDesign(facts: ReportSiteFacts | null | undefined): boolean {
  const design = facts?.design;
  return Boolean(design && (design.beds.length || design.elements.length || design.routes.length));
}

// ── Water-body absence ────────────────────────────────────────────────────────────────────────

/** The structures the model has historically invented, and the words it invents them with. */
const WATER_BODY_KINDS = ['dam', 'pond', 'reservoir', 'borehole', 'well', 'spring', 'river'] as const;

const BODY_MATCHERS: Record<(typeof WATER_BODY_KINDS)[number], RegExp> = {
  dam: /\bdam\b/i,
  pond: /\bpond\b/i,
  reservoir: /\breservoir\b/i,
  borehole: /\bbore ?hole\b/i,
  well: /\bwell\b/i,
  spring: /\bspring\b/i,
  river: /\briver|stream\b/i,
};

/**
 * Which of the classic water bodies are genuinely absent from BOTH the drawn design and the
 * recorded map. Anything a farmer did record is removed from the denial, so the report can never
 * again tell a farmer that the dam they mapped does not exist — nor invent one they did not.
 */
export function absentWaterBodies(
  facts: ReportSiteFacts | null | undefined,
  hasMapWaterPolygons: boolean,
): string[] {
  if (hasMapWaterPolygons) return [];
  const recorded = [
    ...(facts?.water?.bodies ?? []),
    ...(facts?.water?.mapPoints ?? []),
  ].map((p) => `${p.name} ${p.category}`);
  return WATER_BODY_KINDS.filter((kind) => !recorded.some((entry) => BODY_MATCHERS[kind].test(entry)));
}

// ── Prompt blocks ─────────────────────────────────────────────────────────────────────────────

function elementLine(groups: FactElementGroup[]): string {
  return groups
    .map((g) => `${g.name} x${g.count}${g.status === 'existing' ? ' (already there)' : g.status === 'mixed' ? ' (some already there)' : ''}`)
    .join(' · ');
}

/**
 * The DESIGN AS DRAWN block. Replaces the branch that could never run.
 *
 * Kept to grouped summaries rather than raw arrays on purpose: buildPrompt() is rebuilt once per
 * concurrent batch, so every line here is paid for ~11 times on a comprehensive report.
 */
export function designPromptBlock(facts: ReportSiteFacts): string {
  const d = facts.design;
  if (!d) {
    return 'DESIGN AS DRAWN\nNo design has been drawn for this site yet. Do not describe a drawn layout, a bed count, or a planted area as if one exists.';
  }
  const lines: string[] = [];
  lines.push(`DESIGN AS DRAWN — the saved plan for ${facts.farmName ?? 'this site'}, drawn by the farmer. Counts are their own placements; lengths and areas are measured off the traced geometry at this site's ground scale. TREAT ALL OF IT AS FACT: do not add to it, rename it, re-count it or round it.${facts.farmName ? ` Call the site "${facts.farmName}" throughout — that is its name, not the label on any one traced shape.` : ''}`);

  if (d.bedCount > 0) {
    const bedList = d.beds.filter((b) => b.kind === 'bed').map((b) => `${b.label} ${round1(b.areaM2)}m²`).join(', ');
    lines.push(`· Growing beds: ${d.bedCount} drawn, ${m2(d.bedAreaM2)} in total (${bedList})`);
  }
  if (d.plotCount > 0) {
    lines.push(`· Traced staple plots (field-scale rotation): ${d.plotCount}, ${m2(d.plotAreaM2)} in total`);
  }
  if (d.growingAreaM2 > 0) {
    lines.push(`· TOTAL DRAWN GROWING AREA: ${m2(d.growingAreaM2)}. Every per-area figure you calculate (water, seed, compost, yield) must be scaled to this, not to the whole property.`);
  }

  const byCategory = (category: string) => d.elements.filter((g) => g.category === category);
  const growing = byCategory('growing');
  if (growing.length) lines.push(`· Trees and perennials placed: ${elementLine(growing)}`);
  const water = byCategory('water');
  if (water.length) lines.push(`· Water infrastructure placed: ${elementLine(water)}`);
  const structures = [...byCategory('structure'), ...byCategory('animal'), ...byCategory('access')];
  if (structures.length) lines.push(`· Structures placed: ${elementLine(structures)}`);
  const earthworks = byCategory('earthworks');
  if (earthworks.length) lines.push(`· Earthworks placed: ${elementLine(earthworks)}`);

  if (d.routes.length) {
    lines.push(`· Routes and earthwork lines traced: ${d.routes.map((r) => `${r.label} ${metres(r.totalLengthM)}${r.count > 1 ? ` across ${r.count} runs` : ''}`).join(' · ')}`);
  }
  if (d.zones.length) {
    lines.push(`· Permaculture zones the farmer has drawn: ${d.zones.map((z) => `Zone ${z.zone} (${m2(z.areaM2)})`).join(' · ')}`);
  }

  const proposed = d.elements.filter((g) => g.status === 'proposed');
  const existing = d.elements.filter((g) => g.status !== 'proposed');
  if (proposed.length && !existing.length) {
    lines.push('· STATUS: every element above is drawn as PROPOSED — planned, not yet built. Write about them as the farmer\'s plan ("as drawn on your plan"), never as things already standing, and never as your own new idea.');
  } else if (existing.length) {
    lines.push(`· STATUS: already on the farm — ${existing.map((g) => g.name).join(', ')}. Everything else above is drawn as PROPOSED (planned, not yet built).`);
  }
  if (d.savedAt) lines.push(`· Plan last saved: ${d.savedAt}`);
  return lines.join('\n');
}

/**
 * WATER ON SITE. Replaces the blanket denial that used to fire on any farm without a water-typed
 * MAP POLYGON — which is most farms, including one with a 2 500 L tank on its own plan.
 */
export function waterPromptBlock(
  facts: ReportSiteFacts | null | undefined,
  hasMapWaterPolygons: boolean,
): string {
  const lines: string[] = ['WATER ON SITE (drawn or recorded by the farmer — real)'];
  const water = facts?.water;
  let any = false;

  if (water?.tanks.length) {
    any = true;
    for (const tank of water.tanks) {
      const capacity = tank.statedLitres === null
        ? 'capacity not stated — do NOT assume one'
        : `${litres(tank.statedLitres)} stated capacity each`;
      lines.push(`· ${tank.name} x${tank.count} — ${capacity}${tank.status === 'proposed' ? ' (drawn as PROPOSED — to buy/build, not yet standing)' : ''}`);
    }
    if (water.statedStorageLitres > 0) {
      lines.push(`· Total stated tank storage on the plan: ${litres(water.statedStorageLitres)}${water.tanksOfUnknownCapacity > 0 ? ` (plus ${water.tanksOfUnknownCapacity} tank(s) whose size is not stated and must not be guessed)` : ''}.`);
    }
  }
  if (water?.mapPoints.length) {
    any = true;
    lines.push(`· Water points the farmer pinned on the map: ${water.mapPoints.map((p) => `${p.name}${p.category && p.category !== 'Other' ? ` [${p.category}]` : ''}`).join(' · ')}`);
  }
  const waterRoutes = facts?.design?.routes.filter((r) => /water|pipe|drip|greywater|swale/i.test(r.label)) ?? [];
  if (waterRoutes.length) {
    any = true;
    lines.push(`· Water lines and earthworks traced: ${waterRoutes.map((r) => `${r.label} ${metres(r.totalLengthM)}`).join(' · ')}`);
  }
  if (!any) {
    lines.push('· Nothing. No tank, no water point and no water line has been drawn or recorded for this site.');
  }

  // A tank on the plan and a tank pinned on the map are very often the SAME tank. Saying so is
  // the honest reading; adding their capacities together is how a farm ends up with twice the
  // storage it owns.
  if (water?.tanks.length && water.mapPoints.some((point) => /tank/i.test(`${point.name} ${point.category}`))) {
    lines.push('· NOTE: a tank appears both drawn on the plan and pinned on the map. These are most likely the SAME tank. Count the storage once. If you refer to both, describe them as one tank recorded twice — and do not repeat this instruction in your prose.');
  }

  const absent = absentWaterBodies(facts, hasMapWaterPolygons);
  if (absent.length) {
    lines.push(
      `NOT PRESENT: there is no ${absent.join(', no ')} drawn or recorded on this site. `
      + 'Do not describe any of them as existing, and never attach a capacity, depth, water level, '
      + 'percentage or age to storage that is not listed above. Storage you recommend must be written '
      + 'plainly as something to BUILD or BUY.',
    );
  }
  return lines.join('\n');
}

/** The roof-catchment line. Replaces `100m² roof` — a stranger's roof on every farm on Earth. */
export function roofCalcLine(facts: ReportSiteFacts | null | undefined, rainfallMm: number): string {
  const roof = facts?.roof;
  if (!roof || !(roof.areaM2 > 0)) {
    return '- **Roof catchment yield:** no roof has been traced or measured for this site, so there is NO roof area to calculate from. '
      + 'Say exactly that, give the rule (1m² of roof × 1mm of rain = 1L, × runoff coefficient '
      + `${WATER_SHEET_ROOF_RUNOFF_COEFFICIENT}), and ask the farmer to trace or measure their roof. Do NOT assume a roof size.`;
  }
  const yieldL = Math.round(roofHarvestLitres(roof.areaM2, rainfallMm, WATER_SHEET_ROOF_RUNOFF_COEFFICIENT));
  const stored = facts?.water?.statedStorageLitres ?? 0;
  const storedNote = stored > 0
    ? ` The plan's stated tank storage is ${litres(stored)} — that is ${Math.round((stored / Math.max(yieldL, 1)) * 100)}% of one year's harvest off this roof, so state plainly what the binding constraint is (storage, or catchment).`
    : ' No tank storage is drawn yet, so this whole harvest currently runs to waste — say so.';
  return `- **Roof catchment yield:** the traced roof on this site is **${m2(roof.areaM2)}** (${roof.source}). `
    + `1m² of roof × 1mm of rain = 1L, so ${group(roof.areaM2)} × ${rainfallMm}mm × reviewed runoff coefficient `
    + `${WATER_SHEET_ROOF_RUNOFF_COEFFICIENT} = **${litres(yieldL)} usable/year**.${storedNote}`;
}

/** Pre-filled sizes for the Irrigation Plan table, so the model supplies method not measurements. */
export function irrigationRowsBlock(facts: ReportSiteFacts | null | undefined): string {
  const d = facts?.design;
  if (!d || d.beds.length === 0) {
    return '| Growing area | Size | Daily need (dry season) | Over the dry season | Best method |\n'
      + '|--------------|------|--------------------------|---------------------|-------------|\n'
      + '| Kitchen garden | [no bed has been drawn — say the size is not known and ask the farmer to draw or measure it] | [L/day] | [L total] | [drip / mulch basin] |';
  }
  const rows_: string[] = [
    '| Growing area | Size | Daily need (dry season) | Over the dry season | Best method |',
    '|--------------|------|--------------------------|---------------------|-------------|',
  ];
  for (const bed of d.beds.filter((b) => b.kind === 'bed')) {
    rows_.push(`| ${bed.label} | ${round1(bed.areaM2)} m² | [L/day] | [L total] | [method] |`);
  }
  if (d.plotCount > 0) {
    rows_.push(`| Staple plots (${d.plotCount}) | ${round1(d.plotAreaM2)} m² | [L/day] | [L total] | [method] |`);
  }
  const trees = d.elements.filter((g) => g.category === 'growing');
  const treeCount = trees.reduce((sum, g) => sum + g.count, 0);
  if (treeCount > 0) {
    rows_.push(`| ${treeCount} placed trees (${trees.map((g) => `${g.name} x${g.count}`).join(', ')}) | per-tree basin | [L/day] | [L total] | [deep watering] |`);
  }
  rows_.push('');
  rows_.push(`Use these EXACT drawn sizes — do not invent a garden size. Total drawn growing area: ${m2(d.growingAreaM2)} (${m2(d.bedAreaM2)} of beds + ${m2(d.plotAreaM2)} of staple plots).`);
  return rows_.join('\n');
}

/** Zone Design, built from the rings the farmer actually drew. */
export function zonePromptBlock(facts: ReportSiteFacts | null | undefined): string {
  const zones = facts?.design?.zones ?? [];
  if (zones.length === 0) {
    return 'No permaculture zones have been drawn for this site. Give zone guidance as a RECOMMENDATION for this terrain, '
      + 'and say plainly that the farmer has not drawn zones yet — never describe a drawn zone that does not exist.';
  }
  const drawn = new Set(zones.map((z) => z.zone));
  const missing = [0, 1, 2, 3, 4, 5].filter((z) => !drawn.has(z));
  const lines = zones.map((z) => {
    const contents = z.contains.length
      ? `contains ${listAnd(z.contains)}`
      : 'no elements have been placed inside it yet';
    const plots = z.staplePlots > 0 ? `, plus ${z.staplePlots} traced staple plot${z.staplePlots === 1 ? '' : 's'}` : '';
    return `**Zone ${z.zone} — ${z.label} (DRAWN, ${m2(z.areaM2)}):** ${contents}${plots}. [What this ring should do next, given what is already in it.]`;
  });
  lines.push('');
  lines.push(
    missing.length
      ? `Zone${missing.length === 1 ? '' : 's'} ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} NOT drawn on this plan — say so rather than describing them, and suggest whether one is worth adding.`
      : 'Every zone from 0 to 5 is drawn on this plan.',
  );
  lines.push('Use the drawn areas and contents above verbatim. Do not invent a zone, a zone area, or a thing inside a zone.');
  return lines.join('\n');
}

/** The farmer's own on-the-ground measurements — evidence a real person walked the land. */
export function measurementsPromptBlock(facts: ReportSiteFacts | null | undefined): string {
  const m = facts?.measurements;
  if (!m || Object.keys(m).length === 0) return '';
  const lines = ['FARMER\'S OWN MEASUREMENTS (these outrank the models — they measured it on site)'];
  if (m.scaleFactor !== undefined) {
    lines.push(`· Ground scale corrected by the farmer to ${m.scaleFactor}x the satellite projection. Every area and length above already includes this correction.`);
  }
  if (m.localWindFrom) {
    lines.push(`· Wind observed on site as coming FROM the ${m.localWindFrom}${m.localWindStrongestFrom ? `, strongest from the ${m.localWindStrongestFrom}` : ''}. Prefer this over the regional wind table when siting windbreaks, and say you are doing so.`);
  }
  if (m.dailyWaterUseL !== undefined) {
    lines.push(`· Household water use stated by the farmer: ${litres(m.dailyWaterUseL)}/day. Use this figure in the water balance instead of a household estimate.`);
  }
  return lines.join('\n');
}

/** The crop plan the farmer has actually entered — dates and beds, deliberately no yields. */
export function cropPlanPromptBlock(facts: ReportSiteFacts | null | undefined): string {
  const crop = facts?.crop;
  if (!crop) return '';
  const lines = [
    `CROP PLAN ALREADY ENTERED BY THE FARMER (${crop.plantingCount} plantings across ${crop.bedsPlanted} beds/plots)`,
  ];
  for (const row of crop.crops) {
    lines.push(`· ${row.name} — sown ${row.sowMonths.join(', ')}${row.bedLabels.length ? ` in ${row.bedLabels.join(', ')}` : ''}${row.alreadyGrowing ? ' (already in the ground)' : ''}`);
  }
  lines.push(
    'Build the Planting Calendar, Crop Rotation and Year-Round Food Production sections AROUND this existing plan: '
    + 'name these crops and these beds, say what the plan already covers, and only then name the gaps it does not. '
    + 'Do NOT print a yield or an income figure for any of them — this app does not stand behind a predicted yield in this document.',
  );
  return lines.join('\n');
}

// ── Deterministic report front matter ─────────────────────────────────────────────────────────

export interface ReportHeaderInput {
  facts: ReportSiteFacts | null | undefined;
  biomeName: string;
  vegUnit?: string | null;
  bruLabel?: string | null;
  adminLabel?: string | null;
  lat: number;
  lon: number;
  dateLabel: string;
  rainfallMm: number;
  rainfallSource?: string;
  wetSeason: string;
  drySeason: string;
  soilPh: number;
  soilOrganicCarbon: number;
  soilTexture: string;
  soilSource?: 'lab' | 'soilgrids' | 'estimate';
  elevationM: number;
  slopeDeg: number;
  aspectLabel: string;
  /** Whole-property figures from the map, used only when no traced boundary exists. */
  siteAreaM2?: number;
  sitePerimeterM?: number;
  hasMapWaterPolygons: boolean;
  /**
   * Drop the `# ` title and the standfirst, emitting only the Site at a Glance table.
   *
   * Set when a cover page (lib/report-cover.ts) has already opened the document. A markdown file
   * with two `# ` lines has two roots, and every downstream consumer — the contents builder, the
   * PDF exporter, the in-app reader's heading outline — then disagrees about which one is the
   * document's title. Defaults to false so the pre-cover behaviour is unchanged.
   */
  omitTitle?: boolean;
}

const SOIL_SOURCE_LABEL: Record<string, string> = {
  lab: 'Soil test you uploaded',
  soilgrids: 'ISRIC SoilGrids model (district-wide, not your field)',
  estimate: 'NOT A READING — the app\'s generic defaults',
};

/**
 * The title, the standfirst and the SITE AT A GLANCE table — written in CODE, not by the model.
 *
 * This is the block a funder reads first, so not one number in it may be generated. Every row is
 * either measured off the farmer's own map or read straight from the named data source, and the
 * source column says which. Rows whose datum is missing are omitted entirely; what is missing is
 * then stated once, on purpose, in the last row.
 */
export function buildReportHeaderMarkdown(input: ReportHeaderInput): string {
  const { facts } = input;
  const out: string[] = [];

  if (!input.omitTitle) {
    const title = facts?.farmName
      ? `# Site Report — ${facts.farmName}`
      : '# Permaculture Site Report';
    out.push(title);
    const standfirstParts = [
      input.vegUnit ? `${input.vegUnit} (${input.biomeName})` : input.biomeName,
      input.adminLabel ?? null,
      `${Math.abs(input.lat).toFixed(4)}°S, ${input.lon.toFixed(4)}°E`,
      input.dateLabel,
    ].filter(Boolean) as string[];
    out.push('');
    out.push(standfirstParts.join(' · '));
    out.push('');
  }
  out.push('## Site at a Glance');
  out.push('');
  out.push('Nothing in this table was written by the report generator. Each figure is either measured off this farm\'s own map or read from the data source named beside it.');
  out.push('');
  out.push('| Measure | Value | Where it comes from |');
  out.push('|---------|-------|---------------------|');

  const row = (measure: string, value: string, source: string) => out.push(`| ${measure} | ${value} | ${source} |`);

  if (facts?.farmName) row('Site', facts.farmName, 'Named by the farmer');

  const boundary = facts?.boundary;
  if (boundary) {
    const ha = boundary.areaM2 / 10000;
    row(
      'Property boundary',
      `${m2(boundary.areaM2)} (${ha.toFixed(ha < 1 ? 3 : 2)} ha)${boundary.perimeterM ? `, ${metres(boundary.perimeterM)} perimeter` : ''}`,
      boundary.source,
    );
  } else if (input.siteAreaM2 && input.siteAreaM2 > 0) {
    row(
      'Mapped site area',
      `${m2(input.siteAreaM2)}${input.sitePerimeterM ? `, ${metres(input.sitePerimeterM)} perimeter` : ''}`,
      'Sum of every shape drawn on the map (not a single traced boundary)',
    );
  } else {
    row('Property boundary', 'Not traced', 'Nothing drawn on the map yet');
  }

  const d = facts?.design;
  if (d && d.growingAreaM2 > 0) {
    const parts: string[] = [];
    if (d.bedCount) parts.push(`${d.bedCount} bed${d.bedCount === 1 ? '' : 's'} ${m2(d.bedAreaM2)}`);
    if (d.plotCount) parts.push(`${d.plotCount} staple plot${d.plotCount === 1 ? '' : 's'} ${m2(d.plotAreaM2)}`);
    row('Growing area drawn', `${m2(d.growingAreaM2)} — ${parts.join(' + ')}`, 'Measured off the farmer\'s plan');
  }
  const trees = d?.elements.filter((g) => g.category === 'growing') ?? [];
  if (trees.length) {
    const total = trees.reduce((sum, g) => sum + g.count, 0);
    row('Trees and perennials placed', `${total} — ${trees.map((g) => `${g.name} x${g.count}`).join(', ')}`, 'Placed by the farmer in the Design Studio');
  }
  const structures = d?.elements.filter((g) => g.category === 'structure' || g.category === 'animal' || g.category === 'access') ?? [];
  if (structures.length) {
    row('Structures placed', structures.map((g) => `${g.name} x${g.count}`).join(', '), 'Placed by the farmer in the Design Studio');
  }
  if (d?.routes.length) {
    row('Earthworks and routes', d.routes.map((r) => `${r.label.replace(/ \(.*\)$/, '')} ${metres(r.totalLengthM)}`).join(' · '), 'Measured off the traced lines');
  }
  if (d?.zones.length) {
    row('Permaculture zones drawn', d.zones.map((z) => `Zone ${z.zone} ${m2(z.areaM2)}`).join(' · '), 'Rings drawn by the farmer');
  }

  const water = facts?.water;
  if (water?.tanks.length) {
    const stated = water.statedStorageLitres > 0 ? litres(water.statedStorageLitres) : 'capacity not stated';
    const proposedOnly = water.tanks.every((t) => t.status === 'proposed');
    row('Water storage on the plan', `${stated} — ${water.tanks.map((t) => `${t.name} x${t.count}`).join(', ')}${proposedOnly ? ' (drawn as proposed)' : ''}`, 'Design Studio');
  }
  if (water?.mapPoints.length) {
    row('Water points recorded', water.mapPoints.map((p) => `${p.name}${p.category && p.category !== 'Other' ? ` [${p.category}]` : ''}`).join(' · '), 'Pinned on the map by the farmer');
  }
  if (facts?.roof && facts.roof.areaM2 > 0) {
    const harvest = Math.round(roofHarvestLitres(facts.roof.areaM2, input.rainfallMm, WATER_SHEET_ROOF_RUNOFF_COEFFICIENT));
    row('Roof catchment traced', `${m2(facts.roof.areaM2)} → ${litres(harvest)}/yr at ${WATER_SHEET_ROOF_RUNOFF_COEFFICIENT} runoff`, facts.roof.source);
  } else {
    row('Roof catchment', 'Not traced or measured', 'No roof outline on the map');
  }
  if (facts?.crop) {
    row('Crop plan entered', `${facts.crop.plantingCount} plantings, ${facts.crop.crops.length} crops, across ${facts.crop.bedsPlanted} beds/plots`, 'Entered by the farmer in the crop planner');
  }
  if (facts?.measurements?.scaleFactor !== undefined) {
    row('Farmer\'s scale correction', `${facts.measurements.scaleFactor}x applied to every area and length above`, 'Measured on site by the farmer');
  }
  if (facts?.measurements?.localWindFrom) {
    row('Wind observed on site', `From the ${facts.measurements.localWindFrom}${facts.measurements.localWindStrongestFrom ? `, strongest from the ${facts.measurements.localWindStrongestFrom}` : ''}`, 'Farmer\'s own observation');
  }

  row('Annual rainfall', `${input.rainfallMm} mm — wet ${input.wetSeason}, dry ${input.drySeason}`, input.rainfallSource === 'nasa-power' ? 'NASA POWER' : input.rainfallSource === 'open-meteo' ? 'Open-Meteo' : 'Climate data service');
  if (input.vegUnit) row('Natural vegetation', input.vegUnit, 'SANBI 2018 National Vegetation Map');
  if (input.bruLabel) row('Agro-ecological zone', `Closest to ${input.bruLabel}`, 'KZN DARD bioresource units — a best-effort climate match, not a verified classification');
  row('Soil (0-30 cm)', `pH ${input.soilPh} · ${input.soilOrganicCarbon}% organic carbon · ${input.soilTexture}`, SOIL_SOURCE_LABEL[input.soilSource ?? ''] ?? 'Soil data source not recorded');
  row('Elevation, slope, aspect', `${input.elevationM} m · ${input.slopeDeg}° · faces ${input.aspectLabel}`, 'SRTM elevation model');

  const absent = absentWaterBodies(facts, input.hasMapWaterPolygons);
  if (absent.length) {
    row('Not on this site', `No ${absent.join(', no ')}`, 'Nothing of the kind drawn or recorded');
  }

  out.push('');
  return out.join('\n');
}

/**
 * The trust statement, verbatim from lib/plan-assurance.ts, as a report section.
 *
 * The crop-plan PDF has carried this since the agronomic review; the site report — the document
 * most likely to be handed to a funder or an extension officer — carried none of it. A generated
 * document that drops its caveats is worse than one that never had them.
 */
export function assuranceMarkdown(): string {
  return [`## ${ASSURANCE_TITLE}`, '', ...ASSURANCE_PARAGRAPHS.flatMap((p) => [p, ''])].join('\n');
}
