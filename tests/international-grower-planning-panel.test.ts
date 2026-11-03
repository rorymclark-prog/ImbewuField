import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { normaliseGrowerPlanningProfile, type GrowerPlanningProfile, type GrowerPlanningScope } from '../lib/international/grower-planning.ts';
import type { PlanBed } from '../lib/crop-plan.ts';
import type { GrowerPlanningPanelProps } from '../components/crops/GrowerPlanningPanel.tsx';

const hooks = registerHooks({
  load(url, context, next) {
    if (url.endsWith('/components/crops/GrowerPlanningPanel.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Panel } = await import('../components/crops/GrowerPlanningPanel.tsx');
after(() => hooks.deregister());
const scope: GrowerPlanningScope = { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' };
const foreignScope: GrowerPlanningScope = { kind: 'mapped-site', siteId: 'site:2.00000,2.00000' };
const beds: PlanBed[] = [{ id: 'measured-fixture', label: 'Measured fixture', areaM2: 12 }];
const crop = CROPS[0];
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function mount(initialProfiles: GrowerPlanningProfile[] = [], initialScope: GrowerPlanningScope | null = scope) {
  let renderer!: ReactTestRenderer;
  let profiles = structuredClone(initialProfiles);
  const attempts: GrowerPlanningProfile[][] = [];
  let fail = false;
  const props: GrowerPlanningPanelProps = {
    scope: initialScope, profiles, beds,
    onSaveProfiles(next) {
      attempts.push(structuredClone(next));
      if (fail) return false;
      profiles = structuredClone(next); props.profiles = profiles;
      renderer.update(React.createElement(Panel, props));
      return true;
    },
  };
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const field = (label: string) => {
    const found = renderer.root.findAllByType('label').find(node => node.children[0] === label || node.children.some(child => child === label));
    assert.ok(found, `Missing field: ${label}`);
    return found.findAll(node => node.type === 'input' || node.type === 'select')[0];
  };
  const click = (label: string) => {
    const found = renderer.root.findAllByType('button').find(node => text(node) === label);
    assert.ok(found, `Missing action: ${label}`); act(() => found.props.onClick());
  };
  return {
    renderer, props, attempts, field, click,
    text: () => text(renderer.root),
    get profiles() { return profiles; },
    set fail(value: boolean) { fail = value; },
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    check(label: string, checked = true) { act(() => field(label).props.onChange({ target: { checked } })); },
    submit() { act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })); },
    update(values: Partial<GrowerPlanningPanelProps>) { Object.assign(props, values); act(() => renderer.update(React.createElement(Panel, props))); },
    dispose() { act(() => renderer.unmount()); },
  };
}
function fill(ui: ReturnType<typeof mount>, transplant = true) {
  ui.change('Crop identity', crop.key);
  ui.change('Establishment method', transplant ? 'transplant' : 'direct');
  for (const [label, value] of [
    ['Plant density (plants per m²)', '4'], ['Harvest weight (kg per m² per cycle)', '0'],
    ['Field entry to first harvest (days)', '20'], ['Picking duration (days)', '5'],
    ['Field occupancy (days)', '25'], ['Turnaround after clearing (days)', '0'],
  ]) ui.change(label, value);
  if (transplant) ui.change('Nursery duration (days)', '10');
  ui.check('I specify the allowed field-entry months'); ui.check('Dec');
  ui.check('I supply these as my estimates');
  ui.change('Measured bed', beds[0].id); ui.change('Planned field-entry date (UTC)', '2026-12-01');
}

test('a new global profile has no catalogue agronomy, date, method, month or measured-bed defaults', () => {
  const ui = mount(); try {
    for (const input of ui.renderer.root.findAllByType('input')) {
      if (input.props.type === 'checkbox') assert.equal(input.props.checked, false);
      else assert.equal(input.props.value, '');
    }
    for (const label of ['Crop identity', 'Establishment method', 'Measured bed']) assert.equal(ui.field(label).props.value, '');
    ui.submit(); assert.equal(ui.attempts.length, 0); assert.match(ui.text(), /Confirm that you supply/);
    assert.doesNotMatch(ui.text(), /Estimated plants:/);
  } finally { ui.dispose(); }
});

test('partial profiles save explicit missing inputs and actual grower-estimate provenance, preserving other scopes', () => {
  const first = mount(); let other!: GrowerPlanningProfile;
  try { fill(first); first.submit(); other = { ...first.profiles[0], profileId: 'another-scope', scope: foreignScope }; } finally { first.dispose(); }
  const ui = mount([other]); try {
    const before = new Date().toISOString(); ui.change('Crop identity', crop.key); ui.change('Harvest weight (kg per m² per cycle)', '0');
    ui.check('I supply these as my estimates'); ui.submit(); const after = new Date().toISOString();
    assert.equal(ui.profiles.length, 2); assert.deepEqual(ui.profiles[0], other);
    const saved = ui.profiles[1]; assert.ok(normaliseGrowerPlanningProfile(saved));
    assert.deepEqual(saved.inputs.plantsPerM2, { state: 'missing', reason: 'not-entered' });
    assert.deepEqual(saved.inputs.allowedEntryMonths, { state: 'missing', reason: 'not-entered' });
    assert.equal(saved.inputs.yieldKgPerM2.state, 'provided');
    if (saved.inputs.yieldKgPerM2.state === 'provided') {
      assert.equal(saved.inputs.yieldKgPerM2.value, 0); assert.equal(saved.inputs.yieldKgPerM2.provenance.kind, 'grower-estimate');
      assert.ok(saved.inputs.yieldKgPerM2.provenance.recordedAt >= before && saved.inputs.yieldKgPerM2.provenance.recordedAt <= after);
    }
    assert.match(ui.text(), /Profile saved on this device/);
    ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Missing inputs/); assert.match(ui.text(), /Measured bed area/);
  } finally { ui.dispose(); }
});

test('real arithmetic uses only the chosen measured area and estimates, retains zero and shows UTC dates', () => {
  const ui = mount(); try {
    fill(ui); const before = structuredClone(beds); ui.click('Review estimated capacity and dates');
    assert.match(ui.text(), /Estimated plants: 48/); assert.match(ui.text(), /Estimated harvest weight per cycle: 0 kg/);
    for (const date of ['2026-11-21', '2026-12-01', '2026-12-21', '2026-12-26']) assert.ok(ui.text().includes(date));
    assert.match(ui.text(), /Picking ends \(exclusive\) \(UTC\)/); assert.match(ui.text(), /Density is not layout clearance/);
    assert.match(ui.text(), /No crop has been added/); assert.equal(ui.attempts.length, 0); assert.deepEqual(beds, before);
    ui.change('Plant density (plants per m²)', '5'); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 60/);
    ui.update({ beds: [{ ...beds[0], areaM2: 0 }] }); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 0/);
    assert.match(ui.text(), /Measured area: 0 m²/);
  } finally { ui.dispose(); }
});

test('invalid supplied numbers, incomplete transplants and explicit empty windows are never replaced by catalogue values', () => {
  const ui = mount(); try {
    fill(ui); ui.change('Plant density (plants per m²)', '-1'); ui.submit(); assert.equal(ui.attempts.length, 0); assert.match(ui.text(), /finite and non-negative/);
    ui.change('Plant density (plants per m²)', '0'); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Invalid inputs/);
    assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.equal(ui.field('Plant density (plants per m²)').props.value, '0');
    ui.change('Plant density (plants per m²)', '4'); ui.change('Nursery duration (days)', ''); ui.click('Review estimated capacity and dates');
    assert.match(ui.text(), /Missing inputs/); assert.match(ui.text(), /Nursery duration/);
    ui.change('Establishment method', 'direct'); ui.check('Dec', false); ui.click('Review estimated capacity and dates');
    assert.match(ui.text(), /Field-entry date outside your allowed window/);
    ui.check('Dec'); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Not applicable: direct in field/);
    ui.change('Field occupancy (days)', '24'); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Invalid inputs/);
  } finally { ui.dispose(); }
});

test('saved estimates reload, edit and remove through truthful device callbacks without replacing unrelated profiles', () => {
  let saved: GrowerPlanningProfile[] = []; const first = mount(); try { fill(first); first.submit(); saved = structuredClone(first.profiles); } finally { first.dispose(); }
  const ui = mount(saved); try {
    ui.click(`Edit ${crop.name}`); assert.equal(ui.field('Harvest weight (kg per m² per cycle)').props.value, '0');
    assert.equal(ui.field('I supply these as my estimates').props.checked, false); ui.submit(); assert.equal(ui.attempts.length, 0);
    ui.check('I supply these as my estimates'); ui.change('Plant density (plants per m²)', '6');
    ui.fail = true; ui.submit(); assert.match(ui.text(), /Could not save on this device/); assert.deepEqual(ui.profiles, saved);
    assert.equal(ui.field('Plant density (plants per m²)').props.value, '6');
    ui.fail = false; ui.submit(); assert.equal(ui.profiles.length, 1); assert.equal(ui.profiles[0].profileId, saved[0].profileId);
    ui.fail = true; ui.click(`Remove ${crop.name}`); assert.equal(ui.profiles.length, 1); assert.match(ui.text(), /Could not save/);
    ui.fail = false; ui.click(`Remove ${crop.name}`); assert.deepEqual(ui.profiles, []); assert.match(ui.text(), /Profile removed on this device/);
  } finally { ui.dispose(); }
});

test('switching scope holds stale save and review callbacks and resets all agronomic inputs', () => {
  const ui = mount(); try {
    fill(ui); const staleSave = ui.renderer.root.findByType('form').props.onSubmit;
    const staleReview = ui.renderer.root.findAllByType('button').find(node => text(node) === 'Review estimated capacity and dates')!.props.onClick;
    ui.update({ scope: foreignScope });
    act(() => { staleSave({ preventDefault() {} }); staleReview(); });
    assert.equal(ui.attempts.length, 0); assert.equal(ui.field('Plant density (plants per m²)').props.value, '');
    assert.equal(ui.field('Planned field-entry date (UTC)').props.value, ''); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    fill(ui, false); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 48/);
    ui.update({ scope: null }); assert.match(ui.text(), /Choose a current site or unmapped workspace first/);
    assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.ok(ui.renderer.root.findAllByType('button').filter(node => ['Save estimate profile', 'Review estimated capacity and dates'].includes(text(node))).every(node => node.props.disabled));
  } finally { ui.dispose(); }
});

test('missing or ambiguous beds cannot borrow an area and a removed measured bed invalidates the visible review', () => {
  const ui = mount(); try {
    fill(ui); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 48/);
    ui.update({ beds: [{ ...beds[0] }, { ...beds[0], areaM2: 999 }] });
    assert.doesNotMatch(ui.text(), /Estimated plants:/); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Missing inputs/);
    assert.match(ui.text(), /Measured bed area/); assert.equal(ui.field('Measured bed').findAllByType('option').length, 1);
    ui.update({ beds: [] }); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Missing inputs/);
  } finally { ui.dispose(); }
});
