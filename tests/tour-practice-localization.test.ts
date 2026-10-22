import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';
import{PRODUCT_TOUR,PRODUCT_TOUR_FEATURES,FARM_TOUR}from'../lib/sample-tour.ts';
import{REGIONAL_TOUR}from'../lib/sample-tour-regional.ts';
import{PRODUCT_TOUR_ZU,PRODUCT_TOUR_FEATURES_ZU,PRODUCT_TOUR_ERRORS_ZU,productTourStepCopy,productTourFeatureCopy,productTourUi,productTourError,productTourDuration,productTourLocalizationIsComplete}from'../lib/sample-tour-localization.ts';
const read=(file:string)=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),packet=JSON.parse(read('docs/translation/four-language-completion/tour-practice-drafts.json'));
const langs=['st','ts','ve']as const,tokens=(text:string)=>(text.match(/\{[^{}]+\}|\d+(?:[.,]\d+)?/g)??[]).sort();
test('regional guide drafts bind exact source fields, routes, timing and existing isiZulu instead of declaring English fallback complete',()=>{
 assert.deepEqual(PRODUCT_TOUR,packet.sourceSteps);assert.deepEqual(PRODUCT_TOUR_FEATURES,packet.sourceFeatures);assert.deepEqual(FARM_TOUR,packet.sourceFarmTour);assert.deepEqual(PRODUCT_TOUR_ZU,packet.existingZuluSteps);assert.deepEqual(PRODUCT_TOUR_FEATURES_ZU,packet.existingZuluFeatures);assert.deepEqual(PRODUCT_TOUR_ERRORS_ZU,packet.existingZuluErrors);assert.equal(createHash('sha256').update(read('lib/sample-tour.ts')).digest('hex'),packet.originalSourceSha256['lib/sample-tour.ts']);assert.match(packet.status,/Unreviewed/);
 for(const lang of langs){assert.ok(productTourLocalizationIsComplete(lang));const copy=REGIONAL_TOUR[lang];assert.deepEqual(Object.keys(copy.steps).sort(),PRODUCT_TOUR.map(s=>s.id).sort());assert.deepEqual(Object.keys(copy.features).sort(),Object.keys(PRODUCT_TOUR_FEATURES).sort());assert.deepEqual(Object.keys(copy.ui).sort(),Object.keys(packet.uiSource).sort());assert.deepEqual(Object.keys(copy.errors).sort(),Object.keys(PRODUCT_TOUR_ERRORS_ZU).sort());for(const row of packet.entries){let value:string|undefined;if(row.kind==='step')value=(copy.steps[row.id]as any)[row.field];else if(row.kind==='feature')value=(copy.features[row.id][row.index]as any)[row.field];else if(row.kind==='ui')value=copy.ui[row.id];else value=copy.errors[row.id];assert.equal(value,row[lang],lang+row.kind+row.id);assert.ok(value?.trim());assert.notEqual(value,row.english);assert.deepEqual(tokens(value!),tokens(row.english),lang+row.kind+row.id);}}
});
for(const lang of langs)test(`${lang}: every original stop and tip resolves natively while English and other languages keep the original object`,()=>{
 for(const step of PRODUCT_TOUR){const native=productTourStepCopy(step,lang);assert.equal(native.title,REGIONAL_TOUR[lang].steps[step.id].title);assert.equal(native.task,REGIONAL_TOUR[lang].steps[step.id].task);assert.equal(native.secondaryLabel,REGIONAL_TOUR[lang].steps[step.id].secondaryLabel);assert.equal(productTourStepCopy(step,'en'),step);assert.equal(productTourStepCopy(step,'fr'),step);for(const[index,feature]of(PRODUCT_TOUR_FEATURES[step.id]??[]).entries()){assert.equal(productTourFeatureCopy(step.id,index,lang,feature),REGIONAL_TOUR[lang].features[step.id][index]);assert.equal(productTourFeatureCopy(step.id,index,'en',feature),feature);}}
});
test('UI interpolation inserts data once and retains exact source numbers and unknown errors',()=>{
 for(const lang of['zu',...langs]){const name='QA $& {current} {total}';const text=productTourUi('tipAria',lang,{current:2,total:3,title:name});assert.ok(text?.includes(name));assert.ok(text?.startsWith(productTourUi('tipAria',lang,{current:2,total:3,title:''})!.split(':')[0]));assert.ok(text?.includes('2'));assert.ok(text?.includes('3'));assert.ok(productTourUi('start',lang)?.includes('15'));for(const source of Object.keys(REGIONAL_TOUR.st.errors)){assert.notEqual(productTourError(source,lang),source);assert.equal(productTourError(source,'en'),source);}for(const raw of['Unlisted $& diagnostic','__proto__','constructor','toString'])assert.equal(productTourError(raw,lang),raw);}
 const source=PRODUCT_TOUR[0];for(const lang of['en','fr','constructor','__proto__']){assert.equal(productTourStepCopy(source,lang),source);assert.equal(productTourUi('tour',lang),undefined);assert.equal(productTourLocalizationIsComplete(lang),false);}for(const id of['unknown','__proto__','constructor']){const custom={...source,id};assert.equal(productTourStepCopy(custom,'st'),custom);assert.equal(productTourStepCopy(custom,'zu'),custom);assert.equal(productTourFeatureCopy(id,0,'st',undefined),undefined);}
});
test('regional duration never borrows isiZulu words or changes the original minute values',()=>{
 for(const minutes of new Set(PRODUCT_TOUR.map(s=>s.minutes))){assert.equal(productTourDuration(minutes,'en'),`${minutes} min`);assert.equal(productTourDuration(minutes,'zu'),minutes===1?'umzuzu':`imizuzu engu-${minutes}`);for(const lang of langs){const duration=productTourDuration(minutes,lang);assert.equal(duration,`${minutes} min`);assert.ok(productTourUi('aboutMinutes',lang,{duration})?.includes(duration));}}
});
test('the completeness check rejects a missing paragraph, tip, control or error instead of passing fallback English',()=>{
 const copy=REGIONAL_TOUR.st,task=copy.steps.garden.task,tips=copy.features.planning,close=copy.ui.close,key=Object.keys(copy.errors)[0],error=copy.errors[key];
 try{copy.steps.garden.task='';assert.equal(productTourLocalizationIsComplete('st'),false);copy.steps.garden.task=task;copy.features.planning=tips.slice(1);assert.equal(productTourLocalizationIsComplete('st'),false);copy.features.planning=tips;copy.ui.close='';assert.equal(productTourLocalizationIsComplete('st'),false);copy.ui.close=close;delete copy.errors[key];assert.equal(productTourLocalizationIsComplete('st'),false);}finally{copy.steps.garden.task=task;copy.features.planning=tips;copy.ui.close=close;copy.errors[key]=error;}
 assert.equal(productTourLocalizationIsComplete('st'),true);
});

import { SAMPLE_WORKSPACE_ROWS, sampleWorkspaceDraft } from '../lib/sample-workspace-copy.ts';
import { sampleWorkspaceText } from '../lib/sample-tour-localization.ts';
import { actualPracticeUi, practiceNodeText } from './tour-practice-renderers.ts';
import { controlT, type ControlLanguage } from './control-icon-renderers.ts';
import { accountText } from '../lib/account-copy.ts';
const allDrafts=['zu',...langs] as const;
const local=(lang:string,source:string,zulu=source,values:Record<string,string|number>={})=>sampleWorkspaceText(lang,source,zulu,values);
test('every inventoried workspace control has a separate source-bound regional draft with the original numbers and placeholders',()=>{
 assert.equal(new Set(SAMPLE_WORKSPACE_ROWS.map(r=>r[0])).size,SAMPLE_WORKSPACE_ROWS.length);
 for(const row of packet.workspace.originalRawSources)assert.ok(SAMPLE_WORKSPACE_ROWS.some(r=>r[0]===row.english),row.english);
 for(const row of packet.workspace.entries)for(const lang of langs){assert.equal(sampleWorkspaceDraft(row.english,lang),row[lang]);assert.notEqual(row[lang],row.english);assert.deepEqual(tokens(row[lang]),tokens(row.english));}
 for(const file of ['lib/sample-chooser-translation-draft-st.ts','lib/sample-chooser-translation-draft-ve.ts','lib/sample-mode.ts','lib/use-role-navigation.ts'])assert.equal(createHash('sha256').update(read(file)).digest('hex'),packet.originalSourceSha256[file],file);
 const name='QA $& {role}';for(const lang of ['en',...allDrafts,'fr','constructor']){const text=local(lang,'Open {label}','Vula: {label}',{label:name});assert.ok(text.includes(name));assert.equal(text.split(name).length,2);}
 for(const raw of ['__proto__','constructor','toString','Unlisted {raw} $&'])for(const lang of langs)assert.equal(local(lang,raw,raw),raw);
 for(const hold of packet.workspace.technicalHolds)for(const lang of hold.languages)assert.ok(packet.workspace.entries.find((r:any)=>r.english.startsWith('A fictional warm KZN farm'))[lang].includes(hold.source));
});
for(const lang of allDrafts)test(`${lang}: the actual chooser pairs role drafts and source, discloses review status and preserves all anonymous destinations`,async()=>{
 const h=await actualPracticeUi(lang);try{
  assert.ok(h.text().includes(controlT(lang)('languageDraftNoticeText')));assert.equal(h.renderer.root.findAllByType('h1').length,1);assert.equal(h.renderer.root.findAllByType('h2').length,3);assert.equal(h.renderer.root.findByType('header').props['data-back-fallback'],'/account');
  for(const[i,row]of packet.workspace.sourceRoleCards.entries()){const card=h.renderer.root.findByProps({id:'sample-'+row[0]});for(let field=1;field<4;field++){const native=local(lang,row[field],packet.workspace.existingZuluRoleCards[i][field]);assert.ok(practiceNodeText(card).includes(native));assert.ok(card.findAllByProps({lang:'en'}).some(n=>practiceNodeText(n).includes(row[field])));}assert.equal(card.findByType('button').props.disabled,false);await h.choose(row[0]);}
  assert.deepEqual(h.calls.routes,packet.workspace.sourceRoleCards.map((r:string[])=>'/'+r[0]));assert.deepEqual(h.calls.previews,packet.workspace.sourceRoleCards.map((r:string[])=>r[0]));assert.equal(h.calls.reads.length,0);assert.equal(h.calls.signOut,0);
  const links=h.renderer.root.findAllByType('a').map(n=>n.props.href);assert.deepEqual(links,['/samples/gardens','/tour','/samples/farm','/samples/production']);
 }finally{await h.dispose();}
});
for(const lang of allDrafts)test(`${lang}: language changes cannot widen confirmed account roles or execute a disabled practice action`,async()=>{
 for(const role of ['farmer','mentor','student','funder','ngo','admin']){
  const h=await actualPracticeUi(lang,{user:{uid:'qa-owner'},role});try{const allowed=role==='ngo'||role==='admin'?['ngo','funder','farmer','mentor','student']:[role];for(const row of packet.workspace.sourceRoleCards){const disabled=!allowed.includes(row[0]);assert.equal(h.renderer.root.findByProps({id:'sample-'+row[0]}).findByType('button').props.disabled,disabled);if(disabled)await h.choose(row[0]);}assert.equal(h.calls.previews.length,0);await h.language(lang==='ts'?'ve':'ts');for(const row of packet.workspace.sourceRoleCards)assert.equal(h.renderer.root.findByProps({id:'sample-'+row[0]}).findByType('button').props.disabled,!allowed.includes(row[0]));assert.deepEqual(h.calls.reads,['qa-owner']);}finally{await h.dispose();}
 }
});
test('late role reads cannot grant the next account the previous account’s practice choices',async()=>{
 const h=await actualPracticeUi('ts',{user:{uid:'qa-first'},role:'ngo',deferRole:true});try{
  const disabled=()=>h.renderer.root.findAllByType('article').every(n=>n.findByType('button').props.disabled);
  assert.ok(disabled());await h.auth({user:{uid:'qa-second'},role:'farmer'});await h.resolveRole(0,'ngo');assert.ok(disabled());await h.resolveRole(1,'farmer');assert.equal(h.renderer.root.findByProps({id:'sample-farmer'}).findByType('button').props.disabled,false);assert.equal(h.renderer.root.findByProps({id:'sample-ngo'}).findByType('button').props.disabled,true);
 }finally{await h.dispose();}
});
for(const lang of allDrafts)test(`${lang}: failed access reads and failed session startup retain truthful native errors and never navigate`,async()=>{
 const h=await actualPracticeUi(lang,{user:{uid:'qa-owner'},role:'farmer',readFails:true});try{assert.ok(h.text().includes(local(lang,'Your account role could not be confirmed. Refresh your access in Account, then return here.','Indima ye-akhawunti yakho ayiqinisekisiwe. Vuselela ukufinyelela kwakho ku-I-akhawunti, bese ubuya lapha.')));assert.ok(h.renderer.root.findAllByType('article').every(n=>n.findByType('button').props.disabled));await h.choose('farmer');assert.equal(h.calls.previews.length,0);}finally{await h.dispose();}
 const failed=await actualPracticeUi(lang,{previewFails:true});try{await failed.choose('farmer');const source='The example workspace could not start. Please allow session storage and try again.',zulu='Indawo yesibonelo ayikwazanga ukuqala. Vumela ukugcinwa kolwazi lweseshini bese uzama futhi.';assert.ok(practiceNodeText(failed.renderer.root.findByProps({role:'alert'})).includes(local(lang,source,zulu)));assert.ok(failed.text().includes(source));await failed.language('st');assert.ok(failed.text().includes(local('st',source,zulu)));assert.deepEqual(failed.calls.routes,[]);}finally{await failed.dispose();}
});
for(const lang of allDrafts)test(`${lang}: shared Tour controls use native captions and preserve sample privacy and fallback visibility`,async()=>{
 const t=controlT(lang),menu=await actualPracticeUi(lang,{kind:'menu',sample:true});try{const button=menu.renderer.root.findByProps({'data-app-menu':true});assert.equal(practiceNodeText(button),t('tourPill'));assert.equal(button.props.title,local(lang,'Tour — open choices and exit','Uhambo — vula izinketho bese uphuma'));assert.ok(button.props.style.minWidth>=44);assert.ok(button.props.style.height>=44);await menu.click(button.props['aria-label']);assert.equal(menu.renderer.root.findByProps({'data-app-menu':true}).props['aria-expanded'],true);assert.ok(menu.text().includes(t('languageDraftNoticeText')));}finally{await menu.dispose();}
 const banner=await actualPracticeUi(lang,{kind:'banner',sample:true});try{assert.equal(banner.renderer.root.findByType('a').props.href,'/samples');assert.equal(banner.renderer.root.findByType('a').props['aria-label'],local(lang,'Tour — choose a view','Uhambo — khetha indawo yokusebenza'));await banner.menuPresent(true);assert.equal(banner.renderer.toJSON(),null);await banner.menuPresent(false);assert.ok(banner.text().includes(t('tourPill')));}finally{await banner.dispose();}
 const account=await actualPracticeUi(lang,{kind:'account',sample:true,user:{uid:'qa-private',displayName:'PRIVATE OWNER',email:'private@example.invalid'}});try{assert.ok(account.text().includes(t('tourPill')));assert.ok(!account.text().includes('PRIVATE'));assert.ok(!account.text().includes('private@'));const out=account.renderer.root.findByType('button');assert.ok(out.props['aria-label'].includes(local(lang,'Signing out ends access to this account on this device. Sign in again to continue.','Ukuphuma ngemvume kuvala ukufinyelela kule akhawunti kule divayisi. Ngena futhi ukuze uqhubeke.')));assert.ok(out.props['aria-label'].includes('Signing out ends access'));await account.click(practiceNodeText(out));assert.equal(account.calls.signOut,1);}finally{await account.dispose();}
 const signIn=await actualPracticeUi(lang,{kind:'account'});try{assert.equal(signIn.renderer.root.findByType('a').props.href,'/login');assert.ok(signIn.text().includes(accountText(lang,'Sign in','Ngena ngemvume',t)));}finally{await signIn.dispose();}
});
test('showcase pages and an unconfigured backend still suppress only their own controls',async()=>{
 for(const path of ['/partners','/pitch']){const h=await actualPracticeUi('ts',{kind:'banner',sample:true,path});try{assert.equal(h.renderer.toJSON(),null);}finally{await h.dispose();}}
 const absent=await actualPracticeUi('ve',{kind:'account',backend:false});try{assert.equal(absent.renderer.toJSON(),null);}finally{await absent.dispose();}
 const named=await actualPracticeUi('st',{kind:'account',sample:false,user:{uid:'qa',displayName:'QA $& {role} Name'}});try{assert.ok(named.text().includes('QA'));assert.equal(named.calls.signOut,0);}finally{await named.dispose();}
});

import ts from 'typescript';
import { SESOTHO_SAMPLE_CHOOSER_DRAFT } from '../lib/sample-chooser-translation-draft-st.ts';
import { TSHIVENDA_SAMPLE_CHOOSER_DRAFT } from '../lib/sample-chooser-translation-draft-ve.ts';
function chooserArray(name:string){const source=read('app/samples/page.tsx'),tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),declaration=tree.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations).find(d=>d.name.getText(tree)===name);assert.ok(declaration?.initializer);return new Function('return '+declaration.initializer.getText(tree).replace(/\s+as const$/,''))();}
test('chooser English and isiZulu role cards remain exact while earlier native drafts survive completion of the held fields',()=>{
 assert.deepEqual(chooserArray('examplesEn'),packet.workspace.sourceRoleCards);assert.deepEqual(chooserArray('examplesZu'),packet.workspace.existingZuluRoleCards);
 function verify(value:unknown,lang:'st'|'ve'){if(!value||typeof value!=='object')return;const row=value as Record<string,any>;if(typeof row.sourceEnglish==='string'&&row.reviewStatus==='machine-draft'){const original=row[lang==='st'?'sesothoDraft':'tshivendaDraft'],correction=packet.workspace.nativeCorrections.find((c:any)=>c.language===lang&&c.source===row.sourceEnglish);if(correction){assert.equal(original,correction.before);assert.equal(sampleWorkspaceDraft(row.sourceEnglish,lang),correction.after);}else if(SAMPLE_WORKSPACE_ROWS.some(r=>r[0]===row.sourceEnglish))assert.equal(sampleWorkspaceDraft(row.sourceEnglish,lang),original);}else for(const nested of Object.values(row))verify(nested,lang);}
 verify(SESOTHO_SAMPLE_CHOOSER_DRAFT,'st');verify(TSHIVENDA_SAMPLE_CHOOSER_DRAFT,'ve');
});
test('a cancelled access read cannot undo signing out, and a refused reset does not reload the visitor’s page',async()=>{
 const h=await actualPracticeUi('ve',{user:{uid:'qa-first'},role:'admin',deferRole:true});try{await h.auth({user:null,role:null});await h.resolveRole(0,'admin');assert.ok(h.renderer.root.findAllByType('article').every(n=>!n.findByType('button').props.disabled));assert.deepEqual(h.calls.reads,['qa-first']);}finally{await h.dispose();}
 const reset=await actualPracticeUi('st',{storageFails:true});try{await reset.click(local('st','Reset tour records','Setha kabusha amarekhodi ohambo'));assert.equal(reset.calls.resets,1);assert.equal(reset.calls.reloads,0);}finally{await reset.dispose();}
});

for(const lang of allDrafts)test(`${lang}: the actual staff role selector keeps demonstration payloads and never offers the switcher to an ordinary account`,async()=>{
 for(const role of ['ngo','admin']){const h=await actualPracticeUi(lang,{kind:'nav',sample:true,role,user:{uid:'qa-staff'}});try{
  const select=h.renderer.root.findByType('select');assert.equal(select.props['aria-label'],local(lang,'View as with demonstration records','Buka njengendima ethile ngamarekhodi okubonisa'));assert.ok(practiceNodeText(select).includes(local(lang,'Switch view…','Shintsha isikrini…')));
  const options=select.findAllByType('option');assert.deepEqual(options.map(n=>n.props.value),['','farmer','mentor','student','ngo','funder']);
  for(const value of ['farmer','mentor','student','ngo','funder']){await select.props.onChange({target:{value}});}assert.deepEqual(h.calls.previews,['farmer','mentor','student','ngo','funder']);assert.deepEqual(h.calls.routes,['/farmer','/mentor','/student','/ngo','/funder']);
 }finally{await h.dispose();}}
 const ordinary=await actualPracticeUi(lang,{kind:'nav',sample:true,role:'farmer'});try{assert.equal(ordinary.renderer.root.findAllByType('select').length,0);}finally{await ordinary.dispose();}
 const refusal=await actualPracticeUi(lang,{kind:'nav',role:'ngo',previewFails:true});try{await refusal.renderer.root.findByType('select').props.onChange({target:{value:'funder'}});assert.deepEqual(refusal.calls.routes,[]);}finally{await refusal.dispose();}
});
