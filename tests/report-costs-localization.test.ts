import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { buildBillOfQuantities, billOfQuantitiesMarkdown } from '../lib/report-boq.ts';
import { reportSummaryPages, sampleFullSiteReport, summaryBoqDescription } from '../lib/report-summary.ts';
import { REPORT_DOCUMENT_COPY, reportDocumentText } from '../lib/report-localisation.ts';
import { REPORT_VISUAL_COPY, reportElementDisplayName, reportRouteDisplayName, reportRouteShortName, reportVisualText } from '../lib/report-visuals.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import { plantTakesCode } from '../lib/plant-codes.ts';
import { ROUTE_LABELS } from '../lib/design-studio-report.ts';
import { DISCLAIMER } from '../lib/price-book.ts';
const read = (p:string) => fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fx = JSON.parse(read('tests/fixtures/report-costs-translation/source-cases.json'));
const packet = JSON.parse(read('docs/translation/four-language-completion/report-costs-drafts.json'));
const languages = ['zu','st','ts','ve'] as const;
const tokens = (s:string) => (s.match(/\{\w+\}/g)??[]).sort();
const figures = (s:string) => (s.match(/\d+(?:[.,]\d+)?/g)??[]).sort();
const byName = (name:string) => fx.cases.find((c:any)=>c.name===name);

test('cost drafts bind their original cautions, date basis, numbers and placeholders to a review packet',()=>{
  assert.equal(fx.sourceSha,packet.sourceSha);
  assert.match(packet.status,/Unreviewed AI drafts/);
  for(const [rows,registry] of [[packet.entries,REPORT_DOCUMENT_COPY],[packet.visualEntries,REPORT_VISUAL_COPY]] as const){
    const index=new Map(registry.map((r:any)=>[r.english,r]));
    assert.equal(index.size,registry.length,'one wording authority per source');
    for(const row of rows){assert.deepEqual(index.get(row.english),row);for(const lang of languages){assert.ok(row[lang].trim());assert.notEqual(row[lang],row.english);assert.deepEqual(tokens(row[lang]),tokens(row.english));assert.deepEqual(figures(row[lang]),figures(row.english));}}
  }
  assert.ok(packet.entries.some((r:any)=>r.english===DISCLAIMER),'the dated VAT-inclusive source disclaimer must be translated without changing its financial basis');
});

test('every original English bill, model and summary stays exact, including legacy, missing, existing and regulated records',()=>{
  for(const c of fx.cases){
    const before=JSON.stringify(c.facts);
    for(const lang of ['en','af']){
      const boq=buildBillOfQuantities(c.facts,lang);
      assert.deepEqual(boq,c.boq,c.name);
      assert.equal(billOfQuantitiesMarkdown(boq,lang),c.markdown,c.name);
      assert.deepEqual(reportSummaryPages(c.facts,fx.location,1,lang),c.summary.en.one,c.name);
      assert.deepEqual(reportSummaryPages(c.facts,fx.location,5,lang),c.summary.en.five,c.name);
      assert.equal(sampleFullSiteReport(c.facts,fx.location,lang),c.summary.en.full,c.name);
    }
    assert.equal(JSON.stringify(c.facts),before,'presentation cannot mutate farmer records');
  }
});

test('all native cost lines retain exact money, quantity values, order, grouping, rate decisions and provenance',()=>{
  for(const c of fx.cases)for(const lang of languages){
    const before=JSON.stringify(c.facts),boq=buildBillOfQuantities(c.facts,lang),markdown=billOfQuantitiesMarkdown(boq,lang);
    assert.deepEqual([boq.subtotalZar,boq.unpricedCount,boq.existingCount],[c.boq.subtotalZar,c.boq.unpricedCount,c.boq.existingCount]);
    assert.equal(boq.lines.length,c.boq.lines.length);
    for(const [i,line] of boq.lines.entries()){
      const original=c.boq.lines[i];
      assert.deepEqual([line.group,line.zar,line.unpriced,line.descriptionSource],[original.group,original.zar,original.unpriced,original.descriptionSource]);
      assert.deepEqual(figures(line.quantity),figures(original.quantity));
      assert.equal(line.quantity,original.quantity.endsWith(' no.')?reportDocumentText('{count} no.',lang,{count:original.quantity.slice(0,-4)}):original.quantity);
      assert.equal(line.rate,original.rate?.endsWith(' each')?reportDocumentText('{amount} each',lang,{amount:original.rate.slice(0,-5)}):original.rate);
      assert.equal(line.source,reportDocumentText(original.source,lang));
      assert.ok(markdown.includes(`| ${line.description} | ${line.quantity} | ${line.rate??'—'} |`));
      if(original.descriptionSource)assert.equal(line.description,summaryBoqDescription(original,lang));
      assert.equal(line.zar===null,line.rate===null,'unknown is unpriced, never a guessed zero');
    }
    assert.deepEqual(figures(markdown),figures(c.markdown),`${lang}/${c.name}: printed financial or measured number changed`);
    assert.ok(markdown.includes(reportDocumentText('Cost & Bill of Quantities',lang)));
    if(boq.lines.length){
      assert.ok(markdown.includes(reportDocumentText(DISCLAIMER,lang)));
      for(const group of new Set(boq.lines.map(l=>l.group)))assert.ok(markdown.includes(`| **${reportVisualText(group,lang)}** | | | | |`));
      if(boq.unpricedCount)assert.ok(markdown.includes(reportDocumentText(boq.unpricedCount===1?'{count} line carries':'{count} lines carry',lang,{count:boq.unpricedCount})));
      if(boq.existingCount)assert.ok(markdown.includes(reportDocumentText(boq.existingCount===1?'{count} item marked as already on the farm is':'{count} items marked as already on the farm are',lang,{count:boq.existingCount})));
    }else assert.ok(markdown.includes(reportDocumentText('No priced work can be listed yet: nothing has been drawn on the plan to measure. Draw the beds, tanks, fences and paths in the Design Studio and this bill fills itself from those measurements.',lang)));
    assert.equal(JSON.stringify(c.facts),before);
    assert.deepEqual(reportSummaryPages(c.facts,fx.location,1,lang),c.summary[lang].one,'one-page content must stay exact');
    for(const count of [1,5]as const)assert.deepEqual(figures(JSON.stringify(reportSummaryPages(c.facts,fx.location,count,lang))),figures(JSON.stringify(count===1?c.summary.en.one:c.summary.en.five)));
    assert.deepEqual(figures(sampleFullSiteReport(c.facts,fx.location,lang)),figures(c.summary.en.full));
  }
});

test('full route explanations and default equipment translate only with recorded identity while all plant and saved names remain exact',()=>{
  const catalogue=byName('catalogue');
  for(const lang of languages){
    const boq=buildBillOfQuantities(catalogue.facts,lang);
    for(const item of catalogue.facts.design.elements){
      const def=ELEMENTS_BY_ID[item.defId];
      const label=reportElementDisplayName(item.name,item.defId,lang);
      if(def.category==='growing'||def.botanical||plantTakesCode(def.id))assert.equal(label,item.name,'species names are never translated');
      else {assert.equal(label,reportVisualText(def.name,lang));assert.notEqual(label,item.name,`${lang}: untranslated source equipment ${def.id}`);}
      assert.equal(reportElementDisplayName('Named '+item.name,item.defId,lang),'Named '+item.name);
      assert.equal(reportElementDisplayName(item.name,undefined,lang),item.name);
    }
    for(const [kind,label]of Object.entries(ROUTE_LABELS)){
      assert.equal(reportRouteDisplayName(label,kind,lang),reportVisualText(label,lang));
      assert.notEqual(reportRouteDisplayName(label,kind,lang),label);
      assert.ok(boq.lines.some(l=>l.description===reportVisualText(label,lang)));
      assert.equal(reportRouteDisplayName('Named '+label,kind,lang),'Named '+label);
      assert.equal(reportRouteDisplayName(label,undefined,lang),label);
      assert.equal(reportRouteShortName(label,kind,'en'),label.replace(/ \(.*\)$/, ''));
    }
    for(const name of['custom','legacy','source-word-collisions']){
      const c=byName(name),native=buildBillOfQuantities(c.facts,lang);
      // The collision fixture still has canonical routes; only its saved element names are collisions.
      for(const[i,line]of native.lines.entries())if(!line.descriptionSource&&(name!=='source-word-collisions'||line.group==='Structures & planting'))assert.equal(line.description,c.boq.lines[i].description,`${lang}/${name}: source word match must not rename a saved item`);
    }
    for(const c of fx.cases){const full=sampleFullSiteReport(c.facts,fx.location,lang);for(const item of c.facts?.design?.elements??[])assert.ok(full.includes(reportElementDisplayName(item.name,item.defId,lang)));}
    const listed=boq.lines.filter(l=>l.unpriced==='listed-plant');assert.ok(listed.length>0);
    const text=billOfQuantitiesMarkdown(boq,lang);for(const line of listed)assert.equal(line.zar,null);
    assert.ok(text.includes(reportDocumentText('listed plant on saved plan — obtain local legal and ecological advice; do not buy or propagate from this bill',lang)));
  }
});

test('new authored cost wording fails the source audit instead of silently falling back to English',()=>{
  const source=new Set(REPORT_DOCUMENT_COPY.map(r=>r.english));
  function audit(text:string){
    const tree=ts.createSourceFile('bill.ts',text,ts.ScriptTarget.Latest,true);
    function visit(node:ts.Node){
      if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['t','reportDocumentText'].includes(node.expression.text)){
        const scan=(arg:ts.Node)=>{if(ts.isStringLiteral(arg))assert.ok(source.has(arg.text),`unregistered cost text: ${arg.text}`);else if(ts.isConditionalExpression(arg)){scan(arg.whenTrue);scan(arg.whenFalse);}};
        if(node.arguments[0])scan(node.arguments[0]);
      }
      if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='UNPRICED_TEXT'&&node.initializer&&ts.isObjectLiteralExpression(node.initializer))for(const prop of node.initializer.properties)if(ts.isPropertyAssignment(prop)&&ts.isStringLiteral(prop.initializer))assert.ok(source.has(prop.initializer.text),`unregistered unpriced reason: ${prop.initializer.text}`);
      ts.forEachChild(node,visit);
    }visit(tree);
  }
  audit(read('lib/report-boq.ts'));
  assert.throws(()=>audit("t('A new cost caution')"),/unregistered cost text/);
  assert.throws(()=>audit("const UNPRICED_TEXT = {'no-rate':'New unpriced reason'}"),/unregistered unpriced reason/);
});

test('the actual API emits the full native cost bill with all measured lines, even for isiZulu and absent records',async()=>{
  const url=(s:string)=>'data:text/javascript,'+encodeURIComponent(s);
  const hooks=registerHooks({resolve(s,c,next){
    if(s==='@anthropic-ai/sdk')return{url:url('export default class Anthropic{}'),shortCircuit:true};
    if(s==='next/server')return{url:url('export class NextRequest{}'),shortCircuit:true};
    if(s==='@/lib/api-auth')return{url:url('export async function guardPaidApiRequest(){return {uid:"costs-test"}}'),shortCircuit:true};
    if(s==='@/lib/metered-ai')return{url:url("export const AI_MODELS={main:'mock'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async()=>({usage:{},stop_reason:'end_turn',content:[{type:'text',text:'## Mocked body\\nMocked body content.'}]})}}}}"),shortCircuit:true};
    return next(s,c);
  }});
  const old=globalThis.fetch;globalThis.fetch=async()=>new Response('{}');
  try{const{POST}=await import('../app/api/generate-report/route.ts');for(const lang of languages)for(const name of['empty','saved-design','unknown-capacity','source-word-collisions']){
    const facts=byName(name).facts,response=await POST(new Request('http://localhost/api/generate-report',{method:'POST',body:JSON.stringify({language:lang,locationData:fx.location,siteFacts:facts,sections:['Executive Summary']})})as any);
    assert.equal(response.status,200);const text=await response.text();const native=billOfQuantitiesMarkdown(buildBillOfQuantities(facts,lang),lang);const[heading,...body]=native.split('\n');
    assert.ok(text.includes(heading.slice(3)));assert.ok(text.includes(body.join('\n').trim()),`${lang}/${name}: full cost bill missing`);
    assert.ok(!text.includes('## Cost & Bill of Quantities'));
  }}finally{hooks.deregister();globalThis.fetch=old;}
});

test('the actual reader gives every native cost field a label and each group one spanning heading while leaving English and unrelated tables unchanged',async()=>{
  const React=await import('react');const{renderToStaticMarkup}=await import('react-dom/server');const{stripInlineMarkdown}=await import('../lib/report-pdf.ts');
  const tree=ts.createSourceFile('view.tsx',read('components/ReportView.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='renderReport');assert.ok(fn);
  const js=ts.transpileModule(fn.getText(tree),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const render=new Function('React','stripInlineMarkdown','ReportChapterGraphics','ChevronRight','REPORT_DOCUMENT_LANGUAGES','reportDocumentText',js+';return renderReport;')(React,stripInlineMarkdown,()=>null,()=>null,languages,reportDocumentText);
  const html=(markdown:string)=>renderToStaticMarkup(React.createElement('div',null,...render(markdown)));
  for(const lang of languages){
    const boq=buildBillOfQuantities(byName('catalogue').facts,lang),markdown=billOfQuantitiesMarkdown(boq,lang),output=html(markdown);
    assert.ok(output.includes('data-native-costs="true"'));assert.ok(output.includes('role="table"'));
    assert.equal((output.match(/role="columnheader"/g)??[]).length,5);
    assert.equal((output.match(/colSpan="5" scope="rowgroup" role="rowheader"/g)??[]).length,new Set(boq.lines.map(l=>l.group)).size);
    const bodies=[...output.matchAll(/<tbody[^>]*>([\s\S]*?)<\/tbody>/g)].map(m=>m[1]);
    const sourceGroups=[...new Set(boq.lines.map(l=>l.group))];
    assert.equal(bodies.length,sourceGroups.length,'every cost group owns a separate accessible rowgroup');
    for(const [i,body]of bodies.entries()){
      assert.equal((body.match(/role="rowheader"/g)??[]).length,1);
      assert.equal((body.match(/role="cell"/g)??[]).length,boq.lines.filter(l=>l.group===sourceGroups[i]).length*5,'the heading may not claim rows from another group');
    }
    const headers=['Item','Quantity','Rate','Amount','Measured from'].map(s=>reportDocumentText(s,lang));
    const cells=[...output.matchAll(/<td[^>]*data-label="([^"]*)"/g)];assert.equal(cells.length,boq.lines.length*5);
    for(let i=0;i<cells.length;i++)assert.equal(cells[i][1],headers[i%5]);
  }
  assert.match(html('| Item | Amount |\n|---|---|'), /<tbody><\/tbody>/, 'an unrelated empty table retains its original rowgroup');
  for(const markdown of[byName('catalogue').markdown,'| Item | Price | Quantity | Amount | Note |\n|---|---|---|---|---|\n| Saved name | R1 | 1 | R1 | Saved note |'])assert.ok(!html(markdown).includes('data-native-costs'));
});
