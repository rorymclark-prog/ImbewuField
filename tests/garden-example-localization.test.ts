import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { SAMPLE_GARDEN_COPY } from '../lib/sample-garden-copy-data.ts';
import { REPORT_VISUAL_COPY, reportVisualText } from '../lib/report-visuals.ts';
import { SAMPLE_GARDENS, SAMPLE_PARTICIPANTS } from '../lib/sample-gardens.ts';
import { SAMPLE_ORCHARD } from '../lib/sample-orchard.ts';
import { sampleGardenReportSections } from '../lib/sample-garden-reports.ts';
import { sampleGardenSvg, sampleGardenImage } from '../lib/sample-garden-layout.ts';
import { numberLabel } from '../lib/format-figures.ts';
import { programmeReportText } from '../lib/programme-report-copy.ts';
import { EXAMPLE_REPORT_REVIEW_SOURCE } from '../lib/programme-report-copy.ts';
import { buildProgrammePdf } from '../lib/programme-report-pdf.ts';
import { pdfContentStreams } from './pdf-content-streams.ts';
import { accountNodeText } from './account-ui-renderer.ts';
import { actualProgrammeReportUi } from './programme-report-ui-renderer.ts';
const read=(path:string)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const packet=JSON.parse(read('docs/translation/four-language-completion/garden-example-drafts.json'));
const languages=['zu','st','ts','ve'] as const;
type Row={english:string;zu:string;st:string;ts:string;ve:string};
const tokens=(s:string)=>(s.match(/\{\w+\}|\d+(?:[.,]\d+)?/g)??[]).sort();
function audit(rows:readonly Row[]){
 const bySource=new Map(rows.map(r=>[r.english,r]));assert.equal(bySource.size,rows.length);
 for(const source of packet.copy.rows){const row=bySource.get(source.english);assert.ok(row,source.english);for(const language of languages){assert.ok(row[language].trim(),source.english);assert.notEqual(row[language],row.english);assert.deepEqual(tokens(row[language]),tokens(row.english));}}
}
test('every prepared garden phrase has a native draft and the guard rejects missing evidence cautions and changed quantities',()=>{
 audit(REPORT_VISUAL_COPY);
 for(const row of SAMPLE_GARDEN_COPY)for(const lang of languages)assert.equal(reportVisualText(row.english,lang),row[lang]);
 for(const source of ['The photograph is AI-generated and the layout is schematic, not to scale. Adult portraits elsewhere in the tour may repeat.','Vegetable beds: {vegetableArea} m². Staple plots: {stapleArea} m². Total planted area: {plantedArea} m².'])assert.throws(()=>audit(REPORT_VISUAL_COPY.filter(r=>r.english!==source)));
 assert.throws(()=>audit(REPORT_VISUAL_COPY.map(r=>r.english==='Site boundary area: {siteArea} m².'?{...r,ve:r.ve.replace('{siteArea}','100')}:r)));
 for(const row of packet.copy.reused)for(const language of languages)assert.equal(reportVisualText(row.english,language),row[language]);
});
test('the original eighteen English reports and diagrams stay byte-for-byte stable and source records stay untouched',()=>{
 const before=JSON.stringify({SAMPLE_GARDENS,SAMPLE_PARTICIPANTS,SAMPLE_ORCHARD});
 for(const garden of SAMPLE_GARDENS){assert.deepEqual(sampleGardenReportSections(garden),packet.englishReports[garden.id]);assert.equal(sampleGardenSvg(garden.kind!,garden.id),packet.englishSvg[garden.id].svg);for(const language of languages){sampleGardenReportSections(garden,language);sampleGardenSvg(garden.kind!,garden.id,language);}}
 assert.equal(JSON.stringify({SAMPLE_GARDENS,SAMPLE_PARTICIPANTS,SAMPLE_ORCHARD}),before);
 for(const [file,sha]of Object.entries(packet.sourceFileSha256))assert.equal(createHash('sha256').update(read(file)).digest('hex'),sha);
});
const geometry=(svg:string)=>svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g,'');
for(const language of languages)test(`${language}: every garden retains its plot geometry, people, quantities and orchard species while its narrative changes`,()=>{
 for(const garden of SAMPLE_GARDENS){
  const source=sampleGardenReportSections(garden),native=sampleGardenReportSections(garden,language),all=native.flatMap(s=>[s.title,...s.lines]).join('\n');
  assert.equal(native.length,source.length);native.forEach((s,i)=>{assert.notEqual(s.title,source[i].title);assert.equal(s.lines.length,source[i].lines.length);s.lines.forEach((line,j)=>assert.notEqual(line,source[i].lines[j],garden.id+': '+source[i].lines[j]));});
  for(const value of [garden.id,garden.name,garden.town,garden.facilitator,garden.language,numberLabel(garden.produceKg,1),numberLabel(garden.areaM2??0,1)])assert.ok(all.includes(String(value)),String(value));
  for(const row of SAMPLE_ORCHARD)assert.ok(all.includes(programmeReportText('{crop}: {picked} kg picked; {sold} kg sold; {retained} kg retained; R{received} received.',language,{crop:row.crop,picked:row.pickedKg,sold:row.soldKg,retained:row.pickedKg-row.soldKg,received:row.soldKg*row.price})));
  const svg=sampleGardenSvg(garden.kind!,garden.id,language);assert.equal(geometry(svg),geometry(packet.englishSvg[garden.id].svg));assert.notEqual(svg,packet.englishSvg[garden.id].svg);assert.ok(svg.includes(reportVisualText('Water',language)));assert.equal(decodeURIComponent(sampleGardenImage(garden.kind!,garden.id,language).split(',')[1]),svg);
 }
});
test('a source-owned name containing braces and replacement metacharacters is inserted exactly once without changing identity',()=>{
 const garden={...SAMPLE_GARDENS[0],name:'QA $& {town} Ṱanḓa',town:'QA {name} town',facilitator:'QA $& {date}'};
 for(const language of ['en',...languages]){const all=sampleGardenReportSections(garden,language).flatMap(s=>s.lines).join('\n');for(const value of [garden.name,garden.town,garden.facilitator])assert.ok(all.includes(value));}
 assert.deepEqual(sampleGardenReportSections(garden,'fr'),sampleGardenReportSections(garden));
});
for(const language of languages)test(`${language}: prepared-example exports include native narrative and exact English backing without mutating the caller`,async()=>{
 const sourceSections=sampleGardenReportSections(SAMPLE_GARDENS[0]),sections=sampleGardenReportSections(SAMPLE_GARDENS[0],language),before=JSON.stringify({sections,sourceSections});
 const doc=await buildProgrammePdf(SAMPLE_GARDENS[0].name,true,sections,'full',undefined,[],undefined,undefined,{language,sourceSections});
 const font=doc.getFont().metadata as unknown as {characterToGlyph:(c:number)=>number},encode=(s:string)=>[...s].map(c=>font.characterToGlyph(c.codePointAt(0)!).toString(16).padStart(4,'0')).join(''),stream=pdfContentStreams(doc.output('arraybuffer')).toLowerCase();
 for(const text of [sections[0].title,sourceSections[0].title,'English source'])assert.ok(stream.includes(encode(text==='English source'?programmeReportText(text,language):text)));
 assert.ok(doc.getNumberOfPages()>2);assert.equal(JSON.stringify({sections,sourceSections}),before);
 const ui=await actualProgrammeReportUi(language,{example:true,visual:true});
 try{assert.ok(ui.text().includes(programmeReportText(EXAMPLE_REPORT_REVIEW_SOURCE,language)));assert.ok(ui.text().includes(sourceSections[0].lines[0]));assert.ok(ui.renderer.root.findAllByProps({lang:language}).some(n=>n.type==='div'&&accountNodeText(n).includes(sections[0].title)));await ui.click(programmeReportText('Download full-colour PDF',language));assert.deepEqual(ui.calls.pdf[0][8].sourceSections,sourceSections);assert.deepEqual(ui.calls.pdf[0][2],sections);}finally{await ui.dispose();}
});
