import {originalSourceReferenceFont} from './helpers/source-reference-font-expectation.ts';
import { controlT } from './control-icon-renderers.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PROGRAMME_REPORT_COPY, PROGRAMME_PDF_ZU, PROGRAMME_METRIC_ZU } from '../lib/programme-report-copy-data.ts';
import { programmeReportText, programmePdfLabel, programmeMetricText, programmeReportFileName } from '../lib/programme-report-copy.ts';
import { REPORT_VISUAL_COPY, reportVisualText } from '../lib/report-visuals.ts';
import { TRAINING_FEEDBACK_TEMPLATE, freshEvidenceData } from '../lib/programme-evidence.ts';
import { pdfContentStreams } from './pdf-content-streams.ts';
import { buildProgrammePdf } from '../lib/programme-report-pdf.ts';
const read=(path:string)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const packet=JSON.parse(read('docs/translation/four-language-completion/garden-programme-drafts.json'));
const languages=['zu','st','ts','ve'] as const;
const tokens=(text:string)=>(text.match(/\{\w+\}|\d+(?:[.,]\d+)?/g)??[]).sort();
function audit(rows:readonly {english:string;zu:string;st:string;ts:string;ve:string}[]){
 const map=new Map(rows.map(r=>[r.english,r]));assert.equal(map.size,rows.length);
 for(const source of packet.programmeSource.rows){if(source.reuse)continue;const row=map.get(source.english);assert.ok(row,source.english);for(const lang of languages){assert.ok(row[lang]?.trim(),source.english+lang);assert.notEqual(row[lang],source.english);assert.deepEqual(tokens(row[lang]),tokens(source.english));}
 // Canonical shared-label snapshots follow their existing locale authority. The original
 // context-specific isiZulu is still required below through the caller override.
 if(packet.programmeSource.sourceAliases[source.english]){const key=packet.programmeSource.sourceAliases[source.english];for(const lang of languages)assert.equal(row[lang],controlT(lang)(key));}else if(source.zuluVariants.length)assert.equal(row.zu,source.zuluVariants[0]);for(const zu of source.zuluVariants)assert.equal(programmeReportText(source.english,'zu',{},zu),zu);}
}
test('programme drafts bind the actual source phrases, numbers and earlier isiZulu instead of copying English fallback',()=>{
 audit(PROGRAMME_REPORT_COPY);assert.deepEqual(PROGRAMME_PDF_ZU,packet.programmeSource.pdfZulu);assert.deepEqual(PROGRAMME_METRIC_ZU,packet.programmeSource.composerZulu);assert.deepEqual(TRAINING_FEEDBACK_TEMPLATE,packet.programmeSource.feedbackTemplate);
 for(const row of PROGRAMME_REPORT_COPY)for(const lang of languages){assert.equal(programmeReportText(row.english,lang),row[lang]);assert.equal(reportVisualText(row.english,lang),row[lang]);}
 for(const source of packet.programmeSource.rows.filter((s:any)=>s.reuse))for(const lang of languages)assert.equal(programmeReportText(source.english,lang),source.reuse[lang]);
 for(const file of ['lib/sample-gardens.ts','lib/sample-orchard.ts','lib/mel-templates.ts','lib/programme-evidence.ts','lib/report-pdf-font.ts'])assert.equal(createHash('sha256').update(file==='lib/report-pdf-font.ts'?originalSourceReferenceFont(read(file)):read(file)).digest('hex'),packet.sourceFileSha256[file],file);
});
test('the report inventory guard actually rejects a missing error, missing review disclosure and wrong quantity',()=>{
 for(const source of ['The PDF could not be created. Your records have not changed.','These translated headings and controls are unreviewed. Evidence and participant answers remain in the language recorded.'])assert.throws(()=>audit(PROGRAMME_REPORT_COPY.filter(r=>r.english!==source)));
 const bad=PROGRAMME_REPORT_COPY.map(r=>r.english==='{count}% present'?{...r,ve:r.ve.replace('{count}','1')}:r);assert.throws(()=>audit(bad));
});
test('report placeholders insert names and braces once, unknown language/diagnostics stay verbatim and percentages keep their source',()=>{
 const raw='QA $& {count} Ṱanḓa';for(const lang of ['en',...languages,'fr']){assert.ok(programmeReportText('{count} responses from {total} attendees.',lang,{count:raw,total:7}).includes(raw));for(const source of ['__proto__','constructor','toString','Private {count} $& record']){assert.equal(programmeReportText(source,lang),source);assert.equal(programmePdfLabel(source,lang),source);assert.equal(programmeMetricText(source,lang),source);}assert.equal(programmeMetricText('7% present',lang),programmeReportText('{count}% present',lang,{count:7},'{count}% bakhona'));}
 assert.equal(programmeReportText('Full report','en'),'Full report');assert.equal(programmeReportText('Full report','fr'),'Full report');
 for(const [source,zu]of Object.entries(PROGRAMME_PDF_ZU))assert.equal(programmePdfLabel(source,'zu'),zu);
 for(const [source,zu]of Object.entries(PROGRAMME_METRIC_ZU))assert.equal(programmeMetricText(source,'zu'),zu);
});
for(const language of languages)test(`${language}: an actual programme export embeds the Unicode font and preserves source records and summary limits`,async()=>{
 const session=structuredClone(freshEvidenceData().sessions[0]);session.title='QA Ṱanḓa ṋḓḽ $& {n}';const sections=[{title:'Source record',lines:Array.from({length:8},(_,i)=>'QA Ṱanḓa ṋḓḽ record '+(i+1))}],before=JSON.stringify({session,sections});
 for(const format of ['full','summary']as const){const doc=await buildProgrammePdf(session.title,true,sections,format,undefined,[],undefined,undefined,{session,language});assert.equal(doc.getFont().fontName,'ImbewuSans');assert.ok(doc.getFontList().ImbewuSans.includes('normal'));assert.ok(doc.getFontList().ImbewuSans.includes('bold'));assert.ok(doc.getNumberOfPages()>=1);const encode=(value:string)=>[...value].map(c=>(doc.getFont().metadata as unknown as {characterToGlyph:(code:number)=>number}).characterToGlyph(c.codePointAt(0)!).toString(16).padStart(4,'0')).join('');const content=pdfContentStreams(doc.output('arraybuffer')).toLowerCase();assert.ok(content.includes(encode('QA Ṱanḓa ṋḓḽ record 5')));assert.equal(content.includes(encode('QA Ṱanḓa ṋḓḽ record 6')),format==='full');assert.equal(JSON.stringify({session,sections}),before);}
});

import { actualProgrammeReportUi } from './programme-report-ui-renderer.ts';
import { accountNodeText } from './account-ui-renderer.ts';
const local=(source:string,lang:string)=>programmeReportText(source,lang,{},lang==='zu'?packet.programmeSource.rows.find((r:any)=>r.english===source)?.zuluVariants[0]:undefined);
for(const lang of languages)test(`${lang}: actual report controls keep source sections and export payloads while format/photo/language choices remain stateful`,async()=>{
 const h=await actualProgrammeReportUi(lang);try{
  assert.ok(h.text().includes(local('Full report',lang)));assert.ok(h.text().includes(local('Download report PDF',lang)));assert.ok(h.text().includes(local('These translated headings and controls are unreviewed. Evidence and participant answers remain in the language recorded.',lang)));assert.ok(h.text().includes(h.session.title));assert.ok(h.text().includes(h.sections[0].lines[0]));assert.ok(h.renderer.root.findAllByProps({lang:''}).some(n=>accountNodeText(n).includes(h.sections[0].lines[0])));
  await h.click(local('Brief summary',lang));await h.photos(false);await h.click(local('Download report PDF',lang));assert.equal(h.calls.pdf.length,1);const args=h.calls.pdf[0];assert.equal(args[0],h.props.title);assert.deepEqual(args[2],h.sections);assert.equal(args[3],'summary');assert.deepEqual(args[5],[]);assert.equal(args[8].language,lang);assert.equal(args[8].session,h.session);assert.equal(h.calls.files[0][2],h.props.title);
  await h.language('ve');assert.equal(h.renderer.root.findAllByType('button').find(n=>accountNodeText(n)===local('Brief summary','ve'))?.props['aria-pressed'],true);assert.equal(h.renderer.root.findByProps({type:'checkbox'}).props.checked,false);assert.ok(h.text().includes(h.sections[0].lines[0]));
 }finally{await h.dispose();}
});
for(const lang of languages)test(`${lang}: ink/full-colour and failure recovery use the actual shared report branches without changing private answers`,async()=>{
 const h=await actualProgrammeReportUi(lang,{visual:true,failure:true});try{await h.click(local('Print · save ink',lang));assert.equal(h.renderer.root.findByProps({type:'checkbox'}).props.checked,false);await h.click(local('Download ink-saving PDF',lang));assert.equal(h.calls.pdf[0][8].ink,true);assert.equal(h.calls.pdf[0][8].language,lang);assert.equal(h.calls.files.length,0);assert.ok(accountNodeText(h.renderer.root.findByProps({role:'alert'})).includes(local('The PDF could not be created. Your records have not changed.',lang)));await h.language('st');assert.ok(h.text().includes(local('The PDF could not be created. Your records have not changed.','st')));assert.ok(h.text().includes(h.sections[0].lines[0]));assert.equal(h.renderer.root.findByProps({'data-overview-language':'st'}).props['data-overview-language'],'st');await h.click(local('Print · full colour','st'));assert.equal(h.renderer.root.findByProps({type:'checkbox'}).props.checked,true);await h.click(local('Download full-colour PDF','st'));assert.equal(h.calls.pdf[1][8].ink,false);assert.equal(h.calls.pdf[1][5][0].caption,'QA owned Ṱanḓa {count} $& photo');}finally{await h.dispose();}
});
test('a pending export keeps its original language snapshot when the app language changes',async()=>{
 const h=await actualProgrammeReportUi('ts',{defer:true});try{await h.click(local('Download report PDF','ts'));assert.ok(h.text().includes(local('Preparing PDF…','ts')));const pending=h.renderer.root.findAllByType('button').find(n=>accountNodeText(n)===local('Preparing PDF…','ts'));assert.equal(pending?.props.disabled,true);await h.language('ve');assert.equal(h.calls.pdf[0][8].language,'ts');assert.ok(h.text().includes(local('Preparing PDF…','ve')));await h.finish();assert.equal(h.calls.files.length,1);assert.ok(h.text().includes(local('Download report PDF','ve')));}finally{await h.dispose();}
});


test('native PDF filenames preserve the document identity while slash, punctuation and literal placeholders remain safe data',()=>{
 const title='Ṱanḓa / Crèche {name} $& report';
 for(const language of languages)assert.equal(programmeReportFileName(title,language),'ImbewuField-Ṱanḓa-Crèche-name-report.pdf');
 assert.equal(programmeReportFileName(title,'en'),`ImbewuField-${title.replace(/[^a-zA-Z0-9]+/g,'-')}.pdf`);
 assert.ok(!programmeReportFileName('../../private: record','ve').includes('/'));
});

import { publishedTraining } from '../lib/programme-evidence.ts';
for(const language of languages)test(`${language}: the funder projection still withholds named attendance, coordinates and participant answers`,async()=>{
 const original=freshEvidenceData().sessions[0],projection=publishedTraining(original),h=await actualProgrammeReportUi(language,{funder:true,session:projection});
 try{assert.equal(h.renderer.root.findAllByType('table').length,0);for(const participant of original.attendance)assert.ok(!h.text().includes(participant.name));for(const response of original.feedback??[])for(const value of Object.values(response.answers))if(typeof value==='string'&&value.length>5)assert.ok(!h.text().includes(value));assert.ok(h.text().includes(programmeReportText('Detailed findings are withheld for this small group.',language)));}
 finally{await h.dispose();}
 const doc=await buildProgrammePdf(projection.title,true,[],'full',undefined,[],undefined,undefined,{session:projection,language,funder:true});const font=doc.getFont().metadata as unknown as {characterToGlyph:(c:number)=>number},encoded=(s:string)=>[...s].map(c=>font.characterToGlyph(c.codePointAt(0)!).toString(16).padStart(4,'0')).join(''),content=pdfContentStreams(doc.output('arraybuffer')).toLowerCase();for(const participant of original.attendance)assert.ok(!content.includes(encoded(participant.name)));assert.ok(!content.includes(encoded(original.latitude!.toFixed(5))));
});
