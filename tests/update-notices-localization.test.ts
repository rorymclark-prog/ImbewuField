import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { act } from 'react-test-renderer';
import { actualUpdateUi,actualBuildInfo,updateNodeText } from './update-ui-renderer.ts';
import { controlLocales,controlT } from './control-icon-renderers.ts';
import { loadUpdateCopy,updateDescription,cleanUpdateCopy,updateTourSources } from '../lib/update-copy.ts';
import { updateDateLabel } from '../lib/update-copy-date.ts';
import { recordsMonthLong } from '../lib/records-months.ts';
import { RELEASE_NOTES,visibleNotes,visibleUpdateTour } from '../lib/release-notes.ts';
import { UPDATE_GUIDE_KEY,OPEN_UPDATE_GUIDE_EVENT } from '../lib/update-tour.ts';
import { beforeUpdateNoticeTranslations,beforeUpdateNoticeDictionary,beforeAccountTranslations, beforeCommunityProfileTranslations,beforeCommunityMemberTranslations,beforeCommunityThreadTranslations ,beforePhotoViewerTranslations} from './ui-dictionary-preservation.ts';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const packet=JSON.parse(read('docs/translation/four-language-completion/update-notice-drafts.json'));
const langs=['zu','st','ts','ve']as const;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const tokens=(s:string)=>(s.match(/\{[^{}]+\}|\d+(?:[.,]\d+)?/g)??[]).sort();

test('update drafts preserve source history, existing control wording, quantities and original locale bytes',async()=>{
 // New releases prepend entries; the full original archived suffix must stay exact.
 assert.deepEqual(RELEASE_NOTES.slice(-packet.historyBefore.length),packet.historyBefore,'the complete archived source, order, dates, links and tours survive');
 assert.equal(hash(read('lib/i18n.tsx')),packet.sourceSha256['lib/i18n.tsx']);
 for(const lang of langs){
  const t=controlT(lang),copy=await loadUpdateCopy(lang);
  for(const row of packet.entries){assert.equal(controlT('en')(row.key),row.english);if(typeof row[lang]==='string'){assert.equal(t(row.key),row[lang]);assert.deepEqual(tokens(row[lang]),tokens(row.english));}}
  for(const row of packet.sourceControls)if(!packet.entries.some((r:any)=>r.key===row.key&&typeof r[lang]==='string'))assert.equal(controlLocales[lang][row.key]??null,row[lang]);
  for(const row of packet.bodyEntries){assert.equal(updateDescription(copy,row.english),row[lang]);assert.notEqual(row[lang],row.english);assert.deepEqual(tokens(row[lang]),tokens(row.english));}
  for(const source of [...visibleNotes(),...updateTourSources(visibleUpdateTour())])assert.notEqual(updateDescription(copy,source),source,'the currently announced build has native descriptions');
  const source=beforeAccountTranslations(beforeCommunityProfileTranslations(beforeCommunityMemberTranslations(beforeCommunityThreadTranslations(beforePhotoViewerTranslations(read(`lib/locales/${lang}.ts`),lang),lang),lang),lang),lang);assert.equal(hash(beforeUpdateNoticeTranslations(source,lang)),packet.sourceSha256[`lib/locales/${lang}.ts`]);
  const broken=source.replace(JSON.stringify(t('updatesIntro')),JSON.stringify('Changed unlisted text'));assert.equal(beforeUpdateNoticeTranslations(broken,lang),broken);
  const partial={...controlLocales[lang]};delete partial.updatesIntro;assert.equal(beforeUpdateNoticeDictionary(partial,lang),partial);
  const lesson={...controlLocales[lang],studentContinue:'changed learning'};assert.equal((beforeUpdateNoticeDictionary(lesson,lang)as any).studentContinue,'changed learning');
 }
});

test('native update data never substitutes a different source, language, quantity, placeholder or inherited property',()=>{
 const source='Read {count} records, code 500';
 assert.equal(updateDescription({[source]:'Hlaya {count} tirhekhodo, khodi 501'},source),source);
 assert.equal(updateDescription({[source]:'Hlaya tirhekhodo, khodi 500'},source),source);
 const valid={[source]:'Hlaya {count} tirhekhodo, khodi 500',other:'extra'};
 assert.deepEqual(cleanUpdateCopy(valid,[source],'ts','ts'),{[source]:valid[source]});
 assert.deepEqual(cleanUpdateCopy(valid,[source],'st','ts'),{});
 assert.deepEqual(cleanUpdateCopy(Object.create(valid),[source],'ts','ts'),{});
 assert.equal(updateDescription({},'Older source that has no draft'),'Older source that has no draft');
});

test('displayed update dates retain original day/year/group identity and use the shared month authority',()=>{
 for(const lang of langs)assert.equal(updateDateLabel('21 October 2026',lang),`21 ${recordsMonthLong(lang,10)} 2026`);
 for(const value of ['31 February 2026','21 Octagon 2026','Recent changes','October 2026'])assert.equal(updateDateLabel(value,'ts'),value);
 assert.equal(updateDateLabel('21 October 2026','en'),'21 October 2026');
});

for(const lang of langs)test(`${lang}: real update banner keeps manual refresh, native controls, source backing and new-build authority`,async()=>{
 const h=await actualUpdateUi(lang),t=controlT(lang);try{
  assert.equal(h.calls.reload,0);assert.equal(h.calls.worker,1);assert.ok(h.text().includes(t('updateBannerReady').replace('{sha}',' · qa-new-build')));assert.ok(h.text().includes(t('updatesTranslationDraft')));
  await h.click('updateBannerWhatChangedAria');assert.ok(h.text().includes(t('updatesDraftNotice')));
  const copy=await loadUpdateCopy(lang);for(const line of visibleNotes().slice(0,2)){assert.ok(h.text().includes(updateDescription(copy,line)));assert.ok(h.text().includes(line));}
  await h.buttonText(t('updateBannerShowMore').replace('{count}',String(visibleNotes().length-2)));for(const line of visibleNotes())assert.ok(h.text().includes(updateDescription(copy,line)));
  await h.language(lang==='ts'?'ve':'ts');const next=lang==='ts'?'ve':'ts';assert.ok(h.text().includes(controlT(next)('updatesDraftNotice')));assert.equal(h.calls.reload,0);
  await h.timer(9000);assert.equal(h.renderer.root.findAllByProps({'aria-label':controlT(next)('updateBannerWhatChangedAria')}).length,1,'the original collapse timer remains');
  await h.click('updateBannerWhatChangedAria');await h.buttonText(controlT(next)('updateBannerRefreshButton'));
  assert.equal(h.calls.reload,1);const saved=JSON.parse(h.session.get(UPDATE_GUIDE_KEY)!);assert.equal(saved.sha,'qa-new-build');assert.deepEqual(saved.stops,visibleUpdateTour());assert.equal(saved.phase,'offer');assert.equal(saved.index,0);
 }finally{await h.dispose();}
});

test('a newly published empty native set leaves its source English instead of restoring an older local draft',async()=>{
 const notes=visibleNotes();const h=await actualUpdateUi('ts',{server:async language=>({sha:'qa-new-build',notes,tour:[],copyLanguage:language,copy:{}})});
 try{await h.click('updateBannerWhatChangedAria');assert.ok(h.text().includes(notes[0]));assert.ok(!h.text().includes(updateDescription(await loadUpdateCopy('ts'),notes[0])));assert.ok(h.text().includes(controlT('ts')('updatesEnglishGap')));}finally{await h.dispose();}
 const raw='New deployment description absent from this bundle';const native='Nhlamuselo ya deployment leyintshwa';
 const x=await actualUpdateUi('ts',{server:async language=>({sha:'qa-new-build',notes:[raw],tour:[],copyLanguage:language,copy:{[raw]:native}})});
 try{await x.click('updateBannerWhatChangedAria');assert.ok(x.text().includes(native));assert.ok(x.text().includes(raw));}finally{await x.dispose();}
});

test('dismissal suppresses the notice, pitch stays unobstructed, and offline fallback remains lazy',async()=>{
 const h=await actualUpdateUi('st');try{await h.click('updateBannerDismissAria');assert.equal(h.renderer.toJSON(),null);assert.equal(h.calls.reload,0);}finally{await h.dispose();}
 const pitch=await actualUpdateUi('st',{path:'/pitch'});try{assert.equal(pitch.renderer.toJSON(),null);assert.equal(pitch.calls.worker,1);}finally{await pitch.dispose();}
 const x=await actualUpdateUi('ts',{waiting:true,server:async()=>{throw Error('offline');}});try{assert.equal(x.calls.lazy,1);await x.click('updateBannerWhatChangedAria');assert.ok(x.text().includes(updateDescription(await loadUpdateCopy('ts'),visibleNotes()[0])));}finally{await x.dispose();}
});

for(const lang of langs)test(`${lang}: current guide follows original destinations and progress while descriptions change language`,async()=>{
 const stops=visibleUpdateTour(),guide={sha:'qa-current-build',stops,phase:'offer',index:0};const h=await actualUpdateUi(lang,{kind:'guide',guide}),t=controlT(lang);
 try{
  assert.ok(h.text().includes(t('updateGuideOfferTitle')));assert.ok(h.text().includes(t('updateGuideOfferBody')));assert.ok(h.text().includes(t('updatesDraftNotice')));
  h.panels.at(-1)!.scrollTop=500;await h.buttonText(t('settingsGuideMe'));assert.equal(h.panels.at(-1)!.scrollTop,0,'a new stop reveals its heading after a long offer was scrolled');const copy=await loadUpdateCopy(lang);assert.ok(h.text().includes(updateDescription(copy,stops[0].title)));assert.equal(h.renderer.root.findByProps({'aria-label':t('updateGuideOpenPage')}).props.href,stops[0].href);
  await h.path(stops[0].href);assert.ok(h.text().includes(t('updateGuideContinue').replace('{index}','1').replace('{total}',String(stops.length))));
  await h.actionLabel(t('updateGuideContinue').replace('{index}','1').replace('{total}',String(stops.length)));
  await h.language('ts');assert.ok(h.text().includes(controlT('ts')('updateGuideArrived')));
  const saved=JSON.parse(h.session.get(UPDATE_GUIDE_KEY)!);assert.deepEqual(saved.stops,stops,'translated text never enters guide storage');
  await h.click('updateGuideNext');assert.equal(JSON.parse(h.session.get(UPDATE_GUIDE_KEY)!).index,1);
  // Photograph and sharing checks both visit Account. Arrival still minimizes the guide;
  // its native Continue action must reopen the next stop before Previous can be used.
  if(stops[1].href.split('#')[0]===stops[0].href.split('#')[0]){
   const nextContinue=controlT('ts')('updateGuideContinue').replace('{index}','2').replace('{total}',String(stops.length));
   assert.ok(h.text().includes(nextContinue));await h.actionLabel(nextContinue);
  }
  await h.click('updateGuidePrevious');assert.equal(JSON.parse(h.session.get(UPDATE_GUIDE_KEY)!).index,0);await h.actionLabel(controlT('ts')('updateGuideContinue').replace('{index}','1').replace('{total}',String(stops.length)));await h.click('updateGuideStop');assert.ok(!h.session.has(UPDATE_GUIDE_KEY));
 }finally{await h.dispose();}
});

test('history recent groups translate, older history remains reachable source, and Simple keeps its original limit',async()=>{
 for(const lang of langs){const h=await actualUpdateUi(lang,{kind:'history'}),t=controlT(lang);try{
  assert.ok(h.text().includes(t('navWhatsNew')));assert.ok(h.text().includes(t('updatesIntro')));assert.ok(!h.text().includes(t('updatesEnglishGap')),'all default recent days are translated');
  assert.equal(h.renderer.root.findAllByType('section').length,5);await h.buttonText(t('updatesShowOlder'));assert.ok(h.text().includes(t('updatesEnglishGap')));assert.ok(h.renderer.root.findAllByType('section').length>5);assert.ok(h.text().includes(RELEASE_NOTES.at(-1)!.changes.at(-1)!));assert.deepEqual(h.renderer.root.findAllByType('li').map(li=>li.find(n=>typeof n.type==='function'&&typeof n.props.source==='string').props.source),RELEASE_NOTES.flatMap(n=>n.changes),'every archived description remains in its original order');
  // Wave 15 (ux-09) gives Simple the same disclosure, so an opened history stays open and Show fewer
  // returns Simple to its original three-day limit.
  await h.level(true);assert.ok(h.renderer.root.findAllByType('section').length>5);await h.buttonText(t('updatesShowFewer'));assert.equal(h.renderer.root.findAllByType('section').length,3);assert.ok(h.renderer.root.findAllByType('button').some(b=>updateNodeText(b)===t('updatesShowOlder')));
 }finally{await h.dispose();}}
});

test('the new deployment serves compact native/source pairs while original build metadata remains compatible',async()=>{
 const original=await(await actualBuildInfo()).json();assert.deepEqual(Object.keys(original).sort(),['branch','notes','sha','source','tour']);assert.deepEqual(original.notes,visibleNotes());assert.deepEqual(original.tour,visibleUpdateTour());
 for(const lang of langs){const data=await(await actualBuildInfo(lang)).json(),allowed=[...visibleNotes(),...updateTourSources(visibleUpdateTour())];assert.equal(data.copyLanguage,lang);assert.deepEqual(data.notes,original.notes);assert.deepEqual(data.tour,original.tour);assert.ok(Object.keys(data.copy).length);for(const source of Object.keys(data.copy))assert.ok(allowed.includes(source));}
});

for(const lang of langs)test(`${lang}: the real discovery invitation and onboarding CTA retain their original actions`,async()=>{
 const t=controlT(lang),h=await actualUpdateUi(lang,{kind:'discovery'});
 try{assert.ok(h.text().includes(t('tourMenuTipTitle')));assert.ok(h.text().includes(t('tourMenuTipBodyBefore')+t('navTour')+t('tourMenuTipBodyAfter')));assert.ok(h.text().includes(t('updatesDraftNotice')));assert.equal(h.renderer.root.findByType('dialog').props.lang,lang);await h.click('tourMenuTipShowMenu');assert.equal(h.calls.menu,1);assert.equal(h.renderer.root.findAllByType('dialog').length,0);assert.equal(JSON.parse([...h.storage.values()][0]).menuTipDismissed,true);}finally{await h.dispose();}
 const sample=await actualUpdateUi(lang,{kind:'discovery',sample:true});try{assert.equal(sample.renderer.root.findAllByType('dialog').length,0);}finally{await sample.dispose();}
 const o=await actualUpdateUi(lang,{kind:'onboarding'});try{const names={zu:'isiZulu',st:'Sesotho',ts:'itsonga',ve:'Tshivenḓa'};const languageButton=o.renderer.root.findAll(n=>n.type==='button'&&updateNodeText(n).toLowerCase().includes(names[lang].toLowerCase()))[0];assert.ok(languageButton,'actual language picker');await act(async()=>languageButton.props.onClick());assert.ok(o.text().includes(t('tourOnboardingCta')));await o.buttonText(t('tourOnboardingCta'));assert.deepEqual(o.calls.completed,[lang]);assert.deepEqual(o.calls.routes,['/tour']);}finally{await o.dispose();}
});

test('late native chunks cannot relabel a different selected language, and chunk failures disclose English source',async()=>{
 const pending=new Map<string,(copy:any)=>void>();const h=await actualUpdateUi('st',{kind:'history',loader:language=>new Promise(resolve=>pending.set(language,resolve))});
 try{assert.ok(h.text().includes(controlT('st')('updatesLoadingTranslations')));await h.language('ts');await act(async()=>pending.get('st')!(await loadUpdateCopy('st')));assert.ok(!h.text().includes(updateDescription(await loadUpdateCopy('st'),visibleNotes()[0])));assert.ok(h.text().includes(controlT('ts')('updatesLoadingTranslations')));await act(async()=>pending.get('ts')!(await loadUpdateCopy('ts')));assert.ok(h.text().includes(updateDescription(await loadUpdateCopy('ts'),visibleNotes()[0])));}finally{await h.dispose();}
 const failed=await actualUpdateUi('ve',{kind:'history',loader:async()=>{throw Error('chunk unavailable');}});try{assert.ok(failed.text().includes(controlT('ve')('updatesTranslationsUnavailable')));assert.ok(failed.text().includes(visibleNotes()[0]));assert.equal(failed.calls.reload,0);}finally{await failed.dispose();}
});

test('wrong-language and damaged new-build copy stays source, and hidden notices do not load native descriptions',async()=>{
 const source='Read 33 records';
 for(const reply of [{copyLanguage:'ve',copy:{[source]:'Vhalani 33 rekhodo'}},{copyLanguage:'ts',copy:{[source]:'Hlaya 34 tirhekhodo'}}]){
  const h=await actualUpdateUi('ts',{server:async()=>({sha:'qa-new-build',notes:[source],tour:[],...reply})});try{await h.click('updateBannerWhatChangedAria');assert.ok(h.text().includes(source));assert.ok(!h.text().includes(Object.values(reply.copy)[0]));assert.equal(h.calls.reload,0);}finally{await h.dispose();}
 }
 let loaded=0;const h=await actualUpdateUi('st',{path:'/pitch',loader:async()=>{loaded++;return{};}});try{assert.equal(loaded,0);assert.equal(h.calls.worker,1);}finally{await h.dispose();}
});
