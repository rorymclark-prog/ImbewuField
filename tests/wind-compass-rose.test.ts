import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COMPASS16_BEARING } from '../lib/local-wind.ts';
import { aspectLabel } from '../lib/biome.ts';

// The bug this file guards against: components/DataPanel.tsx's climate-card wind compass rose
// rotated an SVG arrow using a hand-rolled `{ N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270,
// NW:315 }` lookup — only the 8 cardinal/intercardinal points. lib/nasa-power.ts's
// climate.windFromSummer/windFromWinter come from lib/biome.ts's aspectLabel(), which buckets a
// bearing into the FULL 16-point compass (NNE, ENE, ESE, SSE, SSW, WSW, WNW, NNW included, at
// 22.5° resolution) — roughly half of all real sites land on one of those 8 missing labels. The
// lookup returned `undefined` for them, and the code silently fell back to a fixed 45°/225°
// default: the arrow pointed at a generic NE/SW while the text label right underneath it kept
// printing the real, different direction.

test('COMPASS16_BEARING resolves every label aspectLabel can actually produce', () => {
  for (let step = 0; step < 16; step++) {
    const bearing = step * 22.5;
    const label = aspectLabel(bearing);
    const resolved = (COMPASS16_BEARING as Record<string, number>)[label];
    assert.equal(resolved, bearing, `aspectLabel(${bearing}) = '${label}' must round-trip through COMPASS16_BEARING`);
  }
});

test("DataPanel's wind compass rose reads the full 16-point bearing table, not a partial 8-point one", () => {
  const source = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');

  assert.match(
    source,
    /import\s*\{\s*COMPASS16_BEARING\s*\}\s*from\s*'@\/lib\/local-wind'/,
    'DataPanel must resolve compass-rose bearings from the canonical 16-point table',
  );

  // Guard the specific historical shape even if the import above survives but a second,
  // incomplete table gets reintroduced alongside it.
  assert.doesNotMatch(
    source,
    /\{\s*N:\s*0,\s*NE:\s*45,\s*E:\s*90,\s*SE:\s*135,\s*S:\s*180,\s*SW:\s*225,\s*W:\s*270,\s*NW:\s*315\s*\}/,
    'an 8-point-only compass bearing table has reappeared in DataPanel.tsx',
  );
});
