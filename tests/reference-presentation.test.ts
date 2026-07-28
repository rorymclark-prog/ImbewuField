import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateBoundaryPresentationCrop,
  calculateBoundaryPresentationLayout,
  calculatePhasingSheetSize,
  MAX_PRESENTATION_MAP_ASPECT,
  MAX_PRESENTATION_SHEET_ASPECT,
} from '@/lib/reference-presentation';

const FRAME = { imgW: 960, imgH: 640, mPerPx: 0.4 };
const SQUARE_BOUNDARY: Array<[number, number]> = [
  [0.4, 0.35],
  [0.6, 0.35],
  [0.6, 0.65],
  [0.4, 0.65],
];
const WIDE_BOUNDARY: Array<[number, number]> = [
  [0.3, 0.425],
  [0.7, 0.425],
  [0.7, 0.575],
  [0.3, 0.575],
];
const TALL_BOUNDARY: Array<[number, number]> = [
  [0.45, 0.2],
  [0.55, 0.2],
  [0.55, 0.8],
  [0.45, 0.8],
];

test('compact properties fill the finished sheet instead of staying at the old 24% floor', () => {
  const crop = calculateBoundaryPresentationCrop([
    [0.45, 0.46],
    [0.55, 0.46],
    [0.55, 0.54],
    [0.45, 0.54],
  ]);

  assert.ok(crop);
  assert.ok(crop.cropFraction < 0.24);
  assert.ok(crop.cropFraction >= 0.08);
});

test('presentation crop stays inside the source image near an edge', () => {
  const crop = calculateBoundaryPresentationCrop([
    [0.01, 0.01],
    [0.13, 0.01],
    [0.13, 0.12],
    [0.01, 0.12],
  ]);

  assert.ok(crop);
  assert.equal(crop.cropX, 0);
  assert.equal(crop.cropY, 0);
  assert.ok(crop.cropX + crop.cropFraction <= 1);
  assert.ok(crop.cropY + crop.cropFraction <= 1);
});

test('large properties retain the original frame', () => {
  assert.equal(calculateBoundaryPresentationCrop([
    [0.05, 0.05],
    [0.90, 0.05],
    [0.90, 0.90],
    [0.05, 0.90],
  ]), null);
});

test('long-thin and square farms receive different finished-sheet shapes', () => {
  const square = calculateBoundaryPresentationLayout(SQUARE_BOUNDARY, FRAME);
  const wide = calculateBoundaryPresentationLayout(WIDE_BOUNDARY, FRAME);

  assert.ok(square);
  assert.ok(wide);
  assert.notEqual(wide.imgW / wide.imgH, square.imgW / square.imgH);
  assert.notEqual(wide.sheetAspect, square.sheetAspect);
});

test('every derived viewport keeps one truthful metres-per-pixel scale on both axes', () => {
  for (const boundary of [SQUARE_BOUNDARY, WIDE_BOUNDARY, TALL_BOUNDARY]) {
    const layout = calculateBoundaryPresentationLayout(boundary, FRAME);
    assert.ok(layout);
    const xMetresPerPixel = (layout.cropWidth * FRAME.imgW * FRAME.mPerPx) / layout.imgW;
    const yMetresPerPixel = (layout.cropHeight * FRAME.imgH * FRAME.mPerPx) / layout.imgH;
    const expected = FRAME.mPerPx * layout.sourcePixelsPerOutputPixel;

    assert.ok(Math.abs(xMetresPerPixel - yMetresPerPixel) < 1e-12);
    assert.ok(Math.abs(xMetresPerPixel - expected) < 1e-12);
  }
});

test('a four-to-one wide farm is letterboxed before the complete sheet can exceed three-to-one', () => {
  const layout = calculateBoundaryPresentationLayout(WIDE_BOUNDARY, FRAME);

  assert.ok(layout);
  assert.ok(layout.imgW / layout.imgH <= MAX_PRESENTATION_MAP_ASPECT + 0.01);
  assert.ok(layout.sheetAspect <= MAX_PRESENTATION_SHEET_ASPECT);
});

test('a one-to-four tall farm keeps the readable minimum legend width', () => {
  const layout = calculateBoundaryPresentationLayout(TALL_BOUNDARY, FRAME);

  assert.ok(layout);
  assert.ok(layout.sheetAspect <= MAX_PRESENTATION_SHEET_ASPECT);
  assert.ok(layout.legendWidth >= 360);
});

test('sheet 08 adds the same panel column as the rest of a tall plan set', () => {
  const layout = calculateBoundaryPresentationLayout(TALL_BOUNDARY, FRAME);
  const sheet = calculatePhasingSheetSize(TALL_BOUNDARY, FRAME);

  assert.ok(layout);
  assert.equal(sheet.mapW, layout.imgW * 2);
  assert.equal(sheet.mapH, layout.imgH * 2);
  assert.equal(sheet.W, sheet.mapW + sheet.legendWidth);
  assert.ok(sheet.W > sheet.mapW, 'the schedule must own a column instead of covering the map');
  assert.equal(sheet.aspect, layout.sheetAspect);
  assert.ok(sheet.aspect <= MAX_PRESENTATION_SHEET_ASPECT);
});

test('a one-to-six plot can have a map over four-to-one while sheet 08 still stays within three-to-one', () => {
  const boundary: Array<[number, number]> = [
    [0.475, 0.275],
    [0.525, 0.275],
    [0.525, 0.725],
    [0.475, 0.725],
  ];
  const sheet = calculatePhasingSheetSize(boundary, FRAME);

  assert.ok(sheet.mapH / sheet.mapW > 4);
  assert.ok(sheet.aspect <= MAX_PRESENTATION_SHEET_ASPECT);
  assert.ok(sheet.legendWidth >= 360);
});
