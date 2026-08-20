// The crop-plan site picker must list Design Studio farms, not only cloud
// facilitator designs. A farmer who designed beds purely in the Studio (beds on
// the canvas, name on the saved place) previously saw a picker that omitted
// that farm entirely — it was reachable only through the Studio's own
// "plan crops" deep link — and two cloud designs sharing a title rendered as
// an unexplained duplicated row. studioPlanChoices (lib/design-beds-bridge.ts)
// is the pure part; the wiring assertions hold the page to actually using it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canvasSiteIdForPlace, studioPlanChoices } from '../lib/design-beds-bridge.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';

// Same hand-checkable frame as tests/design-beds-bridge.test.ts: 100 logical px
// per axis at 0.5 m/px = 50 real metres per axis.
function canvas(siteId: string): DesignCanvasState {
  return {
    siteId,
    frame: { centerLng: 31, centerLat: -29, zoom: 18, imgW: 100, imgH: 100, mPerPx: 0.5 },
    items: [],
    zones: [],
    lines: [],
    step: 'planting',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rev: 1,
  };
}

function canvasWithBeds(siteId: string, beds: number, plots: number): DesignCanvasState {
  const state = canvas(siteId);
  for (let i = 0; i < beds; i++) {
    state.items.push({ id: `bed-${i}`, defId: 'veg_bed', x: 0.1 * (i + 1), y: 0.2 });
  }
  for (let i = 0; i < plots; i++) {
    state.zones.push({
      id: `plot-${i}`,
      zone: 2,
      feature: 'staple_garden',
      points: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.3], [0.1, 0.3]],
    });
  }
  return state;
}

test('canvasSiteIdForPlace formats a saved place exactly like the canvas storage key (5 dp)', () => {
  // Real coordinates from a real farm — full double precision in, 5-dp key out.
  assert.equal(
    canvasSiteIdForPlace({ lat: -27.72618665984001, lon: 31.96316731169071 }),
    'site:-27.72619,31.96317',
  );
  assert.equal(canvasSiteIdForPlace({ lat: -29.5, lon: 30 }), 'site:-29.50000,30.00000');
});

test('studioPlanChoices lists only places whose canvas holds plantable beds, with bed/plot counts', () => {
  const places = [
    { lat: -27.72618665984001, lon: 31.96316731169071, name: 'Ubhejane Creche' },
    { lat: -29.784012656359764, lon: 30.74451132613504, name: 'No design yet' },
    { lat: -29.705854312244817, lon: 30.88427995875071, name: 'Empty canvas' },
  ];
  const canvases: Record<string, DesignCanvasState | null> = {
    'site:-27.72619,31.96317': canvasWithBeds('site:-27.72619,31.96317', 2, 1),
    'site:-29.78401,30.74451': null,
    'site:-29.70585,30.88428': canvas('site:-29.70585,30.88428'),
  };
  const choices = studioPlanChoices(places, (sid) => canvases[sid] ?? null);
  assert.deepEqual(choices, [
    { siteId: 'site:-27.72619,31.96317', name: 'Ubhejane Creche', bedCount: 2, plotCount: 1 },
  ]);
});

test('one unreadable canvas does not hide the farmer\'s other sites', () => {
  const places = [
    { lat: -1, lon: 1, name: 'Broken' },
    { lat: -2, lon: 2, name: 'Fine' },
  ];
  const choices = studioPlanChoices(places, (sid) => {
    if (sid === 'site:-1.00000,1.00000') throw new Error('corrupt JSON');
    return canvasWithBeds(sid, 1, 0);
  });
  assert.deepEqual(choices, [
    { siteId: 'site:-2.00000,2.00000', name: 'Fine', bedCount: 1, plotCount: 0 },
  ]);
});

test('two pins in the same 5-dp cell share one canvas and produce one choice', () => {
  const places = [
    { lat: -29.784090517821355, lon: 30.74447386556784, name: 'First pin wins' },
    { lat: -29.784094, lon: 30.744471, name: 'Second pin, same cell' },
  ];
  let loads = 0;
  const choices = studioPlanChoices(places, (sid) => {
    loads += 1;
    return canvasWithBeds(sid, 3, 0);
  });
  assert.equal(choices.length, 1);
  assert.equal(choices[0].name, 'First pin wins');
  assert.equal(loads, 1, 'the shared canvas is read once, not once per pin');
});

// ── Page wiring — the picker must actually use all of this ─────────────────

const PAGE = readFileSync(join(process.cwd(), 'app', 'facilitator', 'crops', 'page.tsx'), 'utf8');

test('the crops page feeds saved places + canvas loader into studioPlanChoices on mount', () => {
  assert.match(PAGE, /studioPlanChoices\(loadPlaces\(\), loadCanvasState\)/);
});

test('the picker renders a Design Studio group with a canvasSite deep link per site', () => {
  assert.match(PAGE, /From your Design Studio map/);
  assert.match(PAGE, /\/facilitator\/crops\?canvasSite=\$\{encodeURIComponent\(c\.siteId\)\}/);
});

test('picker visibility counts Studio sites — and Studio-only farms open it too', () => {
  assert.match(PAGE, /myDesignsList\.length \+ studioChoices\.length > 1/);
  assert.match(PAGE, /myDesignsList\.length === 0 && studioChoices\.length > 0/);
});

test('cloud rows carry a disambiguating subtitle — twin titles must not read as a duplicated row', () => {
  assert.match(PAGE, /cloudRowSubtitle\(d\)/);
});

test('?switch=1 CLEARS the main-site fallback so the picker can render from a Studio plan', () => {
  // Clearing, not merely skipping: client-side nav from the chip arrives with the
  // fallback already set, and a stale fallback keeps the picker blocked.
  assert.match(PAGE, /if \(switchParam === '1'\) \{ setFallbackCanvasSite\(null\); return; \}/);
  assert.match(PAGE, /href="\/facilitator\/crops\?switch=1"/);
});
