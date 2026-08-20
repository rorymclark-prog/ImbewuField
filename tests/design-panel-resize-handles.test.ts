// The Layers panel's width-resize handle sat 9px OUTSIDE the left edge of a
// scrolling box. overflow-y:auto forces overflow-x:auto (CSS: a
// visible/non-visible pair on the two axes isn't allowed), which clips content
// left of the border box — the handle was invisible and unreachable everywhere
// (Rory, 2026-08-20: "i cant easily grab a handle still to adjust width of
// modal"). It now hangs off a non-scrolling outer wrapper, and both panels'
// handles straddle their edge with a 14px target.
//
// Source-level assertions because DesignPalette cannot render under node:test
// (same constraint as tests/design-ground-layer-guard.test.ts).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PALETTE = readFileSync(new URL('../components/design/DesignPalette.tsx', import.meta.url), 'utf8');

test('the Layers resize handle lives on a non-scrolling box', () => {
  assert.match(PALETTE, /aria-label="Drag to resize the Layers panel"/);
  // The outer wrapper is the one carrying the panel's zIndex switch; it must
  // not scroll (scrolling + a handle positioned outside the edge = clipped,
  // unreachable handle — the original bug).
  const outerStart = PALETTE.indexOf("zIndex: desktopAside && !isPhone ? 15 : 1000");
  assert.ok(outerStart > 0, 'the layers panel outer wrapper must exist');
  const outerStyle = PALETTE.slice(outerStart, PALETTE.indexOf('}}', outerStart));
  assert.equal(outerStyle.includes('overflowY'), false,
    'the outer wrapper must never scroll — the resize handle hangs outside its edge');
});

test('both panel resize handles straddle their edge with a 14px target', () => {
  const handles = PALETTE.match(/cursor: 'ew-resize'/g) ?? [];
  assert.equal(handles.length, 2, 'layers + elements');
  assert.match(PALETTE, /left: -7,\s*\n\s*width: 14/, 'layers handle: 7px in, 7px out');
  assert.match(PALETTE, /right: -7,\s*\n\s*width: 14/, 'elements handle: 7px in, 7px out');
});
