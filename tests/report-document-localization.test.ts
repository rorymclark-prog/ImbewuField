import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {registerHooks} from 'node:module';
import typescript from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {stripInlineMarkdown} from '../lib/report-pdf.ts';
import {buildCoverMarkdown,preparedFromLabel,documentReference,type ReportCoverInput} from '../lib/report-cover.ts';
import {assembleReportDocument,type AssembleInput} from '../lib/report-assemble.ts';
import {numberFigures,numberSections,ensureDocumentArchitecture,buildContents,buildListOfFigures} from '../lib/report-structure.ts';
import {REPORT_DOCUMENT_COPY,REPORT_DOCUMENT_LANGUAGES,reportDocumentText} from '../lib/report-localisation.ts';
import {DEMO_LOCATION} from '../lib/demo-site.ts';
const read=(path:string)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fixture=JSON.parse(read('tests/fixtures/report-document-translation/source-cases.json')) as {sourceSha:string;covers:Array<{input:ReportCoverInput;expected:string;prepared:string}>;assembly:{input:AssembleInput;expected:ReturnType<typeof assembleReportDocument>};legacy:{input:string;expected:string}};
const code=['zu','st','ts','ve'] as const;
const sources=new Map(REPORT_DOCUMENT_COPY.map(row=>[row.english,row]));
const tokens=(s:string)=>(s.match(/\{\w+\}/g)??[]).sort();
const digits=(s:string)=>(s.match(/\d+/g)??[]).sort();

test('English covers, references, provenance, assembly and legacy architecture remain exact to the original source',()=>{
 const before=JSON.stringify(fixture);
 for(const row of fixture.covers){assert.equal(buildCoverMarkdown(row.input),row.expected);assert.equal(preparedFromLabel(row.input.sources),row.prepared);}
 assert.deepEqual(assembleReportDocument(fixture.assembly.input),fixture.assembly.expected);
 assert.equal(ensureDocumentArchitecture(fixture.legacy.input),fixture.legacy.expected);
 assert.equal(JSON.stringify(fixture),before);
});

test('document drafts preserve source numbers and placeholders and newly authored words cannot silently fall back to English',()=>{
 const packet=JSON.parse(read('docs/translation/four-language-completion/report-document-drafts.json')) as {status:string;sourceSha:string;entries:typeof REPORT_DOCUMENT_COPY};
 assert.match(packet.status,/Unreviewed AI drafts/);assert.equal(packet.sourceSha,fixture.sourceSha);
 // This dated packet binds its own entries. New declared batches may extend the shared authority;
 // comparing the entire growing table to this older packet would pin a count rather than wording.
 for(const row of packet.entries)assert.deepEqual(sources.get(row.english),row);
 assert.equal(sources.size,REPORT_DOCUMENT_COPY.length);
 for(const row of REPORT_DOCUMENT_COPY)for(const lang of code){assert.ok(row[lang].trim());assert.notEqual(row[lang],row.english);assert.deepEqual(tokens(row[lang]),tokens(row.english));assert.deepEqual(digits(row[lang]),digits(row.english));}
 const audit=(source:string)=>{const tree=typescript.createSourceFile('doc.ts',source,typescript.ScriptTarget.Latest,true);function literal(n:typescript.Node){if(typescript.isStringLiteral(n))assert.ok(sources.has(n.text),`missing document source: ${n.text}`);else if(typescript.isConditionalExpression(n)){literal(n.whenTrue);literal(n.whenFalse);}}function visit(n:typescript.Node){if(typescript.isCallExpression(n)&&typescript.isIdentifier(n.expression)&&['t','reportDocumentText'].includes(n.expression.text)&&n.arguments[0])literal(n.arguments[0]);typescript.forEachChild(n,visit);}visit(tree);};
 for(const file of ['lib/report-cover.ts','lib/report-structure.ts','app/api/generate-report/route.ts'])audit(read(file));
 assert.throws(()=>audit("reportDocumentText('Unregistered new document caveat',lang)"),/missing document source/);
 for(const lang of code){assert.equal(reportDocumentText('Figure {number} — {caption}',lang,{number:7,caption:'Saved {number} & raw name'}),reportDocumentText('Figure {number} — {caption}',lang,{number:7,caption:'PLACEHOLDER'}).replace('PLACEHOLDER','Saved {number} & raw name'));
  assert.equal(reportDocumentText('Unknown source label',lang),'Unknown source label');
 }
 assert.equal(reportDocumentText('Contents','unsupported'),'Contents');
});

test('all native covers name only supplied sources and retain original identity, coordinates, counts and certification caveats',()=>{
 for(const lang of code)for(const row of fixture.covers){const before=JSON.stringify(row.input);const native=buildCoverMarkdown(row.input,lang);const t=(source:string)=>reportDocumentText(source,lang);
  assert.ok(native.startsWith('# '+t('Permaculture Site Report').split(' — ')[0]));assert.ok(native.includes(documentReference(row.input)));
  const coordinate=row.expected.split('\n').find(l=>l.includes('°'))!;assert.ok(native.includes(coordinate));
  assert.ok(native.includes(row.input.dateLabel));if(row.input.farmName)assert.ok(native.includes(row.input.farmName));
  assert.ok(native.includes(t('For the farmer\'s use and discussion. Not a professional engineering, agronomic or financial certification.')));
  assert.ok(native.includes(t('Draft translation: not yet reviewed by a fluent speaker. Check the English source before acting.')));
  assert.ok(native.includes(t('1 — first issue')));assert.ok(native.includes(String(row.input.sectionCount)));
  const provenance=native.split('\n').find(line=>line.startsWith('| '+t('Prepared by')+' |'))!;assert.ok(provenance);
  for(const [flag,source]of [['map','map'],['survey','survey'],['cropPlan','crop plan']]as const)assert.equal(provenance.includes(t(source)),row.input.sources[flag],`${lang}: false or missing ${source} provenance`);
  if(!Object.values(row.input.sources).some(Boolean))assert.ok(provenance.includes(t("ImbewuField, from this site's location and public environmental data")));
  assert.equal(JSON.stringify(row.input),before);
 }
});

test('native contents and figure words preserve final numbering, source alternatives, URLs, fences and legacy idempotence',()=>{
 for(const lang of code){const t=(source:string)=>reportDocumentText(source,lang);const input={...fixture.assembly.input,language:lang,cover:'# Original title\n\n## '+t('Document control')+'\n\nRecord',glance:'## '+t('Site at a Glance')+'\n\nOriginal source 25 m².'};const before=JSON.stringify(input);const out=assembleReportDocument(input);
  assert.equal(out.sectionCount,fixture.assembly.expected.sectionCount);assert.equal(out.figureCount,2);
  for(const label of ['Document control','Site at a Glance','Contents','Figures'])assert.ok(out.markdown.includes('## '+t(label)));
  assert.ok(out.markdown.includes('## 1. Original chapter'));assert.ok(out.markdown.includes('## 2. Second original chapter'));assert.ok(out.markdown.includes('## 3. Original closing section'));
  assert.ok(out.markdown.includes(reportDocumentText('Figure {number} — {caption}',lang,{number:1,caption:'Original image'})));
  assert.ok(out.markdown.includes(reportDocumentText('Figure {number} — {caption}',lang,{number:2,caption:t('Figure not captioned')})));
  for(const source of ['![Original image](/original.png)','![](/empty.png)','Inline ![Inline](/inline.png).','```\n![In code](/code.png)\n```','Original source 25 m².','Saved body.','Do not rewrite.'])assert.ok(out.markdown.includes(source));
  assert.equal(ensureDocumentArchitecture(out.markdown,lang),out.markdown);assert.equal(ensureDocumentArchitecture(out.markdown,'en'),out.markdown,'exporting a native saved report must not add an English contents page');
  const legacy=ensureDocumentArchitecture(fixture.legacy.input,lang);assert.ok(legacy.includes('## '+t('Contents')));assert.equal(ensureDocumentArchitecture(legacy,lang),legacy);
  assert.equal(buildContents([],lang),'');assert.equal(buildListOfFigures([],lang),'');assert.deepEqual(numberSections('## '+t('Document control')+'\n## First body').headings.map(h=>h.number),['1']);
  assert.equal(numberFigures('![Saved {caption}](/raw.png)',lang).figures[0],reportDocumentText('Figure {number} — {caption}',lang,{number:1,caption:'Saved {caption}'}));assert.equal(JSON.stringify(input),before);
 }
});

test('the real generator emits native covers and honest native incomplete, rejected and failed section messages without a provider call',async()=>{
 const control={mode:'pass',requests:[]as any[]};const key=Symbol.for('imbewu-report-document-mock');(globalThis as any)[key]=control;
 const module=(s:string)=>'data:text/javascript,'+encodeURIComponent(s);const hooks=registerHooks({resolve(s,c,next){
  if(s==='@anthropic-ai/sdk')return {url:module('export default class Anthropic {}'),shortCircuit:true};
  if(s==='next/server')return {url:module('export class NextRequest {}'),shortCircuit:true};
  if(s==='@/lib/api-auth')return {url:module('export async function guardPaidApiRequest(){return {uid:"document-translation-test"};}'),shortCircuit:true};
  if(s==='@/lib/metered-ai')return {url:module(`export const AI_MODELS={main:'claude-sonnet-4-6'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async request=>{const c=globalThis[Symbol.for('imbewu-report-document-mock')];c.requests.push(request);if(c.mode==='failure')throw new Error('deliberate provider failure');return {usage:{},stop_reason:c.mode==='limit'?'max_tokens':'end_turn',content:[{type:'text',text:c.mode==='unsafe'?'Guava':'## Mocked source heading\\nOriginal mocked body.'}]};}}}};}`),shortCircuit:true};
  return next(s,c);
 }});const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('{}');
 try{const {POST}=await import('../app/api/generate-report/route.ts');for(const lang of code)for(const mode of ['pass','limit','unsafe','failure']){
  control.mode=mode;control.requests.length=0;const response=await POST(new Request('http://localhost/api/generate-report',{method:'POST',body:JSON.stringify({locationData:DEMO_LOCATION,sections:['Executive Summary'],language:lang})})as any);assert.equal(response.status,200);const text=await response.text();
  assert.ok(text.includes('## '+reportDocumentText('Contents',lang))||mode==='failure'||mode==='unsafe');
  assert.ok(text.includes(reportDocumentText('Document control',lang)));assert.ok(text.includes(reportDocumentText('Draft translation: not yet reviewed by a fluent speaker. Check the English source before acting.',lang)));
  const source=mode==='limit'?'This section may be incomplete: the model reached its output limit.':mode==='unsafe'?'This section could not be safely generated because it named a listed invasive plant. Please regenerate the report.':mode==='failure'?'A section could not be generated — please regenerate the report.':null;
  if(source){assert.ok(text.includes(reportDocumentText(source,lang)));assert.ok(!text.includes(source));}if(mode==='unsafe')assert.ok(!text.includes('Guava'),'a rejected draft must never leak its listed plant into the saved report');assert.equal(control.requests.length,mode==='unsafe'?2:1);
 }}finally{globalThis.fetch=originalFetch;hooks.deregister();delete(globalThis as any)[key];}
});


test('the actual reader preserves decimal coordinates and areas while ordinary numbered actions remain lists',()=>{
 const tree=typescript.createSourceFile('ReportView.tsx',read('components/ReportView.tsx'),typescript.ScriptTarget.Latest,true,typescript.ScriptKind.TSX);
 const fn=tree.statements.find(n=>typescript.isFunctionDeclaration(n)&&n.name?.text==='renderReport');assert.ok(fn);
 function render(source:string,markdown:string){const js=typescript.transpileModule(source,{compilerOptions:{jsx:typescript.JsxEmit.React,module:typescript.ModuleKind.None,target:typescript.ScriptTarget.ES2022}}).outputText;
  const renderer=new Function('React','stripInlineMarkdown','ReportChapterGraphics','ChevronRight',js+';return renderReport;')(React,stripInlineMarkdown,()=>null,()=>null);
  return renderToStaticMarkup(React.createElement('div',null,...renderer(markdown)));
 }
 const markdown='28.6280° S, 29.8910° E\n0.75 ha\n1. First action\n2. **Second action** — original text.\n1.Not a Markdown list\n- Original bullet';
 const source=fn.getText(tree),html=render(source,markdown);
 assert.ok(html.includes('28.6280° S, 29.8910° E</p>'));assert.ok(html.includes('0.75 ha</p>'));
 assert.ok(html.includes('1.Not a Markdown list</p>'));assert.ok(html.includes('First action</p>'));assert.ok(html.includes('Second action</span>'));assert.ok(html.includes('Original bullet</p>'));
 assert.equal((html.match(/>[12]\.<\/span>/g)??[]).length,2);
 const old=source.replace('line.match(/^\\d+\\.\\s/)','line.match(/^\\d+\\./)').replace('line.replace(/^\\d+\\.\\s+/,','line.replace(/^\\d+\\.\\s*/,');
 assert.notEqual(old,source);assert.ok(!render(old,markdown).includes('28.6280° S, 29.8910° E</p>'),'the test must detect the original decimal/list collision');
});
