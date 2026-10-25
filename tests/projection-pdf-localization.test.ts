import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {jsPDF} from 'jspdf';
import ts from 'typescript';
import {registerReportPdfFont} from '../lib/report-pdf-font.ts';
import {CROP_EXPORT_COPY} from '../lib/crop-export-copy-data.ts';
import {CROP_EXPORT_DRAFT_LANGUAGES,cropExportText,cropProjectionAgeText,cropProjectionDetailText,cropProjectionPeriodText} from '../lib/crop-export-copy.ts';
import {buildProductionProjection,treeAgeProjection,type ProductionProjection} from '../lib/production-projection.ts';
import {productGuideText} from '../lib/production-product-guidance.ts';
import {drawCropPlanPages,type CropPlanPdfInput} from '../lib/crop-export-pdf.ts';
import type {PlacedTreeGroup,TreeSeasonChoices} from '../lib/perennial-harvest.ts';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const before=JSON.parse(read('tests/fixtures/projection-translation/before.json'))as{sources:Array<{file:string;source:string;sha256:string}>;rows:Array<{id:string;input:Omit<CropPlanPdfInput,'now'|'productionProjection'>&{now:string};projection:ProductionProjection}>;allTrees:Array<{group:PlacedTreeGroup;choice:TreeSeasonChoices[string];ageProjection:ReturnType<typeof treeAgeProjection>}>};
const paintBefore=JSON.parse(read('tests/fixtures/projection-translation/paint-before.json'))as{rows:Array<{id:string;bars:Array<{width:number|string;height:number}>}>};
const plain=(value:unknown)=>JSON.parse(JSON.stringify(value));
const flat=(value:string)=>value.normalize('NFC').replace(/\s/g,'');
const figures=(value:string)=>(value.match(/\d+(?:\.\d+)?/g)??[]).sort();

test('projection translation preserves complete numeric models, all catalogue identities and source authorities',()=>{
  for(const file of ['lib/production-projection.ts','lib/perennial-harvest.ts'])assert.equal(createHash('sha256').update(read(file)).digest('hex'),before.sources.find(row=>row.file===file)!.sha256,'presentation must not mutate ages, crop figures, species or source notes');
  // The descendant guidance batch translates two presentation functions. Requiring
  // their old bytes would reject that work; every researched source outside them
  // must still match the immutable projection capture, including species and URLs.
  const source=before.sources.find(row=>row.file==='lib/production-product-guidance.ts')!.source,current=read('lib/production-product-guidance.ts');
  const restorePresentation=(value:string)=>{let restored=value.replace('HOUSING_LABEL, PRODUCT_LABEL,','HOUSING_LABEL,');for(const name of['productGuideText','buildProductGuidance']){const extract=(text:string)=>{const file=ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true),node=file.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);assert.ok(node);return node.getText(file);};restored=restored.replace(extract(value),extract(source));}return restored.replace('region: cropExportText(window.region, language), note:','region: window.region, note:');};
  const requireSource=(value:string)=>assert.equal(restorePresentation(value),source,'only the declared display functions, display-label import and source-region display argument may differ; all profiles, notes, species, numbers and citations remain exact');requireSource(current);
  assert.ok(current.includes("'carya-illinoinensis': {"));assert.throws(()=>requireSource(current.replace("'carya-illinoinensis': {","'unverified-species': {")),'altering a species outside presentation must fail');
  const citation=source.match(/https:\/\/[^'\s]+/)?.[0];assert.ok(citation);assert.ok(current.includes(citation));assert.throws(()=>requireSource(current.replace(citation,'https://unverified.invalid/source')),'altering a source citation must fail');
  for(const row of before.rows){const input=row.input;assert.deepEqual(plain(buildProductionProjection({plantings:input.plantings,beds:input.beds,trees:input.treeGroups??[],choices:input.treeSeasons??{},now:new Date(input.now)})),row.projection);}
  assert.equal(before.allTrees.length,103);
  for(const row of before.allTrees)assert.deepEqual(plain(treeAgeProjection(row.group,row.choice,2026*12+9,2027*12+8,2026*12+9)),row.ageProjection);
  assert.equal(before.rows.find(row=>row.id==='unknown-age')!.projection.years[0].trees[0].kg,null,'unknown age must remain unknown rather than acquiring a zero harvest');
  assert.deepEqual(before.rows.find(row=>row.id==='changing')!.projection.years[0].treeKg,[0.4,2]);
  assert.equal(before.rows.find(row=>row.id==='invalid-count')!.projection.years[0].trees[0].kg,null,'too many age-group plants cannot acquire a known yield');
});

test('new projection sources retain every placeholder, source figure and inherited translation',()=>{
  const packet=JSON.parse(read('docs/translation/four-language-completion/projection-drafts.json'))as{newSources:number;rows:Array<Record<string,string>>};assert.equal(packet.rows.length,packet.newSources);
  for(const source of packet.rows)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){assert.ok(source[language]);assert.notEqual(source[language],source.english);assert.deepEqual((source[language].match(/\{\w+\}/g)??[]).sort(),(source.english.match(/\{\w+\}/g)??[]).sort());assert.deepEqual(figures(source[language]),figures(source.english));assert.equal(CROP_EXPORT_COPY.find(row=>row.english===source.english)?.[language],source[language]);}
  const inherited=before.sources.find(row=>row.file==='lib/crop-export-copy-data.ts')!.source;const sourceRows=JSON.parse('['+inherited.split('export const CROP_EXPORT_COPY = [')[1].split('] as const;')[0]+']');assert.deepEqual(CROP_EXPORT_COPY.slice(0,sourceRows.length),sourceRows,'adding projection rows cannot change the parent calendar/graph drafts');
});

test('generated ages, missing messages and assumptions translate completely without reparsing unknown original text',()=>{
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
    for(const row of before.rows){for(const source of row.projection.assumptions){const native=cropProjectionDetailText(source,language);assert.notEqual(native,source);assert.ok(!native.startsWith(cropExportText('Original message: {message}',language,{message:''})),'a current full assumption cannot be left as unknown English');}
      for(const year of row.projection.years)for(const tree of year.trees){assert.deepEqual(figures(cropProjectionAgeText(tree.ages,language)),figures(tree.ages));for(const source of tree.missing){const native=cropProjectionDetailText(source,language);assert.notEqual(native,source);assert.deepEqual(figures(native),figures(source));}}
    }
    for(const unknown of ['Fish','Original {age} $& message 17','1 plants need age groups!'])assert.equal(cropProjectionDetailText(unknown,language),cropExportText('Original message: {message}',language,{message:unknown}));
    assert.equal(cropProjectionAgeText('Original age {age} $& 17',language),cropExportText('Original message: {message}',language,{message:'Original age {age} $& 17'}));
    assert.equal(cropProjectionAgeText('?',language),'?');
    for(const row of before.allTrees)for(const key of ['yearsToFirstCrop','yearsToFullBearing']as const){const source=row.group.harvest[key]?.note;if(source)assert.notEqual(productGuideText(source,language),source,'canonical complete source notes must reuse their native authority');}
  }
  for(const row of before.rows)for(const language of ['en','xx'])for(const year of row.projection.years)for(const tree of year.trees){assert.equal(cropProjectionAgeText(tree.ages,language),tree.ages);for(const source of tree.missing)assert.equal(cropProjectionDetailText(source,language),source);}
});

test('actual native projection PDFs keep complete assumptions, entered schedules, source links and original bar quantities inside print pages',async()=>{
 for(const row of before.rows)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
  const input={...row.input,now:new Date(row.input.now),meta:{...row.input.meta,language},productionProjection:structuredClone(row.projection)},original=JSON.stringify(input),doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[],bars:Array<{width:number;height:number}>=[],links:string[]=[];
  const text=doc.text.bind(doc),rect=doc.rect.bind(doc),line=doc.line.bind(doc),link=doc.textWithLink.bind(doc);
  doc.rect=((...args:unknown[])=>{for(const value of args.slice(0,4))assert.ok(typeof value==='number'&&Number.isFinite(value),'a quantity cannot write Infinity/NaN into a PDF drawing command');if(args[3]===9&&args[4]==='F')bars.push({width:Number(args[2]),height:9});return(rect as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.rect;
  doc.line=((...args:unknown[])=>{for(const value of args.slice(0,4))assert.ok(typeof value==='number'&&Number.isFinite(value),'age stripes must retain finite coordinates');return(line as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.line;
  doc.textWithLink=((...args:unknown[])=>{links.push((args[3]as{url:string}).url);return(link as(...args:unknown[])=>number)(...args);})as typeof doc.textWithLink;
  doc.text=((...args:unknown[])=>{const lines=(Array.isArray(args[0])?args[0].map(String):[String(args[0])]).flatMap(line=>line.split('\n')),opts=args[3]as{align?:string;lineHeightFactor?:number}|undefined;painted.push(lines.join(' '));for(const[i,line]of lines.entries()){const width=doc.getTextWidth(line),x=Number(args[1])-(opts?.align==='right'?width:opts?.align==='center'?width/2:0),y=Number(args[2])+i*doc.getFontSize()*(opts?.lineHeightFactor??doc.getLineHeightFactor());assert.ok(Number.isFinite(x)&&Number.isFinite(y),`${language}/${row.id}: finite text coordinates`);assert.ok(x>=12&&x+width<=doc.internal.pageSize.getWidth()-12,`${language}/${row.id}: text outside page: ${line}`);assert.ok(y>=12&&y<=doc.internal.pageSize.getHeight()-12,`${language}/${row.id}: text off page: ${line}`);}return(text as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.text;
  drawCropPlanPages(doc,input,false,{language,font});const drawn=flat(painted.join(' ')),baseline=paintBefore.rows.find(source=>source.id===row.id)!;
  if(row.id!=='overflow')assert.deepEqual(bars,baseline.bars,'translation cannot change the annual crop/tree quantities or striped range widths');else{assert.ok(baseline.bars.some(bar=>bar.width==='Infinity'),'the before fixture must retain the actual invalid drawing');assert.ok(bars.length>0&&bars.every(bar=>bar.width<=doc.internal.pageSize.getHeight()),'finite large source values need bounded bars');assert.ok(drawn.includes('1.7976931348623157e+308kg'),'the exact entered finite yield cannot become a dash');}
  for(const source of row.projection.assumptions)assert.ok(drawn.includes(flat(cropProjectionDetailText(source,language))),'the complete original assumption and all qualifiers must print');
  for(const source of ['As your plants grow','What this forecast assumes'])assert.ok(drawn.includes(flat(cropExportText(source,language))));
  for(const year of row.projection.years)assert.ok(drawn.includes(flat(cropProjectionPeriodText(year.label,language))),'all annual periods must remain present');
  for(const group of input.treeGroups??[]){assert.ok(drawn.includes(flat(group.harvest.name)),'catalogue species identity must remain original');const choice=input.treeSeasons?.[group.harvest.speciesId];for(const cohort of choice?.production??[]){if(cohort.planted)assert.ok(drawn.includes(flat(cohort.planted)));for(const point of cohort.yields)assert.ok(drawn.includes(flat(cropExportText('age {age}: {kg} kg/plant/year',language,{age:point.age,kg:point.kg}))),`${language}/${row.id}: age ${point.age}, kg ${point.kg}: every complete schedule point must survive print pagination`);}if(choice?.production?.length)for(const key of ['yearsToFirstCrop','yearsToFullBearing']as const){const source=group.harvest[key];if(source){assert.ok(links.includes(source.source.url),'native link labels must retain the exact source URL');assert.ok(drawn.includes(flat(source.source.doc)),'the whole publication identity must remain together without a repeated header inserted inside it');if(source.note)assert.ok(drawn.includes(flat(productGuideText(source.note,language))),'the original complete source note must retain its native authority');}}}
  const expectedPoints=new Map<string,number>();
  for(const group of row.input.treeGroups??[])for(const cohort of row.input.treeSeasons?.[group.harvest.speciesId]?.production??[])for(const point of cohort.yields){const source=flat(cropExportText('age {age}: {kg} kg/plant/year',language,{age:point.age,kg:point.kg}));expectedPoints.set(source,(expectedPoints.get(source)??0)+1);}
  for(const[source,count]of expectedPoints)assert.equal(drawn.split(source).length-1,count,'identical schedule points belonging to separate cohorts must each survive; finding one cannot prove all were printed');
  assert.equal(JSON.stringify(input),original,'drawing may not mutate the saved model or entered farm values');
 }
});

test('unknown source notes and supplied assumptions stay original with honest native labels in the actual projection PDF',async()=>{
  const source=before.rows.find(row=>row.id==='changing')!,note='Fish {age} $& 17',unknown='Private original assumption {plants} $& 23';
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const input={...structuredClone(source.input),now:new Date(source.input.now),meta:{...source.input.meta,language},productionProjection:structuredClone(source.projection)},group=input.treeGroups![0];assert.ok(group.harvest.yearsToFirstCrop);group.harvest.yearsToFirstCrop!.note=note;input.productionProjection.assumptions.push(unknown);const original=JSON.stringify(input),doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[],text=doc.text.bind(doc);doc.text=((...args:unknown[])=>{painted.push((Array.isArray(args[0])?args[0]:[args[0]]).join(' '));return(text as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.text;drawCropPlanPages(doc,input,false,{language,font});const drawn=flat(painted.join(' '));assert.ok(drawn.includes(flat(cropExportText('Original source note: {note}',language,{note}))),'a private phrase matching an ordinary food word cannot be automatically translated');assert.ok(drawn.includes(flat(cropExportText('Original message: {message}',language,{message:unknown}))));assert.equal(JSON.stringify(input),original);}
});

test('the observed source fragment detects a publication title interrupted by page furniture',()=>{
 const source=JSON.parse(read('tests/fixtures/projection-translation/native-citation-layout-before.json'))as{publication:string;extractedFragment:string;pages:number[]};
 assert.deepEqual(source.pages,[14,15]);assert.ok(!flat(source.extractedFragment).includes(flat(source.publication)),'the retained source occurrence must fail the complete-citation check');
});
