import{UserFacingError}from'../lib/user-facing-error.ts';
import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import{createHash}from'node:crypto';
import{actualAccountUi,accountNodeText}from'./account-ui-renderer.ts';
import{controlT,controlLocales,type ControlLanguage}from'./control-icon-renderers.ts';
import{accountText,accountErrorText,accountRoleName,allowanceResetLabel,fillAccountText}from'../lib/account-copy.ts';
import{ACCOUNT_DRAFTS,ACCOUNT_KEYS}from'../lib/account-copy-data.ts';
import{loadUpdateCopy,updateDescription}from'../lib/update-copy.ts';
import{AUTH_ERROR_KEYS}from'../lib/auth-error-copy.ts';
import{beforeAccountDictionary,beforeAccountTranslations,beforeCommunityProfileTranslations,beforeCommunityMemberTranslations,beforeCommunityThreadTranslations,beforePhotoViewerTranslations}from'./ui-dictionary-preservation.ts';
import{recordsMonthLong}from'../lib/records-months.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const packet=JSON.parse(read('docs/translation/four-language-completion/account-drafts.json'));
const langs=['zu','st','ts','ve']as const;
const local=(lang:ControlLanguage,source:string)=>accountText(lang,source,packet.inlineControls.find((r:any)=>r.english===source)?.zu[0]??ACCOUNT_DRAFTS[source]?.zu??source,controlT(lang));
const tokens=(s:string)=>(s.match(/\{[^{}]+\}|\d+(?:[.,]\d+)?/g)??[]).sort();

test('account drafts retain exact sources, inline isiZulu and shared controls without changing calibrated dictionary bytes',()=>{
 for(const lang of langs){
  for(const row of packet.entries){assert.equal(controlT('en')(row.key),row.english);if(row[lang])assert.equal(controlT(lang)(row.key),row[lang]);}
  for(const row of packet.bodyEntries){assert.equal(ACCOUNT_DRAFTS[row.english][lang],row[lang]);assert.equal(local(lang,row.english),row[lang],'the runtime must select this language, not just retain unused draft data');assert.deepEqual(tokens(row[lang]),tokens(row.english));if(!(row.english==='dashboard'&&lang==='ts'))assert.notEqual(row[lang],row.english);}
  const source=beforeCommunityProfileTranslations(beforeCommunityMemberTranslations(beforeCommunityThreadTranslations(beforePhotoViewerTranslations(read(`lib/locales/${lang}.ts`),lang),lang),lang),lang),hash=createHash('sha256').update(beforeAccountTranslations(source,lang)).digest('hex');assert.equal(hash,packet.sourceSha256[`lib/locales/${lang}.ts`]);
  if(lang!=='zu'){const broken=source.replace(JSON.stringify(controlT(lang)('profileChangePhoto')),JSON.stringify('Unlisted edit'));assert.equal(beforeAccountTranslations(broken,lang),broken);const partial={...controlLocales[lang]};delete partial.profileChangePhoto;assert.equal(beforeAccountDictionary(partial,lang),partial);}
 }
 for(const[source,key]of Object.entries(packet.authSourceKeys)){assert.equal(AUTH_ERROR_KEYS[source],key);for(const lang of langs)assert.notEqual(controlT(lang)(key as string),controlT('en')(key as string),'a known auth message must use a native description');}
 for(const[source,key]of Object.entries(ACCOUNT_KEYS))assert.equal(controlT('en')(key),source,'shared meaning must match the exact English source');
 for(const row of packet.inlineControls)assert.equal(local('zu',row.english),row.zu[0],'existing isiZulu inline wording remains exact');
 assert.equal(accountErrorText('ts','External user text {name}',controlT('ts')).text,'External user text {name}');assert.equal(accountErrorText('ts','constructor',controlT('ts')).known,false);
 assert.equal(accountErrorText('ve','Something went wrong (auth/raw-code).',controlT('ve')).text,fillAccountText(ACCOUNT_DRAFTS['Something went wrong ({code}).'].ve,{code:'auth/raw-code'}));
 const values=Object.assign(Object.create({missing:'inherited'}),{name:'$& {other}'});assert.equal(fillAccountText('{name} {missing}',values),'$& {other} {missing}');
 assert.equal(accountRoleName('unknown-saved-role',(en)=>en),'unknown-saved-role');
});

for(const lang of langs)test(`${lang}: actual profile controls save the same typed values and language, then sign out to the original destination`,async()=>{
 const h=await actualAccountUi(lang);try{
  assert.ok(h.text().includes(local(lang,'Account')));assert.ok(h.text().includes(controlT(lang)('languageDraftNoticeText')));assert.ok(h.text().includes('QA Name'));assert.ok(h.text().includes('qa@example.invalid'));
  await h.button(local(lang,'Edit'));const name=h.renderer.root.findByProps({placeholder:local(lang,'Your full name')});await h.change(name,'  QA $& {name}  ');await h.change(h.renderer.root.findByProps({type:'tel'}),'  QA phone  ');await h.change(h.renderer.root.findByProps({placeholder:local(lang,'e.g. Ubhejane Creche')}),'  QA business  ');await h.change(h.renderer.root.findByType('select'),lang);await h.button(local(lang,'Save'));
  assert.deepEqual(h.calls.updates,[{full_name:'QA $& {name}',phone:'QA phone',farm_name:'QA business',language:lang}]);assert.equal(h.calls.refresh,1);await h.button(local(lang,'Sign out'));assert.equal(h.calls.signOut,1);assert.deepEqual(h.calls.routes,['/login']);
 }finally{await h.dispose();}
});

test('blank profile fields keep the original omission/null meanings and errors retain edited values across language changes',async()=>{
 const h=await actualAccountUi('st',{saveError:'failed'});try{await h.button(local('st','Edit'));await h.change(h.renderer.root.findByProps({placeholder:local('st','Your full name')}),'  ');await h.change(h.renderer.root.findByProps({type:'tel'}),'  ');await h.change(h.renderer.root.findByProps({placeholder:local('st','e.g. Ubhejane Creche')}),'  ');await h.button(local('st','Save'));assert.deepEqual(h.calls.updates[0],{full_name:undefined,phone:null,farm_name:null,language:'en'});assert.ok(h.text().includes(local('st','Could not save. Try again.')));await h.language('ve');assert.ok(h.text().includes(local('ve','Could not save. Try again.')));assert.equal(h.renderer.root.findByType('select').props.value,'en');assert.equal(h.renderer.root.findByProps({type:'tel'}).props.value,'  ');}finally{await h.dispose();}
 const x=await actualAccountUi('ts',{saveError:new UserFacingError('Saved error in an unknown language')});try{await x.button(local('ts','Edit'));await x.button(local('ts','Save'));assert.equal(x.renderer.root.findAllByType('bdi').find(n=>accountNodeText(n)==='Saved error in an unknown language')?.props.lang,'');}finally{await x.dispose();}
});

for(const lang of langs)test(`${lang}: password validation and backend messages repaint without changing the request or closing a failed form`,async()=>{
 const h=await actualAccountUi(lang,{passwordError:'Incorrect password — try again.'});try{
  await h.button(local(lang,'Change password'));const fields=()=>h.renderer.root.findAll(n=>n.type==='input'&&n.props.type==='password');await h.change(fields()[0],'old password');await h.change(fields()[1],'abcdef');await h.change(fields()[2],'different');await h.button(local(lang,'Update password'));assert.equal(h.calls.passwords.length,0);assert.ok(h.text().includes(local(lang,'New passwords do not match.')));
  await h.language('ts');assert.ok(h.text().includes(local('ts','New passwords do not match.')));await h.change(fields()[1],'abc');await h.change(fields()[2],'abc');await h.button(local('ts','Update password'));assert.ok(h.text().includes(local('ts','Password must be at least 6 characters.')));assert.equal(h.calls.passwords.length,0);
  await h.change(fields()[1],'abcdef');await h.change(fields()[2],'abcdef');await h.button(local('ts','Update password'));assert.deepEqual(h.calls.passwords,[['old password','abcdef']]);assert.ok(h.text().includes(controlT('ts')(AUTH_ERROR_KEYS['Incorrect password — try again.'])));assert.equal(fields()[0].props.value,'old password');
 }finally{await h.dispose();}
});

test('successful password updates keep the original close delay, while photo/logo paths retain their payloads and error sources',async()=>{
 const h=await actualAccountUi('ve');try{await h.button(local('ve','Change password'));const fields=h.renderer.root.findAll(n=>n.type==='input'&&n.props.type==='password');for(const f of fields)await h.change(f,'abcdef');await h.button(local('ve','Update password'));assert.ok(h.text().includes(local('ve','Password updated successfully.')));assert.ok([...h.timers.values()].some(t=>t.ms===2000));await h.timer(2000);assert.equal(h.renderer.root.findAll(n=>n.type==='input'&&n.props.type==='password').length,0);await h.upload(0,{name:'qa-photo'});assert.deepEqual(h.calls.uploads,[{file:'qa-resized-photo',kind:'avatars'}]);assert.deepEqual(h.calls.updates,[{photo_url:'qa-photo-url'}]);await h.button(local('ve','Edit'));await h.upload(1,{name:'qa-logo'});assert.deepEqual(h.calls.updates.at(-1),{farm_logo:'qa-logo-data'});}finally{await h.dispose();}
 const failed=await actualAccountUi('st',{photoError:'failed'});try{await failed.upload(0,{name:'qa-photo'});assert.ok(failed.text().includes(local('st','Could not update your photo.')));await failed.language('ts');assert.ok(failed.text().includes(local('ts','Could not update your photo.')));}finally{await failed.dispose();}
});

for(const lang of langs)test(`${lang}: sample, sign-in and slow-auth doors keep their actions and Simple still discloses extra settings`,async()=>{
 const sample=await actualAccountUi(lang,{sample:true,signedOut:true});try{assert.ok(sample.text().includes(local(lang,'Tour account'))||sample.text().includes('QA practice profile'));assert.ok(sample.text().includes(local(lang,'You are using the practice version. Nothing here is saved to a real account — sign in to keep your own records.')));await sample.button(local(lang,'Exit tour'));assert.equal(sample.calls.exit,1);assert.deepEqual(sample.calls.routes,['/home']);}finally{await sample.dispose();}
 const h=await actualAccountUi(lang,{signedOut:true,loading:true});try{assert.ok(h.text().includes(local(lang,'Loading your account…')));await h.timer(4000);assert.ok(h.text().includes(local(lang,'Still loading… you can sign in instead.')));await h.button(local(lang,'Sign in'));assert.deepEqual(h.calls.routes,['/login']);}finally{await h.dispose();}
 const simple=await actualAccountUi(lang,{simple:true});try{assert.ok(!simple.text().includes(local(lang,'Your app access')));assert.ok(!simple.text().includes(local(lang,'Role')));assert.equal(simple.renderer.root.findAllByProps({'aria-label':local(lang,'Change password')}).length,0);await simple.button(local(lang,'More account settings'));assert.ok(simple.text().includes(local(lang,'Change password')));assert.ok(simple.text().includes(local(lang,'Your app access')));assert.ok(simple.text().includes(local(lang,'Role')));}finally{await simple.dispose();}
});

for(const lang of langs)test(`${lang}: account access labels cannot change dashboard destinations, preview identities or permissions`,async()=>{
 const h=await actualAccountUi(lang,{kind:'access',role:'admin'});try{const links=h.renderer.root.findAllByType('a').filter(n=>n.props.href!=='/samples');assert.deepEqual(links.map(n=>n.props.href),['/farmer','/student','/mentor','/ngo','/funder']);const roles=['Farmer','Student','Mentor','Organisation','Funder'];for(const name of roles){const button=h.renderer.root.findAllByType('button').find(n=>n.props['aria-label']===local(lang,`Open ${name} practice view`));assert.ok(button);await h.button(button.props['aria-label']);}assert.deepEqual(h.calls.previews,roles.map(r=>r.toLowerCase()));assert.deepEqual(h.calls.routes,['/farmer','/student','/mentor','/ngo','/funder']);assert.equal(h.profile.role,'admin');assert.equal(h.calls.updates.length,0);await h.button(`${local(lang,'Refresh my access')} (Refresh my access)`);assert.ok(h.text().includes(local(lang,'Access refreshed.')));await h.language('ts');assert.ok(h.text().includes(local('ts','Access refreshed.')));}finally{await h.dispose();}
 const ordinary=await actualAccountUi(lang,{kind:'access',role:'farmer'});try{assert.equal(ordinary.renderer.root.findAllByType('button').length,1);assert.equal(ordinary.renderer.root.findAllByType('a').length,0);}finally{await ordinary.dispose();}
});

for(const lang of langs)test(`${lang}: allowance figures, model-fallback meaning, reset day and progress arithmetic survive translation`,async()=>{
 for(const capped of[false,true]){const a={kind:'user',capZar:120,spentZar:33,remainingZar:87,capped,resetsOn:'2026-11-01'},h=await actualAccountUi(lang,{kind:'allowance',allowance:a});try{const progress=h.renderer.root.findByProps({role:'progressbar'});assert.equal(progress.props['aria-valuenow'],28);assert.equal(progress.props['aria-label'],local(lang,'AI allowance used'));const source=capped?"This month's full AI allowance is used. AI still works, on a simpler model, until {date}.":'R{remaining} of R{cap} left. Refills on {date}.';const date=allowanceResetLabel(lang,a.resetsOn),expected=fillAccountText(ACCOUNT_DRAFTS[source][lang],{remaining:'87.00',cap:'120.00',date});assert.ok(h.text().includes(expected));const base=new Date(a.resetsOn+'T00:00:00Z');assert.equal(date,`${base.getDate()} ${recordsMonthLong(lang,base.getMonth()+1)}`);assert.ok(!/\{(?:date|remaining|cap)\}/.test(h.text()));}finally{await h.dispose();}}
});

for(const lang of langs)test(`${lang}: the actual shared dialog translates its default Cancel while custom choices, focus, Escape and answers remain intact`,async()=>{
 const h=await actualAccountUi(lang,{kind:'confirm'});try{const answer=await h.question({message:'QA question',confirmLabel:'QA proceed'});assert.equal(h.renderer.root.findByProps({role:'alertdialog'}).props['aria-label'],'QA question');assert.ok(h.calls.focus);await h.button(controlT(lang)('cancelBtn'));assert.equal(answer(),false);const yes=await h.question({message:'QA second question',confirmLabel:'QA proceed',cancelLabel:'QA custom decline'});assert.ok(h.text().includes('QA custom decline'));await h.button('QA proceed');assert.equal(yes(),true);const no=await h.question({message:'QA question',confirmLabel:'QA proceed'});await h.escape();assert.equal(no(),false);}finally{await h.dispose();}
});

 test('the new account release description uses all four drafts without altering old notice descriptions',async()=>{for(const lang of langs)assert.equal(updateDescription(await loadUpdateCopy(lang),packet.releasePair.english),packet.releasePair[lang]);});

for(const lang of langs)test(`${lang}: sharing clauses keep their exact scopes and source while permissions remain explicit and off by default`,async()=>{
 const {CONSENT_SCOPES,CONSENT_PANEL_HEADING}=await import('../lib/consent.ts');assert.deepEqual(CONSENT_SCOPES,packet.consent.scopes);assert.deepEqual(CONSENT_PANEL_HEADING,packet.consent.heading);
 const h=await actualAccountUi(lang,{kind:'consent',organisation:'QA $& {name}'});try{
  assert.ok(h.text().includes(controlT(lang)('popiaConsentDraftNotice')));assert.ok(h.text().includes('QA $& {name}'));const intro=packet.consent.sourceRows.find((s:string)=>s.startsWith('Nothing here is shared'));assert.ok(h.text().includes(fillAccountText(ACCOUNT_DRAFTS[intro][lang],{organisation:(lang==='zu'?'i-':'')+'QA $& {name}'})));assert.ok(!h.text().includes('{organisation}'));let inputs=h.renderer.root.findAll(n=>n.type==='input'&&n.props.type==='checkbox');assert.equal(inputs.length,6);assert.ok(inputs.every(n=>!n.props.checked));
  for(const[i,scope]of CONSENT_SCOPES.entries()){assert.equal(inputs[i].props['aria-label'],local(lang,scope.label));assert.equal(inputs[i].props['aria-describedby'],'consent-detail-'+scope.id);assert.ok(h.text().includes(scope.label));assert.ok(h.text().includes(scope.detail));assert.ok(h.text().includes(local(lang,scope.detail)));await h.consentToggle(i,true);}
  assert.deepEqual(h.calls.consentWrites,CONSENT_SCOPES.map(s=>({scope:s.id,next:true})));assert.ok(h.text().includes(fillAccountText(ACCOUNT_DRAFTS['You are sharing {count} of {total} things.'][lang],{count:'6',total:'6'})));await h.button(local(lang,'Stop sharing everything'));assert.equal(h.calls.revocations,1);inputs=h.renderer.root.findAll(n=>n.type==='input'&&n.props.type==='checkbox');assert.ok(inputs.every(n=>!n.props.checked));assert.ok(h.text().includes(local(lang,'You are not sharing anything.')));
 }finally{await h.dispose();}
});

test('a failed sharing read never pretends every scope is off, and retry/failed writes retain the last real permissions',async()=>{
 const {emptyConsent,setScope}=await import('../lib/consent.ts'),saved=setScope(emptyConsent('qa-account-owner','qa-org','2026-01-01'),'sales',true,'2026-01-01');
 const h=await actualAccountUi('st',{kind:'consent',consent:saved,consentLoadFailures:1,consentWriteError:true});try{assert.equal(h.renderer.root.findAll(n=>n.type==='input'&&n.props.type==='checkbox').length,0);assert.ok(h.text().includes(local('st',"Couldn't load your sharing settings. Check your connection and try again.")));await h.button(local('st','Retry'));assert.equal(h.renderer.root.findAllByProps({type:'checkbox'})[0].props.checked,true);await h.consentToggle(0,false);assert.equal(h.renderer.root.findAllByProps({type:'checkbox'})[0].props.checked,true);assert.ok(h.text().includes(local('st','That did not save. Your sharing settings have not changed.')));await h.language('ve');assert.ok(h.text().includes(local('ve','That did not save. Your sharing settings have not changed.')));assert.deepEqual(h.calls.consentWrites,[{scope:'sales',next:false}]);}finally{await h.dispose();}
 const busy=await actualAccountUi('ts',{kind:'consent',consentWriteDelay:true});try{await busy.consentToggle(0,true);assert.ok(busy.renderer.root.findAllByProps({type:'checkbox'}).every(n=>n.props.disabled));await busy.finishConsent();assert.ok(busy.renderer.root.findAllByProps({type:'checkbox'}).every(n=>!n.props.disabled));assert.equal(busy.renderer.root.findAllByProps({type:'checkbox'})[0].props.checked,true);}finally{await busy.dispose();}
});

 test('sharing load and withdrawal failures retain their own states and never invent an all-off result',async()=>{
  const {emptyConsent,setScope}=await import('../lib/consent.ts'),saved=setScope(emptyConsent('qa-account-owner','qa-org','2026-01-01'),'location',true,'2026-01-01');
  const h=await actualAccountUi('ve',{kind:'consent',consent:saved,consentRevokeError:true});try{await h.button(local('ve','Stop sharing everything'));assert.equal(h.renderer.root.findAllByProps({type:'checkbox'})[5].props.checked,true);assert.equal(h.calls.revocations,1);assert.ok(h.text().includes(local('ve','That did not save. Your sharing settings have not changed.')));}finally{await h.dispose();}
  const loading=await actualAccountUi('ts',{kind:'consent',consentLoading:true});try{assert.ok(loading.text().includes(local('ts','Loading…')));assert.equal(loading.renderer.root.findAllByProps({type:'checkbox'}).length,0);}finally{await loading.dispose();}
 });
