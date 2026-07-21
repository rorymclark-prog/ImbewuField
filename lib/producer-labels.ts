// Design Studio — on-map label layout, extracted VERBATIM out of
// components/design/DesignGlossy.tsx (formerly ~lines 1133–1410) so it is unit-testable without
// pulling in the whole React component. All comments preserved as-is; the only functional change
// is that `refLayers: DesignGlossyProps['refLayers']` became `refLayers: LabelRefLayers` below —
// a structurally-identical standalone type — since this module can't reference the component's
// prop type.

import { ELEMENTS_BY_ID, ZONE_DEFS } from '@/lib/design-elements';
import type { DesignElementDef, ElementCategory } from '@/lib/design-elements';
import type { DesignCanvasState } from '@/lib/design-canvas';
import type { ProducerLabel } from '@/lib/image-producer';
import { itemInFilter, zonesInFilter, type GlossyLayerFilter } from '@/lib/glossy-filters';

/** Structural stand-in for DesignGlossyProps['refLayers'] (components/design/DesignGlossy.tsx) —
 *  kept identical field-for-field so the two stay assignable to each other. */
export interface LabelRefLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
  drivewayClosed?: boolean; // driveway traced as an AREA (polygon) → fill as tar, don't outline
}

// ── Burned map labels: CAPS + grouped headers (docs/PLAN-SET-SPEC.md) ─────────
//
// The reference plan set labels an AREA once — "SOUTHERN ORCHARD GUILDS" as a header over
// Macadamia / Citrus / Avocado / Mango — instead of firing one emoji pill AND one leader at
// every element name. A dozen fruit trees in one orchard used to mean a dozen pills and a
// dozen leaders: the single worst source of burned-label clutter. So we cluster same-family
// nearby elements and give the cluster ONE header + its members underneath.

/** The bucket we're willing to put under one header. */
type LabelFamily = 'trees' | ElementCategory;

const FAMILY_LABEL: Record<LabelFamily, string> = {
  trees: 'TREES',
  growing: 'BEDS & CROPS',
  water: 'WATER',
  earthworks: 'EARTHWORKS',
  structure: 'STRUCTURES',
  animal: 'LIVESTOCK',
  access: 'ACCESS',
};

// Trees get their own family because they're the worst offender (a whole orchard of species
// dropped in one corner). NOTE the category guard: `tree_basin` also starts with 'tree_' but is
// category 'earthworks' — the mulch ring that shapes the LAND around a tree — and the taxonomy
// (docs/DESIGN-TAXONOMY.md) deliberately keeps land-shaping apart from planting. It stays in
// EARTHWORKS.
function labelFamily(def: DesignElementDef): LabelFamily {
  return def.category === 'growing' && def.id.startsWith('tree_') ? 'trees' : def.category;
}

// How many DISTINCT element names a cluster needs before a header earns its row. Below this a
// header is mostly ceremony: "TREES" over rows that already read CITRUS TREE / MANGO TREE tells
// the reader nothing, and two nearby pills with two leaders already scan fine.
// (Measured over 800 simulated designs: dropping this to 2 buys ~16% fewer leader lines for ~5%
// more rows — a real but marginal trade. 3 matches the reference sheet's 4-member groups.)
const GROUP_MIN_NAMES = 3;
// Members listed under one header before we roll the tail up into "+N MORE" — stops a 15-species
// food forest from turning the header block into a column that overruns the sheet.
const GROUP_MAX_ROWS = 6;
// Cluster radius as a fraction of the frame HEIGHT. Single-link, so it chains along a row of
// trees (a hedgerow IS one label) — which is the behaviour we want.
const GROUP_PROXIMITY = 0.18;

/** Normalised bbox of the traced plot, falling back to the whole frame when untraced. */
export function plotBox(boundary: Array<[number, number]>): { x0: number; y0: number; x1: number; y1: number } {
  if (boundary.length < 3) return { x0: 0, y0: 0, x1: 1, y1: 1 };
  const xs = boundary.map((p) => p[0]);
  const ys = boundary.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Compass word for a header ("SOUTHERN TREES"). Maps are north-up (Web-Mercator satellite), so
// normalised +y is south. Measured inside the PLOT's bbox, not the photo's, so "SOUTHERN" means
// the southern part of the farmer's land. Only used when a family has more than one cluster —
// the prefix exists to tell two clusters apart, and on a single cluster it's just noise.
export function compassWord(x: number, y: number, box: ReturnType<typeof plotBox>): string {
  const u = box.x1 > box.x0 ? (x - box.x0) / (box.x1 - box.x0) : 0.5;
  const v = box.y1 > box.y0 ? (y - box.y0) / (box.y1 - box.y0) : 0.5;
  if (v < 0.34) return 'NORTHERN';
  if (v > 0.66) return 'SOUTHERN';
  if (u < 0.34) return 'WESTERN';
  if (u > 0.66) return 'EASTERN';
  return 'CENTRAL';
}

type LabelPt = { x: number; y: number; name: string; icon: string };

/** Single-link clustering by proximity. `aspect` (W/H) makes the metric isotropic despite x and y
 *  both being normalised 0..1 over a non-square frame. Element counts are tens — O(n²) is fine. */
export function clusterByProximity(pts: LabelPt[], aspect: number): LabelPt[][] {
  const parent = pts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot((pts[i].x - pts[j].x) * aspect, pts[i].y - pts[j].y);
      if (d <= GROUP_PROXIMITY) parent[find(i)] = find(j);
    }
  }
  const by = new Map<number, LabelPt[]>();
  pts.forEach((p, i) => {
    const root = find(i);
    const arr = by.get(root) ?? [];
    arr.push(p);
    by.set(root, arr);
  });
  return [...by.values()];
}

// True labels burned onto the produced map (all coords OUTPUT px): grouped CAPS headers with
// their members beneath, pinned to the left/right margins and de-collided.
export function producerLabels(
  state: DesignCanvasState,
  refLayers: LabelRefLayers,
  W: number,
  H: number,
  filter: GlossyLayerFilter = 'all',
  includeToolGlyphs = true,
): ProducerLabel[] {
  const fs = 26, padX = 14;
  // Pill-width ESTIMATE — only used to right-align the right-hand column (burnLabels measures the
  // real width for the pill itself). CAPS runs wider than mixed case, and bold headers wider
  // still, so the per-char factor went up with them; under-estimating here would hang the
  // right-hand pills off the edge of the frame.
  const pillWidth = (text: string, bold: boolean) =>
    Math.min(W - 28, padX * 2 + text.length * fs * (bold ? 0.66 : 0.62));

  type Row = { text: string; kind: 'header' | 'item'; leader: boolean; pw: number };
  /** One margin-pinned unit: a lone pill (head = null, one leader-carrying member), or a header
   *  plus the members it speaks for. cx/cy is the single point the block's ONE leader points at.
   *  `hidden` is how many member names got rolled up into a "+N MORE" row. */
  // `lone` carries the ingredients of a single-pill block so two identical pills can be merged or
  // re-labelled later without parsing the rendered text back apart.
  type Block = {
    cx: number; cy: number; head: Row | null; members: Row[]; hidden: number;
    lone?: { icon: string; name: string; n: number };
  };
  const blocks: Block[] = [];

  const itemRow = (icon: string, name: string, n: number): Row => {
    // CAPS on every on-map label, per the reference sheets ("On-map labels: CAPS, short").
    // Geometry Lock drops editor emoji from labels; the plain text and swatch legend carry identity.
    const text = `${includeToolGlyphs ? `${icon} ` : ''}${name}${n > 1 ? ` ×${n}` : ''}`.toUpperCase();
    return { text, kind: 'item', leader: true, pw: pillWidth(text, false) };
  };
  const moreRow = (n: number): Row => {
    const text = `+${n} MORE`;
    return { text, kind: 'item', leader: false, pw: pillWidth(text, false) };
  };
  const rowCount = (b: Block) => (b.head ? 1 : 0) + b.members.length + (b.hidden > 0 ? 1 : 0);
  const blockRows = (b: Block): Row[] => [
    ...(b.head ? [b.head] : []),
    ...b.members,
    ...(b.hidden > 0 ? [moreRow(b.hidden)] : []),
  ];

  // Bucket this layer's items by family — only THIS layer, so a Zones/Water/Planting map isn't
  // cluttered with every other layer's labels (Rory: a "Zones" map was showing JoJo Tanks + veg
  // beds).
  const families = new Map<LabelFamily, LabelPt[]>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !itemInFilter(def.category, filter, def.id)) continue;
    const key = labelFamily(def);
    const arr = families.get(key) ?? [];
    arr.push({ x: it.x, y: it.y, name: it.label ?? def.name, icon: def.icon });
    families.set(key, arr);
  }

  const box = plotBox(refLayers.boundary);
  const aspect = H > 0 ? W / H : 1;
  for (const [family, pts] of families) {
    const clusters = clusterByProximity(pts, aspect);
    for (const cluster of clusters) {
      // Name groups within this cluster (renamed items get their own row), biggest first.
      const byName = new Map<string, { icon: string; xs: number[]; ys: number[] }>();
      for (const p of cluster) {
        const g = byName.get(p.name) ?? { icon: p.icon, xs: [], ys: [] };
        g.xs.push(p.x);
        g.ys.push(p.y);
        byName.set(p.name, g);
      }
      const names = [...byName.entries()].sort((a, b) => b[1].xs.length - a[1].xs.length || a[0].localeCompare(b[0]));

      if (names.length < GROUP_MIN_NAMES) {
        // Too few kinds to be worth a header — one pill per kind with its own leader, as before.
        // It now anchors on the name's centroid WITHIN this cluster, so two veg patches at
        // opposite ends of the plot no longer share one pill pointing at the empty middle.
        for (const [name, g] of names) {
          const n = g.xs.length;
          blocks.push({
            cx: (g.xs.reduce((a, b) => a + b, 0) / n) * W,
            cy: (g.ys.reduce((a, b) => a + b, 0) / n) * H,
            head: null,
            members: [itemRow(g.icon, name, n)],
            hidden: 0,
            lone: { icon: g.icon, name, n },
          });
        }
        continue;
      }

      // Header + members: ONE leader, aimed at the cluster's centroid.
      const nx = cluster.reduce((s, p) => s + p.x, 0) / cluster.length;
      const ny = cluster.reduce((s, p) => s + p.y, 0) / cluster.length;
      const prefix = clusters.length > 1 ? `${compassWord(nx, ny, box)} ` : '';
      const head = `${prefix}${FAMILY_LABEL[family]}`;
      // Members ride under the header WITHOUT a leader of their own — see the layout note below.
      const members = names
        .slice(0, GROUP_MAX_ROWS)
        .map(([name, g]) => ({ ...itemRow(g.icon, name, g.xs.length), leader: false }));
      blocks.push({
        cx: nx * W,
        cy: ny * H,
        head: { text: head, kind: 'header', leader: true, pw: pillWidth(head, true) },
        members,
        hidden: Math.max(0, names.length - GROUP_MAX_ROWS),
      });
    }
  }

  // On the zones layer, label the effort-zone areas (not individual elements). Each zone is its
  // own distinct region, so there is nothing to group — one pill each, as before.
  if (zonesInFilter(filter)) {
    for (const z of state.zones) {
      if (z.feature || z.points.length < 3) continue;
      const cx = (z.points.reduce((s, p) => s + p[0], 0) / z.points.length) * W;
      const cy = (z.points.reduce((s, p) => s + p[1], 0) / z.points.length) * H;
      const text = `${includeToolGlyphs ? `${z.zone}️⃣ ` : `ZONE ${z.zone} — `}${ZONE_DEFS[z.zone].label}`.toUpperCase();
      blocks.push({ cx, cy, head: null, members: [{ text, kind: 'item', leader: true, pw: pillWidth(text, false) }], hidden: 0 });
    }
  }
  // Driveway isn't a placed item — label it at the midpoint of the traced access line.
  if (refLayers.driveway.length >= 2) {
    const mid = refLayers.driveway[Math.floor(refLayers.driveway.length / 2)];
    const text = `${includeToolGlyphs ? '🚗 ' : ''}DRIVEWAY`;
    blocks.push({ cx: mid[0] * W, cy: mid[1] * H, head: null, members: [{ text, kind: 'item', leader: true, pw: pillWidth(text, false) }], hidden: 0 });
  }

  // DISAMBIGUATE IDENTICAL PILLS. Two clusters of the same lone element — tap points scattered far
  // enough apart never to cluster — each produced a pill reading exactly "TAP POINT", so the sheet
  // showed the same words two or three times with no way to tell which leader belonged to which
  // tap. Headers already solve this: when a family splits into several clusters they take a compass
  // word (above). Lone pills differ only in POSITION, so the compass word is precisely the missing
  // information. Merging them instead would be wrong — one leader aimed at the centroid of two
  // distant taps points at empty ground, which is the bug the clustering exists to prevent.
  const primaryText = (b: Block) => (b.head ?? b.members[0])?.text ?? '';
  const countTexts = () => {
    const m = new Map<string, number>();
    for (const b of blocks) m.set(primaryText(b), (m.get(primaryText(b)) ?? 0) + 1);
    return m;
  };

  // Pass 1 — give each colliding lone pill its compass word.
  let counts = countTexts();
  for (const b of blocks) {
    if (b.head || !b.lone) continue; // headers already carry a compass word
    if ((counts.get(primaryText(b)) ?? 0) < 2) continue;
    const row = b.members[0];
    const text = `${compassWord(b.cx / W, b.cy / H, box)} ${row.text}`;
    b.members[0] = { ...row, text, pw: pillWidth(text, false) };
  }

  // Pass 2 — anything still identical sits in the SAME compass sector, i.e. the two clusters are
  // near each other after all. Merging is honest there: one leader to their combined centroid lands
  // beside both, and the count adds up. This also guarantees the invariant terminates.
  counts = countTexts();
  for (const [text, n] of counts) {
    if (n < 2) continue;
    const dupes = blocks.filter((b) => !b.head && b.lone && primaryText(b) === text);
    if (dupes.length < 2) continue;
    const total = dupes.reduce((s, b) => s + (b.lone?.n ?? 1), 0);
    const keep = dupes[0];
    keep.cx = dupes.reduce((s, b) => s + b.cx * (b.lone?.n ?? 1), 0) / total;
    keep.cy = dupes.reduce((s, b) => s + b.cy * (b.lone?.n ?? 1), 0) / total;
    keep.lone = { ...keep.lone!, n: total };
    // Rebuild from the merged count, but KEEP the compass word pass 1 gave it — rebuilding bare
    // would collapse "NORTHERN TAP POINT" and "SOUTHERN TAP POINT" back into one shared text.
    const merged = itemRow(keep.lone.icon, keep.lone.name, total);
    const mergedText = `${compassWord(keep.cx / W, keep.cy / H, box)} ${merged.text}`;
    keep.members = [{ ...merged, text: mergedText, pw: pillWidth(mergedText, false) }];
    for (const drop of dupes.slice(1)) blocks.splice(blocks.indexOf(drop), 1);
  }

  // Pin each BLOCK to the LEFT or RIGHT margin (by which half its elements sit in) and hug their
  // real vertical position, then DE-COLLIDE: keep blocks in anchor order and push the minimum
  // amount to remove overlaps, shifting the whole column up if it runs off the bottom.
  // NO-CROSSING LEADERS — the property this layout won and must not lose: the column stays sorted
  // by cy, AND exactly one row per block carries a leader (a block's members are silent). So the
  // leaders on a side are still one-per-anchor in anchor order, and cannot tangle. This is also
  // why members don't keep their own leaders: N leaders fanning out of a block would re-order
  // against the column and bring the "labels all over the place" mess straight back.
  const pillH = fs + 14;
  const rowGap = pillH + 4; // rows inside a block hug each other → they read as one group…
  const blockGap = 14; // …and blocks stay clearly apart
  const top = 36, bot = H - 36;
  // The final sheet always burns its scale and distance label into the bottom-left of the map.
  // Treat that as occupied furniture during label layout, rather than drawing a valid pill there
  // and covering it later (the real Planting sheet put TREE BASIN ×6 across the 20 m scale).
  const scaleSafeTop = H - Math.max(110, Math.round(H * 0.11));
  const out: ProducerLabel[] = [];
  (['left', 'right'] as const).forEach((side) => {
    const col = blocks.filter((b) => (b.cx < W / 2 ? 'left' : 'right') === side).sort((a, b) => a.cy - b.cy);
    if (!col.length) return;
    const sideBot = side === 'left' ? scaleSafeTop - pillH / 2 : bot;
    // FIT THE COLUMN FIRST. A column only holds ~28 rows; past that the overflow shift below
    // clamps at `top` and starts stacking pills on top of each other. (That degradation is not
    // new — the old one-pill-per-name layout hit it on a big design too — but headers add rows,
    // so grouping must not make it easier to reach.) MEMBERS are the compressible part: the
    // header's leader carries the group's position, so rolling members up into "+N MORE" costs
    // detail, never truth, and the legend panel still names everything. Leader-carrying rows are
    // never dropped — they ARE the identity+position guarantee. Trim the greediest block first.
    const columnSpan = () =>
      col.reduce((s, b) => s + (rowCount(b) - 1) * rowGap, 0) + (col.length - 1) * (pillH + blockGap);
    // Each block can waste one no-op pass (popping its first member adds the "+N MORE" row back),
    // then every pass shrinks the column — so this always terminates; the cap is belt-and-braces.
    for (let guard = 0; columnSpan() > sideBot - top && guard < col.length * GROUP_MAX_ROWS + 8; guard++) {
      const victim = col.filter((b) => b.members.length > 1).sort((a, b) => b.members.length - a.members.length)[0];
      if (!victim) break; // nothing compressible left — accept the pre-existing degradation
      victim.members.pop();
      victim.hidden += 1;
    }
    const rows = col.map(blockRows);
    // Header centre → last row centre, i.e. how far below its anchor a block reaches.
    const span = rows.map((r) => (r.length - 1) * rowGap);
    // Ideal header y = the elements' own y, clamped so the whole block fits in the frame.
    const ys = col.map((b, i) => Math.max(top, Math.min(b.cy, sideBot - span[i])));
    // Push each block down just enough to clear the one above it (preserves vertical order).
    const pushDown = () => {
      for (let i = 1; i < ys.length; i++) {
        const min = ys[i - 1] + span[i - 1] + pillH + blockGap;
        if (ys[i] < min) ys[i] = min;
      }
    };
    pushDown();
    // If the stack overran the bottom, slide the whole column up so it fits (clamped at top).
    const overflow = ys[ys.length - 1] + span[span.length - 1] - sideBot;
    if (overflow > 0) {
      for (let i = 0; i < ys.length; i++) ys[i] = Math.max(top, ys[i] - overflow);
      // …then push down AGAIN. That per-block clamp at `top` is applied blindly, so it silently
      // re-breaks the separations the first pass just established and stacks pills on top of each
      // other (an old bug: a full column could land two pills at the same y). Re-pushing restores
      // them, and because the fit pass above trimmed the column to fit, this cannot re-overflow.
      pushDown();
    }
    col.forEach((b, i) => {
      rows[i].forEach((row, k) => {
        const ax = side === 'left' ? 16 : Math.max(16, W - row.pw - 16);
        const lx = side === 'left' ? ax + row.pw : ax; // leader meets the pill's inner edge
        out.push({ cx: b.cx, cy: b.cy, ax, ay: ys[i] + k * rowGap, lx, text: row.text, kind: row.kind, leader: row.leader });
      });
    });
  });
  return out;
}
