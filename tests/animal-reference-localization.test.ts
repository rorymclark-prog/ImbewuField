import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ANIMAL_ENTERPRISES,type AnimalEnterprise,type AnimalRangeField,type HousingKind} from '../lib/animal-enterprises.ts';
import {buildProductGuidance,productGuideText,type ProductGuideContext} from '../lib/production-product-guidance.ts';
import {CROP_EXPORT_COPY} from '../lib/crop-export-copy-data.ts';
import {CROP_EXPORT_DRAFT_LANGUAGES} from '../lib/crop-export-copy.ts';
import {recordsMonthLong} from '../lib/records-months.ts';
import {animalControlPresenters} from './helpers/animal-control-presenter.ts';
import {restoreAnimalReferencePresentation,stripDeclaredAnimalReferenceOriginals,translateExpectedAnimalReferenceNotes} from './helpers/animal-reference-expectation.ts';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const compressed=readFileSync(new URL('./fixtures/animal-reference-translation/before.json.gz',import.meta.url)),raw=gunzipSync(compressed);
type Binding={enterpriseId:string;field:AnimalRangeField|'productionReferences';index?:number;source:unknown;sourceValue?:[number,number];sourceUnit?:string};
type SourceRow={english:string;bindings:Binding[]};
type Props={groups:Array<{housing:HousingKind;existing:number;proposed:number}>;choices:Partial<Record<HousingKind,string>>;seasons:Partial<Record<HousingKind,{enterpriseId:string;months:number[]}>>;compact?:boolean};
const before=JSON.parse(raw.toString())as{base:string;rows:SourceRow[];enterprises:typeof ANIMAL_ENTERPRISES;registry:Array<Record<string,string>>;sources:Array<{file:string;source:string;sha256:string}>;cards:Array<{id:string;props:Props;markup:Record<string,string>}>;guides:Array<{id:string;context:ProductGuideContext;outputs:Record<string,ReturnType<typeof buildProductGuidance>>}>};
const packet=JSON.parse(read('docs/translation/four-language-completion/animal-reference-drafts.json'))as{base:string;status:string;sourceCount:number;sourceCaptureSha256:string;rows:Array<Record<string,string>>;sourceBindings:SourceRow[];sourceChanges:Array<{before:string;after:string}>};
const source=read('components/crops/AnimalEnterprisesCard.tsx'),original=before.sources.find(row=>row.file==='components/crops/AnimalEnterprisesCard.tsx')!.source,numbers=(s:string)=>s.match(/\d+(?:[.,]\d+)?/g)??[],units=(s:string)=>s.replaceAll('e.g.','').match(/(?<![A-Za-z])(?:kg|ml|cm|m2|m²|°C|L|g)(?![A-Za-z])/g)??[],escaped=(s:string)=>renderToStaticMarkup(React.createElement('span',null,s)).slice(6,-7);
const compiled=new Map<string,ReturnType<typeof animalControlPresenters>>();
function present(language:string){if(!compiled.has(language))compiled.set(language,animalControlPresenters(source,language));return compiled.get(language)!;}
function card(language:string,props:Props){return renderToStaticMarkup(React.createElement(present(language).Card,{...props,onChoose:()=>{},onSeasonsChange:()=>{}}));}
function requireDrafts(body:string,rows:Array<Record<string,string>>,language:string){for(const row of rows)assert.ok(body.includes(escaped(row[language])),'the complete original reference condition must reach the actual card: '+row.english);}
const rangeFields:AnimalRangeField[]=['outputPerAnimal','weeksToFirstProduct','productiveLifeYears','feedKgPerDay','waterLPerDay','spaceM2'];

test('complete reference drafts retain immutable enterprise fields, all parent rows and every non-presentation source byte',()=>{
 const manifest=JSON.parse(read('tests/fixtures/animal-reference-translation/capture-manifest.json'));assert.equal(createHash('sha256').update(compressed).digest('hex'),manifest.compressedSha256);assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.uncompressedSha256);assert.equal(packet.sourceCaptureSha256,manifest.compressedSha256);assert.equal(packet.base,before.base);assert.match(packet.status,/IN PROGRESS.*Unreviewed/);assert.equal(packet.sourceCount,43);assert.equal(packet.rows.length,packet.sourceCount);assert.deepEqual(packet.sourceBindings,before.rows);assert.deepEqual(ANIMAL_ENTERPRISES,before.enterprises);
 for(const file of before.sources){assert.equal(createHash('sha256').update(file.source).digest('hex'),file.sha256);if(!['components/crops/AnimalEnterprisesCard.tsx','lib/crop-export-copy-data.ts'].includes(file.file))assert.equal(read(file.file),file.source,'reference drafts cannot change a model, number/month authority, renderer or original source data');}
 assert.deepEqual(CROP_EXPORT_COPY.slice(0,before.registry.length),before.registry);assert.deepEqual(CROP_EXPORT_COPY.slice(before.registry.length),packet.rows);assert.equal(new Set(CROP_EXPORT_COPY.map(row=>row.english)).size,CROP_EXPORT_COPY.length);assert.equal(restoreAnimalReferencePresentation(source),original,'only the exact note disclosures may change; selectors, month gates and numeric props retain their full original code');
 for(const[from,to]of[['months.includes(i + 1)','true'],['on ? null : e.enterpriseId','e.name'],['Math.round(w / 4.35)','Math.round(w / 4)']]){assert.ok(source.includes(from));assert.throws(()=>assert.equal(restoreAnimalReferencePresentation(source.replace(from,to)),original),'a changed persisted identity, production-month gate or numeric conversion must fail');}
 for(const[index,row]of packet.rows.entries()){assert.equal(row.english,before.rows[index].english);for(const bound of before.rows[index].bindings){const e=ANIMAL_ENTERPRISES[bound.enterpriseId];if(bound.field==='productionReferences'){assert.equal(e.productionReferences?.[bound.index!].point,row.english);assert.deepEqual(e.productionReferences?.[bound.index!].source,bound.source);}else{const value=e[bound.field];assert.ok(value);assert.equal(value.note,row.english);assert.deepEqual(value.value,bound.sourceValue);assert.deepEqual(value.source,bound.source);if(bound.field==='outputPerAnimal')assert.equal(e.outputUnit,bound.sourceUnit);}}}
});

test('every whole note preserves ordered figures, source unit symbols, canonical months and source identities',()=>{
 const identities=['SABIO','Nguni','Limpopo','Holstein-Friesland','Jersey','Ayrshire','KZN','Makhathini','SAPA','Arbor Acres Plus','Cobb','Indian River','Ross','Potchefstroom Koekoek','Venda','Ovambo','Naked Neck','Grobbelaar','Sutherland','Molalakgotla','ARC','Irene','Dekalb Amberlink','Dekalb Brown','Hy-Line Silver Brown','Hy-Line Brown','Lohmann Brown Lite','Pekin','Muscovy','Warsaw','SAJAS','Guyana','Steklenev','LRRD','O. mossambicus','O. niloticus','Mozambique Tilapia','Nile Tilapia','Highveld','Saanen','Putukwane','Polokwane','British Alpine','Toggenburg','Boer','Savanna','Kalahari Red','FAO','Fort & Martin','New Zealand White','Phendula','Stellenbosch','Eden','Central Karoo','West Coast','Snyman & Herselman','Mara Research Station','Elsenburg','Dohne Merino','Ceres-Karoo','Smallstock Unit','SSU','NWGA/Mandela Initiative','Eastern Cape','Wool Sheep Development Program','Grootfontein','ADI'];
 for(const row of packet.rows)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){assert.equal(productGuideText(row.english,language),row[language]);assert.notEqual(row[language],row.english);assert.deepEqual(numbers(row[language]),numbers(row.english));assert.deepEqual(units(row[language]),units(row.english));assert.deepEqual(row[language].match(/\{\w+\}/g)??[],row.english.match(/\{\w+\}/g)??[]);assert.ok(!/[\u0400-\u04ff\u00ad]/.test(row[language]),'hidden or wrong-script characters cannot enter these Latin-script drafts');for(const identity of identities)if(row.english.includes(identity))assert.ok(row[language].includes(identity),'source identity changed: '+identity);}
 assert.deepEqual(units('e.g. 220 g/day'),['g']);assert.notDeepEqual(units('220 g/day'),units('220 kg/day'),'the unit check must detect grams turning into kilograms');
 for(const language of CROP_EXPORT_DRAFT_LANGUAGES)for(const[index,months]of[[29,[[3,4],[10,11]]],[41,[[6,7],[11,12]]]]as const)for(const[a,b]of months)assert.ok(packet.rows[index][language].includes(recordsMonthLong(language,a)+'–'+recordsMonthLong(language,b)));
 const literal=packet.rows[25].english.match(/\('10-.*?12'\)/)![0];for(const language of CROP_EXPORT_DRAFT_LANGUAGES)assert.ok(packet.rows[25][language].includes(literal),'the exact source PDF line-break notation remains data, not an interpreted escape');
});

test('all 53 actual original English and unsupported card states remain byte-exact',()=>{
 assert.equal(before.cards.length,53);for(const row of before.cards)for(const language of ['en','xx'])assert.equal(card(language,row.props),row.markup[language],row.id+' '+language+' must retain the entire original card markup');
});

test('every native numeric and age-system note has its complete draft and its own exact English original',()=>{
 let pairs=0;const originalParagraph=(text:string)=>renderToStaticMarkup(React.createElement('p',{lang:'en',className:'mt-1',style:{overflowWrap:'anywhere'}},text));
 for(const e of Object.values(ANIMAL_ENTERPRISES)){const snapshot=JSON.stringify(e),rows=packet.rows.filter((_row,index)=>before.rows[index].bindings.some(bound=>bound.enterpriseId===e.enterpriseId));for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const html=renderToStaticMarkup(React.createElement(present(language).EnterpriseFacts,{e}));requireDrafts(html,rows,language);for(const row of rows){assert.ok(html.includes(originalParagraph(row.english)),'each complete note has an original-English disclosure, beyond its source title or primary quote');pairs++;assert.throws(()=>requireDrafts(html.replace(escaped(row[language]),''),[row],language),'the title, values and original English cannot replace a missing complete native condition');}for(const law of e.legal)assert.ok(html.includes(escaped(law.point)),'still-untranslated legal source notes remain honestly original');}assert.equal(JSON.stringify(e),snapshot);}
 assert.equal(pairs,176,'all44typed source bindings must reach their four native presenters');
 for(const row of before.cards){const snapshot=JSON.stringify(row.props);for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const html=card(language,row.props),without=stripDeclaredAnimalReferenceOriginals(html);assert.ok(without.includes(escaped(productGuideText('Animals on your map',language))));assert.equal(JSON.stringify(row.props),snapshot,'presenting a source disclosure cannot mutate the input selections or dates');}}
});

test('native guide changes stay inside the original complete typed reference frames with every other value and source exact',()=>{
 let translatedFrames=0;for(const row of before.guides){const snapshot=JSON.stringify(row.context),e=before.enterprises[row.id];for(const language of ['en','xx'])assert.deepEqual(buildProductGuidance(row.context,[],undefined,language),row.outputs[language]);for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const expected=structuredClone(row.outputs[language]);translatedFrames+=translateExpectedAnimalReferenceNotes(expected.animalProducts,e,language);const actual=buildProductGuidance(row.context,[],undefined,language);assert.deepEqual(actual,expected,'only the complete declared original reference frames change');assert.deepEqual(numbers(JSON.stringify(actual)),numbers(JSON.stringify(row.outputs[language])),'reference quantities, dates, study sizes and dimensions retain their original ordering');}assert.equal(JSON.stringify(row.context),snapshot);}assert.ok(translatedFrames>0);
});

test('removing final conditions, exchanging water-stage figures or replacing citations cannot pass the reference checks',()=>{
 for(const language of CROP_EXPORT_DRAFT_LANGUAGES){for(const index of [0,4,10,14,16,22,23,25,26,27,29,30,33,35,36,39,40,42]){const row=packet.rows[index],body=escaped(row[language]);assert.throws(()=>requireDrafts(escaped(row[language].slice(0,-16)),[row],language),'a truncated system, stage, species or non-combination qualification must fail');assert.throws(()=>requireDrafts(escaped(row.english),[row],language),'original English alone is not a native draft');assert.ok(body.length>0);}
  const row=before.guides.find(row=>row.id==='pig-pork')!,expected=structuredClone(row.outputs[language]);translateExpectedAnimalReferenceNotes(expected.animalProducts,before.enterprises[row.id],language);const copy=structuredClone(expected);assert.ok(copy.animalProducts[0].sources?.length);copy.animalProducts[0].sources![0].url='https://example.invalid/replaced-source';assert.throws(()=>assert.deepEqual(copy,expected),'unchanged wording cannot hide a replaced source');
  const water=packet.rows[34][language],broken=water.replace('10-18','18-10');assert.notEqual(water,broken);assert.throws(()=>assert.deepEqual(numbers(broken),numbers(packet.rows[34].english)),'unchanged sorted numbers must not permit a reversed pregnancy range');
 }
});

test('private or edited note fields cannot acquire the draft or an invented English-original pairing',()=>{
 const privateText='PRIVATE {note} $& <kept> 03.50 L',escapedPrivate=escaped(privateText);
 for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const{EnterpriseFacts}=present(language);for(const field of rangeFields){const e=Object.values(ANIMAL_ENTERPRISES).find(e=>e[field]);assert.ok(e);const changed={...e,[field]:{...e[field]!,note:privateText}},snapshot=JSON.stringify(changed),html=renderToStaticMarkup(React.createElement(EnterpriseFacts,{e:changed}));assert.ok(html.includes(escapedPrivate));assert.ok(!html.includes('<kept>'));assert.ok(!html.includes(renderToStaticMarkup(React.createElement('p',{lang:'en',className:'mt-1',style:{overflowWrap:'anywhere'}},privateText))),'an edited note is already its original text, not a translated public reference');assert.equal(JSON.stringify(changed),snapshot);}
  for(const row of packet.rows)assert.equal(productGuideText(row.english+' PRIVATE edit.',language),row.english+' PRIVATE edit.');
 }
});


test('complete native reference paragraphs retain their exact text with the measured narrow-column wrapping',()=>{
 const wrap=packet.sourceChanges.find(edit=>edit.after.includes("{note && <p")&&edit.after.includes("overflowWrap: 'anywhere'"));assert.ok(wrap);const verify=(text:string)=>assert.ok(text.includes(wrap.after),'the measured source-note paragraph needs its native wrapping rule');verify(source);assert.throws(()=>verify(source.replace(wrap.after,wrap.before)),'wrapping the value alone cannot hide an overflowing full source paragraph');
 for(const language of ['en','xx',...CROP_EXPORT_DRAFT_LANGUAGES]){const note=productGuideText(packet.rows[22].english,language),html=renderToStaticMarkup(React.createElement(present(language).Fact,{label:'Reference',value:'2.3–2.9 kg/bird',note})),native=CROP_EXPORT_DRAFT_LANGUAGES.includes(language as any),expected=renderToStaticMarkup(React.createElement('p',{className:'mt-1',style:native?{overflowWrap:'anywhere'}:undefined},note));assert.ok(html.includes(expected),'the actual note paragraph keeps its complete text and its own wrapping rule');}
});
