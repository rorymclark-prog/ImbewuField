import assert from 'node:assert/strict';
import test from 'node:test';

import { PNG } from 'pngjs';
import {
  expectedPhraseCoverage,
  measureMask,
  measureMaskTransitions,
  measureAspectDrift,
  measureRightPanel,
  normalizeOcrText,
  parseTesseractTsv,
} from '../scripts/benchmark-render-audit.mjs';

function rgbaImage(width: number, height: number, pixel: (x: number, y: number) => number[]) {
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      image.data.set(pixel(x, y), offset);
    }
  }
  return image;
}

test('alpha measurements report actual source/model authority instead of eyeballing a white mask', () => {
  const mask = rgbaImage(2, 2, (x, y) => {
    const alpha = [255, 0, 128, 255][y * 2 + x];
    return [255, 255, 255, alpha];
  });
  const report = measureMask(mask);

  assert.equal(report.fullyProtectedFraction, 0.5);
  assert.equal(report.fullyEditableFraction, 0.25);
  assert.equal(report.partialAlphaFraction, 0.25);
  assert.equal(report.sourceWeight, (255 + 128 + 255) / (255 * 4));
  assert.equal(report.modelWeight, 1 - report.sourceWeight);
});

test('mask transition count exposes separate composite-back seam loops', () => {
  const mask = rgbaImage(7, 3, (x, y) => {
    const editableIsland = y === 1 && (x === 1 || x === 5);
    return [255, 255, 255, editableIsland ? 0 : 255];
  });
  const report = measureMaskTransitions(mask);

  assert.equal(report.boundaryComponents, 2);
  assert.equal(report.transitionEdges, 8);
});

test('right-edge parchment panel is measured independently of its text and swatches', () => {
  const image = rgbaImage(10, 10, (x, y) => {
    if (x < 7) return [30, 60, 45, 255];
    if (x === 8 && y < 4) return [20, 20, 20, 255];
    return [242, 235, 215, 255];
  });

  assert.deepEqual(measureRightPanel(image), {
    present: true,
    left: 7,
    widthFraction: 0.3,
  });
});

test('OCR checks normalize multiplication signs and retain phrase-level failures', () => {
  assert.equal(normalizeOcrText('Tree Basin ×6'), 'tree basin x6');
  assert.deepEqual(
    expectedPhraseCoverage('Tree Basin x6; Small Pond', ['Tree Basin ×6', 'Tap Point ×4']),
    {
      matched: 1,
      expected: 2,
      fraction: 0.5,
      matches: [
        { phrase: 'Tree Basin ×6', found: true },
        { phrase: 'Tap Point ×4', found: false },
      ],
    },
  );
});

test('OCR metrics are resolution-independent for word height', () => {
  const tsv = [
    'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
    '5\t1\t1\t1\t1\t1\t10\t20\t30\t10\t80\tSmall',
    '5\t1\t1\t1\t1\t2\t45\t20\t30\t20\t90\tPond',
  ].join('\n');

  const report = parseTesseractTsv(tsv, 1000);
  assert.equal(report.wordCount, 2);
  assert.equal(report.confidenceMedian, 80);
  assert.equal(report.relativeWordHeightMedian, 0.01);
});

test('aspect drift compares the stored input and output rather than assuming dimensions match', () => {
  assert.deepEqual(
    measureAspectDrift(
      { width: 200, height: 100 },
      { width: 402, height: 200 },
    ),
    {
      sourceAspect: 2,
      outputAspect: 2.01,
      relativeDrift: 0.004999999999999893,
      sameOrientation: true,
    },
  );
});
