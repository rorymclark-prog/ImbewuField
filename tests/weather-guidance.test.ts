import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { WeatherForecast } from '../lib/weather.ts';

const harness: { forecast: WeatherForecast | null } = { forecast: null };
Object.assign(globalThis, { __imbewuWeatherGuidance: harness, IS_REACT_ACT_ENVIRONMENT: true });
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const componentUrl = new URL('../components/WeatherWidget.tsx', import.meta.url).href;
const fakeWeather = moduleUrl(`
export const fetchWeatherForecast = async () => globalThis.__imbewuWeatherGuidance.forecast;
export const describeWeatherCode = () => ({ key: 'sun', label: 'Clear', icon: '' });
`);
const fakeArt = moduleUrl('export const getElementArt2 = () => null;');
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === componentUrl) {
      if (specifier === '@/lib/weather') return { url: fakeWeather, shortCircuit: true };
      if (specifier === '@/lib/element-art-2') return { url: fakeArt, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === componentUrl) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        fileName: 'WeatherWidget.tsx',
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    };
    return nextLoad(url, context);
  },
});
const { default: WeatherWidget } = await import('../components/WeatherWidget.tsx');
hooks.deregister();

function forecast(et0Mm: number | null): WeatherForecast {
  return {
    current: { tempC: 25, weatherCode: 0, windKph: 10 },
    daily: [{ date: '2026-10-15', tMaxC: 28, tMinC: 15, precipMm: 0, precipProbability: 0,
      windMaxKph: 15, weatherCode: 0, et0Mm, frostWarning: false, heatWarning: false, heavyRainWarning: false }],
  };
}

function text(node: any): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return (Array.isArray(node) ? node : node.children ?? []).map(text).join('');
}

async function render(value: WeatherForecast): Promise<ReactTestRenderer> {
  harness.forecast = value;
  let view!: ReactTestRenderer;
  await act(async () => { view = create(createElement(WeatherWidget, { lat: -28, lon: 31 })); });
  return view;
}

// The regression is the rendered instruction: a forecast-only value reached the farmer as an
// irrigation prescription. Checking a separate formatter would miss a caller still printing it.
test('a weather-only forecast cannot prescribe how much water the farmer should apply', async () => {
  const view = await render(forecast(7.1));
  try {
    const note = view.root.findByProps({ 'aria-label': 'Watering guidance' });
    const advice = text(note.findAllByType('p')[0]);
    assert.match(advice, /soil moisture/i);
    assert.match(advice, /crop.*growth stage.*rain/i);
    assert.doesNotMatch(advice, /\d|\bmm\b|water roughly|crops will lose/i);
    const detail = note.findByType('details');
    assert.notEqual(detail.props.open, true, 'reference data must not become the primary watering instruction');
    assert.match(text(detail), /Reference ETo: 7\.1 mm/);
    assert.match(text(detail), /weather estimate, not a watering amount/);
  } finally { await act(async () => view.unmount()); }
});

test('missing, invalid or absent daily reference data keeps watering guidance without a bogus quantity', async () => {
  const inputs = [null, Number.NaN, Number.POSITIVE_INFINITY, -1].map(forecast);
  inputs.push({ ...forecast(null), daily: [] });
  for (const value of inputs) {
    const view = await render(value);
    try {
      const note = view.root.findByProps({ 'aria-label': 'Watering guidance' });
      assert.match(text(note), /soil moisture/i);
      assert.equal(note.findAllByType('details').length, 0);
      assert.doesNotMatch(text(note), /NaN|Infinity|undefined|\bmm\b/);
    } finally { await act(async () => view.unmount()); }
  }
});

test('zero reference evaporation is retained as reference data without telling the farmer to skip watering', async () => {
  const view = await render(forecast(0));
  try {
    const note = view.root.findByProps({ 'aria-label': 'Watering guidance' });
    assert.match(text(note.findByType('details')), /Reference ETo: 0\.0 mm/);
    assert.match(text(note), /soil moisture/);
    assert.doesNotMatch(text(note), /skip watering|do not water|water roughly/i);
  } finally { await act(async () => view.unmount()); }
});
