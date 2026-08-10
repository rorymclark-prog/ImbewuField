import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import {
  paintTopDownVetiverHedge,
  VETIVER_BLADE_LENGTH_FACTOR,
  VETIVER_BLADE_REACH,
  VETIVER_HEDGE_IDS,
  VETIVER_CLUMP_RADIUS_M,
  VETIVER_LINE_SPACING_M,
  vetiverHedgeGeometry,
} from '@/lib/vetiver-hedge';

// Roughly what a real plan sheet renders at — the figure planting-cartography already uses when it
// reasons about whether its minimum-symbol floor ever fires.
const SHEET_PX_PER_M = 40;
const MIN_CLUMP_PX = 2.6;

const geometryFor = (wM: number, hM: number, pxPerM = SHEET_PX_PER_M, seed = 'item-1') =>
  vetiverHedgeGeometry(wM * pxPerM, hM * pxPerM, wM, hM, pxPerM, MIN_CLUMP_PX, seed);

test('both catalog ids that mean "vetiver" are drawn as a hedge', () => {
  // If a third vetiver id is ever added to the catalog and not to this set, it silently falls back
  // to the side-elevation artwork — which is the bug this drawing exists to end.
  for (const id of VETIVER_HEDGE_IDS) {
    assert.ok(ELEMENTS_BY_ID[id], `${id} is in the hedge set but not in the catalog`);
  }
  assert.ok(VETIVER_HEDGE_IDS.has('vetiver_row'));
  assert.ok(VETIVER_HEDGE_IDS.has('mulch_bank'));
});

test('every exact-sheet vetiver path delegates to the one top-down hedge painter', () => {
  // Water once kept a gradient-wash vetiverBank while Planting used the top-down tufts. The
  // library may retain a sheet-specific footprint, but the plant itself must have one authority.
  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const waterSymbols = readFileSync(new URL('../lib/cartographic-water-symbols.ts', import.meta.url), 'utf8');
  assert.match(glossy, /paintTopDownVetiverHedge\(\s*ctx,/);
  assert.match(waterSymbols, /paintTopDownVetiverHedge\(ctx, \{/);
  const waterVetiverStart = waterSymbols.indexOf('function vetiverBank(');
  const waterVetiverEnd = waterSymbols.indexOf('\nfunction earthwork(', waterVetiverStart);
  assert.ok(waterVetiverStart >= 0 && waterVetiverEnd > waterVetiverStart, 'expected Water’s vetiver path');
  assert.doesNotMatch(
    waterSymbols.slice(waterVetiverStart, waterVetiverEnd),
    /createLinearGradient|quadraticCurveTo/,
    'Water must not grow a second, differently drawn vetiver hedge',
  );
});

test('a Vetiver Row is one slip line and a Vetiver Bank is several', () => {
  // The whole point of deriving lines from the SHORT axis: 0.3 m holds one line of vetiver, 2 m
  // holds a block of them. Drawing a 2 m bank as one impossibly fat hedge is what a fixed
  // single-line drawing would have done.
  const row = ELEMENTS_BY_ID.vetiver_row;
  const bank = ELEMENTS_BY_ID.mulch_bank;

  const rowGeometry = geometryFor(row.wM, row.hM);
  const bankGeometry = geometryFor(bank.wM, bank.hM);
  assert.ok(rowGeometry && bankGeometry);
  assert.equal(rowGeometry.lines, 1, 'a 0.3 m row is a single line of slips');
  assert.ok(bankGeometry.lines > 1, 'a 2 m bank is more than one line');
  assert.ok(
    bankGeometry.lines <= Math.ceil(bank.wM / VETIVER_LINE_SPACING_M),
    'never more lines than the bank is wide enough to hold',
  );
});

test('the hedge runs along the long axis whichever way the footprint is drawn', () => {
  const upright = geometryFor(0.3, 5);
  const laid = geometryFor(5, 0.3);
  assert.ok(upright && laid);
  assert.equal(upright.alongY, true);
  assert.equal(laid.alongY, false);
  // Same physical hedge, so the same number of plants either way round. A drawing that put more
  // tufts in one orientation than the other would change what the sheet claims when a farmer
  // rotates a bank.
  assert.equal(upright.lines, laid.lines);
  assert.equal(upright.perLine, laid.perLine);
});

test('every tuft stays within reach of its own footprint', () => {
  // Blades deliberately overshoot the plate — that bristle is the identifying silhouette — but a
  // CROWN outside the footprint would be a plant drawn on ground the farmer did not allocate.
  for (const [wM, hM] of [[0.3, 5], [2, 2], [5, 0.3], [1.2, 12]] as const) {
    const geometry = geometryFor(wM, hM);
    assert.ok(geometry, `${wM}x${hM} produced no geometry`);
    const halfW = (wM * SHEET_PX_PER_M) / 2;
    const halfH = (hM * SHEET_PX_PER_M) / 2;
    for (const crown of geometry.crowns) {
      assert.ok(Math.abs(crown.x) <= halfW + 0.01, `crown x ${crown.x} outside ${halfW}`);
      assert.ok(Math.abs(crown.y) <= halfH + 0.01, `crown y ${crown.y} outside ${halfH}`);
      assert.ok(Number.isFinite(crown.r) && crown.r > 0);
    }
    assert.equal(geometry.crowns.length, geometry.lines * geometry.perLine);
  }
});

test('the same design draws the same hedge every time, and two banks differ', () => {
  // Plan sheets are re-rendered constantly and compared against each other; jitter that moved
  // between renders would make every export look like a change.
  const a = geometryFor(2, 2, SHEET_PX_PER_M, 'bank-a');
  const again = geometryFor(2, 2, SHEET_PX_PER_M, 'bank-a');
  const b = geometryFor(2, 2, SHEET_PX_PER_M, 'bank-b');
  assert.ok(a && again && b);
  assert.deepEqual(a.crowns, again.crowns);
  assert.notDeepEqual(a.crowns, b.crowns, 'two banks on one sheet must not be identical stamps');
});

test('the legibility floor lifts a clump, but never past the band it sits in', () => {
  // On a phone-sized export the true 15 cm clump radius is sub-pixel, and the floor rescues it.
  // What the floor may NOT do is make the hedge wider than the farmer said it is — Rory measured
  // that himself: a row saved at W 0,52 m drawing at about twice that. See VETIVER_BLADE_REACH.
  for (const pxPerM of [4, 8, 14, 40, 120]) {
    const geometry = geometryFor(2, 2, pxPerM);
    if (!geometry) continue;
    const bandPx = 2 * pxPerM;
    const floored = Math.min(Math.max(MIN_CLUMP_PX, VETIVER_CLUMP_RADIUS_M * pxPerM), bandPx / (2 * VETIVER_BLADE_REACH));
    assert.ok(Math.abs(geometry.clumpR - floored) < 1e-9, `${pxPerM} px/m gave r=${geometry.clumpR}`);
    if (pxPerM >= 40) {
      assert.ok(
        Math.abs(geometry.clumpR - VETIVER_CLUMP_RADIUS_M * pxPerM) < 1e-9,
        'at sheet scale the real clump size wins, not the floor and not the cap',
      );
    }
  }
});

test('a hedge is never drawn wider than the width it was saved at', () => {
  // THE defect, three times reported. The clump floor raised the radius, the blades reached
  // VETIVER_BLADE_REACH x that, and nothing compared the result with the band — so the narrower the
  // hedge, the further past its own edges it grew. Rory's own reading off the canvas: "this is how
  // wide the vetiver is and the second image is how wide you keep making it", W 0,52 m.
  const cases: Array<[number, number, number]> = [
    [0.52, 15.29, 14], // the row he measured
    [0.3, 5, 40],
    [2, 2, 40],
    [1.2, 12, 8], // phone-sized export, where the floor bites hardest
    [0.52, 15.29, 90],
  ];
  for (const [wM, hM, pxPerM] of cases) {
    const geometry = geometryFor(wM, hM, pxPerM);
    if (!geometry) continue;
    const bandHalf = (Math.min(wM, hM) * pxPerM) / 2;
    for (const crown of geometry.crowns) {
      // Blade tips, not crown centres — the tips are what a reader sees as the hedge's edge.
      const across = geometry.alongY ? Math.abs(crown.x) : Math.abs(crown.y);
      const reach = across + crown.r * VETIVER_BLADE_LENGTH_FACTOR;
      assert.ok(
        reach <= bandHalf + 0.5,
        `${wM}x${hM} @ ${pxPerM}px/m: a blade reached ${reach.toFixed(2)} past a ${bandHalf.toFixed(2)} half-band`,
      );
    }
  }
});

test('a footprint too short to read as a hedge falls through instead of drawing three tufts', () => {
  assert.equal(geometryFor(0.3, 0.2, 4), null, 'a sub-symbol footprint must decline');
  // And nothing invalid can manufacture a drawing.
  assert.equal(vetiverHedgeGeometry(NaN, 10, 1, 1, 40, 2.6, 'x'), null);
  assert.equal(vetiverHedgeGeometry(10, 10, 1, 1, 0, 2.6, 'x'), null);
  assert.equal(vetiverHedgeGeometry(-5, 10, 1, 1, 40, 2.6, 'x'), null);
});

test('a very long bank stays bounded rather than drawing thousands of tufts', () => {
  const geometry = geometryFor(1.2, 400);
  assert.ok(geometry);
  assert.ok(geometry.perLine <= 180, `perLine ${geometry.perLine} is unbounded`);
  assert.ok(geometry.lines <= 6, `lines ${geometry.lines} is unbounded`);
});

test('tufts are irregular — sizes vary and spacing drifts, so the hedge is not a picket fence', () => {
  // Rory, on the live sheet: "the vetiver is still looking too artificial." What made it
  // artificial was regularity: identical crowns marching at an identical pitch, dead on their
  // line. A real nursery row establishes unevenly, so the drawing must too — while every jitter
  // stays seeded (see the determinism tests) and every crown stays inside the saved band (see the
  // width test above).
  const geometry = geometryFor(0.3, 5);
  assert.ok(geometry);
  const radii = new Set(geometry.crowns.map((crown) => crown.r.toFixed(4)));
  assert.ok(radii.size > geometry.crowns.length * 0.5, 'tuft sizes are uniform');

  // Along-the-run gaps between neighbouring crowns must not be one repeated figure.
  const along = geometry.crowns.map((crown) => (geometry.alongY ? crown.y : crown.x)).sort((a, b) => a - b);
  const gaps = along.slice(1).map((value, index) => value - along[index]);
  const spread = Math.max(...gaps) - Math.min(...gaps);
  assert.ok(spread > geometry.clumpR * 0.2, `spacing is ruler-even (spread ${spread.toFixed(3)}px)`);

  // And crowns wander off their slip line rather than sitting exactly on it.
  const offLine = geometry.crowns.map((crown) => (geometry.alongY ? crown.x : crown.y));
  assert.ok(new Set(offLine.map((value) => value.toFixed(4))).size > 1, 'every crown sits dead on the line');
});

type RecordedCall = { name: string; args: unknown[] };

/** The same recording-canvas trick tests/cartographic-symbols.test.ts uses: every method call and
 *  style assignment is transcribed, so two paints can be compared call-for-call. */
function recordingContext(): { ctx: CanvasRenderingContext2D; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const target: Record<PropertyKey, unknown> = {};
  const ctx = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      return (...args: unknown[]) => calls.push({ name: String(property), args });
    },
    set(object, property, value) {
      object[property] = value;
      calls.push({ name: `set:${String(property)}`, args: [value] });
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

test('the full paint pass is deterministic: one seed, one hedge, on every render', () => {
  // The geometry test above already pins crown positions; this pins the DRAWING — blob radii,
  // blade counts, tone buckets — because plan sheets are re-rendered constantly and compared, and
  // any unseeded jitter in the paint pass would make every export look like a change.
  const transcript = (seedId: string) => {
    const { ctx, calls } = recordingContext();
    assert.equal(paintTopDownVetiverHedge(ctx, {
      widthPx: 0.3 * SHEET_PX_PER_M,
      heightPx: 5 * SHEET_PX_PER_M,
      widthM: 0.3,
      heightM: 5,
      pxPerM: SHEET_PX_PER_M,
      minClumpPx: MIN_CLUMP_PX,
      seedId,
      casingWidth: 2,
    }), true);
    return calls;
  };
  assert.deepEqual(transcript('row-a'), transcript('row-a'));
  assert.notDeepEqual(transcript('row-a'), transcript('row-b'), 'two hedges must not be identical stamps');
});

test('the painted band edge is built from the tussocks, not from a hard-sided plate', () => {
  // The ruler-straight pale-green strips in Rory's screenshot were the footprint rectangle being
  // cased and filled as-is. The band silhouette must now come from per-crown arcs (one blob per
  // tussock, radii varied), and the blades must still be bowed curves rather than straight ticks.
  const { ctx, calls } = recordingContext();
  assert.equal(paintTopDownVetiverHedge(ctx, {
    widthPx: 0.3 * SHEET_PX_PER_M,
    heightPx: 5 * SHEET_PX_PER_M,
    widthM: 0.3,
    heightM: 5,
    pxPerM: SHEET_PX_PER_M,
    minClumpPx: MIN_CLUMP_PX,
    seedId: 'row-a',
    casingWidth: 2,
  }), true);
  const geometry = geometryFor(0.3, 5, SHEET_PX_PER_M, 'row-a');
  assert.ok(geometry);
  const arcs = calls.filter((call) => call.name === 'arc');
  // Two band traces (casing + fill) — one blob arc per crown in each.
  assert.equal(arcs.length, geometry.crowns.length * 2, 'the band is not one blob per tussock');
  const blobRadii = new Set(arcs.map((call) => (call.args[2] as number).toFixed(4)));
  assert.ok(blobRadii.size > geometry.crowns.length * 0.5, 'blob radii are uniform — the edge would be even again');
  assert.ok(calls.some((call) => call.name === 'quadraticCurveTo'), 'blades must stay bowed grass, not ticks');
  assert.ok(!calls.some((call) => call.name === 'rect' || call.name === 'fillRect'),
    'no rectangle may reintroduce the hard parallel sides');
});
