import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ts from 'typescript';
import * as energy from '../lib/site-energy.ts';
import { pvgisFixture } from './fixtures/site-energy.ts';

const siteId = 'site:45.00000,8.00000';
const otherSite = 'site:46.00000,8.00000';

function harness() {
  const require = createRequire(import.meta.url);
  let actor: { uid: string; getIdToken(): Promise<string> } | null = { uid: 'actor-a', getIdToken: async () => 'fixture-token' };
  let scopeActive = true;
  const dependencies: Record<string, unknown> = {
    '@/lib/firebase/init': { getFirebase: () => ({ auth: { currentUser: actor } }) },
    '@/lib/api-client-auth': { paidApiHeaders: async () => ({ Authorization: 'Bearer fixture-token' }) },
    '@/lib/site-survey': { surveyDraftScopeIsActive: () => scopeActive },
    '@/lib/site-energy': energy,
    './SiteSurveyEnergy.module.css': new Proxy({}, { get: (_, key) => String(key) }),
  };
  const source = readFileSync(new URL('../components/SiteSurveyEnergy.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', js)((id: string) => dependencies[id] ?? require(id), module, module.exports);
  return { Component: module.exports.default, switchActor: () => { actor = { uid: 'actor-b', getIdToken: async () => 'other-token' }; }, invalidate: () => { scopeActive = false; } };
}
const response = (actorId = 'actor-a', id = siteId) => Response.json({ actorId, siteId: id, solar: energy.parsePvgisResponse(pvgisFixture(), siteId, '2026-11-05T12:00:00.000Z') });
const fetchButton = (view: TestRenderer.ReactTestRenderer) => view.root.findAllByType('button').find(b => String(b.props.children).includes('Fetch solar') || String(b.props.children).includes('Refresh solar'))!;

test('opening energy does not transmit coordinates; explicit lookup names provider and merges with newer observations', async () => {
  const h = harness(); const priorFetch = globalThis.fetch;
  let count = 0, complete!: (response: Response) => void;
  globalThis.fetch = async (_input, init) => { count++; assert.equal(JSON.parse(String(init?.body)).siteId, siteId); return new Promise(resolve => { complete = resolve; }); };
  let result: energy.SiteEnergyEvidence | undefined, view!: TestRenderer.ReactTestRenderer;
  const props = { siteId, coords: { lat: 45, lon: 8 }, scope: 'fixture-account-a', value: {} as energy.SiteEnergyEvidence, onChange: (v: energy.SiteEnergyEvidence) => { result = v; } };
  try {
    await act(async () => { view = TestRenderer.create(React.createElement(h.Component, props)); });
    assert.equal(count, 0);
    const text = JSON.stringify(view.toJSON()); assert.match(text, /coordinates/); assert.match(text, /European Commission JRC PVGIS/); assert.match(text, /1 kWp/);
    let pending!: Promise<void>;
    await act(async () => { pending = fetchButton(view).props.onClick(); });
    assert.equal(count, 1); assert.equal(view.root.findAllByType('button')[0].props.disabled, true);
    await act(async () => { view.update(React.createElement(h.Component, { ...props, value: { solarShadeNotes: 'New tree observation' } })); complete(response()); await pending; });
    assert.equal(result?.solar?.annualKwh, 1200); assert.equal(result?.solarShadeNotes, 'New tree observation');
    assert.match(JSON.stringify(view.toJSON()), /Save the survey/);
  } finally { await act(async () => view?.unmount()); globalThis.fetch = priorFetch; }
});

for (const transition of ['actor', 'site', 'scope', 'response-actor', 'unmount'] as const) {
  test(`late solar result is discarded after ${transition} changes`, async () => {
    const h = harness(); const priorFetch = globalThis.fetch;
    let complete!: (response: Response) => void;
    globalThis.fetch = async () => new Promise(resolve => { complete = resolve; });
    let writes = 0, view!: TestRenderer.ReactTestRenderer;
    const props = { siteId, coords: { lat: 45, lon: 8 }, scope: 'fixture-account-a', value: {}, onChange: () => { writes++; } };
    try {
      await act(async () => { view = TestRenderer.create(React.createElement(h.Component, props)); });
      let pending!: Promise<void>;
      await act(async () => { pending = fetchButton(view).props.onClick(); });
      await act(async () => {
        if (transition === 'actor') h.switchActor();
        if (transition === 'scope') h.invalidate();
        if (transition === 'site') view.update(React.createElement(h.Component, { ...props, siteId: otherSite, coords: { lat: 46, lon: 8 } }));
        if (transition === 'unmount') view.unmount();
        complete(response(transition === 'response-actor' ? 'actor-b' : 'actor-a')); await pending;
      });
      assert.equal(writes, 0);
    } finally { await act(async () => view?.unmount()); globalThis.fetch = priorFetch; }
  });
}

test('provider failure keeps the existing reference and exposes a retryable error', async () => {
  const h = harness(); const priorFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: 'PVGIS has no supported result for this location.' }, { status: 422 });
  let writes = 0, view!: TestRenderer.ReactTestRenderer;
  try {
    await act(async () => { view = TestRenderer.create(React.createElement(h.Component, { siteId, coords: { lat: 45, lon: 8 }, scope: 'fixture-account-a', value: { solar: energy.parsePvgisResponse(pvgisFixture(), siteId, '2026-11-05T12:00:00.000Z') }, onChange: () => { writes++; } })); });
    await act(async () => { await fetchButton(view).props.onClick(); });
    assert.equal(writes, 0); assert.match(view.root.findByProps({ role: 'alert' }).props.children, /no supported result/);
    assert.equal(fetchButton(view).props.disabled, false);
  } finally { await act(async () => view?.unmount()); globalThis.fetch = priorFetch; }
});
