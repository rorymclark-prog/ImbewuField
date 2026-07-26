import assert from 'node:assert/strict';
import test from 'node:test';

import {
  sheetRenderRoute,
  DEFAULT_PRODUCER_STYLE,
  type SheetSpec,
  type SheetRoutePath,
} from '@/lib/sheet-render-route';
import { hasConflictingRenderAuthority, type RenderAuthorityFlags } from '@/lib/render-policy';
import type { SheetOutputMode } from '@/lib/locked-polish-flow';
import type { StylePreset } from '@/lib/producer-prompt';
import type { GlossyLayerFilter } from '@/lib/glossy-filters';

// The 8 plan-set sheets (DESIGN_SHEETS in DesignGlossy.tsx): 3 analytical/exact sheets + the 5
// GlossyLayerFilter design layers.
const LAYER_FILTERS: GlossyLayerFilter[] = ['all', 'water', 'zones', 'planting', 'structures'];
const SHEETS: Array<{ label: string; spec: SheetSpec }> = [
  { label: 'base', spec: { exact: 'base' } },
  { label: 'sector', spec: { exact: 'sector' } },
  { label: 'implementation', spec: { exact: 'implementation' } },
  ...LAYER_FILTERS.map((filter) => ({ label: `filter:${filter}`, spec: { filter } as SheetSpec })),
];
assert.equal(SHEETS.length, 8, 'expected exactly the 8 plan-set sheets');

const MODES: SheetOutputMode[] = ['exact', 'hybrid', 'full'];
const STYLE_CASES: Array<{ label: string; style: StylePreset }> = [
  { label: 'satellite_overlay (model-chrome)', style: 'satellite_overlay' },
  { label: 'precision_atlas (locked style)', style: 'precision_atlas' },
];

const EXPECTED_EXACT_PATH: Record<'base' | 'sector' | 'implementation', SheetRoutePath> = {
  base: 'render-base',
  sector: 'render-sector',
  implementation: 'render-implementation',
};
const EXPECTED_AI_PATH_FOR_EXACT_SHEET: Record<'base' | 'sector' | 'implementation', SheetRoutePath> = {
  base: 'sector-queue',
  sector: 'sector-queue',
  implementation: 'phasing-queue',
};

for (const { label: sheetLabel, spec } of SHEETS) {
  for (const mode of MODES) {
    for (const { label: styleLabel, style: selectedStyle } of STYLE_CASES) {
      test(`sheetRenderRoute(${sheetLabel}, ${mode}, ${styleLabel})`, () => {
        const route = sheetRenderRoute(spec, mode, selectedStyle);

        // ── path ──────────────────────────────────────────────────────────────────────────
        let expectedPath: SheetRoutePath;
        if (mode === 'exact') {
          expectedPath = 'exact' in spec ? EXPECTED_EXACT_PATH[spec.exact] : 'render-design-map';
        } else {
          expectedPath = 'exact' in spec ? EXPECTED_AI_PATH_FOR_EXACT_SHEET[spec.exact] : 'one-via-queue';
        }
        assert.equal(route.path, expectedPath, `path for ${sheetLabel}/${mode}`);

        if (mode === 'exact') {
          // ── exact mode: no style, no authority flags ──────────────────────────────────────
          assert.equal(route.styleUsed, null);
          assert.equal(route.hybridFlags, null);
          assert.equal(route.polishFlags, null);
          return;
        }

        // ── hybrid/full: styleUsed is never the model-chrome style ────────────────────────
        assert.notEqual(route.styleUsed, 'satellite_overlay');
        assert.ok(route.styleUsed, 'styleUsed must be set for hybrid/full');
        if (selectedStyle === 'satellite_overlay') {
          assert.equal(route.styleUsed, DEFAULT_PRODUCER_STYLE);
        } else {
          assert.equal(route.styleUsed, selectedStyle);
        }

        // ── hybridFlags: always the app-owned, geometry-locked contract ───────────────────
        const expectedHybridFlags: RenderAuthorityFlags = { showcase: false, geometryLock: true };
        assert.deepEqual(route.hybridFlags, expectedHybridFlags, `hybridFlags for ${sheetLabel}/${mode}`);
        assert.equal(hasConflictingRenderAuthority(route.hybridFlags!), false);

        // ── polishFlags: present ONLY for 'full', and always this exact fixed contract ────
        if (mode === 'full') {
          const expectedPolishFlags: RenderAuthorityFlags = { showcase: true, geometryLock: false };
          assert.deepEqual(route.polishFlags, expectedPolishFlags, `polishFlags for ${sheetLabel}/full`);
          assert.equal(hasConflictingRenderAuthority(route.polishFlags!), false);
        } else {
          assert.equal(route.polishFlags, null, `polishFlags must be absent for ${sheetLabel}/hybrid`);
        }
      });
    }
  }
}

test('sheetRenderRoute: null selectedStyle in hybrid/full falls back to DEFAULT_PRODUCER_STYLE', () => {
  const route = sheetRenderRoute({ filter: 'water' }, 'hybrid', null);
  assert.equal(route.styleUsed, DEFAULT_PRODUCER_STYLE);
  assert.deepEqual(route.hybridFlags, { showcase: false, geometryLock: true });
});

test('sheetRenderRoute: base and sector both route to sector-queue (one function, kind param)', () => {
  assert.equal(sheetRenderRoute({ exact: 'base' }, 'full', 'field_ledger').path, 'sector-queue');
  assert.equal(sheetRenderRoute({ exact: 'sector' }, 'full', 'field_ledger').path, 'sector-queue');
});
