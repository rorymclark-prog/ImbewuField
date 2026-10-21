import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import { PERENNIAL_HARVEST, firstCropAgeLabel, type PerennialHarvest } from '../lib/perennial-harvest.ts';
import { PRODUCT_GUIDE_COPY, PRODUCT_FIRST_CROP_COPY, productGuideText, buildProductGuidance, productPurchasingMarkdown } from '../lib/production-product-guidance.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const packet=JSON.parse(read('docs/translation/four-language-completion/first-crop-drafts.json'));
const baseline=JSON.parse(read('tests/fixtures/product-profile-translation/source-cases.json'));
const languages=['zu','st','ts','ve']as const;
const figures=(s:string)=>(s.match(/\d+(?:[.,]\d+)?/g)??[]).sort();
const tokens=(s:string)=>(s.match(/\{\w+\}/g)??[]).sort();
const template='First crop reference: {age}. {note} Actual timing depends on variety and site care.';
const missing='Time to first crop: not sourced; do not rely on newly planted stock for immediate food.';
const fallback='Check the source conditions and starting stock.';
const refs=(source:Record<string,PerennialHarvest>)=>Object.entries(source).filter(([,h])=>h.yearsToFirstCrop?.note).map(([id,h])=>({english:h.yearsToFirstCrop!.note!,paths:[id+'.yearsToFirstCrop.note']}));

test('first-crop drafts bind every original note, figure and placeholder to a pre-edit source packet while leaving verified source data intact',()=>{
 assert.match(packet.status,/Unreviewed AI drafts/);
 assert.equal(crypto.createHash('sha256').update(read('lib/perennial-harvest-data.ts')).digest('hex'),packet.sourceDataSha256,'translating a note must not rewrite the verified source data');
 assert.deepEqual(refs(PERENNIAL_HARVEST),packet.entries.filter((r:any)=>r.paths).map(({english,paths}:any)=>({english,paths})));
 assert.deepEqual(PRODUCT_FIRST_CROP_COPY,packet.entries.map(({english,zu,st,ts,ve}:any)=>({english,zu,st,ts,ve})));
 assert.equal(new Set([...PRODUCT_GUIDE_COPY,...PRODUCT_FIRST_CROP_COPY].map(r=>r.english)).size,PRODUCT_GUIDE_COPY.length+PRODUCT_FIRST_CROP_COPY.length,'a source has one wording authority');
 for(const row of PRODUCT_FIRST_CROP_COPY)for(const lang of languages){assert.equal(productGuideText(row.english,lang),row[lang]);assert.notEqual(row[lang],row.english);assert.deepEqual(figures(row[lang]),figures(row.english));assert.deepEqual(tokens(row[lang]),tokens(row.english));}
 function audit(harvests:Record<string,PerennialHarvest>){for(const {english}of refs(harvests))for(const lang of languages)assert.notEqual(productGuideText(english,lang),english,'unregistered first-crop reference');}
 audit(PERENNIAL_HARVEST);
 const plant=PERENNIAL_HARVEST['persea-americana'];assert.throws(()=>audit({...PERENNIAL_HARVEST,changed:{...plant,yearsToFirstCrop:{...plant.yearsToFirstCrop!,note:'A new unregistered first-crop claim.'}}}),/unregistered first-crop reference/);
});

test('one age conversion supplies both the original English label and translated unit formatting, including the month/year boundary',()=>{
 const ranges:Array<[number,number]>=[[0.5,0.67],[13/12,20/12],[1,1],[1,1.99],[1,2],[3,4],[5,5]];
 for(const range of ranges){let value='',unit='';const label=firstCropAgeLabel(range,(age,u)=>{value=age;unit=u;return age+' '+u;});assert.equal(label,firstCropAgeLabel(range));assert.equal(unit,range[1]<2?'months':'years');for(const lang of languages){const native=firstCropAgeLabel(range,(age,u)=>productGuideText(`{age} ${u}`,lang,{age}));assert.equal(native,productGuideText(`{age} ${unit}`,lang,{age:value}));assert.deepEqual(figures(native),figures(label));}}
 assert.equal(firstCropAgeLabel([0.5,0.67]),'6–8 months');assert.equal(firstCropAgeLabel([1,2]),'1–2 years');
 const inserted=productGuideText(template,'ve',{age:'Saved {note}',note:'Saved {age}'});assert.ok(inserted.includes('Saved {note}'));assert.ok(inserted.includes('Saved {age}'),'inserted saved words cannot be interpreted as another placeholder');
});

test('every baseline first-crop guide line translates its complete note without changing site facts, seasons, sources or numbers',()=>{
 for(const c of baseline.cases){const context=baseline.contexts[c.context],before=JSON.stringify(context);
  for(const lang of['en','af','unknown',...languages]){
   const guide=buildProductGuidance(context,c.zones,c.conditions,lang),native=languages.includes(lang as any);
   for(const[index,item]of guide.foodForest.entries()){
    const h=context.trees[index].harvest,reference=h.yearsToFirstCrop,at=c.guide.foodForest[index].lines.findIndex((line:string)=>line.startsWith('First crop reference:')||line.startsWith('Time to first crop:'));
    assert.ok(at>=0);const source=c.guide.foodForest[index].lines[at];
    if(!native)assert.equal(item.lines[at],source);
    else{
     const row=packet.entries.find((r:any)=>r.english===(reference?template:missing));assert.ok(row);
     const values:Record<string,string>=reference?{age:firstCropAgeLabel(reference.value,(age,unit)=>productGuideText(`{age} ${unit}`,lang,{age})),note:productGuideText(reference.note??fallback,lang)}:{};
     const expected=row[lang].replace(/\{(\w+)\}/g,(token:string,key:string)=>values[key]??token);
     assert.equal(item.lines[at],expected,lang+'/'+c.name);assert.notEqual(item.lines[at],source);assert.deepEqual(figures(item.lines[at]),figures(source));
     if(reference?.note)assert.ok(item.lines[at].includes(productGuideText(reference.note,lang)),'the full qualification is retained, not just a short native heading');
     assert.ok(productPurchasingMarkdown(context,c.zones,c.conditions,lang).includes(item.lines[at]));
    }
    assert.equal(item.title,c.guide.foodForest[index].title);assert.deepEqual(item.sources,c.guide.foodForest[index].sources);assert.deepEqual(item.expectedSeason,c.guide.foodForest[index].expectedSeason);
   }
  }
  assert.equal(JSON.stringify(context),before,'translation must not change source records');
 }
});

test('missing note wording remains explicit and named trial/cultivar/source identities survive each native first-crop note',()=>{
 const tree=baseline.contexts.trees.trees.find((t:any)=>t.harvest.speciesId==='persea-americana');assert.ok(tree);
 for(const lang of languages){const noNote=structuredClone(tree);delete noNote.harvest.yearsToFirstCrop.note;const guide=buildProductGuidance({trees:[noNote],animals:[]},[],undefined,lang);assert.ok(guide.foodForest[0].lines.some(line=>line.includes(productGuideText(fallback,lang))));}
 const identities:Record<string,string[]>={
  'ananas-comosus':['Hluhluwe'], 'aspalathus-linearis':['Cape'], 'carica-papaya':['KZN','Makhathini Flats'],
  'carya-illinoinensis':['KZN','Zululand/Lowveld'],'citrus-limon':['KZN'],'litchi-chinensis':['KZN'],'macadamia-integrifolia':['KZN'],
  'malus-domestica':['KZN','Dry Highland Sourveld'],'mangifera-indica':['KZN','Zululand','Valley Bushveld','Lowveld','Peach/Sabre'],
  'moringa-oleifera':['North West'],'musa-acuminata-aaa-group':['KZN DARD'],'passiflora-edulis':['KZN'],
  'persea-americana':['Bruyns Hill','Natal Midlands','Hass','Duke 7','Fuerte'],'prunus-persica':['KZN','Muden','Middelrus','Weenen'],
  'prunus-salicina':['African Delight®','ARC'],'psidium-guajava':['ICRAF'],'strychnos-spinosa':['Avakoudjo et al.','Benin'],'vaccinium-corymbosum':['USDA FAS'],
 };
 for(const[id,names]of Object.entries(identities))for(const lang of languages){const text=productGuideText(PERENNIAL_HARVEST[id].yearsToFirstCrop!.note!,lang);for(const name of names)assert.ok(text.includes(name),`${lang}/${id}: named identity ${name}`);}
});
