import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { buildNurseryForecast } from '../lib/crop-export-schedule.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import type { NurseryPlanPanelProps } from '../components/crops/NurseryPlanPanel.tsx';

const probe = { forecasts: 0, deliveries: 0, forbidden: false, buildNurseryForecast };
Object.assign(globalThis, { __internationalNurseryEquipment: probe });
const root = new URL('../', import.meta.url).href;
// The real component and forms run here. Only the external delivery boundary and
// forecast call are observed, so an unsupported-mode calculation can fail the test.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/components/crops/NurseryPlanPanel.tsx')) {
      if (specifier === '@/lib/crop-export-schedule') return { shortCircuit: true,
        url: 'data:text/javascript,' + encodeURIComponent(`export function buildNurseryForecast(...args) {
          const probe = globalThis.__internationalNurseryEquipment;
          probe.forecasts++;
          if (probe.forbidden) throw Error('Unsupported catalogue forecast executed');
          return probe.buildNurseryForecast(...args);
        }`) };
      if (specifier === '@/lib/file-delivery') return { shortCircuit: true,
        url: 'data:text/javascript,' + encodeURIComponent(`export async function deliverFile() {
          globalThis.__internationalNurseryEquipment.deliveries++;
          return 'downloaded';
        }`) };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return nextLoad(url, context);
  },
});
const { default: NurseryPlanPanel } = await import('../components/crops/NurseryPlanPanel.tsx');
after(() => { hooks.deregister(); Reflect.deleteProperty(globalThis, '__internationalNurseryEquipment'); });

function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}

function mount(settings?: NurserySettings, allowCatalogueForecast?: boolean) {
  const originals = new Map(['window', 'localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = () => {
    const rows = new Map<string, string>();
    return { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); }, removeItem: (key: string) => { rows.delete(key); } };
  };
  const localStorage = storage(), sessionStorage = storage();
  const browser = Object.assign(new EventTarget(), { localStorage, sessionStorage });
  for (const [key, value] of Object.entries({ window: browser, localStorage, sessionStorage })) Object.defineProperty(globalThis, key, { configurable: true, value });
  let renderer: ReactTestRenderer;
  let currentSettings = settings;
  let receipt: boolean | undefined = true;
  const saved: NurserySettings[] = [];
  const props: NurseryPlanPanelProps = {
    siteId: 'fictional-site', plantings: [], beds: [], now: { year: 2026, month: 11 },
    settings: currentSettings, allowCatalogueForecast, showBuyingCalendar: true,
    onSettings(next) {
      if (receipt === false) return false;
      saved.push(structuredClone(next)); currentSettings = next;
      renderer.update(React.createElement(NurseryPlanPanel, { ...props, settings: currentSettings }));
      // The real editor now distinguishes a device-write receipt from a queued callback.
      return receipt;
    },
  };
  act(() => { renderer = create(React.createElement(NurseryPlanPanel, props)); });
  const field = (prefix: string) => {
    const label = renderer.root.findAllByType('label').find(node => typeof node.children[0] === 'string' && node.children[0].startsWith(prefix));
    assert.ok(label, `Missing grower input: ${prefix}`);
    return label.findAll(node => node.type === 'input' || node.type === 'select')[0];
  };
  return {
    get renderer() { return renderer; }, saved,
    set receipt(value: boolean | undefined) { receipt = value; },
    text: () => text(renderer.root),
    field,
    change(prefix: string, value: string) { act(() => field(prefix).props.onChange({ target: { value } })); },
    submit(button: string) {
      const form = renderer.root.findAllByType('form').find(node => node.findAllByType('button').some(candidate => text(candidate) === button));
      assert.ok(form, `Missing grower save: ${button}`);
      act(() => form.props.onSubmit({ preventDefault() {} }));
    },
    mode(allow: boolean) {
      props.allowCatalogueForecast = allow;
      act(() => renderer.update(React.createElement(NurseryPlanPanel, { ...props, settings: currentSettings })));
    },
    dispose() {
      act(() => renderer.unmount());
      for (const [key, original] of originals) {
        if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('unsupported nursery context never computes catalogue demand or offers forecast exports and task links', () => {
  probe.forecasts = 0; probe.deliveries = 0; probe.forbidden = true;
  const screen = mount(undefined, false);
  try {
    assert.equal(probe.forecasts, 0);
    assert.match(screen.text(), /Demand forecasts are unavailable until this site has a supported local planning basis/);
    assert.equal(screen.renderer.root.findAllByType('a').length, 0);
    assert.equal(screen.renderer.root.findAllByType('button').some(node => /CSV/.test(text(node))), false);
    assert.equal(screen.renderer.root.findAll(node => node.props.id === 'nursery-seed-needs').length, 0);
    assert.equal(screen.field('Your nursery duration').props.placeholder, 'Unknown');
    assert.doesNotMatch(screen.text(), /Peak concurrent|source timing envelope|Open task planner|Review seeds and equipment to source/);
    assert.equal(probe.deliveries, 0);
  } finally { screen.dispose(); probe.forbidden = false; }
});

test('a nursery recipe needs an explicit propagation model rather than an assumed seed per cell', () => {
  const screen = mount(undefined, false);
  try {
    assert.equal(screen.field('Nursery model').props.value, '');
    screen.change('Crop identity for nursery recipe', CROPS[0].key);
    screen.submit('Save crop recipe');
    assert.equal(screen.saved.length, 0);
    assert.match(screen.text(), /Choose your propagation model/);
  } finally { screen.dispose(); }
});

test('own propagation records preserve a flat without cells and observed zero output for an existing crop identity', () => {
  // Synthetic equipment observations, not tray recommendations or crop instructions.
  const crop = CROPS.find(candidate => !candidate.transplant)!;
  const screen = mount(undefined, false);
  try {
    screen.change('Container name', 'Observed flat'); screen.change('Owned containers', '0'); screen.submit('Add container type');
    assert.equal(screen.saved.at(-1)!.containers[0].cells, undefined);
    assert.equal(screen.saved.at(-1)!.containers[0].owned, 0);
    screen.change('Crop identity for nursery recipe', crop.key); screen.change('Nursery model', 'measured-tray');
    screen.change('Your usable starts per tray', '0'); screen.submit('Save crop recipe');
    const recipe = screen.saved.at(-1)!.profiles[0];
    assert.equal(recipe.cropKey, crop.key); assert.equal(recipe.usableStartsPerTray, 0);
    assert.equal(recipe.fieldSurvivalPercent, undefined);
    assert.match(screen.text(), /Field survival: unknown/);
  } finally { screen.dispose(); }
});

test('a failed equipment write retains the editor and never reports a completed device save', () => {
  const screen = mount(undefined, false);
  try {
    screen.receipt = false;
    screen.change('Space name', 'Unsaved bench'); screen.change('Net usable surface', '0'); screen.submit('Add nursery space');
    assert.equal(screen.saved.length, 0);
    assert.equal(screen.field('Space name').props.value, 'Unsaved bench');
    assert.equal(screen.field('Net usable surface').props.value, '0');
    assert.match(screen.text(), /Could not save on this device/);
    assert.doesNotMatch(screen.text(), /Nursery space saved for this site|Saved on this device\./);
  } finally { screen.dispose(); }
});

test('a callback without a receipt does not certify a device save', () => {
  const screen = mount(undefined, false);
  try {
    screen.receipt = undefined;
    screen.change('Space name', 'Queued bench'); screen.change('Net usable surface', '0'); screen.submit('Add nursery space');
    assert.equal(screen.saved.length, 1);
    assert.match(screen.text(), /Device save is not confirmed/);
    assert.doesNotMatch(screen.text(), /Saved on this device\./);
  } finally { screen.dispose(); }
});

test('unsupported growers can save equipment and their own recipes without inventing demand or overwriting another site', () => {
  const crop = CROPS.find(candidate => candidate.transplant)!;
  const other: NurserySettings = { version: 1,
    spaces: [{ id: 'other-space', siteId: 'other-site', name: 'Other surface', usableM2: 7 }],
    containers: [{ id: 'other-tray', siteId: 'other-site', name: 'Other tray', cells: 20 }],
    profiles: [{ id: 'other-recipe', siteId: 'other-site', cropKey: crop.key, model: 'measured-tray', usableStartsPerTray: 12 }],
  };
  probe.forecasts = 0; probe.forbidden = true;
  const screen = mount(other, false);
  try {
    screen.change('Space name', 'My bench'); screen.change('Net usable surface', '2.5'); screen.submit('Add nursery space');
    assert.match(screen.text(), /Nursery space saved for this site/);
    screen.change('Container name', 'My tray'); screen.change('Cells per container', '24'); screen.change('Owned containers', '0'); screen.submit('Add container type');
    assert.match(screen.text(), /Nursery container saved for this site/);
    screen.change('Crop identity for nursery recipe', crop.key); screen.change('Nursery model', 'measured-tray');
    screen.change('Your usable starts per tray', '18'); screen.change('Your nursery duration', '4'); screen.submit('Save crop recipe');
    assert.match(screen.text(), /Crop nursery recipe saved for this site/);
    assert.equal(screen.saved.length, 3);
    const result = screen.saved.at(-1)!;
    assert.deepEqual(result.spaces.filter(row => row.siteId === 'other-site'), other.spaces);
    assert.deepEqual(result.containers.filter(row => row.siteId === 'other-site'), other.containers);
    assert.deepEqual(result.profiles.filter(row => row.siteId === 'other-site'), other.profiles);
    assert.deepEqual(result.spaces.filter(row => row.siteId === 'fictional-site').map(({ name, usableM2 }) => ({ name, usableM2 })), [{ name: 'My bench', usableM2: 2.5 }]);
    const tray = result.containers.find(row => row.siteId === 'fictional-site')!;
    assert.equal(tray.owned, 0); assert.equal(tray.cells, 24); assert.equal(tray.widthCm, undefined); assert.equal(tray.lengthCm, undefined);
    const recipe = result.profiles.find(row => row.siteId === 'fictional-site')!;
    assert.equal(recipe.model, 'measured-tray'); assert.equal(recipe.usableStartsPerTray, 18); assert.equal(recipe.nurseryWeeks, 4);
    assert.equal(recipe.fieldSurvivalPercent, undefined);
    assert.equal(probe.forecasts, 0);
    assert.equal(probe.deliveries, 0);
  } finally { screen.dispose(); probe.forbidden = false; }
});

test('supported default retains the existing forecast and navigation while losing support removes them immediately', async () => {
  probe.forecasts = 0; probe.deliveries = 0;
  const screen = mount();
  try {
    assert.ok(probe.forecasts > 0, 'the existing default still computes its nursery forecast');
    assert.equal(screen.renderer.root.findAllByType('a').find(node => text(node) === 'Open task planner')?.props.href, '/cropplan');
    const csv = screen.renderer.root.findAllByType('button').find(node => text(node) === 'Download nursery CSV');
    assert.ok(csv);
    await act(async () => { await csv.props.onClick(); });
    assert.equal(probe.deliveries, 1);
    const before = probe.forecasts;
    probe.forbidden = true;
    screen.mode(false);
    assert.equal(probe.forecasts, before);
    assert.equal(screen.renderer.root.findAllByType('a').length, 0);
    assert.equal(screen.renderer.root.findAllByType('button').some(node => /CSV/.test(text(node))), false);
    assert.doesNotMatch(screen.text(), /CSV downloaded/);
    assert.match(screen.text(), /Demand forecasts are unavailable/);
  } finally { screen.dispose(); probe.forbidden = false; }
});
