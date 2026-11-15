import test from 'node:test';
import assert from 'node:assert/strict';
import { waterPromptBlock, buildReportHeaderMarkdown, type ReportSiteFacts } from '../lib/report-site-facts.ts';
import { registerHooks } from 'node:module';
import { surveyWaterEvidence, surveyWaterSummary, SURVEY_WATER_LIMITS } from '../lib/report-survey-water.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
import { SUPPORTED_REPORT_COUNTRY_FIXTURE_URL } from './report-country-fixture.ts';
import { surveyToPrompt, type SiteSurvey } from '../lib/site-survey.ts';
const headerBase = { facts: null, biomeName: 'Synthetic', lat: -29, lon: 31,
  dateLabel: '15 November 2026', rainfallMm: 800, rainfallSource: 'grower-entered', wetSeason: '', drySeason: '',
  soilPh: 0, soilOrganicCarbon: 0, soilTexture: '', elevationM: 0, slopeDeg: 0,
  aspectLabel: '', hasMapWaterPolygons: false };
const survey = {siteId:'site:-29,31', waterSource:['borehole','river'],waterStorage:['jojo','cistern']} as SiteSurvey;

test('a map-only water gap is not falsely labelled as a missing survey answer', () => {
  assert.match(surveyToPrompt(survey,800),/Sources available: borehole, river/);
  const block=waterPromptBlock(null,false);
  assert.match(block,/NOT RECORDED in the supplied map\/design facts:/);
  assert.doesNotMatch(block,/supplied map\/survey|Nothing\. No tank/);
});

test('the deterministic map water gap cannot claim to have checked the separate survey', () => {
  const header=buildReportHeaderMarkdown(headerBase);
  assert.match(header,/Not recorded in supplied map\/design facts:/);
  assert.doesNotMatch(header,/Not recorded in supplied map\/survey:/);
});

const mapped: ReportSiteFacts = {water:{
  tanks:[{name:'Recorded tank',count:1,statedLitres:2500,status:'existing'}],
  statedStorageLitres:2500,tanksOfUnknownCapacity:0,mapPoints:[],bodies:[],
}};

test('survey water choices stay visible without becoming measured mapped infrastructure', () => {
  const cases = [
    [{waterSource:['borehole','river']}, ['Borehole','River / stream']],
    [{waterStorage:['dam','pond']}, ['Earth dam','Pond / retention pit']],
    [{waterStorage:['jojo','cistern']}, ['Jojo / plastic tanks','Underground cistern']],
    [{waterSource:['municipal','rainwater','grey']}, ['Municipal tap','Rainwater','Grey water']],
  ] as const;
  for (const [input,labels] of cases) {
    const before=JSON.stringify(input),water=surveyWaterEvidence(input);
    for (const text of [waterPromptBlock(null,false,water),buildReportHeaderMarkdown({...headerBase,surveyWater:water})]) {
      for(const label of labels) assert.ok(text.includes(label));
      assert.match(text,/not independently verified access, condition, reliability, count, capacity or available supply/);
      assert.doesNotMatch(text,/supplied map\/survey|Nothing\. No tank|\d+ L/);
    }
    assert.equal(JSON.stringify(input),before);
  }
});

test('explicit none and mixed survey choices cannot overwrite a mapped tank or imply additional capacity', () => {
  for (const input of [{waterSource:['none'],waterStorage:['none']},{waterStorage:['none','jojo']}]) {
    const before=JSON.stringify({input,mapped}),water=surveyWaterEvidence(input);
    const prompt=waterPromptBlock(mapped,false,water),header=buildReportHeaderMarkdown({...headerBase,facts:mapped,surveyWater:water});
    for(const text of [prompt,header]) {
      assert.match(text,/Recorded tank/);assert.match(text,/2 500 L/);
      assert.match(text,/No storage/);assert.match(text,/Do not add quantities or silently choose/);
      assert.doesNotMatch(text,/5 000 L|5000 L/);
      if(input.waterStorage.includes('jojo')) assert.match(text,/Conflicting survey choices include none and another answer/);
    }
    assert.equal(JSON.stringify({input,mapped}),before);
  }
});

test('unanswered, explicit none, malformed and unknown survey answers stay distinct without mutating saved choices', () => {
  for(const value of [undefined,null,[],5,'jojo']) assert.equal(surveyWaterEvidence(value),undefined);
  assert.match(surveyWaterSummary(surveyWaterEvidence({}))!,/Sources: not recorded; delivery: not recorded; storage: not recorded/);
  assert.match(surveyWaterSummary(surveyWaterEvidence({waterSource:['none'],waterDelivery:['none'],waterStorage:['none']}))!,/Sources: No water yet; delivery: Rain-fed only; storage: No storage/);
  const input={waterSource:[' borehole ','borehole',null,3,'','Borehole','constructor'],waterStorage:'jojo',waterDelivery:['drip','drip']};
  const before=JSON.stringify(input),water=surveyWaterEvidence(input)!;
  assert.deepEqual(water,{sources:['borehole','Borehole','constructor'],storage:[],delivery:['drip']});
  const text=surveyWaterSummary(water)!;
  assert.match(text,/unrecognized reported entry: Borehole/);assert.match(text,/unrecognized reported entry: constructor/);
  assert.doesNotMatch(text,/Jojo \/ plastic tanks/);assert.equal(JSON.stringify(input),before);
  const unsafe=surveyWaterEvidence({waterSource:['odd|entry\n## Heading']});
  const header=buildReportHeaderMarkdown({...headerBase,surveyWater:unsafe});
  const row=header.split('\n').find(line=>line.startsWith('| Water choices reported in survey'))!;
  assert.equal(row.split('|').length,5,'unknown text cannot add a table column');
  assert.doesNotMatch(header,/\n## Heading/);assert.match(row,/unrecognized reported entry/);
});

test('body-only and polygon-only supplied map evidence cannot be summarized as no mapped record', () => {
  const facts:ReportSiteFacts={water:{tanks:[],statedStorageLitres:0,tanksOfUnknownCapacity:0,mapPoints:[],bodies:[{name:'Recorded dam',category:'Dam'}]}};
  const body=waterPromptBlock(facts,false),polygon=waterPromptBlock(null,true);
  assert.match(body,/Water-body records.*Recorded dam/);assert.doesNotMatch(body,/No tank, water point, water-body record/);
  assert.match(polygon,/mapped water-polygon input was supplied/);assert.doesNotMatch(polygon,/No tank, water point, water-body record|NOT RECORDED/);
});

test('new survey water header evidence is explicitly pending translation', () => {
  const header=buildReportHeaderMarkdown({...headerBase,surveyWater:surveyWaterEvidence(survey)},'zu');
  assert.match(header,/English; translation pending: Water choices reported in survey/);
  assert.match(header,/English; translation pending: Sources: Borehole/);
  assert.match(header,/English; translation pending: Not recorded in supplied map\/design facts:/);
});

test('the real report route retains survey water sources independently of mapped records',async () => {
  const requests: any[] = [];
  const key = Symbol.for('report-survey-water-capture'); (globalThis as any)[key] = requests;
  const module = (text: string) => 'data:text/javascript,' + encodeURIComponent(text);
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@anthropic-ai/sdk') return { url: module('export default class Anthropic {}'), shortCircuit: true };
    if (specifier === 'next/server') return { url: module('export class NextRequest {}'), shortCircuit: true };
    if (specifier === '@/lib/report-country-policy') return { url: SUPPORTED_REPORT_COUNTRY_FIXTURE_URL, shortCircuit: true };
    if (specifier === '@/lib/api-auth') return { url: module('export async function guardPaidApiRequest(){return {uid:"synthetic-water-report-test"}}'), shortCircuit: true };
    if (specifier === '@/lib/metered-ai') return { url: module(`export const AI_MODELS={main:'mock'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async request=>{globalThis[Symbol.for('report-survey-water-capture')].push(request);return {usage:{},stop_reason:'end_turn',content:[{type:'text',text:'## Water Harvesting\\nSynthetic provider response; not a generated farming recommendation.'}]};}}}};}`), shortCircuit: true };
    return next(specifier, context);
  }});
  const oldFetch = globalThis.fetch; globalThis.fetch = async () => new Response('{}');
  try {
    const { POST } = await import('../app/api/generate-report/route.ts');
    const cases = [
      {name:'survey-sources-storage',facts:null, survey:{waterSource:['borehole','river'],waterDelivery:['bucket'],waterStorage:['dam','pond','jojo','cistern']}},
      {name:'mapped-plus-survey-none',facts:mapped,survey:{waterSource:['none'],waterDelivery:['none'],waterStorage:['none']}},
      {name:'mixed-survey-choice',facts:null,survey:{waterStorage:['none','jojo']}},
      {name:'indirect-sources',facts:null,survey:{waterSource:['municipal','rainwater','grey']}},
      {name:'unanswered-survey',facts:null,survey:{}},
      {name:'no-survey',facts:null,survey:undefined},
    ];
    for (const example of cases) {
      const location=structuredClone(DEMO_LOCATION);
      location.rainfall.annual=800;location.rainfall.monthly=[];location.rainfall.rainfallSource='grower-entered';
      const input={language:'en',sections:['Executive Summary','Water Harvesting'],locationData:location,
        siteFacts:example.facts,surveyData:example.survey===undefined?undefined:{siteId:'synthetic-water',...example.survey}};
      const before=JSON.stringify(input),start=requests.length;
      const response=await POST(new Request('http://localhost/api/generate-report',{method:'POST',body:before}) as any);
      assert.equal(response.status,200);
      const body=await response.text(),prompt=requests.slice(start).map(request=>String(request.messages[0].content)).join('\n');
      for (const text of [body,prompt]) assert.doesNotMatch(text,/supplied map\/survey|Nothing\. No tank/);
      if(example.survey!==undefined) {
        assert.match(body,/Water choices reported in survey/);
        assert.match(prompt,/Separate survey water record/);
        assert.ok(body.includes(SURVEY_WATER_LIMITS));
      } else assert.doesNotMatch(body,/Water choices reported in survey/);
      if(example.name==='survey-sources-storage') for(const text of [body,prompt]) {
        for(const label of ['Borehole','River / stream','Hand-watered','Earth dam','Pond / retention pit','Jojo / plastic tanks','Underground cistern'])assert.ok(text.includes(label));
        assert.doesNotMatch(text,/2 500 L|5 000 L/);
      }
      if(example.name==='mapped-plus-survey-none')for(const text of [body,prompt]) {
        assert.match(text,/Recorded tank/);assert.match(text,/2 500 L/);assert.match(text,/No storage/);assert.doesNotMatch(text,/5 000 L/);
      }
      if(example.name==='mixed-survey-choice')for(const text of [body,prompt])assert.match(text,/Conflicting survey choices include none and another answer/);
      if(example.name==='indirect-sources')for(const text of [body,prompt]) {
        for(const label of ['Municipal tap','Rainwater','Grey water'])assert.ok(text.includes(label));
        assert.doesNotMatch(text,/Jojo \/ plastic tanks/);
      }
      if(example.name==='unanswered-survey')assert.match(body,/Sources: not recorded; delivery: not recorded; storage: not recorded/);
      assert.equal(JSON.stringify(input),before);
    }
  } finally {
    globalThis.fetch=oldFetch;hooks.deregister();delete (globalThis as any)[key];
  }
});
