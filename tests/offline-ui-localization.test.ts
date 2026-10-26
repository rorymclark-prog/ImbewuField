import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { act } from 'react-test-renderer';
import { actualOfflineUi,offlineNodeText,offlineQaRows } from './offline-ui-renderer.ts';
import { controlLocales,controlT,type ControlLanguage } from './control-icon-renderers.ts';
import { beforeOfflineDeviceDictionary,beforeOfflineDeviceTranslations,beforeUpdateNoticeTranslations, beforeAccountTranslations, beforeCommunityProfileTranslations,beforeCommunityMemberTranslations,beforeCommunityThreadTranslations ,beforePhotoViewerTranslations} from './ui-dictionary-preservation.ts';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const packet=JSON.parse(read('docs/translation/four-language-completion/offline-device-drafts.json'));
const langs=['zu','st','ts','ve']as const;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const placeholders=(s:string)=>(s.match(/\{\w+\}/g)??[]).sort();

test('device-page drafts keep exact English, existing isiZulu, placeholders and undeclared locale bytes',()=>{
  assert.equal(hash(read('lib/i18n.tsx')),packet.sourceSha256['lib/i18n.tsx']);
  for(const lang of langs){
    for(const row of packet.entries){if(typeof row[lang]!=='string')continue;assert.equal(controlT(lang)(row.key),row[lang]);assert.equal(controlT('en')(row.key),row.english);assert.notEqual(row[lang],row.english);assert.deepEqual(placeholders(row[lang]),placeholders(row.english));assert.deepEqual(row[lang].match(/\d+/g)??[],row.english.match(/\d+/g)??[]);}
    for(const row of packet.sourceControls)if(!packet.entries.some((e:any)=>e.key===row.key&&typeof e[lang]==='string'))assert.equal(controlLocales[lang][row.key]??null,row[lang]);
    const original=beforeUpdateNoticeTranslations(beforeAccountTranslations(beforeCommunityProfileTranslations(beforeCommunityMemberTranslations(beforeCommunityThreadTranslations(beforePhotoViewerTranslations(read(`lib/locales/${lang}.ts`),lang),lang),lang),lang),lang),lang),rewound=beforeOfflineDeviceTranslations(original,lang);
    assert.equal(hash(rewound),packet.sourceSha256[`lib/locales/${lang}.ts`]);
    const broken=original.replace(JSON.stringify(controlT(lang)('offlineBadgeOffline')),JSON.stringify('Broken draft'));
    assert.equal(beforeOfflineDeviceTranslations(broken,lang),broken,'changed draft cannot be hidden by a historical projection');
    const partial={...controlLocales[lang]};delete partial.offlineBadgeOffline;assert.equal(beforeOfflineDeviceDictionary(partial,lang),partial);
    const lesson={...controlLocales[lang],studentContinue:'Changed lesson'};assert.equal((beforeOfflineDeviceDictionary(lesson,lang)as any).studentContinue,'Changed lesson');
  }
});

for(const lang of [...langs,'en']as ControlLanguage[])test(`${lang}: offline page renders native queue states, exact source, actual counts and original records`,async()=>{
 const h=await actualOfflineUi(lang),t=controlT(lang),before=JSON.stringify([...h.values]);
 try{
  assert.ok(h.text().includes(t('offlineConnectedSentence')));assert.ok(h.text().includes(t('offlineNeedsReview')));assert.ok(h.text().includes(t('offlineSending')));assert.ok(h.text().includes(t('offlineWaitingToSend')));
  assert.ok(h.text().includes(t('offlineEntriesWaiting').replace('{count}','3')));assert.ok(h.text().includes(t('offlineCachedCount').replace('{count}','1')));
  assert.ok(!h.text().includes('PRIVATE OTHER OWNER'));assert.ok(h.text().includes('My own unchanged garden name'));assert.equal(h.renderer.root.findAllByType('bdi').find(n=>offlineNodeText(n)==='My own unchanged garden name')!.props.lang,'','unknown saved text is not retagged as a translation');assert.ok(h.text().includes('2026-10-21'));
  assert.ok(!/\{(count|page|ready|total)\}/.test(h.text()),'native and English source substitute real values');
  assert.equal(h.button('offlinePrepareButton').props.disabled,false);assert.equal(h.button('offlineSyncNow').props.disabled,false);
  const summaries=h.renderer.root.findAllByType('summary').filter(s=>offlineNodeText(s)===t('offlineSourceLabel'));
  assert.equal(summaries.length>0,lang!=='en');for(const summary of summaries){assert.equal(summary.props.style.minHeight,44);assert.equal(summary.props.lang,lang);assert.equal(summary.parent!.findByType('p').props.lang,'en');}
  if(lang!=='en'){assert.ok(h.text().includes(controlT('en')('offlineRemoveConfirm'))===false);assert.ok(h.text().includes(controlT('en')('offlineEntriesWaiting').replace('{count}','3')));assert.ok(h.text().includes(t('offlineDraftNotice')));}
  await h.click('offlineReviewRemove',0);assert.ok(h.text().includes(t('offlineRemoveConfirm')));if(lang!=='en')assert.ok(h.text().includes(controlT('en')('offlineRemoveConfirm')));
  await h.click('offlineKeepEntry');assert.equal(JSON.stringify([...h.values]),before);assert.equal(h.changes.length,0);
  await h.click('offlineDownloadCopy',0);assert.equal(h.downloads.length,1);assert.deepEqual(JSON.parse(await h.downloads[0].blob.text()),h.values.get('qa-write-0')!.value);assert.equal(h.changes.length,0);
  await h.online(false);assert.ok(h.text().includes(t('offlineUsingSavedCopies')));assert.equal(h.button('offlinePrepareButton').props.disabled,true);assert.equal(h.button('offlineSyncNow').props.disabled,true);
  await h.language('ve');assert.ok(h.text().includes(controlT('ve')('offlineUsingSavedCopies')));assert.equal(JSON.stringify([...h.values]),before);
 }finally{await h.dispose();}
});

test('Simple hides technical downloads/readiness but retains preparation and every source disclosure',async()=>{
 for(const lang of langs){const h=await actualOfflineUi(lang,{simple:true});try{const t=controlT(lang);assert.equal(h.renderer.root.findAllByProps({'aria-label':t('offlineDownloadCopy')}).length,0);assert.ok(!h.text().includes(t('offlinePageReadiness').replace('{ready}','0')));assert.equal(h.renderer.root.findAllByType('summary').some(s=>offlineNodeText(s).startsWith(t('offlinePageReadiness').split('{')[0])),false);assert.ok(h.button('offlinePrepareButton'));assert.ok(h.renderer.root.findAllByType('summary').some(s=>offlineNodeText(s)===t('offlineSourceLabel')));}finally{await h.dispose();}}
});

test('preparation progress, completed messages, failed-page names and errors follow a later language switch',async()=>{
 let finish!:()=>void;let report!: (p:any)=>void;
 const h=await actualOfflineUi('st',{guest:true,rows:[],downloadPages:async(prepare,paths,status)=>{if(!prepare)return;report=status;await new Promise<void>(resolve=>{finish=resolve;});}});
 try{
  await h.click('offlinePrepareButton');assert.equal(h.button('offlineWorking').props.disabled,true);
  await act(async()=>{report({path:'/reports',ready:false});});assert.ok(h.text().includes(controlT('st')('offlinePreparingNamedPage').replace('{page}',controlT('st')('offlinePageReports'))));
  await h.language('ts');assert.ok(h.text().includes(controlT('ts')('offlinePreparingNamedPage').replace('{page}',controlT('ts')('offlinePageReports'))));assert.ok(h.text().includes('Preparing Saved reports…'));
  await act(async()=>finish());assert.ok(h.text().includes(controlT('ts')('offlinePreparationGaps')));assert.ok(offlineNodeText(h.renderer.root.findByProps({role:'alert'})).includes(controlT('ts')('offlinePageReports')));
  await h.language('ve');assert.ok(h.text().includes(controlT('ve')('offlinePreparationGaps')));assert.equal(offlineNodeText(h.renderer.root.findByProps({role:'alert'})),controlT('ve')('offlinePageReports'));
 }finally{await h.dispose();}
 const done=await actualOfflineUi('st',{guest:true,rows:[]});try{await done.click('offlinePrepareButton');await done.language('ts');assert.ok(done.text().includes(controlT('ts')('offlinePreparationComplete')));}finally{await done.dispose();}
 const error=await actualOfflineUi('st',{rows:[],readError:'Close another ImbewuField tab and try saving again.'});try{assert.ok(error.text().includes(controlT('st')('offlineErrorCloseOtherTab')));await error.language('ve');assert.ok(error.text().includes(controlT('ve')('offlineErrorCloseOtherTab')));}finally{await error.dispose();}
});

test('sending cannot be removed during its lease; removal only changes the chosen local row',async()=>{
 const h=await actualOfflineUi('ts');try{
  await h.click('offlineReviewRemove',1);await h.click('offlineRemoveQueuedChange');assert.ok(h.values.has('qa-write-1'));assert.ok(h.text().includes(controlT('ts')('offlineErrorEntrySending')));
  await h.language('st');assert.ok(h.text().includes(controlT('st')('offlineErrorEntrySending')));
  await h.click('offlineKeepEntry');await h.click('offlineReviewRemove',0);await h.click('offlineRemoveQueuedChange');assert.ok(!h.values.has('qa-write-0'));assert.ok(h.values.has('qa-other-owner'));assert.ok(h.values.has('qa-cache'));assert.equal(h.apiCalls.length,0,'local removal makes no server request');
 }finally{await h.dispose();}
});

test('sending reports completion while unconfirmed rows stay visible, and guest/sample gates stay closed',async()=>{
 const h=await actualOfflineUi('st',{sync:async values=>{values.delete('qa-write-0');}});try{await h.click('offlineSyncNow');await h.language('ts');assert.ok(h.text().includes(controlT('ts')('offlineSyncComplete')));assert.ok(h.text().includes(controlT('ts')('offlineNeedsReview')));assert.ok(h.values.has('qa-write-2'));}finally{await h.dispose();}
 for(const options of [{guest:true},{sample:true}]){const x=await actualOfflineUi('ve',options);try{assert.equal(x.button('offlineSyncNow').props.disabled,true);assert.equal(x.renderer.root.findAllByType('article').length,0);}finally{await x.dispose();}}
});

test('every known device error reaches native display and unknown server text is replaced by the shared friendly line',async()=>{
 for(const row of packet.entries.filter((r:any)=>r.key.startsWith('offlineError'))){const h=await actualOfflineUi('ts',{rows:[],readError:row.english});try{assert.ok(h.text().includes(row.ts),row.key);await h.language('ve');assert.ok(h.text().includes(row.ve));assert.ok(h.text().includes(row.english),'exact English source available');}finally{await h.dispose();}}
 const raw='Unmapped server detail / own saved text';const x=await actualOfflineUi('zu',{rows:[],readError:raw});try{assert.ok(!x.text().includes(raw));assert.ok(x.text().includes(controlT('zu')('networkFailed')));}finally{await x.dispose();}
});

test('the actual sync badge uses native labels and counts without losing offline or account behavior',async()=>{
 for(const lang of [...langs,'en']as ControlLanguage[]){const h=await actualOfflineUi(lang,{badge:true});try{let a=h.renderer.root.findByType('a');assert.equal(offlineNodeText(a),controlT(lang)('offlineBadgeWaiting').replace('{count}','3'));assert.equal(a.props.href,'/offline');assert.equal(a.props.style.minHeight,44);await h.online(false);assert.equal(offlineNodeText(h.renderer.root.findByType('a')),controlT(lang)('offlineBadgeOffline'));await h.language('ts');assert.equal(offlineNodeText(h.renderer.root.findByType('a')),controlT('ts')('offlineBadgeOffline'));}finally{await h.dispose();}}
 for(const options of [{rows:[]},{sample:true},{guest:true}]){const h=await actualOfflineUi('st',{...options,badge:true});try{assert.equal(h.renderer.toJSON(),null);await h.online(false);assert.ok(h.renderer.root.findByType('a'));}finally{await h.dispose();}}
});

test('a late remove handler and an in-flight preparation cannot cross an account boundary',async()=>{
 const h=await actualOfflineUi('st');try{
  await h.click('offlineReviewRemove',0);const remove=h.button('offlineRemoveQueuedChange').props.onClick;
  await h.account({uid:'another-account',org:'another-org',role:'mentor'});
  await act(async()=>remove());assert.ok(h.values.has('qa-write-0'));assert.equal(h.changes.length,0);
 }finally{await h.dispose();}
 let finish!:()=>void;
 const x=await actualOfflineUi('ts',{downloadPages:async prepare=>{if(prepare)await new Promise<void>(r=>{finish=r;});}});
 try{await x.click('offlinePrepareButton');await x.account({uid:'another-account',org:'another-org',role:'mentor'});await act(async()=>finish());assert.ok(x.text().includes(controlT('ts')('offlineErrorWorkspaceChanged')));assert.equal(x.apiCalls.length,0);}finally{await x.dispose();}
});

test('authorised preparation keeps pagination and photo routes while its saving message changes language',async()=>{
 let resume!:()=>void;
 const h=await actualOfflineUi('st',{api:async path=>{
  if(path==='/api/network/orgs'){await new Promise<void>(r=>{resume=r;});return{orgs:[{id:'qa-offline-org'}]};}
  if(path.startsWith('/api/field-teams')&&!path.includes('mode=photos'))return path.includes('cursor=')?{visits:[{id:'qa-visit-1',photoCount:1},{id:'qa-visit-2',photoCount:1}]}:{visits:[{id:'qa-visit-1',photoCount:1}],visitCursor:'qa-next'};
  if(path.startsWith('/api/programme-evidence')&&!path.includes('mode=photos'))return{sessions:[{id:'qa-session',photoCount:1}]};
  return{};
 }});
 try{
  await h.click('offlinePrepareButton');assert.ok(h.text().includes(controlT('st')('offlineSavingFieldwork')));await h.language('ts');assert.ok(h.text().includes(controlT('ts')('offlineSavingFieldwork')));await act(async()=>resume());
  assert.deepEqual(h.apiCalls,['/api/network/orgs','/api/field-teams?org=qa-offline-org','/api/field-teams?org=qa-offline-org&cursor=qa-next','/api/field-teams?org=qa-offline-org&mode=photos&id=qa-visit-1','/api/field-teams?org=qa-offline-org&mode=photos&id=qa-visit-2','/api/programme-evidence?org=qa-offline-org','/api/programme-evidence?org=qa-offline-org&mode=photos&id=qa-session','/api/assessments?org=qa-offline-org']);
  assert.ok(h.text().includes(controlT('ts')('offlinePreparationComplete')));assert.equal(h.changes.length,0,'preparing displayed copies must not rewrite the durable queue');
 }finally{await h.dispose();}
});
