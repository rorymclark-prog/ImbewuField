import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// /facilitator/print — swarm/calendar-print track: the Print button producing a blank job, the
// toolbar's emoji icons, and the Simple / All tools wiring.

const PAGE = readFileSync(join(process.cwd(), 'app', 'facilitator', 'print', 'page.tsx'), 'utf8');

test('the Print button is disabled — with a visible disabled style and a hint — when nothing is selected', () => {
  // Verified bug: the button used to stay enabled with nothing selected and print a blank job.
  assert.match(
    PAGE, /disabled=\{nothingToPrint\}/,
    'the Print button must be disabled when fullOn is off and no layer page is selected',
  );
  assert.match(
    PAGE, /if \(nothingToPrint\) return;/,
    'the click handler itself must refuse to act even if disabled is ever bypassed',
  );
  assert.match(
    PAGE, /background: nothingToPrint \? /,
    'the disabled state needs a visibly different fill, not just the disabled attribute',
  );
  assert.match(
    PAGE, /cursor: nothingToPrint \? 'not-allowed' : 'pointer'/,
    'the disabled state needs a visible cursor change',
  );
  assert.match(
    PAGE, /Select at least one page to print/,
    'a disabled Print button needs a short hint saying why',
  );
});

test('the toolbar\'s emoji icons are Lucide now', () => {
  assert.match(
    PAGE, /import \{ ArrowLeft, Pencil, Printer, Droplets, ChevronDown \} from 'lucide-react';/,
    'the toolbar icons must come from lucide-react',
  );
  assert.match(PAGE, /<ArrowLeft size=\{14\}/, 'the Back button must use the Lucide ArrowLeft icon');
  assert.match(PAGE, /<Pencil size=\{14\}/, 'the "Back to Design map" link must use the Lucide Pencil icon');
  assert.match(PAGE, /<Printer size=\{15\}/, 'the Print button must use the Lucide Printer icon');
  assert.match(PAGE, /<Droplets size=\{11\}/, 'the rainwater-harvest note must use the Lucide Droplets icon');
});

test('no stray toolbar emoji remain outside the printed map legend', () => {
  // The CATALOG/LINES/SECTOR_LABELS tables (and boqRows/existingRows, which read from them) keep
  // their emoji deliberately — the printed map's own legend/key, which the task explicitly allows
  // to stay. Toolbar buttons and the harvest note are not part of that key.
  const toolbar = PAGE.slice(PAGE.indexOf('className="print-toolbar"'), PAGE.indexOf('{fullOn && ('));
  assert.doesNotMatch(toolbar, /🖨|✎/, 'the print-toolbar div must not carry the old emoji glyphs');
  const harvestNote = PAGE.slice(PAGE.indexOf('{c.harvest && ('), PAGE.indexOf('{c.harvest && (') + 400);
  assert.doesNotMatch(harvestNote, /💧/, 'the harvest note must not carry the old emoji glyph');
});

test('Simple reads the Simple / All tools switch and follows it on this page', () => {
  assert.match(
    PAGE, /import \{ useAppLevel \} from '@\/lib\/app-level';/,
    'the print page must import the shared Simple / All tools hook',
  );
  assert.match(
    PAGE, /const simple = useAppLevel\(\) === 'simple';/,
    'the print page must read the level the same way other Simple-aware screens do',
  );
});

test('Simple collapses the per-layer page checkboxes behind "More options"; All tools always shows them', () => {
  assert.match(
    PAGE, /\{simple && \(\s*\n\s*<button\s*\n\s*onClick=\{\(\) => setShowMoreOptions/,
    'Simple needs its own "More options" disclosure control',
  );
  assert.match(
    PAGE, /\{\(!simple \|\| showMoreOptions\) && \(\s*\n\s*<>/,
    'the Full design / per-layer checkbox row must be gated behind Simple\'s disclosure',
  );
});

test('Simple\'s default print job is the full design only — layer pages need "More options" first', () => {
  assert.match(
    PAGE, /const activeLayerPages = simple && !showMoreOptions\s*\n\s*\? \[\]/,
    'in Simple, with More options closed, no per-layer page may be selected for printing',
  );
});

test('Simple prints one clear action, labelled for a farmer/facilitator rather than technical PDF language', () => {
  assert.match(
    PAGE, /\{simple \? 'Print my plan' : 'Print \/ Save as PDF'\}/,
    'Simple\'s Print button must read "Print my plan"',
  );
});

test('Simple collapses the costed BOQ and "Already on the land" tables behind "More options"; All tools always shows them', () => {
  assert.match(
    PAGE, /\{\(!simple \|\| showMoreOptions\) && \(\s*\n\s*<div style=\{\{ flex: 1 \}\}>/,
    'the Bill of quantities column (which also carries the "Already on the land" table) must be gated behind Simple\'s disclosure',
  );
});
