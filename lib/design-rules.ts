// Design Studio — AI-advisor rule engine.
//
// Pure function: takes the current canvas state + element catalog (+ optional site
// context) and returns a short, farmer-friendly list of warnings/tips. No I/O, no
// storage — the caller (a wizard step / review panel) decides how/when to call it.
//
// Southern-hemisphere convention: the frame is north-up with y increasing SOUTHWARD
// (screen/image convention: down = south in the southern hemisphere sun path). Sun
// travels through the northern sky, so shadows from a tall canopy fall to its south —
// i.e. toward larger y. A shade-caster at (x,y) shades sun-lovers at (x, y+δ).

import type { DesignCanvasState, LineShape, PlacedItem, ZoneShape } from '@/lib/design-canvas';
import { distM, pointInRing } from '@/lib/design-canvas';
import type { DesignElementDef } from '@/lib/design-elements';
import type { SectorSite } from '@/lib/sector';
import { effectiveSlopeForRing, recommendTerraceMethod } from '@/lib/terracing';

// Which design LAYER a piece of advice belongs to, so the advisor can show the farmer only the
// tips for the layer they're working on (a zones-step advisor showing tank/shade tips is noise).
export type AdviceLayer = 'water' | 'zones' | 'planting' | 'structures' | 'general';

export interface Advice {
  severity: 'warn' | 'tip';
  msg: string;
  itemId?: string;
  layer?: AdviceLayer;
}

export interface SiteContext {
  windFromSummer?: string;
  slopeDeg?: number;
  aspectLabel?: string;
  rainfallMm?: number;
  // Whole-site average slope (%) — the same value lib/sector.ts's SectorSite.elevation.slopePct
  // carries, threaded through here ONLY so the terrace-method tip below (§6) has an
  // effectiveSlopeForRing fallback when a ring has no farmer-measured slope of its own. See
  // docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §3/§6.
  slopePct?: number;
}

export interface SiteExtras {
  houseXY?: [number, number]; // normalised [0..1] house centroid, if traced on the base map
}

const FRAME_METRICS = (state: DesignCanvasState) => ({
  imgW: state.frame.imgW,
  imgH: state.frame.imgH,
  mPerPx: state.frame.mPerPx,
});

function defFor(defs: Record<string, DesignElementDef>, item: PlacedItem): DesignElementDef | undefined {
  return defs[item.defId];
}

function widthM(def: DesignElementDef, item: PlacedItem): number {
  return item.wM ?? def.wM;
}

function findZoneForPoint(
  pt: [number, number],
  zones: ZoneShape[],
): 0 | 1 | 2 | 3 | 4 | 5 | null {
  for (const z of zones) {
    if (z.points.length >= 3 && pointInRing(pt, z.points)) return z.zone;
  }
  return null;
}

function pointToSegmentDistM(
  pt: [number, number],
  a: [number, number],
  b: [number, number],
  frame: ReturnType<typeof FRAME_METRICS>,
): number {
  // Work in metre-space so distance is accurate even with non-square aspect ratios.
  const px = pt[0] * frame.imgW * frame.mPerPx;
  const py = pt[1] * frame.imgH * frame.mPerPx;
  const ax = a[0] * frame.imgW * frame.mPerPx;
  const ay = a[1] * frame.imgH * frame.mPerPx;
  const bx = b[0] * frame.imgW * frame.mPerPx;
  const by = b[1] * frame.imgH * frame.mPerPx;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

function minDistToLine(
  pt: [number, number],
  line: LineShape,
  frame: ReturnType<typeof FRAME_METRICS>,
): number {
  if (line.points.length === 0) return Infinity;
  if (line.points.length === 1) return distM(pt, line.points[0], frame);
  let min = Infinity;
  for (let i = 0; i < line.points.length - 1; i++) {
    const d = pointToSegmentDistM(pt, line.points[i], line.points[i + 1], frame);
    if (d < min) min = d;
  }
  return min;
}

export function evaluateDesign(
  state: DesignCanvasState,
  defs: Record<string, DesignElementDef>,
  site?: SiteContext,
  siteExtras?: SiteExtras,
): Advice[] {
  const warns: Advice[] = [];
  const tips: Advice[] = [];
  const frame = FRAME_METRICS(state);
  const houseXY = siteExtras?.houseXY;

  // ── SHADE: canopy items shade sun-loving items to their south ──
  for (const t of state.items) {
    const tDef = defFor(defs, t);
    if (!tDef?.castsShade) continue;
    const canopyW = widthM(tDef, t);
    if (canopyW < 4) continue;
    for (const b of state.items) {
      if (b.id === t.id) continue;
      const bDef = defFor(defs, b);
      if (!bDef?.needsSun) continue;
      const isSouth = b.y > t.y; // y increases southward
      const dxM = Math.abs(b.x - t.x) * frame.imgW * frame.mPerPx;
      const d = distM([t.x, t.y], [b.x, b.y], frame);
      if (isSouth && dxM < canopyW && d < 1.6 * canopyW) {
        warns.push({
          severity: 'warn',
          msg: `The ${tDef.name} will shade the ${bDef.name} to its south — move the ${bDef.name} north of the tree or shift the tree south.`,
          itemId: b.id,
          layer: 'planting',
        });
      }
    }
  }

  // ── TANK NEAR ROOF ──
  const hasStructure = state.items.some((it) => defFor(defs, it)?.category === 'structure');
  for (const item of state.items) {
    const def = defFor(defs, item);
    if (!def?.nearRoofM) continue;
    const nearHouse = houseXY ? distM([item.x, item.y], houseXY, frame) <= def.nearRoofM : false;
    let nearAnyStructure = false;
    if (hasStructure) {
      for (const other of state.items) {
        if (other.id === item.id) continue;
        const otherDef = defFor(defs, other);
        if (otherDef?.category !== 'structure') continue;
        if (distM([item.x, item.y], [other.x, other.y], frame) <= def.nearRoofM) {
          nearAnyStructure = true;
          break;
        }
      }
    }
    if (!nearHouse && !nearAnyStructure) {
      warns.push({
        severity: 'warn',
        msg: `Place the ${def.name} within ~${def.nearRoofM} m of a roof so gutters can feed it.`,
        itemId: item.id,
        layer: 'water',
      });
    }
  }

  // ── ZONE FIT ──
  // Ground-feature areas (house/patio/lawn…) ride on ZoneShape but aren't effort-zones.
  const effortZones = state.zones.filter((z) => !z.feature);
  if (effortZones.length > 0) {
    for (const item of state.items) {
      const def = defFor(defs, item);
      if (!def?.zoneRec || def.zoneRec.length === 0) continue;
      const actual = findZoneForPoint([item.x, item.y], effortZones);
      if (actual !== null && !def.zoneRec.includes(actual)) {
        tips.push({
          severity: 'tip',
          msg: `${def.name} usually belongs in Zone ${def.zoneRec.join('/')} — it's in Zone ${actual}.`,
          itemId: item.id,
          layer: 'zones',
        });
      }
    }
  }

  // ── KITCHEN DISTANCE ──
  if (houseXY) {
    for (const item of state.items) {
      const def = defFor(defs, item);
      if (!def?.nearHouseMaxM) continue;
      const d = distM([item.x, item.y], houseXY, frame);
      if (d > def.nearHouseMaxM) {
        tips.push({
          severity: 'tip',
          msg: `${def.name} is ${Math.round(d)} m from the house — daily-use items work best within ${def.nearHouseMaxM} m.`,
          itemId: item.id,
          layer: 'planting',
        });
      }
    }
  }

  // ── BEEHIVE flight-path ──
  for (const item of state.items) {
    const def = defFor(defs, item);
    if (def?.id !== 'beehive') continue;
    let tooClose = houseXY ? distM([item.x, item.y], houseXY, frame) < 8 : false;
    if (!tooClose) {
      for (const line of state.lines) {
        if (line.kind !== 'path') continue;
        if (minDistToLine([item.x, item.y], line, frame) < 8) {
          tooClose = true;
          break;
        }
      }
    }
    if (tooClose) {
      warns.push({
        severity: 'warn',
        msg: `Beehive is within 8 m of the house or a path — bees' flight path could cross foot traffic. Move it further away or angle the entrance clear of traffic.`,
        itemId: item.id,
        layer: 'structures',
      });
    }
  }

  // ── CANOPY OVERLAP ──
  const shadeItems = state.items.filter((it) => defFor(defs, it)?.castsShade);
  for (let i = 0; i < shadeItems.length; i++) {
    for (let j = i + 1; j < shadeItems.length; j++) {
      const a = shadeItems[i];
      const b = shadeItems[j];
      const aDef = defFor(defs, a)!;
      const bDef = defFor(defs, b)!;
      const aR = widthM(aDef, a) / 2;
      const bR = widthM(bDef, b) / 2;
      const d = distM([a.x, a.y], [b.x, b.y], frame);
      const overlap = aR + bR - d;
      const smallerDiameter = 2 * Math.min(aR, bR);
      if (overlap > 0.25 * smallerDiameter) {
        tips.push({
          severity: 'tip',
          msg: `${aDef.name} and ${bDef.name} canopies will overlap significantly at maturity — consider more spacing.`,
          itemId: b.id,
          layer: 'planting',
        });
      }
    }
  }

  // ── BANANA CIRCLE feed source ──
  const bananaCircles = state.items.filter((it) => defFor(defs, it)?.id === 'banana_circle');
  for (const bc of bananaCircles) {
    const hasBasinNearby = state.items.some(
      (it) => defFor(defs, it)?.id === 'greywater_basin' && distM([it.x, it.y], [bc.x, bc.y], frame) <= 10,
    );
    const hasPipeNearby = state.lines.some(
      (line) => line.kind === 'pipe' && minDistToLine([bc.x, bc.y], line, frame) <= 10,
    );
    if (!hasBasinNearby && !hasPipeNearby) {
      tips.push({
        severity: 'tip',
        msg: `Feed the Banana Circle with greywater — add a greywater basin or pipe within 10 m.`,
        itemId: bc.id,
        layer: 'water',
      });
    }
  }

  // ── TERRACE METHOD — a tip, never a blocking gate ──
  // Extends the existing advisory-tip mechanism (the banana_circle pattern above is the precedent
  // named by EARTHWORKS-CONTEXT-PLAN Phase 4, "extend the existing advisor, not the canvas") with
  // a new rule: when a terrace/berm catalog element is placed, OR a terrace_bank ground ring is
  // completed, surface the §1 method recommendation as a tip. NEVER a blocking gate — this whole
  // app's pattern is disclosure over restriction, and this feature is no exception
  // (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §6 item 6).
  const siteAsSector: SectorSite | undefined =
    site?.slopePct != null ? { elevation: { slopeDeg: site.slopeDeg ?? 0, slopePct: site.slopePct, aspectDeg: 0, aspectLabel: '' } } : undefined;
  // Adversarially reviewed, and the review found the review's own fixes had not actually reached
  // here: this function used to build its message from `row.why` — a one-line grounded REASON —
  // when the spec's TerraceMethodRow.copy field is "the exact sentence shown on screen", already
  // written to carry every safety-review fix (the vetiver-plant-timing hazard, the 2 m cumulative
  // cap, row 5's escalation clause). `.copy` had ZERO consumers anywhere in the app — a farmer was
  // never shown any of it. `.why` was shown instead, and row 5's `.why` even quotes its own review
  // history ("...corrected up to `ask_local_expert` during adversarial review") as if it were
  // farmer-facing text. Fixed at the source (lib/terracing.ts) and here: use `.copy`.
  const REGIONAL_FOOTER =
    "Regional note: tuned conservative for KwaZulu-Natal's clay-over-rock hillslopes and storms — " +
    'no South African code covers small-farm terrace safety (SANS 10160-5 excludes it). ' +
    'Always confirm locally before cutting.';
  const terraceTip = (label: string, ring: Pick<ZoneShape, 'measuredSlopePct'>, itemId?: string) => {
    const eff = effectiveSlopeForRing(ring, siteAsSector);
    if (!eff) {
      tips.push({
        severity: 'tip',
        msg: `${label}: no slope known yet — walk the site and pace the slope, or open this place on the map to fetch one, before choosing a terrace method.`,
        itemId,
        layer: 'zones',
      });
      return;
    }
    const row = recommendTerraceMethod(eff.pct);
    const highRisk = row.engineerFlag !== 'no';
    // The spec calls this "the single most important disclosure in the whole feature": a whole-
    // site average can hide a locally steeper pocket, and that risk COMPOUNDS specifically when
    // the average itself already reads as the riskiest bands — the exact combination most likely
    // to put a farmer's local terrain outside what this recommendation actually checked.
    const whichSlope = eff.source === 'whole-site-average'
      ? highRisk
        ? ' This is your WHOLE-SITE AVERAGE, not the exact slope here, and it is already in the ' +
          'highest-risk band this app recommends against DIY. On an uneven hillside, parts of it ' +
          'are very likely steeper than this number — get this specific spot checked before you ' +
          'cut anything.'
        : " This uses your whole-site average slope, not the exact slope at this spot. Walk to the " +
          "spot and check it isn't steeper before you build — a locally steeper pocket needs the " +
          'next row\'s method, not this one.'
      : '';
    // The doc's own §1 boundary note: the 33%/row-6 line is a sourced extrapolation, not an
    // engineered cutoff, so on-screen copy must treat it as a zone, not a hard line.
    const nearFalsePrecisionBoundary = eff.pct >= 25 && eff.pct <= 35;
    const boundaryNote = nearFalsePrecisionBoundary
      ? ' Treat anything from roughly 25-35% slope as the steeper band — this line isn\'t precise ' +
        "enough to trust to the percentage point. If you're unsure which side of it you're on, " +
        'that uncertainty itself is the answer: get it checked.'
      : '';
    tips.push({
      // 'no' rows (0-5%, no earthworks needed) stay a plain tip. Every row above that carries a
      // real engineer-consultation flag, so it gets 'warn' — the strongest severity this app's
      // advisor has (deliberately never a blocking gate, per the spec's own §6 item 6; a true
      // 3-tier no/persistent-amber/blocking-red system per the spec's EngineerFlag UI table would
      // need a new severity value threaded through DesignAdvisor.tsx, which this fix does not add
      // — row 6's copy is written to read as unmistakably urgent within the 'warn' tier instead).
      severity: highRisk ? 'warn' : 'tip',
      msg: `${label} at ~${Math.round(eff.pct)}% slope: ${row.copy}${whichSlope}${boundaryNote} ${REGIONAL_FOOTER}`,
      itemId,
      layer: 'zones',
    });
  };
  for (const item of state.items) {
    const def = defFor(defs, item);
    if (def?.id !== 'terrace' && def?.id !== 'berm') continue;
    // Point-placed catalog elements carry no per-item measured slope — only the whole-site
    // fallback applies here.
    terraceTip(def.name, { measuredSlopePct: undefined }, item.id);
  }
  for (const z of state.zones) {
    if (z.feature !== 'terrace_bank' || z.points.length < 3) continue;
    terraceTip(z.name ?? 'Terrace bank', { measuredSlopePct: z.measuredSlopePct });
  }

  // ── WINDBREAK ──
  if (site?.windFromSummer) {
    const hasWindbreakLine = state.lines.some((line) => line.kind === 'windbreak');
    const hasIndigenousRow = state.items.some((it) => defFor(defs, it)?.id === 'tree_indigenous');
    if (!hasWindbreakLine && !hasIndigenousRow) {
      tips.push({
        severity: 'tip',
        msg: `Summer wind comes from the ${site.windFromSummer} — plant a windbreak row (e.g. indigenous shade trees) along that edge.`,
        layer: 'planting',
      });
    }
  }

  // Warnings first, then tips; DEDUPE by message so the same rule firing per-element (e.g. two veg
  // beds both shaded by one tree, or two tanks both far from a roof) doesn't repeat the identical
  // sentence. Cap after dedupe so the cap counts distinct advice, not copies.
  const seen = new Set<string>();
  const deduped: Advice[] = [];
  for (const a of [...warns, ...tips]) {
    if (seen.has(a.msg)) continue;
    seen.add(a.msg);
    deduped.push(a);
  }
  return deduped.slice(0, 8);
}
