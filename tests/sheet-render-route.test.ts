import assert from 'node:assert/strict';
import test from 'node:test';

import {
  sheetRenderRoute,
  DEFAULT_PRODUCER_STYLE,
  type SheetSpec,
  type SheetRoutePath,
} from '@/lib/sheet-render-route';
import { hasConflictingRenderAuthority, renderAuthorityFlagsForStyle, type RenderAuthorityFlags } from '@/lib/render-policy';
import { isModelChromeStyle, STYLE_LINES } from '@/lib/producer-prompt';
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
// EVERY style, not a sample of two. The table used to cover satellite_overlay and precision_atlas
// only, which is enough to notice a difference between them and not enough to notice that a second
// model-chrome style had been added and silently skipped.
const STYLE_CASES: Array<{ label: string; style: StylePreset }> =
  (Object.keys(STYLE_LINES) as StylePreset[]).map((style) => ({
    label: `${style}${isModelChromeStyle(style) ? ' (model-chrome)' : ''}`,
    style,
  }));
assert.ok(STYLE_CASES.length >= 8, 'every StylePreset must be in the table');

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

        // ── style: preserved, EXCEPT a model-chrome style on an analysis sheet ────────────
        // Site/Sector/Phasing composite their own labels and legend back over the model output, so
        // a style whose premise is that the MODEL letters the page would put two legends on one
        // sheet. Every other combination must pass the selected style through untouched.
        const expectedStyle = 'exact' in spec && isModelChromeStyle(selectedStyle)
          ? DEFAULT_PRODUCER_STYLE
          : selectedStyle;
        assert.equal(route.styleUsed, expectedStyle, `styleUsed for ${sheetLabel}/${styleLabel}`);

        // ── hybridFlags: THE RULE, not a snapshot of it ───────────────────────────────────
        // This block used to assert the literal { showcase:false, geometryLock:true } for every
        // style. That is a snapshot: it pins whatever the constant happens to be, so it could not
        // fail when the constant was wrong — and it did not, for a day, while satellite_overlay
        // hybrids came out squashed with two legends. The rule is that authority follows the style,
        // and it has exactly one home.
        assert.deepEqual(
          route.hybridFlags,
          renderAuthorityFlagsForStyle(route.styleUsed!),
          `hybridFlags must equal render-policy's answer for ${route.styleUsed}`,
        );
        assert.equal(route.hybridFlags!.showcase, isModelChromeStyle(route.styleUsed!));
        assert.equal(route.hybridFlags!.geometryLock, !isModelChromeStyle(route.styleUsed!));
        assert.equal(hasConflictingRenderAuthority(route.hybridFlags!), false);

        // The coupling the flags actually encode: a model-chrome style is sent a SHEET-shaped
        // input (extendWithLegendPanel) while geometryLock builds a MAP-shaped protect mask. Both
        // at once is the mismatch that squashed the sheet 1.28x horizontally.
        assert.ok(
          !(isModelChromeStyle(route.styleUsed!) && route.hybridFlags!.geometryLock),
          'a sheet-shaped input must never also carry a map-shaped geometry lock',
        );

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
  assert.deepEqual(route.hybridFlags, renderAuthorityFlagsForStyle(DEFAULT_PRODUCER_STYLE));
});

test('one question, one answer: the router never disagrees with render-policy', () => {
  // The bug this exists to prevent: sheet-render-route hardcoded its own copy of the authority
  // rule while render-policy computed it, so the SAME style produced different products depending
  // on which button was pressed — "AI · ALL sheets" came out right and the per-sheet Generate came
  // out squashed. Naming both answerers is the point of the test.
  for (const style of Object.keys(STYLE_LINES) as StylePreset[]) {
    for (const filter of LAYER_FILTERS) {
      const route = sheetRenderRoute({ filter }, 'hybrid', style);
      assert.deepEqual(
        route.hybridFlags,
        renderAuthorityFlagsForStyle(style),
        `${style} on ${filter}: router and render-policy must agree`,
      );
    }
  }
});

test('an analysis sheet never runs a model-chrome style, in either AI mode', () => {
  for (const exact of ['base', 'sector', 'implementation'] as const) {
    for (const mode of ['hybrid', 'full'] as const) {
      const route = sheetRenderRoute({ exact }, mode, 'satellite_overlay');
      assert.equal(route.styleUsed, DEFAULT_PRODUCER_STYLE, `${exact}/${mode}`);
      assert.equal(isModelChromeStyle(route.styleUsed!), false);
    }
  }
  // And it must NOT block the five design-layer sheets, where model-chrome is the whole point —
  // over-applying this rule is what caused the Full Treatment dead-end of e0bf17a.
  for (const filter of LAYER_FILTERS) {
    assert.equal(sheetRenderRoute({ filter }, 'full', 'satellite_overlay').styleUsed, 'satellite_overlay');
  }
});

test('sheetRenderRoute: base and sector both route to sector-queue (one function, kind param)', () => {
  assert.equal(sheetRenderRoute({ exact: 'base' }, 'full', 'field_ledger').path, 'sector-queue');
  assert.equal(sheetRenderRoute({ exact: 'sector' }, 'full', 'field_ledger').path, 'sector-queue');
});
