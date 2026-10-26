import {ANIMAL_ENTERPRISES} from '../lib/animal-enterprises.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {CROP_EXPORT_COPY} from '../lib/crop-export-copy-data.ts';
import {CROP_EXPORT_DRAFT_LANGUAGES} from '../lib/crop-export-copy.ts';
import {PRODUCT_PROFILES,productGuideText,buildProductGuidance,productPurchasingMarkdown,type ProductGuideContext} from '../lib/production-product-guidance.ts';
import {perennialHarvestFor} from '../lib/perennial-harvest.ts';
import {recordsMonthLong} from '../lib/records-months.ts';
import type {ProductionGuideItem} from '../lib/crop-export-schedule.ts';
import type {GrowingZoneId} from '../lib/growing-zones.ts';
import type {SiteProductionConditions} from '../lib/site-survey.ts';
import {applyExpectedSourceReferences} from './helpers/source-reference-expectation.ts';
const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8'),hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex'),packed=readFileSync(new URL('./fixtures/source-reference-translation/before.json.gz',import.meta.url)),raw=gunzipSync(packed),before=JSON.parse(raw.toString())as{registry:unknown[];profiles:typeof PRODUCT_PROFILES;sources:Array<{file:string;source:string;sha256:string}>;bindings:Array<{english:string;fields:Array<{speciesId:string;referenceIndex:number;field:'title'|'note'}>}>;rows:Array<{id:string;context:ProductGuideContext;zones:GrowingZoneId[];conditions?:SiteProductionConditions;outputs:Record<string,ReturnType<typeof buildProductGuidance>>;markdown:Record<string,string>}>};
const packet=JSON.parse(read('docs/translation/four-language-completion/source-reference-drafts.json'))as{status:string;applied:boolean;rows:Array<Record<string,string>>;fieldBindings:typeof before.bindings;classifications:Array<{english:string;decision:string;fields:string[]}>;monthBindings:Array<{english:string;months:Array<{month:number;occurrences:number}>}>};
const digits=(v:string)=>v.match(/\d+(?:[.,]\d+)?/g)??[];
function expected(row:typeof before.rows[number],language:string){const guide=structuredClone(row.outputs[language]);applyExpectedSourceReferences(guide.foodForest,row.context,language);return guide;}
function expectedMarkdown(row:typeof before.rows[number],language:string,guide:ReturnType<typeof buildProductGuidance>){let value=row.markdown[language];const block=(item:ProductionGuideItem)=>['### '+item.title,...item.lines,...(item.sources??[]).map(source=>productGuideText('Source: [{label}]({url})',language,{label:source.label,url:String(source.url)}))].join('\n\n');for(const[index,item]of guide.foodForest.entries()){const old=block(row.outputs[language].foodForest[index]),next=block(item);if(old===next)continue;assert.equal(value.split(old).length-1,1,'the complete original species section must remain uniquely bound');value=value.replace(old,next);}return value;}

test('reference drafts preserve every captured source byte, original identity, reference index, citation and inherited copy row',()=>{
 const manifest=JSON.parse(read('tests/fixtures/source-reference-translation/capture-manifest.json'));assert.equal(hash(packed),manifest.compressedSha256);assert.equal(hash(raw),manifest.uncompressedSha256);assert.equal(packet.applied,true);assert.match(packet.status,/IN PROGRESS.*Unreviewed/);assert.deepEqual(PRODUCT_PROFILES,before.profiles);
 for(const source of before.sources){assert.equal(hash(source.source),source.sha256);if(source.file!=='lib/crop-export-copy-data.ts')assert.equal(read(source.file),source.source,'reference drafts cannot change sources,models,renderers,selectors or controls');}
 assert.deepEqual(packet.fieldBindings,before.bindings);assert.equal(packet.rows.length,136);assert.equal(new Set(packet.rows.map(row=>row.english)).size,packet.rows.length);assert.deepEqual(CROP_EXPORT_COPY.slice(0,before.registry.length),before.registry);assert.deepEqual(CROP_EXPORT_COPY.slice(before.registry.length,before.registry.length+packet.rows.length),packet.rows);assert.deepEqual(JSON.parse(read('docs/translation/four-language-completion/crop-export-drafts.json')).rows,CROP_EXPORT_COPY);
 let title=0,note=0;for(const binding of before.bindings){assert.ok(packet.rows.some(row=>row.english===binding.english));for(const field of binding.fields){assert.equal(perennialHarvestFor(field.speciesId)!.supplementaryReferences![field.referenceIndex][field.field],binding.english);if(field.field==='title')title++;else note++;}}
 assert.equal(title,62);assert.equal(note,74);assert.equal(new Set(CROP_EXPORT_COPY.map(row=>row.english)).size,CROP_EXPORT_COPY.length);
});

test('all source figures,physical unit bases,scientific/cultivar identities and actual calendar months survive complete drafts',()=>{
 const terms=['Lycium','Beaumont','Wet In Shell (WIS)','WIS','SAMAC','Langkloof','Little Karoo','sandy loam','Quantity','Kg','Morus','M. nigra','KZN','Williams','Grand Nain','Chinese Cavendish','Wild olive','Frantoio','Mission','Kalamata','Manzanilla','Barouni','SANBI','Hass','Duke 7','Bruyns Hill','Natal Midlands','Phytophthora','Kleinplasie','Hermon','Medjool','HTTP 403','Platberg','Shufra','Ariyeh','Sirora','Karoo','spekboom','Solitaire','Positive Utah Chill Units','Ceres','Texas Mission','Nonpareil','Production (kg/tree)','African Delight','Ruby Crisp','Infruitec Chilling Units','Bien Donne','Simondium','Western Cape','Rosmarinus officinalis','boer-bean','S. undulata','Northern/Western Cape','Bridelia micrantha','monkey-orange','Zimbabwe','Strychnos','spinosa','South Africa (general)','Benin','West Africa','PROTA','Pretoria Hillcrest','sandy clay loam','Z. officinale','African ginger','Methods','Florida'];
 for(const row of packet.rows)for(const language of CROP_EXPORT_DRAFT_LANGUAGES){assert.equal(productGuideText(row.english,language),row[language]);assert.notEqual(row[language],row.english);assert.deepEqual(digits(row[language]),digits(row.english));assert.deepEqual(row[language].match(/\{\w+\}/g)??[],row.english.match(/\{\w+\}/g)??[]);assert.ok(!/[\u0400-\u04ff\ufffd\u00ad]/.test(row[language]));for(const term of terms)if(row.english.includes(term))assert.ok(row[language].includes(term),language+' lost original source identity '+term);for(const unit of['kg/tree','kg/plant','kg/ha','t/ha','trees/ha','cartons/ha','kg/carton','vines/ha','kg/vine'])assert.equal(row[language].split(unit).length-1,row.english.split(unit).length-1,language+' changed the source dimension');}
 assert.equal(packet.monthBindings.length,19);for(const binding of packet.monthBindings){const row=packet.rows.find(row=>row.english===binding.english)!;for(const month of binding.months)for(const language of CROP_EXPORT_DRAFT_LANGUAGES)assert.equal(row[language].split(recordsMonthLong(language,month.month)).length-1,month.occurrences,'a real source month cannot become another month or cultivar name');}
 const six=packet.rows.find(row=>row.english==='Production at age six')!;for(const[language,word]of Object.entries({zu:'eyisithupha',st:'tsheletseng',ts:'tsevu',ve:'rathi'}))assert.ok(six[language].includes(word),'source word age remains six');
 const sevenEight=packet.rows.find(row=>row.english.startsWith('The author abstract recommends'))!,eight=packet.rows.find(row=>row.english.startsWith('Pretoria Hillcrest rain-shelter'))!,sixMonths=packet.rows.find(row=>row.english.startsWith('SANBI describes dry,'))!;for(const[language,words]of Object.entries({zu:['eziyisikhombisa','eziyisishiyagalombili','eziyisithupha'],st:['supileng','robedi','tsheletseng'],ts:['nkombo','nhungu','tsevu'],ve:['sumbe','malo','rathi']})){assert.ok(sevenEight[language].includes(words[0])&&sevenEight[language].includes(words[1]));assert.ok(eight[language].includes(words[1]));assert.ok(sixMonths[language].includes(words[2]));}
});

test('complete guides and purchasing sections change only the declared whole reference titles and notes through every captured climate and observation gate',()=>{
 let fields=0;for(const row of before.rows){const snapshot=JSON.stringify(row.context);for(const language of['en','xx',...CROP_EXPORT_DRAFT_LANGUAGES]){const want=expected(row,language),got=buildProductGuidance(row.context,row.zones,row.conditions,language);assert.deepEqual(got,want,'all source conditions,food holds,model output,ordering,source citations and fields remain compared');assert.equal(productPurchasingMarkdown(row.context,row.zones,row.conditions,language),expectedMarkdown(row,language,want));if(CROP_EXPORT_DRAFT_LANGUAGES.some(l=>l===language))fields+=want.foodForest.reduce((n,item,i)=>n+item.lines.filter((line,j)=>line!==row.outputs[language].foodForest[i].lines[j]).length,0);}assert.equal(JSON.stringify(row.context),snapshot);}assert.ok(fields>=74*4*15,'each source paragraph must be exercised in every complete climate context');
});

test('retaining headings and numbers cannot hide a lost final condition,wrong source geography or English note fallback',()=>{
 const row=before.rows.find(row=>row.id==='trees-subtropical-coast')!;for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const want=expected(row,language),requireWhole=(got:typeof want)=>assert.deepEqual(got,want);for(const prefix of['The checked primary assessment','Langkloof, Little Karoo, sandy loam:','Hass on Duke 7','Conventional commercial cherry reference','The review states August–December','The 2021 review','Pretoria Hillcrest rain-shelter','The author abstract recommends']){const binding=before.bindings.find(binding=>binding.english.startsWith(prefix))!,field=binding.fields[0],index=row.context.trees.findIndex(g=>g.harvest.speciesId===field.speciesId),reference=row.context.trees[index].harvest.supplementaryReferences![field.referenceIndex],line=productGuideText(reference.title,language)+': '+productGuideText(reference.note,language),at=want.foodForest[index].lines.indexOf(line);assert.ok(at>=0,'exercise the actual complete bound paragraph');for(const replacement of[line.slice(0,-30),productGuideText(reference.title,language)+': '+reference.note,productGuideText(reference.title,language)+': '+digits(reference.note).join(' ')]){const bad=structuredClone(want);bad.foodForest[index].lines[at]=replacement;assert.throws(()=>requireWhole(bad),'headings,figures or English cannot replace the complete native condition');}}}
});

test('location and cultivar labels remain exact source identities and cannot silently acquire different windows or plant names',()=>{
 assert.equal(packet.classifications.length,3);const context=before.rows.find(row=>row.context.trees.length===103)!.context;for(const identity of packet.classifications){assert.match(identity.decision,/Retain exact proper/);for(const id of identity.fields){const group=context.trees.find(group=>group.harvest.speciesId===id)!;assert.ok(group.harvest.windows.some(window=>window.region===identity.english));for(const language of CROP_EXPORT_DRAFT_LANGUAGES){assert.equal(productGuideText(identity.english,language),identity.english);const source=buildProductGuidance({trees:[group],animals:[]},[]),native=buildProductGuidance({trees:[group],animals:[]},[],undefined,language);assert.deepEqual(native.foodForest[0].expectedSeason,source.foodForest[0].expectedSeason);assert.equal(native.foodForest[0].title,source.foodForest[0].title);assert.deepEqual(native.foodForest[0].sources,source.foodForest[0].sources);}}}
});

test('a private name matching a new reference heading,raw citation labels,unknown notes and brace/dollar values stay recorded',()=>{
 const group=structuredClone(before.rows.find(row=>row.context.trees.length===103)!.context.trees.find(group=>group.harvest.speciesId==='lycium-cinereum')!),privateName='Harvest recommendation',privateValue='PRIVATE {month2} {name} $& <kept> 03.50';group.harvest={...group.harvest,name:privateName,speciesId:'private-existing-identity',product:privateValue,productionGuidance:{products:privateValue,care:[privateValue],purchase:[privateValue]},supplementaryReferences:[{title:privateValue,note:privateValue,source:{doc:privateValue,url:'https://example.invalid/{month2}/$&',page:17,quote:privateValue}}]};const context:ProductGuideContext={trees:[group],animals:[]},snapshot=JSON.stringify(context),source=buildProductGuidance(context,[]);for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const guide=buildProductGuidance(context,[],undefined,language),item=guide.foodForest[0];assert.equal(item.title,privateName);assert.ok(item.lines.includes(privateValue+': '+privateValue));assert.deepEqual(item.sources,source.foodForest[0].sources);assert.equal(item.expectedSeason,undefined,'new reference drafts cannot lift the household-food hold');assert.equal(JSON.stringify(context),snapshot);}assert.deepEqual(buildProductGuidance(context,[],undefined,'xx'),source);
});

// The scope is authored typed guidance,not all UI. A new ordinary English note
// must fail this rule even when every current catalogue identity still exists.
test('the bounded authored-guidance inventory leaves only explicitly retained proper location/cultivar identities in English',()=>{
 const context=before.rows.find(row=>row.context.trees.length===103)!.context,values=new Set<string>();const add=(value:unknown)=>{if(typeof value==='string'&&value.trim())values.add(value);};for(const group of context.trees){const h=group.harvest,profile=PRODUCT_PROFILES[h.speciesId]??h.productionGuidance;add(profile?.products??h.product);for(const field of ['care','purchase']as const)for(const text of profile?.[field]??[])add(text);for(const field of ['yearsToFirstCrop','yearsToFullBearing','yieldKgPerTree']as const)add(h[field]?.note);for(const ref of h.supplementaryReferences??[]){add(ref.title);add(ref.note);}for(const window of h.windows)add(window.region);}
 for(const enterprise of Object.values(ANIMAL_ENTERPRISES)){for(const field of ['welfare','legal','productionReferences']as const)for(const point of enterprise[field]??[])add(point.point);for(const field of ['weeksToFirstProduct','outputPerAnimal','productiveLifeYears']as const)add(enterprise[field]?.note);add(enterprise.seasonalPattern?.text);add(enterprise.outputUnit);}
 const requireInventory=(sources:Iterable<string>)=>{const remaining=[...sources].filter(source=>CROP_EXPORT_DRAFT_LANGUAGES.some(language=>productGuideText(source,language)===source)).sort();assert.deepEqual(remaining,packet.classifications.map(row=>row.english).sort(),'ordinary source prose needs complete drafts in all4languages;only declared identities pass through');};requireInventory(values);assert.throws(()=>requireInventory([...values,'A new untranslated source condition.']),'the coverage check must notice new source prose');
});


import {jsPDF} from 'jspdf';
import {registerReportPdfFont,reportPdfText} from '../lib/report-pdf-font.ts';
import {drawCropPlanPages,type CropPlanPdfInput} from '../lib/crop-export-pdf.ts';
import {originalSourceReferenceFont,sourceReferenceFontBefore} from './helpers/source-reference-font-expectation.ts';
test('native crop PDFs retain complete registered cultivar source notes and meaningful markers while decorative emoji still disappear',async()=>{
 assert.equal(hash(sourceReferenceFontBefore.source),sourceReferenceFontBefore.sha256);
 assert.equal(originalSourceReferenceFont(read('lib/report-pdf-font.ts')),sourceReferenceFontBefore.source);
 const changed=originalSourceReferenceFont(read('lib/report-pdf-font.ts').replace("'ImbewuSans-Regular.ttf', regular.default","'Unexpected.ttf', regular.default"));
 assert.notEqual(hash(changed),sourceReferenceFontBefore.sha256,'unrelated font changes must still fail the ancestor whole-source guard');
 const oldText=new Function('text',sourceReferenceFontBefore.source.slice(sourceReferenceFontBefore.source.indexOf('  return text.normalize'),sourceReferenceFontBefore.source.lastIndexOf('}')))as(text:string)=>string;
 const markers='African Delight® · © · ™ · Ṱanḓa · 12.5 m² · 2 500 L';
 assert.notEqual(oldText(markers),markers,'the captured old filter must reproduce the observed source loss');
 assert.equal(reportPdfText('🌱 '+markers+' 👩‍🌾'),markers);
 const row=before.rows.find(row=>row.context.trees.length===103)!,group=row.context.trees.find(g=>JSON.stringify(g.harvest).includes('African Delight®'))!;
 assert.ok(group,'exercise the existing source identity rather than an invented plant name');
 const base=JSON.parse(read('tests/fixtures/guidance-translation/pdf-inputs-before.json'))[0].input;
 for(const language of CROP_EXPORT_DRAFT_LANGUAGES){
  const guide=buildProductGuidance({trees:[group],animals:[]},row.zones,row.conditions,language),clause=guide.foodForest[0].lines.find(line=>line.includes('African Delight®'))!;
  assert.ok(clause);assert.ok(!oldText(clause).includes('African Delight®'));
  const input:CropPlanPdfInput={...base,now:new Date(base.now),meta:{...base.meta,language},productionGuide:{area:'Source marker review',siteObservations:[],recordedProduction:[],cropChoices:[],foodForest:guide.foodForest},poultryGuidance:undefined};
  const snapshot=JSON.stringify(input),doc=new jsPDF({unit:'pt',format:'a4'}),font=await registerReportPdfFont(doc),painted:string[]=[];
  for(const style of ['normal','bold']){doc.setFont(font,style);const glyph=doc.getFont().metadata as unknown as{characterToGlyph:(code:number)=>number};for(const marker of '®©™')assert.ok(glyph.characterToGlyph(marker.codePointAt(0)!),style+' source marker needs a real font glyph');}
  const text=doc.text.bind(doc);doc.text=((...args:unknown[])=>{painted.push((Array.isArray(args[0])?args[0].map(String):[String(args[0])]).join(' '));return(text as(...args:unknown[])=>jsPDF)(...args);})as typeof doc.text;
  drawCropPlanPages(doc,input,false,{language,font});
  const flat=(value:string)=>value.normalize('NFC').replace(/\s/g,'');
  assert.ok(flat(painted.join(' ')).includes(flat(clause)),'the complete native source paragraph must survive the actual PDF painter');
  assert.equal(JSON.stringify(input),snapshot);
 }
});
