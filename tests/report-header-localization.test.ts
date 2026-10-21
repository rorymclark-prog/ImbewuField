import {reportVisualText} from '../lib/report-visuals.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {registerHooks} from 'node:module';
import typescript from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {stripInlineMarkdown} from '../lib/report-pdf.ts';
import {REPORT_DOCUMENT_LANGUAGES} from '../lib/report-localisation.ts';
import {buildReportHeaderMarkdown,absentWaterBodies,type ReportHeaderInput,type ReportSiteFacts} from '../lib/report-site-facts.ts';
import {reportDocumentText,reportRecordedSourceLabel,REPORT_DOCUMENT_COPY} from '../lib/report-localisation.ts';
import {recordsMonthRangeIndices,recordsSeasonLabel,recordsMonthShort,RECORDS_SEASON_COPY} from '../lib/records-months.ts';
import {siteReportFigures,climateFigure} from '../lib/report-figures.ts';
import {WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,roofHarvestLitres} from '../lib/roof-runoff.ts';
import {DEMO_LOCATION} from '../lib/demo-site.ts';
const read=(path:string)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fixture=JSON.parse(read('tests/fixtures/report-header-translation/source-cases.json')) as {sourceSha:string;cases:Array<{name:string;input:ReportHeaderInput;expected:string}>};
const visual=JSON.parse(read('tests/fixtures/report-figures-translation/source-cases.json'));
const packet=JSON.parse(read('docs/translation/four-language-completion/report-header-drafts.json')) as {status:string;sourceSha:string;entries:typeof REPORT_DOCUMENT_COPY;seasons:typeof RECORDS_SEASON_COPY;preservedSourceIdentities:string[]};
const languages=['zu','st','ts','ve'] as const;
const values=new Map(REPORT_DOCUMENT_COPY.map(row=>[row.english,row]));
const tokens=(s:string)=>(s.match(/\{\w+\}/g)??[]).sort();
// A Zulu noun prefix such as engu-7 is not negative seven; a free-standing minus still is.
const numbers=(s:string)=>(s.match(/(?<![\p{L}\p{N}])-?\d+(?:[.,]\d+)?/gu)??[]).sort();
const rows=(s:string)=>s.split('\n').filter(l=>l.startsWith('| ')&&!l.includes('|---')).map(line=>line.slice(1,-1).split('|').map(c=>c.trim()));
function cell(markdown:string,source:string,language:string){return rows(markdown).find(r=>r[0]===reportDocumentText(source,language))!;}

test('all original English header variants and diagram bytes survive the shared month-parser change',()=>{
 const before=JSON.stringify(fixture);for(const row of fixture.cases){assert.equal(buildReportHeaderMarkdown(row.input),row.expected,row.name);assert.equal(buildReportHeaderMarkdown(row.input,'af'),row.expected);}
 assert.deepEqual(siteReportFigures(visual.facts,visual.location,'en',{canvas:visual.canvas,mapLayers:visual.refs,phasePlan:visual.phasePlan}),visual.figures.en);
 assert.equal(JSON.stringify(fixture),before);
});

test('header drafts are bound to source figures/placeholders and every authored field/value/source remains registered',()=>{
 assert.match(packet.status,/Unreviewed AI drafts/);assert.equal(packet.sourceSha,fixture.sourceSha);assert.deepEqual(packet.seasons,RECORDS_SEASON_COPY);
 for(const row of packet.entries){assert.deepEqual(values.get(row.english),row);for(const lang of languages){assert.ok(row[lang].trim());assert.notEqual(row[lang],row.english);assert.deepEqual(tokens(row[lang]),tokens(row.english));assert.deepEqual(numbers(row[lang]),numbers(row.english));}}
 const audit=(source:string)=>{const tree=typescript.createSourceFile('header.ts',source,typescript.ScriptTarget.Latest,true);
  const known=(n:typescript.Node)=>{if(typescript.isStringLiteral(n))assert.ok(values.has(n.text),`unregistered header source: ${n.text}`);else if(typescript.isConditionalExpression(n)){known(n.whenTrue);known(n.whenFalse);}};
  function visit(n:typescript.Node){if(typescript.isCallExpression(n)&&typescript.isIdentifier(n.expression)){
   if(['t','row'].includes(n.expression.text)&&n.arguments[0])known(n.arguments[0]);
   if(n.expression.text==='row')for(const n2 of n.arguments.slice(1))if(typescript.isStringLiteral(n2))assert.ok(packet.preservedSourceIdentities.includes(n2.text),`unwrapped authored source/value: ${n2.text}`);
  }typescript.forEachChild(n,visit);}visit(tree);
 };
 const source=typescript.createSourceFile('facts.ts',read('lib/report-site-facts.ts'),typescript.ScriptTarget.Latest,true);const fn=source.statements.find(n=>typescript.isFunctionDeclaration(n)&&n.name?.text==='buildReportHeaderMarkdown');assert.ok(fn);audit(fn.getText(source));
 assert.throws(()=>audit("row('New unregistered measurement',value,source)"),/unregistered header source/);
 assert.throws(()=>audit("row('Site','New untranslated missing-value message',source)"),/unwrapped authored source/);
 // Data-origin labels are deliberately dynamic; a new fixed soil-source claim still needs a draft.
 const soil=source.statements.find(n=>typescript.isVariableStatement(n)&&n.declarationList.declarations.some(d=>typescript.isIdentifier(d.name)&&d.name.text==='SOIL_SOURCE_LABEL'));assert.ok(soil);const found:string[]=[];function soilWords(n:typescript.Node){if(typescript.isPropertyAssignment(n)&&typescript.isStringLiteral(n.initializer))found.push(n.initializer.text);typescript.forEachChild(n,soilWords);}soilWords(soil);for(const text of found)assert.ok(values.has(text));
 const bodyKinds=read('lib/report-site-facts.ts').match(/const WATER_BODY_KINDS = \[([^\]]+)\]/)![1];for(const m of bodyKinds.matchAll(/'([^']+)'/g))assert.ok(values.has(m[1]));
});

test('native header labels and provenance translate without changing any measured value, name, source record or input',()=>{
 for(const row of fixture.cases)for(const lang of languages){const before=JSON.stringify(row.input);const native=buildReportHeaderMarkdown(row.input,lang);const englishRows=rows(row.expected),nativeRows=rows(native);
  assert.equal(nativeRows.length,englishRows.length);assert.deepEqual(numbers(native),numbers(row.expected),`${row.name}/${lang}: source numbers changed`);
  assert.deepEqual(nativeRows[0],[reportDocumentText('Measure',lang),reportDocumentText('Value',lang),reportDocumentText('Where it comes from',lang)]);
  for(let i=1;i<englishRows.length;i++)assert.equal(nativeRows[i][0],reportDocumentText(englishRows[i][0],lang),`${row.name}: field label`);
  const rawSources=new Set([row.input.facts?.boundary?.source,row.input.facts?.roof?.source,...packet.preservedSourceIdentities]);
  for(let i=1;i<englishRows.length;i++){if(rawSources.has(englishRows[i][2]))assert.equal(nativeRows[i][2],reportRecordedSourceLabel(englishRows[i][2],lang));else assert.notEqual(nativeRows[i][2],englishRows[i][2],`${lang}: English provenance ${englishRows[i][2]}`);}
  for(const value of [row.input.facts?.farmName,row.input.vegUnit,row.input.bruLabel,...(row.input.facts?.design?.elements.map(e=>e.name)??[]),...(row.input.facts?.water?.tanks.map(t=>t.name)??[]),...(row.input.facts?.water?.mapPoints.map(p=>p.name)??[])])if(value&&row.expected.includes(value))assert.ok(native.includes(value),`${lang}: changed saved name/source ${value}`);
  for(const source of ['Not traced','Not traced or measured','capacity not stated'])if(englishRows.some(r=>r[1]===source))assert.ok(nativeRows.some(r=>r[1]===reportDocumentText(source,lang)));
  assert.ok(cell(native,'Soil (0-30 cm)',lang)[1].includes(row.input.soilSource==='lab'?row.input.soilTexture:reportVisualText(row.input.soilTexture,lang)));
  assert.equal(JSON.stringify(row.input),before);
 }
});

test('recorded labels that happen to equal authored words stay raw and categories change only for exact existing IDs',()=>{
 const base=fixture.cases[0].input;const facts=structuredClone(base.facts!);facts.farmName='Not traced';facts.boundary!.source='Named by the farmer';facts.roof!.source='Design Studio';facts.water!.tanks[0].name='capacity not stated';
 const registry=read('lib/water-points.ts').match(/export const WATER_POINT_CATEGORIES:[\s\S]*?= \[([\s\S]*?)\n\];/)![1];
 const knownCategories=[...registry.matchAll(/v: '([^']+)'/g)].map(m=>m[1]);
 const categories=[...knownCategories,'constructor','Recorded custom class','dam'];
 facts.water!.mapPoints=categories.map(category=>({name:'Recorded '+category,category}));
 const input={...base,facts};const before=JSON.stringify(input);
 for(const lang of languages){const native=buildReportHeaderMarkdown(input,lang);assert.equal(cell(native,'Site',lang)[1],'Not traced');assert.equal(cell(native,'Property boundary',lang)[2],'Named by the farmer');assert.equal(cell(native,'Roof catchment traced',lang)[2],'Design Studio');assert.ok(cell(native,'Water storage on the plan',lang)[1].includes('capacity not stated'));
  const points=cell(native,'Water points recorded',lang)[1];for(const category of categories){assert.ok(points.includes('Recorded '+category));if(category==='Other')assert.ok(!points.includes('[Other]'));else if(knownCategories.includes(category))assert.ok(points.includes('['+reportDocumentText(category.toLowerCase(),lang)+']'));else assert.ok(points.includes('['+category+']'));}
 }
 assert.equal(JSON.stringify(input),before);
 // Source categories live in the water-point registry. A new choice must not silently remain English here.
 for(const category of knownCategories)if(category!=='Other')assert.ok(values.has(category.toLowerCase()));
});

test('missing water stays absent, recorded water is never denied and proposed storage never turns into installed water',()=>{
 const base=fixture.cases[0].input;const kinds=['dam','pond','reservoir','borehole','well','spring','river'];
 for(const lang of languages){for(const kind of kinds){const facts=structuredClone(base.facts!) as ReportSiteFacts;facts.water!.mapPoints=[{name:kind,category:kind}];facts.water!.bodies=[];
   const absent=absentWaterBodies(facts,false);assert.ok(!absent.includes(kind));const table=buildReportHeaderMarkdown({...base,facts},lang);const denial=cell(table,'Not on this site',lang)[1];assert.equal(denial,absent.map((body,i)=>reportDocumentText(i?'no {body}':'No {body}',lang,{body:reportDocumentText(body,lang)})).join(', '));
  }
  assert.equal(cell(buildReportHeaderMarkdown({...base,facts:null,hasMapWaterPolygons:true},lang),'Not on this site',lang),undefined);
  for(const state of ['proposed','existing','mixed']as const){const facts=structuredClone(base.facts!);facts.water!.tanks=facts.water!.tanks.map(t=>({...t,status:state}));const table=buildReportHeaderMarkdown({...base,facts},lang);const value=cell(table,'Water storage on the plan',lang)[1];const proposed=reportDocumentText('{value} (drawn as proposed)',lang,{value:''}).trim();assert.equal(value.endsWith(proposed),state==='proposed');}
 }
});

test('shared seasonal labels retain every source month and diagram season mark, including year-end wrapping',()=>{
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 for(let from=0;from<12;from++)for(let to=0;to<12;to++){const source=months[from]+'–'+months[to];const indices=recordsMonthRangeIndices(source);assert.equal(indices[0],from);assert.equal(indices.at(-1),to);assert.equal(indices.length,(to-from+12)%12+1);assert.equal(new Set(indices).size,indices.length);
  for(const lang of languages)assert.equal(recordsSeasonLabel(lang,source),recordsMonthShort(lang,from+1)+'–'+recordsMonthShort(lang,to+1));
  assert.equal(recordsSeasonLabel('en',source),source);assert.equal(recordsSeasonLabel('af',source),source);
 }
 for(const lang of languages){for(const row of RECORDS_SEASON_COPY)assert.equal(recordsSeasonLabel(lang,row.english),row[lang]);for(const text of ['Recorded wet period','not specified','Jan / Feb','constructor','JAN–MAR custom'])assert.equal(recordsSeasonLabel(lang,text),text);
  const input={...fixture.cases[0].input,wetSeason:'year-round',drySeason:'none'};const native=buildReportHeaderMarkdown(input,lang);assert.ok(native.includes(recordsSeasonLabel(lang,'year-round')));assert.ok(native.includes(recordsSeasonLabel(lang,'none')));
  const expected=visual.figures.en.find((f:any)=>f.id==='climate');const figure=climateFigure(visual.location,lang)!;// Native captions already move the plot down. Preserve each month mark's identity and size,
  // rather than pinning the English page position; every native mark must still share one row.
  const marks=(svg:string)=>[...svg.matchAll(/<rect[^>]+height="7"[^>]*>/g)].map(m=>m[0].replace(/ y="[^"]+"/,''));assert.deepEqual(marks(figure.svg),marks(expected.svg));
  assert.equal(new Set([...figure.svg.matchAll(/<rect[^>]+height="7"[^>]*>/g)].map(m=>/ y="([^"]+)"/.exec(m[0])![1])).size,1);
 }
 assert.deepEqual(recordsMonthRangeIndices(undefined),[]);assert.deepEqual(recordsMonthRangeIndices('unknown'),[]);
});

test('the header keeps roof runoff arithmetic and scale correction as source values rather than applying them twice',()=>{
 const input=fixture.cases.find(r=>r.name==='farmer-observations')!.input;const before=JSON.stringify(input);const harvest=Math.round(roofHarvestLitres(input.facts!.roof!.areaM2,input.rainfallMm,WATER_SHEET_ROOF_RUNOFF_COEFFICIENT));
 for(const lang of languages){const native=buildReportHeaderMarkdown(input,lang);const roof=cell(native,'Roof catchment traced',lang)[1];assert.ok(roof.includes(String(WATER_SHEET_ROOF_RUNOFF_COEFFICIENT)));assert.ok(roof.replaceAll(' ','').includes(String(harvest)));assert.ok(cell(native,"Farmer's scale correction",lang)[1].includes('1.25x'));const wind=cell(native,'Wind observed on site',lang)[1];assert.ok(wind.includes('ENE'));assert.ok(wind.includes('SSW'));}
 assert.equal(JSON.stringify(input),before);
});

test('the real API emits the translated measurement table with the same supplied values and source identities',async()=>{
 const module=(s:string)=>'data:text/javascript,'+encodeURIComponent(s);const calls:any[]=[];const key=Symbol.for('imbewu-header-provider-stub');(globalThis as any)[key]=calls;
 const hooks=registerHooks({resolve(s,c,next){if(s==='@anthropic-ai/sdk')return{url:module('export default class Anthropic{}'),shortCircuit:true};if(s==='next/server')return{url:module('export class NextRequest{}'),shortCircuit:true};if(s==='@/lib/api-auth')return{url:module('export async function guardPaidApiRequest(){return {uid:"header-test"};}'),shortCircuit:true};if(s==='@/lib/metered-ai')return{url:module(`export const AI_MODELS={main:'claude-sonnet-4-6'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async request=>{globalThis[Symbol.for('imbewu-header-provider-stub')].push(request);return {usage:{},stop_reason:'end_turn',content:[{type:'text',text:'## Mocked body\\nOriginal mocked response.'}]};}}}};}`),shortCircuit:true};return next(s,c);}});
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{}');
 try{const {POST}=await import('../app/api/generate-report/route.ts');for(const language of ['en',...languages]){calls.length=0;const response=await POST(new Request('http://localhost/api/generate-report',{method:'POST',body:JSON.stringify({language,locationData:DEMO_LOCATION,sections:['Executive Summary']})})as any);assert.equal(response.status,200);const text=await response.text();assert.equal(calls.length,1);
  const start=text.indexOf('## '+reportDocumentText('Site at a Glance',language));assert.ok(start>=0);const table=text.slice(start,text.indexOf('## 1. Mocked body'));assert.ok(table.includes(`| ${reportDocumentText('Measure',language)} | ${reportDocumentText('Value',language)} | ${reportDocumentText('Where it comes from',language)} |`));assert.ok(cell(table,'Annual rainfall',language)[1].includes(String(DEMO_LOCATION.rainfall.annual)+' mm'));assert.ok(cell(table,'Soil (0-30 cm)',language)[1].includes('pH '+DEMO_LOCATION.soil.ph));if(language!=='en')assert.ok(!table.includes('| Property boundary |'));
 }}finally{globalThis.fetch=original;hooks.deregister();delete(globalThis as any)[key];}
});


test('the actual reader wraps native field/source columns without breaking values or changing other tables',()=>{
 const tree=typescript.createSourceFile('ReportView.tsx',read('components/ReportView.tsx'),typescript.ScriptTarget.Latest,true,typescript.ScriptKind.TSX);const fn=tree.statements.find(n=>typescript.isFunctionDeclaration(n)&&n.name?.text==='renderReport');assert.ok(fn);
 const js=typescript.transpileModule(fn.getText(tree),{compilerOptions:{jsx:typescript.JsxEmit.React,module:typescript.ModuleKind.None,target:typescript.ScriptTarget.ES2022}}).outputText;
 const renderer=new Function('React','stripInlineMarkdown','ReportChapterGraphics','ChevronRight','REPORT_DOCUMENT_LANGUAGES','reportDocumentText',js+';return renderReport;')(React,stripInlineMarkdown,()=>null,()=>null,REPORT_DOCUMENT_LANGUAGES,reportDocumentText);
 const render=(markdown:string)=>renderToStaticMarkup(React.createElement('div',null,...renderer(markdown)));
 for(const lang of languages){const source=buildReportHeaderMarkdown(fixture.cases[0].input,lang),html=render(source);const cells=[...html.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];assert.ok(cells.length>3);
  for(let i=0;i<cells.length;i++)assert.equal(cells[i][1].includes('overflow-wrap:anywhere'),i%3!==1,'measurement values must not gain arbitrary word breaks');
  assert.ok(html.includes('0.8'));assert.ok(html.includes('6.5'));
 }
 assert.ok(!render(fixture.cases[0].expected).includes('overflow-wrap:anywhere'),'saved English table styling stays unchanged');
 assert.ok(!render('| Item | Quantity | Unit price |\n|---|---|---|\n| Recorded item | 0.75 | 2.5 |').includes('overflow-wrap:anywhere'),'a cost table must not inherit measurement-table column roles');
});


test('only recognized collector provenance translates, with original vertex digits and custom source text intact',()=>{
 for(const lang of languages){for(const text of ['Traced on the map','Traced by the farmer on the map','Traced by the farmer in the Design Studio'])assert.equal(reportRecordedSourceLabel(text,lang),reportDocumentText(text,lang));
  const source='Traced by the farmer in the Design Studio (004 points)';assert.equal(reportRecordedSourceLabel(source,lang),reportDocumentText('Traced by the farmer in the Design Studio ({count} points)',lang,{count:'004'}));assert.equal(reportRecordedSourceLabel(source),source);
  for(const text of ['Named by the farmer','Design Studio','Recorded custom source','Traced by the farmer in the Design Studio (four points)','Traced by the farmer on the map: recorded annotation'])assert.equal(reportRecordedSourceLabel(text,lang),text);
 }
 const collector=typescript.createSourceFile('collector.ts',read('lib/report-site-facts-collect.ts'),typescript.ScriptTarget.Latest,true);
 const sourceWords=(n:typescript.Node)=>{if(typescript.isStringLiteral(n))assert.ok(values.has(n.text),`unregistered collector provenance: ${n.text}`);else if(typescript.isConditionalExpression(n)){sourceWords(n.whenTrue);sourceWords(n.whenFalse);}else if(typescript.isTemplateExpression(n)){assert.equal(n.templateSpans.length,1);assert.equal(n.templateSpans[0].expression.getText(collector),'studioBoundary.vertexCount');assert.ok(values.has(n.head.text+'{count}'+n.templateSpans[0].literal.text));}};
 function visit(n:typescript.Node){if(typescript.isPropertyAssignment(n)&&n.name.getText(collector)==='source')sourceWords(n.initializer);typescript.forEachChild(n,visit);}visit(collector);
});


test('model soil classes reuse existing native diagram wording while laboratory and unknown classes stay as recorded',()=>{
 const base=fixture.cases[0].input;
 for(const lang of languages){for(const soilSource of ['soilgrids','estimate','lab']as const){const input={...base,soilSource,soilTexture:'Loam'};const before=JSON.stringify(input);const soil=cell(buildReportHeaderMarkdown(input,lang),'Soil (0-30 cm)',lang)[1];assert.ok(soil.includes(soilSource==='lab'?'Loam':reportVisualText('Loam',lang)));assert.equal(JSON.stringify(input),before);}
  const recorded='Recorded custom texture';assert.ok(cell(buildReportHeaderMarkdown({...base,soilTexture:recorded},lang),'Soil (0-30 cm)',lang)[1].includes(recorded));
 }
});
