import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-st-food-forest.ts';
import { XITSONGA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ts-food-forest.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ve-food-forest.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';

const sourceLesson = (moduleId: string, lessonId: string) => {
  const module = COURSE_MODULES.find(item => item.id === moduleId);
  assert.ok(module, `canonical ${moduleId} module is available`);
  const lesson = module.lessons.find(item => item.id === lessonId);
  assert.ok(lesson, `canonical ${lessonId} lesson is available`);
  return lesson;
};

test('Sesotho Food Forest planning layers remain source-paired and visible in Study', () => {
  const source = sourceLesson('food-forest', 'food-forest-l1');
  const draft = SESOTHO_FOOD_FOREST_DRAFT.lessons.find(item => item.id === source.id);
  assert.ok(draft);
  const sourceParagraphs = source.body.split('\n\n');
  const learnerParagraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(learnerParagraphs.length, sourceParagraphs.length,
    'the added local-language sentence must not shift later planting safeguards');
  assert.equal(learnerParagraphs[6],
    'Bophahamo ba dimela le dibaka tsa ho di jala di itshetlehile ka mofuta wa semela le sebaka. Mekgahlelo ena ke ya ho rala; ha e bolele meedi e behilweng ya bophahamo.');

  const shown = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.sesothoDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...source, body: `${source.body} changed` }, 'st').status,
    'english-fallback', 'source drift must withdraw this body draft');
});

test('Tshivenda Food Forest L1 pairs the three selected paragraphs and falls back after source drift', () => {
  const source = sourceLesson('food-forest', 'food-forest-l1');
  const draft = TSHIVENDA_FOOD_FOREST_DRAFT.lessons.find(item => item.id === source.id);
  assert.ok(draft);
  const sourceParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.tshivendaDraft.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  const expected = new Map([
    [1, 'Zwimela zwo fhambanaho zwi shumisa tshedza na u tsakama zwine zwa vha hone hune zwi aluwa hone.'],
    [10, 'Zwimela zwiṱuku zwi ṱoḓa ṱhogomelo musi zwi tshi thoma u ḓowela fhethu: sedzani u tsakama ha mavu, ni lange tsheṋe, ni zwi tsireledze kha u huvhala.'],
    [11, 'Musi zwimela zwi tshi aluwa, murunzi na matoko a maṱari zwi shandula nyimele fhasi hazwo.'],
  ]);
  for (const [index, text] of expected) assert.equal(draftParagraphs[index], text);
  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.tshivendaDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...source, body: `${source.body} changed` }, 've').status,
    'english-fallback');
});

test('Tshivenda market records pair the customer-use sentence while prices and advice stay held', () => {
  const source = sourceLesson('market-community', 'market-community-l1');
  const draft = TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === source.id);
  assert.ok(draft);
  const sourceParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.tshivendaDraft.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  assert.equal(draftParagraphs[1],
    'U ṅwala nḓila dzo fhambanaho dza u shumisa zwibveledzwa zwi ni thusa u vhona zwine bulasi ḽa bveledza na zwine zwa swika kha vharengi.');
  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.tshivendaDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...source, body: `${source.body} changed` }, 've').status,
    'english-fallback');
});

test('new Xitsonga Food Forest L2 lesson preserves its full English shell and quiz answer keys', () => {
  const source = sourceLesson('food-forest', 'food-forest-l2');
  const draft = XITSONGA_FOOD_FOREST_DRAFT.lessons.find(item => item.id === source.id);
  assert.ok(draft, 'Study needs a registered source-paired Xitsonga L2 lesson');
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.title.xitsongaDraft, source.title);
  assert.equal(draft.title.reviewStatus, 'hold');
  assert.ok(source.infographicAlt);
  assert.deepEqual(draft.infographicAlt, {
    sourceEnglish: source.infographicAlt,
    xitsongaDraft: source.infographicAlt,
    reviewStatus: 'hold',
  });

  const sourceParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  const expected = new Map([
    [9, 'Swimilana swa ndzhavuko leswi faneleke laha swi nga seketela habitat tani hi xiphemu xa pulani.'],
    [10, 'Hlawula hi ku ya hi ecosystem ya wena na xiave xa nkoka xa ximilana xin’wana ni xin’wana. Dyondzo leyi a yi nyiki phesente leyi seketeriwaka hi xihlovo.'],
  ]);
  for (const [index, text] of expected) assert.equal(draftParagraphs[index], text);
  sourceParagraphs.forEach((paragraph, index) => {
    if (!expected.has(index)) assert.equal(draftParagraphs[index], paragraph, `paragraph ${index + 1} stays exact English`);
  });

  assert.deepEqual(draft.keyPoints.map(point => [point.sourceEnglish, point.xitsongaDraft, point.reviewStatus]),
    source.keyPoints.map(text => [text, text, 'hold']));
  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, index) => {
    const original = source.quiz[index];
    assert.equal(question.sourceCorrectIndex, original.correct);
    const heldPairs = [
      [question.question, original.q] as const,
      ...question.options.map((option, optionIndex) => [option, original.options[optionIndex]] as const),
      [question.rationale, original.rationale] as const,
    ];
    for (const [pair, english] of heldPairs) {
      assert.equal(pair.sourceEnglish, english);
      assert.equal(pair.xitsongaDraft, english, `quiz ${index + 1} remains an exact English hold`);
      assert.equal(pair.reviewStatus, 'hold');
    }
  });

  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...source, body: `${source.body} changed` }, 'ts').status,
    'english-fallback', 'a changed canonical lesson must withdraw the paired machine draft');
});
