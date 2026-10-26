import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { actualConsent, consentRecord } from './consent-renderer.ts';
import { controlLocales, controlT, type ControlLanguage } from './control-icon-renderers.ts';
import { beforeConsentDictionary, beforeConsentTranslations, beforeOfflineDeviceTranslations, beforeUpdateNoticeTranslations, beforeAccountTranslations, beforeCommunityProfileTranslations,beforeCommunityMemberTranslations,beforeCommunityThreadTranslations ,beforePhotoViewerTranslations} from './ui-dictionary-preservation.ts';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const packet=JSON.parse(read('docs/translation/four-language-completion/consent-drafts.json'));
const languages=['zu','st','ts','ve'] as const;

test('consent drafts bind to exact prior wording and retain every original English policy clause',()=>{
  assert.equal(createHash('sha256').update(read('lib/i18n.tsx')).digest('hex'),packet.englishSourceSha256);
  assert.match(packet.status,/Unreviewed/);
  let changed=0;
  for(const lang of languages){
    const t=controlT(lang);
    const projected=beforeConsentDictionary(controlLocales[lang],lang) as Record<string,string>;
    for(const row of packet.entries){if(typeof row[lang]!=='string')continue;
      changed++;assert.equal(t(row.key),row[lang]);assert.notEqual(t(row.key),row.english);
      assert.equal(projected[row.key]??null,packet.beforeValues[lang][row.key]);
    }
    for(const row of packet.sourceControls){
      if(row.english!==null)assert.equal(controlT('en')(row.key),row.english);
      if(!packet.entries.some((e:any)=>e.key===row.key&&typeof e[lang]==='string'))
        assert.equal(Object.hasOwn(controlLocales[lang],row.key)?t(row.key):null,row[lang]);
    }
    const source=beforeOfflineDeviceTranslations(beforeUpdateNoticeTranslations(beforeAccountTranslations(beforeCommunityProfileTranslations(beforeCommunityMemberTranslations(beforeCommunityThreadTranslations(beforePhotoViewerTranslations(read(`lib/locales/${lang}.ts`),lang),lang),lang),lang),lang),lang),lang);
    assert.notEqual(beforeConsentTranslations(source,lang),source);
    assert.equal(createHash('sha256').update(beforeConsentTranslations(source,lang)).digest('hex'),packet.localeSourceSha256[lang],'every undeclared locale byte retains its pre-consent hash');
    const bad=source.replace(JSON.stringify(t('popiaShareLabel')),JSON.stringify(t('popiaShareLabel')+' CHANGED'));
    assert.equal(beforeConsentTranslations(bad,lang),bad,'an altered draft cannot be hidden from historical source checks');
    const partial={...controlLocales[lang]};delete partial.popiaConsentDraftNotice;
    assert.equal(beforeConsentDictionary(partial,lang),partial,'a partial draft cannot be projected away');
    const unrelated={...controlLocales[lang],qaUnrelatedLearning:'changed'};
    assert.equal((beforeConsentDictionary(unrelated,lang)as Record<string,string>).qaUnrelatedLearning,'changed');
  }
  assert.equal(changed,16);
});

for(const lang of [...languages,'en'] as ControlLanguage[])test(`${lang}: real consent renders native controls, exact source and unchanged consent gates`,()=>{
  const h=actualConsent(lang);const t=controlT(lang);
  try {
    assert.equal(h.renderer.root.findByProps({role:'dialog'}).props['aria-label'],t('popiaTitle'));
    const switches=h.renderer.root.findAllByProps({role:'switch'});
    assert.equal(switches.length,2);assert.equal(switches[0].props['aria-checked'],true);assert.equal(switches[1].props['aria-checked'],false);
    assert.equal(switches[0].props['aria-label'],t('popiaStoreLabel'));
    assert.equal(switches[1].props['aria-label'],t('popiaShareLabel'));
    assert.equal(h.writes.length,0);
    const sources=h.renderer.root.findAllByType('small');
    assert.equal(sources.length,lang==='en'?0:7);
    for(const s of sources)assert.equal(s.props.lang,'en');
    if(lang!=='en'){
      assert.equal(h.renderer.root.findByProps({role:'note'}).children.join(''),t('popiaConsentDraftNotice'));
      for(const key of ['popiaTitle','popiaBody','popiaStoreLabel','popiaStoreDesc','popiaShareLabel','popiaShareDesc','popiaAgreeButton']){
        assert.ok(sources.some(s=>s.children.includes(controlT('en')(key))),`${key}: exact English source`);
        assert.ok(h.text().includes(t(key)));
      }
    }
    h.click('popiaStoreLabel');
    assert.equal(h.button('popiaAgreeButton').props.disabled,true);
    h.click('popiaAgreeButton');
    assert.equal(h.renderer.root.findByProps({role:'dialog'}).props['aria-label'],t('popiaTitle'));
    assert.ok(h.text().includes(t('popiaStorageRequired')));
    h.click('popiaStoreLabel');h.click('popiaAgreeButton');
    assert.equal(h.button('popiaGetStarted').props.disabled,true);
    assert.ok(h.text().includes(t('popiaGoalPickOne')));
    h.click('popiaGetStarted');assert.equal(h.writes.length,0,'handler rejects missing goal too');
    for(const key of ['popiaGoalFeedLabel','popiaGoalIncomeLabel','popiaGoalSoilLabel'])assert.equal(h.button(key).props['aria-pressed'],false);
    h.click('popiaGoalFeedLabel');assert.equal(h.button('popiaGoalFeedLabel').props['aria-pressed'],true);
    assert.equal(h.button('popiaGetStarted').props.disabled,false);
    h.click('popiaGetStarted');
    const record=consentRecord(h);
    assert.deepEqual(Object.keys(record).sort(),['at','consent','goal','shareNgo']);
    assert.equal(record.consent,true);assert.equal(record.shareNgo,false);assert.equal(record.goal,'feed');
    assert.equal(new Date(record.at).toISOString(),record.at);assert.deepEqual(h.removed,['imbewu_popia']);
    assert.equal(h.renderer.toJSON(),null);
  } finally {h.dispose();}
});

test('changing language keeps consent choices and opting in preserves the original three goal IDs',()=>{
  for(const [index,goal] of ['feed','income','soil'].entries()){
    const h=actualConsent('zu');
    try {
      h.click('popiaShareLabel');h.language(languages[index+1]??'ve');
      assert.equal(h.button('popiaShareLabel').props['aria-checked'],true);
      h.click('popiaAgreeButton');
      const key={feed:'popiaGoalFeedLabel',income:'popiaGoalIncomeLabel',soil:'popiaGoalSoilLabel'}[goal]!;
      h.click(key);h.language('ts');
      assert.equal(h.button(key).props['aria-pressed'],true);
      h.click('popiaGetStarted');const record=consentRecord(h);assert.equal(record.goal,goal);assert.equal(record.shareNgo,true);
    }finally{h.dispose();}
  }
});

test('consent stays hidden until onboarding and after an existing account-scoped record',()=>{
  for(const storage of [{},{'qa::permamap_onboarded':'1','qa::imbewu_popia':'{"consent":true}'}] as Record<string,string>[]){
    const h=actualConsent('ts',storage);
    try{assert.equal(h.renderer.toJSON(),null);assert.equal(h.writes.length,0);}finally{h.dispose();}
  }
});
