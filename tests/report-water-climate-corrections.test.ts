import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as climateEvidence from '../lib/climate-temperature.ts';
import { roofCalcLine, type ReportSiteFacts } from '../lib/report-site-facts.ts';
import { buildRiskRegister, riskRegisterMarkdown } from '../lib/report-risk.ts';
import { buildSkeletonReportDoc } from '../lib/report-doc.ts';
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
  // Current main now records complete coverage on its real demo capture. An
  // outage fixture must withhold that evidence explicitly, not rely on its age.
  delete d.climate.monthlyTempCoverage;
  const output = render(d);
  assert.doesNotMatch(output, new RegExp(d.climate.koppen + ' |' + d.rainfall.wetSeason));
  assert.match(output, /Köppen climate class Not known/);
  assert.match(output, /Mean temperature.*Not known/);
});
test('complete rainfall retains its seasons independently of missing temperature coverage', () => {
  const d = structuredClone(DEMO_LOCATION);
  delete d.climate.monthlyTempCoverage;
  const output = render(d);
  assert.ok(output.includes(d.rainfall.wetSeason));
  assert.match(output, /Köppen climate class Not known/);
  d.climate.monthlyTempCoverage = { source: 'nasa-power', status: 'complete' };
  const complete = render(d);
  assert.ok(complete.includes(d.climate.koppen));
  assert.ok(complete.includes(`${d.climate.meanTemp}°C`));
});

test('a rainfall outage preserves an independently supported temperature without claiming a climate class', () => {
  const d = structuredClone(DEMO_LOCATION);
  d.climate.monthlyTempCoverage = { source: 'nasa-power', status: 'complete' };
  delete d.rainfall.rainfallSource;
  const output = render(d);
  assert.match(output, /Köppen climate class Not known/);
  assert.ok(output.includes(`${d.climate.meanTemp}°C`));
  assert.ok(!output.includes(d.rainfall.wetSeason));
  assert.ok(!output.includes(d.rainfall.drySeason));
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
    for (const annual of [null, 0, 0.5, 499, 500, 791]) {
      const d = structuredClone(DEMO_LOCATION); d.rainfall.monthly = [];
      d.elevation.slopeDeg = annual === null ? undefined as unknown as number : 10;
      d.rainfall.annual = annual ?? 791;
      if (annual === null) delete d.rainfall.rainfallSource;
      const requestStart = requests.length;
      const response = await POST(new Request('http://localhost/api/generate-report', { method: 'POST', body: JSON.stringify({
        language: 'en', sections: ['Water Harvesting', 'Irrigation Plan'], locationData: d, siteFacts: {
          ...facts, boundary: { areaM2: 10000, source: 'Synthetic boundary' },
          design: { beds: [{ label: 'Measured vegetable bed', areaM2: 20, kind: 'bed' }],
            bedCount: 1, bedAreaM2: 20, plotCount: 0, plotAreaM2: 0,
            growingAreaM2: 20, elements: [], routes: [], zones: [] },
        },
        waterData: { count: 1, estVolumeKL: 10, avgDepthM: 1, areaM2: 10 },
      }) }) as any);
      assert.equal(response.status, 200); const body = await response.text();
      const prompt = requests.slice(requestStart).map(r => String(r.messages[0].content)).join('\n');
      assert.ok(!body.includes(`wet ${d.rainfall.wetSeason}`), 'header must use the same monthly gate as the prompt');
      assert.match(prompt, /Drawn water storage/); assert.match(prompt, /Tank storage on the plan/);
      assert.match(prompt, /Dry season storage gap:\*\* not calculated/);
      // Neither drawn capacity nor an annual rainfall total establishes crop demand.
      // Check the whole actual prompt: its early storage paragraph used to contradict
      // the later evidence caveat, then supply a universal watering depth itself.
      const unsupportedDemand = prompt.match(/say whether it is enough or more is needed|A vegetable garden needs roughly 5–6mm of water per day|100m² × 5mm = 500 L\/day|Scale to the 1\.00 ha site|scale every recommendation to this size/g) ?? [];
      assert.deepEqual(unsupportedDemand, [], 'the model must not be asked to invent a demand budget');
      assert.match(prompt, /Crop water demand is unknown unless/);
      assert.match(prompt, /Unit conversion only: 1mm over 1m² = 1 litre/);
      assert.match(prompt, /Area: 10,000 m² \(1\.00 ha\)/);
      assert.match(prompt, /boundary-scale calculations only/);
      assert.match(prompt, /For roof collection, use its own recorded catchment area/);
      // Missing rain withholds harvest, not the independently recorded roof area.
      if (annual === null) assert.match(prompt, /roof area 100 m² recorded; annual rainfall is not known/);
      else assert.match(prompt, /the traced roof on this site is \*\*100 m²\*\*/);
      assert.match(prompt, /\| Measured vegetable bed \| 20 m² \|/);
      assert.match(prompt, /not the whole property area/);
      assert.match(prompt, /Keep unsupported demand and total cells explicitly unknown/);
      assert.doesNotMatch(prompt, /covers the dry-season deficit above|need you calculate above|say if it is enough|say how many days it covers/);
      assert.doesNotMatch(body, /wet Oct–Mar|dry Apr–Sep/);
      assert.ok(!body.includes(`wet ${d.rainfall.wetSeason}`), 'header must use the same monthly gate as the prompt');
      assert.ok(body.includes(`Annual rainfall: ${annual === null ? 'unknown' : annual + ' mm/year'}.`));
      assert.match(body, /water adequacy have not been assessed/);
      assert.ok(body.includes(`Recorded slope estimate: ${annual === null ? 'unknown' : '10°'}.`), 'actual API must pass its slope to the risk evidence builder');
      assert.doesNotMatch(body, /at or above the 10° threshold|between the 5° and 10° thresholds/);
      assert.doesNotMatch(body, /Dry-season crop failure from insufficient stored water|below the 500 mm|Build storage before expanding/);
    }
  } finally { globalThis.fetch = oldFetch; hooks.deregister(); delete (globalThis as any)[key]; }
});

// CSR-15A-F01: an annual total, including a real zero, cannot rate crop failure
// or prescribe tanks. Keep unknown evidence visible even when no risk row fires.
const riskFixture = JSON.parse(readFileSync(new URL('./fixtures/report-monitoring-translation/source-cases.json', import.meta.url), 'utf8'));
for (const annual of [null, 0, 0.5, 499, 500, 900]) {
  test(`annual rainfall ${annual} remains unrated in both report formats`, () => {
    const input = { ...riskFixture.risks.find((c: any) => c.name === 'none').input, rainfallMm: annual };
    const rows = buildRiskRegister(input);
    assert.deepEqual(rows, [], 'rain alone must not add a rated risk');
    const d = structuredClone(DEMO_LOCATION);
    d.rainfall.annual = annual ?? 791;
    if (annual === null) delete d.rainfall.rainfallSource;
    const doc = buildSkeletonReportDoc({ id: 'synthetic', siteId: 'synthetic', location: d,
      survey: { challenges: ['first', 'second', 'third', 'fourth', 'fifth'] } as any,
      layers: [], plan: null, phasePlan: { phases: [] } as any, createdAt: '2026-11-12T00:00:00Z' });
    const challenge = doc.sections.executive!.topChallenges[0];
    const annualText = `Annual rainfall: ${annual === null ? 'unknown' : annual + ' mm/year'}.`;
    assert.ok(challenge.startsWith(annualText));
    assert.match(challenge, /Crop water demand, seasonal water supply and water adequacy have not been assessed/);
    assert.match(challenge, /does not establish dry-season crop-failure risk or required storage capacity/);
    assert.deepEqual(doc.sections.executive!.topChallenges.slice(1), ['first', 'second', 'third', 'fourth', 'fifth']);
    assert.doesNotMatch(doc.sections.executive!.topChallenges.join(' '), /Low\/erratic rainfall|storage are the priority/);
    for (const lang of ['en', 'zu', 'st', 'ts', 've']) {
      const markdown = riskRegisterMarkdown(rows, lang, annual);
      assert.ok(markdown.includes(challenge), 'document and risk report must share the same evidence statement');
      assert.doesNotMatch(markdown, /\| High \||Build storage before|below the 500/);
      assert.match(markdown, /not a finding of low risk/);
      if (lang !== 'en') assert.match(markdown, /English; translation pending/);
      // A retained unrelated recorded gap must not hide the evidence note either.
      const withGap = riskRegisterMarkdown(buildRiskRegister({ ...input, unpricedBoqLines: 1 }, lang), lang, annual);
      assert.ok(withGap.includes(challenge));
      assert.ok(withGap.includes('| R1 |'));
    }
  });
}

// REPORT-SLOPE-EVIDENCE-01: the same raw estimate previously meant High risk
// in the register and Low erosion in the document; missing values meant Low.
for (const slope of [undefined, null, 0, 0.000001, 4.99, 5, 9.99, 10, 12, 90, 91, -999, NaN, Infinity, -Infinity, '10']) {
  test(`slope evidence ${String(slope)} stays unrated in both report formats`, () => {
    const input = { ...riskFixture.risks.find((c: any) => c.name === 'none').input, slopeDeg: slope, rainfallMm: null };
    assert.deepEqual(buildRiskRegister(input), [], 'slope alone cannot create a rated erosion assessment');
    const d = structuredClone(DEMO_LOCATION);
    d.elevation.slopeDeg = slope as number;
    const doc = buildSkeletonReportDoc({ id: 'synthetic-slope', siteId: 'synthetic-slope', location: d,
      survey: null, layers: [], plan: null, phasePlan: { phases: [] } as any, createdAt: '2026-11-13T00:00:00Z' });
    const water = doc.sections.water!;
    assert.match(water.runoffRisk, /Runoff risk has not been assessed/);
    assert.match(water.erosionRisk, /Erosion risk has not been assessed/);
    assert.doesNotMatch(water.runoffRisk + water.erosionRisk, /Low|Moderate|High|slow it with swales|Low if ground stays covered/);
    assert.equal(doc.sections['landscape-soil']!.erosion, water.erosionRisk);
    const valid = typeof slope === 'number' && Number.isFinite(slope) && slope >= 0 && slope <= 90;
    assert.equal(doc.sections['landscape-soil']!.slope?.value, valid ? slope : undefined);
    const recorded = `Recorded slope estimate: ${valid ? slope + '°' : 'unknown'}.`;
    assert.ok(water.runoffRisk.startsWith(recorded));
    for (const lang of ['en', 'zu', 'st', 'ts', 've']) {
      const markdown = riskRegisterMarkdown([], lang, null, slope);
      assert.ok(markdown.includes(water.runoffRisk));
      assert.ok(markdown.includes(water.erosionRisk));
      assert.match(markdown, /not a finding of low risk/);
      if (lang !== 'en') assert.match(markdown, /Slope evidence \(English; translation pending\)/);
    }
  });
}

test('slope evidence labels its English fallback in structured reports without claiming a reviewed translation', () => {
  for (const lang of ['zu', 'st', 'ts', 've']) {
    const doc = buildSkeletonReportDoc({ id: 'synthetic-slope', siteId: 'synthetic-slope', location: structuredClone(DEMO_LOCATION),
      survey: null, layers: [], plan: null, phasePlan: { phases: [] } as any, lang, createdAt: '2026-11-13T00:00:00Z' });
    assert.match(doc.sections.water!.runoffRisk, /^English; translation pending: Recorded slope estimate:/);
    assert.match(doc.sections.water!.erosionRisk, /^English; translation pending: Erosion risk has not been assessed/);
    assert.equal(doc.sections['landscape-soil']!.erosion, doc.sections.water!.erosionRisk);
  }
});

test('slope evidence survives populated risk registers without changing unrelated rows or input records', () => {
  const fixture = riskFixture.risks.find((c: any) => c.name === 'none').input;
  for (const slope of [undefined, 0, 10]) for (const lang of ['en', 'zu', 'st', 'ts', 've']) {
    const input = { ...structuredClone(fixture), rainfallMm: null, slopeDeg: slope, unpricedBoqLines: 1 };
    const before = JSON.stringify(input);
    const rows = buildRiskRegister(input, lang);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'R1');
    const sameGap = buildRiskRegister({ ...input, slopeDeg: 0 }, lang);
    assert.deepEqual(rows, sameGap);
    const markdown = riskRegisterMarkdown(rows, lang, null, slope);
    assert.ok(markdown.includes(rows[0].risk) && markdown.includes(rows[0].trigger) && markdown.includes(rows[0].mitigation));
    assert.match(markdown, /Water evidence/);
    assert.match(markdown, /Slope evidence/);
    assert.match(markdown, /Runoff risk has not been assessed/);
    assert.match(markdown, /Erosion risk has not been assessed/);
    assert.match(markdown, /Retained ratings are qualitative rule outputs, not measured probabilities/);
    assert.doesNotMatch(markdown, /the figure and the threshold that produced the rating/);
    assert.equal(JSON.stringify(input), before);
  }
});
