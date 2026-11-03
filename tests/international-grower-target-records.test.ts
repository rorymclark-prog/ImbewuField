import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS, hasAutomaticPlanningBasis } from '../lib/crop-catalog.ts';
import type { HarvestTarget } from '../lib/crop-plan.ts';

const probe = { forbidden: true, assessments: 0, suggestions: 0, forecasts: 0, dateDefaults: 0, catalogueFilters: 0 };
const prior = Object.getOwnPropertyDescriptor(globalThis, '__growerTargetRecords');
Object.assign(globalThis, { __growerTargetRecords: probe });
const root = new URL('../', import.meta.url).href;
const moduleUrl = (source: string) => ({ shortCircuit: true, url: `data:text/javascript,${encodeURIComponent(source)}` });
function observed(name: keyof typeof probe, actual: string) {
  return `(...args)=>{const p=globalThis.__growerTargetRecords;p.${name}++;if(p.forbidden)throw Error('Own records invoked catalogue ${name}');return ${actual}(...args)}`;
}
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/crops/HarvestTargetsPanel.tsx')) {
      if (specifier === '@/lib/harvest-targets') return moduleUrl(`
        import {assessHarvestTarget as assess,targetMonthStamp as stamp,HARVEST_TARGET_BASIS} from ${JSON.stringify(new URL('../lib/harvest-targets.ts', import.meta.url).href)};
        export {HARVEST_TARGET_BASIS};export const assessHarvestTarget=${observed('assessments', 'assess')};export const targetMonthStamp=${observed('dateDefaults', 'stamp')};`);
      if (specifier === '@/lib/crop-autosuggest') return moduleUrl(`
        import {suggestHarvestTargets as suggest} from ${JSON.stringify(new URL('../lib/crop-autosuggest.ts', import.meta.url).href)};
        export const suggestHarvestTargets=${observed('suggestions', 'suggest')};`);
      if (specifier === '@/lib/crop-export-schedule') return moduleUrl(`
        import {buildNurseryForecast as forecast} from ${JSON.stringify(new URL('../lib/crop-export-schedule.ts', import.meta.url).href)};
        export const buildNurseryForecast=${observed('forecasts', 'forecast')};`);
      if (specifier === '@/lib/crop-catalog') return moduleUrl(`
        import {CROPS,cropByKey,MONTHS_SHORT,hasPlanningYield as filter} from ${JSON.stringify(new URL('../lib/crop-catalog.ts', import.meta.url).href)};
        export {CROPS,cropByKey,MONTHS_SHORT};export const hasPlanningYield=${observed('catalogueFilters', 'filter')};`);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Panel } = await import('../components/crops/HarvestTargetsPanel.tsx');
type Props = React.ComponentProps<typeof Panel>;
after(() => { hooks.deregister(); if (prior) Object.defineProperty(globalThis, '__growerTargetRecords', prior); else Reflect.deleteProperty(globalThis, '__growerTargetRecords'); });
test.beforeEach(() => { Object.assign(probe, { forbidden: true, assessments: 0, suggestions: 0, forecasts: 0, dateDefaults: 0, catalogueFilters: 0 }); });

// All quantities, dates and locations here are engineering fixtures only.
const siteId = 'site:0.00000,0.00000', otherSite = 'site:1.00000,1.00000';
const crop = CROPS.find(candidate => candidate.transplant && hasAutomaticPlanningBasis(candidate))!;
assert.ok(crop, 'the positive legacy fixture needs an existing supported identity');
const target = (id = 'own-target', site = siteId): HarvestTarget => ({ id, siteId: site,
  cropKey: crop.key, weeklyKg: 7, startMonth: '2028-02', endMonth: '2028-02' });
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function mount(initial: HarvestTarget[] = [], basis: Props['basis'] | 'default' = 'own-records') {
  let renderer!: ReactTestRenderer, records = structuredClone(initial), receipt = true, throwSave = false;
  const attempts: HarvestTarget[][] = [], accepts: unknown[] = [];
  let fallbackCalls = 0;
  const props: Props = { basis: basis === 'default' ? undefined : basis, siteId, targets: records, beds: [{ id: 'bed-a', label: 'Fixture bed', areaM2: 12 }],
    plantings: [], pattern: 'mild-frost', climate: {}, onTargets(next) {
      fallbackCalls++;
      if (basis === 'own-records') throw Error('Own records used an unconfirmed legacy writer');
      records = structuredClone(next); props.targets = records; renderer.update(React.createElement(Panel, props));
    }, onSaveTargets(next) {
      attempts.push(structuredClone(next));
      if (throwSave) throw Error('synthetic save failure');
      if (!receipt) return false;
      records = structuredClone(next); props.targets = records; renderer.update(React.createElement(Panel, props)); return true;
    }, onAccept(result) { accepts.push(result); } };
  if (basis !== 'own-records') delete props.onSaveTargets;
  act(() => { renderer = create(React.createElement(Panel, props)); });
  function field(prefix: string) {
    const label = renderer.root.findAllByType('label').find(node => typeof node.children[0] === 'string' && node.children[0].trim().startsWith(prefix));
    assert.ok(label, `Missing target input: ${prefix}`);
    return label.findAll(node => node.type === 'input' || node.type === 'select')[0];
  }
  function click(label: string) {
    const button = renderer.root.findAllByType('button').find(node => text(node) === label || node.props['aria-label'] === label);
    assert.ok(button, `Missing target action: ${label}`); act(() => button.props.onClick());
  }
  return { props, attempts, accepts, field, click, get records() { return records; }, get fallbackCalls() { return fallbackCalls; },
    get renderer() { return renderer; }, set receipt(value: boolean) { receipt = value; }, set throwSave(value: boolean) { throwSave = value; },
    text: () => text(renderer.root), status: () => renderer.root.findAllByProps({ role: 'status' }).map(node => text(node)).join(' '),
    change(label: string, value: string) { act(() => {
      const event = { target: { value } }; field(label).props.onChange(event);
      // react-test-renderer has no DOM bubbling; invoke the real enclosing
      // form handler in the same child-to-parent order as the browser.
      renderer.root.findByType('form').props.onChange?.(event);
    }); },
    submit() { act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })); },
    dispose() { act(() => renderer.unmount()); } };
}
function fill(ui: ReturnType<typeof mount>, key = crop.key, unit = 'kg') {
  ui.change('Crop', key); ui.change('Weekly quantity', '7'); ui.change('Sales unit', unit);
  ui.change('First harvest month', '2028-02'); ui.change('Last harvest month', '2028-02');
}
function noCatalogueCalls() {
  assert.deepEqual({ assessments: probe.assessments, suggestions: probe.suggestions, forecasts: probe.forecasts,
    dateDefaults: probe.dateDefaults, catalogueFilters: probe.catalogueFilters },
  { assessments: 0, suggestions: 0, forecasts: 0, dateDefaults: 0, catalogueFilters: 0 });
}

test('own-record targets start with blank crop, quantity, harvest months and allowance without any catalogue calculation', () => {
  const ui = mount(); try {
    for (const label of ['Crop', 'Weekly quantity', 'First harvest month', 'Last harvest month', 'Saleable share']) assert.equal(ui.field(label).props.value, '');
    assert.equal(ui.field('Sales unit').props.value, 'kg', 'the visible sales unit is not an agronomic rate');
    assert.equal(ui.renderer.root.findAllByType('input').filter(node => node.props.type === 'checkbox').length, 0);
    assert.equal(ui.renderer.root.findAllByType('button').some(node => /Suggest target sowings|Add .*dated sowing/.test(text(node))), false);
    assert.doesNotMatch(ui.text(), /South African calendar|catalogue benchmark|Crop-cycle area needed|Benchmark before allowance/);
    ui.submit(); assert.equal(ui.attempts.length, 0); assert.match(ui.text(), /Choose a crop, positive quantity/);
    noCatalogueCalls();
  } finally { ui.dispose(); }
});

test('foreign-site own records create, edit and remove canonical targets through a positive device receipt while preserving other sites', () => {
  const other = target('other-target', otherSite), ui = mount([other]); try {
    fill(ui); ui.change('For', 'Synthetic buyer'); ui.submit();
    assert.equal(ui.records.length, 2); assert.deepEqual(ui.records.find(row => row.id === other.id), other);
    const created = ui.records.find(row => row.siteId === siteId)!; assert.ok(created.id); assert.equal(created.weeklyKg, 7);
    assert.equal(created.marketablePercent, undefined); assert.equal(created.outlet, 'Synthetic buyer');
    assert.match(ui.status(), /Buyer targets saved on this device/); assert.equal(ui.fallbackCalls, 0);
    ui.click('Edit'); ui.change('Weekly quantity', '14'); ui.submit();
    assert.equal(ui.records.find(row => row.id === created.id)!.weeklyKg, 14);
    assert.deepEqual(ui.records.find(row => row.id === other.id), other);
    ui.click(`Remove ${crop.name} target`);
    assert.deepEqual(ui.records, [other]); assert.equal(ui.accepts.length, 0); noCatalogueCalls();
  } finally { ui.dispose(); }
});

test('blank pack weight and saleable share remain absent on save and reload instead of becoming conversion or success defaults', () => {
  const first = mount(); let records: HarvestTarget[] = []; try {
    fill(first, crop.key, 'bunches'); assert.equal(first.field('Harvest kg per').props.value, '');
    first.submit(); records = structuredClone(first.records);
    assert.equal(records.length, 1); assert.equal(records[0].unit, 'bunches');
    assert.equal(records[0].kgPerUnit, undefined); assert.equal(records[0].marketablePercent, undefined);
    assert.equal(records[0].weeklyQuantity, 7); assert.equal(records[0].weeklyKg, undefined); noCatalogueCalls();
  } finally { first.dispose(); }
  const reloaded = mount(records); try {
    assert.match(reloaded.text(), /Saleable share: unknown/); reloaded.click('Edit');
    assert.equal(reloaded.field('Harvest kg per').props.value, ''); assert.equal(reloaded.field('Saleable share').props.value, '');
    noCatalogueCalls();
  } finally { reloaded.dispose(); }
});

test('entered zero saleable share is retained as zero while an invalid zero pack weight stays unsaved', () => {
  const ui = mount(); try {
    fill(ui, crop.key, 'bunches'); ui.change('Saleable share', '0'); ui.change('Harvest kg per', '0'); ui.submit();
    assert.equal(ui.attempts.length, 0); assert.match(ui.text(), /positive pack weight/);
    ui.change('Harvest kg per', ''); ui.submit(); assert.equal(ui.records[0].marketablePercent, 0);
    assert.equal(ui.records[0].kgPerUnit, undefined); assert.match(ui.text(), /Saleable share: 0%/); noCatalogueCalls();
  } finally { ui.dispose(); }
});

test('direct and zero-catalogue-yield identities stay selectable without importing their catalogue method or food status', () => {
  const direct = CROPS.find(candidate => !candidate.transplant && candidate.yieldKgPerM2 !== 0)!;
  const cover = CROPS.find(candidate => candidate.yieldKgPerM2 === 0)!;
  assert.ok(direct); assert.ok(cover);
  const ui = mount(); try {
    const options = ui.field('Crop').findAllByType('option').map(node => node.props.value);
    assert.ok(options.includes(direct.key)); assert.ok(options.includes(cover.key));
    for (const identity of [direct, cover]) { fill(ui, identity.key); ui.submit(); }
    assert.deepEqual(ui.records.map(row => row.cropKey), [direct.key, cover.key]);
    assert.ok(ui.records.every(row => row.weeklyKg === 7 && row.marketablePercent === undefined));
    assert.equal(ui.accepts.length, 0); noCatalogueCalls();
  } finally { ui.dispose(); }
});

test('failed target saves retain the edited form and previous records and withdraw any earlier success status', () => {
  for (const failure of ['false', 'throw'] as const) {
    const own = target(), other = target('other-target', otherSite), ui = mount([own, other]);
    try {
      ui.click('Edit'); ui.change('Weekly quantity', '14');
      if (failure === 'false') ui.receipt = false; else ui.throwSave = true;
      ui.submit(); assert.deepEqual(ui.records, [own, other]); assert.equal(ui.field('Weekly quantity').props.value, '14');
      assert.equal(ui.field('First harvest month').props.value, own.startMonth);
      assert.match(ui.text(), /Could not save these targets/); assert.equal(ui.status(), '');
      assert.ok(ui.renderer.root.findAllByType('button').some(node => text(node) === 'Save target changes'));
      ui.receipt = true; ui.throwSave = false; ui.submit();
      assert.equal(ui.records.find(row => row.id === own.id)!.weeklyKg, 14); assert.match(ui.status(), /saved on this device/);
      noCatalogueCalls();
    } finally { ui.dispose(); }
  }
});

test('a rejected stale removal retains the related unsaved editor and other-site records', () => {
  const own = target(), other = target('other-target', otherSite), ui = mount([own, other]); try {
    ui.click('Edit'); ui.change('Weekly quantity', '21');
    const remove = ui.renderer.root.findAllByType('button').find(node => node.props['aria-label'] === `Remove ${crop.name} target`)!.props.onClick;
    ui.receipt = false; act(() => remove());
    assert.deepEqual(ui.records, [own, other]); assert.equal(ui.field('Weekly quantity').props.value, '21');
    assert.equal(ui.status(), ''); assert.match(ui.text(), /Could not save these targets/);
    assert.ok(ui.renderer.root.findAllByType('button').some(node => text(node) === 'Save target changes')); noCatalogueCalls();
  } finally { ui.dispose(); }
});

test('a later invalid target does not retain a success receipt for the previous saved buyer', () => {
  const ui = mount(); try {
    fill(ui); ui.submit(); assert.match(ui.status(), /saved on this device/);
    const saved = structuredClone(ui.records);
    ui.submit(); assert.equal(ui.status(), '', 'submitting the untouched blank next form is not another successful save');
    fill(ui); ui.change('Weekly quantity', '0'); ui.submit();
    assert.deepEqual(ui.records, saved); assert.equal(ui.attempts.length, 1);
    assert.equal(ui.field('Weekly quantity').props.value, '0'); assert.match(ui.text(), /positive quantity/);
    assert.equal(ui.status(), ''); noCatalogueCalls();
  } finally { ui.dispose(); }
});

test('typing a new buyer draft clears the previous receipt before any further save attempt', () => {
  const ui = mount(); try {
    fill(ui); ui.submit(); assert.match(ui.status(), /saved on this device/);
    const saved = structuredClone(ui.records); ui.change('For', 'Uncommitted fixture buyer');
    assert.equal(ui.status(), ''); assert.equal(ui.attempts.length, 1); assert.deepEqual(ui.records, saved);
    assert.equal(ui.field('For').props.value, 'Uncommitted fixture buyer'); noCatalogueCalls();
  } finally { ui.dispose(); }
});

test('starting another own-record target never silently inherits the previous buyer harvest dates', () => {
  const ui = mount(); try {
    fill(ui); ui.submit(); assert.equal(ui.records.length, 1);
    assert.equal(ui.field('Crop').props.value, ''); assert.equal(ui.field('First harvest month').props.value, '');
    assert.equal(ui.field('Last harvest month').props.value, '');
    ui.click('Edit'); ui.click('Cancel edit'); assert.equal(ui.field('First harvest month').props.value, '');
    assert.equal(ui.field('Last harvest month').props.value, ''); noCatalogueCalls();
  } finally { ui.dispose(); }
});

test('omitted basis retains the existing catalogue path and its real assessment, suggestion and nursery checks', () => {
  probe.forbidden = false;
  const ui = mount([target()], 'default'); try {
    assert.ok(probe.assessments > 0); assert.ok(probe.catalogueFilters > 0); assert.ok(probe.dateDefaults >= 2);
    assert.notEqual(ui.field('First harvest month').props.value, '');
    assert.match(ui.text(), /South African calendar/); assert.ok(ui.renderer.root.findAllByType('input').some(node => node.props.type === 'checkbox'));
    ui.click('Suggest target sowings'); assert.equal(probe.suggestions, 1); assert.ok(probe.forecasts > 0);
    assert.ok(ui.renderer.root.findAllByProps({ 'aria-label': 'Target sowing review' }).length > 0);
    assert.equal(ui.accepts.length, 0, 'legacy suggestions still need their separate explicit accept action');
  } finally { ui.dispose(); }
});
