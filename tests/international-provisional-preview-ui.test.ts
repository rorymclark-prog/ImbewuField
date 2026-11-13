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

test('the download identifies a saved-measurement read time without dating the original measurement', () => {
  const request = exportRequest();
  const before = JSON.stringify(request);
  const file = buildProvisionalCropPreviewHtml(request, { bedLabel: 'Measured bed', sample: false });
  assert.ok(file);
  assert.match(file.html, /Saved measurement read at \(UTC\):<\/strong>\s*2026-11-12T12:00:00\.000Z/);
  assert.match(file.html, /This is when the saved design was read, not when the measurement was made\./);
  assert.doesNotMatch(file.html, /Measurement provenance|grower-record; recorded 2026-11-12T12:00:00\.000Z/);
  assert.match(file.html, /Measured area:<\/strong>\s*10\.5 m²/);
  assert.match(file.html, /26 \(ready\)/);
  assert.equal(JSON.stringify(request), before);
});

test('a ready harvest weight is exported with one kilogram unit through the actual download', async () => {
  const ui = mount(); const capture = downloads();
  try {
    ui.choose(); ui.change('Harvest weight (kg per m² per cycle)', '2'); await ui.click();
    assert.match(ui.text(), /Estimated harvest weight: 21 kg \(ready\)/);
    await ui.click('Download printable preview');
    assert.equal(capture.blobs.length, 1);
    const html = await capture.blobs[0].text();
    assert.match(html, /<th scope="row">Estimated harvest weight<\/th><td>21 kg \(ready\)<\/td>/);
    assert.doesNotMatch(html, /kg kg/);
    assert.deepEqual(ui.writes, []);
  } finally { capture.dispose(); ui.dispose(); }
});

test('printable original preserves independent results and provenance without executable source text or private fingerprints', () => {
  const request = exportRequest();
  request.candidates = candidates.map(c => ({ ...c, source: { ...citation, title: '<script>bad()</script>', url: citation.url } }));
  const before = JSON.stringify(request);
  const file = buildProvisionalCropPreviewHtml(request, { bedLabel: '<img src=x onerror=bad()>', sample: true });
  assert.ok(file); assert.match(file.html, /DEMO: sample inputs/); assert.match(file.html, /26 \(ready\)/);
  assert.match(file.html, /Unknown \(missing-inputs\)/); assert.match(file.html, /2028-03-02/);
  assert.match(file.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/); assert.match(file.html, /&lt;img/);
  assert.doesNotMatch(file.html, /<script|<img|href="javascript|site:0\.00000|synthetic-owner/);
  assert.match(file.html, /Synthetic test permission/); assert.match(file.html, /Synthetic assumption retained/);
  assert.match(file.html, /2026-01-01/); assert.match(file.html, /default-src 'none'/);
  assert.equal(JSON.stringify(request), before);
  assert.equal(buildProvisionalCropPreviewHtml({ ...request, knownPlantingRestriction: true }, { bedLabel: 'bed', sample: false }), null);
});

test('printable overrides keep conflicting defaults and invalid edits do not restore a count', () => {
  const request = { ...exportRequest(), candidates: [...candidates, candidate('plantsPerM2', 3, { id: 'conflict', reportedRange: [2, 4], planningValueBasis: 'reported-point' })],
    overrides: { plantsPerM2: { state: 'provided', value: 4, unit: 'plants/m2', provenance: { kind: 'grower-estimate', recordedAt: '2026-11-12T12:00:00.000Z' } } } };
  const options = { bedLabel: 'bed', sample: false };
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
  // Older JavaScript callers can still carry extra metadata. It must never enter the document.
  const legacyMetadata = { bedLabel: 'Chosen bed', sourceRevision: revision, sample: false };
  const file = buildProvisionalCropPreviewHtml(exportRequest(), legacyMetadata);
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


test('real Kenya reference is opt-in, keeps numbers unknown, and requires new consent after a context change', async () => {
  const ui = mount({ evidence: undefined, agriculturalRegionReference: 'Central Kenya' });
  try {
    ui.change('Preview crop', 'cabbage'); ui.change('Preview measured bed', 'bed-1');
    assert.match(ui.text(), /WorldVeg cabbage method reference/);
    assert.match(ui.text(), /2024-06 \(day unknown\)/);
    const chooseReference = () => ui.field('Use this transplant-method reference for this preview');
    assert.equal(chooseReference().props.checked, false);
    await ui.click();
    assert.match(ui.text(), /Establishment method: Unknown/);
    act(() => chooseReference().props.onChange({ target: { checked: true } }));
    await ui.click();
    assert.match(ui.text(), /Establishment method: transplant/);
    assert.match(ui.text(), /Estimated plants: Unknown/);
    assert.match(ui.text(), /Estimated harvest weight: Unknown/);
    assert.match(ui.text(), /First harvest \(UTC\): Unknown/);
    assert.match(ui.text(), /Rapando N/); assert.match(ui.text(), /CC BY-SA 3.0/);
    ui.change('Plant density (plants per m²)', '2'); await ui.click();
    assert.match(ui.text(), /Estimated plants: 21/);
    assert.match(ui.text(), /grower-estimate/);
    ui.update({ contextRevision: 2 });
    assert.equal(chooseReference().props.checked, false);
    assert.doesNotMatch(ui.text(), /Estimated plants:/);
    ui.update({ agriculturalRegionReference: 'Nairobi' });
    assert.equal(chooseReference().props.disabled, true);
    await ui.click(); assert.match(ui.text(), /Establishment method: Unknown/);
    ui.update({ countryCode: 'ZA' });
    assert.doesNotMatch(ui.text(), /WorldVeg cabbage method reference/);
    assert.deepEqual(ui.writes, []);
  } finally { ui.dispose(); }
});


test('returning to the same region cannot revive old consent, results or retained callbacks', async () => {
  let checks = 0;
  const ui = mount({ evidence: undefined, agriculturalRegionReference: 'Central Kenya',
    onCheckSource: async () => { checks++; return { isCurrent: () => true }; } });
  try {
    ui.change('Preview crop', 'cabbage'); ui.change('Preview measured bed', 'bed-1');
    const consent = () => ui.field('Use this transplant-method reference for this preview');
    const oldConsent = consent().props.onChange;
    act(() => oldConsent({ target: { checked: true } })); await ui.click();
    assert.match(ui.text(), /Establishment method: transplant/);
    const oldCalculate = ui.action('Calculate provisional preview'), oldExport = ui.action('Download printable preview');
    ui.update({ agriculturalRegionReference: 'Nairobi' });
    ui.update({ agriculturalRegionReference: 'Central Kenya' });
    assert.equal(consent().props.checked, false, 'A return to equal text is a new context, not restored consent');
    assert.doesNotMatch(ui.text(), /Provisional results/);
    const before = checks;
    act(() => oldConsent({ target: { checked: true } }));
    assert.equal(consent().props.checked, false, 'Retained consent callback must be retired');
    await act(async () => { await oldCalculate(); await oldExport(); });
    assert.equal(checks, before, 'Retired callbacks must not start source checks or downloads');
    await ui.click(); assert.match(ui.text(), /Establishment method: Unknown/);
    act(() => consent().props.onChange({ target: { checked: true } })); await ui.click();
    assert.match(ui.text(), /Establishment method: transplant/);
    assert.deepEqual(ui.writes, []);
  } finally { ui.dispose(); }
});

test('a source check begun before a region round trip cannot publish in the returned context', async () => {
  let finish!: (value: { isCurrent: () => boolean }) => void;
  const ui = mount({ evidence: undefined, agriculturalRegionReference: 'Central Kenya',
    onCheckSource: () => new Promise(resolve => { finish = resolve; }) });
  try {
    ui.change('Preview crop', 'cabbage'); ui.change('Preview measured bed', 'bed-1');
    act(() => ui.field('Use this transplant-method reference for this preview').props.onChange({ target: { checked: true } }));
    let pending!: Promise<void>;
    act(() => { pending = ui.action('Calculate provisional preview')(); });
    ui.update({ agriculturalRegionReference: 'Nairobi' }); ui.update({ agriculturalRegionReference: 'Central Kenya' });
    await act(async () => { finish({ isCurrent: () => true }); await pending; });
    assert.doesNotMatch(ui.text(), /Provisional results/);
    assert.equal(ui.field('Use this transplant-method reference for this preview').props.checked, false);
    assert.deepEqual(ui.writes, []);
  } finally { ui.dispose(); }
});

test('cowpea purpose and habit select an actual source reference without inventing a stand, yield or date', async () => {
  const ui = mount({ evidence: undefined }); const capture = downloads();
  try {
    ui.change('Preview crop', 'cowpea'); ui.change('Preview measured bed', 'bed-1');
    const consent = () => ui.field('Use this direct-sowing reference for this preview');
    assert.equal(consent().props.disabled, true);
    ui.change('Cowpea harvest purpose', 'leaves'); ui.change('Cowpea growth habit', 'spreading');
    assert.match(ui.text(), /50–75 cm between rows and 50–75 cm between plants/);
    assert.equal(consent().props.checked, false);
    act(() => consent().props.onChange({ target: { checked: true } })); await ui.click();
    assert.match(ui.text(), /Establishment method: direct/);
    assert.match(ui.text(), /Estimated plants: Unknown/); assert.match(ui.text(), /Estimated harvest weight: Unknown/);
    assert.match(ui.text(), /First harvest \(UTC\): Unknown/);
    await ui.click('Download printable preview');
    assert.equal(capture.blobs.length, 1); const html = await capture.blobs[0].text();
    assert.match(html, /leaf production and spreading/); assert.match(html, /50–75 cm between rows/);
    assert.match(html, /2–3 seeds per hill/); assert.match(html, /not a final surviving plant count/);
    ui.change('Cowpea growth habit', 'erect-or-semi-erect');
    assert.equal(consent().props.checked, false); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    assert.match(ui.text(), /50 cm between rows and 15–25 cm between plants/);
    ui.change('Cowpea growth habit', 'spreading');
    assert.equal(consent().props.checked, false, 'A habit round trip must not revive consent');
    act(() => consent().props.onChange({ target: { checked: true } }));
    ui.change('Plant density (plants per m²)', '2'); await ui.click();
    assert.match(ui.text(), /Estimated plants: 21/); assert.match(ui.text(), /grower-estimate/);
    ui.change('Cowpea harvest purpose', 'pods-or-grain');
    assert.equal(consent().props.disabled, true); assert.equal(consent().props.checked, false);
    await ui.click(); assert.match(ui.text(), /Establishment method: Unknown/);
    ui.update({ countryCode: 'ZA' }); assert.doesNotMatch(ui.text(), /WorldVeg cowpea conditions/);
    assert.deepEqual(ui.writes, []);
  } finally { capture.dispose(); ui.dispose(); }
});

const stationDeclaration = 'I interpret the source’s between-plants distance as distance between stations for this estimate.';
const areaDeclaration = 'I treat the whole selected measured bed area as usable spacing-cell area, without paths or excluded space.';
function spacingChoices(ui: ReturnType<typeof mount>) {
  ui.change('Preview crop', 'cowpea'); ui.change('Preview measured bed', 'bed-1');
  ui.change('Cowpea harvest purpose', 'leaves'); ui.change('Cowpea growth habit', 'spreading');
  act(() => ui.field('Use this direct-sowing reference for this preview').props.onChange({ target: { checked: true } }));
  ui.change('Plant-count method', 'spacing');
  for (const label of ['Chosen row spacing (cm)', 'Chosen in-row spacing (cm)', 'Final surviving plants per station']) assert.equal(ui.field(label).props.value, '');
  ui.change('Chosen row spacing (cm)', '75'); ui.change('Chosen in-row spacing (cm)', '75');
}
function acknowledgeSpacing(ui: ReturnType<typeof mount>) {
  for (const label of [stationDeclaration, areaDeclaration]) act(() => ui.field(label).props.onChange({ target: { checked: true } }));
}

test('mounted spacing estimate starts blank, keeps unknown stand, preserves zero and exports the actual choices', async () => {
  const ui = mount({ evidence: undefined }); const files = downloads();
  try {
    spacingChoices(ui); await ui.click(); assert.match(ui.text(), /Estimated plants: Unknown/);
    acknowledgeSpacing(ui); await ui.click(); assert.match(ui.text(), /Budgeted whole stations: 18 \(ready\)/);
    assert.match(ui.text(), /Estimated plants: Unknown \(missing-inputs\)/);
    for (const [stand, plants] of [['0', 0], ['2', 36]] as const) {
      ui.change('Final surviving plants per station', stand); assert.equal(ui.field(areaDeclaration).props.checked, false);
      acknowledgeSpacing(ui); await ui.click(); assert.match(ui.text(), new RegExp(`Estimated plants: ${plants} \\(ready\\)`));
      await ui.click('Download printable preview');
      const file = await files.blobs.at(-1)!.text(); assert.match(file, /Conditional spacing-cell estimate/); assert.match(file, /whole budgeted stations/);
      assert.match(file, /CC BY-SA/); assert.match(file, /not a sourced density/); assert.doesNotMatch(file, /areaBasisKey|scopeKey/);
    }
    ui.change('Chosen row spacing (cm)', '75.00000000000000000001'); acknowledgeSpacing(ui); await ui.click();
    assert.match(ui.text(), /Estimated plants: Unknown/); assert.match(ui.text(), /invalid-inputs/); assert.deepEqual(ui.writes, []);
  } finally { files.dispose(); ui.dispose(); }
});

test('spacing choices and callbacks cannot revive through habit, bed, mode or country round trips or deliver stale downloads', async () => {
  const second = { ...structuredClone(source), beds: [...source.beds, { ...source.beds[0], id: 'bed-2' }],
    measuredAreas: [...source.measuredAreas, { ...source.measuredAreas[0], bedId: 'bed-2' }] };
  const ui = mount({ source: second, evidence: undefined }); const files = downloads();
  try {
    spacingChoices(ui); ui.change('Final surviving plants per station', '1'); acknowledgeSpacing(ui); await ui.click();
    const oldCalculate = ui.action('Calculate provisional preview');
    ui.change('Preview measured bed', 'bed-2'); ui.change('Preview measured bed', 'bed-1');
    assert.equal(ui.field(areaDeclaration).props.checked, false); await act(async () => { await oldCalculate(); }); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    acknowledgeSpacing(ui); await ui.click();
    let finish!: (value: { isCurrent: () => boolean }) => void;
    ui.update({ onCheckSource: () => new Promise(resolve => { finish = resolve; }) });
    let pending!: Promise<void>; await act(async () => { pending = ui.action('Download printable preview')(); });
    ui.change('Chosen row spacing (cm)', '74'); await act(async () => { finish({ isCurrent: () => true }); await pending; }); assert.deepEqual(files.names, []);
    ui.change('Cowpea growth habit', 'erect-or-semi-erect'); ui.change('Cowpea growth habit', 'spreading');
    assert.equal(ui.field('Chosen row spacing (cm)').props.value, ''); assert.equal(ui.field(areaDeclaration).props.checked, false);
    ui.change('Plant-count method', 'density'); ui.change('Plant density (plants per m²)', '9'); ui.change('Plant-count method', 'spacing');
    assert.equal(ui.field(areaDeclaration).props.checked, false);
    ui.update({ countryCode: 'ZA' }); ui.update({ countryCode: 'KE' }); assert.equal(ui.field(areaDeclaration).props.checked, false);
    assert.deepEqual(ui.writes, []);
  } finally { files.dispose(); ui.dispose(); }
});

test('Great Lakes cabbage choices remain blank and regional consent cannot revive across a country or region round trip', async () => {
  const ui = mount({ countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', evidence: undefined });
  const files = downloads();
  const consent = 'Use this undated reference for cabbage bedding transplants in my declared Great Lakes States region';
  try {
    ui.change('Preview crop', 'cabbage'); ui.change('Preview measured bed', 'bed-1');
    assert.match(ui.text(), /18–24 inches within rows/); assert.match(ui.text(), /Publication and revision dates are unknown/);
    assert.equal(ui.field(consent).props.checked, false);
    ui.change('Plant-count method', 'spacing');
    for (const label of ['Chosen row spacing (cm)', 'Chosen in-row spacing (cm)', 'Final surviving plants per station']) assert.equal(ui.field(label).props.value, '');
    ui.change('Chosen row spacing (cm)', '76.2'); ui.change('Chosen in-row spacing (cm)', '45.72');
    act(() => ui.field(consent).props.onChange({ target: { checked: true } })); acknowledgeSpacing(ui);
    await ui.click();
    assert.match(ui.text(), /Budgeted whole stations: 30 \(ready\)/);
    assert.match(ui.text(), /Estimated plants: Unknown/); assert.match(ui.text(), /Estimated harvest weight: Unknown/);
    assert.match(ui.text(), /Establishment method: transplant/); assert.match(ui.text(), /climate-crop-derived/);
    ui.change('Final surviving plants per station', '1');
    assert.equal(ui.field(areaDeclaration).props.checked, false);
    acknowledgeSpacing(ui); await ui.click(); assert.match(ui.text(), /Estimated plants: 30 \(ready\)/);
    await ui.click('Download printable preview');
    assert.equal(files.blobs.length, 1); const html = await files.blobs[0].text();
    assert.match(html, /30 inches between rows/); assert.match(html, /18–24 inches within rows/);
    assert.doesNotMatch(html, /World Vegetable|2–3 seeds/);
    const oldDownload = ui.action('Download printable preview');
    ui.update({ agriculturalRegionReference: 'Other region' });
    assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.equal(ui.field(consent).props.disabled, true);
    ui.update({ agriculturalRegionReference: 'Great Lakes States' });
    assert.equal(ui.field(consent).props.checked, false); assert.equal(ui.field(areaDeclaration).props.checked, false);
    await act(async () => { await oldDownload(); }); assert.equal(files.blobs.length, 1);
    ui.update({ countryCode: 'KE' }); assert.doesNotMatch(ui.text(), /USDA Great Lakes cabbage transplant reference/);
    ui.update({ countryCode: 'US' }); assert.equal(ui.field(consent).props.checked, false);
    assert.deepEqual(ui.writes, []);
  } finally { files.dispose(); ui.dispose(); }
});

const saveDeclaration = 'Save these inputs, source limits and unknowns as a new profile for review. Do not add sowings.';
async function saveChoices(ui: ReturnType<typeof mount>) {
  ui.change('Preview crop', 'cabbage'); ui.change('Preview measured bed', 'bed-1');
  act(() => ui.field('Use this undated reference for cabbage bedding transplants in my declared Great Lakes States region').props.onChange({ target: { checked: true } }));
  ui.change('Plant-count method', 'spacing'); ui.change('Chosen row spacing (cm)', '76.2'); ui.change('Chosen in-row spacing (cm)', '45.72');
  acknowledgeSpacing(ui); await ui.click();
  act(() => ui.field(saveDeclaration).props.onChange({ target: { checked: true } }));
}
test('explicit save keeps partial source evidence, consumes duplicate clicks and reopens a historical record after remount', async () => {
  const rows: import('../lib/international/grower-planning.ts').GrowerPlanningProfile[] = [];
  let ui!: ReturnType<typeof mount>, calls = 0;
  const writer: NonNullable<ProvisionalCropPreviewProps['onSaveProfile']> = (profile, current) => {
    assert.equal(current(), true); calls++; rows.push(profile); ui.update({ profiles: [...rows] });
    return { status: 'confirmed', profileId: profile.profileId };
  };
  ui = mount({ countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', evidence: undefined, profiles: rows, onSaveProfile: writer });
  try {
    await saveChoices(ui); const oldSave = ui.action('Save provisional profile');
    await ui.click('Save provisional profile'); await act(async () => { await oldSave(); });
    assert.equal(calls, 1); assert.equal(rows.length, 1); assert.notEqual(rows[0].profileId, 'provisional-preview');
    assert.equal(rows[0].plantCountOrigin!.profileId, rows[0].profileId); assert.equal(rows[0].plantCountOrigin!.finalStand, null);
    assert.match(ui.text(), /Historical evidence, not a current source check/); assert.match(ui.text(), /Saved estimate: Unknown plants/);
    assert.match(ui.text(), /undated/); assert.match(ui.text(), /climate-crop-derived/); assert.match(ui.text(), /No sowings were added/);
    assert.doesNotMatch(ui.text(), /Nothing has been saved or added/);
    assert.deepEqual(ui.writes, []);
  } finally { ui.dispose(); }
  ui = mount({ countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', evidence: undefined, profiles: rows });
  try { assert.match(ui.text(), /Saved provisional profiles/); assert.match(ui.text(), /76.2 cm between rows/); assert.match(ui.text(), /Current applicability has not been checked/);
    assert.match(ui.text(), /Saved measured area: 10.5 m²/); assert.match(ui.text(), /Saved budgeted whole stations: 30 \(ready\)/); }
  finally { ui.dispose(); }
});

test('pending save cannot survive draft edits, actor loss or country and scope round trips', async () => {
  for (const change of ['draft', 'actor', 'country', 'scope', 'source'] as const) {
    let finish!: (receipt: { isCurrent: () => boolean } | null) => void, calls = 0, live = true;
    const ui = mount({ countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', evidence: undefined,
      onSaveProfile: () => { calls++; return { status: 'held' }; } });
    try {
      await saveChoices(ui);
      ui.update({ onCheckSource: async () => new Promise(resolve => { finish = resolve; }) });
      let work!: Promise<void>; act(() => { work = ui.action('Save provisional profile')(); });
      if (change === 'draft') { ui.change('Chosen in-row spacing (cm)', '60.96'); ui.change('Chosen in-row spacing (cm)', '45.72'); }
      if (change === 'actor') ui.update({ actorIsCurrent: () => false });
      if (change === 'country') { ui.update({ countryCode: 'KE' }); ui.update({ countryCode: 'US' }); }
      if (change === 'scope') { ui.update({ scope: { kind: 'unmapped-workspace', workspaceId: 'design:other' } }); ui.update({ scope }); }
      if (change === 'source') live = false;
      await act(async () => { finish({ isCurrent: () => live }); await work; });
      assert.equal(calls, 0, change); assert.deepEqual(ui.writes, []);
    } finally { ui.dispose(); }
  }
});

test('a save crossing UTC midnight holds, and failed or uncertain writes do not duplicate a possibly completed save', async t => {
  const now = Date.now(); t.mock.timers.enable({ apis: ['Date'], now });
  let finish!: (receipt: { isCurrent: () => boolean }) => void, calls = 0;
  const ui = mount({ countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', evidence: undefined,
    onSaveProfile: () => { calls++; return { status: 'held' }; } });
  try {
    await saveChoices(ui); ui.update({ onCheckSource: async () => new Promise(resolve => { finish = resolve; }) });
    let work!: Promise<void>; act(() => { work = ui.action('Save provisional profile')(); });
    t.mock.timers.setTime(now + 86400000);
    await act(async () => { finish({ isCurrent: () => true }); await work; }); assert.equal(calls, 0);
  } finally { ui.dispose(); }
  t.mock.timers.setTime(now);
  for (const status of ['failed', 'superseded', 'throws'] as const) {
    calls = 0;
    const view = mount({ countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', evidence: undefined,
      onSaveProfile: () => { calls++; if (status === 'throws') throw Error('uncertain callback'); return { status }; } });
    try {
      await saveChoices(view); const action = view.action('Save provisional profile');
      await view.click('Save provisional profile'); await act(async () => { await action(); });
      assert.equal(calls, status === 'failed' ? 2 : 1, status);
      assert.doesNotMatch(view.text(), /Profile saved\./);
      if (status !== 'failed') assert.match(view.text(), /could not be confirmed/);
    } finally { view.dispose(); }
  }
});

test('withdrawing the save declaration during its source check retires that attempt even if checked again', async () => {
  for (const checkAgain of [false, true]) {
    let finish!: (receipt: { isCurrent: () => boolean }) => void, calls = 0;
    const ui = mount({ countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', evidence: undefined,
      onSaveProfile: () => { calls++; return { status: 'held' }; } });
    try {
      await saveChoices(ui); ui.update({ onCheckSource: async () => new Promise(resolve => { finish = resolve; }) });
      let work!: Promise<void>; act(() => { work = ui.action('Save provisional profile')(); });
      act(() => ui.field(saveDeclaration).props.onChange({ target: { checked: false } }));
      if (checkAgain) act(() => ui.field(saveDeclaration).props.onChange({ target: { checked: true } }));
      await act(async () => { finish({ isCurrent: () => true }); await work; });
      assert.equal(calls, 0, 'the pending attempt must not use a withdrawn or replacement declaration');
      assert.deepEqual(ui.writes, []);
      ui.update({ onCheckSource: async () => ({ isCurrent: () => true }) });
      act(() => ui.field(saveDeclaration).props.onChange({ target: { checked: true } }));
      await ui.click('Save provisional profile'); assert.equal(calls, 1, 'a new explicit attempt remains possible');
    } finally { ui.dispose(); }
  }
});
