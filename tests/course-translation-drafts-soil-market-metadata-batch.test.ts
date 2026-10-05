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
import { COURSE_TRANSLATION_DRAFTS } from '../lib/course-translation-drafts.ts';

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

test('isiZulu repairs stay on their canonical fields, keep answer positions and preserve body paragraph alignment', () => {
  const sourceById = new Map(COURSE_MODULES.flatMap(module => module.lessons.map(lesson => [lesson.id, lesson] as const)));
  const fieldValue = (value: any, path: string): string => {
    if (path === 'title' || path === 'body') return value[path];
    const body = path.match(/^body\[(\d+)\](?:\.sentence\[(\d+)\])?$/);
    if (body) {
      const paragraph = value.body.split('\n\n')[Number(body[1])];
      return body[2] === undefined ? paragraph : paragraph.split(/(?<=\.)\s+/)[Number(body[2])];
    }
    const keyPoint = path.match(/^keyPoints\[(\d+)\]$/);
    if (keyPoint) return value.keyPoints[Number(keyPoint[1])];
    const quiz = path.match(/^quiz\[(\d+)\]\.(rationale|q)$/);
    if (quiz) return value.quiz[Number(quiz[1])][quiz[2]];
    const option = path.match(/^quiz\[(\d+)\]\.options\[(\d+)\]$/);
    if (option) return value.quiz[Number(option[1])].options[Number(option[2])];
    throw new Error(`Unsupported ZU repair field: ${path}`);
  };
  const expected = [
    ['soil-health-l3', 'body[1]', 'Mulch can reduce evaporation, soften the impact of rain and suppress weeds.', 'I-mulch inganciphisa ukuhwamuka, ithambise ukushaya kwamaconsi emvula futhi icindezele ukhula.'],
    ['market-community-l1', 'body[10]', 'The record also shows which months leave the household buying food.', 'Irekhodi libuye libonise izinyanga umuzi othenga ngazo ukudla.'],
    ['reading-landscape-l3', 'quiz[1].rationale', 'Airflow and morning sun can help leaves dry. Late blight is favoured by prolonged cool, damp weather, and moving the bed alone is not a complete control plan.', 'Ukuhamba komoya nelanga lasekuseni kungasiza amaqabunga ome. Late blight is favoured by prolonged cool, damp weather, and moving the bed alone is not a complete control plan.'],
    ['soil-health-l3', 'quiz[1].rationale', 'Leachate is liquid that drains naturally from a worm bin. Its composition varies, so it must not be presented as a guaranteed safe feed for edible crops.', 'I-leachate iwuketshezi oluphuma ngokwemvelo emgqonyeni wemisundu. Its composition varies, so it must not be presented as a guaranteed safe feed for edible crops.'],
    ['seeds-sovereignty-l2', 'keyPoints[2]', 'Tomatoes mostly self-pollinate but can cross; maize is wind-pollinated. Check crop- and variety-specific isolation guidance before saving seed', 'Utamatisi uvame ukuzithuthela impova kodwa ungaxubana; ummbila uthola impova ethwalwa umoya. Hlola crop- and variety-specific isolation guidance ngaphambi kokulondoloza imbewu.'],
    ['market-community-l2', 'quiz[1].options[2]', 'Committed subscription income lets you plan production around real demand instead of growing speculatively', 'Committed subscription income ikuvumela ukuthi uhlele ukukhiqiza ngokwesidingo sangempela esikhundleni sokutshala ungazi ukuthi kuzothengwa yini'],
    ['intro-permaculture-l3', 'title', 'Zones and Sectors: Organising Your Farm by Energy', 'Ama-Zone Nama-Sector: Ukuhlela Ipulazi by Energy'],
    ['intro-permaculture-l2', 'body[2]', 'Pick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go.', 'Khetha izimiso ezimbili noma ezintathu ezihambisana nenkinga yakho enkulu, apply them hard. Ezinye uzoziqonda njengoba uqhubeka.'],
    ['small-livestock-l1', 'body[2]', 'Keep chickens away from seedlings and crops being harvested for food. Fresh manure can carry germs. Ask an extension adviser how to manage manure safely before the next crop. Ducks scratch less, but can still damage plants and make wet ground muddy. Watch the birds and move them when needed.', 'Gcina izinkukhu zikude nezithombo nezitshalo ezivunelwa ukudliwa. Umquba omusha ungathwala amagciwane. Buza umeluleki wezolimo ukuthi ungawuphatha kanjani ngokuphepha before the next crop. Amadada awaklwebhi kakhulu njengezinkukhu, kodwa nawo angalimaza izitshalo futhi enze umhlabathi omanzi ube nodaka. Wabheke, uwahambise uma kudingeka.'],
    ['water-harvesting-l1', 'keyPoints[0]', 'A level contour swale can hold runoff for infiltration on a suitable site; other swales need a designed grade and safe outlet', 'A level contour swale can hold runoff for infiltration on a suitable site; amanye ama-swale adinga a designed grade and safe outlet'],
    ['water-harvesting-l1', 'keyPoints[2]', 'Assess soil, drainage, slope and storm flow before digging', 'Ngaphambi kokumba, hlola umhlabathi, drainage, umthambeka kanye storm flow.'],
    ['water-harvesting-l2', 'keyPoints[3]', 'Maintain bank cover and keep trees off an earth dam wall', 'Nakekela bank cover futhi keep trees off an earth dam wall.'],
    ['water-harvesting-l4', 'keyPoints[1]', 'Check the source, service status, intended use and site locally before any reuse', 'Hlola umthombo, service status, ukusetshenziswa okuhlosiwe and site locally before any reuse.'],
    ['water-harvesting-l2', 'quiz[1].options[1]', 'Maintain the designed bank cover and keep the spillway clear', 'Nakekela the designed bank cover futhi keep the spillway clear.'],
    ['water-harvesting-l1', 'body[0]', 'One kind of swale is a level trench on contour. It slows and spreads runoff so some water can soak into suitable soil. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Which approach fits your land depends on the soil, slope, drainage and storm flow. Have a trained local adviser check the line, overflow and receiving point before digging.', 'One kind of swale is a level trench on contour. Lubambezela amanzi agelezayo bese luwasabalalisa, ukuze amanye amanzi akwazi ukungena emhlabathini ofanele. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Ukuthi iyiphi indlela efanele umhlaba wakho kuncike emhlabathini, emthambekeni, drainage kanye storm flow. Ngaphambi kokumba, cela umeluleki wendawo oqeqeshiwe ahlole umugqa, overflow and receiving point.'],
    ['water-harvesting-l2', 'body[7]', 'Keep the spillway clear and maintain the bank cover specified in the design. Do not plant trees on an earth dam wall.', 'Keep the spillway clear, futhi unakekele the bank cover specified in the design. Ungatshali izihlahla odongeni lwedamu lomhlabathi.'],
    ['small-livestock-l2', 'body[1].sentence[0]', 'South Africa has two native honeybee subspecies.', 'South Africa has two native honeybee subspecies.'],
    ['soil-health-l3', 'title', 'Mulching and Cover Crops: Protecting and Building Soil', 'I-Mulch Nezitshalo Zokumboza Umhlabathi: Ukuvikela Umhlabathi kanye Building Soil'],
  ] as const;

  assert.equal(expected.length, 18, 'check each short target directly; the full Livestock body edit is checked separately below');
  for (const [lessonId, path, sourceText, targetText] of expected) {
    const lesson = sourceById.get(lessonId);
    assert.ok(lesson, `${lessonId}: source lesson exists`);
    assert.equal(fieldValue(lesson, path), sourceText, `${lessonId}.${path}: source wording is unchanged`);
    const draft = COURSE_TRANSLATION_DRAFTS[lessonId];
    assert.equal(fieldValue(draft, path), targetText, `${lessonId}.${path}: corrected draft stays on its source field`);
    const resolved = resolveLearnerLessonPresentation(lesson, 'zu');
    assert.equal(resolved.status, 'draft', `${lessonId}: unreviewed draft remains labelled`);
    assert.equal(fieldValue(resolved.content, path), targetText, `${lessonId}.${path}: the learner sees the corrected target`);
  }

  for (const lessonId of ['soil-health-l3', 'market-community-l1', 'intro-permaculture-l2', 'small-livestock-l1']) {
    const source = sourceById.get(lessonId)!;
    const target = resolveLearnerLessonPresentation(source, 'zu').content;
    assert.equal(source.body.split('\n\n').length, target.body.split('\n\n').length,
      `${lessonId}: edited prose remains aligned one body paragraph at a time`);
  }

  const beesSource = sourceById.get('small-livestock-l2')!;
  const bees = resolveLearnerLessonPresentation(beesSource, 'zu').content;
  assert.equal(beesSource.body.split('\n\n').length, 3);
  assert.equal(bees.body.split('\n\n').length, 3,
    'the learner body aligns with the three canonical paragraphs after removing the extra route-planning instruction');
  assert.equal(fieldValue(bees, 'body[1].sentence[0]'), 'South Africa has two native honeybee subspecies.',
    'keep the exact taxonomic rank, country, native status and count of two');
  assert.doesNotMatch(bees.body, /Hlela indlela abantu nezilwane abazohamba ngayo/);
  for (const retainedQualification of [
    'Lezi izindawo ezibanzi ezivamile; aziyona imingcele yokuthi izinyosi zingahanjiswa kuphi.',
    'Imithetho yoMnyango ibeka umngcele olawula ukuhanjiswa kwezinyosi.',
    'Ngaphambi kokuhambisa izinyosi noma ama-hive, hlola imithetho yamanje noMnyango kanye nomfuyi wezinyosi wendawo onolwazi.',
    'Ilanga lasekuseni lingasiza, kodwa indawo ephephile iza kuqala.',
    'Ukubona izinyosi zisebenza akufakazeli ukuthi ipulazi alinawo amakhemikhali noma izifo.',
    'Ukuminyana kungenye yezimbangela ezingaba khona; akusikho ukuxilongwa.',
  ]) assert.ok(bees.body.includes(retainedQualification), `preserve the source qualification: ${retainedQualification}`);

  const swaleLesson = sourceById.get('water-harvesting-l1')!;
  const swaleBody = resolveLearnerLessonPresentation(swaleLesson, 'zu').content.body.split('\n\n')[0];
  assert.ok(swaleBody.includes('Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet.'),
    'retain the distinct graded-swale alternative, slow excess-water movement and safe outlet');
  const siteFactorOrder = ['emhlabathini', 'emthambekeni', 'drainage', 'storm flow']
    .map((factor) => swaleBody.indexOf(factor));
  assert.ok(siteFactorOrder.every((index) => index >= 0)
    && siteFactorOrder.every((index, position) => position === 0 || siteFactorOrder[position - 1] < index),
  'keep soil, slope, drainage and storm flow as distinct ordered site factors');
  assert.ok(swaleBody.endsWith('overflow and receiving point.'),
    'retain the local check of line, overflow and receiver before digging');

  const damLesson = sourceById.get('water-harvesting-l2')!;
  const damBody = resolveLearnerLessonPresentation(damLesson, 'zu').content.body.split('\n\n')[7];
  assert.equal(damBody,
    'Keep the spillway clear, futhi unakekele the bank cover specified in the design. Ungatshali izihlahla odongeni lwedamu lomhlabathi.');

  const marketLesson = sourceById.get('market-community-l2')!;
  const market = resolveLearnerLessonPresentation(marketLesson, 'zu').content;
  assert.equal(marketLesson.quiz[1].correct, 2);
  assert.equal(market.quiz[1].correct, 2);
  const dam = resolveLearnerLessonPresentation(damLesson, 'zu').content;
  assert.equal(damLesson.quiz[1].correct, 1);
  assert.equal(dam.quiz[1].correct, 1);
  assert.match(dam.quiz[1].options[1], /designed bank cover/);
  assert.match(dam.quiz[1].options[1], /spillway clear/);

  const reuseLesson = sourceById.get('water-harvesting-l4')!;
  const reuse = resolveLearnerLessonPresentation(reuseLesson, 'zu').content;
  assert.match(reuse.keyPoints[1], /service status.*ukusetshenziswa okuhlosiwe and site locally before any reuse\.$/);
  assert.doesNotMatch(reuse.keyPoints[1], /nochwepheshe bendawo/,
    'checking the site locally does not add an unprovided local-expert requirement');
});
