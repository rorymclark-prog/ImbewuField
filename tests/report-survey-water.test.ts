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
      assert.match(text,/Map\/design and survey records disagree/);
      assert.match(text,/Check both records and the site; neither record establishes current water availability/);
      assert.doesNotMatch(text,/5 000 L|5000 L/);
      if(input.waterStorage.includes('jojo')) assert.match(text,/Conflicting survey choices include none and another answer/);
    }
    assert.equal(JSON.stringify({input,mapped}),before);
  }
});

test('a storage disagreement needs an existing tank record and explicit survey storage none', () => {
  const cases = [
    { name: 'planned tank is not existing storage', facts: {water:{...mapped.water!,tanks:mapped.water!.tanks.map(tank=>({...tank,status:'proposed' as const}))}}, survey:{waterStorage:['none']} },
    { name: 'a pin does not establish an existing tank', facts:{water:{...mapped.water!,tanks:[],mapPoints:[{name:'Tank',category:'Tank'}]}}, survey:{waterStorage:['none']} },
    { name: 'water-source none is not storage none', facts:mapped, survey:{waterSource:['none']} },
    { name: 'unanswered storage is not none', facts:mapped, survey:{} },
    { name: 'unknown storage is not none', facts:mapped, survey:{waterStorage:['historic storage']} },
    { name: 'a scalar storage answer is not accepted', facts:mapped, survey:{waterStorage:'none'} },
    { name: 'survey-only conflict does not create mapped storage', facts:null, survey:{waterStorage:['none','jojo']} },
  ];
  for (const example of cases) {
    const before=JSON.stringify(example),water=surveyWaterEvidence(example.survey);
    for(const text of [waterPromptBlock(example.facts,false,water),buildReportHeaderMarkdown({...headerBase,facts:example.facts,surveyWater:water})]) {
      assert.doesNotMatch(text,/Map\/design and survey records disagree/,example.name);
    }
    assert.equal(JSON.stringify(example),before);
  }
  const unknownSize=structuredClone(mapped);
  unknownSize.water!.tanks[0].statedLitres=null;
  unknownSize.water!.statedStorageLitres=0;
  unknownSize.water!.tanksOfUnknownCapacity=1;
  const water=surveyWaterEvidence({waterStorage:['none']});
  for(const text of [waterPromptBlock(unknownSize,false,water),buildReportHeaderMarkdown({...headerBase,facts:unknownSize,surveyWater:water})]) {
    assert.match(text,/Map\/design and survey records disagree/,'capacity is not required to identify the recorded disagreement');
    assert.doesNotMatch(text,/2 500 L/);
  }
  const mixed=structuredClone(mapped);
  mixed.water!.tanks[0].status='mixed';
  for(const text of [waterPromptBlock(mixed,false,water),buildReportHeaderMarkdown({...headerBase,facts:mixed,surveyWater:water})]) {
    assert.match(text,/Map\/design and survey records need reconciliation/);
    assert.match(text,/tank group has mixed existing\/proposed status/);
    assert.match(text,/Installed quantity is not established/);
    assert.doesNotMatch(text,/a tank is recorded as existing/,'mixed status does not establish the whole group is installed');
  }
});

test('the separate site-survey prompt retains none alongside another storage answer', () => {
  const input={...survey,waterStorage:['none','jojo']};
  const before=JSON.stringify(input),prompt=surveyToPrompt(input,800);
  assert.match(prompt,/On-site water storage: none, jojo/,'the legacy section must not silently select the positive answer');
  assert.equal(JSON.stringify(input),before);
  assert.match(surveyToPrompt({...survey,waterStorage:['none']},800),/On-site water storage: none reported/);
  assert.match(surveyToPrompt({...survey,waterStorage:[]},800),/On-site water storage: not recorded/);
});

test('the site table describes recorded evidence and summaries without denying generated wording', () => {
  const text=buildReportHeaderMarkdown({...headerBase,facts:mapped,surveyWater:surveyWaterEvidence({waterStorage:['none']})});
  assert.doesNotMatch(text,/Nothing in this table was written by the report generator/);
  assert.match(text,/This table summarizes supplied map, design and survey records and the data sources named beside each row/);
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

test('legacy delivery strings agree between report prompt and header without coercing other survey fields', () => {
  for (const [delivery, expected] of [[' drip ', 'Drip irrigation'], ['none', 'Rain-fed only'],
    ['historic hose', 'unrecognized reported entry: historic hose']] as const) {
    const input = { waterDelivery: delivery, waterSource: 'borehole', waterStorage: 'jojo' };
    const before = JSON.stringify(input);
    const water = surveyWaterEvidence(input)!;
    assert.deepEqual(water.delivery, [delivery.trim()]);
    assert.deepEqual(water.sources, [], 'only delivery has a documented legacy scalar shape');
    assert.deepEqual(water.storage, []);
    const header = buildReportHeaderMarkdown({ ...headerBase, surveyWater: water });
    assert.ok(header.includes(expected));
    assert.doesNotMatch(header, /Sources: Borehole|Jojo \/ plastic tanks/);
    const prompt = surveyToPrompt(input as unknown as SiteSurvey, 800);
    assert.doesNotMatch(prompt, /Delivery \/ irrigation: not specified/);
    assert.equal(JSON.stringify(input), before);
  }
  const escaped = buildReportHeaderMarkdown({ ...headerBase,
    surveyWater: surveyWaterEvidence({ waterDelivery: 'historic|hose\n## Heading' }) });
  const row = escaped.split('\n').find(line => line.startsWith('| Water choices reported in survey'))!;
  assert.equal(row.split('|').length, 5, 'legacy delivery text cannot inject a table column');
  assert.doesNotMatch(escaped, /\n## Heading/);
});

test('new survey water header evidence is explicitly pending translation', () => {
  for(const language of ['zu','st','ts','ve']) {
    const header=buildReportHeaderMarkdown({...headerBase,facts:mapped,surveyWater:surveyWaterEvidence({...survey,waterStorage:['none']})},language);
    assert.match(header,/English; translation pending: Water choices reported in survey/);
    assert.match(header,/English; translation pending: Sources: Borehole/);
    assert.match(header,/English; translation pending: Not recorded in supplied map\/design facts:/);
    assert.match(header,/English; translation pending: Map\/design and survey records disagree/);
    assert.match(header,/English; translation pending: This table summarizes supplied map, design and survey records/);
  }
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
      {name:'legacy-delivery',facts:null,survey:{waterDelivery:'drip'}},
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
        assert.match(text,/Map\/design and survey records disagree/);
      }
      if(example.name==='mixed-survey-choice')for(const text of [body,prompt])assert.match(text,/Conflicting survey choices include none and another answer/);
      if(example.name==='indirect-sources')for(const text of [body,prompt]) {
        for(const label of ['Municipal tap','Rainwater','Grey water'])assert.ok(text.includes(label));
        assert.doesNotMatch(text,/Jojo \/ plastic tanks/);
      }
      if(example.name==='unanswered-survey')assert.match(body,/Sources: not recorded; delivery: not recorded; storage: not recorded/);
      if(example.name==='legacy-delivery') {
        assert.match(body,/delivery: Drip irrigation/);
        assert.match(prompt,/Delivery \/ irrigation: drip irrigation/);
        assert.match(prompt,/delivery: Drip irrigation/);
      }
      assert.equal(JSON.stringify(input),before);
    }
  } finally {
    globalThis.fetch=oldFetch;hooks.deregister();delete (globalThis as any)[key];
  }
});
