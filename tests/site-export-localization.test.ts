import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import typescript from 'typescript';
import { jsPDF } from 'jspdf';
import { SITE_PDF_COPY } from '../lib/site-pdf-copy-data.ts';
import { sitePdfText, sitePdfAssurance, SITE_PDF_REVIEW_SOURCE } from '../lib/site-pdf-copy.ts';
import { REPORT_DOCUMENT_COPY, reportDocumentText } from '../lib/report-localisation.ts';
import { REPORT_UI_KEYS } from '../lib/i18n-pending.ts';
import { REPORT_VISUAL_COPY } from '../lib/report-visuals.ts';
import { registerReportPdfFont } from '../lib/report-pdf-font.ts';
import { reportPdfFilename, buildReportPdf } from '../lib/report-pdf.ts';
import { drawCropPlanPages } from '../lib/crop-export-pdf.ts';
import { reportCropMonths, reportSowingCalendar, reportCropWorkingInput } from '../lib/report-crop-plan.ts';
import type { ReportCropSnapshot } from '../lib/report-crop-plan.ts';
import { ASSURANCE_ONE_LINE, PLAN_ASSURANCE_COPY } from '../lib/plan-assurance.ts';
import { recordsMonthShort } from '../lib/records-months.ts';
import { controlT } from './control-icon-renderers.ts';
import { pdfContentStreams } from './pdf-content-streams.ts';

const read=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const languages=['zu','st','ts','ve'] as const;
const fixture=JSON.parse(read('tests/fixtures/site-export-translation/source.json'));
const packet=JSON.parse(read('docs/translation/four-language-completion/site-export-drafts.json'));
const rows=new Map(SITE_PDF_COPY.map(row=>[row.english,row]));
const tokens=(text:string)=>(text.match(/\{\w+\}|\d+(?:[.,]\d+)?/g)??[]).sort();
const snapshot:ReportCropSnapshot={siteId:'synthetic-export-test',capturedAt:'2026-12-05T08:00:00Z',planUpdatedAt:1,beds:[{id:'a',label:'Ṱanḓa {count} $&',areaM2:6,kind:'bed'}],plantings:[{id:'p',bedId:'a',cropKey:'cabbage',sowMonth:12,variety:'Original ṋḓḽ'}],outlines:[{bedId:'a',points:[[0,0],[3,0],[3,2],[0,2]]}],planNotes:[{kind:'warning',text:'Original ṱḓḽ record, 6 m².'}]};

test('export drafts retain the exact source, every placeholder and complete cautions',()=>{
  assert.match(packet.status,/IN PROGRESS|Unreviewed/);
  assert.equal(rows.size,SITE_PDF_COPY.length);
  assert.equal(new Set(REPORT_DOCUMENT_COPY.map(row=>row.english)).size,REPORT_DOCUMENT_COPY.length,'one source must have one document authority');
  assert.deepEqual(packet.source.records,fixture.records);
  for(const source of fixture.records){
    for(const language of languages){
      const wording=source.authority==='PLAN_ASSURANCE_COPY'?sitePdfAssurance(language):reportDocumentText(source.english,language);
      assert.ok(wording.trim());assert.notEqual(wording,source.english,`${language}: missing ${source.english}`);
      assert.deepEqual(tokens(wording),tokens(source.english));
      assert.equal(wording,packet.source.rows.find((row:{english:string})=>row.english===source.english)[language]);
    }
  }
  assert.equal(sitePdfAssurance('en'),ASSURANCE_ONE_LINE);
  assert.equal(fixture.records[24].authority,'PLAN_ASSURANCE_COPY');
  assert.deepEqual(fixture.records[24].reuse,PLAN_ASSURANCE_COPY.find(row=>row.english===ASSURANCE_ONE_LINE));
  for(const language of languages)assert.notEqual(sitePdfAssurance(language),ASSURANCE_ONE_LINE);
  assert.match(fixture.records[3].english,/in trays for transplant crops/);
  assert.match(fixture.records[9].english,/seed buying.*planned starts, not confirmation/);
  for(const index of [3,5,9,24])assert.ok(packet.source.zuluRepairs[index].reason);
});

test('shared labels follow their existing authority and saved values are inserted only once',()=>{
  for(const row of SITE_PDF_COPY){
    if(!('sourceAuthority' in row))continue;
    for(const language of languages){
      if(row.sourceAuthority==='REPORT_UI_KEYS'){
        assert.equal(REPORT_UI_KEYS[row.english],row.sourceKey);
        assert.equal(row[language],controlT(language)(row.sourceKey));
      }else{
        assert.equal(row.sourceAuthority,'REPORT_VISUAL_COPY');
        assert.equal(row[language],REPORT_VISUAL_COPY.find(source=>source.english===row.english)?.[language]);
      }
    }
  }
  for(const language of [...languages,'en','xx']){
    assert.ok(sitePdfText('Photo {number} — {label}',language,{number:3,label:'Ṱanḓa {number} $&'}).includes('Ṱanḓa {number} $&'));
    assert.equal(sitePdfText('A private ṱḓḽ note {count}',language),'A private ṱḓḽ note {count}');
  }
  assert.equal(sitePdfText('Saved plan','zu',{},'Existing contextual wording'),'Existing contextual wording');
});

function assertKnownSources(name:string,source:string){
  const tree=typescript.createSourceFile(name,source,typescript.ScriptTarget.Latest,true,typescript.ScriptKind.TS);
  const visit=(node:typescript.Node)=>{
    if(typescript.isCallExpression(node)&&typescript.isIdentifier(node.expression)&&['t','tr','sitePdfText'].includes(node.expression.text)){
      const source=node.arguments[0];
      if(source&&typescript.isStringLiteral(source))assert.ok(fixture.records.some((row:{english:string})=>row.english===source.text),`Unregistered export source: ${source.text}`);
    }
    typescript.forEachChild(node,visit);
  };visit(tree);
}

test('a new English-only export label fails its independent source inventory',()=>{
  for(const file of ['lib/report-pdf.ts','lib/report-crop-pdf.ts','lib/report-crop-plan.ts','lib/site-pdf-copy.ts'])assertKnownSources(file,read(file));
  assert.throws(()=>assertKnownSources('missing.ts',"sitePdfText('New export warning',language)"),/Unregistered export source/);
  const source=read('components/ReportView.tsx');
  for(const phrase of ['Current site evidence; it may postdate saved report text.','Captured site satellite view','Saved design'])assert.ok(source.includes(`sitePdfText('${phrase}', contentLanguage)`));
  assert.ok(source.includes('reportPdfFilename(siteName, new Date(reportDate), contentLanguage), contentLanguage'));
});

test('native calendar labels retain the saved year, planting cells, quantities and geometry',()=>{
  const before=JSON.stringify(snapshot),english=reportSowingCalendar(snapshot),input=reportCropWorkingInput(snapshot,'Original title');
  for(const language of languages){
    const native=reportSowingCalendar(snapshot,language),working=reportCropWorkingInput(snapshot,'Original title',language);
    assert.deepEqual(native.rows,english.rows);assert.deepEqual(native.unscheduled,english.unscheduled);
    assert.deepEqual(reportCropMonths(snapshot,language),Array.from({length:12},(_,i)=>`${recordsMonthShort(language,(11+i)%12+1)} ${i===0?2026:2027}`));
    assert.match(working.meta.dateLabel,/2026/);
    assert.deepEqual([working.plantings,working.beds,working.tasks,working.planNotes],[input.plantings,input.beds,input.tasks,input.planNotes]);
  }
  assert.equal(JSON.stringify(snapshot),before);
  assert.match(reportPdfFilename('Ṱanḓa',new Date('2026-10-22'),'ve'),/Ṱanḓa/);
  assert.equal(reportPdfFilename('Original Site',new Date('2026-10-22')),'ImbewuField-Site-Report-Original-Site-2026-10-22.pdf');
});

test('native PDF builders retain recorded Tshivenda glyphs and reject an appendix without its font',async()=>{
  const doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc);
  doc.setFont(font,'normal');
  const metadata=doc.getFont().metadata as unknown as {characterToGlyph(code:number):number};
  const encode=(word:string)=>[...word].map(char=>metadata.characterToGlyph(char.codePointAt(0)!).toString(16).padStart(4,'0')).join('');
  assert.ok(encode('Ṱanḓa').length>0);
  const input=reportCropWorkingInput(snapshot,'Ṱanḓa','ve');
  assert.throws(()=>drawCropPlanPages(new jsPDF(),input),/Register the native report font/);
  const before=JSON.stringify(snapshot);
  for(const language of languages){
    const blob=await buildReportPdf('# Ṱanḓa\n\n## Original ṱḓḽ heading\n\nOriginal Ṱanḓa saved prose 6 m².',{language,biome:'Original site',lat:-28,lon:30,rainfallMm:800,meanTempC:21,dateLabel:'05 Dec 2026',cropPlan:{snapshot,crops:[],bedsPlanted:1,plantingCount:1},includeCropWorkingPlan:true});
    const streams=pdfContentStreams(await blob.arrayBuffer()).toLowerCase();
    assert.ok(streams.includes(encode('Ṱanḓa')),`${language}: the actual emitted PDF lost recorded native letters`);
    assert.ok(streams.includes(encode('ṱḓḽ')),`${language}: original recorded prose was discarded`);
    const notice=sitePdfText(SITE_PDF_REVIEW_SOURCE,language).split(' ')[0];
    assert.ok(streams.includes(encode(notice)),`${language}: draft status missing from the actual PDF`);
    const contents=reportDocumentText('Contents',language).split(' ')[0];
    assert.notEqual(contents,'Contents');
    assert.ok(streams.includes(encode(contents)),`${language}: an old saved report lost its native contents page`);
  }
  assert.equal(JSON.stringify(snapshot),before);
});
