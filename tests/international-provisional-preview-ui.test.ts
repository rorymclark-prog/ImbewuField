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
    let reads = 0;
    const ui = mount({ onCheckSource: async () => { reads++; return { isCurrent: () => true }; } }); try { ui.choose(); await ui.click(); const stale = ui.action('Calculate provisional preview');
      const readsBefore = reads; ui.update(change(ui.props)); assert.doesNotMatch(ui.text(), /Estimated plants:/);
      await act(async () => { await stale(); }); assert.equal(reads, readsBefore, 'stale callback must not even read the source'); assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.deepEqual(ui.writes, []);
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

const { buildProvisionalCropPreviewHtml } = await import('../lib/international/provisional-crop-export.ts');
function exportRequest() {
  return { profileId: 'preview', cropKey: CROPS[0].key,
    context: { scope, countryCode: 'KE', agriculturalRegionReference: null, establishment: null, waterRegime: null },
    recordedAt: '2026-11-12T12:00:00.000Z', asOf: '2026-11-12', candidates,
    measuredAreaM2: { state: 'provided', value: 10.5, unit: 'm2', provenance: { kind: 'grower-record', recordedAt: '2026-11-12T12:00:00.000Z', reference: 'Measured bed' } },
    fieldEntryDate: { state: 'provided', value: '2028-02-28', unit: 'utc-date', provenance: { kind: 'grower-estimate', recordedAt: '2026-11-12T12:00:00.000Z' } } };
}

test('printable original preserves independent results and provenance without executable source text or private fingerprints', () => {
  const request = exportRequest();
  request.candidates = candidates.map(c => ({ ...c, source: { ...citation, title: '<script>bad()</script>', url: citation.url } }));
  const before = JSON.stringify(request);
  const file = buildProvisionalCropPreviewHtml(request, { bedLabel: '<img src=x onerror=bad()>', sourceRevision: 'revision-1', sample: true });
  assert.ok(file); assert.match(file.html, /DEMO: sample inputs/); assert.match(file.html, /26 \(ready\)/);
  assert.match(file.html, /Unknown \(missing-inputs\)/); assert.match(file.html, /2028-03-02/);
  assert.match(file.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/); assert.match(file.html, /&lt;img/);
  assert.doesNotMatch(file.html, /<script|<img|href="javascript|site:0\.00000|synthetic-owner/);
  assert.match(file.html, /Synthetic test permission/); assert.match(file.html, /Synthetic assumption retained/);
  assert.match(file.html, /2026-01-01/); assert.match(file.html, /default-src 'none'/);
  assert.equal(JSON.stringify(request), before);
  assert.equal(buildProvisionalCropPreviewHtml({ ...request, knownPlantingRestriction: true }, { bedLabel: 'bed', sourceRevision: 'r', sample: false }), null);
});

test('printable overrides keep conflicting defaults and invalid edits do not restore a count', () => {
  const request = { ...exportRequest(), candidates: [...candidates, candidate('plantsPerM2', 3, { id: 'conflict', reportedRange: [2, 4], planningValueBasis: 'reported-point' })],
    overrides: { plantsPerM2: { state: 'provided', value: 4, unit: 'plants/m2', provenance: { kind: 'grower-estimate', recordedAt: '2026-11-12T12:00:00.000Z' } } } };
  const options = { bedLabel: 'bed', sourceRevision: 'r', sample: false };
  const file = buildProvisionalCropPreviewHtml(request, options); assert.ok(file);
  assert.match(file.html, /42 \(ready\)/); assert.match(file.html, /Conflicting defaults remain unresolved/);
  assert.match(file.html, /reported range 2–4/); assert.match(file.html, /grower-estimate/);
  request.overrides.plantsPerM2.value = -1;
  const invalid = buildProvisionalCropPreviewHtml(request, options); assert.ok(invalid);
  assert.match(invalid.html, /invalid-override/); assert.doesNotMatch(invalid.html, /42 \(ready\)|26 \(ready\)/);
});

function downloads(onAppend: () => void = () => {}) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const blobs: Blob[] = [], names: string[] = [], revoked: string[] = [];
  URL.createObjectURL = blob => { assert.ok(blob instanceof Blob); blobs.push(blob); return 'blob:synthetic-preview'; };
  URL.revokeObjectURL = url => { revoked.push(url); };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ download: '', click() { names.push(this.download); }, remove() {} }),
    body: { appendChild() { onAppend(); } },
  } });
  return { blobs, names, revoked, dispose() {
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else Reflect.deleteProperty(globalThis, 'document');
  } };
}

test('explicit printable download uses fresh source checks and leaves profiles untouched', async () => {
  let reads = 0;
  const ui = mount({ sample: true, onCheckSource: async () => { reads++; return { isCurrent: () => true }; } });
  const files = downloads();
  try { ui.choose(); await ui.click(); await ui.click('Download printable preview');
    assert.ok(reads >= 4, 'calculation and both sides of prepared file delivery require source checks');
    assert.deepEqual(files.names, ['ImbewuField-demo-provisional-preview.html']);
    assert.match(await files.blobs[0].text(), /DEMO/); assert.match(await files.blobs[0].text(), /26 \(ready\)/);
    assert.deepEqual(ui.writes, []); assert.match(ui.text(), /download requested/);
  } finally { files.dispose(); ui.dispose(); }
});

test('account withdrawal while preparing the file cancels delivery and releases the object URL', async () => {
  let current = true;
  const ui = mount({ actorIsCurrent: () => current }); const files = downloads(() => { current = false; });
  try { ui.choose(); await ui.click(); await ui.click('Download printable preview');
    assert.deepEqual(files.names, []); assert.deepEqual(files.revoked, ['blob:synthetic-preview']); assert.deepEqual(ui.writes, []);
  } finally { files.dispose(); ui.dispose(); }
});

test('an old download callback cannot export after edits or an asynchronous evidence change', async () => {
  const ui = mount(); const files = downloads();
  try { ui.choose(); await ui.click(); const old = ui.action('Download printable preview');
    ui.change('Plant density (plants per m²)', '4'); await act(async () => { await old(); }); assert.deepEqual(files.names, []);
    await ui.click(); let resolve!: (value: { isCurrent: () => boolean }) => void;
    ui.update({ onCheckSource: () => new Promise(done => { resolve = done; }) });
    let work!: Promise<void>; await act(async () => { work = ui.action('Download printable preview')(); });
    ui.update({ evidence: { revision: 'changed', candidates: [] } });
    await act(async () => { resolve({ isCurrent: () => true }); await work; });
    assert.deepEqual(files.names, []); assert.deepEqual(ui.writes, []);
  } finally { files.dispose(); ui.dispose(); }
});

for (const operation of ['edit', 'reset', 'refresh', 'calculate'] as const) test(`UTC midnight does not disable ${operation} on an already-open preview`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-12T23:59:59Z') });
  let reads = 0, refreshes = 0;
  const ui = mount({ onCheckSource: async () => { reads++; return { isCurrent: () => true }; }, onRefresh: async () => { refreshes++; } });
  try {
    ui.choose(); ui.change('Plant density (plants per m²)', '4'); await ui.click();
    assert.match(ui.text(), /Estimated plants: 42/);
    t.mock.timers.setTime(Date.parse('2026-11-13T00:00:01Z'));
    if (operation === 'edit') { ui.change('Plant density (plants per m²)', '5'); assert.equal(ui.field('Plant density (plants per m²)').props.value, '5'); }
    if (operation === 'reset') { await ui.click('Reset Plant density (plants per m²)'); assert.equal(ui.field('Plant density (plants per m²)').props.value, ''); }
    if (operation === 'refresh') { await ui.click('Check saved measurements'); assert.equal(refreshes, 1); }
    if (operation === 'calculate') { await ui.click(); assert.equal(reads, 2); assert.match(ui.text(), /2026-11-13/); }
    else assert.doesNotMatch(ui.text(), /Estimated plants:/);
  } finally { ui.dispose(); t.mock.timers.reset(); }
});

test('a published receipt revoked without a prop change hides on render and cannot download', async () => {
  let current = true;
  const ui = mount({ onCheckSource: async () => ({ isCurrent: () => current }) }); const capture = downloads();
  try { ui.choose(); await ui.click(); const download = ui.action('Download printable preview'); current = false;
    await act(async () => { await download(); }); assert.deepEqual(capture.names, []);
    ui.update({}); assert.doesNotMatch(ui.text(), /Estimated plants:/);
  } finally { capture.dispose(); ui.dispose(); }
});

test('a calculation spanning midnight is discarded and can be retried on the new day', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-12T23:59:59Z') });
  let finish!: (value: { isCurrent: () => boolean }) => void;
  const ui = mount({ onCheckSource: () => new Promise(resolve => { finish = resolve; }) });
  try { ui.choose(); let work!: Promise<void>; await act(async () => { work = ui.action('Calculate provisional preview')(); });
    t.mock.timers.setTime(Date.parse('2026-11-13T00:00:01Z'));
    await act(async () => { finish({ isCurrent: () => true }); await work; });
    assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.match(ui.text(), /UTC date changed/);
    ui.update({ onCheckSource: async () => ({ isCurrent: () => true }) }); await ui.click(); assert.match(ui.text(), /Estimated plants: 26/);
  } finally { ui.dispose(); t.mock.timers.reset(); }
});

test('printable export never embeds a serialized private source revision', () => {
  const revision = JSON.stringify({ ownerUid: 'PRIVATE-OWNER-SENTINEL', siteId: 'PRIVATE-SITE-SENTINEL',
    source: { notes: 'PRIVATE-DESIGN-SENTINEL', account: 'PRIVATE-ACCOUNT-SENTINEL' } });
  const file = buildProvisionalCropPreviewHtml(exportRequest(), { bedLabel: 'Chosen bed', sourceRevision: revision, sample: false });
  assert.ok(file); assert.doesNotMatch(file.html, /PRIVATE-|ownerUid|siteId|Saved-source revision/);
  assert.match(file.html, /Chosen bed/); assert.match(file.html, /Synthetic test table/); assert.ok(file.fingerprint);
});

test('yesterday’s captured export callback cannot download and recalculation recovers', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-12T23:59:59Z') });
  const ui = mount(); const capture = downloads();
  try { ui.choose(); await ui.click(); const download = ui.action('Download printable preview');
    t.mock.timers.setTime(Date.parse('2026-11-13T00:00:01Z')); await act(async () => { await download(); });
    assert.deepEqual(capture.names, []); assert.match(ui.text(), /Recalculate before downloading/);
    await ui.click(); assert.match(ui.text(), /Estimated plants: 26/);
  } finally { capture.dispose(); ui.dispose(); t.mock.timers.reset(); }
});

test('a sample-mode transition during the final source check cancels a captured download', async () => {
  const ui = mount({ sample: true }); const capture = downloads();
  try { ui.choose(); await ui.click(); let finish!: (value: { isCurrent: () => boolean }) => void;
    ui.update({ onCheckSource: () => new Promise(resolve => { finish = resolve; }) });
    let work!: Promise<void>; await act(async () => { work = ui.action('Download printable preview')(); });
    ui.update({ sample: false }); await act(async () => { finish({ isCurrent: () => true }); await work; });
    assert.deepEqual(capture.names, []); assert.doesNotMatch(ui.text(), /Estimated plants:/);
  } finally { capture.dispose(); ui.dispose(); }
});
