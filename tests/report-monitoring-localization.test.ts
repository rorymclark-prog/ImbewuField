import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {registerHooks}from'node:module';
import ts from'typescript';
import {buildMonitoringPlan,monitoringMarkdown,type MonitoringRow}from'../lib/report-monitoring.ts';
import {buildRiskRegister,riskRegisterMarkdown,type RiskInput}from'../lib/report-risk.ts';
import {ASSURANCE_PARAGRAPHS,planAssuranceText}from'../lib/plan-assurance.ts';
import {assuranceMarkdown}from'../lib/report-site-facts.ts';
import {REPORT_DOCUMENT_COPY,reportDocumentText,zuluReportClosingNotes}from'../lib/report-localisation.ts';
import {buildBillOfQuantities,billOfQuantitiesMarkdown}from'../lib/report-boq.ts';
import type{ReportSiteFacts}from'../lib/report-site-facts.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fx=JSON.parse(read('tests/fixtures/report-monitoring-translation/source-cases.json'));
const packet=JSON.parse(read('docs/translation/four-language-completion/report-monitoring-drafts.json'));
const languages=['zu','st','ts','ve']as const;
const words=new Map(REPORT_DOCUMENT_COPY.map(r=>[r.english,r]));
const numbers=(s:string)=>(s.match(/(?<![\p{L}\p{N}])-?\d+(?:[.,]\d+)?/gu)??[]).sort();
const tokens=(s:string)=>(s.match(/\{\w+\}/g)??[]).sort();

test('source monitoring rows, all risk boundaries and English markdown stay exact while native-only closing notes retain their original text',()=>{
 assert.equal(fx.sourceSha,'013cec5286cfb6c7251e48a5907bb8548c80a25d');for(const c of fx.monitoring){assert.deepEqual(buildMonitoringPlan(c.facts),c.rows,c.name);assert.deepEqual(buildMonitoringPlan(c.facts,'af'),c.rows);assert.equal(monitoringMarkdown(buildMonitoringPlan(c.facts)),c.markdown);assert.equal(monitoringMarkdown(buildMonitoringPlan(c.facts,'af'),'af'),c.markdown);}
 for(const c of fx.risks){assert.deepEqual(buildRiskRegister(c.input),c.rows,c.name);assert.deepEqual(buildRiskRegister(c.input,'af'),c.rows);assert.equal(riskRegisterMarkdown(buildRiskRegister(c.input)),c.markdown);assert.equal(riskRegisterMarkdown(buildRiskRegister(c.input,'af'),'af'),c.markdown);}
 const facts=fx.monitoring.find((r:any)=>r.name==='saved-design').facts;const notes=zuluReportClosingNotes(facts,fx.location);assert.equal(notes.crop,fx.legacyZulu[0]);
 // Full shared costs supersede the earlier abbreviated native table; every measured line stays present.
 const nativeBill=buildBillOfQuantities(facts,'zu');const nativeCosts=billOfQuantitiesMarkdown(nativeBill,'zu');for(const line of nativeBill.lines)assert.ok(nativeCosts.includes(line.quantity));
 // Full shared assurance now supersedes the earlier shortened native draft; retain every source paragraph.
 for(const paragraph of ASSURANCE_PARAGRAPHS)assert.ok(assuranceMarkdown('zu').includes(planAssuranceText(paragraph,'zu')));assert.ok(fx.legacyZulu[2].includes(notes.monitoringNote));assert.ok(fx.legacyZulu[3].includes(notes.riskNote));
});

test('monitoring and risk drafts bind every source template, figure and placeholder to the review packet',()=>{
 assert.equal(packet.sourceSha,fx.sourceSha);assert.match(packet.status,/Unreviewed AI drafts/);assert.equal(words.size,REPORT_DOCUMENT_COPY.length);
 for(const row of packet.entries){assert.deepEqual(words.get(row.english),row);for(const lang of languages){assert.ok(row[lang].trim());assert.notEqual(row[lang],row.english);assert.deepEqual(tokens(row[lang]),tokens(row.english));assert.deepEqual(numbers(row[lang]),numbers(row.english));}}
});

function audit(source:string){const tree=ts.createSourceFile('source.ts',source,ts.ScriptTarget.Latest,true);
 const literal=(n:ts.Node)=>{if(ts.isStringLiteral(n))assert.ok(words.has(n.text),`unregistered monitoring/risk source: ${n.text}`);else if(ts.isConditionalExpression(n)){literal(n.whenTrue);literal(n.whenFalse);}else if(ts.isPropertyAccessExpression(n)&&['r.likelihood','r.impact'].includes(n.getText(tree))){}else assert.fail('non-source translation key');};
 const translated=(n:ts.Node)=>{if(ts.isConditionalExpression(n)){translated(n.whenTrue);translated(n.whenFalse);}else assert.ok(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='t','untranslated authored row field');};
 function visit(n:ts.Node){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='t')literal(n.arguments[0]);if(ts.isPropertyAssignment(n)&&['indicator','question','baseline','method','frequency','recordedIn','risk','trigger','mitigation'].includes(n.name.getText(tree)))translated(n.initializer);ts.forEachChild(n,visit);}visit(tree);
}
test('new authored row fields or translation keys fail the source audit rather than silently falling back to English',()=>{
 // Ratings are a closed canonical type, not free-text translation keys. Keep that contract checked.
 const ratings=read('lib/report-risk.ts').match(/export type RiskRating = ([^;]+);/)![1];for(const match of ratings.matchAll(/'([^']+)'/g))assert.ok(words.has(match[1]));
 for(const file of['lib/report-monitoring.ts','lib/report-risk.ts'])audit(read(file));assert.throws(()=>audit("const row={risk:'An untranslated new risk'}"),/untranslated authored row field/);assert.throws(()=>audit("const row={trigger:`${count} new English trigger`}"),/untranslated authored row field/);assert.throws(()=>audit("t('Unregistered new monitoring advice')"),/unregistered monitoring\/risk source/);assert.throws(()=>audit('t(r.unknownFreeText)'),/non-source translation key/);
});

test('every monitoring field translates while baselines retain quantities, explicit missing data and exact recorded names',()=>{
 for(const c of fx.monitoring)for(const lang of languages){const before=JSON.stringify(c.facts);const native=buildMonitoringPlan(c.facts,lang);assert.equal(native.length,c.rows.length);for(let i=0;i<native.length;i++)for(const key of Object.keys(c.rows[i])as Array<keyof MonitoringRow>){assert.notEqual(native[i][key],c.rows[i][key],`${c.name}/${lang}/${key}`);assert.deepEqual(numbers(native[i][key]),numbers(c.rows[i][key]),`${c.name}/${key}: quantity changed`);}
  const treeBaseline=native[c.rows.findIndex((r:any)=>r.indicator==='Tree and perennial survival')].baseline;for(const g of c.facts?.design?.elements??[])if(g.category==='growing'&&c.rows.some((r:any)=>r.baseline.includes(g.name)))assert.ok(treeBaseline.includes(g.name));assert.equal(JSON.stringify(c.facts),before);
  const markdown=monitoringMarkdown(native,lang);for(const row of native)for(const value of Object.values(row))assert.ok(markdown.includes(value));assert.ok(markdown.includes(reportDocumentText('Take baseline readings before support starts. Label any later or recalled starting figures clearly; compare matching periods and do not attribute every change to the project.',lang)));
 }
});

test('risk translation preserves triggered rows, IDs, canonical ratings, exact source numbers and input objects at every boundary',()=>{
 for(const c of fx.risks)for(const lang of languages){const before=JSON.stringify(c.input);const native=buildRiskRegister(c.input,lang);assert.equal(native.length,c.rows.length,c.name);for(let i=0;i<native.length;i++){const row=native[i],old=c.rows[i];assert.deepEqual([row.id,row.likelihood,row.impact],[old.id,old.likelihood,old.impact]);for(const key of['risk','trigger','mitigation']as const){assert.notEqual(row[key],old[key],`${c.name}/${lang}/${key}`);assert.deepEqual(numbers(row[key]),numbers(old[key]),`${c.name}/${key}: source numbers`);}}
  const markdown=riskRegisterMarkdown(native,lang);if(!native.length){assert.ok(markdown.includes(reportDocumentText("No risk in this register's rule set was triggered by this site's data. That is not the same as no risk — it means the specific thresholds this report checks (rainfall, slope, frost, soil basis, traced boundary, unpriced work, crop plan) were all clear.",lang)));assert.ok(!markdown.includes('| # |'));}else{for(const row of native){assert.ok(markdown.includes(row.trigger));assert.ok(markdown.includes('| '+reportDocumentText(row.likelihood,lang)+' | '+reportDocumentText(row.impact,lang)+' |'));}}
  assert.equal(JSON.stringify(c.input),before);
 }
 const input=fx.risks.find((r:any)=>r.name==='one-unknown-tank').input;for(const lang of languages){const names=buildRiskRegister(input,lang).map(r=>r.risk);assert.ok(names.includes(reportDocumentText('Storage cannot be planned — tank sizes are not recorded',lang)));assert.ok(!names.includes(reportDocumentText('Roof runoff is lost — catchment traced but nothing to store it in',lang)));}
});

test('source thresholds and rating decisions stay identical for a complete cross-product of near-boundary inputs',()=>{
 const facts=fx.monitoring.find((r:any)=>r.name==='saved-design').facts as ReportSiteFacts;
 for(const rainfallMm of[0,499,500,501])for(const slopeDeg of[4.999,5,9.999,10])for(const minTempC of[undefined,-2.2,4.99,5])for(const soilSource of[undefined,'estimate','soilgrids','lab']as const)for(const unpricedBoqLines of[0,1,2]){
  const input:RiskInput={facts,rainfallMm,slopeDeg,minTempC,soilSource,unpricedBoqLines};const source=buildRiskRegister(input);for(const lang of languages){const rows=buildRiskRegister(input,lang);assert.deepEqual(rows.map(r=>[r.id,r.likelihood,r.impact,numbers(r.trigger)]),source.map(r=>[r.id,r.likelihood,r.impact,numbers(r.trigger)]));}
 }
});

test('markdown leaves externally supplied row wording intact while localising only its authored columns and canonical rating labels',()=>{
 const row={id:'R004',risk:'High {threshold} named by farmer',trigger:'Recorded custom trigger -2.2',likelihood:'Low',impact:'High',mitigation:'Recorded custom mitigation'}as const;
 for(const lang of languages){const text=riskRegisterMarkdown([{...row}],lang);for(const value of[row.id,row.risk,row.trigger,row.mitigation])assert.ok(text.includes(value));assert.ok(text.includes('| '+reportDocumentText('Low',lang)+' | '+reportDocumentText('High',lang)+' |'));}
});

test('the real API emits complete native monitoring and risk tables in all four languages with unchanged source decisions',async()=>{
 const url=(s:string)=>'data:text/javascript,'+encodeURIComponent(s);const hooks=registerHooks({resolve(s,c,next){if(s==='@anthropic-ai/sdk')return{url:url('export default class Anthropic{}'),shortCircuit:true};if(s==='next/server')return{url:url('export class NextRequest{}'),shortCircuit:true};if(s==='@/lib/api-auth')return{url:url('export async function guardPaidApiRequest(){return {uid:"monitoring-test"}}'),shortCircuit:true};if(s==='@/lib/metered-ai')return{url:url("export const AI_MODELS={main:'mock'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async()=>({usage:{},stop_reason:'end_turn',content:[{type:'text',text:'## Mocked body\\nMocked body content.'}]})}}}}"),shortCircuit:true};return next(s,c);}});const old=globalThis.fetch;globalThis.fetch=async()=>new Response('{}');
 try{const{POST}=await import('../app/api/generate-report/route.ts');for(const lang of languages)for(const c of[fx.monitoring[0],fx.monitoring[1],fx.monitoring.find((r:any)=>r.name==='unknown-water')]){const boq=buildBillOfQuantities(c.facts);const d=fx.location;const input:RiskInput={facts:c.facts,rainfallMm:d.rainfall.annual,slopeDeg:d.elevation.slopeDeg,minTempC:d.climate.minTemp,soilSource:d.soil.soilSource,unpricedBoqLines:boq.unpricedCount};const response=await POST(new Request('http://localhost/api/generate-report',{method:'POST',body:JSON.stringify({language:lang,locationData:d,siteFacts:c.facts,sections:['Executive Summary']})})as any);assert.equal(response.status,200);const text=await response.text();for(const markdown of[monitoringMarkdown(buildMonitoringPlan(c.facts,lang),lang),riskRegisterMarkdown(buildRiskRegister(input,lang),lang)]){const[label,...body]=markdown.split('\n');assert.ok(text.includes(label.slice(3)),`${lang}: native heading`);assert.ok(text.includes(body.join('\n').trim()),`${lang}: missing full native table`);}if(lang==='zu'){const notes=zuluReportClosingNotes(c.facts,d);assert.ok(text.includes(notes.monitoringNote));assert.ok(text.includes(notes.riskNote));}assert.ok(!text.includes('## Monitoring & Evaluation Plan'));assert.ok(!text.includes('## Risk Register'));}}
 finally{hooks.deregister();globalThis.fetch=old;}
});

test('the actual reader gives every native checklist cell its matching field label and retains table semantics without changing other tables',async()=>{
 const React=await import('react');const{renderToStaticMarkup}=await import('react-dom/server');const{stripInlineMarkdown}=await import('../lib/report-pdf.ts');const tree=ts.createSourceFile('view.tsx',read('components/ReportView.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='renderReport');assert.ok(fn);const js=ts.transpileModule(fn.getText(tree),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;const render=new Function('React','stripInlineMarkdown','ReportChapterGraphics','ChevronRight','REPORT_DOCUMENT_LANGUAGES','reportDocumentText',js+';return renderReport;')(React,stripInlineMarkdown,()=>null,()=>null,languages,reportDocumentText);const html=(markdown:string)=>renderToStaticMarkup(React.createElement('div',null,...render(markdown)));
 for(const lang of languages)for(const markdown of[monitoringMarkdown(buildMonitoringPlan(fx.monitoring[1].facts,lang),lang),riskRegisterMarkdown(buildRiskRegister(fx.risks.find((r:any)=>r.name==='all-possible').input,lang),lang)]){const output=html(markdown);assert.ok(output.includes('data-native-checklist="true"'));assert.ok(output.includes('role="table"'));assert.ok(output.includes('role="rowgroup"'));assert.equal((output.match(/role="columnheader"/g)??[]).length,6);const headers=markdown.split('\n').find(l=>l.startsWith('| '))!.slice(1,-1).split('|').map(c=>c.trim());const cells=[...output.matchAll(/<td[^>]*data-label="([^"]*)"/g)];assert.ok(cells.length>=6);for(let i=0;i<cells.length;i++)assert.equal(cells[i][1],headers[i%6]);}
 for(const markdown of[fx.monitoring[1].markdown,fx.risks.find((r:any)=>r.name==='all-possible').markdown,'| Item | Amount | Unit | Price | Source | Total |\n|---|---|---|---|---|---|\n| Saved item | 2.5 | L | Unknown | Record | Unknown |'])assert.ok(!html(markdown).includes('data-native-checklist'),'other tables keep their original rendering');
});
