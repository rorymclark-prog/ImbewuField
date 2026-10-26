import {applyExpectedTreeCareGuide} from './helpers/tree-care-expectation.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {CROP_EXPORT_COPY} from '../lib/crop-export-copy-data.ts';
import {CROP_EXPORT_DRAFT_LANGUAGES} from '../lib/crop-export-copy.ts';
import {buildProductGuidance,productPurchasingMarkdown,productGuideText,PRODUCT_PROFILES,type ProductGuideContext} from '../lib/production-product-guidance.ts';
import type {ProductionGuideItem} from '../lib/crop-export-schedule.ts';
import type {GrowingZoneId} from '../lib/growing-zones.ts';
import type {SiteProductionConditions} from '../lib/site-survey.ts';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const p=JSON.parse(read('docs/translation/four-language-completion/tree-product-drafts.json'))as{status:string;sourceCount:number;rows:Array<Record<string,string>>;sourceBindings:Array<{english:string;identities:string[]}>};
const packed=readFileSync(new URL('./fixtures/tree-product-translation/before.json.gz',import.meta.url)),raw=gunzipSync(packed),before=JSON.parse(raw.toString())as{registry:typeof CROP_EXPORT_COPY;profiles:typeof PRODUCT_PROFILES;sources:Array<{file:string;source:string;sha256:string}>;rows:Array<{id:string;context:ProductGuideContext;zones:GrowingZoneId[];conditions?:SiteProductionConditions;outputs:Record<string,ReturnType<typeof buildProductGuidance>>;markdown:Record<string,string>}>};
const frame='{existing} existing; {proposed} proposed. Products: {products}.',numberTokens=(s:string)=>s.match(/\d+(?:[.,]\d+)?/g)??[];
function expectedGuide(row:typeof before.rows[number],language:string){
 const expected=structuredClone(row.outputs[language]);
 for(const[index,group]of row.context.trees.entries()){
  const h=group.harvest,profile=before.profiles[h.speciesId]??h.productionGuidance,product=profile?.products??h.product,draft=p.rows.find(row=>row.english===product);
  if(!draft||!CROP_EXPORT_DRAFT_LANGUAGES.some(l=>l===language))continue;
  assert.ok(p.sourceBindings.find(binding=>binding.english===product)?.identities.includes(h.speciesId),'a changed field must belong to its captured product identity');
  const values={existing:group.existing,proposed:group.proposed,products:product.replace(/\.$/,'')};
  assert.equal(expected.foodForest[index].lines[0],productGuideText(frame,language,values),'the original complete first line must occupy its captured position');
  expected.foodForest[index].lines[0]=productGuideText(frame,language,{...values,products:draft[language].replace(/\.$/,'')});
 }
 applyExpectedTreeCareGuide(expected.foodForest,row.context,language);
 return expected;
}
function expectedMarkdown(row:typeof before.rows[number],language:string,expected:ReturnType<typeof buildProductGuidance>){
 let text=row.markdown[language];const block=(item:ProductionGuideItem)=>['### '+item.title,...item.lines,...(item.sources??[]).map(source=>productGuideText('Source: [{label}]({url})',language,{label:source.label,url:String(source.url)}))].join('\n\n');
 for(const[index,item]of expected.foodForest.entries()){
  const old=block(row.outputs[language].foodForest[index]),next=block(item);if(old===next)continue;
  assert.equal(text.split(old).length-1,1,'only the full original species section may change');text=text.replace(old,next);
 }return text;
}

test('product drafts retain every captured source byte, inherited row, food-use gate and scientific identity',()=>{
 const manifest=JSON.parse(read('tests/fixtures/tree-product-translation/capture-manifest.json'));assert.equal(hash(packed),manifest.compressedSha256);assert.equal(hash(raw),manifest.uncompressedSha256);assert.deepEqual(PRODUCT_PROFILES,before.profiles);
 for(const source of before.sources){assert.equal(hash(source.source),source.sha256);if(source.file!=='lib/crop-export-copy-data.ts')assert.equal(read(source.file),source.source,'translation cannot edit an existing source, renderer, selector or UI component');}
 assert.deepEqual(CROP_EXPORT_COPY.slice(0,before.registry.length),before.registry);assert.deepEqual(CROP_EXPORT_COPY.slice(before.registry.length,before.registry.length+p.rows.length),p.rows);assert.equal(new Set(CROP_EXPORT_COPY.map(row=>row.english)).size,CROP_EXPORT_COPY.length);
 assert.match(p.status,/IN PROGRESS.*Unreviewed/);assert.equal(p.sourceCount,21);assert.equal(p.rows.length,p.sourceBindings.length);
 const context=before.rows.find(row=>row.context.trees.length===103)!.context;
 for(const[index,row]of p.rows.entries()){
  const binding=p.sourceBindings[index];assert.equal(binding.english,row.english);
  for(const id of binding.identities){const g=context.trees.find(g=>g.harvest.speciesId===id);assert.ok(g,'drafts cannot introduce a plant');const profile=before.profiles[id]??g.harvest.productionGuidance;assert.equal(profile?.products??g.harvest.product,row.english,'binding must identify the complete typed product field');}
  for(const language of CROP_EXPORT_DRAFT_LANGUAGES){assert.equal(productGuideText(row.english,language),row[language]);assert.notEqual(row[language],row.english);assert.deepEqual(numberTokens(row[language]),numberTokens(row.english));assert.deepEqual(row[language].match(/\{\w+\}/g)??[],row.english.match(/\{\w+\}/g)??[]);assert.ok(!/[\u0400-\u04ff\u00ad\ufffd]/.test(row[language]));if(row.english.includes('wild-olive'))assert.ok(row[language].includes('wild-olive'),'source plant descriptor stays identifiable without inventing a vernacular species identity');}
 }
});

test('complete guides and purchasing text preserve every field outside declared product and bound care/purchase drafts in all captured growing conditions',()=>{
 let fields=0;for(const row of before.rows){const snapshot=JSON.stringify(row.context);
  for(const language of['en','xx',...CROP_EXPORT_DRAFT_LANGUAGES]){const expected=expectedGuide(row,language),actual=buildProductGuidance(row.context,row.zones,row.conditions,language);assert.deepEqual(actual,expected,'all complete conditions, citations, legal source statements, ages, figures and inventory stay in the comparison');assert.equal(productPurchasingMarkdown(row.context,row.zones,row.conditions,language),expectedMarkdown(row,language,expected));if(CROP_EXPORT_DRAFT_LANGUAGES.some(l=>l===language))fields+=expected.foodForest.filter((item,i)=>item.lines[0]!==row.outputs[language].foodForest[i].lines[0]).length;}
  assert.equal(JSON.stringify(row.context),snapshot);
 }assert.ok(fields>=22*4*15,'the source fixture must exercise every bound product through all climate and observation gates');
});

test('missing or clipped exclusions, review requirements and processing distinctions cannot pass a complete product-field comparison',()=>{
 const row=before.rows.find(row=>row.id==='trees-subtropical-coast')!;
 for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const expected=expectedGuide(row,language),requireWhole=(got:typeof expected)=>assert.deepEqual(got,expected);
  for(const source of ['edible berries; roots excluded','traditionally prepared leaves/fruit — specialist review needed','fresh rhizomes; dried ginger recorded separately','leaf brewing flavour — specialist use']){const binding=p.sourceBindings.find(binding=>binding.english===source)!,index=row.context.trees.findIndex(g=>g.harvest.speciesId===binding.identities[0]);assert.ok(index>=0);const text=p.rows.find(r=>r.english===source)![language];assert.ok(expected.foodForest[index].lines[0].includes(text));for(const replacement of ['',text.slice(0,-12),source]){const bad=structuredClone(expected);bad.foodForest[index].lines[0]=bad.foodForest[index].lines[0].replace(text,replacement);assert.throws(()=>requireWhole(bad),'a heading, partial translation or English fallback cannot replace the complete product condition');}}
 }
});

test('private product words, braces and household holds remain unchanged when interface language changes',()=>{
 const g=structuredClone(before.rows.find(row=>row.context.trees.length===103)!.context.trees.find(g=>g.harvest.speciesId==='lycium-cinereum')!),privateValue='PRIVATE {products} $& <kept> 03.50';
 g.harvest={...g.harvest,speciesId:'private-existing-identity',product:privateValue,productionGuidance:{products:privateValue,care:[privateValue],purchase:[privateValue]}};
 const context:ProductGuideContext={trees:[g],animals:[]},snapshot=JSON.stringify(context),source=buildProductGuidance(context,[]);
 for(const language of CROP_EXPORT_DRAFT_LANGUAGES){const guide=buildProductGuidance(context,[],undefined,language);assert.ok(guide.foodForest[0].lines[0].includes(privateValue));assert.ok(guide.foodForest[0].lines.includes(privateValue));assert.ok(guide.foodForest[0].lines.some(line=>line.includes(privateValue)&&line!==privateValue));assert.equal(guide.foodForest[0].title,source.foodForest[0].title);assert.deepEqual(guide.foodForest[0].sources,source.foodForest[0].sources);assert.equal(guide.foodForest[0].expectedSeason,undefined,'held household-food status cannot be lifted by a product translation');assert.equal(productGuideText(privateValue,language),privateValue);assert.equal(JSON.stringify(context),snapshot);}
});
