import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { buildReportHeaderMarkdown, roofCalcLine } from '../lib/report-site-facts.ts';
import { surveyToPrompt, type SiteSurvey } from '../lib/site-survey.ts';
import { surveyRoofEvidence } from '../lib/survey-roof-evidence.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
import { SUPPORTED_REPORT_COUNTRY_FIXTURE_URL } from './report-country-fixture.ts';

// These are deliberately synthetic reported measurements, not a roof/crop recommendation.
const survey = { siteId: 'site:-29.00000,31.00000', roofMainM2: 60, roofSecondaryM2: 15,
  roofAreaSource: 'manual', roofSecondarySource: 'manual', hasGutters: true } as SiteSurvey;
const evidence = surveyRoofEvidence(survey);
const headerBase = { facts: null, biomeName: 'Synthetic', lat: -29, lon: 31,
  dateLabel: '15 November 2026', rainfallMm: 800, rainfallSource: 'grower-entered', wetSeason: '', drySeason: '',
  soilPh: 0, soilOrganicCarbon: 0, soilTexture: '', elevationM: 0, slopeDeg: 0,
  aspectLabel: '', hasMapWaterPolygons: false };

test('a survey-only roof does not become an unmeasured roof in the report calculation instructions', () => {
  const before = JSON.stringify(survey);
  const reported = surveyToPrompt(survey, 800);
  assert.match(reported, /Total harvestable roof area: 75 m²/);
  const calculation = roofCalcLine(null, 800, evidence);
  assert.match(calculation, /survey/i);
  assert.match(calculation, /75 m²/);
  assert.doesNotMatch(calculation, /no roof has been traced or measured|NO roof area|Say exactly that/);
  assert.equal(JSON.stringify(survey), before);
});

test('the deterministic report header retains survey-only roof area with its own source', () => {
  const header = buildReportHeaderMarkdown({ ...headerBase, surveyRoof: evidence });
  assert.match(header, /Roof area reported in survey/);
  assert.match(header, /75 m²/);
  assert.match(header, /manual/i);
  assert.doesNotMatch(header, /Roof catchment \| Not traced or measured/);
});

test('different map and survey roof areas stay separate instead of becoming a combined catchment', () => {
  const facts = { roof: { areaM2: 144, source: 'Synthetic traced roof' } };
  const before = JSON.stringify({ facts, survey, evidence });
  const calculation = roofCalcLine(facts, 800, evidence);
  const header = buildReportHeaderMarkdown({ ...headerBase, facts, surveyRoof: evidence });
  for (const text of [calculation, header]) {
    assert.match(text, /144 m²/);
    assert.match(text, /75 m²/);
    assert.match(text, /[Dd]o not add/);
    assert.doesNotMatch(text, /219 m²/);
  }
  // Existing map arithmetic is retained; the survey's own scenario is not a
  // licence to choose a new coefficient or replace measured map evidence.
  assert.match(calculation, /92 160 L usable\/year/);
  assert.equal(JSON.stringify({ facts, survey, evidence }), before);
});

test('roof evidence preserves reported zero, missing components and recorded entry sources independently', () => {
  const zero = surveyRoofEvidence({ roofMainM2: 0, roofSecondaryM2: null, roofAreaSource: 'manual' });
  assert.equal(zero.mainM2, 0); assert.equal(zero.secondaryM2, null); assert.equal(zero.subtotalM2, 0);
  assert.equal(zero.mainSource, 'manual'); assert.equal(zero.secondarySource, undefined);
  const header = buildReportHeaderMarkdown({ ...headerBase, surveyRoof: zero });
  assert.match(header, /Survey reported subtotal 0 m²/);
  assert.match(header, /secondary roofs not recorded/);
  const reported = surveyToPrompt({ ...survey, roofMainM2: 0, roofSecondaryM2: null }, 800);
  assert.match(reported, /0 m² reported/);
  assert.doesNotMatch(reported, /Roof area: not measured|Estimated annual roof harvest at/);
  const partial = surveyRoofEvidence({ roofMainM2: null, roofSecondaryM2: 15, roofSecondarySource: 'auto' });
  const text = roofCalcLine(null, null, partial);
  assert.match(text, /subtotal 15 m²/); assert.match(text, /main roof not recorded/);
  assert.match(text, /declared auto from map shapes/);
  assert.doesNotMatch(text, /\d+ L usable/);
});

test('malformed and overflowing survey roof entries do not become a catchment or an invented harvest', () => {
  for (const input of [undefined, null, [], { roofMainM2: -1 }, { roofMainM2: '60' },
    { roofMainM2: Number.NaN, roofSecondaryM2: Infinity }]) {
    const clean = surveyRoofEvidence(input);
    assert.equal(clean.mainM2, null); assert.equal(clean.secondaryM2, null); assert.equal(clean.subtotalM2, null);
    const text = roofCalcLine(null, 800, clean);
    assert.match(text, /area and harvest unknown/);
    assert.doesNotMatch(text, /NaN|Infinity|\d+ L usable/);
  }
  const huge = { ...survey, roofMainM2: Number.MAX_VALUE, roofSecondaryM2: Number.MAX_VALUE };
  const clean = surveyRoofEvidence(huge);
  assert.equal(clean.subtotalM2, null);
  for (const text of [surveyToPrompt(huge, 800), roofCalcLine(null, 800, clean),
    buildReportHeaderMarkdown({ ...headerBase, surveyRoof: clean })]) {
    assert.match(text, /could not be totalled/);
    assert.doesNotMatch(text, /NaN|Infinity|Estimated annual roof harvest at|\d+ L usable/);
  }
});

test('fractional survey components retain their precision in the header and calculation evidence', () => {
  for (const [main, secondary, subtotal] of [[0.4, 0.4, 0.8], [60.4, 15.4, 75.8], [60.1, 15.2, 75.3],
    [60.2, 15.4, 75.6], [60.3, 15.1, 75.4], [0.1, 0.2, 0.3], [1e-20, 2e-20, 3e-20],
    [1e-300, 2e-300, 3e-300], [Number.MAX_VALUE, Number.MIN_VALUE, Number.MAX_VALUE]]) {
    const input = { ...survey, roofMainM2: main, roofSecondaryM2: secondary };
    const roof = surveyRoofEvidence(input);
    assert.equal(roof.subtotalM2, main+secondary, 'display formatting must not change calculation inputs');
    for (const text of [buildReportHeaderMarkdown({ ...headerBase, surveyRoof: roof }), roofCalcLine(null, 800, roof)]) {
      assert.ok(text.includes(`Survey reported subtotal ${subtotal} m²`));
      assert.ok(text.includes(`main roof ${main} m²`));
      assert.ok(text.includes(`secondary roofs ${secondary} m²`));
    }
    assert.ok(surveyToPrompt(input, 800).includes(`Total harvestable roof area: ${subtotal} m²`));
  }
});

test('a finite survey roof cannot publish an overflowing harvest or mislabel known rainfall as missing', () => {
  const input = { ...survey, roofMainM2: Number.MAX_VALUE, roofSecondaryM2: null };
  assert.equal(surveyRoofEvidence(input).subtotalM2, Number.MAX_VALUE);
  const text = surveyToPrompt(input, 800);
  assert.match(text, /calculation unavailable; verify the recorded roof area and rainfall inputs/);
  assert.doesNotMatch(text, /Infinity|NaN|unavailable until annual rainfall is known|Estimated annual roof harvest at/);
  assert.match(surveyToPrompt(input, 0), /Estimated annual roof harvest at 0 mm rainfall: ~0 kL/);
});

test('new survey roof copy is explicitly marked pending translation rather than silently called translated', () => {
  const header = buildReportHeaderMarkdown({ ...headerBase, surveyRoof: evidence }, 'zu');
  assert.match(header, /English; translation pending: Roof area reported in survey/);
  assert.match(header, /English; translation pending: Survey reported subtotal 75 m²/);
});

test('the actual report route carries survey roof evidence into its prompt and deterministic header', async () => {
  const requests: any[] = [];
  const key = Symbol.for('report-survey-roof-capture'); (globalThis as any)[key] = requests;
  const module = (text: string) => 'data:text/javascript,' + encodeURIComponent(text);
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@anthropic-ai/sdk') return { url: module('export default class Anthropic {}'), shortCircuit: true };
    if (specifier === 'next/server') return { url: module('export class NextRequest {}'), shortCircuit: true };
    if (specifier === '@/lib/report-country-policy') return { url: SUPPORTED_REPORT_COUNTRY_FIXTURE_URL, shortCircuit: true };
    if (specifier === '@/lib/api-auth') return { url: module('export async function guardPaidApiRequest(){return {uid:"synthetic-roof-report-test"}}'), shortCircuit: true };
    if (specifier === '@/lib/metered-ai') return { url: module(`export const AI_MODELS={main:'mock'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async request=>{globalThis[Symbol.for('report-survey-roof-capture')].push(request);return {usage:{},stop_reason:'end_turn',content:[{type:'text',text:'## Water Harvesting\\nSynthetic provider response; not a generated farming recommendation.'}]};}}}};}`), shortCircuit: true };
    return next(specifier, context);
  }});
  const oldFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}');
  try {
    const { POST } = await import('../app/api/generate-report/route.ts');
    for (const [mappedArea, rainfallKnown, gutters] of [[null, true, true], [144, true, false], [null, false, true]] as const) {
      const location = structuredClone(DEMO_LOCATION);
      location.rainfall.annual = 800; location.rainfall.monthly = [];
      if (rainfallKnown) location.rainfall.rainfallSource = 'grower-entered'; else delete location.rainfall.rainfallSource;
      const input = { language: 'en', sections: ['Executive Summary', 'Water Harvesting'], locationData: location,
        siteFacts: mappedArea === null ? null : { roof: { areaM2: mappedArea, source: 'Synthetic traced roof' } },
        surveyData: { ...survey, hasGutters: gutters } };
      const before = JSON.stringify(input), start = requests.length;
      const response = await POST(new Request('http://localhost/api/generate-report', { method: 'POST', body: before }) as any);
      assert.equal(response.status, 200);
      const body = await response.text();
      const prompt = requests.slice(start).map(request => String(request.messages[0].content)).join('\n');
      for (const text of [prompt, body]) {
        assert.match(text, /75 m²/);
        assert.doesNotMatch(text, /no roof has been traced or measured|NO roof area|Roof catchment \| Not traced or measured/);
      }
      assert.match(body, /Roof area reported in survey/);
      assert.match(body, /manual entry/);
      assert.match(prompt, /Survey reported subtotal/);
      if (mappedArea !== null) {
        assert.match(body, /144 m²/);
        assert.match(prompt, /92 160 L usable\/year/);
        assert.match(prompt, /~36 kL/);
        assert.match(prompt, /Do not add map and survey areas together/);
      } else assert.doesNotMatch(prompt, /map-based scenario with an assumed coefficient/);
      if (!rainfallKnown) assert.match(prompt, /unavailable until annual rainfall is known/);
      assert.equal(JSON.stringify(input), before);
    }
  } finally {
    globalThis.fetch = oldFetch; hooks.deregister(); delete (globalThis as any)[key];
  }
});
