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
  // Reviewed ordinary framing now ships as drafts; safeguards remain source-bound.
  assert.ok(draft.keyPoints.every(pair => pair.reviewStatus === 'machine-draft'));
  assert.match(draft.keyPoints[0].sesothoDraft, /permission.*pele o arolelana/, 'permission is checked before sharing');
  assert.match(draft.keyPoints[2].sesothoDraft, /losses le net returns.*selling route/, 'every route retains the loss and return measures');
  assert.match(draft.keyPoints[3].sesothoDraft, /qualified help ha ho hlokahala/, 'qualified help is required when needed');

  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, questionIndex) => {
    const original = source.quiz[questionIndex];
    assert.equal(question.question.sourceEnglish, original.q);
    assert.equal(question.question.reviewStatus, 'machine-draft');
    assert.equal(question.options.length, original.options.length);
    question.options.forEach((option, optionIndex) => {
      assert.equal(option.sourceEnglish, original.options[optionIndex]);
      assert.equal(option.reviewStatus, 'machine-draft', 'checked ordinary choices are drafts with exact English beside them');
    });
    assert.equal(question.sourceCorrectIndex, original.correct);
    assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, original.options[original.correct]);
    assert.equal(question.rationale.sourceEnglish, original.rationale);
    if (questionIndex === 0) {
      assert.equal(question.rationale.sesothoDraft, original.rationale);
      assert.equal(question.rationale.reviewStatus, 'hold', 'protected-variety rights and crop-specific seed checks remain exact');
    } else {
      assert.equal(question.rationale.reviewStatus, 'machine-draft');
      assert.match(question.rationale.sesothoDraft, /actual returns le losses/);
    }
  });

  const presentation = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.title, draft.title.sesothoDraft);
  assert.equal(presentation.content.body, draft.body.sesothoDraft);
  assert.equal(presentation.content.infographicAlt, draft.infographicAlt?.sesothoDraft);
  assert.deepEqual(presentation.content.keyPoints, draft.keyPoints.map(pair => pair.sesothoDraft));
  assert.deepEqual(presentation.content.quiz, source.quiz.map((question, index) => ({
    q: draft.quiz[index].question.sesothoDraft,
    options: draft.quiz[index].options.map(pair => pair.sesothoDraft),
    correct: question.correct,
    rationale: draft.quiz[index].rationale.sesothoDraft,
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
    // Checked ordinary assessment fields replace old all-English holds without changing answer keys.
    const lessonDraft: { quiz: { question: RegionalPair; options: RegionalPair[]; rationale: RegionalPair }[] } = language === 've' ? veDraft : tsDraft;
    assert.deepEqual(shown.content.quiz, source.quiz.map((question, index) => ({
      q: regionalText(lessonDraft.quiz[index].question),
      options: lessonDraft.quiz[index].options.map(pair => regionalText(pair)),
      correct: question.correct,
      rationale: regionalText(lessonDraft.quiz[index].rationale),
    })));
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
  // The reviewed ordinary framing replaces old whole-paragraph holds; the four destinations stay explicit.
  for (const term of ['food kept at home', 'produce sold', 'produce gifted', 'produce composted']) {
    assert.ok(draftParagraphs[5].includes(term), `the ${term} destination must survive localization`);
  }
  for (const index of [5, 8, 9, 11, 13, 15, 16]) {
    assert.notEqual(draftParagraphs[index], sourceParagraphs[index],
      `body paragraph ${index + 1}: checked ordinary framing is drafted beside its source`);
  }
  assert.equal(draftParagraphs[12], sourceParagraphs[12], 'the numerical teaching example stays exact English');

  const shown = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.sesothoDraft);
  assert.equal(draft.keyPoints[0].sourceEnglish, source.keyPoints[0]);
  assert.equal(draft.keyPoints[0].reviewStatus, 'machine-draft');
  assert.ok(draft.keyPoints.slice(1).every(point => point.reviewStatus === 'hold'),
    'price, worked-example and crop-timing key points remain held');
});


test('regional community assessments keep permission, business comparisons and answer keys source-bound', () => {
  const source = COURSE_MODULES.find(module => module.id === 'market-community')!.lessons.find(lesson => lesson.id === 'market-community-l3')!;
  for (const [language, moduleDraft, key] of [
    ['st', SESOTHO_MARKET_COMMUNITY_DRAFT, 'sesothoDraft'],
    ['ve', TSHIVENDA_MARKET_COMMUNITY_DRAFT, 'tshivendaDraft'],
    ['ts', XITSONGA_MARKET_COMMUNITY_DRAFT, 'xitsongaDraft'],
  ] as const) {
    const draft = moduleDraft.lessons.find(lesson => lesson.id === source.id)!;
    assert.deepEqual(draft.keyPoints.map(pair => pair.sourceEnglish), source.keyPoints);
    assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), [1, 2]);
    draft.quiz.forEach((question, index) => {
      assert.equal(question.question.sourceEnglish, source.quiz[index].q);
      assert.deepEqual(question.options.map(pair => pair.sourceEnglish), source.quiz[index].options);
      assert.equal(question.rationale.sourceEnglish, source.quiz[index].rationale);
    });
    assert.equal(regionalText(draft.quiz[0].rationale), source.quiz[0].rationale, 'seed checks do not establish protected-variety permission');
    assert.equal(draft.quiz[0].rationale.reviewStatus, 'hold');
    assert.match(regionalText(draft.quiz[0].options[1]), /seed-quality checks/);
    assert.match(regionalText(draft.quiz[0].options[1]), /permission/);
    for (const term of ['fees', 'transport', 'unsold produce', 'losses']) {
      assert.ok(regionalText(draft.quiz[1].options[2]).includes(term), `${language}: all cost and loss components survive`);
    }
    assert.match(regionalText(draft.keyPoints[3]), /qualified help/);
    const changedQuestion = { ...source, quiz: source.quiz.map((question, index) => index ? question : { ...question, q: `${question.q} Changed condition.` }) };
    assert.equal(resolveLearnerLessonPresentation(changedQuestion, language).status, 'english-fallback', 'source question edits withdraw stale drafts');
    const changedKey = { ...source, quiz: source.quiz.map((question, index) => index ? question : { ...question, correct: 0 }) };
    assert.equal(resolveLearnerLessonPresentation(changedKey, language).status, 'english-fallback', 'answer-key edits withdraw stale drafts');
  }
  const ts = XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(lesson => lesson.id === source.id)!;
  assert.equal(ts.quiz[0].options[2].xitsongaDraft, source.quiz[0].options[2], 'automatic improvement absolute stays byte-exact English');
});

type RegionalPair = { sourceEnglish: string; sesothoDraft?: string; tshivendaDraft?: string; xitsongaDraft?: string };

function regionalText(pair: RegionalPair): string {
  const text = pair.sesothoDraft ?? pair.tshivendaDraft ?? pair.xitsongaDraft;
  assert.equal(typeof text, 'string', 'every registered regional pair carries its learner wording');
  return text!;
}

const marketProseModule = COURSE_MODULES.find(item => item.id === 'market-community');
assert.ok(marketProseModule, 'canonical market module is registered');

const marketProseLesson = (id: string) => {
  const result = marketProseModule.lessons.find(item => item.id === id);
  assert.ok(result, `canonical ${id} lesson is registered`);
  return result;
};

const marketProsePairedBody = (draft: { lessons: Array<{ id: string; body: { sourceEnglish: string; reviewStatus: string; sesothoDraft?: string; tshivendaDraft?: string; xitsongaDraft?: string } }> }, id: string, field: 'sesothoDraft' | 'tshivendaDraft' | 'xitsongaDraft') => {
  const result = draft.lessons.find(item => item.id === id);
  assert.ok(result, `${id} body draft is registered`);
  const body = result.body[field];
  assert.ok(body, `${id} has its ${field} body`);
  return { pair: result.body, body };
};

test('Sesotho Market L1 localizes only the approved paragraphs and keeps the worked example exact', () => {
  const source = marketProseLesson('market-community-l1');
  const { pair, body } = marketProsePairedBody(SESOTHO_MARKET_COMMUNITY_DRAFT, source.id, 'sesothoDraft');
  const canonical = source.body.split('\n\n');
  const paragraphs = body.split('\n\n');
  const changed = new Set([5, 8, 9, 11, 13, 15, 16]);

  assert.equal(pair.sourceEnglish, source.body, 'a translation must remain tied to the current canonical body');
  assert.equal(pair.reviewStatus, 'machine-draft');
  assert.equal(paragraphs.length, canonical.length, 'paragraph positions carry the lesson safeguards');
  for (const index of changed) assert.notEqual(paragraphs[index], canonical[index], `approved paragraph ${index + 1} has localized framing`);
  assert.equal(paragraphs[12], canonical[12], 'the example remains exact English, including R18 cost and R15 sale price');
  assert.ok(paragraphs[13].includes('a higher asking price is not a guaranteed sale.'), 'the price review keeps its no-guarantee condition');
  assert.ok(paragraphs[15].includes('Check planting conditions and expected time to harvest.'), 'planting advice keeps its site and timing qualification');
  assert.ok(paragraphs[16].includes('Letsatsi le sebetsang polasing e nngwe'), 'the timing comparison remains local to this farm');
  assert.ok(paragraphs[16].includes('ha pula, metsi kapa crops di hloleha'), 'the backup plan remains tied to failure conditions');

  const shown = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, body, 'Study resolves this source-paired Sesotho body');
  const changedSource = { ...source, body: `${source.body}\n\nA changed canonical paragraph.` };
  const fallback = resolveLearnerLessonPresentation(changedSource, 'st');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changedSource.body);
});

test('Tshivenda Market L2 keeps order reliability and conditional supply commitments', () => {
  const source = marketProseLesson('market-community-l2');
  const { pair, body } = marketProsePairedBody(TSHIVENDA_MARKET_COMMUNITY_DRAFT, source.id, 'tshivendaDraft');
  const canonical = source.body.split('\n\n');
  const paragraphs = body.split('\n\n');
  const changed = new Set([2, 3, 4, 5, 8, 9, 10, 11]);

  assert.equal(pair.sourceEnglish, source.body);
  assert.equal(pair.reviewStatus, 'machine-draft');
  assert.equal(paragraphs.length, canonical.length);
  for (const index of changed) assert.notEqual(paragraphs[index], canonical[index], `approved paragraph ${index + 1} is localized`);
  assert.ok(paragraphs[5].includes('Regular orders help planning only when customers and growers can keep the agreement.'), 'regular orders remain conditional on both sides keeping the agreement');
  assert.ok(paragraphs[6].includes('nga u fulufhedzea') && paragraphs[6].includes('zwine vharengi vha zwi ṱoḓa'), 'channel choice pairs dependable supply with customer demand');
  assert.ok(paragraphs[7].includes('before promising regular boxes'), 'costs and household food needs precede a regular commitment');
  assert.ok(paragraphs[9].includes('avoid promising a fixed delivery you cannot supply'), 'unreliable weekly production cannot be turned into a delivery promise');
  assert.ok(paragraphs[11].includes('Check any certification or claim the buyer requires before using a label.'), 'buyer-required claims remain checked before labeling');

  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, body);
  const changedSource = { ...source, body: source.body.replace('what you can reliably supply', 'what you might supply') };
  const fallback = resolveLearnerLessonPresentation(changedSource, 've');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changedSource.body);
});

test('New Xitsonga Market L1 prose preserves the held English prefix and assessment fields', () => {
  const source = marketProseLesson('market-community-l1');
  const draft = XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === source.id);
  assert.ok(draft);
  const canonical = source.body.split('\n\n');
  const paragraphs = draft.body.xitsongaDraft.split('\n\n');
  const changed = new Set([5, 10, 13]);

  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(paragraphs.length, canonical.length);
  for (let index = 0; index < canonical.length; index++) {
    if (changed.has(index)) assert.notEqual(paragraphs[index], canonical[index], `approved paragraph ${index + 1} is localized`);
  }
  assert.ok(paragraphs[5].startsWith('Use the same simple habit'), 'retain the previously established English opening exactly');
  assert.equal(paragraphs[12], canonical[12], 'R18/R15 example remains exact English');
  assert.ok(paragraphs[13].includes('a higher asking price is not a guaranteed sale.'), 'the no-guarantee condition remains explicit');
  assert.deepEqual(draft.keyPoints.map(item => [item.sourceEnglish, item.xitsongaDraft, item.reviewStatus]),
    source.keyPoints.map((text, index) => [text, index === 0 ? draft.keyPoints[0].xitsongaDraft : text, index === 0 ? draft.keyPoints[0].reviewStatus : 'hold']),
    'existing key point translation and remaining holds retain their source pairing');
  assert.deepEqual(draft.quiz.map(item => [item.question.xitsongaDraft, item.options.map(option => option.xitsongaDraft), item.sourceCorrectIndex, item.rationale.xitsongaDraft]),
    source.quiz.map(item => [item.q, item.options, item.correct, item.rationale]), 'question wording, answer options, keys and rationales stay unchanged');

  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  const changedSource = { ...source, body: `${source.body} Changed.` };
  const fallback = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changedSource.body);
});
