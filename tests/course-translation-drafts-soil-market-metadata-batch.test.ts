import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import type { Lesson } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-st-soil-health.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { XITSONGA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ts-soil-health.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_L2_DRAFT } from '../lib/course-translation-drafts-ts-vegetables-staples-l2.ts';

type Lang = 'st' | 've' | 'ts';
const modules = Object.fromEntries(COURSE_MODULES.map(module => [module.id, module]));
const registryByModule: Record<string, Record<Lang, any>> = {
  'soil-health': { st: SESOTHO_SOIL_HEALTH_DRAFT, ve: TSHIVENDA_SOIL_HEALTH_DRAFT, ts: XITSONGA_SOIL_HEALTH_DRAFT },
  'market-community': { st: SESOTHO_MARKET_COMMUNITY_DRAFT, ve: TSHIVENDA_MARKET_COMMUNITY_DRAFT, ts: XITSONGA_MARKET_COMMUNITY_DRAFT },
};
const targetKey: Record<Lang, string> = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' };
const changedMetadata: ReadonlyArray<readonly [string, string, Lang, 'title' | 'infographicAlt']> = [
  ...(['st', 've', 'ts'] as const).map(lang => ['soil-health', 'soil-health-l1', lang, 'infographicAlt'] as const),
  ...(['st', 've'] as const).map(lang => ['soil-health', 'soil-health-l2', lang, 'infographicAlt'] as const),
  ...(['st', 've'] as const).map(lang => ['soil-health', 'soil-health-l3', lang, 'infographicAlt'] as const),
  ...(['st', 've', 'ts'] as const).map(lang => ['market-community', 'market-community-l1', lang, 'infographicAlt'] as const),
  ...(['st', 've', 'ts'] as const).map(lang => ['market-community', 'market-community-l2', lang, 'title'] as const),
  ...(['ve', 'ts'] as const).map(lang => ['market-community', 'market-community-l2', lang, 'infographicAlt'] as const),
  ...(['ve', 'ts'] as const).map(lang => ['market-community', 'market-community-l3', lang, 'title'] as const),
  ...(['ve', 'ts'] as const).map(lang => ['market-community', 'market-community-l3', lang, 'infographicAlt'] as const),
];

test('Soil and Market metadata drafts resolve only against their exact English source', () => {
  assert.equal(changedMetadata.length, 19);
  for (const [moduleId, lessonId, language, field] of changedMetadata) {
    const sourceModule = modules[moduleId];
    assert.ok(sourceModule, moduleId);
    const source = sourceModule.lessons.find(lesson => lesson.id === lessonId);
    const draftLesson = registryByModule[moduleId][language].lessons.find((lesson: any) => lesson.id === lessonId);
    assert.ok(source && draftLesson, `${language} ${moduleId}/${lessonId}`);
    const pair = draftLesson[field];
    assert.equal(pair.sourceEnglish, source[field], `${language} ${lessonId}.${field}: exact canonical source`);
    assert.equal(pair.reviewStatus, 'machine-draft', `${language} ${lessonId}.${field}: keep facilitator review state visible`);
    assert.notEqual(pair[targetKey[language]], source[field], `${language} ${lessonId}.${field}: a draft must not be an English-only pseudo-translation`);
    const resolved = resolveLearnerLessonPresentation(source, language);
    assert.equal(resolved.status, 'draft', `${language} ${lessonId}: source-paired draft should be offered as unreviewed copy`);
    assert.equal(field === 'title' ? resolved.content.title : resolved.content.infographicAlt, pair[targetKey[language]]);

    const changedSource = field === 'title'
      ? { ...source, title: `${source.title} Changed.` }
      : { ...source, infographicAlt: `${source.infographicAlt} Changed.` };
    const fallback = resolveLearnerLessonPresentation(changedSource, language);
    assert.equal(fallback.status, 'english-fallback', `${language} ${lessonId}.${field}: canonical edits withdraw stale learner copy`);
    assert.equal(field === 'title' ? fallback.content.title : fallback.content.infographicAlt,
      field === 'title' ? changedSource.title : changedSource.infographicAlt);
  }
});

test('Soil and Market alt text keeps the pictured counts, order and direction', () => {
  const alt = (moduleId: string, lessonId: string, lang: Lang) => {
    const lesson = registryByModule[moduleId][lang].lessons.find((entry: any) => entry.id === lessonId);
    return lesson.infographicAlt[targetKey[lang]] as string;
  };
  for (const lang of ['st', 've', 'ts'] as const) {
    const soilL1 = alt('soil-health', 'soil-health-l1', lang);
    assert.match(soilL1, /two|tse pedi|mbili|timbirhi/i, `${lang}: exactly two worms remain described`);
    assert.ok(soilL1.indexOf('sand') < soilL1.indexOf('silt') && soilL1.indexOf('silt') < soilL1.indexOf('clay'), `${lang}: jar layers remain in source order`);
    assert.match(soilL1, /settles into three layers/);
    const marketL1 = alt('market-community', 'market-community-l1', lang);
    assert.match(marketL1, /loose vegetables/);
    assert.match(marketL1, /record grid/);
    assert.match(marketL1, /blank|se nang letho|si na tshithu|nga tsariwangiki/i, `${lang}: the record grid is still empty`);
  }
  const soilL2St = alt('soil-health', 'soil-health-l2', 'st');
  const soilL2Ve = alt('soil-health', 'soil-health-l2', 've');
  for (const text of [soilL2St, soilL2Ve]) {
    assert.match(text, /alternating layers/);
    assert.match(text, /dry brown material/);
    assert.match(text, /fresh green material/);
    assert.match(text, /heat/i);
    assert.match(text, /arrow/);
    assert.match(text, /turned/);
  }
  for (const lang of ['st', 've'] as const) {
    const soilL3 = alt('soil-health', 'soil-health-l3', lang);
    assert.match(soilL3, /same sun|letsatsi le le leng|ḓuvha ḽithihi/i, `${lang}: both patches remain under one sun`);
    if (lang === 'st') {
      assert.match(soilL3, /petsohile mme o omme/);
      assert.match(soilL3, /le lefifi ebile o le mongobo/);
    } else {
      assert.match(soilL3, /cracked and dry/);
      assert.match(soilL3, /dark.*moisture/);
    }
  }
  for (const lang of ['ve', 'ts'] as const) {
    const routes = alt('market-community', 'market-community-l2', lang);
    assert.match(routes, /three|tharu|tinharhu/i);
    assert.ok(routes.indexOf('roadside stall') < routes.indexOf('shop') && routes.indexOf('shop') < Math.max(routes.indexOf('household'), routes.indexOf('muṱani'), routes.indexOf('ndyangu')), `${lang}: preserve the three route order`);
    assert.match(routes, /one farm|farm nthihi|farm rin’we/);
    const beds = alt('market-community', 'market-community-l3', lang);
    assert.match(beds, /five|miṱanu|miṱanu|Five/i);
    assert.match(beds, /arrows|miseve|misevhe/);
    assert.match(beds, /central crate|crate.*vhukati|crate.*exikarhini/);
    assert.match(beds, /trowel/);
    assert.match(beds, /jar/);
  }
});

test('Vegetables L2 full drafts keep paragraph alignment and the risky agronomic clauses exact', () => {
  const source = modules['vegetables-staples'].lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!;
  const ve = TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT.lessons.find(lesson => lesson.id === source.id)!;
  const ts = XITSONGA_VEGETABLES_STAPLES_L2_DRAFT.lessons[0];
  for (const [language, draftLesson] of [['ve', ve], ['ts', ts]] as const) {
    const resolved = resolveLearnerLessonPresentation(source, language);
    assert.equal(resolved.status, 'draft');
    const expectedBody = language === 've' ? draftLesson.body.tshivendaDraft : draftLesson.body.xitsongaDraft;
    assert.equal(resolved.content.body, expectedBody);
    const paras = resolved.content.body.split('\n\n');
    assert.equal(paras.length, 23, `${language}: maintain one-to-one paragraph alignment`);
    assert.match(paras[8], /first batch|tshigwada tsha u thoma|ntlawa wo sungula/i);
    assert.match(paras[8], /not always be ready by the fourth sowing|A si tshifhinga tshoṱhe|A hi minkarhi hinkwako/);
    assert.match(paras[9], /not a law|hu si mulayo|a hi nawu/);
    assert.match(paras[9], /may hold longer/);
    assert.match(paras[9], language === 've' ? /zwi nga ṱavhanyisa zwithu kana zwa ita uri zwi kundelwe/ : /Ku hisa ku nga endla leswaku swilo swi hatlisa kumbe swi tsandzeka/);
    assert.match(paras[17], /do not assume they immediately feed the maize/);
    assert.match(paras[17], /released during decomposition/);
    assert.match(paras[18], /before the next harvest is ready|phanḓa ha musi khaṋo i tevhelaho|ku nga si lungheka ntshovelo lowu landzelaka/i);
    assert.match(paras[19], /water limits the garden/);
    assert.match(paras[20], /Don't copy somebody else's calendar|U nga tekeleli calendar|Ni songo kopolola calendar/);
    assert.match(paras[21], /sowing date|siku ro byala/);
    assert.doesNotMatch(resolved.content.body, /\.\./, `${language}: avoid doubled sentence stops from fragment recomposition`);
    const changed = resolveLearnerLessonPresentation({ ...source, body: `${source.body}\nChanged.` }, language);
    assert.equal(changed.status, 'english-fallback', `${language}: any changed body source withdraws the full-body pair`);
  }
  assert.match(ve.body.tshivendaDraft, /for longer/);
  assert.match(ve.body.tshivendaDraft, /fast crop/);
  assert.match(ve.body.tshivendaDraft, /Beans dzi gonya maize, and store as protein/);
  assert.match(ts.body.xitsongaDraft, /Beans ti khandziya maize, and store as protein/);
  assert.match(ve.body.tshivendaDraft, /cool-season leaf crop may hold longer/);
  assert.match(ts.body.xitsongaDraft, /cool-season leaf crop may hold longer/);
});
