import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildDemoDesignCanvasState } from '../lib/demo-farm.ts';
import { fingerprintGrowerWorkflowSource, inspectGrowerWorkflowSource, type GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import { generateGrowerAutoPlan, type GrowerAutoPlanRequest } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import { projectGrowerCycles } from '../lib/international/grower-cycle-projection.ts';
import { resolveGrowerNurseryBatchReference } from '../lib/international/grower-nursery.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { createJournalEntry, inspectJournalNurserySowing, type JournalEntry } from '../lib/field-journal.ts';
import type { GrowerFieldObservationResult, GrowerNurserySowingInput } from '../lib/grower-field-observation.ts';
import type { GrowerSavedNurseryReview } from '../components/crops/useGrowerWorkflow.ts';
import type { NurserySowingObservationFormProps } from '../components/crops/NurserySowingObservationForm.tsx';
import type { SavedGrowerNurseryReviewPanelProps } from '../components/crops/SavedGrowerNurseryReviewPanel.tsx';

const prior = new Map(['IS_REACT_ACT_ENVIRONMENT', 'window', 'self'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
const root = new URL('../', import.meta.url).href;
const module = (code: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(code) });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/journal/JournalEntrySheet.tsx')) {
      if (specifier === '@/lib/i18n') return module('export const useLanguage=()=>({lang:"en"});');
      if (specifier === '@/lib/app-level') return module('export const useAppLevel=()=>"simple";');
    }
    if (context.parentURL?.startsWith(root) && specifier.endsWith('.module.css')) return module('export default {};');
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'),
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});
const { default: Form } = await import('../components/crops/NurserySowingObservationForm.tsx');
const { default: SavedPanel } = await import('../components/crops/SavedGrowerNurseryReviewPanel.tsx');
const { default: Summary } = await import('../components/journal/JournalNurserySowingSummary.tsx');
const { default: Sheet } = await import('../components/journal/JournalEntrySheet.tsx');
const stamp = '2026-11-05T12:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: stamp } });
// The view uses actual saved-cycle and reference authorities. Only the record
// callback is controlled: this suite does not simulate the production writer or
// claim a journal storage receipt. Historical entries use the real inspector.
async function fixture(): Promise<GrowerSavedNurseryReview> {
  const canvas = buildDemoDesignCanvasState(); canvas.siteId = 'site:0.00000,0.00000'; canvas.frame.centerLat = 0; canvas.frame.centerLng = 0;
  canvas.items = [{ ...canvas.items.find(row => row.defId === 'veg_bed')!, id: 'private-sowing-bed', label: 'Fixture growing space', wM: 3, hM: 4 }]; canvas.lines = []; canvas.zones = [];
  const checked = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: canvas.siteId, raw: canvas, sourceRevision: 'private-sowing-receipt' }));
  assert.equal(checked.status, 'ready'); if (checked.status !== 'ready') throw Error('Saved source fixture required');
  const source: GrowerWorkflowSource = checked;
  const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-sowing-profile', cropKey: CROPS[0].key, scope: source.scope, inputs: {
    plantsPerM2: own(4, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('transplant', 'method'), nurseryDays: own(10, 'days'),
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(3, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([2], 'utc-months'),
  } };
  const request: GrowerAutoPlanRequest = { requestedAt: stamp, scope: source.scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope: source.scope, measuredAreaM2: own(bed.areaM2, 'm2') })), planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-15', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope: source.scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-15' }, 'utc-date-window') })), reserved: [],
    demands: [{ demandId: 'private-sowing-demand', profileId: profile.profileId, scope: source.scope, totalKg: own(1, 'kg-total'), harvestWindow: own({ start: '2028-02-20', endExclusive: '2028-02-22' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready');
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'private-sowing-planting', acceptedAt: stamp, geometryFingerprint: source.geometryFingerprint }); assert.ok(row);
  const rows = [{ ...row, variety: 'Entered variety label' }], cycleContext = { scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  const cycle = projectGrowerCycles(rows, cycleContext).ownCycles[0]; assert.ok(cycle.nurseryDemand);
  return { kind: 'saved-nursery-review', source, rows, cycleContext, horizon: own(cycle.nurseryDemand.interval, 'utc-date-window'), references: [{
    plantingId: row.id, cropKey: row.cropKey, bedId: row.bedId, startDate: cycle.nurseryDemand.interval.start, endDateExclusive: cycle.nurseryDemand.interval.endExclusive,
    reference: resolveGrowerNurseryBatchReference(rows, cycleContext, row.id),
  }] };
}
const mounted = new Set<ReactTestRenderer>();
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function defer<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
function form(view: GrowerSavedNurseryReview) {
  let renderer!: ReactTestRenderer;
  let handler: NurserySowingObservationFormProps['onRecord'] = async () => ({ status: 'saved', message: 'Observation saved in the journal.' });
  const calls: { input: GrowerNurserySowingInput; current: () => boolean }[] = [];
  let props: NurserySowingObservationFormProps = { view, plantingId: view.references[0].plantingId, contextRevision: 1,
    onRecord: async (input, current) => { calls.push({ input, current }); return handler(input, current); } };
  act(() => { renderer = create(React.createElement(Form, props)); }); mounted.add(renderer);
  const field = (label: string) => { const node = renderer.root.findAllByType('label').find(row => text(row).startsWith(label)); assert.ok(node, label); return node.findAll(row => row.type === 'input' || row.type === 'textarea')[0]; };
  const button = (label = 'Save nursery sowing observation') => { const node = renderer.root.findAllByType('button').find(row => text(row) === label); assert.ok(node, label); return node; };
  return { renderer, calls, field, button, text: () => text(renderer.root), handler(next: typeof handler) { handler = next; },
    edit(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    confirm(value = true) { act(() => field('I confirm this day').props.onChange({ target: { checked: value } })); },
    async press(label?: string) { await act(async () => { button(label).props.onClick(); await Promise.resolve(); }); },
    update(patch: Partial<NurserySowingObservationFormProps>) { props = { ...props, ...patch }; act(() => renderer.update(React.createElement(Form, props))); },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); } };
}
function fill(ui: ReturnType<typeof form>, count = '') { ui.edit('Actual observed day', '2026-11-05'); ui.edit('What you observed', 'I recorded what I sowed in the nursery.'); ui.edit('Physical trays used', count); ui.confirm(); }
function history(traysUsed: number | null = 0): JournalEntry {
  return createJournalEntry({ date: '2026-11-05', title: 'Entered nursery observation', notes: 'Original ordinary journal note.', category: 'planting', bedId: 'historic-bed',
    growerCycleLink: { version: 1, scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' }, plantingId: 'historic-planting', bedId: 'historic-bed', eventKind: 'nursery-start', plannedDate: '2028-02-09' },
    nurserySowing: { kind: 'nursery-sowing-observation', version: 1, traysUsed, references: { variety: 'Historical variety label', seedLotReference: 'Historical lot label', raisingBatchReference: null } },
  }, 1000);
}
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); });
after(() => { hooks.deregister(); for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

test('observed form starts blank rather than copying planned dates/counts and labels are readonly snapshots', async () => {
  const view = await fixture(), before = JSON.stringify(view), ui = form(view);
  for (const label of ['Actual observed day', 'What you observed', 'Physical trays used']) { const control = ui.field(label); assert.equal(control.props.value, ''); assert.match(control.props.className, /min-h-11/); assert.equal(control.parent!.props.htmlFor, control.props.id); }
  assert.equal(ui.field('I confirm this day').props.checked, false); assert.equal(ui.button().props.disabled, true); assert.equal(ui.calls.length, 0);
  assert.match(ui.text(), /Entered variety label/); assert.match(ui.text(), /do not verify seed identity/); assert.match(ui.text(), /including partly filled trays/);
  assert.equal(JSON.stringify(view), before);
});

for (const [entered, expected] of [['', null], ['0', 0], ['2', 2]] as const) test(`physical tray input ${entered || 'blank'} submits ${expected === null ? 'unknown' : expected} through exactly the four-field callback`, async () => {
  const view = await fixture(), ui = form(view); fill(ui, entered); await ui.press();
  assert.equal(ui.calls.length, 1); assert.deepEqual(ui.calls[0].input, { observedDate: '2026-11-05', note: 'I recorded what I sowed in the nursery.', traysUsed: expected, confirmed: true });
  assert.notEqual(ui.calls[0].input.observedDate, view.references[0].startDate);
  assert.equal(ui.renderer.root.findByType('a').props.href, '/journal'); assert.match(ui.renderer.root.findByType('a').props.className, /min-h-11/);
});

test('actual valid day, nonempty note, whole physical count and explicit confirmation are all required', async () => {
  const ui = form(await fixture()); fill(ui); ui.confirm(false); await ui.press(); assert.equal(ui.calls.length, 0);
  ui.confirm(); ui.edit('Actual observed day', '2026-02-30'); await ui.press(); assert.equal(ui.calls.length, 0);
  ui.edit('Actual observed day', '2026-11-05'); ui.edit('What you observed', ' '); await ui.press(); assert.equal(ui.calls.length, 0);
  ui.edit('What you observed', 'Actual note');
  for (const value of ['1.5', '-1', '1e2']) { ui.edit('Physical trays used', value); await ui.press(); assert.equal(ui.calls.length, 0); }
});

test('one intent keeps a stable proof across held retries, blocks reentrancy and edits revoke its original proof', async () => {
  const ui = form(await fixture()), waiting = defer<GrowerFieldObservationResult>(); ui.handler(async () => waiting.promise); fill(ui);
  const submit = ui.button().props.onClick; act(() => { submit(); submit(); }); assert.equal(ui.calls.length, 1); const original = ui.calls[0].current; assert.equal(original(), true);
  await act(async () => { waiting.resolve({ status: 'held', message: 'Check current records.' }); });
  ui.handler(async () => ({ status: 'held', message: 'Still held.' })); await ui.press(); assert.equal(ui.calls[1].current, original);
  ui.edit('What you observed', 'A deliberate changed note.'); assert.equal(original(), false); await ui.press();
  assert.notEqual(ui.calls[2].current, original);
});

test('saved intent cannot append twice and only an explicit new observation resets date/count/confirmation', async () => {
  const ui = form(await fixture()); fill(ui, '2'); const submit = ui.button().props.onClick; await ui.press();
  act(() => submit()); await ui.press(); assert.equal(ui.calls.length, 1);
  const another = ui.button('Record another nursery sowing').props.onClick; await ui.press('Record another nursery sowing');
  assert.equal(ui.field('Actual observed day').props.value, ''); assert.equal(ui.field('Physical trays used').props.value, ''); assert.equal(ui.field('I confirm this day').props.checked, false);
  ui.edit('What you observed', 'New intent text'); act(() => another()); assert.equal(ui.field('What you observed').props.value, 'New intent text');
  fill(ui, '0'); await ui.press(); assert.equal(ui.calls.length, 2); assert.notEqual(ui.calls[0].current, ui.calls[1].current);
});

test('uncertain receipt consumes the intent with journal inspection guidance and no reset or automatic retry', async () => {
  const ui = form(await fixture()); ui.handler(async () => ({ status: 'unconfirmed', message: 'The final journal receipt could not be confirmed.' })); fill(ui); const submit = ui.button().props.onClick; await ui.press();
  act(() => submit()); await ui.press(); assert.equal(ui.calls.length, 1); assert.match(ui.text(), /Inspect the journal before recording again/);
  assert.equal(ui.renderer.root.findAllByType('button').some(node => text(node) === 'Record another nursery sowing'), false);
  assert.equal(ui.renderer.root.findByType('a').props.href, '/journal'); assert.equal(ui.field('Actual observed day').props.disabled, true);
});

for (const change of ['source', 'revision', 'sample'] as const) test(`a pending observation loses its source proof on ${change} replacement and a late result cannot claim saved`, async () => {
  const view = await fixture(), ui = form(view), waiting = defer<GrowerFieldObservationResult>(); ui.handler(async () => waiting.promise); fill(ui); await ui.press();
  ui.update(change === 'source' ? { view: { ...view } } : change === 'sample' ? { sample: true } : { contextRevision: 2 });
  assert.equal(ui.calls[0].current(), false); await act(async () => { waiting.resolve({ status: 'saved', message: 'Must not appear as saved.' }); });
  assert.doesNotMatch(ui.text(), /Must not appear/); assert.match(ui.text(), /earlier checked batch/);
});

test('SavedPanel offers only clean ready rows and same-batch dirty edits revoke an already-running observation before rerender', async () => {
  const view = await fixture(), waiting = defer<GrowerFieldObservationResult>(), calls: { view: GrowerSavedNurseryReview; id: string; current: () => boolean }[] = [];
  const props: SavedGrowerNurseryReviewPanelProps = { review: view, checking: false, contextRevision: 1, onRefresh: async () => ({ status: 'ready', view }), onCheckCurrent: async () => true,
    onSaveReferences: async () => ({ status: 'unchanged' }), onRecordSowing: async (given, id, _input, current) => { calls.push({ view: given, id, current }); return waiting.promise; } };
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(SavedPanel, props)); }); mounted.add(renderer);
  const byText = (label: string) => { const found = renderer.root.findAllByType('button').find(node => text(node) === label); assert.ok(found); return found; };
  const open = byText('Record nursery sowing').props.onClick; act(() => open());
  const labelInput = (prefix: string) => { const label = renderer.root.findAllByType('label').find(node => text(node).startsWith(prefix)); assert.ok(label); return label.findAll(node => node.type === 'input' || node.type === 'textarea')[0]; };
  for (const [label, value] of [['Actual observed day', '2026-11-05'], ['What you observed', 'Actual sowing note']]) act(() => labelInput(label).props.onChange({ target: { value } }));
  act(() => labelInput('I confirm this day').props.onChange({ target: { checked: true } }));
  act(() => { byText('Save nursery sowing observation').props.onClick(); assert.equal(calls.length, 1);
    renderer.root.findByProps({ 'aria-label': 'Your seed-lot reference (optional) — saved batch 1' }).props.onChange({ target: { value: 'Unsaved reference change' } });
    assert.equal(calls[0].current(), false, 'synchronous editor intent revokes the callback before React unmounts the old form'); });
  assert.equal(calls[0].view, view); assert.equal(calls[0].id, view.references[0].plantingId);
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Record observed nursery sowing' }).length, 0);
  act(() => open()); assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Record observed nursery sowing' }).length, 0);
  await act(async () => { waiting.resolve({ status: 'held', message: 'Changed intent.' }); });
  const heldView = { ...view, references: view.references.map(row => ({ ...row, reference: { status: 'held' as const, reason: 'malformed-reference' } })) };
  act(() => renderer.update(React.createElement(SavedPanel, { ...props, review: heldView, contextRevision: 2 })));
  assert.equal(renderer.root.findAllByType('button').some(node => text(node) === 'Record nursery sowing'), false);
});

test('SavedPanel forwards the same combined proof for held retries and an edited form receives a new revocable proof', async () => {
  const view = await fixture(), calls: (() => boolean)[] = [];
  const props: SavedGrowerNurseryReviewPanelProps = { review: view, checking: false, contextRevision: 1, onRefresh: async () => ({ status: 'ready', view }), onCheckCurrent: async () => true,
    onSaveReferences: async () => ({ status: 'unchanged' }), onRecordSowing: async (_view, _id, _input, current) => { calls.push(current); return { status: 'held', message: 'Check the journal storage notice.' }; } };
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(SavedPanel, props)); }); mounted.add(renderer);
  const button = (name: string) => { const node = renderer.root.findAllByType('button').find(value => text(value) === name); assert.ok(node); return node; };
  const field = (prefix: string) => { const label = renderer.root.findAllByType('label').find(node => text(node).startsWith(prefix)); assert.ok(label); return label.findAll(node => node.type === 'input' || node.type === 'textarea')[0]; };
  act(() => button('Record nursery sowing').props.onClick());
  for (const [label, value] of [['Actual observed day', '2026-11-05'], ['What you observed', 'Original held note']]) act(() => field(label).props.onChange({ target: { value } }));
  act(() => field('I confirm this day').props.onChange({ target: { checked: true } }));
  await act(async () => { button('Save nursery sowing observation').props.onClick(); });
  await act(async () => { button('Save nursery sowing observation').props.onClick(); });
  assert.equal(calls.length, 2); assert.equal(calls[0], calls[1]); assert.equal(calls[0](), true);
  act(() => field('What you observed').props.onChange({ target: { value: 'Explicitly edited note' } }));
  assert.equal(calls[0](), false); await act(async () => { button('Save nursery sowing observation').props.onClick(); });
  assert.equal(calls.length, 3); assert.notEqual(calls[2], calls[0]); assert.equal(calls[2](), true);
});

for (const trays of [0, null] as const) test(`history displays ${trays === null ? 'unknown' : 'zero'} physical trays and original snapshot labels with no current plan`, () => {
  const entry = history(trays), before = JSON.stringify(entry); assert.equal(inspectJournalNurserySowing(entry).status, 'observed');
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(Summary, { entry })); }); mounted.add(renderer);
  const values = renderer.root.findAllByType('dd').map(node => text(node)); assert.deepEqual(values, [trays === null ? 'Unknown' : '0', 'Historical variety label', 'Historical lot label', 'Not recorded']);
  assert.equal(JSON.stringify(entry), before); assert.doesNotMatch(text(renderer.root), /2028-02-09|verified seed identity/);
});

test('malformed or getter-backed history is held without displaying raw unsafe data or executing getters; legacy notes stay ordinary', () => {
  let getters = 0; const unsafe = { ...history() }; Object.defineProperty(unsafe, 'nurserySowing', { enumerable: true, get() { getters++; return 'private-unsafe-payload'; } });
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(Summary, { entry: unsafe })); }); mounted.add(renderer);
  assert.equal(getters, 0); assert.match(text(renderer.root), /Stored nursery sowing evidence needs review/); assert.doesNotMatch(text(renderer.root), /private-unsafe-payload|Historical lot/);
  const legacy = { ...history() }; delete legacy.nurserySowing;
  act(() => renderer.update(React.createElement(Summary, { entry: legacy }))); assert.equal(renderer.toJSON(), null); assert.equal(legacy.notes, 'Original ordinary journal note.');
});

test('actual entry sheet and actual timeline summary call render stored evidence without requiring a current crop plan', () => {
  const entry = history(); let sheet!: ReactTestRenderer;
  act(() => { sheet = create(React.createElement(Sheet, { entry, beds: [], crops: [], onSave() {}, onClose() {}, readOnly: true })); }); mounted.add(sheet);
  assert.match(text(sheet.root), /Historical lot label/); assert.match(text(sheet.root), /Physical trays used, including partly filled0/);
  assert.equal(sheet.root.findByType('textarea').props.value, entry.notes);
  // Execute the exact timeline JSX call, rather than recreating its props. The
  // enclosing authenticated journal/storage screen is outside this UI unit.
  const source = readFileSync(new URL('../components/journal/FieldJournal.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('FieldJournal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let call: ts.JsxSelfClosingElement | undefined;
  function visit(node: ts.Node) { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'JournalNurserySowingSummary') call = node; ts.forEachChild(node, visit); } visit(tree);
  assert.ok(call); assert.equal(call.attributes.properties.length, 1);
  const code = ts.transpileModule('return (' + call.getText(tree) + ');', { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
  const element = new Function('React', 'JournalNurserySowingSummary', 'entry', code)(React, Summary, entry);
  let timeline!: ReactTestRenderer; act(() => { timeline = create(element); }); mounted.add(timeline);
  assert.match(text(timeline.root), /Historical variety label/); assert.match(text(timeline.root), /Historical lot label/);
});

test('shared real journal workflow renderer shows zero and unknown nursery observations in timeline and opened entry sheet', async () => {
  const { mountJournal } = await import('./journal-workflow-renderer.ts');
  const entries = [{ ...history(0), id: 'historical-zero', title: 'Historical zero sowing' }, { ...history(null), id: 'historical-unknown', title: 'Historical unknown sowing' }];
  const before = JSON.stringify(entries), app = await mountJournal({ entries, lang: 'en' });
  try {
    const summaries = app.renderer.root.findAllByProps({ 'aria-label': 'Recorded nursery sowing observation' });
    assert.equal(summaries.length, 2);
    assert.deepEqual(summaries.map(node => text(node.findAllByType('dd')[0])).sort(), ['0', 'Unknown']);
    for (const summary of summaries) { assert.match(text(summary), /Historical variety label/); assert.match(text(summary), /Historical lot label/); }
    const open = app.renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Edit entry: Historical zero sowing'); assert.ok(open);
    await act(async () => { open.props.onClick(); });
    const sheet = app.renderer.root.findByType(app.Sheet);
    const sheetSummary = sheet.findByProps({ 'aria-label': 'Recorded nursery sowing observation' });
    assert.equal(text(sheetSummary.findAllByType('dd')[0]), '0'); assert.match(text(sheetSummary), /Historical lot label/);
    assert.equal(sheet.findByType('textarea').props.value, entries[0].notes);
    assert.equal(app.writes.length, 0); assert.equal(JSON.stringify(entries), before);
  } finally { await app.close(); }
});

test('Open journal uses the real Next client link so navigation retains the in-memory observation context', async () => {
  const view = await fixture(), stored = history(0), snapshot = JSON.stringify(stored), pushes: string[] = [];
  let renderer!: ReactTestRenderer;
  function Host() {
    const [path, setPath] = React.useState('/facilitator/crops');
    const router = { back() {}, forward() {}, refresh() {}, replace() {}, prefetch() {}, push(next: string) { pushes.push(next); setPath(next); } };
    return React.createElement(AppRouterContext.Provider, { value: router }, path === '/journal'
      ? React.createElement(Summary, { entry: stored })
      : React.createElement(Form, { view, plantingId: view.references[0].plantingId, contextRevision: 1, sample: true,
        onRecord: async () => ({ status: 'saved' as const, message: 'Observation saved in the sample journal.' }) }));
  }
  act(() => { renderer = create(React.createElement(Host)); }); mounted.add(renderer);
  const field = (prefix: string) => { const label = renderer.root.findAllByType('label').find(node => text(node).startsWith(prefix)); assert.ok(label); return label.findAll(node => node.type === 'input' || node.type === 'textarea')[0]; };
  act(() => field('Actual observed day').props.onChange({ target: { value: stored.date } }));
  act(() => field('What you observed').props.onChange({ target: { value: stored.notes } }));
  act(() => field('Physical trays used').props.onChange({ target: { value: '0' } }));
  act(() => field('I confirm this day').props.onChange({ target: { checked: true } }));
  const save = renderer.root.findAllByType('button').find(node => text(node) === 'Save nursery sowing observation'); assert.ok(save);
  await act(async () => { save.props.onClick(); });
  const link = renderer.root.findByType('a'); assert.equal(link.props.href, '/journal');
  assert.equal(typeof link.props.onClick, 'function', 'a plain anchor would reload the page and discard the sample’s in-memory journal');
  const event = { currentTarget: { nodeName: 'A', getAttribute: () => null }, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    nativeEvent: { which: 1 }, preventDefault() { this.defaultPrevented = true; } };
  await act(async () => { link.props.onClick(event); });
  assert.equal(event.defaultPrevented, true); assert.deepEqual(pushes, ['/journal']);
  assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Record observed nursery sowing' }).length, 0);
  const summary = renderer.root.findByProps({ 'aria-label': 'Recorded nursery sowing observation' });
  assert.match(text(summary), /Physical trays used, including partly filled0/); assert.match(text(summary), /Historical lot label/);
  assert.equal(JSON.stringify(stored), snapshot);
});
