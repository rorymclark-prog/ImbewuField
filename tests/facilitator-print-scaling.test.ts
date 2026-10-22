import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// nav-13/desk-17: the A4 plan sheet is fixed at 297mm wide, so on a 390px phone only the left
// third was ever visible with no hint the rest exists; at 1280px the legend column was squeezed
// to ~90px by the drawing's flex:1 share, wrapping every row across 2-3 lines; and the global
// sample-mode 'Tour' pill (components/SampleModeBanner.tsx, not owned by this track) sat on top
// of this page's own 'More options' button in the same top-right corner.

const PAGE = readFileSync(new URL('../app/facilitator/print/page.tsx', import.meta.url), 'utf8');

test('the sheet scales down to fit a narrow screen via zoom, not just horizontal overflow scroll', () => {
  assert.match(PAGE, /function SheetScaler/, 'the SheetScaler helper is gone');
  assert.match(PAGE, /zoom:\s*1 !important/, 'print must still force the true 297mm size, not whatever zoom the screen last used');
  assert.match(PAGE, /Math\.min\(1, el\.clientWidth \/ SHEET_WIDTH_PX\)/, 'the sheet must only ever scale DOWN to fit, never up past true size on a wide screen');
});

test('w15-01: the zoom is measured on an outer box that is never zoomed itself', () => {
  // Measuring the zoomed element made its clientWidth depend on its own zoom, so ResizeObserver
  // flipped the zoom between 1 and the fit value and phones got a 297mm-wide page.
  assert.match(PAGE, /<div ref=\{wrapRef\}>\s*\n\s*<div className="sheetScaler" style=\{\{ zoom \}\}>/, 'the measured box and the zoomed box must be different elements');
  assert.doesNotMatch(PAGE, /ref=\{wrapRef\} className="sheetScaler"/, 'the zoomed box is measuring itself again');
});

test('both printed sheets (the full design and each layer page) are wrapped in SheetScaler', () => {
  const sheetDivs = PAGE.match(/<div className="sheet" style=\{SHEET_STYLE\}>/g) ?? [];
  assert.equal(sheetDivs.length, 2, 'expected exactly two .sheet renders (full design + the per-layer map)');
  assert.match(PAGE, /<SheetScaler>\s*\n\s*<div className="sheet" style=\{SHEET_STYLE\}>/, 'the full-design sheet is not wrapped in SheetScaler');
  assert.match(PAGE, /<SheetScaler key=\{lid\}>\s*\n\s*<div className="sheet" style=\{SHEET_STYLE\}>/, 'the per-layer sheet is not wrapped in SheetScaler');
});

test('the legend is a fixed-width single column, not a 2-column multicol squeezed by the drawing', () => {
  assert.doesNotMatch(PAGE, /columnCount: 2/, 'the legend is still a 2-column multicol list — rows will keep wrapping');
  assert.match(PAGE, /flex: '0 0 220px'/, 'the Legend + BOQ column must be a fixed width, not flex: 1 (squeezable to ~90px)');
});

test('the legend keeps its deliberately-exempt emoji glyphs (printed map legend/key, tested elsewhere)', () => {
  // tests/facilitator-print-fixes.test.ts already records that CATALOG/LINES/SECTOR_LABELS keep
  // their emoji on purpose as the printed map's own legend/key — not re-litigated here, just
  // confirmed this task did not quietly strip them while touching the same lines.
  assert.match(PAGE, /\{cat\.icon\} \{cat\.label\}/, 'the item legend lost its catalog icon');
  assert.match(PAGE, /\{L\.icon\} \{L\.label\}/, 'the line legend lost its catalog icon');
});

test('the print-toolbar reserves space for the sample-mode Tour pill instead of overlapping it', () => {
  assert.match(PAGE, /import \{ isSampleMode \} from '@\/lib\/sample-mode'/, 'sample mode is no longer detected on this page');
  assert.match(PAGE, /padding: sample \? '10px 100px 10px 16px' : '10px 16px'/, 'the toolbar no longer reserves right-hand space for the Tour pill in sample mode');
});
