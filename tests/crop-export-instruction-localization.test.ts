import assert from 'node:assert/strict';
import test from 'node:test';
import typescript from 'typescript';
import * as React from 'react';
import * as Icons from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { benchmarkYieldLabel, cropPlanPdfFilename, drawCropPlanPages, type CropPlanPdfInput } from '../lib/crop-export-pdf.ts';
import { jsPDF } from 'jspdf';
import { registerReportPdfFont } from '../lib/report-pdf-font.ts';
import { planAssuranceParagraphs, planAssuranceText, ASSURANCE_TITLE } from '../lib/plan-assurance.ts';
import { sitePdfAssurance } from '../lib/site-pdf-copy.ts';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildCropPlanIcs, icsDescription, foldIcsLine, cropPlanIcsFilename } from '../lib/crop-calendar-ics.ts';
import { CROP_EXPORT_COPY } from '../lib/crop-export-copy-data.ts';
import { CROP_EXPORT_DRAFT_LANGUAGES, cropExportText, isCropExportDraftLanguage } from '../lib/crop-export-copy.ts';
import { CROPS, cropByKey } from '../lib/crop-catalog.ts';
import { REPORT_DOCUMENT_LANGUAGES, REPORT_DOCUMENT_COPY, reportDocumentText } from '../lib/report-localisation.ts';
import { recordsMonthShort, recordsMonthLong } from '../lib/records-months.ts';
import { buildPlanDashboard, buildWorkloadSeries, buildPlanTableRows, buildFieldSheet, compactPlaces } from '../lib/crop-export-benchmark.ts';
import { buildBuyingSchedule, TRANSPLANT_NURSERY_GUIDANCE, SUCCESSION_TIMING_GUIDANCE, weightRangeLabel, monthShort, monthLong, monthYearLabel, sowingInstruction, taskPhrase, taskDetail, taskTitle, taskLine, taskSentence } from '../lib/crop-export-schedule.ts';
import { formatMonthSpan, treePickingPhrase } from '../lib/perennial-harvest.ts';
import { REPORT_VISUAL_COPY } from '../lib/report-visuals.ts';
import { printableAvailability, animalEntries } from '../lib/crop-export-availability.ts';
import { assumedProductSeason, planningTreeSeasons } from '../lib/production-product-guidance.ts';
import { treeAgeCalendarNote, ageReadyForSeason, buildProductionProjection } from '../lib/production-projection.ts';
import { SPECIES } from '../lib/species-catalog.ts';
import { planNotesDateLabel, confirmOnceSowing } from '../lib/crop-plan.ts';
import type { CropTask } from '../lib/crop-plan.ts';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fixture=JSON.parse(read('tests/fixtures/crop-export-translation/instructions-before.json')) as {sourceSha:string;rows:Array<{cropKey:string;sowing:string;bed:import('../lib/crop-plan.ts').PlanBed;planting:import('../lib/crop-plan.ts').Planting;tasks:Array<{task:CropTask;phrase:string;detail:string|null;title:string;line:string}>;sentence:string}>};
const packet=JSON.parse(read('docs/translation/four-language-completion/crop-export-drafts.json'));
const numbers=(text:string)=>(text.match(/\d+(?:[.,]\d+)?/g)??[]).sort();
const tokens=(text:string)=>(text.match(/\{\w+\}/g)??[]).sort();
// New catalogue clauses spell quantities in words; their drafts use the same values as digits.
// Compare semantic source values so 20-fold cannot silently become 21-fold.
function sourceFigureText(row:{english:string}):string{
  if(!('sourceWordNumbers'in row))return row.english;
  const words=(row as {english:string;sourceWordNumbers:string[]}).sourceWordNumbers;
  const values:Record<string,string>={two:'2',three:'3',four:'4',twenty:'20'};
  for(const word of words){assert.ok(Object.hasOwn(values,word));assert.ok(new RegExp('\\b'+word+'\\b').test(row.english),'a declared source figure must actually occur in the original English');}
  return row.english.replace(new RegExp('\\b('+words.join('|')+')\\b','g'),word=>values[word]);
}
const sourceFigures=(row:{english:string})=>numbers(sourceFigureText(row));
function sourceTextFigures(text:string):string[]{
  for(const row of CROP_EXPORT_COPY)if('sourceWordNumbers'in row&&text.includes(row.english))text=text.replace(row.english,sourceFigureText(row));
  return numbers(text);
}

function assertSourceTokens(rows:ReadonlyArray<{english:string;zu:string;st:string;ts:string;ve:string}>){
  assert.equal(new Set(rows.map(row=>row.english)).size,rows.length);
  for(const row of rows)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    assert.notEqual(row[language],row.english,`${language}: missing instruction draft`);
    assert.deepEqual(tokens(row[language]),tokens(row.english),`${language}: changed placeholders`);
    assert.deepEqual(numbers(row[language]),sourceFigures(row),`${language}: changed source rate or figure`);
  }
}

test('instruction drafts retain source rates, cultivar identities and every placeholder',()=>{
  assert.match(packet.status,/IN PROGRESS/);assert.equal(packet.sourceSha,fixture.sourceSha);
  assert.deepEqual(packet.rows,CROP_EXPORT_COPY);assertSourceTokens(CROP_EXPORT_COPY);
  assert.deepEqual(CROP_EXPORT_DRAFT_LANGUAGES,REPORT_DOCUMENT_LANGUAGES);
  for(const crop of CROPS.filter(crop=>crop.fieldSpacingInstruction))for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const source=crop.fieldSpacingInstruction!,native=cropExportText(source,language);
    assert.notEqual(native,source,`${crop.key}: source-specific field instruction missing`);
    assert.deepEqual(numbers(native),numbers(source));
    for(const name of ['Red cultivar','Black cultivar'])if(source.includes(name))assert.ok(native.includes(name));
  }
  const broken=CROP_EXPORT_COPY.map(row=>({...row}));
  const row=broken.find(row=>row.english.startsWith('broadcast at 20kg/ha'))!;
  row.ts=row.ts.replace('20kg/ha','21kg/ha') as typeof row.ts;
  assert.throws(()=>assertSourceTokens(broken),/changed source rate or figure/);
});

test('every original English crop instruction and task remains exact in default and unsupported languages',()=>{
  assert.deepEqual(CROPS.map(crop=>crop.key),fixture.rows.map(row=>row.cropKey),'cover every original catalogue crop');
  for(const row of fixture.rows){
    const crop=cropByKey(row.cropKey)!;
    for(const language of ['en','xx']){
      assert.equal(sowingInstruction(crop,language),row.sowing);
      for(const task of row.tasks){
        assert.equal(taskPhrase(task.task,language),task.phrase);
        assert.equal(taskDetail(task.task,language),task.detail);
        assert.equal(taskTitle(task.task,language),task.title);
        assert.equal(taskLine(task.task,language),task.line);
      }
      assert.equal(taskSentence(row.tasks.map(row=>row.task),language),row.sentence);
    }
  }
});

test('native task text keeps crop names, bed labels, task records and all source figures',()=>{
  const before=JSON.stringify(fixture);
  for(const row of fixture.rows)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    assert.notEqual(sowingInstruction(cropByKey(row.cropKey)!,language),row.sowing);
    for(const entry of row.tasks){
      const task=entry.task,phrase=taskPhrase(task,language),title=taskTitle(task,language),detail=taskDetail(task,language);
      assert.notEqual(phrase,entry.phrase,`${language}/${task.action}: English task fallback`);
      assert.ok(title.includes(task.cropName),'recorded crop identity stays exact');
      assert.ok(title.includes(task.bedLabel));assert.ok(phrase.includes(task.bedLabel));
      assert.deepEqual(numbers(phrase),numbers(entry.phrase));
      assert.deepEqual(numbers(title),numbers(entry.title));
      if(entry.detail===null)assert.equal(detail,null);else assert.deepEqual(numbers(detail!),numbers(entry.detail));
    }
  }
  assert.equal(JSON.stringify(fixture),before,'rendering wording cannot mutate tasks or saved labels');
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const value=cropExportText('Prep {bed} for {crop}',language,{bed:'Ṱanḓa {crop} $&',crop:'Original crop'});
    assert.ok(value.includes('Ṱanḓa {crop} $&'),'do not reinterpret placeholders within saved values');
    assert.equal(cropExportText('Private unregistered {count} record',language),'Private unregistered {count} record');
  }
});

test('localized month words keep the same month and forward calendar year',()=>{
  const date=new Date('2026-10-22T08:00:00Z');
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES)for(let month=1;month<=12;month++){
    assert.equal(monthShort(month,language),recordsMonthShort(language,month));
    assert.equal(monthLong(month,language),recordsMonthLong(language,month));
    assert.equal(monthYearLabel(month,date,language),`${recordsMonthLong(language,month)} ${month<10?2027:2026}`);
  }
});

const calendarBefore=JSON.parse(read('tests/fixtures/crop-export-translation/ics-before.json')) as {sourceSha:string;now:string;stamp:string;emptySha256:string;rows:Array<{cropKey:string;sha256:string;descriptions:string[]}>};
const calendarOptions={now:new Date(calendarBefore.now),stamp:new Date(calendarBefore.stamp)};
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
function calendarLines(text:string){
  assert.ok(!/(?<!\r)\n/.test(text),'calendar clients require CRLF line endings');
  for(const line of text.split('\r\n')){
    assert.ok(Buffer.byteLength(line,'utf8')<=75,'a physical calendar line must fit 75 UTF-8 octets');
    assert.ok(!line.includes('\uFFFD'),'Unicode text must not be split into replacement characters');
  }
  return text.replace(/\r\n /g,'').split('\r\n').filter(Boolean);
}
const value=(line:string)=>line.slice(line.indexOf(':')+1).replace(/\\([\\;,nN])/g,(_,ch:string)=>/[nN]/.test(ch)?'\n':ch);
const eventText=(lines:string[],name:string)=>lines.filter(line=>line.startsWith(name+':')).map(value);
const calendarMechanics=(lines:string[])=>lines.filter(line=>!['X-WR-CALNAME:','X-WR-CALDESC:','SUMMARY:','DESCRIPTION:'].some(prefix=>line.startsWith(prefix)));

function assertNativeCalendar(text:string,english:string,tasks:CropTask[],language:string){
  const lines=calendarLines(text),source=calendarLines(english);
  assert.deepEqual(calendarMechanics(lines),calendarMechanics(source),'changing language cannot move events, rename their identities, change locations or change alarm timing');
  const summaries=eventText(lines,'SUMMARY'),originalSummaries=eventText(source,'SUMMARY');
  assert.equal(summaries.length,tasks.length);
  for(let i=0;i<summaries.length;i++)assert.notEqual(summaries[i],originalSummaries[i],'each task must have a translated calendar title');
  const descriptions=eventText(lines,'DESCRIPTION');
  assert.equal(descriptions.length,tasks.length*2,'every event has both its instructions and its display reminder');
  const notice=reportDocumentText('Draft translation: not yet reviewed by a fluent speaker. Check the English source before acting.',language);
  for(const text of descriptions.filter((_,index)=>index%2===0)){
    assert.ok(text.endsWith(notice),'every imported event must carry its own unreviewed translation notice');
    assert.ok(!text.includes('Any time during '),'whole-month warning must not fall back to English');
  }
  assert.ok(eventText(lines,'X-WR-CALDESC')[0].endsWith(notice),'empty calendars also retain draft status');
}

test('calendar language is presentation only and every original English file remains byte-exact',()=>{
  assert.equal(calendarBefore.sourceSha,fixture.sourceSha);
  for(const language of [undefined,'en','xx']){
    assert.equal(digest(buildCropPlanIcs([],{...calendarOptions,language})),calendarBefore.emptySha256);
    for(const row of fixture.rows){
      const before=calendarBefore.rows.find(entry=>entry.cropKey===row.cropKey)!;
      const tasks=row.tasks.map(entry=>entry.task);
      assert.equal(digest(buildCropPlanIcs(tasks,{...calendarOptions,language})),before.sha256,`${row.cropKey}: changed original English calendar`);
      assert.deepEqual(tasks.map(task=>icsDescription(task,language)),before.descriptions);
    }
  }
});

test('all crop actions import native instructions and reminders without changing their calendar mechanics',()=>{
  const original=JSON.stringify(fixture);
  for(const row of fixture.rows){
    const tasks=row.tasks.map(entry=>entry.task),english=buildCropPlanIcs(tasks,calendarOptions);
    for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
      const text=buildCropPlanIcs(tasks,{...calendarOptions,language});
      assertNativeCalendar(text,english,tasks,language);
      for(const task of tasks){
        const description=icsDescription(task,language);
        assert.ok(description.includes(task.bedLabel),'recorded bed labels cannot be translated or reinterpreted');
        const notice=reportDocumentText('Draft translation: not yet reviewed by a fluent speaker. Check the English source before acting.',language);
        assert.deepEqual(numbers(description.replace(notice,'')),numbers(icsDescription(task)),'source spacing, depth and seed rates must survive calendar export');
      }
    }
  }
  assert.equal(JSON.stringify(fixture),original,'exporting must not mutate saved tasks or names');
  const tasks=fixture.rows.find(row=>row.tasks.some(entry=>entry.task.action==='transplant'))!.tasks.map(entry=>entry.task);
  const english=buildCropPlanIcs(tasks,calendarOptions),language='ve';
  const native=buildCropPlanIcs(tasks,{...calendarOptions,language});
  assert.throws(()=>assertNativeCalendar(native.replace('TRIGGER:-P3D','TRIGGER:-P4D'),english,tasks,language),/alarm timing/,'negative check: a shifted reminder must fail');
  const nativeLines=calendarLines(native),englishLines=calendarLines(english);
  const englishTitle=englishLines.find(line=>line.startsWith('SUMMARY:'))!;
  const badTitles=nativeLines.map(line=>line.startsWith('SUMMARY:')?englishTitle:line).map(foldIcsLine).join('\r\n')+'\r\n';
  assert.throws(()=>assertNativeCalendar(badTitles,english,tasks,language),/translated calendar title/,'negative check: untranslated task titles must fail');
});

test('custom calendar names stay private verbatim and native dates remain whole-month markers',()=>{
  const name='Original Ṱanḓa {month} $& \\ , ;\n{count}';
  const tasks=fixture.rows.flatMap(row=>row.tasks.map(entry=>entry.task));
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const text=buildCropPlanIcs(tasks,{...calendarOptions,calendarName:name,language});
    const lines=calendarLines(text);
    assert.equal(eventText(lines,'X-WR-CALNAME')[0],name);
    for(const line of lines.filter(line=>line.startsWith('DTSTART;VALUE=DATE:')))assert.ok(line.endsWith('01'),'never invent a precise planting day');
    for(const task of tasks){
      const warning=cropExportText('Any time during {month} is fine — this plan works in whole months, so the date on this entry is a marker for the month, not the exact day.',language,{month:monthLong(task.month,language)});
      assert.ok(icsDescription(task,language).includes(warning),'every event explains the month-sized precision in the selected language');
    }
    assert.notEqual(eventText(calendarLines(buildCropPlanIcs([],{...calendarOptions,language})),'X-WR-CALNAME')[0],'ImbewuField crop plan');
  }
});

const perennialBefore=JSON.parse(read('tests/fixtures/crop-export-translation/perennial-before.json'));
test('every original perennial month span and picking sentence remains exact by default',()=>{
  for(const language of ['en','xx']){
    const spans=Array.from({length:4096},(_,mask)=>formatMonthSpan(Array.from({length:12},(_,i)=>i+1).filter(month=>mask&(1<<(month-1))),language));
    assert.equal(digest(JSON.stringify(spans)),perennialBefore.sha256,'all month subsets must retain their original spans');
    assert.equal(treePickingPhrase(perennialBefore.line,language),perennialBefore.phrase);
  }
});

test('translated picking spans preserve year-boundary order and the recorded tree identity',()=>{
  const before=JSON.stringify(perennialBefore.line);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    assert.equal(formatMonthSpan([11,12,1],language),`${recordsMonthShort(language,11)}–${recordsMonthShort(language,1)}`);
    assert.equal(formatMonthSpan([12,3,4],language),`${recordsMonthShort(language,3)}–${recordsMonthShort(language,4)}, ${recordsMonthShort(language,12)}`);
    assert.equal(formatMonthSpan([0,13,1,1],language),recordsMonthShort(language,1));
    assert.equal(formatMonthSpan([],language),'');
    assert.equal(formatMonthSpan(Array.from({length:12},(_,i)=>i+1),language),cropExportText('All year',language));
    const phrase=treePickingPhrase(perennialBefore.line,language);
    assert.notEqual(phrase,perennialBefore.phrase);assert.ok(phrase.includes(perennialBefore.line.name));
    assert.ok(phrase.includes('(7)'));assert.ok(phrase.includes(formatMonthSpan(perennialBefore.line.season,language)));
    assert.deepEqual(numbers(phrase),numbers(perennialBefore.phrase));
  }
  assert.equal(JSON.stringify(perennialBefore.line),before);
});

const cardBefore=read('tests/fixtures/crop-export-translation/export-card-before.tsx.txt');
const cardCurrent=read('components/crops/CropPlanExportCard.tsx');
const cardProps={beds:fixture.rows[0].bed?[fixture.rows[0].bed]:[],plantings:[fixture.rows[0].planting],tasks:fixture.rows[0].tasks.map(entry=>entry.task),meta:{planTitle:'Original Ṱanḓa {count} $&',siteLine:'Original source site',locationLine:'Original source location',climateLine:'Original source climate',bedsSummary:'Original source area',dateLabel:'22 October 2026',estimatedKgPerYear:null,lossPercent:25}};
function renderExportCard(source:string,language:string,props:Record<string,unknown>={}){
  const tree=typescript.createSourceFile('card.tsx',source,typescript.ScriptTarget.Latest,true,typescript.ScriptKind.TSX);
  const body=tree.statements.filter(node=>!typescript.isImportDeclaration(node)).map(node=>node.getText(tree)).join('\n').replace('export default function CropPlanExportCard','function CropPlanExportCard');
  const js=typescript.transpileModule(body,{compilerOptions:{jsx:typescript.JsxEmit.React,module:typescript.ModuleKind.None,target:typescript.ScriptTarget.ES2022}}).outputText;
  const scope={React,useState:React.useState,useEffect:React.useEffect,exports:{},Share2:Icons.Share2,CalendarPlus:Icons.CalendarPlus,Hourglass:Icons.Hourglass,Download:Icons.Download,ClipboardList:Icons.ClipboardList,cropExportText,isCropExportDraftLanguage,useLanguage:()=>({lang:language})};
  const Component=new Function(...Object.keys(scope),js+'; return CropPlanExportCard;')(...Object.values(scope));
  return renderToStaticMarkup(React.createElement(Component,{...cardProps,...props}));
}
const renderedWords=(html:string)=>html.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]*>/g,' ').replace(/&#x27;/g,"'").replace(/&quot;/g,'\"').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();

function assertTranslatedCardBoundaries(source:string){
  const tree=typescript.createSourceFile('card.tsx',source,typescript.ScriptTarget.Latest,true,typescript.ScriptKind.TSX);
  const known=new Set(CROP_EXPORT_COPY.map(row=>row.english));
  function visit(node:typescript.Node){
    if(typescript.isJsxText(node)){
      const text=node.text.replace(/\s+/g,' ').trim();
      if(/[A-Za-z]/.test(text))assert.match(text,/^A[234]$/,'new visible English prose must have a registered translation');
    }
    if(typescript.isJsxAttribute(node)&&['title','aria-label'].includes(node.name.getText(tree))&&node.initializer&&typescript.isStringLiteral(node.initializer))assert.fail('accessible export labels must follow the selected language');
    if(typescript.isCallExpression(node)&&typescript.isIdentifier(node.expression)&&['copy','cropUi','message'].includes(node.expression.text)){
      const source=node.arguments[node.expression.text==='cropUi'?1:0];
      if(source&&typescript.isStringLiteral(source))assert.ok(known.has(source.text as typeof CROP_EXPORT_COPY[number]['english']),`unregistered export UI source: ${source.text}`);
    }
    typescript.forEachChild(node,visit);
  }
  visit(tree);
}

test('every authored export control and accessible label has registered copy that can reject a new English fallback',()=>{
  assertTranslatedCardBoundaries(cardCurrent);
  assert.throws(()=>assertTranslatedCardBoundaries(cardCurrent.replace('{copy("What each file contains")}','New untranslated export instructions')),/new visible English prose/);
  assert.throws(()=>assertTranslatedCardBoundaries(cardCurrent.replace('copy("Calendar paper size")',"copy('Unregistered export control')")),/unregistered export UI source/);
  assert.throws(()=>assertTranslatedCardBoundaries(cardCurrent.replace('aria-label={copy("Calendar paper size")}','aria-label="Calendar paper size"')),/accessible export labels/);
});

test('the actual export card keeps default English contents and existing isiZulu control wording',()=>{
  for(const sections of [undefined,['calendar','taskSummary']])for(const tasks of [cardProps.tasks,[],[cardProps.tasks[0]]]){
    const props={sections,tasks};
    assert.equal(renderedWords(renderExportCard(cardCurrent,'en',props)),renderedWords(renderExportCard(cardBefore,'en',props)),'default English export instructions and controls stay exact');
  }
  const sourceTree=typescript.createSourceFile('before.tsx',cardBefore,typescript.ScriptTarget.Latest,true,typescript.ScriptKind.TSX);
  function visit(node:typescript.Node){
    if(typescript.isCallExpression(node)&&typescript.isIdentifier(node.expression)&&node.expression.text==='cropUi'&&node.arguments.length===3){
      const english=node.arguments[1],zulu=node.arguments[2];
      if(typescript.isStringLiteral(english)&&typescript.isStringLiteral(zulu)&&english.text!=='Add')assert.ok(cardCurrent.includes(node.getText(sourceTree)),`keep prior isiZulu wording for ${english.text}`);
    }
    typescript.forEachChild(node,visit);
  }visit(sourceTree);
  const one=renderedWords(renderExportCard(cardCurrent,'zu',{tasks:[cardProps.tasks[0]]}));
  assert.ok(one.includes('Engeza 1 umsebenzi ekhalendeni'));
  const several=renderedWords(renderExportCard(cardCurrent,'zu',{tasks:[cardProps.tasks[0],cardProps.tasks[0]]}));
  assert.ok(several.includes('Engeza 2 imisebenzi ekhalendeni'));
});

test('the rendered native export card includes the complete file instructions, draft status and section choices',()=>{
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const html=renderExportCard(cardCurrent,language,{sections:['calendar','taskSummary']}),text=renderedWords(html);
    for(const source of ['Take this plan with you','Files are made on this device. Download a copy to use away from the app.','Your plan includes vegetables, fruit, nuts, berries and animal products from your map.','What each file contains','Calendar translations await language and local farming review. PDF labels and instructions are not fully translated yet.'])assert.ok(text.includes(cropExportText(source,language)),`${language}: missing ${source}`);
    assert.ok(html.includes(cropExportText('Calendar paper size',language)),'the paper picker is accessible in the selected language');
    assert.ok(!text.includes('The calendar file works with Google Calendar'),'expanded file instructions must not stay English');
    assert.ok(!text.includes('Picking dates for trees and animals must be confirmed locally'),'local picking caution must be translated, not omitted');
    assert.ok(text.includes(cropExportText('bed calendar',language)));assert.ok(text.includes(cropExportText('monthly jobs',language)));
  }
});

test('native filenames retain recorded letters and export kinds without changing default English names',()=>{
  const date=new Date('2026-10-22T08:00:00Z');
  assert.equal(cropPlanIcsFilename('Ubhejane Crèche',date),'ImbewuField-Crop-Plan-Ubhejane-Creche-2026-10-22.ics');
  assert.equal(cropPlanPdfFilename('Ubhejane Crèche',date),'ImbewuField-Crop-Plan-Ubhejane-Creche-2026-10-22.pdf');
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const title='Ṱanḓa ṋḓḽ / {count} $&',pdf=cropPlanPdfFilename(title,date,'quick-print-a3',language),ics=cropPlanIcsFilename(title,date,language);
    for(const name of [pdf,ics]){assert.ok(name.includes('Ṱanḓa-ṋḓḽ'));assert.equal(name,name.normalize('NFC'));assert.ok(!/[\\/]/.test(name),'recorded text cannot become a file path');assert.ok(name.includes('2026-10-22'));}
    assert.ok(pdf.includes('-quick-print-a3-'));assert.notEqual(pdf,cropPlanPdfFilename(title,date,'reference',language));
  }
});

const buildersBefore=JSON.parse(read('tests/fixtures/crop-export-translation/builders-before.json'));
test('shared dashboard, buying, plan-table and field-sheet English outputs retain all original catalogue cases',()=>{
  const all={plantings:fixture.rows.map(row=>row.planting),beds:fixture.rows.map(row=>row.bed),tasks:fixture.rows.flatMap(row=>row.tasks.map(entry=>entry.task))};
  const now=new Date(buildersBefore.now),nowMonth=now.getMonth()+1;
  assert.equal(buildersBefore.sourceSha,fixture.sourceSha);assert.equal(buildersBefore.crops,fixture.rows.length);assert.equal(buildersBefore.tasks,all.tasks.length);
  const cases=[{id:'all-source-crops',...all},{id:'no-plantings',plantings:[],beds:[],tasks:[]}];
  const rows=cases.map(row=>({id:row.id,outputs:{
    dashboardUnconfirmed:buildPlanDashboard(row.plantings,row.beds,row.tasks,{nowMonth,lossPercent:25,lossAllowanceConfirmed:false}),
    dashboardConfirmed:buildPlanDashboard(row.plantings,row.beds,row.tasks,{nowMonth,lossPercent:25,lossAllowanceConfirmed:true}),
    planTable:buildPlanTableRows(row.plantings,row.beds),planTableMildFrost:buildPlanTableRows(row.plantings,row.beds,true),
    buying:buildBuyingSchedule(row.plantings,row.beds,nowMonth),
    fieldSheets:Array.from({length:12},(_,i)=>buildFieldSheet((nowMonth+i-1)%12+1,row.tasks,now,row.plantings,row.beds)),
  }}));
  assert.deepEqual(JSON.parse(JSON.stringify(rows)),buildersBefore.rows,'translate presentation without changing default-English schedule output');
});

const buyingMetadata=(schedule:ReturnType<typeof buildBuyingSchedule>)=>schedule.map(month=>({...month,items:month.items.map(({note,...item})=>item)}));
function assertBuyingPresentation(native:ReturnType<typeof buildBuyingSchedule>,english:ReturnType<typeof buildBuyingSchedule>){
  assert.deepEqual(buyingMetadata(native),buyingMetadata(english),'translation cannot change unit codes, crop identities, quantities, bed labels or purchase dates');
  for(let m=0;m<english.length;m++)for(let i=0;i<english[m].items.length;i++){
    const source=english[m].items[i],row=native[m].items[i];
    assert.notEqual(row.note,source.note,'each source buying instruction must be translated');
    assert.deepEqual(numbers(row.note),sourceTextFigures(source.note),'source rate ranges, nursery weeks and final-stand figures must survive');
  }
}

test('native buying notes keep every catalogue quantity, unit, cohort date and recorded bed name',()=>{
  const plantings=fixture.rows.map(row=>row.planting),beds=fixture.rows.map(row=>row.bed);
  const before=JSON.stringify({plantings,beds}),english=buildBuyingSchedule(plantings,beds,10);
  for(const language of ['en','xx'])assert.deepEqual(buildBuyingSchedule(plantings,beds,10,language),english);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const native=buildBuyingSchedule(plantings,beds,10,language);assertBuyingPresentation(native,english);
    for(const item of native.flatMap(month=>month.items))if(item.transplant){
      assert.ok(item.note.includes(cropExportText(TRANSPLANT_NURSERY_GUIDANCE,language)),'readiness and delayed-seedling caution stays complete');
      assert.ok(item.note.includes('4–6')&&item.note.includes('8–12'));
    }
  }
  assert.equal(JSON.stringify({plantings,beds}),before);
  const broken=structuredClone(buildBuyingSchedule(plantings,beds,10,'ts'));broken[0].items[0].unit='wrong-material';
  assert.throws(()=>assertBuyingPresentation(broken,english),/unit codes/,'negative check: a translated metadata unit must be rejected');
});

test('a settled nursery starter still says its seed month passed in every language',()=>{
  const original=fixture.rows.find(row=>row.cropKey==='cabbage')!;
  const starter={...original.planting,sowMonth:9,once:'2026-09'};
  const plants=[confirmOnceSowing(starter,2026,10)],beds=[original.bed],english=buildBuyingSchedule(plants,beds,10);
  assert.equal(english.flatMap(month=>month.items).length,1,'exercise the settled nursery exception');
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const native=buildBuyingSchedule(plants,beds,10,language);assertBuyingPresentation(native,english);
    const item=native[0].items[0];
    assert.ok(item.note.includes(cropExportText("This one-time starter's tray-sowing month ({month}) has passed, so buying ready-grown seedlings is the remaining route.",language,{month:monthLong(9,language)})));
    assert.ok(!item.note.includes(cropExportText('Raising your own instead? Source packet seed before the {month} tray-sowing month, use its tray-sowing rate, and sow trays in {month}.',language,{month:monthLong(9,language)})),'do not revive a completed seed purchase after translation');
  }
});

test('common buying headings reuse the canonical dictionary and technical potato roots do not become another crop',()=>{
  const authorities:Record<string,ReadonlyArray<{english:string;zu:string;st:string;ts:string;ve:string}>>={REPORT_DOCUMENT_COPY,REPORT_VISUAL_COPY};
  for(const row of CROP_EXPORT_COPY){
    if(!('sourceAuthority'in row))continue;
    const authority=authorities[row.sourceAuthority];assert.ok(authority);
    const original=authority.find(source=>source.english===row.english);assert.ok(original);
    for(const language of CROP_EXPORT_DRAFT_LANGUAGES)assert.equal(row[language],original[language]);
  }
  const lexical=packet.lexicalChecks.find((row:{term:string})=>row.term==='potato');assert.ok(lexical.visuallyInspected);
  function assertPotatoLabel(ts:string,ve:string){
    assert.ok(lexical.tsRoots.some((root:string)=>ts.includes(root)),'potato unit must retain a potato lexical root');
    assert.ok(ve.includes(lexical.veRoot),'potato unit must retain its checked Tshivenda root');
  }
  assertPotatoLabel(cropExportText('seed potatoes','ts'),cropExportText('seed potatoes','ve'));
  assert.throws(()=>assertPotatoLabel('matamatisi ya le hansi ya mbewu',cropExportText('seed potatoes','ve')),/potato lexical root/,'negative check: tomato material is not a potato translation');
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    assert.notEqual(cropExportText(SUCCESSION_TIMING_GUIDANCE,language),SUCCESSION_TIMING_GUIDANCE);
    assert.notEqual(cropExportText(TRANSPLANT_NURSERY_GUIDANCE,language),TRANSPLANT_NURSERY_GUIDANCE);
    assert.deepEqual(numbers(cropExportText(TRANSPLANT_NURSERY_GUIDANCE,language)),numbers(TRANSPLANT_NURSERY_GUIDANCE));
  }
});

test('every seed-rate catalogue clause is translated rather than hidden inside a partly translated buying note',()=>{
  const crops=CROPS.filter(crop=>crop.seedRateKgPerHaRange);
  function assertClauses(translate:(source:string,language:string)=>string){
    for(const crop of crops)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
      const source=crop.fieldSpacingInstruction??crop.note,wording=translate(source,language);
      assert.notEqual(wording,source,`${language}/${crop.key}: source-owned catalogue clause needs its own translation`);
      const row=CROP_EXPORT_COPY.find(row=>row.english===source);assert.ok(row);assert.deepEqual(numbers(wording),sourceFigures(row));
      for(const identity of ['Cucurbitaceae','Apiaceae','Brassicaceae','pumpkin','butternut','cucumber','watermelon','carrots','maize','gem-squash','cabbage','turnip','Western Cape','WC','Red cultivar','Black cultivar'])if(source.includes(identity))assert.ok(wording.includes(identity),`preserve catalogue identity ${identity}`);
    }
  }
  assertClauses(cropExportText);
  const gem=cropByKey('gem-squash')!.note;
  assert.throws(()=>assertClauses((source,language)=>source===gem?source:cropExportText(source,language)),/catalogue clause needs its own translation/,'negative check reproduces the English Gem squash paragraph seen in the rendered PDF');
  for(const range of [[0.0012,0.0018],[42,84],[1,1]] as const)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const native=weightRangeLabel(range,language),english=weightRangeLabel(range);
    assert.notEqual(native,english);assert.deepEqual(numbers(native),numbers(english));
    assert.equal(native.includes(' kg '),english.includes(' kg '));assert.equal(native.includes(' g '),english.includes(' g '),'the SI unit and scale cannot change with language');
  }
});


test('word-spelled source quantities retain their values when a native draft uses digits',()=>{
  const row=CROP_EXPORT_COPY.find(row=>row.english.startsWith('A dual-purpose legume:'))!;
  assert.deepEqual(sourceFigures(row),['2','20','3','4']);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES)assert.deepEqual(numbers(row[language]),sourceFigures(row));
  const broken=CROP_EXPORT_COPY.map(row=>({...row}));const cowpea=broken.find(row=>row.english.startsWith('A dual-purpose legume:'))!;
  cowpea.ts=cowpea.ts.replace('20','21') as typeof cowpea.ts;
  assert.throws(()=>assertSourceTokens(broken),/changed source rate or figure/,'negative check: an incorrect spelled-number conversion must fail');
});

const whiteContrast=(hex:string)=>{
  const digits=hex.replace('#','');assert.match(digits,/^[0-9a-f]{6}$/i);
  const channel=(offset:number)=>{const c=parseInt(digits.slice(offset,offset+2),16)/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;};
  return 1.05/(0.2126*channel(0)+0.7152*channel(2)+0.0722*channel(4)+0.05);
};
function assertReadableCaution(color:string){assert.ok(whiteContrast(color)>=4.5,'farming caution and draft status must not fade below normal-text contrast');}

test('the actual native PDF paints its farming caution and draft notice with readable contrast',async()=>{
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc);
    const prefixes=[sitePdfAssurance(language),reportDocumentText('Draft translation: not yet reviewed by a fluent speaker. Check the English source before acting.',language)].map(value=>value.slice(0,36));
    const painted:Array<{prefix:number;color:string}>=[],allText:string[]=[],write=doc.text.bind(doc);
    doc.text=((...args:unknown[])=>{
      const text=Array.isArray(args[0])?args[0].join(' '):String(args[0]);
      allText.push(text);
      const prefix=prefixes.findIndex(prefix=>text.startsWith(prefix));
      if(prefix>=0)painted.push({prefix,color:doc.getTextColor()});
      return(write as (...args:unknown[])=>jsPDF)(...args);
    })as typeof doc.text;
    const input={...cardProps,meta:{...cardProps.meta,language},now:new Date('2026-10-22T08:00:00Z'),sections:['calendar']}as CropPlanPdfInput;
    drawCropPlanPages(doc,input,false,{language,font});
    for(let prefix=0;prefix<prefixes.length;prefix++)assert.ok(painted.some(row=>row.prefix===prefix),'check both complete source cautions in actual paint calls');
    const drawn=allText.join(' ').replace(/\s+/g,' ');
    for(const full of [sitePdfAssurance(language),reportDocumentText('Draft translation: not yet reviewed by a fluent speaker. Check the English source before acting.',language)])assert.ok(drawn.includes(full.replace(/\s+/g,' ')),'the actual native page must paint the complete canonical warning, not just its first line');
    painted.forEach(row=>assertReadableCaution(row.color));
  }
  assert.throws(()=>assertReadableCaution('#a29682'),/normal-text contrast/,'negative check: the earlier faint metadata colour must fail for a farming warning');
});

function assertFieldPresentation(native:ReturnType<typeof buildFieldSheet>, english:ReturnType<typeof buildFieldSheet>){
  for(const key of ['month','sourceLines','workRows','plantingFocus','harvestFocus'] as const)assert.equal(native[key],english[key],`language cannot change ${key}`);
  assert.equal(native.sections.length,english.sections.length);
  native.sections.forEach((section,index)=>{
    const source=english.sections[index];
    assert.notEqual(section.title,source.title,'every field category needs native wording');
    assert.equal(section.rows.length,source.rows.length,'language cannot regroup or lose jobs');
    section.rows.forEach((row,i)=>{
      assert.notEqual(row.work,source.rows[i].work,'every field job needs native wording');
      assert.deepEqual(numbers(row.work),numbers(source.rows[i].work),'field allocations, spacing and source rates stay exact');
    });
    if(source.note)assert.notEqual(section.note,source.note,'section advice needs native wording');
  });
}

test('monthly field sheets translate every original job after grouping while keeping counts, rates and source records',()=>{
  const now=new Date(buildersBefore.now),plantings=fixture.rows.map(row=>row.planting),beds=fixture.rows.map(row=>row.bed),tasks=fixture.rows.flatMap(row=>row.tasks.map(entry=>entry.task));
  const original=JSON.stringify({plantings,beds,tasks});let checked=0;
  for(let month=1;month<=12;month++){
    const english=buildFieldSheet(month,tasks,now,plantings,beds);
    assert.deepEqual(buildFieldSheet(month,tasks,now,plantings,beds,'xx'),english);
    for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
      const native=buildFieldSheet(month,tasks,now,plantings,beds,language);
      assertFieldPresentation(native,english);assert.equal(native.monthLabel,monthYearLabel(month,now,language));
      checked+=native.workRows;
      if(native.workRows){
        const wrong=structuredClone(native);wrong.workRows++;
        assert.throws(()=>assertFieldPresentation(wrong,english),/workRows/);
        const row=wrong.sections.flatMap(section=>section.rows).find(row=>/\d/.test(row.work));
        if(row){wrong.workRows--;row.work=row.work.replace(/\d/,value=>String((Number(value)+1)%10));assert.throws(()=>assertFieldPresentation(wrong,english),/source rates stay exact/);}
      }
    }
  }
  assert.ok(checked>100,'exercise real catalogue instructions across the whole year');
  assert.equal(JSON.stringify({plantings,beds,tasks}),original);
});

test('native field sheets preserve custom names and private preparation notes even when they resemble interface copy',()=>{
  const row=fixture.rows.find(row=>row.cropKey==='carrot')??fixture.rows[0];
  const now=new Date('2026-10-22T08:00:00Z');
  const task={...row.tasks.find(entry=>entry.task.action==='prep')!.task,month:10,cohortSowMonth:10,cohortMonthOffset:0,bedLabel:'Nursery',cropName:'Ṱanḓa {crops} $&',prepText:'prep bed (Private {count} $& care 17)'};
  const before=JSON.stringify(task);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const native=buildFieldSheet(10,[task],now,[],[],language);
    assert.equal(native.sections.length,1);assert.equal(native.sections[0].rows[0].place,'Nursery','a private bed name is not the internal nursery category');
    assert.ok(native.sections[0].rows[0].work.includes('Ṱanḓa {crops} $&'));
    assert.ok(native.sections[0].note!.includes('Private {count} $& care 17.'));
  }
  assert.equal(JSON.stringify(task),before);
});

test('native field allocation wording preserves fractional bed and plot areas through every monthly job',()=>{
  const now=new Date(buildersBefore.now),tasks=fixture.rows.flatMap(row=>row.tasks.map(entry=>entry.task));
  for(const fraction of [0.5,1/3,0.25,0.17]){
    const plantings=fixture.rows.map(row=>({...row.planting,areaFraction:fraction})),beds=fixture.rows.map(row=>row.bed);
    const before=JSON.stringify({plantings,beds,tasks});
    for(let month=1;month<=12;month++)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
      assertFieldPresentation(buildFieldSheet(month,tasks,now,plantings,beds,language),buildFieldSheet(month,tasks,now,plantings,beds));
    }
    assert.equal(JSON.stringify({plantings,beds,tasks}),before);
  }
});

test('only generated plural place wrappers change language; recorded single and custom place names stay exact',()=>{
  const places=['Bed 1','Bed 2','Bed 3','Plot 9','Plot 11','Ṱanḓa {numbers} $&','Nursery'];
  assert.equal(compactPlaces(places),'Beds 1–3; Plots 9, 11; Ṱanḓa {numbers} $&; Nursery');
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    assert.equal(compactPlaces(['Bed 1'],language),'Bed 1');
    assert.equal(compactPlaces(['Nursery'],language),'Nursery');
    assert.equal(compactPlaces(places,language),`${cropExportText('Beds {numbers}',language,{numbers:'1–3'})}; ${cropExportText('Plots {numbers}',language,{numbers:'9, 11'})}; Ṱanḓa {numbers} $&; Nursery`);
    assert.deepEqual(numbers(compactPlaces(places,language)),numbers(compactPlaces(places)));
  }
});

test('actual native field PDFs print every grouped instruction and one tick per job through continuation pages',async()=>{
  const now=new Date(buildersBefore.now),plantings=fixture.rows.map(row=>({...row.planting,bedId:'shared-source-bed'}));
  const beds=[{...fixture.rows[0].bed,id:'shared-source-bed',label:'Ṱanḓa {numbers} $&'}];
  const tasks=fixture.rows.flatMap(row=>row.tasks.map(entry=>({...entry.task,bedLabel:beds[0].label})));
  const metadata={...cardProps.meta,planTitle:'Ṱanḓa {month} $&'};
  const records=JSON.stringify({plantings,beds,tasks,metadata});
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),allText:string[]=[];
    let ticks=0;const text=doc.text.bind(doc),rect=doc.rect.bind(doc),pageText=new Map<number,string[]>();
    doc.text=((...args:unknown[])=>{
      const wording=Array.isArray(args[0])?args[0].join(' '):String(args[0]);allText.push(wording);
      const page=doc.getCurrentPageInfo().pageNumber,lines=pageText.get(page)??[];lines.push(wording);pageText.set(page,lines);
      return(text as (...args:unknown[])=>jsPDF)(...args);
    })as typeof doc.text;
    doc.rect=((...args:unknown[])=>{if(args[2]===12&&args[3]===12&&args[4]==='S')ticks++;return(rect as (...args:unknown[])=>jsPDF)(...args);})as typeof doc.rect;
    drawCropPlanPages(doc,{plantings,beds,tasks,meta:{...metadata,language},now,sections:['fieldsheets']},false,{language,font});
    const sheets=Array.from({length:12},(_,i)=>buildFieldSheet(i+1,tasks,now,plantings,beds,language));
    assert.equal(ticks,sheets.reduce((sum,sheet)=>sum+sheet.workRows,0),'continuing a long job must not invent a second checkbox');
    const words=allText.join(' ').split(/\s+/);
    for(const row of sheets.flatMap(sheet=>sheet.sections.flatMap(section=>section.rows))){
      let cursor=0;
      for(const word of row.work.split(/\s+/)){
        while(cursor<words.length&&words[cursor]!==word)cursor++;
        assert.ok(cursor<words.length,`${language}: missing printed instruction word ${word}`);cursor++;
      }
    }
    for(const lines of pageText.values())assert.ok(lines.join(' ').includes(beds[0].label),'every continued field sheet must still identify the saved bed');
    const drawn=allText.join(' ');
    assert.ok(drawn.includes('Ṱanḓa {month} $&'),'private plan titles must not be reinterpreted as templates');
    for(const source of ['WORK TO COMPLETE','DATE / NOTE','Start checking in','Water and mulch.','Record kilograms and where it went.'])assert.ok(!drawn.includes(source),`${source}: English field furniture fallback`);
    assert.ok(drawn.includes(cropExportText('{title} (continued)',language,{title:''}).trim()),'stress fixture must exercise actual continuation pages');
  }
  assert.equal(JSON.stringify({plantings,beds,tasks,metadata}),records);
});

test('native field reminders keep supplied product labels and undated observations separate from promised harvests',async()=>{
  const availability:NonNullable<CropPlanPdfInput['availability']>={
    forest:[[{iconKey:'tree:synthetic',label:'Recorded tree {name} $&'},{iconKey:'tree:synthetic',label:'Recorded tree {name} $&'}]],
    animals:[[{iconKey:'animal:synthetic',label:'Recorded product {name} $&'}]],
    undated:[{iconKey:'tree:undated',label:'Recorded plant',detail:'Private observation {count} $& 17'},{iconKey:'housing:synthetic',label:'Recorded housing',detail:'Private care {count} $& 23'}],
  };
  const original=JSON.stringify(availability);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),allText:string[]=[];
    const text=doc.text.bind(doc);doc.text=((...args:unknown[])=>{allText.push(Array.isArray(args[0])?args[0].join(' '):String(args[0]));return(text as (...args:unknown[])=>jsPDF)(...args);})as typeof doc.text;
    drawCropPlanPages(doc,{...cardProps,plantings:[],beds:[],tasks:[],availability,meta:{...cardProps.meta,language},now:new Date(buildersBefore.now),sections:['fieldsheets']},false,{language,font});
    const drawn=allText.join(' ').replace(/\s+/g,' ');
    for(const source of [
      'These are the same locally confirmed months as the picture calendar. Check readiness and record what actually happens; no quantity is promised.',
      'Undated reminders, not scheduled harvests. Check local care and readiness before establishment; record dates when known.',
    ])assert.ok(drawn.includes(cropExportText(source,language).replace(/\s+/g,' ')),'print the full local-confirmation/no-quantity condition');
    for(const entry of availability.undated!)assert.ok(drawn.includes(`${entry.label}: ${entry.detail}`));
    for(const label of ['Recorded tree {name} $&','Recorded product {name} $&'])assert.equal(drawn.split(label).length-1,1,'duplicate availability entries must not become extra jobs');
  }
  assert.equal(JSON.stringify(availability),original);
});

test('recorded names and notes equal to interface phrases never enter the authored-copy translation namespace',()=>{
  const now=new Date('2026-10-22T08:00:00Z'),source=fixture.rows[0].tasks[0].task;
  const tasks:CropTask[]=[
    {...source,id:'private-prep',action:'prep',month:10,cohortSowMonth:10,cohortMonthOffset:0,cropName:'Record kilograms and where it went.',bedLabel:'Beds 1–3',prepText:'Water and mulch'},
    {...source,id:'authored-harvest',action:'harvest',month:10,cohortSowMonth:10,cohortMonthOffset:0,cropName:'Another recorded crop',bedLabel:'Bed 1'},
    {...source,id:'authored-harvest-2',action:'harvest',month:10,cohortSowMonth:10,cohortMonthOffset:0,cropName:'Another recorded crop',bedLabel:'Bed 2'},
    {...source,id:'authored-harvest-3',action:'harvest',month:10,cohortSowMonth:10,cohortMonthOffset:0,cropName:'Another recorded crop',bedLabel:'Bed 3'},
  ];
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const native=buildFieldSheet(10,tasks,now,[],[],language);
    const prep=native.sections.find(section=>section.title===cropExportText('Prepare for the next planting',language))!;
    assert.equal(prep.rows[0].place,'Beds 1–3','a saved name equal to another section’s generated grouping label stays exact');
    assert.ok(prep.rows[0].work.includes('Record kilograms and where it went.'));
    assert.ok(prep.note!.includes('Water and mulch.'));
    const harvest=native.sections.find(section=>section.title===cropExportText('Harvest and record',language))!;
    assert.equal(harvest.rows[0].place,cropExportText('Beds {numbers}',language,{numbers:'1–3'}));
    assert.ok(harvest.rows[0].work.includes(cropExportText('Record kilograms and where it went.',language)));
  }
});

const recordBefore=JSON.parse(read('tests/fixtures/crop-export-translation/record-before.json')) as {sourceSha:string;english:string[];tables:Array<{count:number;rowHeight:number;columns:Array<{key:string;header:string;width:number}>}>};
const noSpaces=(value:string)=>value.replace(/\s+/g,'');
function assertRecordUnits(source:string,native:string){assert.equal((native.match(/\bkg\b/g)??[]).length,(source.match(/\bkg\b/g)??[]).length,'record units cannot become another scale');}

test('every original record instruction and column has native wording while blank month fields and kg units stay intact',()=>{
  assert.equal(recordBefore.sourceSha,fixture.sourceSha);assert.equal(recordBefore.english.length,33);
  for(const source of recordBefore.english)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const native=cropExportText(source,language);assert.notEqual(native,source,`${language}: missing record source ${source}`);
    assertRecordUnits(source,native);assert.deepEqual(numbers(native),numbers(source));
    assert.deepEqual(native.match(/_+/g)??[],source.match(/_+/g)??[],'retain all blank entry spaces');
  }
  assert.throws(()=>assertRecordUnits('Used kg','Zwo shumiswaho g'),/another scale/,'negative check: a kg column must not silently become grams');
});

test('actual native record pages preserve every source instruction, table row and measured unit column',async()=>{
  const metadata={...cardProps.meta,planTitle:'Ṱanḓa {count} $&'},input={...cardProps,meta:metadata,now:new Date(buildersBefore.now),sections:['record']}as CropPlanPdfInput;
  const before=JSON.stringify(input);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),allText:string[]=[];
    const rows:Array<{x:number;width:number;height:number}>=[],headers:Array<{text:string;left:number;lineWidths:number[]}>=[],recordSectionPages=new Map<string,number>();
    const write=doc.text.bind(doc),rect=doc.rect.bind(doc);
    doc.text=((...args:unknown[])=>{
      const lines=Array.isArray(args[0])?args[0].map(String):[String(args[0])],opts=args[3]as{align?:string;lineHeightFactor?:number}|undefined;
      allText.push(lines.join(' '));
      for(const source of ['Weekly observation','Decision for next month'])if(noSpaces(lines.join(' '))===noSpaces(cropExportText(source,language)))recordSectionPages.set(source,doc.getCurrentPageInfo().pageNumber);
      if(doc.getFontSize()===7.5&&doc.getTextColor().replace('#','').toLowerCase()==='ffffff'&&!opts?.align)headers.push({text:lines.join(' '),left:Number(args[1]),lineWidths:lines.map(line=>doc.getTextWidth(line))});
      const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight();
      lines.forEach((line,index)=>{
        const w=doc.getTextWidth(line),x=Number(args[1])-(opts?.align==='right'?w:0),y=Number(args[2])+index*doc.getFontSize()*(opts?.lineHeightFactor??doc.getLineHeightFactor());
        assert.ok(x>=12&&x+w<=width-12,`${language}: record text must remain inside its paper width`);
        assert.ok(y>=12&&y<=height-12,`${language}: record content must not spill off its page`);
      });
      return(write as(...args:unknown[])=>jsPDF)(...args);
    })as typeof doc.text;
    doc.rect=((...args:unknown[])=>{if(args[4]==='S')rows.push({x:Number(args[0]),width:Number(args[2]),height:Number(args[3])});return(rect as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.rect;
    drawCropPlanPages(doc,input,false,{language,font});
    assert.deepEqual(rows.map(row=>row.height),recordBefore.tables.flatMap(table=>Array(table.count).fill(table.rowHeight)),'translation cannot lose blank entries or shrink writing space');
    assert.equal(headers.length,recordBefore.tables.reduce((sum,table)=>sum+table.columns.length,0));
    let cursor=0;
    for(const table of recordBefore.tables){
      const total=table.columns.reduce((sum,column)=>sum+column.width,0);let offset=0;
      for(const column of table.columns){
        const header=headers[cursor++],width=column.width/total*rows[0].width;
        assert.equal(noSpaces(header.text),noSpaces(cropExportText(column.header,language)),'the complete native label must remain attached to its original column');
        assert.ok(Math.abs(header.left-(rows[0].x+offset+6))<0.001);
        header.lineWidths.forEach(lineWidth=>assert.ok(lineWidth<=width-12+0.01,'record headers must not overlap the next unit column'));
        offset+=width;
      }
    }
    // Bands and eyebrows intentionally use capitals; completeness must survive typography.
    // Private values and unit-column labels retain their separate exact-case assertions.
    const drawn=noSpaces(allText.join(' ')).toLowerCase();
    for(const source of recordBefore.english)assert.ok(drawn.includes(noSpaces(cropExportText(source,language)).toLowerCase()),`${language}: record source missing from actual PDF ${source}`);
    assert.ok(recordSectionPages.has('Weekly observation')&&recordSectionPages.has('Decision for next month'));
    assert.equal(recordSectionPages.get('Weekly observation'),recordSectionPages.get('Decision for next month'),'the recorded observations and resulting decision must travel together');
    assert.ok(allText.join(' ').includes(metadata.planTitle),'saved names and placeholder-looking values stay exact');
  }
  assert.equal(JSON.stringify(input),before,'record-page translation must not mutate supplied records');
});

const tableBefore=JSON.parse(read('tests/fixtures/crop-export-translation/plan-table-before.json')) as {sourceSha:string;cases:Array<{id:string;plantings:import('../lib/crop-plan.ts').Planting[];beds:import('../lib/crop-plan.ts').PlanBed[];english:ReturnType<typeof buildPlanTableRows>;englishMildFrost:ReturnType<typeof buildPlanTableRows>}>};
const planTableFacts=(rows:ReturnType<typeof buildPlanTableRows>)=>rows.map(({share,establish,intoField,harvest,frostCaveat,...facts})=>facts);
function assertPlantingFacts(native:ReturnType<typeof buildPlanTableRows>,english:ReturnType<typeof buildPlanTableRows>){
  assert.deepEqual(planTableFacts(native),planTableFacts(english),'translation cannot change areas, crop/variety identities, grouping, yields or confirmation states');
  native.forEach((row,index)=>{
    const source=english[index];
    for(const key of ['share','establish','intoField','harvest']as const)assert.deepEqual(numbers(row[key]),numbers(source[key]),`${key}: dates, shares and quantities stay exact`);
    if(source.share!=='Full')assert.equal(row.share,source.share,'fraction codes retain the same allocation');
    assert.equal(row.frostCaveat===null,source.frostCaveat===null,'translation cannot add or remove a frost caution');
  });
}

test('native planting tables retain original crop/variety identities, yields, confirmation dates and finished-once filtering',()=>{
  assert.equal(tableBefore.sourceSha,fixture.sourceSha);let cautions=0;
  for(const data of tableBefore.cases){
    const original=JSON.stringify(data);
    for(const mild of [false,true]){
      const english=mild?data.englishMildFrost:data.english;
      for(const language of ['en','xx'])assert.deepEqual(buildPlanTableRows(data.plantings,data.beds,mild,language),english,'default English remains exact against immutable original source');
      for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
        const native=buildPlanTableRows(data.plantings,data.beds,mild,language);assertPlantingFacts(native,english);
        native.forEach((row,i)=>{
          const source=english[i];assert.notEqual(row.establish,source.establish);assert.notEqual(row.intoField,source.intoField);
          if(source.awaitingSowingConfirmation){assert.equal(row.yieldKg,null);assert.equal(row.harvest,cropExportText('Confirm sowing',language));assert.equal(row.intoField,cropExportText('Not confirmed',language));}
          if(source.establish==='Confirm dated sowing')assert.equal(row.establish,cropExportText('Confirm dated sowing',language));
          if(source.frostCaveat){cautions++;assert.equal(row.frostCaveat,cropExportText(source.frostCaveat,language));assert.notEqual(row.frostCaveat,source.frostCaveat);}
          if(source.establish.startsWith('Plant ')){
            const unit=source.establish.slice(6).replace(/ \w+$/,'');
            assert.ok(row.establish.includes(cropExportText(unit,language)),'living planting material must keep its translated material noun');
            assert.ok(!row.establish.startsWith(cropExportText('Direct sow {month}',language,{month:''}).trim()),'pieces are planted, not direct-sown seed');
          }
        });
        if(native.length){const broken=structuredClone(native);broken[0].yieldKg=123;assert.throws(()=>assertPlantingFacts(broken,english),/yields or confirmation states/);}
      }
    }
    assert.equal(JSON.stringify(data),original);
  }
  assert.ok(cautions>0,'exercise actual frost-sensitive source crops');
});

test('native planting tables retain fractional allocations and readiness windows throughout the catalogue',()=>{
  const data=tableBefore.cases[0];
  for(const fraction of [0.5,1/3,0.25,0.17]){
    const plantings=data.plantings.map(row=>({...row,areaFraction:fraction})),english=buildPlanTableRows(plantings,data.beds,true);
    for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
      const native=buildPlanTableRows(plantings,data.beds,true,language);assertPlantingFacts(native,english);
      native.forEach((row,i)=>{
        const source=english[i],match=/^Check (\w+)-(\w+); transplant when ready$/.exec(source.intoField);
        if(match){
          const month=(word:string)=>Array.from({length:12},(_,i)=>i+1).find(m=>monthShort(m)===word)!;
          assert.equal(row.intoField,cropExportText('Check {first}-{last}; transplant when ready',language,{first:monthShort(month(match[1]),language),last:monthShort(month(match[2]),language)}));
        }
      });
    }
  }
});

test('native benchmark labels keep unknown and non-food yields distinct from measured kg',()=>{
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    assert.equal(benchmarkYieldLabel(null,language),cropExportText('Not verified',language));
    assert.equal(benchmarkYieldLabel(0,language),cropExportText('No food yield',language));
    assert.notEqual(benchmarkYieldLabel(null,language),benchmarkYieldLabel(0,language));
    for(const amount of [0.01,1,17.25,999.9])assert.equal(benchmarkYieldLabel(amount,language),benchmarkYieldLabel(amount),'positive benchmarks retain their exact original formatting and SI unit');
    const variety='Recorded {crop} $& cultivar 17',named=cropExportText('{crop} (first season only)',language,{crop:variety});assert.ok(named.includes(variety));
  }
});

test('the actual native planting PDF keeps first-season identities, pending markers, frost conditions and unknown benchmarks',async()=>{
  const data=tableBefore.cases[0],meta={...cardProps.meta,planTitle:'Ṱanḓa {crop} $&',rainPattern:'mild-frost' as const};
  const original=JSON.stringify({data,meta});
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[];
    const text=doc.text.bind(doc);
    doc.text=((...args:unknown[])=>{
      const lines=Array.isArray(args[0])?args[0].map(String):[String(args[0])],opts=args[3]as{align?:string;lineHeightFactor?:number}|undefined;
      painted.push(lines.join(' '));
      if(doc.getFontSize()===8&&opts?.align==='right'){
        const value=lines.join(' ');
        for(const source of ['Not verified','No food yield','Confirm sowing']){
          const label=cropExportText(source,language);
          if(noSpaces(value)===noSpaces(label))for(const word of label.split(/\s+/))assert.ok(value.includes(word),'benchmark status words must not leave a final letter on its own line');
        }
      }
      lines.forEach((line,i)=>{
        const width=doc.getTextWidth(line),x=Number(args[1])-(opts?.align==='right'?width:0),y=Number(args[2])+i*doc.getFontSize()*(opts?.lineHeightFactor??doc.getLineHeightFactor());
        assert.ok(x>=12&&x+width<=doc.internal.pageSize.getWidth()-12,`${language}: planting text must remain on paper`);
        assert.ok(y>=12&&y<=doc.internal.pageSize.getHeight()-12,`${language}: planting rows must not run off a page`);
      });
      return(text as(...args:unknown[])=>jsPDF)(...args);
    })as typeof doc.text;
    drawCropPlanPages(doc,{...cardProps,plantings:data.plantings,beds:data.beds,tasks:[],meta,sections:['plan'],now:new Date(buildersBefore.now)},false,{language,font});
    const drawn=noSpaces(painted.join(' '));
    for(const row of buildPlanTableRows(data.plantings,data.beds,true,language)){
      const crop=row.once?cropExportText('{crop} (first season only)',language,{crop:row.crop}):row.crop;
      for(const value of [row.area,crop,row.share,row.establish,row.intoField,row.harvest,...(row.frostCaveat?[row.frostCaveat]:[])])assert.ok(drawn.includes(noSpaces(value)),`${language}: source planting value missing from actual PDF ${value}`);
    }
    for(const source of ['Not verified','No food yield','Confirm sowing','Benchmark','Establish','Into field'])assert.ok(drawn.includes(noSpaces(cropExportText(source,language))),`${language}: actual PDF lost ${source}`);
    assert.ok(drawn.includes(noSpaces(cropExportText('Bed-by-bed plan',language))));
    assert.ok(drawn.includes(noSpaces('Recorded {crop} $& cultivar 17')),'private variety fields cannot be interpreted as translation templates');
  }
  assert.equal(JSON.stringify({data,meta}),original);
});

const dashboardBefore=JSON.parse(read('tests/fixtures/crop-export-translation/dashboard-before.json')) as {sourceSha:string;cases:Array<{id:string;input:Omit<CropPlanPdfInput,'now'>&{now:string};dashboard:ReturnType<typeof buildPlanDashboard>}>};
const dashboardFacts=({stats,signals,decisions,...facts}:ReturnType<typeof buildPlanDashboard>)=>facts;
function assertDashboardFacts(native:ReturnType<typeof buildPlanDashboard>,english:ReturnType<typeof buildPlanDashboard>){
  assert.deepEqual(dashboardFacts(native),dashboardFacts(english),'translation cannot change benchmark totals, confirmed losses, crop identities, stored/fresh windows or conflicts');
  assert.equal(native.stats.length,english.stats.length);assert.equal(native.signals.length,english.signals.length);assert.equal(native.decisions.length,english.decisions.length);
  native.stats.forEach((stat,i)=>{
    const source=english.stats[i];
    for(const key of ['value','label','detail']as const)assert.deepEqual(numbers(stat[key]),numbers(source[key]),`${key}: every source figure must survive`);
    if(!['Not shown','Not calculated'].includes(source.value))assert.equal(stat.value,source.value,'numeric values and SI units retain their original formatting');
    assert.notEqual(stat.label,source.label);assert.notEqual(stat.detail,source.detail);
  });
  for(const key of ['signals','decisions']as const)native[key].forEach((value,i)=>{assert.notEqual(value,english[key][i]);assert.deepEqual(numbers(value),numbers(english[key][i]));});
}

test('native overview statistics preserve original confirmed, unconfirmed, conflicting and empty-plan facts',()=>{
  assert.equal(dashboardBefore.sourceSha,fixture.sourceSha);
  for(const row of dashboardBefore.cases){
    const {input,dashboard:english}=row,original=JSON.stringify(row),now=new Date(input.now);
    const opts={nowMonth:now.getMonth()+1,lossPercent:input.meta.lossPercent,lossAllowanceConfirmed:input.meta.lossAllowanceConfirmed};
    for(const language of ['en','xx'])assert.deepEqual(buildPlanDashboard(input.plantings,input.beds,input.tasks,{...opts,language}),english);
    for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
      const native=buildPlanDashboard(input.plantings,input.beds,input.tasks,{...opts,language});assertDashboardFacts(native,english);
      if(!opts.lossAllowanceConfirmed)assert.equal(native.stats[3].value,cropExportText('Not calculated',language),'a default allowance is not confirmed usable production');
      if(english.areaConflictBedLabels.length)assert.equal(native.stats[1].value,cropExportText('Not shown',language),'an unresolved overlap cannot become a numeric zero');
      const broken=structuredClone(native);broken.grossKg=english.grossKg===null?0:123;
      assert.throws(()=>assertDashboardFacts(broken,english),/benchmark totals/);
    }
    assert.equal(JSON.stringify(row),original);
  }
});

test('saved overview labels equal to interface phrases remain verbatim inside source-bound claims',()=>{
  const input=structuredClone(dashboardBefore.cases.find(row=>row.id==='conflict')!.input);
  input.beds[0].label='Not shown {places} $& 17';const original=JSON.stringify(input);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const native=buildPlanDashboard(input.plantings,input.beds,input.tasks,{language,nowMonth:10});
    assert.ok(native.areaConflictBedLabels.includes(input.beds[0].label));
    assert.ok(native.signals.some(value=>value.includes(input.beds[0].label)));assert.ok(native.decisions.some(value=>value.includes(input.beds[0].label)));
  }
  assert.equal(JSON.stringify(input),original);
});

const noteDateBefore=JSON.parse(read('tests/fixtures/crop-export-translation/note-date-before.json')) as {originalFileSha256:string;originalDateFunction:string;rows:Array<{stamp:number;english:string}>};
test('the crop engine is unchanged outside its shared note-date formatter and native dates retain their original month/year',()=>{
  const source=read('lib/crop-plan.ts'),ast=typescript.createSourceFile('crop-plan.ts',source,typescript.ScriptTarget.Latest,true),fn=ast.statements.find(node=>typescript.isFunctionDeclaration(node)&&node.name?.text==='planNotesDateLabel');assert.ok(fn);
  const normalized=source.replace("import { recordsMonthLong, hasRecordsMonthNames } from './records-months';\n",'').replace(fn.getText(ast),noteDateBefore.originalDateFunction);
  assert.equal(digest(normalized),noteDateBefore.originalFileSha256,'no calculation, validation or saved-record code may change while translating this date label');
  for(const row of noteDateBefore.rows){
    for(const language of ['en','xx'])assert.equal(planNotesDateLabel(row.stamp,language),row.english);
    for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const date=new Date(row.stamp);assert.equal(planNotesDateLabel(row.stamp,language),`${recordsMonthLong(language,date.getMonth()+1)} ${date.getFullYear()}`);}
  }
});

function assertOrderedPrintedWords(expected:string,painted:string[]){
  const actual=painted.join(' ').split(/\s+/),words=expected.split(/\s+/);let cursor=0;
  for(const word of words){while(cursor<actual.length&&actual[cursor]!==word)cursor++;assert.ok(cursor<actual.length,`printed overview lost source word: ${word}`);cursor++;}
}

test('actual native overview pages retain every statistic, decision and canonical assurance through page breaks',async()=>{
  for(const row of dashboardBefore.cases)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const input={...row.input,now:new Date(row.input.now),meta:{...row.input.meta,language},sections:['dashboard']}as CropPlanPdfInput,before=JSON.stringify({...row.input,now:new Date(row.input.now),meta:{...row.input.meta,language},sections:['dashboard']});
    const doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[];
    const text=doc.text.bind(doc);
    doc.text=((...args:unknown[])=>{
      const lines=Array.isArray(args[0])?args[0].map(String):[String(args[0])],opts=args[3]as{align?:string;lineHeightFactor?:number}|undefined;
      painted.push(lines.join(' '));
      lines.forEach((line,i)=>{
        const width=doc.getTextWidth(line),x=Number(args[1])-(opts?.align==='right'?width:0),y=Number(args[2])+i*doc.getFontSize()*(opts?.lineHeightFactor??doc.getLineHeightFactor());
        assert.ok(x>=12&&x+width<=doc.internal.pageSize.getWidth()-12,`${language}/${row.id}: overview text must remain inside its paper width`);
        assert.ok(y>=12&&y<=doc.internal.pageSize.getHeight()-12,`${language}/${row.id}: overview text must remain inside its page`);
      });
      return(text as(...args:unknown[])=>jsPDF)(...args);
    })as typeof doc.text;
    drawCropPlanPages(doc,input,false,{language,font});
    const native=buildPlanDashboard(input.plantings,input.beds,input.tasks,{language,nowMonth:input.now!.getMonth()+1,lossPercent:input.meta.lossPercent,lossAllowanceConfirmed:input.meta.lossAllowanceConfirmed});
    const drawn=noSpaces(painted.join(' '));
    for(const stat of native.stats)for(const value of [stat.value,stat.label,stat.detail])assert.ok(drawn.includes(noSpaces(value)),`${language}/${row.id}: statistic missing from actual PDF ${value}`);
    for(const value of [...native.signals,...native.decisions])assertOrderedPrintedWords(value,painted);
    for(const paragraph of planAssuranceParagraphs(language))assertOrderedPrintedWords(paragraph,painted);
    assertOrderedPrintedWords(cropExportText(SUCCESSION_TIMING_GUIDANCE,language),painted);
    assert.ok(drawn.includes(noSpaces(planAssuranceText(ASSURANCE_TITLE,language))));
    for(const value of [input.meta.planTitle,input.meta.locationLine||input.meta.siteLine,input.meta.climateLine,input.meta.dateLabel])if(value)assert.ok(drawn.includes(noSpaces(value)),'supplied fact values remain verbatim');
    assert.equal(JSON.stringify(input),before);
    assert.throws(()=>assertOrderedPrintedWords('This missing-source-probe must be printed',painted),/lost source word/,'negative guard: a missing actual source clause cannot pass');
  }
});

test('native overview notes keep supplied text distinct from authored furniture and use the recorded suggestion date',async()=>{
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const input={...dashboardBefore.cases[0].input,now:new Date(dashboardBefore.cases[0].input.now),yearReport:['Private comparison {crop} $& 17'],planNotes:[{kind:'warning' as const,text:'Not shown {date} $& 23'}],planNotesAt:noteDateBefore.rows[8].stamp};
    const original=JSON.stringify(input),doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[];const text=doc.text.bind(doc);
    doc.text=((...args:unknown[])=>{painted.push(Array.isArray(args[0])?args[0].join(' '):String(args[0]));return(text as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.text;
    drawCropPlanPages(doc,input,false,{language,font});const drawn=noSpaces(painted.join(' '));
    for(const value of [...input.yearReport,...input.planNotes.map(note=>note.text)])assert.ok(drawn.includes(noSpaces(value)),'supplied prose must not be guessed at or reinterpreted as a translation template');
    assert.ok(drawn.includes(noSpaces(planNotesDateLabel(input.planNotesAt,language))));
    assert.ok(drawn.includes(noSpaces(cropExportText('WHAT TO WATCH',language))));
    assert.equal(JSON.stringify(input),original);
  }
});

const numbersBefore=JSON.parse(read('tests/fixtures/crop-export-translation/numbers-paint-before.json')) as {sourceSha:string;cases:Array<{id:string;input:Omit<CropPlanPdfInput,'now'>&{now:string};rectangles:Array<{width:number;height:number}>}>};
function assertBarGeometry(actual:Array<{width:number;height:number}>,expected:Array<{width:number;height:number}>){assert.deepEqual(actual,expected,'language must not change workload or valid crop-benchmark bar quantities');}

test('native year charts retain original job and valid benchmark geometry and withhold kg bars for unresolved layouts',async()=>{
  for(const row of numbersBefore.cases)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const input={...row.input,now:new Date(row.input.now),meta:{...row.input.meta,language}},before=JSON.stringify(input);
    const doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[],bars:Array<{width:number;height:number}>=[];
    const text=doc.text.bind(doc),rect=doc.roundedRect.bind(doc);
    doc.roundedRect=((...args:unknown[])=>{bars.push({width:Number(args[2]),height:Number(args[3])});return(rect as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.roundedRect;
    doc.text=((...args:unknown[])=>{
      const lines=Array.isArray(args[0])?args[0].map(String):[String(args[0])],opts=args[3]as{align?:string;lineHeightFactor?:number}|undefined;
      painted.push(lines.join(' '));
      lines.forEach((line,i)=>{const w=doc.getTextWidth(line),x=Number(args[1])-(opts?.align==='right'?w:0),y=Number(args[2])+i*doc.getFontSize()*(opts?.lineHeightFactor??doc.getLineHeightFactor());assert.ok(x>=12&&x+w<=doc.internal.pageSize.getWidth()-12,'year chart text must stay on paper');assert.ok(y>=12&&y<=doc.internal.pageSize.getHeight()-12,'year chart content must not run off a page');});
      return(text as(...args:unknown[])=>jsPDF)(...args);
    })as typeof doc.text;
    drawCropPlanPages(doc,input,false,{language,font});
    const nowMonth=input.now.getMonth()+1,coverage=buildPlanDashboard(input.plantings,input.beds,input.tasks,{language,nowMonth,lossPercent:input.meta.lossPercent,lossAllowanceConfirmed:input.meta.lossAllowanceConfirmed});
    const jobBars=buildWorkloadSeries(input.tasks,nowMonth,input.plantings,input.beds).filter(month=>month.count>0).length;
    // The immutable original conflict image exposes seven kg bars despite its withholding notice.
    // Preserve the original workload geometry and enforce the stated rule rather than blessing that defect.
    const expected=coverage.areaConflictBedLabels.length?row.rectangles.slice(0,jobBars):row.rectangles;
    assertBarGeometry(bars,expected);
    if(coverage.areaConflictBedLabels.length){assert.equal(bars.length,jobBars);assert.ok(!painted.some(value=>/\b[1-9]\d*(?:\.\d+)?\s+kg\b/.test(value)),'a blocked benchmark cannot leak numeric kg subtotals');assert.throws(()=>assertBarGeometry(row.rectangles,expected),/bar quantities/,'negative guard reproduces the original conflicting-layout kg bars');}
    const fresh=cropExportText('{months} of 12 months have at least one verified fresh-picking window; that is timing, not monthly kilograms.',language,{months:coverage.freshPickingMonths});assertOrderedPrintedWords(fresh,painted);
    if(coverage.storedFoodMonths){const source=coverage.storedFoodCrops.length===1?'{months} of 12 months also have food from store, from {count} crop with a sourced shelf life ({crops}). Each shelf life assumes particular storage conditions for that crop and does not hold without them.':'{months} of 12 months also have food from store, from {count} crops with a sourced shelf life ({crops}). Each shelf life assumes particular storage conditions for that crop and does not hold without them.';assertOrderedPrintedWords(cropExportText(source,language,{months:coverage.storedFoodMonths,count:coverage.storedFoodCrops.length,crops:coverage.storedFoodCrops.join(', ')}),painted);}
    assertOrderedPrintedWords(cropExportText('Chart note: the workload chart counts planned jobs, not hours - a plot of maize and a bed of lettuce each count as one. Crop-cycle benchmark weights are shown by crop only; no monthly kg or Rand is inferred.',language),painted);
    for(const month of Array.from({length:12},(_,i)=>(nowMonth+i-1)%12+1))assert.ok(painted.includes(monthShort(month,language)),'the job graph must label every dated month');
    assert.equal(JSON.stringify(input),before);
  }
});

const availabilityBefore=JSON.parse(read('tests/fixtures/crop-export-translation/availability-before.json')) as {cases:Array<{id:string;input:Omit<CropPlanPdfInput,'now'>&{now:string}}>};
const availabilityMarksBefore=JSON.parse(read('tests/fixtures/crop-export-translation/availability-paint-before.json')) as {cases:Array<{id:string;marks:Array<{x:number;width:number;dash:number[]}>}>};

test('translated food calendars preserve every original local/reference month mark, recorded value and full warning',async()=>{
  const calendarWarning='Outlined bands are planning references when established; they do not enter food totals or picking jobs. Blank months have no picking window marked. Recorded planting ages keep young plants out of early reference months. Check plant ages and Food sources to check in the app. Gold rows require each crop’s storage conditions; check the full plan or app. Red space figures mean the plan needs more growing space than is mapped.';
  for(const row of availabilityBefore.cases)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const input={...row.input,now:new Date(row.input.now),meta:{...row.input.meta,language}},original=JSON.stringify(input);
    const doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[],marks:Array<{x:number;width:number;dash:number[]}>=[];let dash:number[]=[];
    const text=doc.text.bind(doc),rect=doc.roundedRect.bind(doc),setDash=doc.setLineDashPattern.bind(doc);
    doc.setLineDashPattern=((pattern:number[],phase:number)=>{dash=[...pattern];return setDash(pattern,phase);})as typeof doc.setLineDashPattern;
    doc.roundedRect=((...args:unknown[])=>{if(args[4]===4&&args[5]===4&&args[6]==='FD')marks.push({x:Number(args[0]),width:Number(args[2]),dash:[...dash]});return(rect as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.roundedRect;
    doc.text=((...args:unknown[])=>{
      const lines=Array.isArray(args[0])?args[0].map(String):[String(args[0])],opts=args[3]as{align?:string;lineHeightFactor?:number}|undefined;painted.push(lines.join(' '));
      lines.forEach((line,i)=>{const width=doc.getTextWidth(line),x=Number(args[1])-(opts?.align==='right'?width:opts?.align==='center'?width/2:0),y=Number(args[2])+i*doc.getFontSize()*(opts?.lineHeightFactor??doc.getLineHeightFactor());assert.ok(x>=12&&x+width<=doc.internal.pageSize.getWidth()-12,`${language}/${row.id}: calendar text must remain inside the paper width: ${line}`);assert.ok(y>=12&&y<=doc.internal.pageSize.getHeight()-12,`${language}/${row.id}: calendar text must remain inside its page: ${line}`);});
      return(text as(...args:unknown[])=>jsPDF)(...args);
    })as typeof doc.text;
    drawCropPlanPages(doc,input,false,{language,font});
    assert.deepEqual(marks,availabilityMarksBefore.cases.find(before=>before.id===row.id)!.marks,'translation cannot add harvests or change outlined references into confirmed dates');
    assertOrderedPrintedWords(cropExportText(calendarWarning,language),painted);
    const drawn=noSpaces(painted.join(' '));
    for(const phrase of ['CROP / FOOD SOURCE','Growing space used','Food forest - fruit, nuts & berries and other foods','Animal products'])assert.ok(drawn.includes(noSpaces(cropExportText(phrase,language))),`${language}/${row.id}: authored food-calendar heading missing: ${phrase}`);
    for(const source of input.availability?.undated??[])if(source.iconKey.startsWith('housing:')?input.availability?.includeAnimals!==false:input.availability?.includeTrees!==false){assert.ok(drawn.includes(noSpaces(source.label)));if(input.availabilityDetails!==false)assertOrderedPrintedWords(source.detail,painted);if(source.ageNote)assertOrderedPrintedWords(source.ageNote,painted);}
    if(row.id==='hidden'){assert.ok(!marks.length);assertOrderedPrintedWords(cropExportText('Hidden for this print. Show animal products in the app to include them.',language),painted);assertOrderedPrintedWords(cropExportText('Hidden for this print. Show fruit, nuts and berries in the app to include them.',language),painted);}
    if(row.id==='repeat')assert.ok(drawn.includes(noSpaces(cropExportText('This repeats the annual planting cycle. It is not a forecast for this first year.',language))));
    if(row.id==='dated')assert.ok(drawn.includes(noSpaces(cropExportText('Fruit, nuts and berries: solid marks are local dates. Outlined marks: references when established, not food promised this year.',language))));
    if(marks.some(mark=>mark.dash.length)){const promoted=marks.map(mark=>({...mark,dash:[]}));assert.notDeepEqual(promoted,availabilityMarksBefore.cases.find(before=>before.id===row.id)!.marks,'negative guard must detect references promoted to real food');}
    assert.equal(JSON.stringify(input),original);
  }
});

const storageBefore=JSON.parse(read('tests/fixtures/crop-export-translation/storage-before.json')) as {input:Omit<CropPlanPdfInput,'now'>&{now:string};crops:Array<{key:string;name:string;storageConditions:string;storageMonths:number;storageSourceUrl?:string}>};
test('native stored-food pages retain every original condition, shelf-life figure, scientific identity and source URL',async()=>{
  assert.equal(storageBefore.crops.length,CROPS.filter(crop=>crop.storageMonths&&crop.storageConditions).length,'all sourced storage conditions must be represented');
  for(const crop of storageBefore.crops){const current=cropByKey(crop.key)!;assert.equal(current.storageConditions,crop.storageConditions);assert.equal(current.storageMonths,crop.storageMonths);assert.equal(current.storageSourceUrl,crop.storageSourceUrl);assert.equal(current.name,crop.name);}
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const input={...storageBefore.input,now:new Date(storageBefore.input.now),meta:{...storageBefore.input.meta,language}},original=JSON.stringify(input),doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[],urls:string[]=[];
    const text=doc.text.bind(doc),link=doc.link.bind(doc);
    doc.link=((...args:unknown[])=>{urls.push(String((args[4]as{url?:string}).url??''));return(link as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.link;
    doc.text=((...args:unknown[])=>{const lines=Array.isArray(args[0])?args[0].map(String):[String(args[0])],opts=args[3]as{align?:string;lineHeightFactor?:number}|undefined;painted.push(lines.join(' '));lines.forEach((line,i)=>{const w=doc.getTextWidth(line),x=Number(args[1])-(opts?.align==='right'?w:opts?.align==='center'?w/2:0),y=Number(args[2])+i*doc.getFontSize()*(opts?.lineHeightFactor??doc.getLineHeightFactor());assert.ok(x>=12&&x+w<=doc.internal.pageSize.getWidth()-12,'stored-food conditions must remain within paper width');assert.ok(y>=12&&y<=doc.internal.pageSize.getHeight()-12,'stored-food conditions must remain on their page');});return(text as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.text;
    drawCropPlanPages(doc,input,false,{language,font});
    for(const crop of storageBefore.crops){
      const native=cropExportText(crop.storageConditions,language);assert.notEqual(native,crop.storageConditions,`${language}/${crop.key}: missing storage-condition draft`);assert.deepEqual(numbers(native),numbers(crop.storageConditions),'storage translation cannot alter source temperatures, humidity, dates or rates');assertOrderedPrintedWords(native,painted);assertOrderedPrintedWords(cropExportText('{crop} - sourced storage window: {months} months',language,{crop:crop.name,months:crop.storageMonths}),painted);if(crop.storageSourceUrl)assert.ok(urls.includes(crop.storageSourceUrl),'printed source link must retain its exact destination');
      if(crop.storageConditions.includes('≤14%')){const qualifier={zu:'14% noma ngaphansi',st:'14% kapa ka tlase',ts:'14% kumbe ehansi',ve:'14% kana fhasi'}[language];assert.ok(native.includes(qualifier),'the maximum moisture comparison must survive in words, not disappear with an unsupported glyph');assert.ok(noSpaces(painted.join(' ')).includes(noSpaces(qualifier)),'the printed comparison must remain complete even when isiZulu attaches its number prefix');assert.ok(!native.replace(qualifier,'14%').includes(qualifier),'negative guard detects a maximum wrongly reduced to an exact moisture');}
      for(const term of ['°C','RH','Cylas spp.','5ml/kg','~85-90%'])if(crop.storageConditions.includes(term))assert.ok(native.includes(term),`${language}/${crop.key}: source unit or identity lost: ${term}`);
    }
    assert.equal(JSON.stringify(input),original);
  }
  const original=storageBefore.crops.find(crop=>crop.storageConditions.includes('5ml/kg'))!;assert.notDeepEqual(numbers(cropExportText(original.storageConditions,'zu').replace('5ml/kg','6ml/kg')),numbers(original.storageConditions),'negative guard must detect a changed source rate');
});


test('the English storage PDF prints its original maximum moisture comparison with visible ASCII',()=>{
  const input={...storageBefore.input,now:new Date(storageBefore.input.now)},doc=new jsPDF({unit:'pt',format:'a4'}),painted:string[]=[];const text=doc.text.bind(doc);
  doc.text=((...args:unknown[])=>{painted.push(Array.isArray(args[0])?args[0].join(' '):String(args[0]));return(text as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.text;
  drawCropPlanPages(doc,input);assert.ok(painted.join(' ').includes('<=14%'),'maximum moisture must not print as an exact 14%');assert.equal(cropByKey('maize')!.storageConditions,storageBefore.crops.find(crop=>crop.key==='maize')!.storageConditions,'catalogue source must remain untouched');
});

const generatedBefore=JSON.parse(read('tests/fixtures/crop-export-translation/generated-availability-before.json')) as {
  files:Array<{file:string;source:string;sha256:string}>;
  groups:import('../lib/perennial-harvest.ts').PlacedTreeGroup[];
  seasons:Array<{speciesId:string;zones:import('../lib/growing-zones.ts').GrowingZoneId[];conditions?:import('../lib/site-survey.ts').SiteProductionConditions;expected:import('../lib/production-product-guidance.ts').ExpectedSeason|null}>;
  ageCases:Array<{speciesId:string;date:number;choice:import('../lib/perennial-harvest.ts').TreeSeasonChoices[string]|null;note:string|null;ready:boolean}>;
  cases:Array<{id:string;options:Omit<Parameters<typeof printableAvailability>[0],'now'>&{now:string};expected:ReturnType<typeof printableAvailability>}>;
  animalEntries:{input:import('../lib/animal-enterprises.ts').AnimalAvailabilityItem[][];expected:ReturnType<typeof animalEntries>};projection:ReturnType<typeof buildProductionProjection>;
};

test('all original generated availability and age-reference outputs remain exact in English and unsupported languages',()=>{
  for(const language of ['en','xx']){
    for(const row of generatedBefore.cases)assert.deepEqual(printableAvailability({...row.options,now:new Date(row.options.now),language}),{forest:undefined,forestPlanning:undefined,animals:undefined,...row.expected},`${row.id}: generated English source must remain exact`);
    assert.deepEqual(animalEntries(generatedBefore.animalEntries.input,language),generatedBefore.animalEntries.expected);
    for(const row of generatedBefore.seasons)assert.deepEqual(assumedProductSeason(generatedBefore.groups.find(group=>group.harvest.speciesId===row.speciesId)!,row.zones,row.conditions,language)??null,row.expected);
    for(const row of generatedBefore.ageCases){const group=generatedBefore.groups.find(group=>group.harvest.speciesId===row.speciesId)!;assert.equal(treeAgeCalendarNote(group,row.choice??undefined,row.date,language)??null,row.note);assert.equal(ageReadyForSeason(group,row.choice??undefined,row.date),row.ready);}
  }
  const row=generatedBefore.cases[0];assert.deepEqual(buildProductionProjection({plantings:[],beds:[],trees:generatedBefore.groups,choices:row.options.treeSeasons??{},now:new Date(row.options.now)}),generatedBefore.projection,'age/yield projection data must be untouched');
});

test('native reference seasons retain all source choice gates, months, citations and full timing qualifiers',()=>{
  const warning='Planning reference when established; confirm local picking dates. No food quantity or first-year crop promised.';
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES)for(const row of generatedBefore.seasons){
    const group=generatedBefore.groups.find(group=>group.harvest.speciesId===row.speciesId)!,original=JSON.stringify(group),native=assumedProductSeason(group,row.zones,row.conditions,language);
    if(!row.expected){assert.equal(native,undefined,'locale cannot introduce a regional season where source conditions reject it');continue;}
    assert.ok(native);assert.deepEqual(native.months,row.expected.months);assert.deepEqual(native.source,row.expected.source,'citation identity and URL must remain original');assert.notEqual(native.label,row.expected.label);assert.notEqual(native.basis,row.expected.basis);
    const region=group.harvest.windows.map(window=>window.region).filter(region=>row.expected!.basis.startsWith(region+'. ')).sort((a,b)=>b.length-a.length)[0];assert.ok(region,'reference basis must keep a source-region authority');
    // The original window identity still owns selection; only its full display qualifier is native.
    const tail=row.expected.basis.slice(region.length+2);assert.ok(tail.endsWith(warning));const note=tail.slice(0,-warning.length).trim();
    if(note)assert.notEqual(cropExportText(note,language),note,`${language}: source-specific regional qualifier missing: ${note}`);
    assert.equal(native.basis,cropExportText('{region}. {note}Planning reference when established; confirm local picking dates. No food quantity or first-year crop promised.',language,{region:cropExportText(region,language),note:note?cropExportText(note,language)+' ':''}));
    assert.deepEqual(numbers(native.basis),numbers(row.expected.basis));
    for(const cultivar of ['Hass','Mauritius','Earligold','Granny Smith','African Delight','Tommy Atkins','Heritage','Autumn Bliss','Satsuma','Wonderful'])for(const field of ['label','basis']as const)if(row.expected[field].includes(cultivar))assert.ok(native[field].includes(cultivar),'named cultivar identities must not change');
    assert.equal(native.calendarLabel,row.expected.label.startsWith('Regional reference:')?cropExportText('Regional season',language):native.label,'short native reference label must be explicit, not parsed from translated English prefixes');assert.equal(JSON.stringify(group),original);
  }
});

test('native tree-age and mapped food details keep every count, private identity and source-food hold',()=>{
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    for(const row of generatedBefore.ageCases){const group=generatedBefore.groups.find(group=>group.harvest.speciesId===row.speciesId)!,native=treeAgeCalendarNote(group,row.choice??undefined,row.date,language);assert.equal(native===undefined,row.note===null);if(row.note){assert.notEqual(native,row.note);assert.deepEqual(numbers(native!),numbers(row.note));}assert.equal(ageReadyForSeason(group,row.choice??undefined,row.date),row.ready);}
    for(const row of generatedBefore.cases){
      const options={...row.options,now:new Date(row.options.now),language},original=JSON.stringify(options),native=printableAvailability(options);
      for(const key of ['yearMode','veg','utilization','includeTrees','includeAnimals','forest','forestPlanning','animals']as const)assert.deepEqual(native[key],row.expected[key],`${key}: locale must not alter calendar source data`);
      assert.deepEqual(native.undated?.map(entry=>entry.iconKey),row.expected.undated?.map(entry=>entry.iconKey));
      for(const [i,entry]of(native.undated??[]).entries()){const english=row.expected.undated![i];assert.notEqual(entry.detail,english.detail);assert.deepEqual(numbers(entry.detail),numbers(english.detail),'native details must not change mapped counts or first-crop years');if(!entry.iconKey.startsWith('animal:')&&!entry.iconKey.startsWith('housing:'))assert.equal(entry.label,english.label,'mapped plant/crop identities remain original');}
      assert.equal(JSON.stringify(options),original);
    }
    const nativeAnimals=animalEntries(generatedBefore.animalEntries.input,language);assert.deepEqual(nativeAnimals.map(slot=>slot.map(entry=>entry.iconKey)),generatedBefore.animalEntries.expected.map(slot=>slot.map(entry=>entry.iconKey)));
    for(const [i,entry]of nativeAnimals[0].entries()){const source=generatedBefore.animalEntries.expected[0][i];assert.notEqual(entry.label,source.label);assert.equal(entry.label.split(' - ')[0],source.label.split(' - ')[0],'enterprise identity cannot change with the product label');}
    const legalSpecies=SPECIES.find(species=>species.uses.includes('food')&&species.nemba!=='none');assert.ok(legalSpecies);
    const originalFlag='Existing catalogue restriction flag: NEMBA {flag}. Legal status needs checking; kept as mapped inventory without planting advice or production dates.';
    const known={defId:'tree_other',speciesId:legalSpecies.id,label:'Eggs {count} $& 17',existing:1,proposed:2,legalCheck:cropExportText(originalFlag,'en',{flag:legalSpecies.nemba})},privateNote={...known,speciesId:undefined,label:'Fish {flag} $&',legalCheck:'Original private legal observation {flag} $& 23'};
    const options={treeGroups:[],unidentifiedPlants:[known,privateNote],includeAnimals:false,language},before=JSON.stringify(options),native=printableAvailability({yearMode:'fromToday',veg:[],utilization:[],...options});
    assert.equal(native.undated![0].label,known.label);assert.ok(native.undated![0].detail.includes(cropExportText(originalFlag,language,{flag:legalSpecies.nemba})),'an existing catalogue restriction must retain its full hold and flag');assert.equal(native.undated![1].label,privateNote.label);assert.ok(native.undated![1].detail.includes(privateNote.legalCheck),'unknown provided notes must stay verbatim');assert.equal(JSON.stringify(options),before);
  }
});

function functionSource(source:string,name:string):string{const file=typescript.createSourceFile('source.tsx',source,typescript.ScriptTarget.Latest,true,typescript.ScriptKind.TSX),node=file.statements.find(statement=>typescript.isFunctionDeclaration(statement)&&statement.name?.text===name);assert.ok(node,`source function missing: ${name}`);return node.getText(file);}

test('generated wording does not change projection arithmetic, graph calculations or unrelated crop-page behavior',()=>{
  const original=(file:string)=>generatedBefore.files.find(row=>row.file===file)!.source;
  const projection=read('lib/production-projection.ts'),restored=projection.replace("import { cropExportText } from './crop-export-copy';\n",'').replace(functionSource(projection,'treeAgeCalendarNote'),functionSource(original('lib/production-projection.ts'),'treeAgeCalendarNote'));assert.equal(restored,original('lib/production-projection.ts'),'the whole projection engine outside its age-note formatter must stay byte-exact');
  const availability=read('lib/crop-export-availability.ts'),marker='/** Graphs keep the print';assert.equal(availability.slice(availability.indexOf(marker)),original('lib/crop-export-availability.ts').slice(original('lib/crop-export-availability.ts').indexOf(marker)),'all numeric graph/production quantity logic remains original');
  const page=read('app/facilitator/crops/page.tsx'),restoredPage=page.replace('animalChoices }, lang), [siteSurvey, plantings, growingZones, currentMonth, bananaCircles, canvasTrees, canvasAnimals, animalChoices, includeTrees, includeAnimals, lang]);','animalChoices }), [siteSurvey, plantings, growingZones, currentMonth, bananaCircles, canvasTrees, canvasAnimals, animalChoices, includeTrees, includeAnimals]);').replace('planningTreeSeasons(canvasTrees, growingZones, siteSurvey?.productionConditions, treeSeasons, lang), [canvasTrees, growingZones, siteSurvey, treeSeasons, lang]','planningTreeSeasons(canvasTrees, growingZones, siteSurvey?.productionConditions, treeSeasons), [canvasTrees, growingZones, siteSurvey, treeSeasons]').replace('const printAvailability = useMemo(() => printableAvailability({\n    language: lang,\n    now:','const printAvailability = useMemo(() => printableAvailability({\n    now:').replace('includeTrees, includeAnimals, unidentifiedPlants, planningTrees, lang]);','includeTrees, includeAnimals, unidentifiedPlants, planningTrees]);');assert.equal(restoredPage,original('app/facilitator/crops/page.tsx'),'only the declared locale-aware availability/season/guidance producer calls and memo dependencies may change here');assert.notEqual(page,restoredPage,'the actual planner must wire the selected language');
  const guide=read('lib/production-product-guidance.ts');let restoredGuide=guide.replace("import { cropExportText, isCropExportDraftLanguage } from './crop-export-copy';\n",'').replace('HOUSING_LABEL, PRODUCT_LABEL,','HOUSING_LABEL,');for(const name of ['assumedProductSeason','planningTreeSeasons','buildProductGuidance','productGuideText'])restoredGuide=restoredGuide.replace(functionSource(guide,name),functionSource(original('lib/production-product-guidance.ts'),name));restoredGuide=restoredGuide.replace('  /** Short native display label; source season gates never depend on translated wording. */\n  calendarLabel?: string;\n','');assert.equal(restoredGuide,original('lib/production-product-guidance.ts'),'source profiles, researched names, rates and existing draft authorities stay original');
});

const generatedPaintBefore=JSON.parse(read('tests/fixtures/crop-export-translation/generated-reference-paint-before.json')) as {cases:Array<{id:string;input:Omit<CropPlanPdfInput,'now'>&{now:string};options:Omit<Parameters<typeof printableAvailability>[0],'now'>&{now:string};zones:import('../lib/growing-zones.ts').GrowingZoneId[];marks:Array<{x:number;width:number;dash:number[]}>}>};

test('actual native generated calendars retain outlined reference marks, complete details, age holds and source citations',async()=>{
  for(const row of generatedPaintBefore.cases)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    const options={...row.options,now:new Date(row.options.now),language,planning:{...row.options.planning!,trees:planningTreeSeasons(row.options.treeGroups!,row.zones,undefined,row.options.treeSeasons,language)}},input={...row.input,now:new Date(row.input.now),meta:{...row.input.meta,language},availability:printableAvailability(options)},before=JSON.stringify(input),doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[],paintPages=new Map<number,string[]>(),urls:string[]=[],marks:Array<{x:number;width:number;dash:number[]}>=[];let dash:number[]=[];
    const text=doc.text.bind(doc),rounded=doc.roundedRect.bind(doc),setDash=doc.setLineDashPattern.bind(doc),link=doc.link.bind(doc);
    doc.setLineDashPattern=((pattern:number[],phase:number)=>{dash=[...pattern];return setDash(pattern,phase);})as typeof doc.setLineDashPattern;
    doc.roundedRect=((...args:unknown[])=>{if(args[4]===4&&args[5]===4&&args[6]==='FD')marks.push({x:Number(args[0]),width:Number(args[2]),dash:[...dash]});return(rounded as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.roundedRect;
    doc.link=((...args:unknown[])=>{urls.push(String((args[4]as{url?:string}).url??''));return(link as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.link;
    doc.text=((...args:unknown[])=>{const lines=Array.isArray(args[0])?args[0].map(String):[String(args[0])],opts=args[3]as{align?:string;lineHeightFactor?:number}|undefined;painted.push(lines.join(' '));paintPages.set(doc.getNumberOfPages(),[...(paintPages.get(doc.getNumberOfPages())??[]),lines.join(' ')]);lines.forEach((line,i)=>{const width=doc.getTextWidth(line),x=Number(args[1])-(opts?.align==='right'?width:opts?.align==='center'?width/2:0),y=Number(args[2])+i*doc.getFontSize()*(opts?.lineHeightFactor??doc.getLineHeightFactor());assert.ok(x>=12&&x+width<=doc.internal.pageSize.getWidth()-12,'generated native details must remain within paper width');assert.ok(y>=12&&y<=doc.internal.pageSize.getHeight()-12,'generated native details must remain on their page');});return(text as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.text;
    drawCropPlanPages(doc,input,false,{language,font});assert.deepEqual(marks,row.marks,'source language cannot add confirmed/reference harvest marks or change their exact dated span');
    for(const entry of input.availability.undated??[]){assertOrderedPrintedWords(entry.detail,painted);assert.ok(noSpaces(painted.join(' ')).includes(noSpaces(entry.label)),'source identity and localized housing/product label must print completely');}
    const references=[...new Map(input.availability.forestPlanning?.flat().map(entry=>[entry.iconKey,entry])??[]).values()];
    for(const entry of references){assertOrderedPrintedWords(entry.planning!.basis,painted);assertOrderedPrintedWords(entry.planning!.label,painted);if(entry.planning?.source)assert.ok(urls.includes(entry.planning.source.url),'source citation links must keep their real destination');assert.ok(noSpaces(painted.join(' ')).includes(noSpaces(entry.planning!.calendarLabel!)),'native short reference label must be printed without relying on an English prefix');}
    if(row.id==='generated-reference'){assert.ok(references.length>0);assert.ok(marks.every(mark=>mark.dash.length),'these unconfirmed regional windows must stay outlined');assert.notDeepEqual(marks.map(mark=>({...mark,dash:[]})),row.marks,'negative guard detects a regional reference falsely promoted to a solid confirmed harvest');}else assert.equal(marks.length,0,'immature plants cannot acquire dated reference marks');
    if(row.id==='generated-availability'){
      const last=input.availability.undated!.at(-1)!,guidance=cropExportText(SUCCESSION_TIMING_GUIDANCE,language);
      assert.ok([...paintPages.values()].some(lines=>noSpaces(lines.join(' ')).includes(noSpaces(last.label))&&noSpaces(lines.join(' ')).includes(noSpaces(guidance))),'the final source card must retain its complete timing caution on the same page');
    }
    assert.equal(JSON.stringify(input),before);
  }
});


test('the observed native orphan pages fail the source-card context rule',()=>{
  const before=JSON.parse(read('tests/fixtures/crop-export-translation/native-availability-tail-before.json'))as{cases:Array<{language:string;lastLabel:string;guidance:string;pages:string[]}>};
  for(const row of before.cases)assert.ok(!row.pages.some(page=>noSpaces(page).includes(noSpaces(row.lastLabel))&&noSpaces(page).includes(noSpaces(row.guidance))),'negative guard must reject the actual old timing-only final page');
});
