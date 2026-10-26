import assert from'node:assert/strict';
import fs from'node:fs';
import test from'node:test';
import {registerHooks}from'node:module';
import ts from'typescript';
import React from'react';
import {renderToStaticMarkup}from'react-dom/server';
import {AlertTriangle}from'lucide-react';
import {ASSURANCE_TITLE,ASSURANCE_PARAGRAPHS,ASSURANCE_ONE_LINE,SOIL_CAUTION,SOIL_TEST_INVITE,SOIL_UNKNOWN_CAUTION,SOIL_PROVENANCE_TITLES,PLAN_ASSURANCE_COPY,planAssuranceText,planAssuranceParagraphs,planSoilCaution,planSoilCautionTitle}from'../lib/plan-assurance.ts';
import {assuranceMarkdown}from'../lib/report-site-facts.ts';
import {parseReportMarkdown}from'../lib/report-pdf.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const f=JSON.parse(read('tests/fixtures/report-assurance-translation/source-cases.json'));
const packet=JSON.parse(read('docs/translation/four-language-completion/report-assurance-drafts.json'));
const languages=['zu','st','ts','ve']as const;
const digits=(s:string)=>(s.match(/\d+/g)??[]).sort();
const sources=[ASSURANCE_TITLE,...ASSURANCE_PARAGRAPHS,ASSURANCE_ONE_LINE,...Object.values(SOIL_CAUTION),SOIL_TEST_INVITE,SOIL_UNKNOWN_CAUTION,...Object.values(SOIL_PROVENANCE_TITLES)];
const map=new Map(PLAN_ASSURANCE_COPY.map(r=>[r.english,r]));

test('the shared English statements and generic report remain exact while all source clauses have declared native drafts',()=>{
 assert.equal(f.sourceSha,'1340afff206706a36fdeec5fa4b6e104ff16a808');assert.equal(packet.sourceSha,f.sourceSha);assert.match(packet.status,/Unreviewed AI drafts/);
 assert.equal(ASSURANCE_TITLE,f.english.title);assert.deepEqual(ASSURANCE_PARAGRAPHS,f.english.paragraphs);assert.equal(ASSURANCE_ONE_LINE,f.english.footer);assert.deepEqual(SOIL_CAUTION,f.english.soil);assert.equal(SOIL_TEST_INVITE,f.english.invite);assert.equal(assuranceMarkdown(),f.english.markdown);assert.equal(assuranceMarkdown('af'),f.english.markdown);
 assert.equal(map.size,PLAN_ASSURANCE_COPY.length);assert.deepEqual(PLAN_ASSURANCE_COPY,packet.entries);assert.deepEqual([...map.keys()].sort(),[...sources].sort());for(const source of sources)for(const lang of languages){const translated=planAssuranceText(source,lang);assert.equal(translated,map.get(source)![lang]);assert.notEqual(translated,source);assert.ok(translated.trim());assert.deepEqual(digits(translated),digits(source));assert.deepEqual(translated.match(/\{\w+\}/g),source.match(/\{\w+\}/g));}
 for(const value of['Recorded custom text {count}','High','constructor','__proto__'])for(const lang of languages)assert.equal(planAssuranceText(value,lang),value);
});

test('the full native statement retains each source paragraph in order rather than reducing its cautions to a short footer',()=>{
 for(const lang of languages){const actual=planAssuranceParagraphs(lang);assert.equal(actual.length,ASSURANCE_PARAGRAPHS.length);for(let i=0;i<actual.length;i++)assert.equal(actual[i],map.get(ASSURANCE_PARAGRAPHS[i])![lang]);const blocks=parseReportMarkdown(assuranceMarkdown(lang));assert.equal(blocks.length,1+actual.length);assert.deepEqual(blocks.map((b:any)=>b.text),[planAssuranceText(ASSURANCE_TITLE,lang),...actual]);}
 assert.deepEqual(planAssuranceParagraphs(),f.english.paragraphs);assert.deepEqual(planAssuranceParagraphs('af'),f.english.paragraphs);
});

test('recorded lab, app-default and unknown provenance replace only the mismatched generic soil paragraph using existing source cautions',()=>{
 for(const lang of['en','af',...languages])for(const soilSource of['lab','soilgrids','estimate',undefined,null,'unfamiliar','constructor','__proto__','toString']){const context={soilSource};const before=JSON.stringify(context);const paragraphs=planAssuranceParagraphs(lang,context);assert.equal(paragraphs.length,5);for(const index of[0,1,3,4])assert.equal(paragraphs[index],planAssuranceText(ASSURANCE_PARAGRAPHS[index],lang));assert.equal(paragraphs[2],soilSource==='soilgrids'?planAssuranceText(ASSURANCE_PARAGRAPHS[2],lang):planSoilCaution(soilSource,lang));assert.equal(JSON.stringify(context),before);}
 assert.equal(planAssuranceParagraphs('en',{soilSource:'lab'})[2],f.english.soil.lab);assert.ok(!planAssuranceParagraphs('en',{soilSource:'lab'})[2].includes('only way to know'));assert.equal(planAssuranceParagraphs('en',{soilSource:'estimate'})[2],f.english.soil.estimate);assert.equal(planAssuranceParagraphs('en',{})[2],SOIL_UNKNOWN_CAUTION);
});

test('the native soil title and caution stay on the exact recorded source, with unknown provenance never promoted to a reading',()=>{
 for(const lang of['en','af',...languages]){for(const source of['lab','soilgrids','estimate']as const){assert.equal(planSoilCaution(source,lang),planAssuranceText(SOIL_CAUTION[source],lang));assert.equal(planSoilCautionTitle(source,lang),planAssuranceText(SOIL_PROVENANCE_TITLES[source],lang));}
 for(const source of[null,undefined,'unknown','constructor','__proto__','Recorded custom source']){assert.equal(planSoilCaution(source,lang),planAssuranceText(SOIL_UNKNOWN_CAUTION,lang));assert.equal(planSoilCautionTitle(source,lang),planAssuranceText(SOIL_PROVENANCE_TITLES.unknown,lang));}}
});

function actualSoilComponent(){const source=read('components/atlas/AtlasPanel.tsx'),tree=ts.createSourceFile('panel.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const parts=tree.statements.filter(n=>(ts.isFunctionDeclaration(n)&&n.name?.text==='SoilProvenance')||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(tree)==='SOIL_CAUTION_STYLE')));assert.equal(parts.length,2);const js=ts.transpileModule(parts.map(n=>n.getText(tree)).join('\n'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;return new Function('React','AlertTriangle','planSoilCaution','planSoilCautionTitle',js+';return SoilProvenance;')(React,AlertTriangle,planSoilCaution,planSoilCautionTitle);}

test('the actual Atlas source component preserves English rendering and shows complete source-specific native titles and cautions',()=>{
 const Component=actualSoilComponent();for(const row of f.atlasSoil)assert.equal(renderToStaticMarkup(React.createElement(Component,{source:row.source??undefined})),row.html);
 for(const lang of languages)for(const source of['lab','soilgrids','estimate',undefined]){const html=renderToStaticMarkup(React.createElement(Component,{source,language:lang}));assert.ok(html.includes(`lang="${lang}"`));for(const value of[planSoilCaution(source,lang),planSoilCautionTitle(source,lang)])assert.ok(html.includes(value.replaceAll('&','&amp;').replaceAll("'",'&#x27;')));const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll("'",'&#x27;');assert.equal(html.replace(/<[^>]+>/g,''),escape(planSoilCautionTitle(source,lang))+escape(planSoilCaution(source,lang)),'native source card must not add untranslated visible text');}
 const tree=ts.createSourceFile('panel.tsx',read('components/atlas/AtlasPanel.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found=0;function visit(n:ts.Node){if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(tree)==='SoilProvenance'){const attrs=n.attributes.properties.filter(ts.isJsxAttribute);assert.ok(attrs.some(a=>a.name.getText(tree)==='language'&&a.initializer?.getText(tree)==='{lang}'));assert.ok(attrs.some(a=>a.name.getText(tree)==='source'&&a.initializer?.getText(tree)==='{soil.soilSource}'));found++;}ts.forEachChild(n,visit);}visit(tree);assert.equal(found,1);
});

test('native Atlas pages declare draft status while report assurance uses the shared complete builder',()=>{
 const page=read('app/atlas/page.tsx');assert.match(page,/LanguageDraftNote lang=\{lang\} scope="atlas"/);assert.match(page,/\['zu',(?:'xh',)?'st','ts','ve'\]\.includes\(lang\)/);const route=read('app/api/generate-report/route.ts');assert.ok(route.includes('assuranceMarkdown(langCode,{soilSource:d.soil.soilSource})'));assert.ok(!route.includes('zuluClosing?.assurance'));assert.ok(!read('lib/report-localisation.ts').includes('  const assurance ='));
});

test('the actual report API emits full native assurances and chooses the existing soil caution for every supplied source',async()=>{
 const url=(s:string)=>'data:text/javascript,'+encodeURIComponent(s);const hooks=registerHooks({resolve(s,c,next){if(s==='@anthropic-ai/sdk')return{url:url('export default class Anthropic{}'),shortCircuit:true};if(s==='next/server')return{url:url('export class NextRequest{}'),shortCircuit:true};if(s==='@/lib/api-auth')return{url:url('export async function guardPaidApiRequest(){return {uid:"assurance-test"}}'),shortCircuit:true};if(s==='@/lib/metered-ai')return{url:url("export const AI_MODELS={main:'mock'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async()=>({usage:{},stop_reason:'end_turn',content:[{type:'text',text:'## Mocked body\\nMocked body content.'}]})}}}}"),shortCircuit:true};return next(s,c);}});const old=globalThis.fetch;globalThis.fetch=async()=>new Response('{}');
 try{const{POST}=await import('../app/api/generate-report/route.ts');const{DEMO_LOCATION}=await import('../lib/demo-site.ts');for(const lang of['en',...languages])for(const soilSource of['lab','soilgrids','estimate',undefined]){const locationData={...DEMO_LOCATION,soil:{...DEMO_LOCATION.soil,soilSource}};const before=JSON.stringify(locationData);const response=await POST(new Request('http://localhost/api/generate-report',{method:'POST',body:JSON.stringify({language:lang,locationData,sections:['Executive Summary']})})as any);assert.equal(response.status,200);const text=await response.text();assert.ok(text.includes(planAssuranceText(ASSURANCE_TITLE,lang)));for(const paragraph of planAssuranceParagraphs(lang,{soilSource}))assert.ok(text.includes(paragraph),`${lang}/${soilSource}: complete assurance source`);if(soilSource!=='soilgrids')assert.ok(!text.includes(planAssuranceText(ASSURANCE_PARAGRAPHS[2],lang)),'known different/missing provenance must not claim generic global-model soil');assert.equal(JSON.stringify(locationData),before);}}
 finally{globalThis.fetch=old;hooks.deregister();}
});
