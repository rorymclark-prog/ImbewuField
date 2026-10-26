import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { climateFigure, waterBudgetFigure, sectorFigure, soilFigure, timelineFigure, siteReportFigures, figureNumber, type ReportFigure } from '../lib/report-figures.ts';
import { REPORT_VISUAL_COPY, reportVisualText } from '../lib/report-visuals.ts';
import { recordsMonthShort } from '../lib/records-months.ts';
import { deriveSectorModel, sectorSiteFromLocation } from '../lib/sector.ts';
import { WATER_SHEET_ROOF_RUNOFF_COEFFICIENT, roofHarvestLitres } from '../lib/roof-runoff.ts';
import { computeTankSizing } from '../lib/tank-sizing.ts';
import { buildPhasePlan } from '../lib/phasing.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';
import type { MapRefLayers } from '../lib/base-layers.ts';
import type { ReportSiteFacts } from '../lib/report-site-facts.ts';
import type { LocationData } from '../lib/types.ts';
import type { PhasePlan } from '../lib/phasing.ts';

const read=(path:string)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fixture=JSON.parse(read('tests/fixtures/report-figures-translation/source-cases.json')) as {canvas:DesignCanvasState;refs:MapRefLayers;facts:ReportSiteFacts;location:LocationData;phasePlan:PhasePlan;figures:Record<'en'|'zu',ReportFigure[]>};
const previous=JSON.parse(read('tests/fixtures/report-climate-translation/source-pairs.json')) as {functions:Record<string,{pairs:Array<{english:string;zu:string}>}>};
const languages=['zu','st','ts','ve'] as const;
const sources=new Map(REPORT_VISUAL_COPY.map(row=>[row.english,row]));
const words=(svg:string)=>[...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map(row=>row[1].replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>')).join(' ').replace(/\s+/g,' ');
const norm=(text:string)=>text.replace(/\s+/g,' ').trim();
const attributes=(tag:string)=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const shapes=(svg:string,tag:string)=>[...svg.matchAll(new RegExp('<'+tag+'\\b[^>]*>','g'))].map(row=>attributes(row[0]));
function audit(text:string){
 const tree=ts.createSourceFile('figures.ts',text,ts.ScriptTarget.Latest,true);const pairs:Array<{english:string;zu:string}>=[];
 function visit(n:ts.Node){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&['t','reportVisualText'].includes(n.expression.text)&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])){
  assert.ok(sources.has(n.arguments[0].text),`missing native figure source: ${n.arguments[0].text}`);
  if(n.expression.text==='t'&&n.arguments[1]&&ts.isStringLiteral(n.arguments[1]))pairs.push({english:n.arguments[0].text,zu:n.arguments[1].text});
 }ts.forEachChild(n,visit);}visit(tree);return pairs;
}

test('all diagram source clauses have drafts and every earlier paired isiZulu clause remains exact',()=>{
 const current=audit(read('lib/report-figures.ts'));
 for(const {pairs}of Object.values(previous.functions))for(const pair of pairs){assert.ok(current.some(p=>p.english===pair.english&&p.zu===pair.zu),pair.english);assert.equal(reportVisualText(pair.english,'zu',{},pair.zu),pair.zu);}
 assert.throws(()=>audit("t('Unregistered new soil caution','okusha')"),/missing native figure source/);
 for(const language of languages){const shadow=reportVisualText('a 1 m post throws a {length} m shadow',language,{length:'2.5'});assert.ok(shadow.includes('1 m'));assert.ok(shadow.includes('2.5 m'));assert.ok(!shadow.includes('{length}'));}
});

test('all eight English drawings stay exact while every target builds all five new native drawings without mutating inputs',()=>{
 const before=JSON.stringify(fixture);const inputs={canvas:fixture.canvas,mapLayers:fixture.refs,phasePlan:fixture.phasePlan};
 assert.deepEqual(siteReportFigures(fixture.facts,fixture.location,'en',inputs),fixture.figures.en);
 for(const language of languages){const native=siteReportFigures(fixture.facts,fixture.location,language,inputs);assert.deepEqual(native.map(f=>f.id),fixture.figures.en.map(f=>f.id));for(const id of ['climate','water-budget','sectors','soil','timeline']){const figure=native.find(f=>f.id===id)!,english=fixture.figures.en.find(f=>f.id===id)!;for(const key of ['title','note','source','alt']as const)assert.notEqual(figure[key],english[key],`${language}: ${id} ${key}`);assert.equal(figure.width,640);}}
 assert.equal(JSON.stringify(fixture),before,'presentation never mutates geometry, source readings, phase order or ranges');
});

test('native rainfall and water axes keep January-to-December identity and the original wet/dry seasonal marks',()=>{
 const {location,facts}=fixture;const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 for(const language of languages)for(const build of [()=>climateFigure(location,language)!,()=>waterBudgetFigure(facts,location,language)!]){
  const figure=build();const labels=shapes(figure.svg,'text');const axis=names.map((_,i)=>{const name=recordsMonthShort(language,i+1);const tag=[...figure.svg.matchAll(/<text\b[^>]*>[\s\S]*?<\/text>/g)].find(m=>words(m[0])===name);assert.ok(tag,`${language} ${figure.id} ${name}`);return Number(attributes(tag[0]).x);});
  for(let i=1;i<axis.length;i++)assert.ok(axis[i]>axis[i-1]);assert.ok(labels.length>12);
 }
 for(const language of languages){
  const figure=climateFigure(location,language)!;const english=climateFigure(location)!;
  const seasonMarks=(svg:string)=>shapes(svg,'rect').filter(r=>r.height==='7').map(({x,width,fill,stroke})=>({x,width,fill,stroke}));assert.deepEqual(seasonMarks(figure.svg),seasonMarks(english.svg));
  const wet=location.rainfall.monthly.indexOf(Math.max(...location.rainfall.monthly));const dry=location.rainfall.monthly.indexOf(Math.min(...location.rainfall.monthly));
  assert.ok(words(figure.svg).includes(`${reportVisualText('Wettest month',language)}: ${recordsMonthShort(language,wet+1)} (${figureNumber(location.rainfall.monthly[wet])} mm)`));
  assert.ok(figure.alt.includes(`${recordsMonthShort(language,dry+1)} ${figureNumber(location.rainfall.monthly[dry])} mm`));
  const source=climateFigure({...location,rainfall:{...location.rainfall,rainfallSource:'open-meteo'}},language)!;assert.equal(source.source,reportVisualText('ERA5-Land via Open-Meteo (9 km grid)',language));
 }
});

// A translation may move an entire chart down the paper; its 12 bars must remain the same shapes.
function blueBarShape(svg:string){return shapes(svg,'path').filter(p=>p.fill==='#24738a').map(p=>{
 const coords=p.d.match(/[MLHVQ]|-?\d+(?:\.\d+)?/g)!;const numbers=coords.filter(n=>!/[MLHVQ]/.test(n)).map(Number);
 // All bars use the existing M x base V top Q x top x top H x Q x top x top V base Z convention.
 const baseline=numbers[1];return numbers.map((n,i)=>[1,2,4,6,9,11,12].includes(i)?Math.round((n-baseline)*10)/10:n);
});}

test('translated captions do not change roof catch, storage sizing, chart proportions or installation uncertainty',()=>{
 const {location,facts}=fixture;const english=waterBudgetFigure(facts,location)!;
 const annual=figureNumber(Math.round(roofHarvestLitres(facts.roof!.areaM2,location.rainfall.annual,WATER_SHEET_ROOF_RUNOFF_COEFFICIENT)));
 const sizing=computeTankSizing({monthlyRainfallMm:location.rainfall.monthly,roofAreaM2:facts.roof!.areaM2,dailyUseL:facts.measurements!.dailyWaterUseL!});
 for(const language of languages){
  const figure=waterBudgetFigure(facts,location,language)!;
  assert.ok(words(figure.svg).includes(`${reportVisualText('This roof can catch',language)} ${annual} L`));assert.deepEqual(blueBarShape(figure.svg),blueBarShape(english.svg));
  if(sizing.ok&&sizing.recommendedStorageL>0)assert.ok(figure.alt.includes(figureNumber(sizing.recommendedStorageL)+' L'));
  assert.ok(words(figure.svg).includes(norm(reportVisualText('planned, not installed yet',language))));
  const unknown=waterBudgetFigure({...facts,water:{...facts.water!,tanksOfUnknownCapacity:1}},location,language)!;assert.ok(words(unknown.svg).includes(norm(reportVisualText('tank of unknown size, not counted',language))));
  const missing=waterBudgetFigure({...facts,measurements:undefined},location,language)!;assert.ok(words(missing.svg).includes(norm(reportVisualText('Daily water use has not been recorded for this site, so this figure cannot show which months run short. Add it in the Design Studio, Water step.',language))));
  assert.equal(waterBudgetFigure({...facts,roof:undefined},location,language),null);
 }
});

test('laboratory results remain distinct from model estimates and unmeasured soil never acquires fallback readings',()=>{
 const {location}=fixture;
 for(const language of languages){
  const model=soilFigure(location,language)!;const lab=soilFigure({...location,soil:{...location.soil,soilSource:'lab'}},language)!;const missing=soilFigure({...location,soil:{...location.soil,soilSource:'estimate'}},language)!;
  assert.ok(words(model.svg).includes(norm(reportVisualText('Hollow dot and dashed outlines: estimated for this location by the SoilGrids world soil model, not measured here. A soil test on your own sample will replace them.',language))));
  assert.ok(words(lab.svg).includes(norm(reportVisualText('Filled dot: measured by a laboratory on a sample from this site.',language))));
  assert.equal((words(missing.svg).match(new RegExp(reportVisualText('not measured',language),'g'))??[]).length,3);assert.doesNotMatch(missing.alt,/pH \d|\d+(?:\.\d+)? %/);
  const positions=(svg:string)=>shapes(svg,'circle').filter(c=>c.r==='8').slice(0,2).map(c=>c.cx);
  assert.deepEqual(positions(model.svg),positions(soilFigure(location)!.svg));assert.deepEqual(positions(lab.svg),positions(model.svg));
  for(const name of ['Sand','Silt','Clay'])assert.ok(words(model.svg).includes(reportVisualText(name,language)),'a narrow translated texture segment must keep its name in the legend');
  assert.ok(words(model.svg).includes(reportVisualText('Loam',language)));assert.ok(words(lab.svg).includes('Loam'),'uploaded laboratory wording is preserved as recorded');
 }
});

test('regional wind words and native compass key retain actual source bearings and all model qualifications',()=>{
 const {location,facts}=fixture,model=deriveSectorModel(sectorSiteFromLocation(location),location.lat,location.lon);assert.ok(model.namedWind.length);
 for(const language of languages){
  const figure=sectorFigure(location,facts,language)!;
  for(const wind of model.namedWind){const en=wind.title.charAt(0)+wind.title.slice(1).toLowerCase();assert.ok(words(figure.svg).includes(norm(reportVisualText(en,language))));assert.ok(figure.alt.includes(wind.fromLabel));}
  assert.ok(words(figure.svg).includes(norm(reportVisualText('Compass: N = north; E = east; S = south; W = west.',language))));
  assert.ok(figure.note.includes(reportVisualText('North is up; the house mark is this site. Sun paths are calculated from the latitude. Hatched marks are regional patterns, not measurements: check them against what you and your neighbours see.',language)));
  const observed=sectorFigure(location,{...facts,measurements:{...facts.measurements,localWindFrom:'ENE',localWindStrongestFrom:'SSW'}},language)!;assert.ok(observed.alt.includes('ENE'));assert.ok(observed.alt.includes('SSW'));
  const outline=(svg:string)=>shapes(svg,'path').filter(p=>p.d.startsWith('M')&&p['stroke-dasharray']==='5 3').map(({fill,stroke,'stroke-width':width})=>({fill,stroke,width}));assert.deepEqual(outline(figure.svg),outline(sectorFigure(location,facts)!.svg));
 }
});

test('translated work stages retain source ranges, dependency order, bar widths and open-ended commissioning',()=>{
 const {phasePlan}=fixture;const english=timelineFigure(phasePlan)!;
 const bars=(svg:string)=>shapes(svg,'rect').filter(r=>r.fill==='#e6efe6').map(({x,width,height,'stroke-dasharray':dash})=>({x,width,height,dash}));
 for(const language of languages){const native=timelineFigure(phasePlan,language)!;assert.deepEqual(bars(native.svg),bars(english.svg));
  for(const phase of phasePlan.phases){assert.ok(words(native.svg).includes(norm(reportVisualText(phase.title,language))));for(const number of phase.weekRange.match(/\d+/g)??[])assert.ok(native.alt.includes(number));}
  assert.ok(native.alt.includes(reportVisualText('Month {month}+',language,{month:'3'})));assert.ok(native.note.includes(reportVisualText('The order and rough length of each phase, worked out from what is on the saved design. The weeks are a planning guide, not a promise: weather, money and labour will move them. The order should not change.',language)));
  const custom={...phasePlan,phases:phasePlan.phases.map((p,i)=>i===0?{...p,title:'Recorded custom stage',weekRange:'Recorded custom range'}:p)};const customFigure=timelineFigure(custom,language)!;assert.ok(customFigure.alt.includes('Recorded custom stage (Recorded custom range)'));
 }
 const allCanvas={...fixture.canvas,items:Object.values(ELEMENTS_BY_ID).map((d,i)=>({...fixture.canvas.items[0],id:`phase-check-${i}`,defId:d.id}))};
 const allPhases=buildPhasePlan(allCanvas,fixture.refs,{rainfallMm:fixture.location.rainfall.annual});
 for(const phase of allPhases.phases)assert.ok(sources.has(phase.title),phase.title);
 for(const language of languages){const native=timelineFigure(allPhases,language)!;for(const phase of allPhases.phases)assert.ok(!native.alt.includes(`(${phase.weekRange})`),'a changed upstream range format must not silently remain English');}
});

test('a new upstream phase, soil classification or named wind cannot silently acquire an English drawing label',()=>{
 function factoryWords(file:string,name:string){
  const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true);const out:string[]=[];
  const factory=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(factory);
  function visit(n:ts.Node){if(ts.isReturnStatement(n)&&n.expression){function values(v:ts.Expression){if(ts.isStringLiteral(v))out.push(v.text);else if(ts.isConditionalExpression(v)){values(v.whenTrue);values(v.whenFalse);}}values(n.expression);}ts.forEachChild(n,visit);}visit(factory);return out;
 }
 for(const word of [...factoryWords('lib/phasing.ts','titleFor'),...factoryWords('lib/isric-soil.ts','textureClass')])assert.ok(sources.has(word),word);
 const wind=ts.createSourceFile('wind.ts',read('lib/regional-wind.ts'),ts.ScriptTarget.Latest,true);const titles:string[]=[];
 function visit(n:ts.Node){if(ts.isPropertyAssignment(n)&&n.name.getText(wind)==='title'&&ts.isStringLiteral(n.initializer))titles.push(n.initializer.text.charAt(0)+n.initializer.text.slice(1).toLowerCase());ts.forEachChild(n,visit);}visit(wind);
 for(const word of titles)assert.ok(sources.has(word),word);
});

test('long native wind captions stay below the header and the cold-month value keeps clear of its axis label',()=>{
 const {location,facts}=fixture;
 for(const language of languages){
  const sector=sectorFigure(location,facts,language)!;
  for(const label of shapes(sector.svg,'text'))assert.ok(Number(label.y)>=Number(label['font-size']),`${language}: caption crossed the top edge`);
  const cold=location.climate!.monthlyTemp!.indexOf(Math.min(...location.climate!.monthlyTemp!));const value=figureNumber(location.climate!.monthlyTemp![cold],1)+' °C';
  const climate=climateFigure(location,language)!;
  const tags:Array<Record<string,string>>=[...climate.svg.matchAll(/<text\b[^>]*>[\s\S]*?<\/text>/g)].map(m=>({text:words(m[0]),...attributes(m[0])}));
  const reading=tags.find(t=>t.text===value)!;
  const month=tags.filter(t=>t.text===recordsMonthShort(language,cold+1)).at(-1)!;
  assert.ok(Number(month.y)-Number(reading.y)>18,`${language}: cold temperature touches the month axis`);
 }
});
