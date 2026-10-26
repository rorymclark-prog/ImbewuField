import {expectedGuideWithAnimalLegal,expectedMarkdownWithAnimalLegal} from './helpers/animal-legal-expectation.ts';
import { CROP_EXPORT_COPY } from '../lib/crop-export-copy-data.ts';
import { translateAdditionalProductPresentation } from './helpers/product-guidance-expectation.ts';
import { translatedSeasonExpectation, translateExpectedGuideSeason } from './helpers/season-translation-expectation.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { PRODUCT_PROFILES, PRODUCT_GUIDE_COPY, PRODUCT_FIRST_CROP_COPY, PRODUCT_YIELD_COPY, productGuideText, buildProductGuidance, productPurchasingMarkdown, productContextFromItems, assumedProductSeason } from '../lib/production-product-guidance.ts';
import { savedCropPlanMarkdown, reportDocumentText, zuluReportClosingNotes } from '../lib/report-localisation.ts';
import { reportSummaryPages } from '../lib/report-summary.ts';
import { firstCropAgeLabel, formatRange } from '../lib/perennial-harvest.ts';
import { recordsMonthLong } from '../lib/records-months.ts';
import { growingZonesForClimate } from '../lib/growing-zones.ts';
import { normaliseReportSiteFacts } from '../lib/report-site-facts.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fx=JSON.parse(read('tests/fixtures/product-profile-translation/source-cases.json'));
const sources=JSON.parse(read('tests/fixtures/product-profile-translation/source-profile-rows.json'));
const packet=JSON.parse(read('docs/translation/four-language-completion/product-profile-drafts.json'));
const cropPacket=JSON.parse(read('docs/translation/four-language-completion/saved-crop-drafts.json'));
const crops=JSON.parse(read('tests/fixtures/report-costs-translation/source-cases.json'));
const languages=['zu','st','ts','ve']as const;
const figures=(s:string)=>(s.match(/\d+(?:[.,]\d+)?/g)??[]).sort();
const index=new Map(PRODUCT_GUIDE_COPY.map(row=>[row.english,row]));
const disclaimer='Some research notes below remain in their original English. This purchasing section is not fully translated yet.';
const months=['Jan(?:uary)?','Feb(?:ruary)?','Mar(?:ch)?','Apr(?:il)?','May','Jun(?:e)?','Jul(?:y)?','Aug(?:ust)?','Sep(?:tember)?','Oct(?:ober)?','Nov(?:ember)?','Dec(?:ember)?'];

test('plant profiles retain every original source field and bind all four drafts, figures and month identities to their review packet',()=>{
  assert.equal(fx.sourceSha,packet.sourceSha);assert.match(packet.status,/Unreviewed AI drafts/);
  assert.equal(index.size,PRODUCT_GUIDE_COPY.length,'one wording authority per source');
  assert.deepEqual(PRODUCT_GUIDE_COPY,packet.entries.map(({english,zu,st,ts,ve}:any)=>({english,zu,st,ts,ve})));
  const actual:Record<string,string>={};
  for(const[id,profile]of Object.entries(PRODUCT_PROFILES))for(const key of['care','purchase','products']as const){
    const values=key==='products'?profile[key]?[profile[key]]:[]:profile[key];
    values.forEach((value,i)=>actual[`PRODUCT_PROFILES.${id}.${key}${key==='products'?'':'.'+i}`]=value!);
  }
  const expected:Record<string,string>={};for(const row of sources)for(const path of row.paths)if(path.startsWith('PRODUCT_PROFILES.'))expected[path]=row.english;
  assert.deepEqual(actual,expected,'source care, buying constraints and product descriptions cannot be rewritten');
  for(const row of PRODUCT_GUIDE_COPY)for(const lang of languages){
    assert.ok(row[lang].trim());assert.notEqual(row[lang],row.english);
    const sourceTokens=(row.english.match(/\{\w+\}/g)??[]).sort();
    assert.deepEqual((row[lang].replace(/\{month\d+\}/g,'').match(/\{\w+\}/g)??[]).sort(),sourceTokens);
    for(let m=1;m<=12;m++){
      const sourceCount=(row.english.match(new RegExp('\\b'+months[m-1]+'\\b','g'))??[]).length;
      assert.equal((row[lang].match(new RegExp('\\{month'+m+'\\}','g'))??[]).length,sourceCount,`${lang}: source month occurrence changed`);
      if(sourceCount)assert.equal(productGuideText(row.english,lang).split(recordsMonthLong(lang,m)).length-1,sourceCount);
    }
    assert.deepEqual(figures(productGuideText(row.english,lang)),figures(row.english),'numeric source values and ranges stay exact');
  }
});

test('a new profile clause cannot silently fall back to English and saved words are interpolated only once',()=>{
  function audit(profiles:typeof PRODUCT_PROFILES){for(const profile of Object.values(profiles))for(const source of[profile.products,...profile.care,...profile.purchase])if(source)for(const lang of languages)assert.notEqual(productGuideText(source,lang),source,`unregistered profile: ${source}`);}
  audit(PRODUCT_PROFILES);
  assert.throws(()=>audit({...PRODUCT_PROFILES,broken:{care:['A new unregistered planting claim.'],purchase:[],sources:[]}}),/unregistered profile/);
  assert.equal(productGuideText('Named {month5}','ve'),'Named {month5}','unknown or saved strings do not acquire calendar meaning');
  for(const lang of languages)assert.ok(productGuideText('Buying advice: {advice}',lang,{advice:'Saved {month5} {advice}'}).endsWith('Saved {month5} {advice}'));
  assert.equal(productGuideText('Buying advice: {advice}','en',{advice:'Saved {month5}'}),'Buying advice: Saved {month5}');
});

test('whole English guides, purchases and season decisions retain every original field outside independently checked legal source corrections',()=>{
  for(const c of fx.cases){
    const context=fx.contexts[c.context],before=JSON.stringify(context),expectedEnglish=expectedGuideWithAnimalLegal(c.guide,context);
    for(const lang of['en','af']){
      assert.deepEqual(buildProductGuidance(context,c.zones,c.conditions,lang),expectedEnglish,c.name);
      assert.equal(productPurchasingMarkdown(context,c.zones,c.conditions,lang),expectedMarkdownWithAnimalLegal(c.markdown,c.guide,expectedEnglish),c.name);
    }
    for(const[i,g]of context.trees.entries())assert.deepEqual(assumedProductSeason(g,c.zones,c.conditions)??null,c.seasons[i]);
    assert.equal(JSON.stringify(context),before);
  }
});

test('declared profile, age, yield and bound animal-care wording preserve safety holds, item order, seasons, sources, numbers and inventory',()=>{
  for(const c of fx.cases)for(const lang of languages){
    const context=fx.contexts[c.context],before=JSON.stringify(context),guide=buildProductGuidance(context,c.zones,c.conditions,lang);
    const expected=structuredClone(c.guide);
    for(const[itemIndex,item]of expected.foodForest.entries()){
      const g=context.trees[itemIndex],h=g.harvest,profile=PRODUCT_PROFILES[h.speciesId]??h.productionGuidance;
      const changes=new Map<string,string>();
      for(const text of profile?.care??[])changes.set(text,productGuideText(text,lang));
      for(const text of profile?.purchase??[])changes.set('Buying advice: '+text,productGuideText('Buying advice: {advice}',lang,{advice:productGuideText(text,lang)}));
      item.lines=item.lines.map((line:string,i:number)=>i===0?productGuideText('{existing} existing; {proposed} proposed. Products: {products}.',lang,{existing:g.existing,proposed:g.proposed,products:productGuideText(profile?.products??h.product,lang).replace(/\.$/,'')}):changes.get(line)??line);
    }
    // First-crop wording is now a separately source-bound draft layer. Translate only its declared
    // line here; the independent first-crop checks bind every note, unit and source qualification.
    for(const[itemIndex,item]of expected.foodForest.entries()){
      const h=context.trees[itemIndex].harvest,at=item.lines.findIndex((line:string)=>line.startsWith('First crop reference:')||line.startsWith('Time to first crop:'));
      assert.ok(at>=0);
      const text=h.yearsToFirstCrop
        ? productGuideText('First crop reference: {age}. {note} Actual timing depends on variety and site care.',lang,{
          age:firstCropAgeLabel(h.yearsToFirstCrop.value,(age,unit)=>productGuideText(`{age} ${unit}`,lang,{age})),
          note:productGuideText(h.yearsToFirstCrop.note??'Check the source conditions and starting stock.',lang),
        })
        : productGuideText('Time to first crop: not sourced; do not rely on newly planted stock for immediate food.',lang);
      item.lines[at]=text;
    }
    // Full-bearing/yield notes now have their own source-bound draft layer. Only those two
    // declared lines may change here; independent yield tests retain their complete qualifications.
    for(const[itemIndex,item]of expected.foodForest.entries()){
      const h=context.trees[itemIndex].harvest;
      for(const [key,prefix,template,fallback]of[
        ['yearsToFullBearing','Established production reference:','Established production reference: {range} years. {note}','Check cultivar, starting stock and growing conditions.'],
        ['yieldKgPerTree','Production reference:','Production reference: {range} kg/plant. {note}','This source result is not a locally confirmed annual forecast.'],
      ]){
        if(!h[key])continue;
        const at=item.lines.findIndex((line:string)=>line.startsWith(prefix));assert.ok(at>=0);
        item.lines[at]=productGuideText(template,lang,{range:formatRange(h[key].value),note:productGuideText(h[key].note??fallback,lang)});
      }
    }
    // Native season qualifiers are a declared presentation layer; every source decision stays exact.
    for(const[index,item]of expected.foodForest.entries())translateExpectedGuideSeason(item,context.trees[index],lang);
    // Newly translated full qualifiers and animal furniture retain the immutable English
    // line positions, source gates and every field outside their declared presentation.
    translateAdditionalProductPresentation(expected,c.guide,context,lang);
    assert.deepEqual(guide,expected,`${lang}/${c.name}: an undeclared research or husbandry field changed`);
    assert.deepEqual(figures(JSON.stringify(guide)),figures(JSON.stringify(expectedGuideWithAnimalLegal(c.guide,context))));
    assert.equal(JSON.stringify(context),before,'translation cannot mutate source inventory');
    const markdown=productPurchasingMarkdown(context,c.zones,c.conditions,lang);
    assert.deepEqual(figures(markdown),figures(expectedMarkdownWithAnimalLegal(c.markdown,c.guide,expectedGuideWithAnimalLegal(c.guide,context))));
    if(c.markdown){
      assert.ok(markdown.startsWith('## '+productGuideText('Production purchases and variety assumptions',lang)));
      assert.ok(markdown.includes(productGuideText(disclaimer,lang)),'remaining source-language research must be visible as an open gap');
      for(const item of[...guide.foodForest,...guide.animalProducts]){assert.ok(markdown.includes('### '+item.title));for(const source of item.sources??[])assert.ok(markdown.includes(`[${source.label}](${source.url})`),'original citation title, page and URL stay exact');}
    }else assert.equal(markdown,'');
  }
});

test('cultivar identities and poison warnings cannot disappear inside translated buying profiles',()=>{
  const terms:Record<number,string[]>={1:['Fuerte','Hass','Ryan'],3:['Williams','Grand Nain','Chinese Cavendish'],4:['Honey Gold','Sunrise Solo'],9:['Beaumont','Purvis','Makai'],11:['Tommy Atkins','Kent','Sensation','Keitt'],13:['Afri-Star','Infruitec Chilling Unit','Bien Donne','Simondium','Western Cape','Granny Smith','Elgin','Golden Delicious','Hillieri'],17:['Fay Zee Siu','Mauritius','Wai Chee','SALGA/ARC'],21:['Prime Seedless','Sugraone','Flame Seedless','Dauphine','Crimson Seedless','Thompson Seedless','Orange River'],23:['Chandler','Selecta'],26:['Wonderful'],31:['Miho Wase','satsuma','clementines','Nadorcott','mandarin'],33:['Heritage','Autumn Bliss','Glen Prosen','Glen Lyon','Tulameen'],35:['Biloxi','southern highbush','rabbiteye','highbush'],37:['Ukulinga','Cape Fear','Choctaw','Barton','Pawnee','Wichita','Western Schley'],39:['Earligold','Cederberg','Infruitec units','Bien Donne','Western Cape'],41:['African Delight','Pioneer','African Rose','ARC/Culdevco','Western Cape']};
  for(const[i,words]of Object.entries(terms))for(const lang of languages)for(const word of words)assert.ok(productGuideText(sources[Number(i)].english,lang).includes(word),`${lang}: renamed cultivar/source ${word}`);
  const warnings=[sources[52].english,sources[80].english];
  for(const warning of warnings)for(const lang of languages)assert.ok(productGuideText(warning,lang).includes({zu:'buthi',st:'tjhefo',ts:'chefu',ve:'mulimo'}[lang]),`${lang}: explicit poisonous warning missing`);
  assert.ok(productGuideText(sources[80].english,'ve').includes('khufhi'));
  assert.ok(packet.lexicalChecks.some((r:any)=>r.term==='mulimo'&&r.url.startsWith('https://www.nda.gov.za/')));
  assert.match(packet.reviewNote,/not a fluent-speaker review/);
});

test('the saved crop page uses the selected native summary with exact crop names and data, retaining its earlier isiZulu output',()=>{
  const old=JSON.parse(read('tests/fixtures/report-monitoring-translation/source-cases.json'));
  const saved=old.monitoring.find((r:any)=>r.name==='saved-design');assert.equal(zuluReportClosingNotes(saved.facts,old.location).crop,old.legacyZulu[0]);
  for(const c of crops.cases){const before=JSON.stringify(c.facts);for(const lang of['en','af',...languages]){
    const markdown=savedCropPlanMarkdown(c.facts,crops.location,lang),heading=reportDocumentText('Saved crop plan',lang);
    assert.equal(markdown,`## ${heading}\n\n${reportSummaryPages(c.facts,crops.location,5,lang)[1].lines.join('\n\n')}`);
    assert.deepEqual(figures(markdown),figures(savedCropPlanMarkdown(c.facts,crops.location)));
    for(const crop of c.facts?.crop?.crops??[])assert.ok(markdown.includes(crop.name));
  }assert.equal(JSON.stringify(c.facts),before);}
  for(const row of cropPacket.entries)for(const lang of languages){assert.equal(reportDocumentText(row.english,lang),row[lang]);assert.notEqual(row.english,row[lang]);}
});

test('all newly authored purchasing templates are registered and a deliberately unregistered template fails the audit',()=>{
  // The shared product-guidance registry now owns additional source-bound templates;
  // unknown copy must still fail, and existing profile/age/yield authorities remain.
  function audit(text:string){const tree=ts.createSourceFile('guide.ts',text,ts.ScriptTarget.Latest,true);function visit(node:ts.Node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='t'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))assert.ok(new Map([...PRODUCT_GUIDE_COPY,...PRODUCT_FIRST_CROP_COPY,...PRODUCT_YIELD_COPY,...(CROP_EXPORT_COPY as readonly {english:string;generatedScope?:string}[]).filter(row=>row.generatedScope==='product-guidance')].map(r=>[r.english,r])).has(node.arguments[0].text),`unregistered presentation: ${node.arguments[0].text}`);ts.forEachChild(node,visit);}visit(tree);}
  audit(read('lib/production-product-guidance.ts'));assert.throws(()=>audit("t('New unchecked buying advice')"),/unregistered presentation/);
});

test('the actual reader wraps complete source URLs without rewriting citation text or unrelated paragraphs',async()=>{
  const React=await import('react');const{renderToStaticMarkup}=await import('react-dom/server');const{stripInlineMarkdown}=await import('../lib/report-pdf.ts');
  const tree=ts.createSourceFile('view.tsx',read('components/ReportView.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='renderReport');assert.ok(fn);
  const js=ts.transpileModule(fn.getText(tree),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
  const render=new Function('React','stripInlineMarkdown','ReportChapterGraphics','ChevronRight','REPORT_DOCUMENT_LANGUAGES','reportDocumentText',js+';return renderReport;')(React,stripInlineMarkdown,()=>null,()=>null,languages,reportDocumentText);
  const html=(markdown:string)=>renderToStaticMarkup(React.createElement('div',null,...render(markdown)));
  const source={label:'Original manual title, p. 32',url:'https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/Fruit%20and%20%20Nut%20Production%20in%20KZN.pdf'};
  for(const lang of['en',...languages]){const text=productGuideText('Source: [{label}]({url})',lang,source),output=html(text);assert.ok(output.includes('data-report-citation="true"'));assert.ok(output.includes('overflow-wrap:anywhere'));assert.ok(output.includes(text),'citation label and full URL remain copyable source text');}
  assert.ok(!html('Original plain paragraph.').includes('data-report-citation'));
});

test('the real API gives all four targets the native saved crop page and purchasing profiles, including isiZulu previously missing purchases',async()=>{
  const url=(s:string)=>'data:text/javascript,'+encodeURIComponent(s);
  const hooks=registerHooks({resolve(s,c,next){
    if(s==='@anthropic-ai/sdk')return{url:url('export default class Anthropic{}'),shortCircuit:true};
    if(s==='next/server')return{url:url('export class NextRequest{}'),shortCircuit:true};
    if(s==='@/lib/api-auth')return{url:url('export async function guardPaidApiRequest(){return {uid:"profiles-test"}}'),shortCircuit:true};
    if(s==='@/lib/metered-ai')return{url:url("export const AI_MODELS={main:'mock'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async()=>({usage:{},stop_reason:'end_turn',content:[{type:'text',text:'## Mocked body\\nMocked body content.'}]})}}}}"),shortCircuit:true};return next(s,c);
  }});const old=globalThis.fetch;globalThis.fetch=async()=>new Response('{}');
  try{const{POST}=await import('../app/api/generate-report/route.ts');const d=crops.location;const withProducts=structuredClone(crops.cases.find((c:any)=>c.name==='crop-plan').facts);withProducts.productionItems=[{defId:'tree_mango',status:'proposed'},{defId:'tree_other',speciesId:'strychnos-spinosa',status:'proposed'}];
    for(const lang of languages)for(const facts of[null,withProducts]){
      const response=await POST(new Request('http://localhost/api/generate-report',{method:'POST',body:JSON.stringify({language:lang,locationData:d,siteFacts:facts,sections:['Executive Summary']})})as any);assert.equal(response.status,200);const text=await response.text();const normal=normaliseReportSiteFacts(facts)??null;
      const crop=savedCropPlanMarkdown(normal,d,lang).split('\n');assert.ok(text.includes(crop[0].slice(3)));assert.ok(text.includes(crop.slice(1).join('\n').trim()));assert.ok(!text.includes('## Saved crop plan'));
      if(facts){const context={...productContextFromItems(normal!.productionItems??[]),animalChoices:normal!.productionEnterpriseChoices};const guide=buildProductGuidance(context,growingZonesForClimate(d.climate.monthlyTemp,d.rainfall.monthly,d.lat),undefined,lang);
        assert.ok(text.includes(productGuideText('Production purchases and variety assumptions',lang)));assert.ok(text.includes(productGuideText(disclaimer,lang)));for(const item of guide.foodForest)for(const line of item.lines)assert.ok(text.includes(line),`${lang}: missing source-backed buying/profile line`);
      }
    }
  }finally{hooks.deregister();globalThis.fetch=old;}
});


test('translated guide seasons still reject changed months, citations, missing cautions and English-only metadata',()=>{
  const row=fx.cases.find((row:any)=>row.guide.foodForest.some((item:any)=>item.expectedSeason));assert.ok(row);const index=row.guide.foodForest.findIndex((item:any)=>item.expectedSeason),group=fx.contexts[row.context].trees[index],source=row.guide.foodForest[index].expectedSeason;
  for(const lang of languages){const actual=buildProductGuidance(fx.contexts[row.context],row.zones,row.conditions,lang).foodForest[index].expectedSeason!,expected=translatedSeasonExpectation(source,group,lang)!;assert.deepEqual(actual,expected);
    for(const broken of [{...actual,months:[...actual.months,0]},{...actual,source:{...actual.source!,url:'https://example.com/wrong-source'}},{...actual,basis:actual.basis.split('.')[0]},{...actual,label:source.label,calendarLabel:source.label}])assert.throws(()=>assert.deepEqual(broken,expected),/Expected values/,'the source-preservation rule must still fail when a reference decision or complete caution changes');
  }
});


test('the whole-guide comparison rejects untranslated care, reordered limits, lost conditions and changed citations',()=>{
  const care=JSON.parse(read('docs/translation/four-language-completion/animal-welfare-drafts.json')).rows as Array<Record<string,string>>;
  for(const language of languages){
    const c=fx.cases.find((c:any)=>c.guide.animalProducts.some((item:any)=>item.lines.some((line:string)=>line.startsWith('When pigs are trucked,'))));assert.ok(c,'the immutable profile scenarios must retain the pig transport recommendation');
    const original=structuredClone(c.guide),expected=structuredClone(c.guide),context=fx.contexts[c.context];translateAdditionalProductPresentation(expected,original,context,language);
    const row=care.find(row=>row.english.startsWith('When pigs are trucked,'))!;assert.ok(row);const itemIndex=expected.animalProducts.findIndex((item:any)=>item.lines.includes(row[language]));assert.ok(itemIndex>=0);const lineIndex=expected.animalProducts[itemIndex].lines.indexOf(row[language]);
    const sameGuide=(candidate:typeof expected)=>assert.deepEqual(candidate,expected);
    for(const damaged of [row.english,row[language].slice(0,-12),row[language].replace('0.3','__first__').replace('0.8','0.3').replace('__first__','0.8')]){const broken=structuredClone(expected);broken.animalProducts[itemIndex].lines[lineIndex]=damaged;assert.throws(()=>sameGuide(broken),'complete care text and ordered limits must survive beyond their headings');}
    const source=structuredClone(expected);assert.ok(source.animalProducts[itemIndex].sources.length);source.animalProducts[itemIndex].sources[0].url='https://example.com/changed-care-source';assert.throws(()=>sameGuide(source),'all source objects remain in the whole-guide comparison');
    const missing=structuredClone(expected);missing.animalProducts[itemIndex].lines.splice(lineIndex,1);assert.throws(()=>sameGuide(missing),'removing a whole condition must fail even when remaining values are unchanged');
  }
});
