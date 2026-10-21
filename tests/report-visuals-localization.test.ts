import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import typescript from 'typescript';
import { REPORT_VISUAL_COPY, reportVisualText, reportChartAlt, reportChartSvg, reportYearRange, siteReportVisuals, sampleReportVisuals, withReportFigures, type ReportVisuals, type ReportChart } from '../lib/report-visuals.ts';
import { recordsMonthShort } from '../lib/records-months.ts';
import type { ReportSiteFacts } from '../lib/report-site-facts.ts';
import type { LocationData } from '../lib/types.ts';
import type { SampleGarden } from '../lib/sample-gardens.ts';
import type { ReportFigure } from '../lib/report-figures.ts';

const languages = ['zu','st','ts','ve'] as const;
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const fixture = JSON.parse(read('tests/fixtures/report-visuals-translation/source-cases.json')) as {
  cases: Array<{name:string;facts:ReportSiteFacts|null;location:LocationData;expected:ReportVisuals;svg:Record<string,ReturnType<typeof reportChartSvg>>}>;
  samples: Array<{garden:SampleGarden;expected:ReportVisuals;svg:Record<string,ReturnType<typeof reportChartSvg>>}>;
};
const pairs = JSON.parse(read('tests/fixtures/report-visuals-translation/source-pairs.json')) as Array<{file:string;english:string;zu:string}>;
const sources = new Map(REPORT_VISUAL_COPY.map(row=>[row.english,row]));
const tokens = (text:string) => (text.match(/\{\w+\}/g)??[]).sort();
const figures = (text:string) => (text.match(/\d+(?:[.,]\d+)?/g)??[]).sort();
const words = (svg:string) => [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map(row=>row[1].replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>')).join(' ');
const barWidths = (svg:string) => [...svg.matchAll(/<rect[^>]+height="14"[^>]*>/g)].map(row=>/\bwidth="([^"]+)"/.exec(row[0])![1]);

test('visual drafts keep source placeholders and figures and retain every prior English/isiZulu call-site pair', () => {
  assert.equal(sources.size,REPORT_VISUAL_COPY.length);
  for(const row of REPORT_VISUAL_COPY)for(const language of languages){
    assert.ok(row[language].trim());assert.notEqual(row[language],row.english,`${language}: English fallback for ${row.english}`);
    assert.deepEqual(tokens(row[language]),tokens(row.english));assert.deepEqual(figures(row[language]),figures(row.english));
  }
  const currentPairs: typeof pairs = [];
  for(const file of ['lib/report-visuals.ts','components/report/ReportVisualOverview.tsx']){
    const tree=typescript.createSourceFile(file,read(file),typescript.ScriptTarget.Latest,true,typescript.ScriptKind.TSX);
    function visit(node:typescript.Node){
      if(typescript.isCallExpression(node)&&typescript.isIdentifier(node.expression)&&['t','ui'].includes(node.expression.text)&&node.arguments[0]&&node.arguments[1]&&typescript.isStringLiteral(node.arguments[0])&&typescript.isStringLiteral(node.arguments[1]))currentPairs.push({file,english:node.arguments[0].text,zu:node.arguments[1].text});
      typescript.forEachChild(node,visit);
    }visit(tree);
  }
  assert.deepEqual(currentPairs,pairs,'the actual source-paired call sites retain all prior clauses');
  for(const pair of pairs){
    assert.ok(sources.has(pair.english));
    assert.ok(read(pair.file).includes(JSON.stringify(pair.english)) || read(pair.file).includes("'"+pair.english.replace(/'/g,"\\'")+"'"));
    assert.equal(reportVisualText(pair.english,'zu',{},pair.zu),pair.zu,'source-paired isiZulu context stays exact');
  }
  assert.equal(reportVisualText('Catalogue illustration: {name}','en',{name:'Original {count} name'}),'Catalogue illustration: Original {count} name');
});

test('a new chart or graphic control fails the source audit instead of silently remaining English', () => {
  function audit(name:string,text:string){
    const tree=typescript.createSourceFile(name,text,typescript.ScriptTarget.Latest,true,typescript.ScriptKind.TSX);
    function visit(node:typescript.Node){
      if(typescript.isCallExpression(node)&&typescript.isIdentifier(node.expression)&&['t','ui','copy','reportVisualText'].includes(node.expression.text)&&node.arguments[0]&&typescript.isStringLiteral(node.arguments[0]))assert.ok(sources.has(node.arguments[0].text),`unregistered visual source: ${node.arguments[0].text}`);
      typescript.forEachChild(node,visit);
    }visit(tree);
  }
  for(const file of ['lib/report-visuals.ts','components/report/ReportVisualOverview.tsx','components/report/ReportChapterGraphics.tsx'])audit(file,read(file));
  assert.throws(()=>audit('broken.tsx',"copy('New unregistered chart caution')"),/unregistered visual source/);
});

function assertQuantities(native:ReportVisuals,english:ReportVisuals){
  assert.equal(native.subtitle.split(' · ').length,english.subtitle.split(' · ').length);
  assert.deepEqual(native.metrics.map(row=>row.value),english.metrics.map(row=>row.value));
  assert.deepEqual(native.charts.map(chart=>[chart.id,chart.kind,chart.unit]),english.charts.map(chart=>[chart.id,chart.kind,chart.unit]));
  for(const [at,chart]of native.charts.entries()){
    const source=english.charts[at];assert.equal(chart.rows.length,source.rows.length);
    assert.deepEqual(chart.rows.map(row=>[row.value,row.months,row.once]),source.rows.map(row=>[row.value,row.months,row.once]),'translation cannot change plotted quantities or sowing identities');
    if(chart.kind==='calendar'||chart.id==='water')assert.deepEqual(chart.rows.map(row=>row.label),source.rows.map(row=>row.label),'saved crop/tank names are not inferred translations');
    if(chart.kind==='calendar')assert.deepEqual(chart.rows.map(row=>row.detail),source.rows.map(row=>row.detail),'saved bed labels stay exact');
    if(chart.kind==='bars')assert.deepEqual(barWidths(reportChartSvg(chart).svg),barWidths(reportChartSvg(source).svg),'longer wording cannot change bar proportions');
    assert.notEqual(chart.title,source.title,'the actual chart heading needs a native draft');
  }
}

test('all typed site charts retain prior English output and preserve native values, unknowns, qualifiers and records',()=>{
  for(const row of fixture.cases){
    const before=JSON.stringify(row);const en=siteReportVisuals(row.facts,row.location);
    assert.deepEqual(en,row.expected,row.name);
    for(const chart of en.charts)assert.deepEqual(reportChartSvg(chart),row.svg[chart.id],`${row.name}/${chart.id}: original English SVG changed`);
    for(const language of languages){
      const native=siteReportVisuals(row.facts,row.location,language);assert.equal(native.language,language);assertQuantities(native,en);
      assert.notEqual(native.basis,en.basis);
      if(row.facts?.farmName)assert.equal(native.title,row.facts.farmName);
      if(row.facts?.boundary)assert.equal(native.metrics.find(metric=>metric.value===en.metrics[0].value)?.note,row.facts.boundary.source);
      const rain=native.charts.find(chart=>chart.id==='rainfall');
      if(rain)assert.deepEqual(rain.rows.map(row=>row.label),Array.from({length:12},(_,at)=>recordsMonthShort(language,at+1)));
      for(const calendar of native.charts.filter(chart=>chart.kind==='calendar')){
        const alt=reportChartAlt(calendar);assert.ok(alt.includes(calendar.rows[0].label));
        for(const row of calendar.rows){for(const month of row.months??[])assert.ok(alt.includes(recordsMonthShort(language,month+1)));if(row.once?.length)assert.ok(alt.includes(reportVisualText('first season only',language)));}
        const svg=words(reportChartSvg(calendar).svg);for(let month=1;month<=12;month++)assert.ok(svg.includes(recordsMonthShort(language,month)));
      }
    }
    assert.equal(JSON.stringify(row),before,'painting charts must not mutate saved facts');
  }
});

test('all fictional garden charts preserve English values and retain their illustrative/unspecified-period cautions in native text',()=>{
  for(const row of fixture.samples){
    assert.deepEqual(sampleReportVisuals(row.garden),row.expected);
    for(const chart of row.expected.charts)assert.deepEqual(reportChartSvg(chart),row.svg[chart.id]);
    for(const language of languages){
      const native=sampleReportVisuals(row.garden,language);assertQuantities(native,row.expected);
      assert.equal(native.title,row.garden.name);assert.ok(native.subtitle.includes(row.garden.town));
      assert.ok(native.basis.includes(reportVisualText('The photograph is AI-generated. The layout is schematic, not to scale.',language)));
      assert.ok(native.metrics.some(metric=>metric.note===reportVisualText('Illustrative total; period unspecified',language)));
      const learning=native.charts.find(chart=>chart.id==='learning')!;
      assert.equal(learning.note,reportVisualText('{count} adult participants · Coordinator: {coordinator}. Training progress is not a measure of livelihood improvement.',language,{count:row.garden.farmers,coordinator:row.garden.facilitator}));
      const progress=words(reportChartSvg(learning).svg);assert.ok(progress.includes(reportVisualText('{remaining}% remaining',language,{remaining:100-row.garden.training})));
    }
  }
});

test('empty, unknown-capacity and long-label charts remain explicit without changing their plotted values',()=>{
  const row=fixture.cases[0];
  const facts:ReportSiteFacts={water:{tanks:[],statedStorageLitres:0,tanksOfUnknownCapacity:2,features:[]}} as unknown as ReportSiteFacts;
  for(const language of languages){
    const visuals=siteReportVisuals(facts,row.location,language);const metric=visuals.metrics.find(metric=>metric.value===reportVisualText('Not stated',language))!;
    assert.ok(metric);assert.ok(metric.note.startsWith('2 '));
    const chart:ReportChart={id:'empty',title:'Original chart label',note:'',unit:'L',kind:'bars',rows:[],language};
    assert.ok(words(reportChartSvg(chart).svg).includes(reportVisualText('No priced or measured values available',language)));
    assert.ok(reportChartAlt(chart).includes(reportVisualText('No priced or measured values available.',language)));
    const label=reportVisualText('Mapped beds and staple plots',language)+' · Original '.repeat(20);
    const long={...chart,rows:[{label,value:123.5}]};const result=reportChartSvg(long);
    assert.ok(result.height>150);assert.ok(words(result.svg).includes('123.5 L'));assert.equal(barWidths(result.svg).at(-1),'616');
    assert.equal(long.rows[0].label,label);
  }
});

test('figure metadata keeps figure objects and source text intact while translating chrome',()=>{
  const figure:ReportFigure={id:'climate',title:'Original figure title',note:'Original recorded note',source:'Original recorded source',svg:'<svg/>',width:640,height:300,alt:'Original recorded alternative description'};
  for(const language of languages){
    const visuals=withReportFigures(siteReportVisuals(null,fixture.cases[0].location,language),[figure],language);
    const chart=visuals.charts.find(chart=>chart.kind==='figure')!;
    assert.equal(chart.figure,figure);assert.equal(chart.unit,reportYearRange(language));assert.ok(chart.note.includes(reportVisualText('Source',language)+': Original recorded source'));
    assert.equal(visuals.slideHint,reportVisualText('Slide to see more',language));
  }
});

test('the real overview and chart components render native headers, empty messages and complete calendar alternatives',async()=>{
  const hooks=registerHooks({
    resolve(specifier,context,next){if(specifier.endsWith('.css'))return{url:'data:text/javascript,'+encodeURIComponent('export default new Proxy({}, {get:(_,key)=>key});'),shortCircuit:true};return next(specifier,context);},
    load(url,context,next){if(url.endsWith('.tsx'))return{format:'module',shortCircuit:true,source:typescript.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:typescript.JsxEmit.ReactJSX,module:typescript.ModuleKind.ESNext,target:typescript.ScriptTarget.ES2022}}).outputText};return next(url,context);}
  });
  try{
    const {default:Overview,ReportChartCard}=await import('../components/report/ReportVisualOverview.tsx');
    const {default:Graphics}=await import('../components/report/ReportChapterGraphics.tsx');
    const {Ctx}=await import('../lib/i18n-context.ts');
    for(const language of languages){
      const row=fixture.cases.find(row=>row.name==='saved demo plan')!;const native=siteReportVisuals(row.facts,row.location,language);
      const html=renderToStaticMarkup(React.createElement(Overview,{visuals:native}));
      assert.ok(html.includes(`lang="${language}"`));assert.ok(html.includes(reportVisualText('IMBEWUFIELD / SITE REPORT',language)));
      const calendar=native.charts.find(chart=>chart.kind==='calendar')!;
      const card=renderToStaticMarkup(React.createElement(ReportChartCard,{chart:calendar})).replace(/&#x27;/g,"'");
      assert.ok(card.includes(reportYearRange(language)));assert.ok(card.includes(reportVisualText('first season only',language)));
      const empty=renderToStaticMarkup(React.createElement(ReportChartCard,{chart:{...calendar,kind:'bars',rows:[]}}));assert.ok(empty.includes(reportVisualText('No priced or measured values available.',language)));
      const graphics=renderToStaticMarkup(React.createElement(Ctx.Provider,{value:{lang:language,t:key=>key,setLang(){},onboarded:true,completeOnboarding(){}}},React.createElement(Graphics,{graphics:[{id:'qa',title:'Original diagram title',note:'Original source note',svg:'<svg/>',trees:[{name:'Original recorded name',image:'/original.png'}]}]})));
      assert.ok(graphics.includes(reportVisualText('VISUAL FIELD GUIDE',language)));assert.ok(graphics.includes(reportVisualText('Catalogue illustration: {name}',language,{name:'Original recorded name'})));
    }
  }finally{hooks.deregister();}
});
