import test from 'node:test';
import assert from 'node:assert/strict';

import {
  balancedLegendColumnRanges,
  COMPACT_LEGEND_MAX_ROWS,
  countedLegendText,
  fitLegendFontSize,
  FULL_HEIGHT_LEGEND_MIN_ROWS,
  legendHeightFillRatio,
  layoutLegendColumn,
  legendMaxFontSize,
  legendRowFontSize,
  legendRowGap,
  MAX_GAP_TO_ROW_RHYTHM,
} from '../lib/sheet-legend-layout.ts';

test('spare panel height never becomes holes between legend rows, however many rows there are', () => {
  // REVERSED DELIBERATELY. This test used to assert the opposite — that six or more rows justify
  // their slack across the column so the last row reaches the notes block. That policy read well
  // on the six-row Water sheet it was written for and failed badly on the 22-row Planting sheet,
  // where it produced 9px type with the leftover height poured into the gaps: "look at the legend,
  // big spaces between items, icons way way too small and text way too small."
  //
  // Those were never three problems. Spare height is type size that was not claimed, so the
  // fitting search in DesignGlossy claims it there first, and the gap keeps its rhythm ceiling at
  // every row count. Space left at the FOOT of a panel is honest; space punched between every row
  // is a layout pretending to be full.
  const lineHeight = 24;
  for (const rowCount of [3, 4, 5, 6, 12, 22]) {
    const gap = legendRowGap(1_200, 360, rowCount, lineHeight);
    assert.ok(
      gap <= lineHeight * MAX_GAP_TO_ROW_RHYTHM + 0.001,
      `row count ${rowCount} must not exceed the rhythm ceiling`,
    );
  }
});

test('a sectioned Water legend uses one even rhythm instead of creating isolated section islands', () => {
  // The measured row structure of the saved Water sheet: 2 Rainwater, 3 Irrigation, 1 Water
  // Earthworks. Heights include each printed section heading, exactly as composeStyleSheet passes
  // them to the layout authority.
  const availableHeight = 1_289;
  const rowRhythm = 20;
  const rows = [
    { height: 54 },
    { height: 32 },
    { height: 54 },
    { height: 32 },
    { height: 32 },
    { height: 54 },
  ];
  const layout = layoutLegendColumn(availableHeight, rows, rowRhythm);

  assert.equal(layout.overflow, false);
  assert.equal(layout.offsets[0], 0, 'the first section begins directly under LEGEND');
  // Was `contentBottom === availableHeight`. See the reversal note on the first test in this file:
  // a legend no longer stretches to the notes block by inflating the space between its rows.
  assert.ok(layout.contentBottom <= availableHeight, 'the column stays inside its reserved band');

  for (let index = 0; index < rows.length - 1; index += 1) {
    const gap = layout.offsets[index + 1] - layout.offsets[index] - rows[index].height;
    assert.ok(
      Math.abs(gap - layout.rowGap) < 0.001,
      'every factual row shares one visual rhythm',
    );
  }
  rows.forEach((row, index) => {
    assert.ok(layout.offsets[index] >= 0);
    assert.ok(layout.offsets[index] + row.height <= availableHeight + 0.001);
    if (index > 0) {
      assert.ok(layout.offsets[index] >= layout.offsets[index - 1] + rows[index - 1].height);
    }
  });
});

test('three singleton sections remain a compact list instead of becoming three isolated islands', () => {
  const availableHeight = 1_000;
  const rowRhythm = 40;
  const rows = Array.from({ length: 3 }, () => ({ height: 50 }));
  const layout = layoutLegendColumn(availableHeight, rows, rowRhythm);

  assert.equal(layout.overflow, false);
  assert.ok(layout.contentBottom < availableHeight, 'a genuinely sparse legend keeps honest space below');
  for (let index = 0; index < rows.length - 1; index += 1) {
    const gap = layout.offsets[index + 1] - layout.offsets[index] - rows[index].height;
    assert.ok(gap <= rowRhythm * MAX_GAP_TO_ROW_RHYTHM + 0.001);
  }
});

test('a legend column grows only with the rows it actually holds, never to fill the panel', () => {
  // REVERSED with the two tests above — this asserted the middle of the same justify-to-fill curve
  // (four rows part way, six rows all the way to the panel foot). What survives is the part that
  // was always true and is still worth guarding: more rows make a taller column, every gap obeys
  // one rhythm, and no row count reaches down to the notes block by stretching its gaps.
  const availableHeight = 1_000;
  const rowHeight = 50;
  const rowRhythm = 40;
  const counts = [3, 4, 5, 6];
  const layouts = counts.map((count) => layoutLegendColumn(
    availableHeight,
    Array.from({ length: count }, () => ({ height: rowHeight })),
    rowRhythm,
  ));

  // The fill-ratio curve itself stays exported and tested: it no longer sizes type or gaps, but it
  // remains the file's stated sparse-vs-dense vocabulary and other layout code may still ask it.
  assert.equal(COMPACT_LEGEND_MAX_ROWS, 3);
  assert.equal(FULL_HEIGHT_LEGEND_MIN_ROWS, 6);
  assert.deepEqual(counts.map(legendHeightFillRatio), [0, 1 / 3, 2 / 3, 1]);

  for (let i = 1; i < layouts.length; i += 1) {
    assert.ok(layouts[i - 1].contentBottom < layouts[i].contentBottom, 'more rows, taller column');
  }
  layouts.forEach((layout, index) => {
    assert.ok(
      layout.contentBottom < availableHeight,
      `${counts[index]} rows must not stretch to the panel foot`,
    );
    assert.ok(layout.rowGap <= rowRhythm * MAX_GAP_TO_ROW_RHYTHM + 0.001);
  });
});

test('legend type is ONE standard size across the whole plan set, whatever a sheet holds', () => {
  // THIS TEST USED TO ASSERT THE OPPOSITE, and it was retired deliberately rather than adjusted.
  //
  // It pinned a curve that let a sparse legend grow into its spare panel height. That policy is
  // what made Rory report legend type four times in one evening of real sheets, twice in each
  // direction — "way too big" on the four-row Zones sheet, "too small" on the nine-row Sector
  // sheet, "terribly small again" on the one-row Earthworks sheet — and then ask for the thing
  // those complaints have in common: "try keep this standard throughout the maps, as standard as
  // possible." A per-sheet size cannot be standard across sheets. The curve had to go, not move.
  //
  // Height and row count are still parameters (the caller's overflow search needs them) but must
  // no longer influence the answer at all — that is the property worth guarding, because
  // reintroducing either one is exactly how this regresses.
  const standard = legendRowFontSize(445, 1_289, 3);
  for (const rowCount of [1, 3, 4, 5, 6, 9, 14]) {
    for (const panelHeight of [400, 1_289, 4_000]) {
      assert.equal(
        legendRowFontSize(445, panelHeight, rowCount),
        standard,
        `row count ${rowCount} at panel height ${panelHeight} must not change legend type size`,
      );
    }
  }

  // The band itself: a constant fraction of PANEL WIDTH, which is what decides how many characters
  // fit on a line — the same rule the legend icons have always used (symbolSizeFor in
  // DesignGlossy.tsx), and the reason the icons were the one part Rory said was already right.
  assert.equal(standard, 32);
  assert.ok(standard <= legendMaxFontSize(445), 'the standard size sits inside its own ceiling');
  assert.ok(legendRowFontSize(890, 1_289, 3) > standard, 'a wider panel still scales up');
  assert.ok(standard >= 22, 'the floor is a readable size, not a fitting artefact');
});

test('fit-to-height chooses the largest sparse type that its measured rows can hold', () => {
  const availableHeight = 1_289;
  const measuredHeight = (fontSize: number) => fontSize * 6;
  const fitted = fitLegendFontSize(measuredHeight, availableHeight, 300, 9);

  assert.ok(fitted > 29, 'the search is allowed past the old width-derived ceiling');
  assert.ok(measuredHeight(fitted) <= availableHeight);
  assert.ok(measuredHeight(fitted + 1) > availableHeight, 'the next larger size would overflow');
});

test('the dense Planting inventory remains bounded by its existing readable baseline', () => {
  const denseRows = 21;
  const normal = legendRowFontSize(445, 1_289, denseRows);
  const populatedBaseline = legendRowFontSize(445, 1_289, 6);
  assert.ok(normal <= populatedBaseline, 'dense legends do not inherit sparse-panel inflation');
  assert.ok(normal >= 17, 'dense legends retain the readable minimum before column fitting');
});

test('an overfull factual legend partitions into readable columns without losing or reordering rows', () => {
  const layout = layoutLegendColumn(
    400,
    Array.from({ length: 10 }, () => ({ height: 60 })),
    24,
  );
  assert.equal(layout.overflow, true);
  const ranges = balancedLegendColumnRanges(Array.from({ length: 10 }, () => 60), 2);
  assert.deepEqual(ranges, [{ start: 0, end: 5 }, { start: 5, end: 10 }]);
  assert.deepEqual(
    ranges.flatMap((range) => Array.from(
      { length: range.end - range.start },
      (_value, index) => range.start + index,
    )),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  for (const range of ranges) {
    const usedHeight = (range.end - range.start) * 60;
    assert.ok(usedHeight <= 400, 'each column fits without shrinking below the font floor');
  }
});

test('column balancing is finite, contiguous, and rejects invalid geometry', () => {
  assert.deepEqual(balancedLegendColumnRanges([100, 20, 20, 100], 2), [
    { start: 0, end: 2 },
    { start: 2, end: 4 },
  ]);
  assert.deepEqual(balancedLegendColumnRanges([10, 10], 3), [
    { start: 0, end: 1 },
    { start: 1, end: 2 },
  ]);
  assert.deepEqual(balancedLegendColumnRanges([], 2), []);
  assert.deepEqual(balancedLegendColumnRanges([10, Number.NaN], 2), []);
  assert.deepEqual(balancedLegendColumnRanges([10], 0), []);
});

test('column balancing scores the heading repeated at each real column start', () => {
  const provisionalHeights = [40, 20, 20, 20, 20, 20];
  assert.deepEqual(
    balancedLegendColumnRanges(provisionalHeights, 3),
    [{ start: 0, end: 1 }, { start: 1, end: 3 }, { start: 3, end: 6 }],
    'a whole-list measurement charges the heading only once and chooses an uneven split',
  );
  assert.deepEqual(
    balancedLegendColumnRanges(
      provisionalHeights,
      3,
      (start, end) => 20 + (end - start) * 20,
    ),
    [{ start: 0, end: 2 }, { start: 2, end: 4 }, { start: 4, end: 6 }],
    'exact slice costs charge the continued-section heading in every column',
  );
  assert.deepEqual(
    balancedLegendColumnRanges(provisionalHeights, 3, () => Number.NaN),
    [],
    'an invalid renderer measurement cannot become a plausible partition',
  );
});

test('legend rows consume the height the panel actually has instead of keeping a short-sheet cap', () => {
  const rowCount = 6;
  const usedHeight = 360;
  const shortAvailable = 760;
  const tallAvailable = 1960;
  const shortGap = legendRowGap(shortAvailable, usedHeight, rowCount);
  const tallGap = legendRowGap(tallAvailable, usedHeight, rowCount);

  assert.ok(tallGap > shortGap, 'a taller boundary must produce a taller row rhythm');
  assert.equal(usedHeight + shortGap * (rowCount - 1), shortAvailable);
  assert.equal(usedHeight + tallGap * (rowCount - 1), tallAvailable);
});

test('an overcrowded panel never invents negative space or shrinks type through the gap helper', () => {
  assert.equal(legendRowGap(400, 600, 8), 0);
  assert.equal(legendRowGap(Number.NaN, 200, 4), 0);
  assert.equal(legendRowGap(400, 200, 0), 0);
});

test('legend gap geometry is finite, non-negative, and exactly consumes spare height', () => {
  for (const availableHeight of [0, 1, 400, 10_000]) {
    for (const usedHeight of [0, 1, 399, 20_000]) {
      for (const rowCount of [1, 2, 7, 100]) {
        const gap = legendRowGap(availableHeight, usedHeight, rowCount);
        assert.ok(Number.isFinite(gap) && gap >= 0);
        if (availableHeight >= usedHeight && rowCount > 1) {
          assert.equal(usedHeight + gap * (rowCount - 1), availableHeight);
        } else if (rowCount === 1) {
          assert.equal(gap, 0, 'one row has no between-row slot to spread');
        } else {
          assert.equal(gap, 0);
        }
      }
    }
  }
});

test('invalid measurements cannot become legend spacing', () => {
  for (const invalid of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
  ]) {
    assert.equal(legendRowGap(invalid, 10, 2), 0);
    assert.equal(legendRowGap(10, invalid, 2), 0);
  }
  for (const invalidCount of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(legendRowGap(10, 5, invalidCount), 0);
  }
});

test('every countable row states its count, including one', () => {
  assert.equal(countedLegendText('Empty group', 0), 'Empty group ×0');
  assert.equal(countedLegendText('JoJo Tank', 1), 'JoJo Tank ×1');
  assert.equal(countedLegendText('Tap Point', 6), 'Tap Point ×6');
  assert.equal(countedLegendText('Buried water pipe', 1), 'Buried water pipe ×1');
});

test('a sparse legend stays compact while a populated legend uses the full reserved column', () => {
  // Rendered water sheet 04: three rows in a full-height cream panel. Sharing ALL the slack put a
  // visible hole between each row — the legend read as broken rather than full, and the panel was
  // still empty at the bottom because the same gap follows the last row too.
  const lineH = 40;
  const spread = legendRowGap(1000, 130, 3, lineH);
  assert.ok(spread <= lineH * MAX_GAP_TO_ROW_RHYTHM + 0.001, `gap ${spread} dwarfs the row rhythm ${lineH}`);

  // A well-populated legend still spreads: with enough rows the shared slack is under the ceiling,
  // so the sparse-list cap never applies and the final visible row reaches the reserved foot.
  const many = legendRowGap(1000, 880, 12, lineH);
  assert.equal(many, (1000 - 880) / (12 - 1), 'a populated legend uses between-row slots only');
  assert.equal(880 + many * (12 - 1), 1000);
  assert.ok(many < spread, 'a fuller legend has tighter gaps than a sparse one');
});

test('legendRowGap never returns a negative or non-finite gap', () => {
  assert.equal(legendRowGap(100, 400, 3, 40), 0, 'an overfull legend gets no extra gap');
  assert.equal(legendRowGap(Number.NaN, 10, 3, 40), 0);
  assert.equal(legendRowGap(100, 10, 0, 40), 0);
  assert.ok(Number.isFinite(legendRowGap(1000, 100, 3)), 'omitting the rhythm still yields a number');
});

test('invalid counts can never print as plausible legend facts', () => {
  for (const invalid of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () => countedLegendText('Feature', invalid),
      /non-negative safe integer/i,
    );
  }
});
