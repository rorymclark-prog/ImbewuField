// Site report fixes from the 20 November 2026 review: what a reader sees on paper, and which trees
// the report model may suggest when nobody knows how cold the site gets.
import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { stripInlineMarkdown } from '../lib/report-pdf.ts';
import { plantingFrostUnknown, reportPlantingCandidates } from '../lib/report-planting-safety.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
import { SUPPORTED_REPORT_COUNTRY_FIXTURE_URL } from './report-country-fixture.ts';

const FROST_TENDER_TREES = /Mango|Pawpaw|Brown ivory|Marula/;

test('a printed source shows its label and full address, not Markdown brackets', () => {
  const url = 'https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/Fruit%20and%20%20Nut%20Production%20in%20KZN.pdf';
  assert.equal(stripInlineMarkdown(`Source: [KZN DARD, Fruit and Nut Production, PDF pp. 6–7](${url})`),
    `Source: KZN DARD, Fruit and Nut Production, PDF pp. 6–7 (${url})`);
  // Only web addresses are links. Square brackets in ordinary text are the farmer's own words.
  assert.equal(stripInlineMarkdown('Bed [north] (old)'), 'Bed [north] (old)');
  assert.equal(stripInlineMarkdown('[note](file.pdf)'), '[note](file.pdf)');
});

test('an unknown lowest temperature keeps frost-tender trees off the screened planting list', () => {
  for (const unknown of [null, undefined, Number.NaN]) {
    assert.equal(plantingFrostUnknown(unknown), true);
    const candidates = reportPlantingCandidates('SAVANNA', unknown);
    assert.doesNotMatch(candidates, FROST_TENDER_TREES, 'unknown is not evidence that a site is frost-free');
    // The screen is for woody perennials only: summer annuals sown after frost stay available.
    assert.match(candidates, /Cowpea/);
  }
  // A sourced warm minimum still lets them through, and a sourced frost still keeps them out.
  assert.equal(plantingFrostUnknown(5.4), false);
  assert.match(reportPlantingCandidates('SAVANNA', 5.4), /Mango/);
  assert.doesNotMatch(reportPlantingCandidates('SAVANNA', -1.9), /Mango/);
});

test('the report prompt says frost risk is unknown and offers no frost-tender trees when the minimum is unsourced', async () => {
  const requests: any[] = [];
  const key = Symbol.for('site-report-frost-capture'); (globalThis as any)[key] = requests;
  const module = (text: string) => 'data:text/javascript,' + encodeURIComponent(text);
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@anthropic-ai/sdk') return { url: module('export default class Anthropic {}'), shortCircuit: true };
    if (specifier === 'next/server') return { url: module('export class NextRequest {}'), shortCircuit: true };
    if (specifier === '@/lib/report-country-policy') return { url: SUPPORTED_REPORT_COUNTRY_FIXTURE_URL, shortCircuit: true };
    if (specifier === '@/lib/api-auth') return { url: module('export async function guardPaidApiRequest(){return {uid:"synthetic-frost-report-test"}}'), shortCircuit: true };
    if (specifier === '@/lib/metered-ai') return { url: module(`export const AI_MODELS={main:'mock'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async request=>{globalThis[Symbol.for('site-report-frost-capture')].push(request);return {content:[{type:'text',text:'## Executive Summary\\n\\nSynthetic provider response.'}],stop_reason:'end_turn',usage:{input_tokens:0,output_tokens:0}}}}}}}`), shortCircuit: true };
    return next(specifier, context);
  }});
  const oldFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}');
  try {
    const { POST } = await import('../app/api/generate-report/route.ts');
    const prompt = async (climate: Record<string, unknown>) => {
      const location = structuredClone(DEMO_LOCATION) as any;
      location.climate = { ...location.climate, ...climate };
      const start = requests.length;
      const response = await POST(new Request('http://localhost/api/generate-report', { method: 'POST',
        body: JSON.stringify({ language: 'en', sections: ['Executive Summary'], locationData: location }) }) as any);
      assert.equal(response.status, 200);
      await response.text();
      return requests.slice(start).map(request => String(request.messages[0].content)).join('\n');
    };
    // The fixed demo climate carries a minimum without a source tag, which the app treats as unknown.
    const unknown = await prompt({ minTempSource: undefined });
    const candidates = /SCREENED PLANTING CANDIDATES[^\n]*/.exec(unknown)?.[0] ?? '';
    assert.match(candidates, /lowest temperature here is not known/);
    assert.doesNotMatch(candidates, FROST_TENDER_TREES);
    const warm = await prompt({ minTemp: 5.4, minTempSource: 'nasa-power' });
    const warmCandidates = /SCREENED PLANTING CANDIDATES[^\n]*/.exec(warm)?.[0] ?? '';
    assert.doesNotMatch(warmCandidates, /not known/);
    assert.match(warmCandidates, /Mango/);
  } finally {
    globalThis.fetch = oldFetch; hooks.deregister(); delete (globalThis as any)[key];
  }
});
