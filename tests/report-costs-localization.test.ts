import { SUPPORTED_REPORT_COUNTRY_FIXTURE_URL } from './report-country-fixture.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { buildBillOfQuantities, billOfQuantitiesMarkdown } from '../lib/report-boq.ts';
import { reportSummaryPages, sampleFullSiteReport, summaryBoqDescription, reportSummaryText } from '../lib/report-summary.ts';
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

// Keep the translation corpus immutable. Its mixed case predates the purchase-
// quantity correction; its existing case also counts five mirrored tanks twice.
// Only those cost decisions and the duplicated exclusion count are superseded.
// Quantities, names, sources and unrelated pages still come from the historical
// corpus, never from the implementation under test.
const mixedNote = 'Mixed existing/proposed groups show recorded inventory counts, not quantities to buy. Confirm the proposed share before pricing; it is not included in the priced subtotal.';
const mixedReason = 'purchase quantity not established — confirm the existing/proposed split before pricing';
const mixedSubtotalNote = 'The priced subtotal is incomplete. Lines with unconfirmed purchase quantities, measurements or rates are not included. Confirm each line before setting a build budget.';
const pendingEvidence = (text:string,lang:string) => lang==='en'?text:`English; translation pending: ${text}`;
const mixedInventoryLine = (line:any) => (line.group==='Water'||line.group==='Structures & planting')&&line.unpriced!=='listed-plant';
const expectedBoq = (c:any) => {
  if(c.name==='existing')return {...c.boq,existingCount:82};
  if(c.name!=='mixed')return c.boq;
  const lines=c.boq.lines.map((line:any)=>mixedInventoryLine(line)?{...line,rate:null,zar:null,unpriced:'mixed-status'}:{...line});
  return {...c.boq,lines,subtotalZar:lines.reduce((sum:number,line:any)=>sum+(line.zar??0),0),unpricedCount:lines.filter((line:any)=>line.zar===null).length};
};
const groupedInteger = (n:number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
function expectedEnglishBill(c:any,lang='en'):string {
  if(c.name==='existing')return c.markdown.replace('87 items marked as already on the farm are excluded from this bill. They are part of the design and not part of the spend.','82 items marked as already on the farm are excluded from this bill. They are part of the design and not part of the spend.');
  if(c.name!=='mixed')return c.markdown;
  const expected=expectedBoq(c);
  let index=0;
  return c.markdown.split('\n').map((row:string)=>{
    if(row==='| Item | Quantity | Rate | Amount | Measured from |')return `${pendingEvidence(mixedNote,lang)}\n\n${row}`;
    if(row.startsWith('| ')&&!row.startsWith('| **')){
      const original=c.boq.lines[index++];
      if(mixedInventoryLine(original))return `| ${original.description} | ${original.quantity} | — | _${pendingEvidence(mixedReason,lang)}_ | ${original.source} |`;
    }
    if(row===`**Subtotal of the priced lines: R${groupedInteger(c.boq.subtotalZar)}**`)return `**Subtotal of the priced lines: R${groupedInteger(expected.subtotalZar)}**`;
    if(row.startsWith('This subtotal is NOT the cost of the build.'))return pendingEvidence(mixedSubtotalNote,lang);
    return row;
  }).join('\n');
}
function expectedSummary(c:any,lang:string,count:1|5):any[] {
  const key=languages.includes(lang as any)?lang:'en';
  // The historical empty-cost label is superseded, not the frozen corpus or
  // any absent observation elsewhere in the summary.
  const oldUnknown=`${reportSummaryText('Priced infrastructure subtotal',lang)}: ${reportSummaryText('Not recorded',lang)}`;
  const newUnknown=`${reportSummaryText('Priced infrastructure subtotal',lang)}: ${pendingEvidence('Not established',lang)}`;
  const original=c.summary[key][count===1?'one':'five'].map((page:any)=>({...page,lines:page.lines.map((line:string)=>line===oldUnknown?newUnknown:line)}));
  if(c.name!=='mixed')return original;
  const expected=expectedBoq(c),cost=c.summary[key].five[3].lines;
  return original.map((page:any,pageIndex:number)=>({...page,lines:page.lines.flatMap((line:string,index:number)=>{
    if(line===cost[0])return [line.replace(`R ${groupedInteger(c.boq.subtotalZar)}`,`R ${groupedInteger(expected.subtotalZar)}`)];
    if(line===cost[1])return [`${pendingEvidence('Lines needing a purchase quantity, measurement or price',lang)}: ${expected.unpricedCount}`];
    if(line===cost[2])return [line,pendingEvidence(mixedNote,lang)];
    if(count===5&&pageIndex===3&&index>=3&&mixedInventoryLine(c.boq.lines[index-3]))return [line.slice(0,line.lastIndexOf(' · ')+3)+pendingEvidence(mixedReason,lang)];
    return [line];
  })}));
}
function expectedFull(c:any,lang:string):string {
  const key=languages.includes(lang as any)?lang:'en';
  const old=c.summary[key].five[3],next=expectedSummary(c,lang,5)[3];
  const section=(page:any)=>`## ${page.title}\n\n${page.lines.map((line:string)=>`- ${line}`).join('\n')}`;
  assert.ok(c.summary[key].full.includes(section(old)),'historical full cost section must have one explicit replacement');
  return c.summary[key].full.replace(section(old),section(next));
}

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

test('historical bills, models and summaries stay exact except scoped mixed purchase and mirrored existing-count corrections',()=>{
  for(const c of fx.cases){
    const before=JSON.stringify(c.facts);
    for(const lang of ['en','af']){
      const boq=buildBillOfQuantities(c.facts,lang);
      assert.deepEqual(boq,expectedBoq(c),c.name);
      assert.equal(billOfQuantitiesMarkdown(boq,lang),expectedEnglishBill(c,lang),c.name);
      assert.deepEqual(reportSummaryPages(c.facts,fx.location,1,lang),expectedSummary(c,lang,1),c.name);
      assert.deepEqual(reportSummaryPages(c.facts,fx.location,5,lang),expectedSummary(c,lang,5),c.name);
      assert.equal(sampleFullSiteReport(c.facts,fx.location,lang),expectedFull(c,lang),c.name);
    }
    assert.equal(JSON.stringify(c.facts),before,'presentation cannot mutate farmer records');
  }
});

test('the existing corpus has exactly five fully identified tank mirrors, not five extra physical tanks',()=>{
  const c=byName('existing');
  const ids=['jojo_1000','jojo_2500','jojo_5000','jojo_10000','rain_barrel'];
  assert.equal(c.boq.existingCount,87,'frozen corpus retains its historical double count');
  assert.deepEqual(c.facts.water.tanks.map((tank:any)=>tank.defId),ids);
  for(const id of ids){
    const tank=c.facts.water.tanks.find((tank:any)=>tank.defId===id);
    assert.equal(tank.status,'existing');assert.equal(tank.count,1);
    assert.equal(c.facts.design.elements.filter((item:any)=>item.defId===id&&item.name===tank.name&&item.count===tank.count&&item.status==='existing').length,1,'one matching collector view per original tank');
  }
  const expected=expectedBoq(c);
  assert.equal(expected.existingCount,c.boq.existingCount-ids.length);
  assert.deepEqual(expected.lines,c.boq.lines,'deduplicating excluded inventory cannot change a single bill line');
  assert.deepEqual([expected.subtotalZar,expected.unpricedCount],[c.boq.subtotalZar,c.boq.unpricedCount]);
  assert.equal((c.markdown.match(/87 items marked as already on the farm are excluded/g)??[]).length,1,'nonempty bill has one exact exclusion notice to correct');
});

test('mixed inventory preserves known route/bed costs and all-withheld exports never imply a free build',()=>{
  const c=byName('mixed'),expected=expectedBoq(c);
  // Six priced routes plus the measured beds remain; no tank/tree split is invented.
  assert.equal(expected.subtotalZar,23266);
  assert.equal(expected.unpricedCount,81);
  assert.equal(expected.lines.filter((line:any)=>line.unpriced==='listed-plant').length,1);
  assert.deepEqual(expected.lines.filter((line:any)=>line.group==='Growing area'||line.group==='Earthworks & routes'),c.boq.lines.filter((line:any)=>line.group==='Growing area'||line.group==='Earthworks & routes'));
  const facts=structuredClone(c.facts);
  facts.design.routes=[];facts.design.beds=[];
  facts.design.bedAreaM2=0;facts.design.plotAreaM2=0;facts.design.bedCount=0;facts.design.plotCount=0;facts.design.growingAreaM2=0;
  for(const lang of ['en',...languages]){
    const boq=buildBillOfQuantities(facts,lang),markdown=billOfQuantitiesMarkdown(boq,lang);
    assert.ok(boq.lines.length>0);
    assert.equal(boq.subtotalZar,0,'the old numeric accumulator remains a sum over no priced lines');
    assert.ok(boq.lines.every(line=>line.zar===null&&line.rate===null));
    assert.ok(markdown.includes(`**${pendingEvidence('No lines priced; build cost not established.',lang)}**`));
    assert.ok(!markdown.includes(reportDocumentText('Subtotal of the priced lines: {subtotal}',lang,{subtotal:'R0'})));
    for(const count of [1,5]as const){
      const pages=reportSummaryPages(facts,fx.location,count,lang);
      assert.ok(pages.some(page=>page.lines.includes(pendingEvidence(mixedNote,lang))));
      assert.ok(!pages.some(page=>page.lines.some(line=>/subtotal.*R 0$/i.test(line))));
      const subtotalLabel=c.summary[lang].five[3].lines[0].split(':')[0];
      assert.ok(pages.some(page=>page.lines.some(line=>line.startsWith(subtotalLabel+': ')&&!line.endsWith('R 0'))),'native subtotal remains explicitly unknown');
    }
  }
});

test('all native cost lines retain exact money, quantity values, order, grouping, rate decisions and provenance',()=>{
  for(const c of fx.cases)for(const lang of languages){
    const before=JSON.stringify(c.facts),boq=buildBillOfQuantities(c.facts,lang),markdown=billOfQuantitiesMarkdown(boq,lang);
    const expected=expectedBoq(c);
    assert.deepEqual([boq.subtotalZar,boq.unpricedCount,boq.existingCount],[expected.subtotalZar,expected.unpricedCount,expected.existingCount]);
    assert.equal(boq.lines.length,c.boq.lines.length);
    for(const [i,line] of boq.lines.entries()){
      const original=expected.lines[i];
      assert.deepEqual([line.group,line.zar,line.unpriced,line.descriptionSource],[original.group,original.zar,original.unpriced,original.descriptionSource]);
      assert.deepEqual(figures(line.quantity),figures(original.quantity));
      assert.equal(line.quantity,original.quantity.endsWith(' no.')?reportDocumentText('{count} no.',lang,{count:original.quantity.slice(0,-4)}):original.quantity);
      assert.equal(line.rate,original.rate?.endsWith(' each')?reportDocumentText('{amount} each',lang,{amount:original.rate.slice(0,-5)}):original.rate);
      assert.equal(line.source,reportDocumentText(original.source,lang));
      assert.ok(markdown.includes(`| ${line.description} | ${line.quantity} | ${line.rate??'—'} |`));
      if(original.descriptionSource)assert.equal(line.description,summaryBoqDescription(original,lang));
      assert.equal(line.zar===null,line.rate===null,'unknown is unpriced, never a guessed zero');
    }
    assert.deepEqual(figures(markdown),figures(expectedEnglishBill(c)),`${lang}/${c.name}: printed financial or measured number changed`);
    assert.ok(markdown.includes(reportDocumentText('Cost & Bill of Quantities',lang)));
    if(boq.lines.length){
      assert.ok(markdown.includes(reportDocumentText(DISCLAIMER,lang)));
      for(const group of new Set(boq.lines.map(l=>l.group)))assert.ok(markdown.includes(`| **${reportVisualText(group,lang)}** | | | | |`));
      if(c.name==='mixed'){
        assert.ok(markdown.includes(pendingEvidence(mixedNote,lang)));
        assert.ok(markdown.includes(pendingEvidence(mixedReason,lang)));
        assert.ok(markdown.includes(pendingEvidence(mixedSubtotalNote,lang)));
        assert.ok(!markdown.includes(reportDocumentText('so the real figure is higher',lang)));
      }else if(boq.unpricedCount)assert.ok(markdown.includes(reportDocumentText(boq.unpricedCount===1?'{count} line carries':'{count} lines carry',lang,{count:boq.unpricedCount})));
      if(boq.existingCount)assert.ok(markdown.includes(reportDocumentText(boq.existingCount===1?'{count} item marked as already on the farm is':'{count} items marked as already on the farm are',lang,{count:boq.existingCount})));
    }else assert.ok(markdown.includes(reportDocumentText('No priced work can be listed yet: nothing has been drawn on the plan to measure. Draw the beds, tanks, fences and paths in the Design Studio and this bill fills itself from those measurements.',lang)));
    assert.equal(JSON.stringify(c.facts),before);
    assert.deepEqual(reportSummaryPages(c.facts,fx.location,1,lang),expectedSummary(c,lang,1),'one-page content must stay exact outside the scoped cost correction');
    for(const count of [1,5]as const)assert.deepEqual(figures(JSON.stringify(reportSummaryPages(c.facts,fx.location,count,lang))),figures(JSON.stringify(expectedSummary(c,'en',count))));
    assert.deepEqual(figures(sampleFullSiteReport(c.facts,fx.location,lang)),figures(expectedFull(c,'en')));
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
    if(s==='@/lib/report-country-policy')return {url:SUPPORTED_REPORT_COUNTRY_FIXTURE_URL,shortCircuit:true};if(s==='@/lib/api-auth')return{url:url('export async function guardPaidApiRequest(){return {uid:"costs-test"}}'),shortCircuit:true};
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
