import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as climateEvidence from '../lib/climate-temperature.ts';
import { roofCalcLine, type ReportSiteFacts } from '../lib/report-site-facts.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
import { SUPPORTED_REPORT_COUNTRY_FIXTURE_URL } from './report-country-fixture.ts';

const facts: ReportSiteFacts = { roof: { areaM2: 100, source: 'Synthetic measured roof' }, water: {
  tanks: [{ name: 'Recorded tank', count: 1, statedLitres: 2500, status: 'existing' }],
  statedStorageLitres: 2500, tanksOfUnknownCapacity: 0, mapPoints: [], bodies: [],
} };

test('zero roof yield keeps recorded storage without dividing by a fabricated litre', () => {
  const line = roofCalcLine(facts, 0);
  assert.match(line, /0 L usable/);
  assert.match(line, /2[ ,]500 L/);
  assert.doesNotMatch(line, /\d+%|binding constraint/);
  assert.match(line, /percentage.*undefined/i);
  assert.match(line, /adequacy.*not established/i);
});

test('sub-litre harvest uses the actual denominator, never a rounded or clamped yield', () => {
  const line = roofCalcLine({ ...facts, roof: { areaM2: 1, source: 'Synthetic' } }, 0.5);
  // 1 m² × 0.5 mm × 0.8 = 0.4 L; 2500 / 0.4 × 100 = 625000%.
  assert.match(line, /625000%/);
  assert.doesNotMatch(line, /binding constraint/);
  assert.match(line, /adequacy.*not established/i);
});

// Render the actual ReportView footnote, including its real evidence declaration.
// This bounded source extraction avoids mounting the unrelated paid/account UI.
const source = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ReportView.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let footnote = '', declaration = '';
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'climateLabels') declaration = `const ${node.getText(ast)};`;
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'div'
      && node.getText(ast).includes("tr('Köppen climate class'")
      && (!footnote || node.getText(ast).length < footnote.length)) footnote = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(footnote);
const renderFootnote = new Function('React', 'd', 'tr', 'koppenDescLabel', 'rainfallPatternLabel',
  'seasonRangeLabel', 'monthlyTemperatureStatus', 'reportClimateLabels', ts.transpileModule(
    declaration + `return (${footnote});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText);
function render(d: typeof DEMO_LOCATION) {
  return renderToStaticMarkup(renderFootnote(React, d, (en: string) => en, (_: string, desc: string) => desc,
    (s: string) => s, (s: string) => s, climateEvidence.monthlyTemperatureStatus,
    (climateEvidence as any).reportClimateLabels));
}
test('outage footnote withholds placeholder class and seasons and names the unknown temperature', () => {
  const d = structuredClone(DEMO_LOCATION); delete d.rainfall.rainfallSource;
  const output = render(d);
  assert.doesNotMatch(output, new RegExp(d.climate.koppen + ' |' + d.rainfall.wetSeason));
  assert.match(output, /Köppen climate class Not known/);
  assert.match(output, /Mean temperature.*Not known/);
});
test('complete rainfall retains its seasons independently of missing temperature coverage', () => {
  const d = structuredClone(DEMO_LOCATION);
  const output = render(d);
  assert.ok(output.includes(d.rainfall.wetSeason));
  assert.match(output, /Köppen climate class Not known/);
  d.climate.monthlyTempCoverage = { source: 'nasa-power', status: 'complete' };
  const complete = render(d);
  assert.ok(complete.includes(d.climate.koppen));
  assert.ok(complete.includes(`${d.climate.meanTemp}°C`));
});

test('actual report prompt and header preserve partial rainfall without inventing storage adequacy', async () => {
  const requests: any[] = []; const key = Symbol.for('report-water-climate-capture'); (globalThis as any)[key] = requests;
  const module = (s: string) => 'data:text/javascript,' + encodeURIComponent(s);
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@anthropic-ai/sdk') return { url: module('export default class Anthropic {}'), shortCircuit: true };
    if (specifier === 'next/server') return { url: module('export class NextRequest {}'), shortCircuit: true };
    if (specifier === '@/lib/report-country-policy') return { url: SUPPORTED_REPORT_COUNTRY_FIXTURE_URL, shortCircuit: true };
    if (specifier === '@/lib/api-auth') return { url: module('export async function guardPaidApiRequest(){return {uid:"synthetic-report-test"}}'), shortCircuit: true };
    if (specifier === '@/lib/metered-ai') return { url: module(`export const AI_MODELS={main:'mock'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async request=>{globalThis[Symbol.for('report-water-climate-capture')].push(request);return {usage:{},stop_reason:'end_turn',content:[{type:'text',text:'## Water Harvesting\\nMocked report.'}]};}}}};}`), shortCircuit: true };
    return next(specifier, context);
  }});
  const oldFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}');
  try {
    const { POST } = await import('../app/api/generate-report/route.ts');
    const d = structuredClone(DEMO_LOCATION); d.rainfall.monthly = [];
    const response = await POST(new Request('http://localhost/api/generate-report', { method: 'POST', body: JSON.stringify({
      language: 'en', sections: ['Water Harvesting', 'Irrigation Plan'], locationData: d, siteFacts: facts,
      waterData: { count: 1, estVolumeKL: 10, avgDepthM: 1, areaM2: 10 },
    }) }) as any);
    assert.equal(response.status, 200); const body = await response.text();
    const prompt = requests.map(r => String(r.messages[0].content)).join('\n');
    assert.ok(!body.includes(`wet ${d.rainfall.wetSeason}`), 'header must use the same monthly gate as the prompt');
    assert.match(prompt, /Drawn water storage/); assert.match(prompt, /Tank storage on the plan/);
    assert.match(prompt, /Dry season storage gap:\*\* not calculated/);
    assert.doesNotMatch(prompt, /covers the dry-season deficit above|need you calculate above|say if it is enough|say how many days it covers/);
    assert.doesNotMatch(body, /wet Oct–Mar|dry Apr–Sep/);
    assert.ok(!body.includes(`wet ${d.rainfall.wetSeason}`), 'header must use the same monthly gate as the prompt');
    assert.match(body, /791 mm/);
  } finally { globalThis.fetch = oldFetch; hooks.deregister(); delete (globalThis as any)[key]; }
});
