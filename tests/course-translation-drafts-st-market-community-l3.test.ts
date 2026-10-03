import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

test('Sesotho Market L3 drafts neighbor, produce and selling framing while keeping seed procedures exact English', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(sourceModule);
  const source = sourceModule.lessons.find(lesson => lesson.id === 'market-community-l3');
  assert.ok(source);
  const draft = SESOTHO_MARKET_COMMUNITY_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft, 'the third source lesson must be paired');

  assert.deepEqual(SESOTHO_MARKET_COMMUNITY_DRAFT.lessons.map(lesson => lesson.id),
    sourceModule.lessons.map(lesson => lesson.id), 'all lesson ids and order must follow the source');
  assert.equal(draft.infographicAlt?.sourceEnglish, source.infographicAlt);
  assert.equal(draft.infographicAlt?.reviewStatus, 'machine-draft');
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.title.reviewStatus, 'machine-draft');

  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  for (const index of [1, 2]) {
    assert.equal(draftParagraphs[index], sourceParagraphs[index],
      `paragraph ${index + 1}: crop-specific seed procedures and permission checks stay exact English`);
  }
  for (const index of [0, 6, 7, 8, 9, 10]) {
    assert.notEqual(draftParagraphs[index], sourceParagraphs[index],
      `paragraph ${index + 1}: checked ordinary neighbor, produce or selling framing is drafted`);
  }
  assert.deepEqual(draftParagraphs.slice(3, 6), [
    'Ho arolelana lisebelisoa ho etsa hore sehlopha se khone ho sebelisa lisebelisoa tse turang.',
    'Pompo ea metsi kapa leloala la mabele li ka ’na tsa feta chelete eo lelapa le le leng le ka e khonang.',
    'Ho sebelisa lisebelisoa hammoho ho abela sehlopha sohle molemo oa tsona, ’me ho thusa polasi ka ’ngoe ho etsa mosebetsi oo e neng e ke ke ea khona ho o etsa e le ’ngoe.',
  ], 'the previously reviewed tool-sharing paragraphs remain byte-for-byte unchanged');
  assert.ok(draftParagraphs[11].startsWith('Seek qualified advice for unfamiliar disease or technical problems.'),
    'the qualified-advice requirement remains an exact English sentence');
  assert.ok(draftParagraphs[11].includes('di ka sebetsa mmoho'),
    'the shared-experience sentence keeps the source can-work-together modality');

  assert.deepEqual(draft.keyPoints.map(pair => pair.sourceEnglish), source.keyPoints);
  assert.deepEqual(draft.keyPoints.map(pair => pair.reviewStatus), ['hold', 'machine-draft', 'hold', 'hold']);
  assert.equal(draft.keyPoints[0].sesothoDraft, source.keyPoints[0], 'seed permission remains exact English');
  assert.equal(draft.keyPoints[2].sesothoDraft, source.keyPoints[2], 'net return advice remains exact English');
  assert.equal(draft.keyPoints[3].sesothoDraft, source.keyPoints[3], 'qualification for technical help remains exact English');

  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, questionIndex) => {
    const original = source.quiz[questionIndex];
    assert.equal(question.question.sourceEnglish, original.q);
    assert.equal(question.question.reviewStatus, 'machine-draft');
    assert.equal(question.options.length, original.options.length);
    question.options.forEach((option, optionIndex) => {
      assert.equal(option.sourceEnglish, original.options[optionIndex]);
      assert.equal(option.sesothoDraft, original.options[optionIndex]);
      assert.equal(option.reviewStatus, 'hold', 'all choices remain exact English to preserve quiz meaning');
    });
    assert.equal(question.sourceCorrectIndex, original.correct);
    assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, original.options[original.correct]);
    assert.equal(question.rationale.sourceEnglish, original.rationale);
    assert.equal(question.rationale.sesothoDraft, original.rationale);
    assert.equal(question.rationale.reviewStatus, 'hold');
  });

  const presentation = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.title, draft.title.sesothoDraft);
  assert.equal(presentation.content.body, draft.body.sesothoDraft);
  assert.equal(presentation.content.infographicAlt, draft.infographicAlt?.sesothoDraft);
  assert.deepEqual(presentation.content.keyPoints, draft.keyPoints.map(pair => pair.sesothoDraft));
  assert.deepEqual(presentation.content.quiz, source.quiz.map((question, index) => ({
    q: draft.quiz[index].question.sesothoDraft,
    options: question.options,
    correct: question.correct,
    rationale: question.rationale,
  })));

  const changedSource = { ...source, title: `${source.title} ` };
  const stalePresentation = resolveLearnerLessonPresentation(changedSource, 'st');
  assert.equal(stalePresentation.status, 'english-fallback', 'source edits withdraw stale paired fields');
  assert.equal(stalePresentation.content.title, changedSource.title);
  const changedBody = { ...source, body: `${source.body}\n\nNew market condition.` };
  const staleBodyPresentation = resolveLearnerLessonPresentation(changedBody, 'st');
  assert.equal(staleBodyPresentation.status, 'english-fallback', 'body source drift withdraws the whole stale lesson draft');
  assert.equal(staleBodyPresentation.content.body, changedBody.body);
});

test('regional Market L3 drafts ordinary sharing and produce framing while keeping seed safeguards exact', () => {
  const market = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(market);
  const source = market.lessons.find(lesson => lesson.id === 'market-community-l3');
  assert.ok(source);
  const sourceParagraphs = source.body.split('\n\n');
  const veDraft = TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(lesson => lesson.id === source.id);
  const tsDraft = XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(veDraft);
  assert.ok(tsDraft);
  for (const [language, sourcePair, reviewStatus, translatedBody] of [
    ['ve', veDraft.body.sourceEnglish, veDraft.body.reviewStatus, veDraft.body.tshivendaDraft],
    ['ts', tsDraft.body.sourceEnglish, tsDraft.body.reviewStatus, tsDraft.body.xitsongaDraft],
  ] as const) {
    assert.equal(sourcePair, source.body, `${language}: the whole draft stays paired to the current source`);
    assert.equal(reviewStatus, 'machine-draft');
    const draftParagraphs = translatedBody.split('\n\n');
    assert.equal(draftParagraphs.length, sourceParagraphs.length);
    if (language === 've') {
      assert.notEqual(draftParagraphs[0], sourceParagraphs[0], 'ordinary neighbor seed-sharing framing is drafted');
      assert.equal(draftParagraphs[1], sourceParagraphs[1], 'crop-specific seed procedures remain exact English');
      assert.equal(draftParagraphs[2], sourceParagraphs[2], 'seed quality and permission safeguards remain exact English');
      assert.deepEqual(draftParagraphs.slice(3, 6), [
        'U kovhelana zwishumiswa zwi ita uri zwishumiswa zwi ḓuraho zwi swikelele tshigwada.',
        'Phampu ya maḓi kana tshigayo tsha thoro zwi nga vha zwi sa swikeleliho nga masheleni a muṱa muthihi.',
        'U zwi shumisa roṱhe zwi phaḓaladza ndeme yazwo kha tshigwada, zwa thusa bulasi ḽiṅwe na ḽiṅwe u ita mushumo une ḽi si kone u u ita ḽoṱhe.',
      ], 'previously localized shared-tool paragraphs remain unchanged');
      assert.equal(draftParagraphs[6], 'Farani zwibveledzwa nga vhulenda. Keep suitable shade, packaging and storage through delivery.');
      assert.equal(draftParagraphs[7], 'Mukengi wa tsini a nga fhungudza lwendo, fhedzi losses and selling costs still need measuring.');
      assert.equal(draftParagraphs[8], 'Vhambedzani money received after fees, transport and spoilage kha option iṅwe na iṅwe. Ni songo humbula uri the nearest buyer always gives the best return.');
      assert.equal(draftParagraphs[9], 'Vhahura vha nga sumbedza vhukoni vhu thusaho nahone vha vhambedza zwe zwa itea bulasini ḽavho.', 'existing localized neighbor-skills paragraph remains unchanged');
      assert.equal(draftParagraphs[10], 'Ṅwalani method, conditions and result so others can judge whether it may suit their land.');
      assert.equal(draftParagraphs[11], sourceParagraphs[11], 'qualified advice and specialist-help wording remains exact English');
      const stale = resolveLearnerLessonPresentation({ ...source, body: `${source.body}\n\nNew market condition.` }, 've');
      assert.equal(stale.status, 'english-fallback', 'source-body drift withdraws the full stale Tshivenda lesson');
      assert.equal(stale.content.body, `${source.body}\n\nNew market condition.`);
    } else {
      assert.equal(draftParagraphs[0], 'Vaakelani va nga avelana different varieties and the work of saving seed.',
        'ordinary neighbor-sharing frame is localized while variety and seed-saving terms remain exact');
      assert.equal(draftParagraphs[1], sourceParagraphs[1], 'crop-specific seed procedures remain exact English');
      assert.equal(draftParagraphs[2], sourceParagraphs[2], 'seed quality and permission safeguards remain exact English');
      assert.deepEqual(draftParagraphs.slice(3, 6), [
        'Ku avelana switirhisiwa swo durha swi endla leswaku ntlawa wu swi kota ku swi tirhisa.',
        'Pompo ya mati kumbe muchini wo sila mavele swi nga ha durha ngopfu leswaku ndyangu wun’we wu swi xava.',
        'Ku tirhisa switirhisiwa swin’we swi endla leswaku ntlawa wu vuyeriwaka hi swona, naswona swi pfuna purasi rin’wana ni rin’wana ku endla mintirho leyi a ri nga ta yi kota ri ri roxe.',
      ], 'previously localized shared-tool paragraphs remain unchanged');
      assert.equal(draftParagraphs[6], sourceParagraphs[6], 'gentle produce handling and delivery preservation remain exact English');
      assert.equal(draftParagraphs[7], 'Muxavi wa le kusuhi a nga ha hunguta riendzo, kambe losses and selling costs still need measuring.');
      assert.equal(draftParagraphs[8], 'Pimanisa money received after fees, transport and spoilage eka ndlela yin’wana ni yin’wana. Do not assume the nearest buyer always gives the best return.');
      assert.equal(draftParagraphs[9], 'Vaakelani va nga komba vuswikoti bya nkoka naswona va pimanisa leswi humeleleke emapurasi ya vona.',
        'existing localized neighbor-skills paragraph remains unchanged');
      assert.equal(draftParagraphs[10], 'Tsala method, conditions na result so others can judge whether it may suit their land.');
      assert.equal(draftParagraphs[11], sourceParagraphs[11], 'qualified advice and specialist-help guidance remains exact English');
      const stale = resolveLearnerLessonPresentation({ ...source, body: `${source.body}\n\nNew market condition.` }, 'ts');
      assert.equal(stale.status, 'english-fallback', 'source-body drift withdraws the full stale Xitsonga lesson');
      assert.equal(stale.content.body, `${source.body}\n\nNew market condition.`);
    }
    const shown = resolveLearnerLessonPresentation(source, language);
    assert.equal(shown.status, 'draft');
    assert.equal(shown.content.body, translatedBody);
    assert.deepEqual(shown.content.quiz, source.quiz, 'quiz and answer meanings remain exact English');
  }
});

test('Sesotho Market L1 records four destinations while keeping units and business advice source-paired', () => {
  const market = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(market);
  const source = market.lessons.find(lesson => lesson.id === 'market-community-l1');
  assert.ok(source);
  const draft = SESOTHO_MARKET_COMMUNITY_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft);

  const sourceParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body, 'every draft stays paired to the exact lesson source');
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  assert.equal(draftParagraphs[4],
    'Ngola kilograms tsa tamati, dozens tsa mahe le bundles tsa morogo, ebe u ngola hore e nngwe le e nngwe e ile hokae.');
  assert.equal(draftParagraphs[5],
    sourceParagraphs[5], 'keep compost destination wording exact until its meaning is reviewed');
  for (const index of [5, 8, 9, 11, 12, 13, 15, 16]) {
    assert.equal(draftParagraphs[index], sourceParagraphs[index],
      `body paragraph ${index + 1}: yield, cost, price and crop timing guidance stays exact English`);
  }

  const shown = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.sesothoDraft);
  assert.equal(draft.keyPoints[0].sourceEnglish, source.keyPoints[0]);
  assert.equal(draft.keyPoints[0].reviewStatus, 'machine-draft');
  assert.ok(draft.keyPoints.slice(1).every(point => point.reviewStatus === 'hold'),
    'price, worked-example and crop-timing key points remain held');
});
