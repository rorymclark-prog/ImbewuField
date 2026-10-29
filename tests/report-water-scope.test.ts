import test from 'node:test';
import assert from 'node:assert/strict';
import { activeAccountLocalStorageKey } from '../lib/account-local-storage.ts';
import { buildDemoDesignCanvasState, DEMO_SITE } from '../lib/demo-farm.ts';
import { makeMercatorUnprojector, type DesignCanvasState } from '../lib/design-canvas.ts';
import { collectReportSiteFacts } from '../lib/report-site-facts-collect.ts';
import { buildReportHeaderMarkdown, normaliseReportSiteFacts, waterPromptBlock } from '../lib/report-site-facts.ts';
import { readFileSync } from 'node:fs';
import { reportDocumentText } from '../lib/report-localisation.ts';
import type { WaterPoint } from '../lib/water-points.ts';

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};
Object.assign(globalThis, { window: globalThis, localStorage: storage, sessionStorage: { getItem: () => null } });

const canvas = buildDemoDesignCanvasState();
const input = { siteId: canvas.siteId, lat: DEMO_SITE.lat, lon: DEMO_SITE.lon, canvas: null, cropPlan: null };
const point = (id: string, lat: number = DEMO_SITE.lat, lon: number = DEMO_SITE.lon): WaterPoint => ({
  id, name: id, lat, lon, category: 'Dam', createdAt: '2026-10-28T12:00:00Z',
});

test('a report never describes another farm’s distant water pin as its own dam', () => {
  values.clear();
  const pins = [point('This farm'), point('Other farm', DEMO_SITE.lat + 1, DEMO_SITE.lon + 1)];
  const key = activeAccountLocalStorageKey('imbewu_water_points');
  storage.setItem(key, JSON.stringify(pins));
  const before = storage.getItem(key);
  const facts = collectReportSiteFacts(input);
  assert.deepEqual(facts.water?.mapPoints.map(p => p.name), ['This farm']);
  assert.deepEqual(facts.water?.bodies.map(p => p.name), ['This farm']);
  assert.doesNotMatch(waterPromptBlock(facts, false), /Other farm/);
  assert.equal(storage.getItem(key), before, 'collecting report facts must not edit saved pins');
});

test('a Studio boundary excludes a neighbouring farm’s pin even within the proximity fallback', () => {
  values.clear();
  const state: DesignCanvasState = structuredClone(canvas);
  state.zones.push({ id: 'water-scope-boundary', feature: 'boundary', zone: 0, points: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] });
  const f = state.frame;
  const unproject = makeMercatorUnprojector(f.centerLng, f.centerLat, f.zoom, f.imgW, f.imgH);
  const [localLon, localLat] = unproject([0.5, 0.5]);
  const [neighbourLon, neighbourLat] = unproject([0.8, 0.5]);
  const before = JSON.stringify(state);
  const facts = collectReportSiteFacts({ ...input, canvas: state, waterPoints: [point('Inside', localLat, localLon), point('Neighbour', neighbourLat, neighbourLon)] });
  assert.deepEqual(facts.water?.mapPoints.map(p => p.name), ['Inside']);
  assert.equal(JSON.stringify(state), before, 'boundary membership must not move the saved design');
});

test('a map-only site uses its traced boundary rather than nearby points outside the parcel', () => {
  values.clear();
  const { lat, lon } = DEMO_SITE;
  const ring = [[lon - 0.001, lat - 0.001], [lon + 0.001, lat - 0.001], [lon + 0.001, lat + 0.001], [lon - 0.001, lat + 0.001], [lon - 0.001, lat - 0.001]];
  storage.setItem(activeAccountLocalStorageKey('imbewu_farm_shapes'), JSON.stringify({ type: 'FeatureCollection', features: [{
    type: 'Feature', id: 'water-scope-map-boundary', properties: { featureType: 'site', siteId: input.siteId, name: 'Property boundary' },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }] }));
  const facts = collectReportSiteFacts({ ...input, waterPoints: [point('Inside'), point('Nearby but outside', lat + 0.002, lon)] });
  assert.ok(facts.boundary, 'exercise the same mapped parcel that supplies report area');
  assert.deepEqual(facts.water?.mapPoints.map(p => p.name), ['Inside']);
});

test('missing site identity or invalid site coordinates cannot fall back to every account pin', () => {
  values.clear();
  const waterPoints = [point('Recorded')];
  for (const site of [{ siteId: '' }, { lat: NaN }, { lon: Infinity }, { lat: 91 }, { lon: 181 }]) {
    const facts = collectReportSiteFacts({ ...input, ...site, waterPoints });
    assert.equal(facts.water, undefined);
  }
});


test('even a boundary-contained pin records a location, not permission or reliable irrigation supply', () => {
  values.clear();
  const facts = collectReportSiteFacts({ ...input, waterPoints: [point('Neighbour dam')] });
  const restored = normaliseReportSiteFacts(JSON.parse(JSON.stringify(facts)))!;
  const prompt = waterPromptBlock(restored, false);
  assert.match(prompt, /ownership.*permission.*reliability/i);
  assert.match(prompt, /not.*available.*supply/i);
  assert.match(prompt, /Neighbour dam/);
  assert.doesNotMatch(prompt, /no dam/);
  assert.equal(restored.water?.statedStorageLitres, 0, 'a pin carries no measured capacity');
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/report-header-translation/source-cases.json', import.meta.url), 'utf8'));
  const note = 'Pinned on the map; water access and reliability not confirmed';
  for (const language of ['en', 'zu', 'st', 'ts', 've']) {
    const expected = reportDocumentText(note, language);
    if (language !== 'en') assert.notEqual(expected, note, 'the qualification must accompany every supported report language');
    const document = buildReportHeaderMarkdown({ ...fixture.cases[0].input, facts: restored }, language);
    assert.ok(document.includes(expected), `${language}: the screen and PDF header must qualify the recorded pin`);
  }
});


test('every independent report batch qualifies mapped capacity before it can be called irrigation supply', () => {
  const source = readFileSync(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');
  const system = source.slice(source.indexOf('          system: ['), source.indexOf("          messages: [{ role: 'user'"));
  assert.match(system, /WATER_ACCESS_PROMPT_RULE/);
  assert.match(source, /Do not subtract it from the dry-season deficit/);
  assert.match(source, /available volume must be confirmed before treating it as irrigation supply/);
  assert.doesNotMatch(source, /drawn storage and say if it is enough|State clearly whether this covers the dry-season deficit/);
});
