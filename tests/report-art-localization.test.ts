import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import test from 'node:test';
import typescript from 'typescript';
import {chapterGraphics,reportChapterGraphics,placeReportFigures,placedFigureIds,REPORT_ART_READY,REPORT_ART_SIZE,reportArtSrc} from '../lib/report-chapter-visuals.ts';
import {REPORT_VISUAL_COPY,reportVisualText,type ReportVisuals} from '../lib/report-visuals.ts';
import {reportHeadingAliases,reportHeadingLookup,reportHeadingPrompt,reportUiText,REPORT_PROMPT_HEADINGS} from '../lib/report-localisation.ts';
import {DEMO_LOCATION} from '../lib/demo-site.ts';

const read=(path:string)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fixture=JSON.parse(read('tests/fixtures/report-art-translation/source-cases.json')) as {sourceSha:string;visuals:ReportVisuals;cases:Array<{heading:string;body:string;expected:ReturnType<typeof chapterGraphics>}>;report:string;expectedReport:ReturnType<typeof reportChapterGraphics>};
const fields=JSON.parse(read('tests/fixtures/report-art-translation/source-fields.json')) as {prefix:string;fields:Array<{field:string;english:string}>;labels:string[]};
const languages=['zu','st','ts','ve'] as const;
const norm=(value:string)=>value.replace(/\s+/g,' ').trim();
const xmlWords=(svg:string)=>[...svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map(m=>m[1].replace(/&amp;/g,'&').replace(/&apos;/g,"'")).join(' ');
const canonical=[...read('components/ReportView.tsx').match(/const ALL_SECTIONS = \[([\s\S]*?)\] as const;/)![1].matchAll(/'([^']+)'/g)].map(m=>m[1]);

test('English chapter objects, ordering and vegetation drawing remain exact to the pre-translation source',()=>{
 const before=JSON.stringify(fixture);
 for(const row of fixture.cases)assert.deepEqual(chapterGraphics(row.heading,row.body,fixture.visuals,fixture.visuals.charts.filter(c=>c.id==='water-budget')),row.expected);
 assert.deepEqual(reportChapterGraphics(fixture.report,fixture.visuals),fixture.expectedReport);
 assert.equal(JSON.stringify(fixture),before);
});

test('every concept asset keeps its original bytes, dimensions and source identity',()=>{
 const assets=JSON.parse(read('tests/fixtures/report-art-translation/source-assets.json')) as Array<{id:string;path:string;size:number[];sha256:string}>;
 assert.deepEqual([...REPORT_ART_READY],assets.map(a=>a.id));
 for(const asset of assets){assert.equal('public'+reportArtSrc(asset.id),asset.path);assert.deepEqual(REPORT_ART_SIZE[asset.id],asset.size);assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+asset.path,import.meta.url))).digest('hex'),asset.sha256);}
});

test('all concept words and embedded labels have drafts while species names, caveats and numbers keep their source',()=>{
 const sources=new Map(REPORT_VISUAL_COPY.map(row=>[row.english,row]));
 const packet=JSON.parse(read('docs/translation/four-language-completion/report-art-drafts.json')) as {status:string;sourceSha:string;entries:Array<typeof REPORT_VISUAL_COPY[number]>};
 assert.match(packet.status,/Unreviewed AI drafts/);assert.equal(packet.sourceSha,fixture.sourceSha);
 for(const row of packet.entries)assert.deepEqual(sources.get(row.english),row,'review packet must match the actual runtime copy');
 const all=[fields.prefix,...fields.fields.map(row=>row.english.startsWith(fields.prefix)?row.english.slice(fields.prefix.length).trim():row.english),...fields.labels,'Trench bed','Compost'];
 for(const source of all){assert.ok(sources.has(source),source);for(const lang of languages){const text=reportVisualText(source,lang);assert.ok(text.trim());assert.notEqual(text,source,`${lang}: ${source}`);assert.deepEqual(text.match(/\d+/g)??[],source.match(/\d+/g)??[]);}}
 for(const row of fixture.cases)for(const source of row.expected.filter(g=>g.art))for(const lang of languages){
  const graphic=chapterGraphics(row.heading,row.body,{...fixture.visuals,language:lang}).find(g=>g.id===source.id)!;
  assert.ok(graphic.note.startsWith(reportVisualText(fields.prefix,lang)+' '));
  assert.equal(graphic.art!.src,source.art!.src);assert.notEqual(graphic.art!.alt,source.art!.alt);
  for(const name of ['cabbage','spinach','cabbages','maize','beans','pumpkin','sweet potato','carrots','onions','peas','tomatoes','pumpkins'])if(new RegExp(`\\b${name}\\b`).test(source.art!.alt))assert.ok(new RegExp(`\\b${name}\\b`).test(graphic.art!.alt),`${lang}: changed source crop ${name}`);
 }
 // Audit the actual art definitions, so a future source picture cannot silently remain English.
 const audit=(source:string)=>{
  const tree=typescript.createSourceFile('art.ts',source,typescript.ScriptTarget.Latest,true);
  const known=(text:string)=>assert.ok(sources.has(text),`missing concept source: ${text}`);
  function visit(n:typescript.Node){
   if(typescript.isPropertyAssignment(n)&&['title','alt','note','detail'].includes(n.name.getText(tree))){
    if(typescript.isStringLiteral(n.initializer))known(n.initializer.text);
    else if(typescript.isTemplateExpression(n.initializer)&&n.initializer.templateSpans[0]?.expression.getText(tree)==='NOT_THIS_SITE')known(n.initializer.templateSpans[0].literal.text.trim());
   }
   if(typescript.isCallExpression(n)&&typescript.isIdentifier(n.expression)){
    const at=n.expression.text==='label'?2:['t','reportVisualText'].includes(n.expression.text)?0:-1;
    if(at>=0&&n.arguments[at]&&typescript.isStringLiteral(n.arguments[at]))known(n.arguments[at].text);
   }
   typescript.forEachChild(n,visit);
  }visit(tree);
 };
 audit(read('lib/report-chapter-visuals.ts'));
 assert.throws(()=>audit("const art=[{id:'new-picture',title:'Unregistered new illustration'}]"),/missing concept source/);
 assert.throws(()=>audit("const art=[{id:'new-picture',note:'Unregistered new safety caveat'}]"),/missing concept source/);
});

test('native headings place each site figure once, preserve picture order and leave recorded tree names untouched',async()=>{
 for(const language of languages){const lookup=(await reportHeadingLookup(language))!;const options={bodyLanguage:language,headingAliases:reportHeadingAliases(canonical,language,lookup)};
  const nativeReport=fixture.cases.map(({heading,body},i)=>`## ${i+1}. ${reportUiText(heading,language,lookup)}\n${body}`).join('\n\n');
  const result=reportChapterGraphics(nativeReport,{...fixture.visuals,language},options);
  const expected=Object.values(fixture.expectedReport);
  assert.deepEqual(Object.values(result).map(gs=>gs.map(g=>g.id)),expected.map(gs=>gs.map(g=>g.id)));
  assert.deepEqual([...placedFigureIds(result)],[...placedFigureIds(fixture.expectedReport)]);
  for(const graphics of Object.values(result)){assert.ok(graphics.filter(g=>g.art).length<=2);for(const g of graphics)if(g.trees)assert.deepEqual(g.trees,[{name:'Mango Tree',image:'/element-art/tree_mango.png'},{name:'Wild Plum',image:'/element-art/tree_wild_plum.png'}]);}
  const layers=chapterGraphics(reportUiText('Natural Vegetation & Biome',language,lookup),'',{...fixture.visuals,language},[],options)[0];
  for(const label of fields.labels)assert.ok(norm(xmlWords(layers.svg!)).includes(norm(reportVisualText(label,language))));
  const english=fixture.expectedReport['15. Natural Vegetation & Biome'][0].svg!;
  const originalGeometry=english.slice(english.indexOf('<path'),english.indexOf('<g stroke='));assert.ok(layers.svg!.includes(originalGeometry));
  assert.deepEqual(chapterGraphics('constructor','Original recorded body.',{...fixture.visuals,language},[],options),[]);
  assert.deepEqual(chapterGraphics('Unknown recorded heading','Original recorded body.',{...fixture.visuals,language},[],options),[]);
  const spaced=`  7. ${reportUiText('Water Harvesting',language,lookup).toLocaleUpperCase().replaceAll(' ','  ')}  `;
  assert.deepEqual(placeReportFigures([spaced],fixture.visuals,options)[spaced].map(g=>g.id),['water-budget']);
 }
});

test('a native technique is pictured only when explicitly named in the saved body language',()=>{
 for(const language of languages)for(const [heading,id,source] of [['Water Harvesting','art-swale-section','Swale'],['Soil Strategy','art-trench-bed','Trench bed'],['Year 1 Priorities','art-compost-bays','Compost']]){
  const visuals={...fixture.visuals,language};const options={bodyLanguage:language};const phrase=reportVisualText(source,language);
  assert.ok(chapterGraphics(heading,`(${phrase.toLocaleUpperCase().replaceAll(' ','  ')})`,visuals,[],options).some(g=>g.id===id));
  assert.ok(!chapterGraphics(heading,`α${phrase}β`,visuals,[],options).some(g=>g.id===id),'substring in a larger Unicode word is not a technique');
  assert.ok(!chapterGraphics(heading,'water ditch manure',visuals,[],options).some(g=>g.id===id));
  assert.ok(chapterGraphics(heading,phrase,{...fixture.visuals,language:'en'},[],options).some(g=>g.id===id),'screen language cannot change what the saved body says');
  assert.ok(!chapterGraphics(heading,phrase,visuals,[],{bodyLanguage:'en'}).some(g=>g.id===id),'an English saved body is not reinterpreted through the UI language');
 }
});

test('native prompt headings follow existing section labels and change only selected H2 titles',async()=>{
 const source=canonical.map(s=>`## ${REPORT_PROMPT_HEADINGS[s]??s}\n### Subheading\nRecorded figure: 25 m² and 1,200 L.\n`).join('\n');
 for(const language of languages){const lookup=(await reportHeadingLookup(language))!;const translated=reportHeadingPrompt(source,canonical,language,lookup);
  assert.deepEqual([...translated.matchAll(/^## (.+)$/gm)].map(m=>m[1]),canonical.map(s=>reportUiText(s,language,lookup)));
  assert.deepEqual(translated.split('\n').filter(s=>!s.startsWith('## ')),source.split('\n').filter(s=>!s.startsWith('## ')));
  assert.equal(reportHeadingPrompt(source,[],language,lookup),source);
 }
 assert.equal(reportHeadingPrompt(source,canonical,'en',await reportHeadingLookup('en')),source);
 assert.equal(await reportHeadingLookup('unsupported-language'),undefined);
});

test('the actual generator sends native selected headings with the same source facts and rejects translated topic identifiers',async()=>{
 const requests:any[]=[];
 const originalPrompts=JSON.parse(read('tests/fixtures/report-art-translation/source-prompts.json')) as {prompts:Array<{sha256:string;headings:string[]}>};
 const canonicalByTitle=new Map(canonical.map(s=>[REPORT_PROMPT_HEADINGS[s]??s,s]));
 const module=(source:string)=>'data:text/javascript,'+encodeURIComponent(source);
 const key=Symbol.for('imbewu-report-art-request-capture');(globalThis as any)[key]=requests;
 const hooks=registerHooks({resolve(specifier,context,next){
  if(specifier==='@anthropic-ai/sdk')return {url:module('export default class Anthropic {}'),shortCircuit:true};
  if(specifier==='next/server')return {url:module('export class NextRequest {}'),shortCircuit:true};
  if(specifier==='@/lib/api-auth')return {url:module('export async function guardPaidApiRequest(){return {uid:"translation-test"};}'),shortCircuit:true};
  if(specifier==='@/lib/metered-ai')return {url:module(`export const AI_MODELS={main:'claude-sonnet-4-6'};export async function meteredAi(){return {ai:{model:m=>m,messages:{create:async request=>{globalThis[Symbol.for('imbewu-report-art-request-capture')].push(request);return {usage:{},stop_reason:'end_turn',content:[{type:'text',text:'## Captured draft\\nOriginal mocked output.'}]};}}}};}`),shortCircuit:true};
  return next(specifier,context);
 }});
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:200});
 try{
  const {POST}=await import('../app/api/generate-report/route.ts');
  for(const language of ['en',...languages]){
   requests.length=0;
   const response=await POST(new Request('http://localhost/api/generate-report',{method:'POST',body:JSON.stringify({language,sections:canonical,tone:'professional',length:'standard',locationData:DEMO_LOCATION})}) as any);
   assert.equal(response.status,200);await response.text();assert.ok(requests.length>1);
   const lookup=await reportHeadingLookup(language);const sent=requests.flatMap(r=>[...String(r.messages[0].content).matchAll(/^## (.+)$/gm)].map(m=>m[1]));
   assert.deepEqual(sent,originalPrompts.prompts.flatMap(p=>p.headings).map(title=>language==='en'?title:reportUiText(canonicalByTitle.get(title)!,language,lookup!)));
   if(language==='en')assert.deepEqual(requests.map(r=>createHash('sha256').update(r.messages[0].content).digest('hex')),originalPrompts.prompts.map(p=>p.sha256));
   assert.ok(requests.every(r=>String(r.messages[0].content).includes(String(DEMO_LOCATION.rainfall.annual))));
   if(language!=='en')assert.ok(requests.every(r=>String(r.messages[0].content).includes('Copy each ## section heading below exactly')));
   requests.length=0;
   const invalid=await POST(new Request('http://localhost/api/generate-report',{method:'POST',body:JSON.stringify({language,sections:['Unrecognised translated topic'],locationData:DEMO_LOCATION})}) as any);assert.equal(invalid.status,400);assert.equal(requests.length,0);
  }
 }finally{globalThis.fetch=originalFetch;hooks.deregister();delete (globalThis as any)[key];}
});
