import { replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS, hasPlanningYield } from '../lib/crop-catalog.ts';
import type { ProductionLog, SalesLog } from '../lib/db/types.ts';
import { crop, local, account, reset, cleanup, studio, studioKey, bookKey, ownRow, siteId, stamp } from './international-grower-operations-fixture.ts';

// Actual storage/source/forecast code and graph run. Only Firebase identity,
// framework navigation/language and TSX loading are controlled boundaries.
const rootUrl = new URL('../', import.meta.url).href;
Object.assign(globalThis, { __growerFinanceBoundary: { React } });
const moduleUrl = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/link') return moduleUrl(`const React=globalThis.__growerFinanceBoundary.React;
      export default function Link({children,...props}){return React.createElement('a',props,children);}`);
    if (specifier === '@/lib/i18n') return moduleUrl("export const useLanguage=()=>({lang:'en',t:key=>key});");
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(rootUrl) && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { loadFinancePlanSource } = await import('../lib/finance-plan-source.ts');
const { default: FinanceGraphs } = await import('../components/FinanceGraphs.tsx');
const { createSiteCountryContext } = await import('../lib/international/site-context.ts');
const { updateSiteCountryContext } = await import('../lib/saved-places.ts');
const { buildFinanceSeries } = await import('../lib/finance-series.ts');
const { buildFarmMetrics } = await import('../lib/farm-metrics.ts');
const { inspectGrowerWorkflowSource } = await import('../lib/international/grower-workflow-source.ts');
after(() => { hooks.deregister(); Reflect.deleteProperty(globalThis, '__growerFinanceBoundary'); cleanup(); });
const cropDef = CROPS.find(hasPlanningYield)!;
const now = new Date();
const production: ProductionLog[] = [{ id: 'observed-fixture', profile_id: 'fixture-owner', garden_id: null, crop: cropDef.name,
  kg: 5, photo_url: null, logged_at: now.toISOString(), created_at: now.toISOString() }];
const sales: SalesLog[] = [{ id: 'sold-fixture', profile_id: 'fixture-owner', garden_id: null, crop: cropDef.name,
  kg: 2, amount: 10, buyer: null, sold_at: now.toISOString(), created_at: now.toISOString() }];
const settings = { lossPercent: 0, sellPercent: 100, confirmed: true };
const legacy = { id: 'legacy-measured', bedId: 'bed-a', cropKey: cropDef.key, sowMonth: now.getMonth() + 1 };
const orphan = { id: 'unresolved-own', bedId: 'removed-bed', cropKey: cropDef.key, sowMonth: 1, growerCycle: null };
function saveBook(plantings: unknown[]) { replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings, updatedAt: 7 })); }
beforeEach(async () => {
  await reset();
  local.setItem(account.activeAccountLocalStorageKey('permamap_saved_places'), JSON.stringify([{ id: 'finance-main', name: 'Fictional finance source',
    lat: 0, lon: 0, biome: 'Recorded', rainfall: 0, elevation: 0, savedAt: stamp, updatedAt: 100 }]));
  local.setItem(studioKey(), JSON.stringify(studio()));
  const country = createSiteCountryContext({ siteId, countryCode: 'ZA', confirmed: true }); assert.ok(country);
  assert.equal(updateSiteCountryContext(siteId, country).status, 'local-saved');
  saveBook([]);
});
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(c => text(c as ReactTestInstance | string)).join(''); }
function graph(source = loadFinancePlanSource()) {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(FinanceGraphs, { source, production, sales, invoices: [], settings })); });
  return { renderer, text: () => text(renderer.root),
    plan() { const button = renderer.root.findAllByType('button').find(node => text(node) === 'Plan vs actual'); assert.ok(button); act(() => button.props.onClick()); },
    close() { act(() => renderer.unmount()); } };
}

test('an orphan own marker cannot disappear into an empty finance plan while its actual picking and sales stay available',async()=>{
  saveBook([orphan]); const source = loadFinancePlanSource(); const rendered = graph(source);
  try {
    assert.match(rendered.text(), /5(?:\.0)?\s*kg/); assert.match(rendered.text(), /2(?:\.0)?\s*kg/);
    rendered.plan(); const output = rendered.text();
    assert.match(output, /Plan comparison unavailable/, `Actual plan graph before the uncertainty gate: ${output}`);
    assert.doesNotMatch(output, /Your crop plan is empty|Nothing to compare yet/);
    assert.equal(source.forecastAvailable, false); assert.deepEqual(source.forecastPlantings, []);
  } finally { rendered.close(); }
});

test('a surviving legacy row cannot turn unresolved orphan own evidence into a complete finance forecast',async()=>{
  saveBook([legacy, orphan]); const source = loadFinancePlanSource(); const rendered = graph(source);
  try {
    rendered.plan(); assert.match(rendered.text(), /Plan comparison unavailable/);
    assert.equal(source.forecastAvailable, false); assert.deepEqual(source.forecastPlantings, []);
    assert.deepEqual(source.plantings, [legacy]); assert.equal(source.areaM2, 8);
  } finally { rendered.close(); }
});

test('actual dated cycles on old or current ground remain unknown finance capacity instead of borrowing catalogue yields', async () => {
  const current = await ownRow();
  const oldCanvas = studio(); oldCanvas.items[0].id = 'removed-bed';
  const old = await ownRow(oldCanvas, 'studio-canvas', siteId, 'old-own');
  for (const row of [current.row, old.row]) {
    saveBook([legacy, row]); const source = loadFinancePlanSource();
    assert.equal(source.forecastAvailable, false); assert.deepEqual(source.forecastPlantings, []);
    assert.equal(source.withheldPlantingCount, 2); assert.match(source.forecastReason!, /Own dated or unresolved/);
  }
});

async function foreignRow(bedId = 'foreign-bed', plantingId = 'foreign-own') {
  const canvas = studio(); canvas.siteId = 'site:1.00000,1.00000'; canvas.items[0].id = bedId;
  return (await ownRow(canvas, 'studio-canvas', canvas.siteId, plantingId)).row;
}

test('an intact explicitly foreign and disjoint own record does not erase an otherwise supported legacy forecast', async () => {
  const foreign = await foreignRow(); saveBook([legacy, foreign]); const bytes = local.getItem(bookKey());
  const source = loadFinancePlanSource(); assert.equal(source.forecastAvailable, true);
  assert.deepEqual(source.forecastPlantings, [legacy]); assert.deepEqual(source.plantings, [legacy]);
  assert.equal(source.withheldPlantingCount, 0); assert.equal(local.getItem(bookKey()), bytes);
  const rendered = graph(source);
  try { rendered.plan(); assert.match(rendered.text(), /Each crop’s plan benchmark/); assert.doesNotMatch(rendered.text(), /Plan comparison unavailable/); }
  finally { rendered.close(); }
});

test('malformed scope, broken identity and ambiguous whole-book IDs cannot masquerade as foreign exclusions', async () => {
  const foreign = await foreignRow();
  for (const kind of ['missing-scope', 'changed-id', 'duplicate-id', 'null-marker']) {
    const row = JSON.parse(JSON.stringify(foreign));
    if (kind === 'missing-scope') delete row.growerCycle.assessmentSnapshot.scope;
    if (kind === 'changed-id') row.id = 'unbound-claim';
    if (kind === 'duplicate-id') { row.id = legacy.id; row.growerCycle.plantingId = legacy.id; }
    if (kind === 'null-marker') row.growerCycle = null;
    saveBook([legacy, row]); const source = loadFinancePlanSource();
    assert.equal(source.forecastAvailable, false, kind); assert.deepEqual(source.forecastPlantings, [], kind);
  }
  saveBook([legacy, await foreignRow('bed-a')]); assert.equal(loadFinancePlanSource().forecastAvailable, false, 'A foreign claim sharing current land is not disjoint');
});

test('held current polygons still prevent same-bed foreign exclusion even when they have no finance area row', async () => {
  const raw = { ...studio(), zones: [{ id: 'held-field', zone: 1, feature: 'staple_garden', points: [[0.1, 0.1], [0.1, 0.1], [0.1, 0.1]] }] };
  const inspection = inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId, raw, sourceRevision: 'synthetic-held-field' });
  assert.equal(inspection.status, 'inspected');
  if (inspection.status !== 'inspected') assert.fail('The fixture must exercise a held bed within an otherwise inspected current source');
  assert.ok(inspection.heldBeds.some(bed => bed.bedId === 'held-field'));
  const foreign = await foreignRow('held-field'); saveBook([legacy, foreign]);
  local.setItem(studioKey(), JSON.stringify(raw));
  const held = loadFinancePlanSource(); assert.ok(!held.beds.some(bed => bed.id === 'held-field'));
  assert.equal(held.forecastAvailable, false);
  local.setItem(studioKey(), JSON.stringify(studio()));
  assert.equal(loadFinancePlanSource().forecastAvailable, true, 'Removing the held current identity restores actual disjointness');
});

test('an ambiguous authored source cannot lend its normalized display a foreign/disjoint proof', async () => {
  saveBook([legacy, await foreignRow()]);
  const raw = studio(); raw.items.push({ ...raw.items[0] }); local.setItem(studioKey(), JSON.stringify(raw));
  const source = loadFinancePlanSource(); assert.equal(source.origin, 'studio'); assert.ok(source.beds.length > 0);
  assert.equal(source.forecastAvailable, false); assert.deepEqual(source.forecastPlantings, []);
});

test('missing, unreadable and null-row raw books cannot become a certified empty forecast through display fallback',async()=>{
  const initializedEnvelope = local.getItem(bookKey()); assert.ok(initializedEnvelope);
  for (const bytes of [null, '', '{bad-json', JSON.stringify({ version: 9, plantings: [], updatedAt: 7 }),
    JSON.stringify({ version: 1, plantings: [null, orphan], updatedAt: 7 })]) {
    // Each corruption starts from the same real initialized envelope, not the
    // previous iteration's removed destination. The frozen receipt stays intact.
    local.setItem(bookKey(), initializedEnvelope);
    if (bytes === null) local.removeItem(bookKey()); else replaceCanonicalCropPlanFixtureRaw(bytes);
    const source = loadFinancePlanSource(); assert.equal(source.forecastAvailable, false); assert.deepEqual(source.forecastPlantings, []);
    assert.match(source.forecastReason!, /missing or cannot be fully read/);
    const rendered = graph(source);
    try { rendered.plan(); assert.match(rendered.text(), /Plan comparison unavailable/); assert.doesNotMatch(rendered.text(), /Your crop plan is empty/); }
    finally { rendered.close(); }
  }
});

test('the forecast hold preserves actual logs, measured area allocations and every byte of the authored book',async()=>{
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings: [legacy, orphan], updatedAt: 7, unknownEvidence: { keep: true } }));
  const bytes = local.getItem(bookKey()), writes = local.writes, observations = structuredClone({ production, sales });
  const source = loadFinancePlanSource();
  const recorded = buildFinanceSeries(production, sales, [], [], now, 12);
  assert.equal(recorded.totalProducedKg, 5); assert.equal(recorded.totalSoldKg, 2); assert.equal(recorded.totalInZar, 10);
  const measured = buildFarmMetrics(source.plantings, source.beds, production, sales, [], 'year', now);
  assert.equal(measured.crops.find(row => row.cropKey === cropDef.key)?.yieldKgPerM2, 5 / 8);
  assert.equal(source.areaM2, 8); assert.deepEqual(source.plantings, [legacy]);
  assert.deepEqual({ production, sales }, observations); assert.equal(local.getItem(bookKey()), bytes); assert.equal(local.writes, writes);
});

test('supported legacy and genuinely empty canonical books retain their existing forecast behavior',async()=>{
  saveBook([legacy]); let source = loadFinancePlanSource(); assert.equal(source.forecastAvailable, true); assert.deepEqual(source.forecastPlantings, [legacy]);
  saveBook([]); source = loadFinancePlanSource(); assert.equal(source.forecastAvailable, true);
  const rendered = graph(source);
  try { rendered.plan(); assert.match(rendered.text(), /Your crop plan is empty/); }
  finally { rendered.close(); }
});
