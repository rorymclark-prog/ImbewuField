import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import{createHash}from'node:crypto';
import ts from'typescript';
import{loadUpdateCopy,updateDescription}from'../lib/update-copy.ts';
import{RELEASE_NOTES}from'../lib/release-notes.ts';
import{actualCommunityProfile,actualCommunityRounding,QA_COMMUNITY_PHOTO,communityNodeText}from'./community-profile-renderer.ts';
import{controlT,controlLocales}from'./control-icon-renderers.ts';
import{beforeCommunityProfileDictionary,beforeCommunityProfileTranslations,beforeCommunityMemberTranslations,beforeCommunityThreadTranslations,beforePhotoViewerTranslations}from'./ui-dictionary-preservation.ts';
const read=(p:string)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const packet=JSON.parse(read('docs/translation/four-language-completion/community-profile-drafts.json'));
const langs=['zu','st','ts','ve']as const;
const tokens=(s:string)=>(s.match(/\{[^{}]+\}|\d+(?:[.,]\d+)?/g)??[]).sort();
const cropOptions=()=>{const source=read('app/community/profile/page.tsx'),tree=ts.createSourceFile('profile',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);return tree.statements.filter(ts.isVariableStatement).flatMap(n=>n.declarationList.declarations).find(n=>ts.isIdentifier(n.name)&&n.name.text==='CROP_OPTIONS')?.getText(tree);};

test('community drafts bind every source, figure, placeholder and prior locale byte, while catalogue identities stay exact',()=>{
 assert.equal(cropOptions(),packet.cropOptionsSource);
 for(const lang of langs){
  for(const row of packet.entries){assert.equal(controlT('en')(row.key),row.english);if(row[lang]){assert.equal(controlT(lang)(row.key),row[lang]);assert.notEqual(row[lang],row.english);assert.deepEqual(tokens(row[lang]),tokens(row.english));}}
  for(const old of packet.sourceControls)if(!packet.entries.some((r:any)=>r.key===old.key&&r[lang]))assert.equal(controlLocales[lang][old.key]??null,old[lang]);
  const source=beforeCommunityMemberTranslations(beforeCommunityThreadTranslations(beforePhotoViewerTranslations(read(`lib/locales/${lang}.ts`),lang),lang),lang);assert.equal(createHash('sha256').update(beforeCommunityProfileTranslations(source,lang)).digest('hex'),packet.sourceSha256[`lib/locales/${lang}.ts`]);
  const changed=source.replace(JSON.stringify(controlT(lang)('communityPhotoUploadError')),JSON.stringify('Unlisted change'));assert.equal(beforeCommunityProfileTranslations(changed,lang),changed);
  const partial={...controlLocales[lang]};delete partial.communityPhotoUploadError;assert.equal(beforeCommunityProfileDictionary(partial,lang),partial);
  const learning={...controlLocales[lang],studentContinue:'changed lesson'};assert.equal((beforeCommunityProfileDictionary(learning,lang)as any).studentContinue,'changed lesson');
 }
 for(const[key,value]of Object.entries(packet.englishAdditions))assert.equal(controlT('en')(key),value);
});

for(const lang of langs)test(`${lang}: actual profile preserves owned text, source privacy clauses, original payload and save delay`,async()=>{
 const h=await actualCommunityProfile(lang),t=controlT(lang);try{
  assert.ok(h.text().includes(t('communityEditProfileTitle')));assert.ok(h.text().includes(t('languageDraftNoticeText')));assert.ok(h.text().includes(t('communityEditProfileIntro')));assert.ok(h.text().includes(controlT('en')('communityEditProfileIntro')));
  assert.equal(h.renderer.root.findByProps({id:'community-profile-display-name'}).props.value,'QA public name');assert.equal(h.renderer.root.findByProps({role:'switch'}).props['aria-label'],t('communityShowOnMapLabel'));assert.equal(h.renderer.root.findByProps({role:'switch'}).props['aria-checked'],false);
  await h.change('community-profile-display-name','  QA $& {name}  ');await h.change('community-profile-area','  QA district  ');await h.change('community-profile-bio','  QA bio  ');await h.button('beans');await h.button(t('communitySaveProfile'));
  assert.deepEqual(h.calls.saves,[{display_name:'QA $& {name}',area_text:'QA district',bio:'QA bio',crops:['maize','beans'],photos:[],show_on_map:false,coarse_lat:null,coarse_lon:null}]);assert.ok(h.text().includes(t('communityProfileSaved')));await h.timer(2500);assert.ok(h.text().includes(t('communitySaveProfile')));assert.equal(h.calls.geo.length,0);
 }finally{await h.dispose();}
});

test('an explicit empty name keeps the original canonical fallback, and the existing bio limit changes no characters before its boundary',async()=>{
 const h=await actualCommunityProfile('ts',{profile:null});try{await h.change('community-profile-display-name',' ');await h.change('community-profile-bio','x'.repeat(241));assert.equal(h.renderer.root.findByProps({id:'community-profile-bio'}).props.value,'x'.repeat(240));await h.button(controlT('ts')('communitySaveProfile'));assert.equal(h.calls.saves[0].display_name,'A farmer');assert.equal(h.calls.saves[0].bio,'x'.repeat(240));}finally{await h.dispose();}
});

for(const lang of langs)test(`${lang}: failed reads offer retry instead of an empty saveable profile; obsolete reads cannot fill a later owner`,async()=>{
 const h=await actualCommunityProfile(lang,{loadFailures:1}),t=controlT(lang);try{assert.ok(h.text().includes(t('communityProfileLoadError')));assert.equal(h.renderer.root.findAllByType('input').length,0);assert.equal(h.calls.saves.length,0);await h.button(t('communityRetry'));assert.equal(h.calls.reads.length,2);assert.equal(h.renderer.root.findByProps({id:'community-profile-display-name'}).props.value,'QA public name');}finally{await h.dispose();}
 const x=await actualCommunityProfile(lang,{deferLoad:true});try{assert.equal(x.renderer.root.findByProps({role:'status'}).props['aria-label'],t('communityLoadingStatus'));await x.user({uid:'qa-next-owner',displayName:'QA Next'});await x.resolveLoad(0,{display_name:'OLD PRIVATE NAME',crops:['beans'],show_on_map:true,coarse_lat:10,coarse_lon:10});assert.ok(!x.text().includes('OLD PRIVATE NAME'));await x.resolveLoad(1,null);assert.equal(x.renderer.root.findByProps({id:'community-profile-display-name'}).props.value,'QA Next');assert.equal(x.renderer.root.findByProps({role:'switch'}).props['aria-checked'],false);}finally{await x.dispose();}
});

for(const lang of langs)test(`${lang}: map opt-in, original coarse coordinates, failed-location off state and retained draft all survive language changes`,async()=>{
 const h=await actualCommunityProfile(lang);try{await h.toggle();assert.equal(h.calls.geo.length,1);assert.deepEqual(h.calls.geo[0],{enableHighAccuracy:false,timeout:8000});assert.ok(h.text().includes(controlT(lang)('communityLocationPending')));await h.geolocation(-29.123456,30.654321);await h.button(controlT(lang)('communitySaveProfile'));assert.deepEqual({lat:h.calls.saves[0].coarse_lat,lon:h.calls.saves[0].coarse_lon},actualCommunityRounding(-29.123456,30.654321));assert.equal(h.calls.saves[0].show_on_map,true);await h.timer(2500);await h.toggle();await h.button(controlT(lang)('communitySaveProfile'));assert.equal(h.calls.saves[1].show_on_map,false);assert.equal(h.calls.saves[1].coarse_lat,null);assert.equal(h.calls.saves[1].coarse_lon,null);assert.equal(h.calls.geo.length,1);}finally{await h.dispose();}
 const denied=await actualCommunityProfile(lang);try{await denied.toggle();await denied.denyLocation();assert.equal(denied.renderer.root.findByProps({role:'switch'}).props['aria-checked'],false);assert.ok(denied.text().includes(controlT(lang)('communityLocationDenied')));await denied.language('ve');assert.ok(denied.text().includes(controlT('ve')('communityLocationDenied')));}finally{await denied.dispose();}
 const unsupported=await actualCommunityProfile(lang,{unsupportedLocation:true});try{await unsupported.toggle();assert.equal(unsupported.calls.geo.length,0);assert.ok(unsupported.text().includes(controlT(lang)('communityLocationUnsupported')));assert.equal(unsupported.renderer.root.findByProps({role:'switch'}).props['aria-checked'],false);}finally{await unsupported.dispose();}
});

for(const lang of langs)test(`${lang}: photo actions expose native names but retain the same resize/upload/delete identities and four-photo limit`,async()=>{
 const h=await actualCommunityProfile(lang),t=controlT(lang);try{await h.upload({name:'qa-photo'});assert.deepEqual(h.calls.uploads,[{file:'qa-resized-photo',folder:'community'}]);assert.deepEqual(h.calls.resizes,[{name:'qa-photo'}]);assert.equal(h.renderer.root.findByType('img').props.alt,t('communityProfilePhotoAlt').replace('{number}','1'));await h.button(t('communityRemovePhotoAria').replace('{number}','1'));assert.equal(h.renderer.root.findAllByType('img').length,0);for(let i=0;i<4;i++)await h.upload({name:'qa-'+i});const uploads=h.calls.uploads.length;await h.upload({name:'qa-extra'});assert.equal(h.calls.uploads.length,uploads);assert.equal(h.renderer.root.findAllByType('img').length,4);assert.equal(h.renderer.root.findAllByType('button').filter(n=>n.props['aria-label']===t('communityAddPhotoAria')).length,0);}finally{await h.dispose();}
});

test('photo failures/null URLs and profile-save failures have native feedback without clearing owned fields',async()=>{
 for(const options of[{uploadFails:true},{uploadNull:true}]){const h=await actualCommunityProfile('st',options);try{await h.upload({name:'qa-photo'});assert.ok(h.text().includes(controlT('st')('communityPhotoUploadError')));assert.equal(h.renderer.root.findAllByType('img').length,0);await h.language('ts');assert.ok(h.text().includes(controlT('ts')('communityPhotoUploadError')));}finally{await h.dispose();}}
 const h=await actualCommunityProfile('ve',{saveFails:true});try{await h.change('community-profile-bio','QA edited text');await h.button(controlT('ve')('communitySaveProfile'));assert.ok(h.text().includes(controlT('ve')('communityProfileSaveError')));await h.language('st');assert.ok(h.text().includes(controlT('st')('communityProfileSaveError')));assert.equal(h.renderer.root.findByProps({id:'community-profile-bio'}).props.value,'QA edited text');}finally{await h.dispose();}
});

for(const lang of langs)test(`${lang}: real source-paired destructive confirmation preserves cancellation, focus, delete identity and destination`,async()=>{
 const h=await actualCommunityProfile(lang),t=controlT(lang);try{
  await h.button(t('communityDeleteProfile'));const dialog=h.renderer.root.findByProps({role:'alertdialog'});assert.equal(dialog.props.lang,lang);assert.equal(dialog.props['aria-label'],t('communityDeleteProfileConfirm'));assert.ok(communityNodeText(dialog).includes(controlT('en')('communityDeleteProfileConfirm')));assert.ok(communityNodeText(dialog).includes(t('languageDraftNoticeText')));assert.ok(h.calls.focus);assert.equal(h.calls.deletes,0);await h.button(t('cancelBtn'));assert.equal(h.calls.deletes,0);await h.button(t('communityDeleteProfile'));await h.escape();assert.equal(h.calls.deletes,0);await h.button(t('communityDeleteProfile'));await h.button(t('communityDeleteProfile'));assert.equal(h.calls.deletes,1);assert.deepEqual(h.calls.routes,['/community']);assert.deepEqual(h.calls.questions[0].englishSource,{message:controlT('en')('communityDeleteProfileConfirm'),confirmLabel:controlT('en')('communityDeleteProfile'),cancelLabel:controlT('en')('cancelBtn')});
 }finally{await h.dispose();}
});

test('failed and pending deletion retain the profile instead of claiming a completed deletion',async()=>{
 const h=await actualCommunityProfile('ts',{deleteFails:true});try{await h.button(controlT('ts')('communityDeleteProfile'));await h.button(controlT('ts')('communityDeleteProfile'));assert.ok(h.text().includes(controlT('ts')('communityProfileDeleteError')));assert.equal(h.calls.routes.length,0);assert.equal(h.renderer.root.findByProps({id:'community-profile-display-name'}).props.value,'QA public name');await h.language('ve');assert.ok(h.text().includes(controlT('ve')('communityProfileDeleteError')));}finally{await h.dispose();}
 const busy=await actualCommunityProfile('st',{deferDelete:true});try{await busy.button(controlT('st')('communityDeleteProfile'));await busy.button(controlT('st')('communityDeleteProfile'));const button=busy.renderer.root.findAllByType('button').find(n=>communityNodeText(n).includes(controlT('st')('communityProfileDeleting')));assert.ok(button?.props.disabled);await busy.finishDelete();assert.deepEqual(busy.calls.routes,['/community']);}finally{await busy.dispose();}
});

test('Simple keeps selected catalogue identities visible, and original feature/auth redirects remain',async()=>{
 const h=await actualCommunityProfile('ts',{simple:true,profile:{crops:['maize']}});try{const chips=()=>h.renderer.root.findAllByType('button').filter(n=>n.props.lang==='en').map(communityNodeText);assert.equal(chips().length,6);await h.button(controlT('ts')('communityMoreCrops'));assert.equal(chips().length,14);assert.ok(chips().includes('sweet potato'));await h.level(false);assert.equal(chips().length,14);}finally{await h.dispose();}
 const selected=await actualCommunityProfile('ve',{simple:true,profile:{crops:['seedlings']}});try{assert.equal(selected.renderer.root.findAllByType('button').filter(n=>n.props.lang==='en').length,14);}finally{await selected.dispose();}
 const disabled=await actualCommunityProfile('st',{enabled:false});try{assert.deepEqual(disabled.calls.replacements,['/home']);assert.equal(disabled.calls.reads.length,0);}finally{await disabled.dispose();}
 const signedOut=await actualCommunityProfile('zu',{signedOut:true});try{assert.deepEqual(signedOut.calls.replacements,['/login']);assert.equal(signedOut.calls.reads.length,0);}finally{await signedOut.dispose();}
});

 test('the community profile release keeps its exact source and four native draft descriptions',async()=>{const note=RELEASE_NOTES.find(n=>n.sha===packet.sourceSha.slice(0,8));assert.ok(note?.changes.includes(packet.releasePair.english));assert.equal(note?.tour?.[0]?.href,packet.guideRoute);for(const lang of langs)for(const row of[packet.releasePair,...packet.guidePairs])assert.equal(updateDescription(await loadUpdateCopy(lang),row.english),row[lang]);});

for(const lang of langs)test(`${lang}: an outstanding photo upload announces native progress and cannot offer another photo yet`,async()=>{
 const h=await actualCommunityProfile(lang,{deferUpload:true}),t=controlT(lang);try{await h.upload({name:'qa-photo'});const busy=h.renderer.root.findAllByType('button').find(n=>n.props['aria-label']===t('communityPhotoUploading'));assert.ok(busy?.props.disabled);assert.equal(busy?.props['aria-busy'],true);assert.equal(h.renderer.root.findAllByType('img').length,0);await h.finishUpload();assert.equal(h.renderer.root.findByType('img').props.alt,t('communityProfilePhotoAlt').replace('{number}','1'));assert.ok(h.renderer.root.findAllByType('button').some(n=>n.props['aria-label']===t('communityAddPhotoAria')&&!n.props.disabled));}finally{await h.dispose();}
});
