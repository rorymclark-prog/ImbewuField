import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CountrySource } from '../lib/international/countries/types.ts';
import type { GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import type { ProvisionalFieldCandidate } from '../lib/international/provisional-crop-planning.ts';
import type { ProvisionalCropPreviewProps } from '../components/crops/ProvisionalCropPreview.tsx';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith('/components/crops/ProvisionalCropPreview.tsx')) return { shortCircuit: true, format: 'module',
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText };
  return next(url, context);
} });
const { default: Panel } = await import('../components/crops/ProvisionalCropPreview.tsx');
after(() => hooks.deregister());

// Synthetic engineering fixtures only; no agronomic numbers or source dates here are runtime defaults.
const scope = { kind: 'mapped-site' as const, siteId: 'site:0.00000,0.00000' };
const source: GrowerWorkflowSource = { status: 'ready', kind: 'studio-canvas', sourceId: scope.siteId,
  sourceKey: `studio-canvas:${scope.siteId}`, resourceSiteId: scope.siteId, scope,
  geometryFingerprint: 'a'.repeat(64), sourceRevision: 'b'.repeat(64), freshness: 'device-saved-copy', sourceVerification: 'not-verified',
  beds: [{ id: 'bed-1', label: 'Synthetic measured bed', areaM2: 10.5 }],
  measuredAreas: [{ bedId: 'bed-1', areaM2: 10.5, basis: 'explicit-saved-dimensions' }], heldBeds: [] };
const citation: CountrySource = {
  id: 'synthetic-source', category: 'agricultural-extension', authority: 'Engineering fixture',
  title: 'Synthetic test table', url: 'https://example.invalid/test-table', coverage: 'Synthetic scope only',
  resolution: { status: 'unknown', reason: 'fixture' }, units: { status: 'unknown', reason: 'fixture' },
  updateCadence: { status: 'unknown', reason: 'fixture' }, licence: { status: 'known', value: 'Synthetic test permission' },
  attribution: 'Fixture', accessRequirements: { status: 'unknown', reason: 'fixture' }, missingDataBehavior: 'Unknown',
  verification: 'content-read', accessedOn: '2026-11-10', publishedOn: '2026-01-01', reviewDueOn: null,
  verifiedClaim: 'No real-world claim', limitations: 'Engineering fixture only',
};
const units = { establishment: 'method', plantsPerM2: 'plants/m2', yieldKgPerM2: 'kg/m2/cycle', nurseryDays: 'days',
  fieldEntryToFirstHarvestDays: 'days', pickingDays: 'days', fieldOccupancyDays: 'days', turnaroundDays: 'days', allowedEntryMonths: 'utc-months' };
function candidate(field: ProvisionalFieldCandidate['field'], value: unknown, changes: Partial<ProvisionalFieldCandidate> = {}): ProvisionalFieldCandidate {
  return { id: `fixture-${field}`, field, cropKey: CROPS[0].key, tier: 'local-public-evidence',
    input: { state: 'provided', value, unit: units[field], provenance: { kind: 'external-reference',
      recordedAt: '2026-11-10T12:00:00.000Z', reference: 'Synthetic row', sourceUrl: citation.url } },
    geography: { kind: 'country', countryCode: 'KE' }, establishment: 'any', waterRegime: 'any',
    temporalScope: { kind: 'recurring-season' }, source: citation, reuseReview: 'reviewed',
    positiveWindowEvidence: true, assumptions: ['Synthetic assumption retained'], ...changes };
}
const candidates = [candidate('establishment', 'direct'), candidate('plantsPerM2', 2.5),
  candidate('fieldEntryToFirstHarvestDays', 3), candidate('pickingDays', 2), candidate('fieldOccupancyDays', 8), candidate('turnaroundDays', 1)];
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
function mount(changes: Partial<ProvisionalCropPreviewProps> = {}) {
  let renderer!: ReactTestRenderer;
  const writes: unknown[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), {
    localStorage: { getItem: () => null, setItem: (...args: unknown[]) => writes.push(args), removeItem: (...args: unknown[]) => writes.push(args) },
  }) });
  const props: ProvisionalCropPreviewProps = { ownerKey: 'synthetic-owner', scope, source: structuredClone(source),
    countryCode: 'KE', agriculturalRegionReference: null, contextRevision: 1, actorIsCurrent: () => true,
    checking: false, onRefresh: async () => {}, onCheckSource: async () => ({ isCurrent: () => true }), evidence: { revision: 'fixture-v1', candidates: structuredClone(candidates) }, ...changes };
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const field = (name: string) => {
    const label = renderer.root.findAllByType('label').find(row => row.children.includes(name));
    assert.ok(label, `Missing ${name}`); return label.findAll(row => row.type === 'input' || row.type === 'select')[0];
  };
  const action = (name: string) => { const button = renderer.root.findAllByType('button').find(row => text(row) === name); assert.ok(button); return button.props.onClick; };
  return { props, writes, field, action, text: () => text(renderer.root),
    change(name: string, value: string) { act(() => field(name).props.onChange({ target: { value } })); },
    async click(name = 'Calculate provisional preview') { await act(async () => { await action(name)(); }); },
    update(changes: Partial<ProvisionalCropPreviewProps>) { Object.assign(props, changes); act(() => renderer.update(React.createElement(Panel, props))); },
    choose() { this.change('Preview crop', CROPS[0].key); this.change('Preview measured bed', 'bed-1'); this.change('Preview field-entry date (UTC)', '2028-02-28'); },
    dispose() { act(() => renderer.unmount()); },
  };
}

test('mounted preview retains source evidence and independent counts/dates with unknown yield and entry window, without saving', async () => {
  const ui = mount(); try {
    const before = JSON.stringify(ui.props); ui.choose(); await ui.click();
    assert.match(ui.text(), /Estimated plants: 26 \(ready\)/);
    assert.match(ui.text(), /Estimated harvest weight: Unknown \(missing-inputs\)/);
    assert.match(ui.text(), /First harvest \(UTC\): 2028-03-02 \(ready\)/);
    assert.match(ui.text(), /Entry window: unknown/);
    assert.match(ui.text(), /Synthetic test table/); assert.match(ui.text(), /external-reference/);
    assert.match(ui.text(), /Synthetic assumption retained/); assert.match(ui.text(), /Nothing has been saved/);
    assert.equal(JSON.stringify(ui.props), before); assert.deepEqual(ui.writes, []);
  } finally { ui.dispose(); }
});

test('conflicting density stays unknown, explicit override retains both defaults, invalid edit never restores one', async () => {
  const ui = mount({ evidence: { revision: 'conflict', candidates: [...candidates,
    candidate('plantsPerM2', 3, { id: 'other-density', reportedRange: [2, 4], planningValueBasis: 'reported-point' })] } });
  try {
    ui.choose(); await ui.click(); assert.match(ui.text(), /Estimated plants: Unknown/); assert.match(ui.text(), /Conflicting defaults remain unresolved/);
    ui.change('Plant density (plants per m²)', '4'); assert.doesNotMatch(ui.text(), /Estimated plants:/); await ui.click();
    assert.match(ui.text(), /Estimated plants: 42/); assert.match(ui.text(), /other-density/); assert.match(ui.text(), /reported range 2–4/);
    assert.match(ui.text(), /grower-estimate/); assert.match(ui.text(), /Synthetic test table/);
    ui.change('Plant density (plants per m²)', '-1'); await ui.click(); assert.match(ui.text(), /invalid-override/); assert.match(ui.text(), /Estimated plants: Unknown/);
    ui.change('Plant density (plants per m²)', ''); await ui.click(); assert.match(ui.text(), /Estimated plants: Unknown/);
    await ui.click('Reset Plant density (plants per m²)'); await ui.click(); assert.match(ui.text(), /Conflicting defaults remain unresolved/);
    assert.deepEqual(ui.writes, []);
  } finally { ui.dispose(); }
});

test('grower-only partial preview has no hidden catalogue defaults and preserves genuine zero yield', async () => {
  const ui = mount({ evidence: undefined }); try {
    ui.choose(); ui.change('Plant density (plants per m²)', '2'); ui.change('Harvest weight (kg per m² per cycle)', '0'); await ui.click();
    assert.match(ui.text(), /No reviewed source defaults/); assert.match(ui.text(), /Estimated plants: 21/);
    assert.match(ui.text(), /Estimated harvest weight: 0 kg \(ready\)/); assert.match(ui.text(), /First harvest \(UTC\): Unknown/);
    assert.deepEqual(ui.writes, []);
  } finally { ui.dispose(); }
});

test('context, source revision, evidence bytes and crop changes hide old results and refuse callbacks from older renders', async () => {
  for (const change of [
    (p: ProvisionalCropPreviewProps) => ({ source: { ...p.source!, sourceRevision: 'c'.repeat(64) } }),
    () => ({ countryCode: 'GB' }), () => ({ agriculturalRegionReference: 'new-region' }),
    () => ({ contextRevision: 2 }), () => ({ checking: true }),
    (p: ProvisionalCropPreviewProps) => ({ evidence: { ...p.evidence!, candidates: p.evidence!.candidates.filter(c => c.field !== 'plantsPerM2') } }),
  ]) {
    const ui = mount(); try { ui.choose(); await ui.click(); const stale = ui.action('Calculate provisional preview');
      ui.update(change(ui.props)); assert.doesNotMatch(ui.text(), /Estimated plants:/);
      await act(async () => { await stale(); }); assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.deepEqual(ui.writes, []);
    } finally { ui.dispose(); }
  }
  const ui = mount(); try { ui.choose(); await ui.click(); const stale = ui.action('Calculate provisional preview');
    ui.change('Preview crop', CROPS[1].key); await act(async () => { await stale(); }); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    await ui.click(); assert.match(ui.text(), /Estimated plants: Unknown/);
  } finally { ui.dispose(); }
});

test('actor revocation and site switches discard private previews and old editor callbacks', async () => {
  const ui = mount(); try { ui.choose(); await ui.click(); const stale = ui.action('Calculate provisional preview');
    ui.update({ actorIsCurrent: () => false }); assert.doesNotMatch(ui.text(), /Synthetic test table/);
    await act(async () => { await stale(); }); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    ui.update({ actorIsCurrent: () => true, ownerKey: 'another-owner' });
    assert.equal(ui.field('Preview crop').props.value, ''); await act(async () => { await stale(); }); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    ui.choose(); await ui.click(); const priorSite = ui.action('Calculate provisional preview');
    ui.update({ scope: { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } });
    await act(async () => { await priorSite(); }); assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.deepEqual(ui.writes, []);
  } finally { ui.dispose(); }
});

test('water mismatch withholds scoped source values and known restriction withholds the complete preview', async () => {
  const ui = mount({ evidence: { revision: 'irrigated-only', candidates: candidates.map(c => ({ ...c, waterRegime: 'irrigated' })) } });
  try { ui.choose(); ui.change('Water regime', 'rain-fed'); await ui.click(); assert.match(ui.text(), /scope-mismatch/); assert.match(ui.text(), /Estimated plants: Unknown/);
    ui.change('Water regime', 'irrigated'); await ui.click(); assert.match(ui.text(), /Estimated plants: 26/);
    ui.update({ evidence: { ...ui.props.evidence!, knownPlantingRestriction: true } }); await ui.click();
    assert.match(ui.text(), /known planting restriction/); assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.deepEqual(ui.writes, []);
  } finally { ui.dispose(); }
});

test('a pending measurement recheck cannot publish results for changed edits or evidence', async () => {
  for (const drift of ['edit', 'evidence', 'revoked'] as const) {
    let finish!: (value: { isCurrent: () => boolean }) => void;
    const ui = mount({ onCheckSource: () => new Promise(resolve => { finish = resolve; }) });
    try {
      ui.choose(); let work!: Promise<void>;
      await act(async () => { work = ui.action('Calculate provisional preview')(); });
      assert.match(ui.text(), /Checking current saved measurements/);
      if (drift === 'edit') ui.change('Plant density (plants per m²)', '9');
      if (drift === 'evidence') ui.update({ evidence: { revision: 'changed', candidates: [] } });
      await act(async () => { finish({ isCurrent: () => drift !== 'revoked' }); await work; });
      assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.deepEqual(ui.writes, []);
    } finally { ui.dispose(); }
  }
});
