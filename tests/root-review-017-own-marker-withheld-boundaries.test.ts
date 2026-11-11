// Root-owned additive checks, SOURCE REVIEWED / NOT EXECUTED in this lane.
// Real actor-bound plan/source loader, catalogue board, own projector and shipped
// GrowerOperationsPanel. Uses existing synthetic storage/auth fixture; no real
// cloud writes or new farming values are introduced.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import { account, core, crop, local, ownRow, reset, cleanup, studio, studioKey } from './international-grower-operations-fixture.ts';
const board = await import('../lib/task-board.ts');
const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith('/components/crops/GrowerOperationsPanel.tsx')) return { format: 'module', shortCircuit: true,
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
  return next(url, context);
} });
const { default: Panel } = await import('../components/crops/GrowerOperationsPanel.tsx');
beforeEach(reset); after(() => { hooks.deregister(); cleanup(); });
const place = { id: 'root-unknown-country', name: 'Synthetic place', lat: 0, lon: 0, biome: 'synthetic', rainfall: 0, elevation: 0, savedAt: '' };
const legacy = { id: 'root-catalogue', bedId: 'bed-a', cropKey: 'spinach', sowMonth: 3 };
const now = new Date('2028-12-05T00:00:00Z');
function storeWorld(plantings: unknown[]) {
  local.setItem(account.activeAccountLocalStorageKey('permamap_saved_places'), JSON.stringify([place]));
  local.setItem(studioKey(), JSON.stringify(studio()));
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, updatedAt: 1, plantings }));
}
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
async function mountRealHeldPanel(state: Extract<Awaited<ReturnType<typeof core.loadGrowerOperationsSources>>, { status: 'ready' }>) {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(Panel, { state, now, refresh: async () => {},
    checkCurrent: () => core.checkGrowerOperationsCurrent(state), isCurrent: () => core.isGrowerOperationsCurrent(state) })); });
  return { renderer, text: () => text(renderer.root), close: async () => { await act(async () => renderer.unmount()); } };
}

test('ROOT-C null, future and malformed own markers never become catalogue counts and keep their actual held warning', async () => {
  const markers: unknown[] = [null, { kind: 'grower-dated-cycle', version: 99 }, 'malformed-own-marker'];
  for (const marker of markers) {
    storeWorld([{ ...legacy, id: 'root-held-own', growerCycle: marker }]);
    const receipt = crop.readRawCropPlanReceipt(); assert.equal(receipt.status, 'ready');
    const sources = await core.loadGrowerOperationsSources(); assert.equal(sources.status, 'ready');
    if (sources.status !== 'ready') continue;
    assert.ok(sources.heldSources.some(item => item.reason === 'own-row-needs-review'));
    const own = board.buildGrowerBoardTasks(sources.book.plantings, sources.contexts, now, new Set());
    assert.equal(own.tasks.length, 0); assert.equal(own.heldPlantings, 1);
    const year = board.loadCropBoardYear(new Set(), now);
    assert.equal(year.withheldPlantings, 0, 'a marker means own evidence even when invalid; it must not borrow catalogue semantics');
    assert.equal(year.savedPlantings, 1); assert.equal(year.total, 0);
    const app = await mountRealHeldPanel(sources);
    try { assert.match(app.text(), /Some saved cycles or design measurements need review/); assert.match(app.text(), /work remains withheld; the saved records are retained/); }
    finally { await app.close(); }
    const afterRead = crop.readRawCropPlanReceipt(); assert.equal(afterRead.status, 'ready');
    if (receipt.status === 'ready' && afterRead.status === 'ready') assert.equal(afterRead.token, receipt.token, 'display counts must not rewrite the canonical book');
  }
});

test('ROOT-C mixed valid own, malformed own and catalogue rows retain dated tasks, own held warning and only the catalogue count', async () => {
  const own = await ownRow();
  storeWorld([own.row, { ...legacy, id: 'root-held-own', growerCycle: null }, legacy]);
  const sources = await core.loadGrowerOperationsSources(); assert.equal(sources.status, 'ready');
  if (sources.status !== 'ready') return;
  const tasks = board.buildGrowerBoardTasks(sources.book.plantings, sources.contexts, now, new Set());
  assert.ok(tasks.tasks.length > 0); assert.equal(tasks.heldPlantings, 1);
  const year = board.loadCropBoardYear(new Set(), now);
  assert.equal(year.withheldPlantings, 1); assert.equal(year.savedPlantings, 3); assert.equal(year.total, 0);
  const app = await mountRealHeldPanel(sources);
  try { assert.match(app.text(), /work remains withheld; the saved records are retained/); assert.match(app.text(), /2028-12/); }
  finally { await app.close(); }
});
