import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import { REPORT_VISUAL_COPY, reportVisualText } from '../lib/report-visuals.ts';
import { PERENNIAL_HARVEST, formatRange, type PerennialHarvest } from '../lib/perennial-harvest.ts';
import { PRODUCT_GUIDE_COPY, PRODUCT_FIRST_CROP_COPY, PRODUCT_YIELD_COPY, productGuideText, buildProductGuidance, productPurchasingMarkdown } from '../lib/production-product-guidance.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const packet=JSON.parse(read('docs/translation/four-language-completion/product-yield-drafts.json'));
const baseline=JSON.parse(read('tests/fixtures/product-profile-translation/source-cases.json'));
const languages=['zu','st','ts','ve']as const;
const figures=(s:string)=>s.match(/\d+(?:[.,]\d+)?/g)??[];
const tokens=(s:string)=>(s.match(/\{\w+\}/g)??[]).sort();
const fields=[
 ['yearsToFullBearing','Established production reference:','Established production reference: {range} years. {note}','Check cultivar, starting stock and growing conditions.'],
 ['yieldKgPerTree','Production reference:','Production reference: {range} kg/plant. {note}','This source result is not a locally confirmed annual forecast.'],
]as const;
function sourceRows(source:Record<string,PerennialHarvest>){const rows=new Map<string,{english:string;paths:string[]}>();for(const[id,h]of Object.entries(source))for(const[key]of fields){const note=h[key]?.note;if(!note)continue;const row=rows.get(note)??{english:note,paths:[]};row.paths.push(id+'.'+key+'.note');rows.set(note,row);}return[...rows.values()];}

test('all full-bearing and per-plant research drafts retain their pre-edit sources, figures in order and exact placeholders without rewriting verified data',()=>{
 assert.match(packet.status,/Unreviewed AI drafts/);assert.equal(crypto.createHash('sha256').update(read('lib/perennial-harvest-data.ts')).digest('hex'),packet.sourceDataSha256);
 assert.deepEqual(sourceRows(PERENNIAL_HARVEST),packet.entries.filter((r:any)=>r.paths).map(({english,paths}:any)=>({english,paths})));
 assert.deepEqual(PRODUCT_YIELD_COPY,packet.entries.map(({english,zu,st,ts,ve}:any)=>({english,zu,st,ts,ve})));
 const all=[...PRODUCT_GUIDE_COPY,...PRODUCT_FIRST_CROP_COPY,...PRODUCT_YIELD_COPY];assert.equal(new Set(all.map(r=>r.english)).size,all.length,'one source must not acquire competing draft authorities');
 for(const row of PRODUCT_YIELD_COPY)for(const lang of languages){assert.equal(productGuideText(row.english,lang),row[lang]);assert.notEqual(row[lang],row.english);assert.deepEqual(figures(row[lang]),figures(row.english),'source values/ranges and their order cannot change');assert.deepEqual(tokens(row[lang]),tokens(row.english));}
 function audit(harvests:Record<string,PerennialHarvest>){for(const{english}of sourceRows(harvests))for(const lang of languages)assert.notEqual(productGuideText(english,lang),english,'unregistered production reference');}
 audit(PERENNIAL_HARVEST);const plant=PERENNIAL_HARVEST['persea-americana'];assert.throws(()=>audit({...PERENNIAL_HARVEST,changed:{...plant,yieldKgPerTree:{...plant.yieldKgPerTree!,note:'A new unregistered annual production claim.'}}}),/unregistered production reference/);
});

test('original source arithmetic, unit dimensions and named trial/cultivar identities cannot be lost in the native explanation',()=>{
 const protectedParts:Record<string,string[]>={
  'carya-illinoinensis.yearsToFullBearing':['12–13','KZN'],
  'citrus-limon.yieldKgPerTree':['50 t/ha','KZN Midlands','5.75 x 2.75 m','79 kg/tree','7.5 x 3.5 m','131 kg/tree','50,000 kg/ha x m²/tree / 10,000 m²/ha'],
  'macadamia-integrifolia.yearsToFullBearing':['USDA FAS','7–9','15–20'],
  'malus-domestica.yearsToFullBearing':['KZN','Langkloof'],
  'persea-americana.yearsToFullBearing':['Natal Midlands','Hass','20 t/ha'],
  'persea-americana.yieldKgPerTree':['200 trees/ha','20,000 kg/ha / 200 = 100 kg/tree','22,500 kg/ha / 200 = 112.5 kg/tree','10,000 kg/ha / 200 = 50 kg/tree','Hass/Duke 7'],
  'prunus-persica.yieldKgPerTree':['Average','15-18 t/ha','Generally planted 6m x 4m or 5 m x 3 m','6x4m = 24 m²/tree → 10000/24 = 416.7 trees/ha → 15000kg/416.7=36.0','18000kg/416.7=43.2 kg/tree','5x3m = 15 m²/tree → 666.7 trees/ha → 15000/666.7=22.5','18000/666.7=27.0 kg/tree','[23, 43] kg/tree'],
  'psidium-guajava.yearsToFullBearing':['ICRAF'],
  'psidium-guajava.yieldKgPerTree':['ICRAF','50–70 kg/plant','30–40 kg/plant'],
  'punica-granatum.yearsToFullBearing':['Post-Harvest Innovation'],
  'sclerocarya-birrea-subsp-caffra.yieldKgPerTree':['ICRAF','200–1,500 kg','0.2–1.5 tonnes x 1,000'],
  'strychnos-spinosa.yieldKgPerTree':['40–100 kg','kg/year'],
  'vaccinium-corymbosum.yearsToFullBearing':['KZN','Vaccinium','rabbiteye','Tifblue','Beckyblue','Climax','southern highbush'],
 };
 for(const[path,parts]of Object.entries(protectedParts)){const[id,key]=path.split('.');const source=(PERENNIAL_HARVEST[id]as any)[key].note;for(const lang of languages){const text=productGuideText(source,lang);for(const part of parts)assert.ok(text.includes(part),`${lang}/${path}: original notation/identity ${part}`);}}
});

test('every baseline guide keeps the complete production qualifications, exact source values and all season/source/inventory decisions',()=>{
 for(const c of baseline.cases){const context=baseline.contexts[c.context],before=JSON.stringify(context);
  for(const lang of['en','af','unknown',...languages]){
   const guide=buildProductGuidance(context,c.zones,c.conditions,lang),native=languages.includes(lang as any),markdown=productPurchasingMarkdown(context,c.zones,c.conditions,lang);
   for(const[index,item]of guide.foodForest.entries()){
    const h=context.trees[index].harvest;
    for(const[key,prefix,template,fallback]of fields){const reference=h[key];if(!reference)continue;const at=c.guide.foodForest[index].lines.findIndex((line:string)=>line.startsWith(prefix));assert.ok(at>=0);const source=c.guide.foodForest[index].lines[at];
     if(!native)assert.equal(item.lines[at],source);
     else{const row=packet.entries.find((r:any)=>r.english===template),note=productGuideText(reference.note??fallback,lang),values:Record<string,string>={range:formatRange(reference.value),note};assert.ok(row);assert.equal(item.lines[at],row[lang].replace(/\{(\w+)\}/g,(token:string,key:string)=>values[key]??token));assert.ok(item.lines[at].includes(note),'the whole source qualification remains, not only a native label');assert.notEqual(item.lines[at],source);assert.deepEqual(figures(item.lines[at]),figures(source));assert.ok(markdown.includes(item.lines[at]));}
    }
    assert.equal(item.title,c.guide.foodForest[index].title);assert.deepEqual(item.sources,c.guide.foodForest[index].sources);assert.deepEqual(item.expectedSeason,c.guide.foodForest[index].expectedSeason);
   }
  }
  assert.equal(JSON.stringify(context),before);
 }
});

test('missing source notes keep explicit cautions while absent ranges cannot acquire an invented age or per-plant quantity',()=>{
 const tree=baseline.contexts.trees.trees.find((g:any)=>g.harvest.speciesId==='persea-americana');assert.ok(tree);
 for(const lang of languages){const missing=structuredClone(tree);for(const[key]of fields)delete missing.harvest[key].note;
  const guide=buildProductGuidance({trees:[missing],animals:[]},[],undefined,lang);
  for(const[, ,template,fallback]of fields){const prefix=productGuideText(template,lang).split('{range}')[0];assert.ok(guide.foodForest[0].lines.some(line=>line.startsWith(prefix)&&line.includes(productGuideText(fallback,lang))));}
  const absent=structuredClone(tree);for(const[key]of fields)absent.harvest[key]=null;const none=buildProductGuidance({trees:[absent],animals:[]},[],undefined,lang);
  for(const[,,template]of fields){const prefix=productGuideText(template,lang).split('{range}')[0];assert.ok(!none.foodForest[0].lines.some(line=>line.startsWith(prefix)),'no source range means no display line or invented value');}
  const inserted=productGuideText(fields[1][2],lang,{range:'Saved {note}',note:'Saved {range}'});assert.ok(inserted.includes('Saved {note}'));assert.ok(inserted.includes('Saved {range}'),'interpolated source/user words are never processed a second time');
 }
});


test('quantitative forecast cautions use the declared forecast wording and expose every earlier correction without changing figures or sources',()=>{
 const correction=JSON.parse(read('docs/translation/four-language-completion/forecast-word-corrections.json'));
 assert.match(correction.status,/Unreviewed draft/);assert.ok(correction.lexicalSources.some((r:any)=>r.url.startsWith('https://www.statssa.gov.za/')));
 for(const row of correction.entries){for(const lang of Object.keys(row.after)){
  const actual=row.domain==='visual'?reportVisualText(row.english,lang):productGuideText(row.english,lang);
  assert.equal(actual,row.after[lang]);assert.notEqual(actual,row.before[lang]);assert.deepEqual(figures(actual),figures(row.before[lang]));
 }}
 function auditWords(rows:readonly {ts:string}[]){for(const row of rows)assert.doesNotMatch(row.ts,/\b(?:vuprofeta|miprofeta)\b/,'quantitative planning uses the forecast term');}
 auditWords([...PRODUCT_GUIDE_COPY,...PRODUCT_FIRST_CROP_COPY,...PRODUCT_YIELD_COPY,...REPORT_VISUAL_COPY]);
 assert.throws(()=>auditWords([{ts:'vuprofeta'}]),/quantitative planning/,'a returned prophecy wording must trip the same check');
});
