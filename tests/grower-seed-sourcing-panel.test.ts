import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { GrowerSeedSourcingPanelProps } from '../components/crops/GrowerSeedSourcingPanel';
import type { GrowerSeedSourcingFormProps, SeedSourcingGroupPatch } from '../components/crops/GrowerSeedSourcingForm';
import type { GrowerSeedSourcingReview } from '../lib/international/grower-seed-sourcing';

// These tests exercise the composition's own boundaries. Fake children expose
// props without implementing the existing form/summary or authenticating a source.
// One case delegates to the real children solely to check escaped composition.
const panelFile = '/components/crops/GrowerSeedSourcingPanel.tsx';
const formFile = '/components/crops/GrowerSeedSourcingForm.tsx';
const summaryFile = '/components/crops/GrowerSeedSourcingSummary.tsx';
const globalKey = '__imbewuSeedSourcingPanelHarness';
const previous = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT', globalKey]
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0, dependency: 0 };
const storage = () => { effects.storage++; throw Error('The controlled composition must not acquire storage or save inputs'); };
const network = () => { effects.network++; throw Error('The controlled composition must not fetch, order or authenticate sources'); };
const browser = Object.defineProperties({}, { localStorage: { get: storage }, sessionStorage: { get: storage } });
const harness: { React: typeof React; form: GrowerSeedSourcingFormProps | null; review: GrowerSeedSourcingReview | null | undefined;
  realChildren: boolean; realForm: React.ComponentType<GrowerSeedSourcingFormProps> | null;
  realSummary: React.ComponentType<{ review: GrowerSeedSourcingReview | null }> | null } = {
  React, form: null, review: undefined, realChildren: false, realForm: null, realSummary: null,
};
for (const [key, descriptor] of Object.entries({ fetch: { value: network }, window: { value: browser },
  localStorage: { get: storage }, sessionStorage: { get: storage }, IS_REACT_ACT_ENVIRONMENT: { value: true }, [globalKey]: { value: harness } })) {
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
}
const dataModule = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
const fakeForm = dataModule(`const h=globalThis.${globalKey}; export default function Form(props){h.form=props;
  return h.realChildren?h.React.createElement(h.realForm,props):h.React.createElement('div',{'data-fake-child':'form'});}`);
const fakeSummary = dataModule(`const h=globalThis.${globalKey}; export default function Summary(props){h.review=props.review;
  return h.realChildren?h.React.createElement(h.realSummary,props):h.React.createElement('div',{'data-fake-child':'summary'});}`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith(panelFile)) {
      if (/(^|\/)GrowerSeedSourcingForm(?:\.tsx)?$/.test(specifier)) return fakeForm;
      if (/(^|\/)GrowerSeedSourcingSummary(?:\.tsx)?$/.test(specifier)) return fakeSummary;
      if (!['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'].includes(specifier)) {
        effects.dependency++; throw Error('The composition may depend only on React and its controlled Form/Summary children at runtime');
      }
    }
    if ((context.parentURL?.endsWith(formFile) || context.parentURL?.endsWith(summaryFile))
      && !['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'].includes(specifier)) {
      effects.dependency++; throw Error('Real controlled children unexpectedly acquired a runtime authority');
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if ([panelFile, formFile, summaryFile].some(file => url.endsWith(file))) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Panel } = await import('../components/crops/GrowerSeedSourcingPanel.tsx');
harness.realForm = (await import('../components/crops/GrowerSeedSourcingForm.tsx')).default;
harness.realSummary = (await import('../components/crops/GrowerSeedSourcingSummary.tsx')).default;
const importEffects = { ...effects };
const batches = Object.freeze([{ id: 'private-batch-one', label: 'Supplied raising batch' }].map(row => Object.freeze(row)));
const groups = Object.freeze([Object.freeze({ id: 'private-supply-one', label: 'Supplied label', batchIds: Object.freeze(['private-batch-one']),
  interchangeabilityConfirmed: false, allocatedToPlanSeedsText: ' 0007 ', seedsPerPackText: '' })]);
function review(): GrowerSeedSourcingReview {
  // Deliberately non-derived supplied numbers: a wrapper must neither calculate
  // nor repair an input review. Canonical projector tests own actual arithmetic.
  return { status: 'partial', basis: 'grower-seed-sourcing-estimates', sourceVerification: 'not-verified', nurseryReviewStatus: 'partial',
    coverage: 'represented-saved-transplant-batches-only', wholeFarmCoverage: 'not-assessed', horizon: null,
    representedBatchCount: 9, assignedBatchCount: 1, unassignedBatchIds: ['private-unassigned'], sourceIssues: [],
    groups: [{ index: 88, id: 'private-review-group', batchIds: ['private-batch-one'], status: 'unknown', knownRequiredSeedsSubtotal: 17,
      requiredSeeds: null, counts: { status: 'unknown', neededSeeds: null, packsNeeded: null, plannedPackSeeds: null }, issues: [] }], issues: [],
    guidance: 'Synthetic supplied planning guidance; no authenticated source or stock.' };
}
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
  return value;
}
const mounted = new Set<ReactTestRenderer>();
function mount(overrides: Partial<GrowerSeedSourcingPanelProps> = {}) {
  let renderer!: ReactTestRenderer, added = 0, reviewed = 0;
  const removed: string[] = [], changed: { id: string; patch: SeedSourcingGroupPatch }[] = [];
  let props: GrowerSeedSourcingPanelProps = { batches, groups, review: review(), disabled: false, reviewing: false,
    onAddGroup() { added++; }, onRemoveGroup(id) { removed.push(id); }, onChangeGroup(id, patch) { changed.push({ id, patch }); }, onReview() { reviewed++; }, ...overrides };
  act(() => { renderer = create(React.createElement(Panel, props)); }); mounted.add(renderer);
  return { renderer, removed, changed, get added() { return added; }, get reviewed() { return reviewed; }, get props() { return props; },
    text: () => text(renderer.root), update(next: Partial<GrowerSeedSourcingPanelProps>) {
      props = { ...props, ...next }; act(() => renderer.update(React.createElement(Panel, props)));
    } };
}
function form(): GrowerSeedSourcingFormProps { assert.ok(harness.form); return harness.form; }
function action(renderer: ReactTestRenderer) {
  const buttons = renderer.root.findAllByType('button'); assert.equal(buttons.length, 1, 'Only the wrapper review action is present with fake children'); return buttons[0];
}
beforeEach(() => { effects.network = 0; effects.storage = 0; effects.dependency = 0; harness.form = null; harness.review = undefined; harness.realChildren = false; });
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0, dependency: 0 });
});
after(() => {
  hooks.deregister();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test('the actual composition delegates exact controlled arrays and review references without acquiring a source or recalculating counts', () => {
  assert.deepEqual(importEffects, { network: 0, storage: 0, dependency: 0 });
  const supplied = deepFreeze(review()), before = JSON.stringify({ batches, groups, supplied }), ui = mount({ review: supplied });
  assert.equal(form().batches, batches); assert.equal(form().groups, groups); assert.equal(form().disabled, false); assert.equal(harness.review, supplied);
  assert.equal(JSON.stringify({ batches, groups, supplied }), before);
  assert.match(ui.text(), /Review uses your saved nursery context and these planning inputs/);
  assert.match(ui.text(), /does not record seed stock or place an order/);
  assert.doesNotMatch(ui.text(), /private-|source verified|saved successfully|order placed|download|approval granted/i);
  const button = action(ui.renderer); assert.equal(text(button), 'Review seed requirements'); assert.equal(button.props.type, 'button');
  assert.equal(button.props.disabled, false); assert.match(button.props.className, /min-h-11/);
  assert.equal(ui.renderer.root.findAllByType('a').length, 0);
  assert.equal(ui.renderer.root.findAll(node => typeof node.type === 'string' && Object.hasOwn(node.props, 'download')).length, 0);
});

test('enabled child callbacks preserve exact group handles, patch objects, memberships and raw count text without editing parent inputs', () => {
  const ui = mount(), before = JSON.stringify(ui.props.groups), batchIds = Object.freeze(['private-batch-one', 'private-other', 'private-batch-one']);
  const patch = Object.freeze({ batchIds, label: '  exact label  ', allocatedToPlanSeedsText: '9007199254740993', seedsPerPackText: '1,234', interchangeabilityConfirmed: false });
  act(() => form().onAddGroup()); act(() => form().onRemoveGroup('private-exact-remove'));
  act(() => form().onChangeGroup('private-exact-change', patch)); act(() => action(ui.renderer).props.onClick());
  assert.equal(ui.added, 1); assert.deepEqual(ui.removed, ['private-exact-remove']); assert.equal(ui.reviewed, 1);
  assert.equal(ui.changed.length, 1); assert.equal(ui.changed[0].id, 'private-exact-change'); assert.equal(ui.changed[0].patch, patch);
  assert.equal(ui.changed[0].patch.batchIds, batchIds); assert.equal(ui.changed[0].patch.allocatedToPlanSeedsText, '9007199254740993');
  assert.equal(ui.changed[0].patch.seedsPerPackText, '1,234'); assert.equal(JSON.stringify(ui.props.groups), before);
  assert.equal(form().groups, groups, 'Callbacks cannot silently update controlled state');
});

test('disabled and reviewing renders synchronously block direct callback invocation and withdraw the exact supplied summary to null', () => {
  for (const state of [{ disabled: true, reviewing: false }, { disabled: false, reviewing: true }, { disabled: true, reviewing: true }]) {
    const supplied = review(), ui = mount({ review: supplied, ...state });
    assert.equal(form().disabled, true); assert.equal(harness.review, null);
    const button = action(ui.renderer); assert.equal(button.props.disabled, true);
    assert.equal(text(button), state.reviewing ? 'Checking saved nursery context…' : 'Review seed requirements');
    act(() => form().onAddGroup()); act(() => form().onRemoveGroup('private-remove'));
    act(() => form().onChangeGroup('private-change', { allocatedToPlanSeedsText: '1' })); act(() => button.props.onClick());
    assert.equal(ui.added, 0); assert.equal(ui.reviewed, 0); assert.deepEqual(ui.removed, []); assert.deepEqual(ui.changed, []);
    assert.equal(ui.props.review, supplied, 'Withdrawal must not mutate or reclassify caller data');
  }
});

test('empty batch or group choices disable review even when a caller manually invokes the button handler', () => {
  for (const choices of [{ batches: [] }, { groups: [] }, { batches: [], groups: [] }]) {
    const ui = mount(choices), button = action(ui.renderer);
    assert.equal(button.props.disabled, true); assert.equal(form().disabled, false, 'Empty review choices do not invent an actor/source failure');
    act(() => button.props.onClick()); assert.equal(ui.reviewed, 0);
    assert.equal(form().batches, ui.props.batches); assert.equal(form().groups, ui.props.groups);
  }
});

test('rerendering stays wholly controlled: current null and blocked states replace the old review while new exact arrays and callbacks pass through', () => {
  const old = review(), ui = mount({ review: old }); assert.equal(harness.review, old);
  ui.update({ reviewing: true }); assert.equal(harness.review, null);
  ui.update({ reviewing: false, review: null }); assert.equal(harness.review, null);
  const next = deepFreeze({ ...review(), representedBatchCount: 731 }), nextGroups = Object.freeze([{ ...groups[0], allocatedToPlanSeedsText: '', seedsPerPackText: '0' }]);
  const nextBatches = Object.freeze([{ id: 'private-new-batch', label: 'Next choice' }]); let changed = 0;
  const callback = (_id: string, patch: SeedSourcingGroupPatch) => { assert.equal(patch, exactPatch); changed++; };
  const exactPatch = Object.freeze({ allocatedToPlanSeedsText: ' 0000 ' });
  ui.update({ batches: nextBatches, groups: nextGroups, review: next, onChangeGroup: callback });
  assert.equal(form().batches, nextBatches); assert.equal(form().groups, nextGroups); assert.equal(harness.review, next);
  act(() => form().onChangeGroup('private-new-group', exactPatch)); assert.equal(changed, 1); assert.deepEqual(ui.changed, []);
  ui.update({ disabled: true }); assert.equal(harness.review, null); assert.equal(form().disabled, true);
  ui.update({ disabled: false }); assert.equal(harness.review, next, 'Only parent props determine whether a review is supplied again; this is no freshness certification');
});

test('actual composed children keep tiny and long authored labels ordinary escaped text with no extra grant or download control', () => {
  harness.realChildren = true;
  const hostile = '<img src=x onerror="fetch(1)"><script>orderPlaced=true</script>', long = hostile.repeat(80);
  const suppliedBatches = [{ id: 'private-long-batch', label: long }, { id: 'private-tiny-batch', label: 'x' }];
  const suppliedGroups = [{ ...groups[0], label: long }, { ...groups[0], id: 'private-second-group', label: 'x', batchIds: [] }];
  const supplied = review(), before = JSON.stringify({ suppliedBatches, suppliedGroups, supplied });
  const ui = mount({ batches: suppliedBatches, groups: suppliedGroups, review: supplied });
  assert.ok(ui.text().includes(long)); assert.ok(ui.renderer.root.findAllByType('input').some(node => node.props.value === long));
  assert.ok(ui.renderer.root.findAllByType('input').some(node => node.props.value === 'x'));
  for (const tag of ['script', 'img', 'iframe', 'a'] as const) assert.equal(ui.renderer.root.findAllByType(tag).length, 0);
  assert.equal(ui.renderer.root.findAll(node => Object.hasOwn(node.props, 'dangerouslySetInnerHTML')).length, 0);
  assert.doesNotMatch(JSON.stringify(ui.renderer.toJSON()), /private-|fingerprint|groupId|batchIds|onRecordStock|onPurchase/);
  assert.equal(JSON.stringify({ suppliedBatches, suppliedGroups, supplied }), before);
  const actions = ui.renderer.root.findAllByType('button').map(text);
  assert.ok(actions.includes('Review seed requirements')); assert.ok(actions.every(name =>
    ['Review seed requirements', 'Add supply group', 'Remove supply group from this review'].includes(name)));
});

test('the composition source has no state/effect, parsing, time, arithmetic or browser-delivery authority hidden behind disabled controls', () => {
  const source = readFileSync(new URL('../components/crops/GrowerSeedSourcingPanel.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('GrowerSeedSourcingPanel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const forbidden = new Set(['useState', 'useReducer', 'useRef', 'useEffect', 'useLayoutEffect', 'useSyncExternalStore', 'useMemo', 'useCallback',
    'fetch', 'localStorage', 'sessionStorage', 'indexedDB', 'XMLHttpRequest', 'WebSocket', 'Date', 'Math', 'Number', 'parseFloat', 'parseInt', 'BigInt']);
  const found: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && forbidden.has(node.text)) found.push(node.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) found.push('dynamic-import');
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.deepEqual(found, [], 'A presentational composition cannot quietly become a second state/parser/source/delivery authority');
});
