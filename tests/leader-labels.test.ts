import assert from 'node:assert/strict';
import test from 'node:test';

import {
  leaderLabelFontSize, placeLeaderLabel, stackLeaderRows, leaderPath, minSizeFor,
  MIN_FONT_SIZE, MIN_RELATIVE_SIZE, SAFE_INSET_RATIO,
  type LeaderSide,
} from '@/lib/leader-labels';
import { calculateBoundaryPresentationLayout } from '@/lib/reference-presentation';

// A margin callout names a real thing on a real farm plan. Off the sheet edge it is gone, and the
// farmer is left with a coloured line and a legend to cross-reference — which is the exact problem
// these callouts were added to solve.

// Two width models, because the font stack cannot be relied on. REFERENCE_LABEL_FONT asks for
// "Avenir Next Condensed", "Roboto Condensed", "Arial Narrow" — and then falls back to plain
// sans-serif, which is roughly 30% wider. A device with none of the three gets the wide one with
// no warning, so every rule here has to hold under both.
const CONDENSED = (text: string, size: number) => text.length * size * 0.48;
const FALLBACK = (text: string, size: number) => text.length * size * 0.62;
const MEASURES: Array<[string, (t: string, s: number) => number]> = [
  ['condensed', CONDENSED],
  ['sans-serif fallback', FALLBACK],
];

// The real worst case in the catalog, with a count suffix.
const LONGEST = 'GREYWATER DIVERTER & FILTER ×3';
const SIDES: LeaderSide[] = ['left', 'right'];

test('callout type keeps its map-width hierarchy', () => {
  // This used to derive its three widths from calculateBoundaryPresentationLayout on a square, a
  // wide and a tall boundary, on the assumption that the farm's shape sets the map's shape. It no
  // longer does: sheets are now targeted at A-series so they fill the paper, which means every
  // farm shape yields the SAME map width and the three sizes came out equal. That coupling was
  // never the point — the rule under test belongs to leaderLabelFontSize, so exercise it directly
  // at widths that stand for a narrow, a normal and a wide map.
  const mapWidths = { tall: 900, square: 1600, wide: 2600 };
  const sizes = {
    tall: leaderLabelFontSize(mapWidths.tall),
    square: leaderLabelFontSize(mapWidths.square),
    wide: leaderLabelFontSize(mapWidths.wide),
  };

  // The user-facing rule: a map that doubles in width gets larger type, while the narrowest
  // printable map stops at the named legibility floor.
  assert.ok(sizes.tall < sizes.square);
  assert.ok(sizes.square < sizes.wide);
  assert.ok(sizes.tall >= MIN_FONT_SIZE, 'no map may be given type below the legibility floor');

  // Once clear of that legibility stop, type occupies the same share of each map. This catches a
  // replacement fixed constant without pinning the implementation's current ratio.
  const squareShare = sizes.square / mapWidths.square;
  const wideShare = sizes.wide / mapWidths.wide;
  assert.ok(Math.abs(squareShare - wideShare) < 0.001);
});

test('every farm shape now gets the same A-series map width', () => {
  // The flip side of the change above, pinned so it is a decision and not an accident: the sheet
  // shape is the paper's, and the farm's shape shows in the boundary drawn on it.
  const frame = { imgW: 960, imgH: 640, mPerPx: 0.4 };
  const boundaries: Array<[number, number]>[] = [
    [[0.4, 0.35], [0.6, 0.35], [0.6, 0.65], [0.4, 0.65]],
    [[0.3, 0.425], [0.7, 0.425], [0.7, 0.575], [0.3, 0.575]],
    [[0.45, 0.2], [0.55, 0.2], [0.55, 0.8], [0.45, 0.8]],
  ];
  const widths = boundaries.map((boundary) => {
    const layout = calculateBoundaryPresentationLayout(boundary, frame);
    assert.ok(layout);
    return layout.imgW * 2;
  });

  for (const width of widths) assert.equal(width, widths[0]);
  assert.ok(leaderLabelFontSize(widths[0]) >= MIN_FONT_SIZE);
});

// This assertion used to read `assert.equal(sizes.tall, MIN_FONT_SIZE)` inside the test above —
// true only because the tall map happened to land on the floor at the coefficient of the day, and
// therefore a test that failed the moment the coefficient was corrected, for no user-facing reason.
// The floor is a real rule and deserves its own case, exercised at a width where it must bind
// however the share is tuned.
test('the legibility floor binds on a map too narrow to earn its share', () => {
  assert.equal(leaderLabelFontSize(1), MIN_FONT_SIZE, 'a degenerate width still gets readable type');
  assert.ok(leaderLabelFontSize(200) >= MIN_FONT_SIZE);
  assert.ok(leaderLabelFontSize(40_000) > MIN_FONT_SIZE, 'and a huge map is not held at the floor');
});

test('invalid map widths cannot turn a label font into a non-finite canvas value', () => {
  for (const width of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
    const size = leaderLabelFontSize(width);
    assert.ok(Number.isFinite(size));
    assert.ok(size >= MIN_FONT_SIZE);
  }
});

// The regression this whole change exists to prevent. Codex made the type width-relative (right)
// but kept the 0.011 the old `Math.max(19, …)` had always been masking, so on Rory's 1480px-wide
// Extension Blueprint water map the callouts would have gone 19px -> 16px — smaller, on the very
// sheet that prompted the complaint. Asserted against the model-drawn reference: labels on the
// Satellite Overlay render of the same design sit at roughly 2% of map width.
test('callout type is close to the size a model picks for itself on the same design', () => {
  for (const mapWidth of [744, 1104, 1480, 1936, 2404]) {
    const share = leaderLabelFontSize(mapWidth) / mapWidth;
    assert.ok(
      share > 0.015 && share < 0.026,
      `${mapWidth}px map -> ${(share * 100).toFixed(2)}% is outside the range a plan reads well at`,
    );
  }
});

test('a callout never crosses the sheet edge — at any width, either side, either font', () => {
  // THE BUG. The old code capped the width used for POSITIONING at 24% of the canvas and drew the
  // text at its real width, so a long name was placed as though it were short and painted past the
  // edge. It survived review because review happens on wide renders; the font has a hard 19px
  // floor, so the gap opens exactly as the sheet gets narrower.
  for (const [fontName, measure] of MEASURES) {
    for (const W of [700, 900, 1100, 1400, 1800, 2400]) {
      for (const side of SIDES) {
        const p = placeLeaderLabel({
          text: LONGEST, side, W, plotX0: 0.28, plotX1: 0.72, fontSize: 19, measure,
        });
        const safe = Math.round(W * SAFE_INSET_RATIO);
        assert.ok(p.x >= 0, `${fontName} W=${W} ${side}: starts off the left edge at x=${p.x}`);
        assert.ok(
          p.x + p.textW <= W - safe + 1,
          `${fontName} W=${W} ${side}: runs ${Math.round(p.x + p.textW - (W - safe))}px past the safe edge`,
        );
      }
    }
  }
});

test('the old fixed-fraction rule DOES fail these cases — the test can catch the bug', () => {
  // A regression test that cannot fail is decoration. This reproduces the previous behaviour and
  // asserts it breaks, so the check above is known to be load-bearing.
  const W = 900;
  const text = LONGEST;
  const realW = FALLBACK(text, 19);
  const cappedW = Math.min(W * 0.24, realW);
  assert.ok(cappedW < realW, 'the cap must actually bite for this to be the bug');

  const safe = Math.round(W * SAFE_INSET_RATIO);
  const gap = Math.round(W * 0.025);
  const oldX = Math.min(W - safe - cappedW, Math.round(0.72 * W) + gap);
  assert.ok(oldX + realW > W - safe, 'the old placement should overflow — if not, the premise is wrong');
});

test('shrinking stops at a size a farmer can still read', () => {
  // A callout squeezed to 6px is worse than an obviously clipped one: it looks correct and says
  // nothing. Below the floor the placement reports shrunk and lets it overflow visibly.
  const p = placeLeaderLabel({
    text: LONGEST, side: 'left', W: 500, plotX0: 0.45, plotX1: 0.55, fontSize: 19, measure: FALLBACK,
  });
  assert.ok(p.fontSize >= MIN_FONT_SIZE, `shrank to ${p.fontSize}px`);
  assert.equal(p.shrunk, true);
});

test('a label that already fits is not shrunk at all', () => {
  // Shrink-to-fit must be the exception. If short names started coming back smaller, every sheet
  // would silently lose its type hierarchy.
  const p = placeLeaderLabel({
    text: 'SWALE', side: 'right', W: 1800, plotX0: 0.3, plotX1: 0.7, fontSize: 19, measure: CONDENSED,
  });
  assert.equal(p.fontSize, 19);
  assert.equal(p.shrunk, false);
});

test('invalid placement inputs cannot manufacture non-finite canvas coordinates', () => {
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const p = placeLeaderLabel({
      text: LONGEST,
      side: 'right',
      W: invalid,
      plotX0: invalid,
      plotX1: invalid,
      fontSize: invalid,
      measure: () => invalid,
    });
    assert.ok([p.x, p.fontSize, p.textW].every(Number.isFinite), JSON.stringify(p));
    assert.ok(p.fontSize >= MIN_FONT_SIZE);
  }
});

test('left callouts end before the property, right callouts start after it', () => {
  // The whole point of a margin column: a callout drawn over the plan hides the thing it names.
  const W = 1600;
  const plotX0 = 0.3, plotX1 = 0.7;
  const left = placeLeaderLabel({ text: 'RAINWATER TANK ×4', side: 'left', W, plotX0, plotX1, fontSize: 19, measure: CONDENSED });
  const right = placeLeaderLabel({ text: 'RAINWATER TANK ×4', side: 'right', W, plotX0, plotX1, fontSize: 19, measure: CONDENSED });
  assert.ok(left.x + left.textW <= plotX0 * W, 'left callout overlaps the property');
  assert.ok(right.x >= plotX1 * W, 'right callout overlaps the property');
});

test('stacked rows never overlap and stay inside the column', () => {
  const top = 140, bottom = 1030, gap = 34;
  for (const n of [1, 3, 8, 20, 26]) {
    // All wanting the same y is the worst case for a stacker.
    const rows = stackLeaderRows(Array(n).fill(600), top, bottom, gap);
    assert.equal(rows.length, n);
    for (let i = 1; i < n; i++) {
      assert.ok(rows[i] - rows[i - 1] >= gap - 0.001, `n=${n}: rows ${i - 1},${i} are ${rows[i] - rows[i - 1]}px apart`);
    }
    assert.ok(rows[0] >= top - 0.001, `n=${n}: first row at ${rows[0]} is above the column`);
  }
});

test('more labels than fit crowd downward instead of vanishing off the top', () => {
  // The original shifted the whole column up by its overflow and stopped, so an over-full side
  // produced NEGATIVE positions — callouts drawn above the sheet, absent rather than crowded.
  const top = 140, bottom = 400, gap = 34; // room for ~8, ask for 20
  const rows = stackLeaderRows(Array(20).fill(300), top, bottom, gap);
  assert.ok(rows.every((y) => y >= top - 0.001), `some rows are above the sheet: ${rows.filter((y) => y < top).join(', ')}`);
  assert.ok(rows[rows.length - 1] > bottom, 'the tail is expected to crowd past the bottom — that is the visible failure');
});

test('rows follow their features, and identical designs stack identically', () => {
  const rows = stackLeaderRows([200, 500, 900], 140, 1030, 34);
  assert.deepEqual(rows, [200, 500, 900], 'well-spaced features should not be moved at all');
  assert.deepEqual(stackLeaderRows([200, 500, 900], 140, 1030, 34), rows, 'must be deterministic');
});

test('an empty side places nothing rather than throwing', () => {
  assert.deepEqual(stackLeaderRows([], 140, 1030, 34), []);
});

test('row stacking preserves every label and returns only finite positions for invalid inputs', () => {
  const rows = stackLeaderRows(
    [100, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 300],
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NaN,
  );
  assert.equal(rows.length, 5, 'sanitising one bad feature must not drop another feature label');
  assert.ok(rows.every(Number.isFinite), rows.join(', '));
});

// ── Leader routing ───────────────────────────────────────────────────────────
// Regression cover for the crossed-leader bug found by rendering exact sheet 07 for the Ubhejane
// demo and looking at it: "JOJO TANK 2500L" appeared to point at the compost bay because the two
// leaders' long runs sat six pixels apart and merged into one line.

test('the long run follows the label row, so two leaders can never share it', () => {
  const rows = stackLeaderRows([239, 245], 100, 900, 40); // two elements only 6px apart in y
  assert.notEqual(rows[0], rows[1], 'label rows must be de-collided before this rule can hold');

  // Same crowded pair, drawn through the real path helper.
  const tank = leaderPath([308, 239], 256, 193, rows[0]);
  const compost = leaderPath([727, 245], 293, 230, rows[1]);

  // The segment a reader traces is elbow→to. Those must never lie on the same horizontal.
  assert.equal(tank.elbow[1], tank.to[1], 'the long run is horizontal');
  assert.equal(compost.elbow[1], compost.to[1], 'the long run is horizontal');
  assert.notEqual(tank.to[1], compost.to[1], 'two long runs on one line is the bug');

  // And each still starts at its own element, untouched.
  assert.deepEqual(tank.from, [308, 239]);
  assert.deepEqual(compost.from, [727, 245]);
});

test('the leader never runs along the element row, however close the label is to it', () => {
  // The old code passed the element's y here. Pinning the rule rather than the pixel: whatever the
  // label row is, that is where the run goes — even when it happens to equal the element's y.
  const p = leaderPath([500, 400], 300, 200, 400);
  assert.equal(p.elbow[1], 400);
  assert.equal(p.to[1], 400);

  const moved = leaderPath([500, 400], 300, 200, 640);
  assert.equal(moved.elbow[1], 640, 'the elbow tracks the LABEL, not the element');
  assert.equal(moved.from[1], 400, 'the anchor stays on the element');
});

test('callouts on one sheet stay within a readable spread of each other', () => {
  // Rendered water sheet 04 of the Ubhejane demo had SWALE at full size, GREYWATER LINE middling
  // and JOJO TANK 2500L at a quarter of it — three sizes on one page. The margin is genuinely too
  // narrow for the long name; shrinking to fit it was the wrong answer.
  const base = leaderLabelFontSize(2517);
  const narrow = { W: 2517, plotX0: 0.075, plotX1: 0.93, fontSize: base, measure: FALLBACK };

  const short = placeLeaderLabel({ text: 'SWALE', side: 'right', ...narrow });
  const long = placeLeaderLabel({ text: 'JOJO TANK 2500L', side: 'left', ...narrow });
  const longest = placeLeaderLabel({ text: 'GREYWATER DIVERTER & FILTER ×3', side: 'left', ...narrow });

  for (const p of [short, long, longest]) {
    assert.ok(p.fontSize >= minSizeFor(base),
      `${p.fontSize} is below the sheet floor ${minSizeFor(base)}`);
  }
  // The spread between the biggest and smallest callout on one sheet stays inside the band.
  const sizes = [short.fontSize, long.fontSize, longest.fontSize];
  assert.ok(Math.min(...sizes) / Math.max(...sizes) >= MIN_RELATIVE_SIZE - 0.01,
    `sizes diverged: ${sizes.join(', ')}`);
});

test('a label that overruns its margin still starts on the sheet, never off the left edge', () => {
  const base = leaderLabelFontSize(2517);
  const placed = placeLeaderLabel({
    text: 'GREYWATER DIVERTER & FILTER ×3', side: 'left',
    W: 2517, plotX0: 0.075, plotX1: 0.93, fontSize: base, measure: FALLBACK,
  });
  // Overrunning onto the map is the deliberate trade. Leaving the sheet is not.
  assert.ok(placed.x >= Math.round(2517 * SAFE_INSET_RATIO) - 1, `x=${placed.x} is outside the safe inset`);
  assert.ok(placed.x + placed.textW <= 2517, 'the label must not run off the right edge either');
});
