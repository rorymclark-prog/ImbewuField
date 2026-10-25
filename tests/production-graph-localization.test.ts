import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { jsPDF } from 'jspdf';
import { registerReportPdfFont } from '../lib/report-pdf-font.ts';
import { CROP_EXPORT_COPY } from '../lib/crop-export-copy-data.ts';
import { CROP_EXPORT_DRAFT_LANGUAGES, cropExportText, cropPreservedMethodText, cropProductionIssueText, cropProjectionPeriodText } from '../lib/crop-export-copy.ts';
import { drawCropPlanPages, resolveAvailability, type CropPlanPdfInput } from '../lib/crop-export-pdf.ts';
import { buildProductionAvailabilityGraphs, buildProductionKgGraphs } from '../lib/crop-export-availability.ts';
import { monthAxisSlots } from '../lib/month-axis.ts';
import { totalGrowingAreaM2 } from '../lib/crop-plan.ts';
import { recordsMonthShort } from '../lib/records-months.ts';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const before=JSON.parse(read('tests/fixtures/production-graph-translation/graphs-before.json'))as{sources:Array<{file:string;source:string;sha256:string}>;rows:Array<{id:string;input:Omit<CropPlanPdfInput,'now'>&{now:string};food:ReturnType<typeof buildProductionAvailabilityGraphs>;kg:ReturnType<typeof buildProductionKgGraphs>}>};
const paintBefore=JSON.parse(read('tests/fixtures/production-graph-translation/paint-before.json'))as{rows:Array<{id:string;bars:Array<{shape:string;width:number;height:number}>;error?:string}>};
const plain=(value:unknown)=>JSON.parse(JSON.stringify(value));
const flat=(text:string)=>text.replace(/\s/g,'');
const figures=(text:string)=>(text.match(/\d+(?:[.,]\d+)?/g)??[]).sort();

test('production graph translations leave both entire quantity authorities and every recorded field unchanged',()=>{
  for(const file of ['lib/crop-export-availability.ts','lib/production-projection.ts']){const source=before.sources.find(row=>row.file===file)!;assert.equal(createHash('sha256').update(read(file)).digest('hex'),source.sha256,'this graph batch may change presentation, never the quantity or age model');}
  for(const row of before.rows){const input={...row.input,now:new Date(row.input.now)},original=JSON.stringify(input),availability=resolveAvailability(input,10),common={availability,dates:monthAxisSlots(10,2026,12),growingAreaM2:totalGrowingAreaM2(input.beds),includeTrees:input.availability?.includeTrees,includeAnimals:input.availability?.includeAnimals,preservedProducts:input.preservedProducts,productionRecords:input.productionRecords};
    assert.deepEqual(plain(buildProductionAvailabilityGraphs(common)),row.food);assert.deepEqual(plain(buildProductionKgGraphs({...common,now:input.now,plantings:input.plantings,beds:input.beds,treeGroups:input.treeGroups,treeSeasons:input.treeSeasons})),row.kg);assert.equal(JSON.stringify(input),original);
  }
  const recorded=before.rows.find(row=>row.id==='recorded')!.kg.months;assert.equal(recorded[0].actualKg,0,'a recorded zero must remain distinct from an unknown quantity');assert.equal(recorded[0].nativeUnits.eggs,12);assert.equal(recorded[2].nativeUnits.litres,3);assert.equal(recorded[3].nativeUnits.items,2);assert.equal(recorded[4].actualKg,null);assert.equal(recorded[0].stockKg,5,'kept stock cannot become fresh production');
});

test('only generated issue sentences are translated and original names, dates, units and unknown messages survive',()=>{
  const templates=CROP_EXPORT_COPY.filter(row=>'generatedScope'in row&&row.generatedScope==='production-issue');assert.equal(templates.length,7,'all current producer issue types must be represented');
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    for(const row of before.rows)for(const issue of row.kg.recordIssues){const native=cropProductionIssueText(issue,language);assert.notEqual(native,issue);assert.ok(!native.startsWith(cropExportText('Original message: {message}',language,{message:''})),'a current producer issue cannot fall through to an unknown English message');assert.deepEqual(figures(native),figures(issue));}
    const name='Original {unit} $& crop',message=`2026-10: ${name} crop-cycle kg cannot be calculated; check growing area and quantity.`,native=cropProductionIssueText(message,language);assert.ok(native.includes(name),'inserted crop identity must not be parsed again');assert.ok(native.includes('2026-10'));
    for(const unknown of ['Fish','Original custom error {date} $& 17','2026-10: kg production total cannot be calculated; check quantities!'])assert.equal(cropProductionIssueText(unknown,language),cropExportText('Original message: {message}',language,{message:unknown}),'unknown messages keep their full original text with an honest native label');
    for(const method of ['custom preservation','toString','__proto__'])assert.equal(cropPreservedMethodText(method as Parameters<typeof cropPreservedMethodText>[0],language),method,'unknown runtime method identities must stay original instead of becoming known preservation claims');
    for(const method of ['stored','frozen','dried','fermented','processed']as const){assert.notEqual(cropPreservedMethodText(method,language),method);assert.equal(cropPreservedMethodText(method),method);}
  }
  for(const row of before.rows)for(const issue of row.kg.recordIssues)for(const language of ['en','xx'])assert.equal(cropProductionIssueText(issue,language),issue);
});

test('generated annual period labels translate only month words and preserve both source years and unknown labels',()=>{
  const months=Array.from({length:12},(_,i)=>new Date(2000,i,1).toLocaleDateString('en-ZA',{month:'short'}));
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES)for(let first=0;first<12;first++)for(let last=0;last<12;last++){
    const source=`${months[first]} 2026 – ${months[last]} 2027`;assert.equal(cropProjectionPeriodText(source,language),`${recordsMonthShort(language,first+1)} 2026 – ${recordsMonthShort(language,last+1)} 2027`);assert.equal(cropProjectionPeriodText(source),source);assert.equal(cropProjectionPeriodText(source,'xx'),source);
  }
  for(const source of ['Original private {month} $&','WrongMonth 2026 – Jan 2027','Jan 2026 – WrongMonth 2027'])assert.equal(cropProjectionPeriodText(source,'ve'),source,'unknown supplied labels cannot acquire invented month identities');
});

const cautions=[
 'The two food charts share a scale. A crop present fresh and kept still counts once; kept colours add other food kinds. Dated output records update fresh counts. Research season references and sources without local dates are outside food counts.',
 "Pantry storage requires each crop's source conditions. Preserved stock is shown only for recorded months; no amount, recipe or safe shelf life is inferred.",
 '? means quantity not recorded, not zero. * marks a known stock subtotal with missing batch weights. Egg counts and litres use actual records where entered, otherwise expected records. They are never converted to kg. Stock kg are food already held; they are never added to new production.',
];

test('actual native production PDFs retain original bar quantities, full cautions, typed records and all generated errors',async()=>{
  for(const row of before.rows)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const input={...row.input,now:new Date(row.input.now),meta:{...row.input.meta,language}},original=JSON.stringify(input),doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[],bars:Array<{shape:string;width:number;height:number}>=[];
    const text=doc.text.bind(doc),rect=doc.rect.bind(doc),rounded=doc.roundedRect.bind(doc),tableDates=new Set(row.kg.months.map(month=>recordsMonthShort(language,month.month)+' '+month.year)),tableDatePages:number[]=[],stockPages:number[]=[];
    doc.roundedRect=((...args:unknown[])=>{if(args[4]===2&&args[5]===2&&args[6]==='F')bars.push({shape:'rounded',width:Number(args[2]),height:Number(args[3])});return(rounded as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.roundedRect;
    doc.rect=((...args:unknown[])=>{if(Number(args[2])>10&&Number(args[2])<=26&&Number(args[3])>0&&args[4]==='F')bars.push({shape:'stack',width:Number(args[2]),height:Number(args[3])});return(rect as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.rect;
    doc.text=((...args:unknown[])=>{const lines=Array.isArray(args[0])?args[0].map(String):[String(args[0])],opts=args[3]as{align?:string;lineHeightFactor?:number}|undefined;painted.push(lines.join(' '));if(Number(args[1])===71&&(input.preservedProducts??[]).some(record=>lines.join(' ').startsWith(record.label+' (')))stockPages.push(doc.getNumberOfPages());if(Number(args[1])===48&&opts?.align==='left'&&tableDates.has(lines.join(' ')))tableDatePages.push(doc.getNumberOfPages());lines.forEach((line,i)=>{const width=doc.getTextWidth(line),x=Number(args[1])-(opts?.align==='right'?width:opts?.align==='center'?width/2:0),y=Number(args[2])+i*doc.getFontSize()*(opts?.lineHeightFactor??doc.getLineHeightFactor());assert.ok(Number.isFinite(x)&&Number.isFinite(y),`${language}/${row.id}: chart coordinates must remain finite`);assert.ok(x>=12&&x+width<=doc.internal.pageSize.getWidth()-12,`${language}/${row.id}: text outside page: ${line}`);assert.ok(y>=12&&y<=doc.internal.pageSize.getHeight()-12,`${language}/${row.id}: text off page: ${line}`);});return(text as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.text;
    drawCropPlanPages(doc,input,false,{language,font});const drawn=flat(painted.join(' ')),baseline=paintBefore.rows.find(source=>source.id===row.id)!;
    if(!baseline.error)assert.deepEqual(bars,baseline.bars,'translation cannot resize, create or delete positive quantity bars');else{assert.equal(baseline.error,'Invalid arguments passed to jsPDF.text');assert.ok(drawn.includes(flat(cropExportText('The space graph cannot label the supplied area clearly. Check the mapped area.',language))),'the observed overflow crash must become an honest display warning');}
    for(const source of cautions)assert.ok(drawn.includes(flat(cropExportText(source,language))),`${language}/${row.id}: missing full source caution: ${source}`);
    for(const issue of row.kg.recordIssues)assert.ok(drawn.includes(flat(cropProductionIssueText(issue,language))),'every producer error must remain complete in the actual PDF');
    for(const record of input.preservedProducts??[])if(!record.sourceIconKey.startsWith('housing:')){assert.ok(drawn.includes(flat(record.label)),'private stock label must print verbatim');assert.ok(drawn.includes(flat(record.note)),'private stock note must print verbatim');assert.ok(drawn.includes(flat(cropPreservedMethodText(record.method,language))),'typed method must have its localized display name');}
    if(stockPages.length>1)assert.equal(new Set(stockPages).size,1,'a compact stock list must remain with its methods note instead of stranding its last private record');
    for(const source of ['Fresh food, kept food and space','Production weights and missing records'])assert.ok(drawn.includes(flat(cropExportText(source,language))));
    if(row.kg.months.some(month=>Object.values(month.nativeUnits).some(value=>value!==null)||month.stockKg!==null)){assert.equal(tableDatePages.length,12,'all twelve dated quantity rows must remain present');assert.equal(new Set(tableDatePages).size,1,'the complete annual quantity table must stay together rather than isolating its final two months');assert.ok(drawn.includes(flat(cropExportText('Month',language))),'the authored month column must not fall back to English');}
    if(row.id==='recorded')for(const source of ['Actual kg','Expected kg','Eggs','Litres','Items','Stock kg'])assert.ok(drawn.includes(flat(cropExportText(source,language))),'quantity columns must retain their separate source units');
    assert.equal(JSON.stringify(input),original);
  }
});

test('the source layout evidence detects the observed annual-table split',()=>{
  const source=JSON.parse(read('tests/fixtures/production-graph-translation/native-table-layout-before.json'))as{rows:Array<{month:string;page:number}>};
  assert.equal(source.rows.length,12);assert.equal(new Set(source.rows.map(row=>row.page)).size,2,'the source regression fixture must contain the actual split, so the same-page check can fail');
});

test('the source layout evidence detects the observed single stock-card orphan',()=>{
  const source=JSON.parse(read('tests/fixtures/production-graph-translation/native-stock-layout-before.json'))as{pages:Array<{page:number;records:number}>};
  assert.deepEqual(source.pages.map(row=>row.records),[4,1],'the source fixture must retain the actual orphan so the same-page check notices it');
});
