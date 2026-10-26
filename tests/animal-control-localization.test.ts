import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import TestRenderer,{act,type ReactTestInstance} from 'react-test-renderer';
import {ANIMAL_ENTERPRISES,HOUSING_LABEL,PRODUCT_LABEL,animalReferenceQualifier,isFoodProduct,type AnimalEnterprise,type HousingKind} from '../lib/animal-enterprises.ts';
import {CROP_EXPORT_COPY} from '../lib/crop-export-copy-data.ts';
import {CROP_EXPORT_DRAFT_LANGUAGES} from '../lib/crop-export-copy.ts';
import {productGuideText} from '../lib/production-product-guidance.ts';
import {recordsMonthLong,recordsMonthShort} from '../lib/records-months.ts';
import {animalControlPresenters} from './helpers/animal-control-presenter.ts';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const compressed=readFileSync(new URL('./fixtures/animal-control-translation/before.json.gz',import.meta.url)),raw=gunzipSync(compressed);
type Props={groups:Array<{housing:HousingKind;existing:number;proposed:number}>;choices:Partial<Record<HousingKind,string>>;seasons:Partial<Record<HousingKind,{enterpriseId:string;months:number[]}>>;compact?:boolean};
const before=JSON.parse(raw.toString())as{base:string;sources:Array<{file:string;source:string;sha256:string}>;enterprises:typeof ANIMAL_ENTERPRISES;registry:Array<Record<string,string>>;cases:Array<{id:string;props:Props;markup:Record<string,string>}>;outputCaptionExamples:Array<{id:string;caption:string;sourceOutputUnit:string;sourceValue:[number,number];sourceQualifier:string;sourceNote:string}>};
const packet=JSON.parse(read('docs/translation/four-language-completion/animal-control-drafts.json'))as{base:string;status:string;sourceCount:number;rows:Array<Record<string,string>>;sourceBindings:Array<{english:string;bindings:Array<{kind:string;id?:string;field?:Parameters<typeof animalReferenceQualifier>[1];source?:string;index?:number;originalUnit?:string}>}>;sourceChanges:Array<{before:string;after:string}>;sourceCaptureSha256:string};
const current=read('components/crops/AnimalEnterprisesCard.tsx'),original=before.sources.find(s=>s.file==='components/crops/AnimalEnterprisesCard.tsx')!.source;
const plain=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_m,value:string)=>String.fromCodePoint(parseInt(value,16))).replace(/&#(\d+);/g,(_m,value:string)=>String.fromCodePoint(Number(value))).replaceAll('&amp;','&').replaceAll('&quot;','\"').replaceAll('&lt;','<').replaceAll('&gt;','>');
const numbers=(s:string)=>s.match(/\d+(?:[.,]\d+)?/g)??[],compact=(s:string)=>s.normalize('NFC').replace(/\s/g,''),tokens=(s:string)=>(s.match(/\{\w+\}/g)??[]).sort();
const restore=(source:string)=>{for(const edit of [...packet.sourceChanges].reverse())source=source.replace(edit.after,edit.before);return source;};
const text=(node:ReactTestInstance|string):string=>typeof node==='string'?node:node.children.map(child=>text(child)).join('');
function normalizeReferenceHeading(markup:string,props:Props):string{for(const group of props.groups){const e=ANIMAL_ENTERPRISES[props.choices[group.housing]??''];if(e)markup=markup.replace('>Production reference</div>',`>${e.product==='fish'?'Harvest':PRODUCT_LABEL[e.product]} per ${e.animalUnit}</div>`);}return markup;}
function markup(source:string,language:string,props:Props):string{const{Card}=animalControlPresenters(source,language);return renderToStaticMarkup(React.createElement(Card,{...props,onChoose:()=>{},onSeasonsChange:()=>{}}));}

test('animal controls retain every original enterprise fact, copy row and callback outside the exact declared presentation',()=>{
 const manifest=JSON.parse(read('tests/fixtures/animal-control-translation/capture-manifest.json'));assert.equal(createHash('sha256').update(compressed).digest('hex'),manifest.compressedSha256);assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.uncompressedSha256);assert.equal(packet.sourceCaptureSha256,manifest.compressedSha256);assert.equal(packet.base,before.base);assert.equal(restore(current),original,'no selector, callback, count calculation, default month gate or numeric formatter outside the exact edits may change');
 for(const source of before.sources){assert.equal(createHash('sha256').update(source.source).digest('hex'),source.sha256);if(!['components/crops/AnimalEnterprisesCard.tsx','lib/crop-export-copy-data.ts'].includes(source.file))assert.equal(read(source.file),source.source,'animal/model/copy/number/month authorities remain byte-exact');}
 assert.deepEqual(ANIMAL_ENTERPRISES,before.enterprises);assert.deepEqual(CROP_EXPORT_COPY.slice(0,before.registry.length),before.registry);assert.deepEqual(CROP_EXPORT_COPY.slice(before.registry.length),packet.rows);assert.equal(new Set(CROP_EXPORT_COPY.map(r=>r.english)).size,CROP_EXPORT_COPY.length);
 const requireSource=(source:string)=>assert.equal(restore(source),original);for(const[from,to]of[['g.existing + g.proposed','g.proposed'],['months.includes(i + 1)','true'],['Math.round(w / 4.35)','Math.round(w / 4)'],['on ? null : e.enterpriseId','e.name']]){assert.ok(current.includes(from));assert.throws(()=>requireSource(current.replace(from,to)),'a numeric, month or persisted identity change cannot hide behind translation edits');}
});

test('each complete control, qualifier, region and name is bound to its original source with unchanged figures and placeholders',()=>{
 assert.match(packet.status,/IN PROGRESS.*Unreviewed/);assert.equal(packet.rows.length,packet.sourceCount);assert.equal(packet.sourceBindings.length,packet.sourceCount);
 for(const[index,row]of packet.rows.entries()){
  assert.equal(row.english,packet.sourceBindings[index].english);for(const binding of packet.sourceBindings[index].bindings){const e=binding.id?before.enterprises[binding.id]:undefined;if(binding.kind==='name')assert.equal(row.english,e!.name);if(binding.kind==='qualifier')assert.equal(row.english,animalReferenceQualifier(e!,binding.field!));if(binding.kind==='seasonalPattern')assert.equal(row.english,e!.seasonalPattern?.text);if(binding.kind==='source-region')assert.equal(row.english,e!.windows[binding.index!].region);if(binding.kind==='fact-caption')assert.ok(['Feed','Water','Space'].some(kind=>row.english===`${kind} per ${e!.animalUnit}`));if(binding.kind==='literal-control')assert.ok(current.includes(binding.source!));}
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){assert.equal(productGuideText(row.english,language),row[language]);assert.notEqual(row[language],row.english);assert.deepEqual(numbers(row[language]),numbers(row.english));assert.deepEqual(tokens(row[language]),tokens(row.english));}
 }
 for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const season=(start:string)=>packet.rows.find(row=>row.english.startsWith(start))![language];assert.ok(season('In this South African Saanen').includes(recordsMonthLong(language,8)+'–'+recordsMonthLong(language,10)));for(const[start,end]of[[3,4],[6,7],[9,10]])assert.ok(season('Breeding/kidding').includes(recordsMonthLong(language,start)+'–'+recordsMonthLong(language,end)));}
});

test('all original English and unsupported cards remain exact except the source-proven production-reference heading',()=>{
 assert.equal(before.cases.length,53);for(const row of before.cases)for(const language of['en','xx']){const actual=markup(current,language,row.props);assert.equal(normalizeReferenceHeading(actual,row.props),row.markup[language],row.id+' '+language+' must preserve the whole original default markup');}
 const requireReference=(html:string)=>assert.ok(html.includes('>Production reference</div>'),'the measured live-weight/count field must be labelled a reference rather than edible meat');
 for(const example of before.outputCaptionExamples){const row=before.cases.find(row=>row.id===example.id+'-existing')!,html=markup(current,'en',row.props);assert.ok(row.markup.en.includes('>'+example.caption+'</div>'),'the original misleading heading must be an observed source case');requireReference(html);assert.ok(!html.includes('>'+example.caption+'</div>'));const e=ANIMAL_ENTERPRISES[example.id];assert.equal(e.outputUnit,example.sourceOutputUnit);assert.deepEqual(e.outputPerAnimal?.value,example.sourceValue);assert.equal(animalReferenceQualifier(e,'outputPerAnimal'),example.sourceQualifier);assert.equal(e.outputPerAnimal?.note,example.sourceNote);assert.throws(()=>requireReference(html.replace('>Production reference</div>','>'+example.caption+'</div>')),'correct units alone cannot excuse the original misleading meat heading');}
});

test('native animal cards print complete source conditions, canonical months and original catalogue identities',()=>{
 const escaped=(s:string)=>renderToStaticMarkup(React.createElement('span',null,s)).slice(6,-7);
 for(const row of before.cases){const snapshot=JSON.stringify(row.props);for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const html=markup(current,language,row.props);assert.deepEqual(numbers(plain(html)),numbers(plain(row.markup[language])),row.id+' '+language+' must retain every human-readable figure in its original order');assert.ok(html.includes(escaped(productGuideText('Animals on your map',language))));assert.ok(html.includes(escaped(productGuideText('These confirmations are kept on this device for this design.',language))));for(const group of row.props.groups){for(const e of Object.values(ANIMAL_ENTERPRISES).filter(e=>row.props.choices[group.housing]===e.enterpriseId)){assert.ok(html.includes(escaped(e.name)),'the original catalogue identity remains available on the native choice');for(const field of ['outputPerAnimal','weeksToFirstProduct','productiveLifeYears','feedKgPerDay','waterLPerDay','spaceM2']as const){const qualifier=animalReferenceQualifier(e,field);if(qualifier)assert.ok(html.includes(escaped(productGuideText(qualifier,language))),'a complete stage/system restriction must reach the actual card');}if(e.seasonalPattern)assert.ok(html.includes(escaped(productGuideText(e.seasonalPattern.text,language))),'the complete seasonal limitation must remain visible');if(isFoodProduct(e.product))for(let m=1;m<=12;m++){assert.ok(html.includes('aria-label="'+escaped(recordsMonthLong(language,m))+'"'));assert.ok(html.includes('>'+escaped(recordsMonthShort(language,m))+'</button>'));}}}assert.equal(JSON.stringify(row.props),snapshot);}}
});

function probe(source:string,language:string,props:Props){const{Card}=animalControlPresenters(source,language),trace:unknown[][]=[];let renderer:TestRenderer.ReactTestRenderer;
 act(()=>{renderer=TestRenderer.create(React.createElement(Card,{...props,onChoose:(...args:unknown[])=>trace.push(['choose',...args]),onSeasonsChange:(...args:unknown[])=>trace.push(['months',...args])}));});
 const buttons=renderer!.root.findAllByType('button'),choices=buttons.filter(button=>button.props.style.minHeight===40),months=buttons.filter(button=>button.props.style.minWidth===44);for(const button of choices)act(()=>button.props.onClick());for(const button of months)if(!button.props.disabled)act(()=>button.props.onClick());const monthState=months.map(button=>({pressed:button.props['aria-pressed'],disabled:button.props.disabled}));act(()=>renderer!.unmount());return{trace,monthState};}

test('translated choice and month buttons emit exactly the original identity, removal and sorted-month payloads',()=>{
 for(const row of before.cases){const snapshot=JSON.stringify(row.props),expected=probe(original,'en',row.props);for(const language of['en','xx',...CROP_EXPORT_DRAFT_LANGUAGES])assert.deepEqual(probe(current,language,row.props),expected,row.id+' '+language+' cannot persist a translated name or month label');assert.equal(JSON.stringify(row.props),snapshot);}
 const row=before.cases.find(row=>row.id==='chicken-layer-existing')!;const mutant=current.replace('on ? null : e.enterpriseId','e.name');assert.throws(()=>assert.deepEqual(probe(mutant,'st',row.props),probe(original,'en',row.props)),'a translated/renamed saved enterprise identity must fail even if every label still renders');
});

test('female-pig fact captions never reuse the crop sow verb and private source fields stay verbatim',()=>{
 const originalVerb=before.registry.find(row=>row.english==='sow')!;assert.deepEqual(CROP_EXPORT_COPY.find(row=>row.english==='sow'),originalVerb,'the crop planting verb stays unchanged');
 const pigNouns={zu:'ngulube',st:'kolobe',ts:'nguluve',ve:'nguluvhe'};
 for(const language of CROP_EXPORT_DRAFT_LANGUAGES){for(const kind of['Feed','Water','Space']){const caption=productGuideText(kind+' per sow',language);assert.ok(caption.includes(pigNouns[language]));assert.ok(!caption.includes(originalVerb[language]),'an animal denominator cannot become a planting instruction');}
  const{EnterpriseFacts}=animalControlPresenters(current,language),e=ANIMAL_ENTERPRISES.bees,privateValues=['sow','hive','When','Production reference','PRIVATE {citation} $& <kept> 03.50'];for(const value of privateValues){const altered:AnimalEnterprise={...e,name:value,animalUnit:value,outputUnit:value,outputPerAnimal:e.outputPerAnimal?{...e.outputPerAnimal,note:value}:null,welfare:[{...e.welfare[0],point:value}]},snapshot=JSON.stringify(altered),html=renderToStaticMarkup(React.createElement(EnterpriseFacts,{e:altered})),escaped=renderToStaticMarkup(React.createElement('span',null,value)).slice(6,-7);assert.ok(html.includes(escaped),'an edited known-looking field must remain source text');assert.ok(!html.includes('<p lang="en" class="mt-1">'+escaped+'</p>'),'edited care text must not pretend it received a source-bound draft');assert.equal(JSON.stringify(altered),snapshot);}
  const{SourceLink}=animalControlPresenters(current,language),citation={doc:'PRIVATE {citation} $& <kept> 03.50',quote:'Exact source quotation {citation} $& <kept>',url:'https://example.invalid/source?original=1',page:'03'},html=renderToStaticMarkup(React.createElement(SourceLink,{source:citation,short:true}));assert.ok(html.includes('https://example.invalid/source?original=1'));assert.ok(html.includes('{citation} $&amp; &lt;kept&gt; 03.50, p. 03'));assert.ok(!html.includes('<kept>'));
 }
});


test('long native source units retain every character while the measured phone column can wrap',()=>{
 const source=read('components/crops/AnimalEnterprisesCard.tsx'),packet=JSON.parse(read('docs/translation/four-language-completion/animal-control-drafts.json'));
 const wrap=packet.sourceChanges.find((edit:{after:string})=>edit.after.includes("overflowWrap: isCropExportDraftLanguage(lang)"));assert.ok(wrap,'the exact measured native-value wrap must be recorded');
 const verify=(text:string)=>assert.ok(text.includes(wrap.after),'native long units need their measured wrapping rule');verify(source);assert.throws(()=>verify(source.replace(wrap.after,wrap.before)),'complete units alone must not pass after removing the phone wrap');
 for(const language of ['en','xx',...CROP_EXPORT_DRAFT_LANGUAGES]){const actual=animalControlPresenters(source,language).Fact,html=renderToStaticMarkup(React.createElement(actual,{label:'Reference',value:'775.4–1073.4 kg wobisi/ngembuzikazi/ngesikhathi sokuncelisa sezinsuku ezingu-305'}));assert.equal(html.includes('overflow-wrap:anywhere'),CROP_EXPORT_DRAFT_LANGUAGES.includes(language as any));assert.ok(html.includes('775.4–1073.4 kg wobisi/ngembuzikazi/ngesikhathi sokuncelisa sezinsuku ezingu-305'),'wrapping must not abbreviate or remove a source dimension');}
});
