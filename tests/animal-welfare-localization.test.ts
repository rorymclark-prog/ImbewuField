import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {ANIMAL_ENTERPRISES,HOUSING_LABEL,enterprisesForHousing,type HousingKind} from '../lib/animal-enterprises.ts';
import {buildProductGuidance,productGuideText,type ProductGuideContext} from '../lib/production-product-guidance.ts';
import {CROP_EXPORT_COPY} from '../lib/crop-export-copy-data.ts';
import {CROP_EXPORT_DRAFT_LANGUAGES} from '../lib/crop-export-copy.ts';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const compressed=readFileSync(new URL('./fixtures/animal-care-translation/before.json.gz',import.meta.url)),raw=gunzipSync(compressed);
const before=JSON.parse(raw.toString()) as {base:string;rows:Array<{english:string;bindings:Array<{enterpriseId:string;index:number;source:unknown}>}>;enterprises:typeof ANIMAL_ENTERPRISES;cases:Array<{id:string;context:ProductGuideContext;guide:ReturnType<typeof buildProductGuidance>}>;registry:Array<Record<string,string>>;sources:Array<{file:string;source:string;sha256:string}>};
const packet=JSON.parse(read('docs/translation/four-language-completion/animal-welfare-drafts.json')) as {base:string;status:string;sourceCount:number;sourceCaptureSha256:string;rows:Array<Record<string,string>>;sourceBindings:typeof before.rows;uiRows:Array<Record<string,string>>;careCardPresentation:{sourceCapture:string;compressedSha256:string;sourceSha256:string;sourceChanges:Array<{before:string;after:string}>}};
const numbers=(s:string)=>s.match(/\d+(?:[.,]\d+)?/g)??[];
function completeCare(body:string,rows:typeof packet.rows,language:string){for(const row of rows)assert.ok(body.includes(row[language]),'the complete care condition must reach the guide: '+row.english);}

test('all original animal care fields have bound unreviewed drafts without altering enterprise facts or parent translations',()=>{
 const manifest=JSON.parse(read('tests/fixtures/animal-care-translation/capture-manifest.json'));assert.equal(createHash('sha256').update(compressed).digest('hex'),manifest.compressedSha256);assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.uncompressedSha256);assert.equal(packet.sourceCaptureSha256,manifest.compressedSha256);assert.equal(packet.base,before.base);assert.match(packet.status,/IN PROGRESS.*Unreviewed/);
 assert.deepEqual(ANIMAL_ENTERPRISES,before.enterprises,'translation cannot change livestock quantities, source claims, welfare requirements, legal records or calendars');
 for(const source of before.sources){assert.equal(createHash('sha256').update(source.source).digest('hex'),source.sha256);if(source.file!=='lib/crop-export-copy-data.ts')assert.equal(read(source.file),source.source,'only copy rows change; existing engines, animal data, fallback authority and renderer remain byte-exact');}
 assert.deepEqual(CROP_EXPORT_COPY.slice(0,before.registry.length),before.registry,'all inherited source pairs and review metadata remain exact');assert.deepEqual(CROP_EXPORT_COPY.slice(before.registry.length,before.registry.length+packet.rows.length+packet.uiRows.length),[...packet.rows,...packet.uiRows]);assert.equal(new Set(CROP_EXPORT_COPY.map(r=>r.english)).size,CROP_EXPORT_COPY.length);
 assert.deepEqual(packet.sourceBindings,before.rows);assert.equal(packet.sourceCount,before.rows.length);assert.equal(packet.rows.length,before.rows.length);
 const actual=new Set(Object.values(ANIMAL_ENTERPRISES).flatMap(e=>e.welfare.map(p=>p.point)));assert.deepEqual(new Set(packet.rows.map(r=>r.english)),actual,'a new or missing original welfare statement must require a reviewed source binding');
 for(const[index,row]of packet.rows.entries()){
  assert.equal(row.english,before.rows[index].english);for(const bound of before.rows[index].bindings)assert.deepEqual(ANIMAL_ENTERPRISES[bound.enterpriseId].welfare[bound.index],{point:row.english,source:bound.source});
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){assert.equal(productGuideText(row.english,language),row[language]);assert.notEqual(row[language],row.english);assert.deepEqual(numbers(row[language]),numbers(row.english),'decimal values, limits and dimensions must retain their original order');for(const identity of ['Cape-bee (Capensis)','Limpopo','KwaZulu-Natal','calcium','phosphorus','sourveld','porker','baconer','m²','m2','cm','km','kg'])if(row.english.includes(identity))assert.ok(row[language].includes(identity),'source identity or written unit lost: '+identity);}
 }
});

test('every selected animal enterprise keeps exact English guides and all native care conditions with the same source citations',()=>{
 assert.deepEqual(before.cases.map(c=>c.id),Object.keys(ANIMAL_ENTERPRISES));
 for(const row of before.cases){const snapshot=JSON.stringify(row.context),english=buildProductGuidance(row.context,[]);assert.deepEqual(english,row.guide,'default complete English guide is the captured source output');assert.deepEqual(buildProductGuidance(row.context,[],undefined,'xx'),row.guide);const source=ANIMAL_ENTERPRISES[row.id];assert.equal(english.animalProducts.length,1);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const native=buildProductGuidance(row.context,[],undefined,language),item=native.animalProducts[0],sourceItem=english.animalProducts[0];assert.equal(native.foodForest.length,0);assert.equal(native.animalProducts.length,1);assert.ok(item.title.endsWith(source.name),'a translated housing title cannot replace the recorded enterprise identity');assert.deepEqual(item.sources,sourceItem.sources);assert.deepEqual(item.expectedSeason,sourceItem.expectedSeason);assert.deepEqual(numbers(item.lines.join(' ')),numbers(sourceItem.lines.join(' ')),'housing counts, output references and care limits retain their ordered figures');
   const relevant=packet.rows.filter(r=>source.welfare.some(p=>p.point===r.english)),body=item.lines.join('\n');completeCare(body,relevant,language);for(const care of source.welfare)assert.ok(!item.lines.includes(care.point),'no originally bound welfare field may fall back to English');
   for(const care of relevant){const damaged=body.replace(care[language],'');assert.throws(()=>completeCare(damaged,relevant,language),'titles, quantities and source links alone cannot pass without the complete care condition');}
  }assert.equal(JSON.stringify(row.context),snapshot,'display must not mutate mapped structures, selected enterprises or saved counts');
 }
});

test('unselected animal housing retains its choices and source links while showing translated first care statements',()=>{
 for(const housing of Object.keys(HOUSING_LABEL) as HousingKind[]){const context:ProductGuideContext={trees:[],animals:[{housing,existing:0,proposed:1}],bananaCircles:0},snapshot=JSON.stringify(context),english=buildProductGuidance(context,[]);const options=enterprisesForHousing(housing);
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const result=buildProductGuidance(context,[],undefined,language),item=result.animalProducts[0];assert.equal(result.animalProducts.length,english.animalProducts.length);assert.deepEqual(item.sources,english.animalProducts[0].sources);for(const option of options){assert.ok(item.lines.some(line=>line.includes(option.name)),'unselected housing cannot silently select one enterprise');const point=option.welfare[0];if(point)assert.ok(item.lines.includes(productGuideText(point.point,language)));}assert.deepEqual(numbers(item.lines.join(' ')),numbers(english.animalProducts[0].lines.join(' ')));}assert.equal(JSON.stringify(context),snapshot);
 }
});

test('changed source wording and private observations remain exact rather than being guessed into care advice',()=>{
 for(const language of ['en','xx',...CROP_EXPORT_DRAFT_LANGUAGES]){
  const privateNote='PRIVATE {count} $& <kept> 03.50 m²';assert.equal(productGuideText(privateNote,language),privateNote);
  for(const row of packet.rows){assert.equal(productGuideText(row.english,'en'),row.english);assert.equal(productGuideText(row.english,'xx'),row.english);const changed=row.english+' Private changed observation.';assert.equal(productGuideText(changed,language),changed);}
 }
});

test('transport recommendations and poultry minima and maxima cannot survive changed numbers or missing qualifications',()=>{
 // These independent counterexamples preserve every other source word and all citations.
 // Sorted-number checks alone would miss swapping porker and adult transport areas.
 for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
  const pig=packet.rows.find(r=>r.english.startsWith('When pigs are trucked,'))!,changed=pig[language].replace('0.3','__first__').replace('0.8','0.3').replace('__first__','0.8');assert.deepEqual([...numbers(changed)].sort(),[...numbers(pig[language])].sort());assert.throws(()=>completeCare(changed,[pig],language));
  for(const prefix of ['Newly hatched chicks must be given access','Hens need at least','In free-range broiler','The outdoor free-range','Winter feed shortage']){const care=packet.rows.find(r=>r.english.startsWith(prefix))!;assert.ok(care);assert.throws(()=>completeCare(care[language].slice(0,-12),[care],language),'a clipped qualifier must be detected even when the main care heading remains');}
 }
});

test('actual care cards retain default markup and show complete drafts with English originals without changing livestock data',async()=>{
 const {animalCarePresenter}=await import('./helpers/animal-care-presenter.ts'),React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
 const oldRaw=readFileSync(new URL('./fixtures/animal-care-translation/card-before.tsx.gz',import.meta.url)),old=gunzipSync(oldRaw).toString(),current=read('components/crops/AnimalEnterprisesCard.tsx');assert.equal(createHash('sha256').update(oldRaw).digest('hex'),packet.careCardPresentation.compressedSha256);assert.equal(createHash('sha256').update(old).digest('hex'),packet.careCardPresentation.sourceSha256);
 // Controls have their own exact edit log and callback/default-output comparisons.
 const controls=JSON.parse(read('docs/translation/four-language-completion/animal-control-drafts.json')) as {sourceChanges:Array<{before:string;after:string}>};
 const restore=(source:string)=>{for(const edit of [...controls.sourceChanges].reverse())source=source.replace(edit.after,edit.before);for(const edit of packet.careCardPresentation.sourceChanges)source=source.replace(edit.after,edit.before);return source;};assert.equal(restore(current),old,'only the exact recorded care presentation may change; all source/number, selector and season paths remain byte-exact');
 const quoteEdit=packet.careCardPresentation.sourceChanges.find(edit=>edit.after.includes("overflowWrap: 'anywhere'"))!;const requireQuoteWrap=(source:string)=>assert.ok(source.includes(quoteEdit.after),'the measured non-breaking quotation overflow needs its exact paint-only wrapping rule');requireQuoteWrap(current);assert.throws(()=>requireQuoteWrap(current.replace(quoteEdit.after,quoteEdit.before)),'all original citations and care text survive removing the wrap, but the phone fix must fail');assert.throws(()=>assert.equal(restore(current.replace('months.includes(i + 1)','true')),old),'a changed local production-month choice must still fail the full-card source guard');
 const html=(source:string,language:string,e:(typeof ANIMAL_ENTERPRISES)[string])=>renderToStaticMarkup(React.createElement(animalCarePresenter(source,language),{e})),escaped=(text:string)=>renderToStaticMarkup(React.createElement('span',null,text)).slice(6,-7);
 for(const e of Object.values(ANIMAL_ENTERPRISES)){const snapshot=JSON.stringify(e);for(const language of ['en','xx'])assert.equal(html(current,language,e).replaceAll('color:var(--text-primary);overflow-wrap:anywhere','color:var(--text-primary)').replace('>Production reference</div>',`>${e.product==='fish'?'Harvest':({eggs:'Eggs',meat:'Meat',milk:'Milk',honey:'Honey',fish:'Fish',wool:'Wool'}as const)[e.product]} per ${e.animalUnit}</div>`),html(old,'en',e),'defaultEnglish and unsupported markup remain exact outside the declared source-quote style and independently source-proven reference heading correction');
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const markup=html(current,language,e);if(e.welfare.length)for(const row of packet.uiRows)assert.ok(markup.includes(escaped(row[language])));for(const care of e.welfare){assert.ok(markup.includes(escaped(productGuideText(care.point,language))));assert.ok(markup.includes(renderToStaticMarkup(React.createElement('p',{lang:'en',className:'mt-1'},care.point))),'each complete care draft has its own complete English disclosure');}for(const original of e.legal)assert.ok(markup.includes(escaped(original.point)),'untranslated legal notes remain original');}assert.equal(JSON.stringify(e),snapshot);
 }
 const original=ANIMAL_ENTERPRISES.bees,privateText='PRIVATE {count} $& <kept> 03.50 m²',privateCase={...original,name:privateText,welfare:[{...original.welfare[0],point:privateText}]},snapshot=JSON.stringify(privateCase);
 for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const markup=html(current,language,privateCase);assert.ok(markup.includes(escaped(privateText)));assert.ok(!markup.includes('<kept>'));assert.ok(!markup.includes('<p lang="en"'),'unknown private wording does not pretend to be a translated source note');}assert.equal(JSON.stringify(privateCase),snapshot);
});
