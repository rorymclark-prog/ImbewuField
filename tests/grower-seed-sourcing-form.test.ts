import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { GrowerSeedSourcingFormProps, SeedSourcingGroupDraft, SeedSourcingGroupPatch } from '../components/crops/GrowerSeedSourcingForm';

// Synthetic controlled editor only: no actual nursery membership, stock,
// crop calculation, source authentication or write permission is established.
const file = '/components/crops/GrowerSeedSourcingForm.tsx';
const previous = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0, dependency: 0 };
const storage = () => { effects.storage++; throw Error('A controlled seed form must not read or write storage'); };
const request = () => { effects.network++; throw Error('A controlled seed form must not place orders or fetch sources'); };
const browser = Object.defineProperties({}, { localStorage: { get: storage }, sessionStorage: { get: storage } });
for (const [key, descriptor] of Object.entries({ fetch: { value: request }, window: { value: browser },
  localStorage: { get: storage }, sessionStorage: { get: storage }, IS_REACT_ACT_ENVIRONMENT: { value: true } })) {
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
}
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith(file) && !['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'].includes(specifier)) {
      effects.dependency++; throw Error('The controlled form must not import a parser, calculation, source, storage or backend dependency');
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(file)) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Form } = await import('../components/crops/GrowerSeedSourcingForm.tsx');
const importEffects = { ...effects };
const batches = [{ id: 'private-batch-a', label: 'North raising batch' }, { id: 'private-batch-b', label: 'South raising batch' },
  { id: 'private-batch-c', label: 'North raising batch' }];
function groups(): SeedSourcingGroupDraft[] {
  return [{ id: 'private-group-first', label: 'First supply', batchIds: ['private-batch-a', 'private-unknown-membership', 'private-batch-a'],
    interchangeabilityConfirmed: false, allocatedToPlanSeedsText: '', seedsPerPackText: '0' },
  { id: 'private-group-second', label: 'Other supply', batchIds: ['private-batch-b'], interchangeabilityConfirmed: true,
    allocatedToPlanSeedsText: '001', seedsPerPackText: '' }];
}
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
const mounted = new Set<ReactTestRenderer>();
function mount(overrides: Partial<GrowerSeedSourcingFormProps> = {}) {
  const changes: { id: string; patch: SeedSourcingGroupPatch }[] = [], removed: string[] = [];
  let added = 0, renderer!: ReactTestRenderer;
  let props: GrowerSeedSourcingFormProps = { batches: batches.map(batch => ({ ...batch })), groups: groups(), disabled: false,
    onAddGroup() { added++; }, onRemoveGroup(id) { removed.push(id); }, onChangeGroup(id, patch) { changes.push({ id, patch }); }, ...overrides };
  act(() => { renderer = create(React.createElement(Form, props)); }); mounted.add(renderer);
  return { renderer, changes, removed, get added() { return added; }, get props() { return props; }, text: () => text(renderer.root),
    update(values: Partial<GrowerSeedSourcingFormProps>) { props = { ...props, ...values }; act(() => renderer.update(React.createElement(Form, props))); },
  };
}
function card(renderer: ReactTestRenderer, position: number) {
  const heading = renderer.root.findAll(node => typeof node.type === 'string' && text(node) === `Supply group ${position}`)[0];
  assert.ok(heading, `Visible software numbering for group ${position}`);
  let owner = heading.parent;
  while (owner && owner.findAllByType('input').filter(node => node.props.type === 'text').length < 3) owner = owner.parent;
  assert.ok(owner); return owner;
}
function labelFor(control: ReactTestInstance) {
  let label = control.parent;
  while (label && label.type !== 'label') label = label.parent;
  assert.ok(label, 'Controls use wrapping human labels rather than private HTML IDs'); return label;
}
function field(owner: ReactTestInstance, label: RegExp) {
  const found = owner.findAllByType('label').find(node => label.test(text(node)) && node.findAllByType('input').some(input => input.props.type === 'text'));
  assert.ok(found, label.source); return found.findAllByType('input').find(input => input.props.type === 'text')!;
}
const groupLabel = (owner: ReactTestInstance) => field(owner, /Your supply group label \(optional\)/i);
const allocation = (owner: ReactTestInstance) => field(owner, /allocat/i);
const pack = (owner: ReactTestInstance) => field(owner, /seeds per pack|seed count per pack|seeds in (?:one|a) pack/i);
function confirmation(owner: ReactTestInstance) {
  const label = owner.findAllByType('label').find(node => /I confirm these selected batches can use the same seed supply/.test(text(node)));
  assert.ok(label); return label.findAllByType('input').find(node => node.props.type === 'checkbox')!;
}
function membership(owner: ReactTestInstance) {
  return owner.findAllByType('input').filter(node => node.props.type === 'checkbox'
    && !/I confirm these selected batches/.test(text(labelFor(node))));
}
function button(owner: ReactTestInstance, name: string) {
  const node = owner.findAllByType('button').find(node => text(node) === name); assert.ok(node, name); return node;
}
function isDisabled(control: ReactTestInstance) {
  let node: ReactTestInstance | null = control;
  while (node) { if (node.props.disabled === true && (node === control || node.type === 'fieldset')) return true; node = node.parent; }
  return false;
}
function noPrivate(renderer: ReactTestRenderer) {
  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /private-|fingerprint|batchIds|groupId/);
}
beforeEach(() => { effects.network = 0; effects.storage = 0; effects.dependency = 0; });
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

test('actual controls show supplied raw values, generous targets and planning-only limits without exposing internal handles', () => {
  assert.deepEqual(importEffects, { network: 0, storage: 0, dependency: 0 });
  const ui = mount(), before = structuredClone({ batches: ui.props.batches, groups: ui.props.groups }), first = card(ui.renderer, 1);
  assert.equal(groupLabel(first).props.value, 'First supply'); assert.equal(allocation(first).props.value, ''); assert.equal(pack(first).props.value, '0');
  const options = membership(first); assert.equal(options.length, 3);
  assert.deepEqual(options.map(node => node.props.checked), [true, false, false], 'identical visible labels do not establish shared batch identity');
  assert.equal(confirmation(first).props.checked, false);
  assert.match(ui.text(), /Enter whole seed counts without separators/); assert.match(ui.text(), /Leave blank if unknown/);
  assert.match(ui.text(), /Planning inputs only/); assert.match(ui.text(), /does not record seed stock, place an order or save a nursery plan/);
  assert.match(ui.text(), /planning assertion/i); assert.match(ui.text(), /does not verify|not verif/i);
  for (const control of ui.renderer.root.findAllByType('input')) {
    labelFor(control);
    if (control.props.type === 'text') assert.match(control.props.className, /min-h-11/);
    else assert.match(labelFor(control).props.className, /min-h-11|min-h-12|py-3/);
  }
  assert.equal(allocation(first).props.inputMode, 'numeric'); assert.equal(pack(first).props.inputMode, 'numeric');
  for (const control of ui.renderer.root.findAllByType('button')) { assert.equal(control.props.type, 'button'); assert.match(control.props.className, /min-h-11/); }
  noPrivate(ui.renderer); assert.deepEqual({ batches: ui.props.batches, groups: ui.props.groups }, before);
  assert.equal(Object.isFrozen(ui.props.groups), false);
});

test('blank, zero, large, fractional and comma seed text is emitted unchanged and remains controlled by parent props', () => {
  const ui = mount(), before = structuredClone(ui.props.groups), first = card(ui.renderer, 1);
  for (const value of ['', '0', '9007199254740993', '1.25', '1,234', ' 0005 ', '-1', '1e3']) {
    act(() => allocation(first).props.onChange({ target: { value } }));
    assert.deepEqual(ui.changes.at(-1), { id: 'private-group-first', patch: { allocatedToPlanSeedsText: value } });
    act(() => pack(first).props.onChange({ target: { value } }));
    assert.deepEqual(ui.changes.at(-1), { id: 'private-group-first', patch: { seedsPerPackText: value } });
  }
  const rawLabel = '  My optional supply  ';
  act(() => groupLabel(first).props.onChange({ target: { value: rawLabel } }));
  assert.deepEqual(ui.changes.at(-1), { id: 'private-group-first', patch: { label: rawLabel } });
  assert.equal(allocation(first).props.value, ''); assert.equal(pack(first).props.value, '0'); assert.equal(groupLabel(first).props.value, 'First supply');
  assert.deepEqual(ui.props.groups, before);
  ui.update({ groups: ui.props.groups.map((group, index) => index ? group : { ...group, label: rawLabel, allocatedToPlanSeedsText: '1,234', seedsPerPackText: '' }) });
  const updated = card(ui.renderer, 1);
  assert.equal(groupLabel(updated).props.value, rawLabel); assert.equal(allocation(updated).props.value, '1,234'); assert.equal(pack(updated).props.value, '');
  noPrivate(ui.renderer);
});

test('a batch selection emits a new isolated array without repairing duplicates, unknown membership or cross-group overlap', () => {
  const ui = mount(), first = card(ui.renderer, 1), before = structuredClone(ui.props.groups), original = ui.props.groups[0].batchIds;
  act(() => membership(first)[1].props.onChange({ target: { checked: true } }));
  const added = ui.changes.at(-1); assert.ok(added);
  assert.equal(added.id, 'private-group-first'); assert.deepEqual(added.patch, { batchIds: [...original, 'private-batch-b'] });
  assert.notEqual(added.patch.batchIds, original); assert.deepEqual(ui.props.groups, before);
  assert.equal(ui.props.groups[1].batchIds.includes('private-batch-b'), true, 'the other group is not silently edited');
  assert.equal(Object.hasOwn(added.patch, 'interchangeabilityConfirmed'), false);
  act(() => membership(first)[0].props.onChange({ target: { checked: false } }));
  assert.deepEqual(ui.changes.at(-1), { id: 'private-group-first', patch: { batchIds: ['private-unknown-membership'] } });
  assert.notEqual(ui.changes.at(-1)!.patch.batchIds, original);
  assert.deepEqual(ui.props.groups, before); assert.equal(ui.removed.length, 0); assert.equal(ui.added, 0);
  assert.deepEqual(ui.changes.map(change => change.id), ['private-group-first', 'private-group-first']);
});

test('interchangeability changes only after its explicit checkbox event and does not grant stock or source approval', () => {
  const ui = mount(), first = card(ui.renderer, 1), before = structuredClone(ui.props.groups);
  act(() => confirmation(first).props.onChange({ target: { checked: true } }));
  assert.deepEqual(ui.changes.at(-1), { id: 'private-group-first', patch: { interchangeabilityConfirmed: true } });
  act(() => confirmation(first).props.onChange({ target: { checked: false } }));
  assert.deepEqual(ui.changes.at(-1), { id: 'private-group-first', patch: { interchangeabilityConfirmed: false } });
  assert.equal(confirmation(first).props.checked, false); assert.deepEqual(ui.props.groups, before);
  noPrivate(ui.renderer);
});

test('disabled controls synchronously block every callback even when their handlers are invoked directly', () => {
  const ui = mount({ disabled: true }), before = structuredClone({ batches: ui.props.batches, groups: ui.props.groups });
  for (const input of ui.renderer.root.findAllByType('input')) {
    assert.equal(isDisabled(input), true);
    act(() => input.props.onChange({ target: { value: '99', checked: true } }));
  }
  for (const action of ui.renderer.root.findAllByType('button')) {
    assert.equal(isDisabled(action), true); act(() => action.props.onClick());
  }
  assert.deepEqual(ui.changes, []); assert.deepEqual(ui.removed, []); assert.equal(ui.added, 0);
  assert.deepEqual({ batches: ui.props.batches, groups: ui.props.groups }, before); noPrivate(ui.renderer);
});

test('empty saved-batch choices block Add without pretending there are known seed counts or a saved source', () => {
  const ui = mount({ batches: [] }), add = button(ui.renderer.root, 'Add supply group');
  assert.equal(isDisabled(add), true); act(() => add.props.onClick()); assert.equal(ui.added, 0);
  assert.match(ui.text(), /No saved nursery batches are available for this review/);
  assert.equal(membership(card(ui.renderer, 1)).length, 0); assert.deepEqual(ui.changes, []); assert.deepEqual(ui.removed, []);
  assert.doesNotMatch(ui.text(), /source verified|seed stock recorded|order placed/i); noPrivate(ui.renderer);
});

test('Add and removal emit only their controlled callbacks without silently changing groups, plan or inventory', () => {
  const ui = mount(), before = structuredClone(ui.props.groups);
  act(() => button(ui.renderer.root, 'Add supply group').props.onClick()); assert.equal(ui.added, 1);
  act(() => button(card(ui.renderer, 2), 'Remove supply group from this review').props.onClick());
  assert.deepEqual(ui.removed, ['private-group-second']); assert.deepEqual(ui.changes, []); assert.deepEqual(ui.props.groups, before);
  const actions = ui.renderer.root.findAllByType('button').map(text);
  assert.equal(actions.filter(name => name === 'Add supply group').length, 1);
  assert.equal(actions.filter(name => name === 'Remove supply group from this review').length, ui.props.groups.length);
  assert.equal(actions.every(name => name === 'Add supply group' || name === 'Remove supply group from this review'), true);
  for (const action of ui.renderer.root.findAllByType('button')) assert.equal(action.props.type, 'button');
  assert.equal(ui.renderer.root.findAllByType('a').length, 0);
});

test('batch and group labels remain escaped ordinary text, with immutable supplied data and no executable markup', () => {
  const label = '<img src=x onerror="fetch(1)"><script>orderPlaced=true</script>';
  const ui = mount({ batches: [{ id: 'private-hostile-label-batch', label }], groups: [{ ...groups()[0], label }] });
  const before = structuredClone({ batches: ui.props.batches, groups: ui.props.groups });
  assert.ok(ui.text().includes(label)); assert.equal(groupLabel(card(ui.renderer, 1)).props.value, label);
  for (const tag of ['script', 'img', 'iframe'] as const) assert.equal(ui.renderer.root.findAllByType(tag).length, 0);
  assert.equal(ui.renderer.root.findAll(node => Object.hasOwn(node.props, 'dangerouslySetInnerHTML')).length, 0);
  assert.deepEqual({ batches: ui.props.batches, groups: ui.props.groups }, before); noPrivate(ui.renderer);
});
