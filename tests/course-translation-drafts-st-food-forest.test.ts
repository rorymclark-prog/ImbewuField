import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-st-food-forest.ts';
import { SESOTHO_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-st-small-livestock.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { resolveDeckLang } from '../lib/course-deck.ts';
import { resolveNarrationLang } from '../lib/course-audio.ts';

test('Food Forest Sesotho draft preserves every source, plant safeguard and quiz answer', () => {
  const source = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(source, 'the canonical Food Forest module must remain available');
  const draft = SESOTHO_FOOD_FOREST_DRAFT;
  assert.equal(draft.id, source.id);
  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);

  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;
  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const holds: string[] = [];
  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: keep exact English source`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: draft or exact-English hold must exist`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: review status must be explicit`);
    assert.doesNotMatch(pair.sesothoDraft, nonLatin, `${path}: draft must use Latin script`);
    assert.deepEqual(placeholders(pair.sesothoDraft), placeholders(english), `${path}: preserve placeholders`);
    assert.deepEqual(numberTokens(pair.sesothoDraft), numberTokens(english), `${path}: preserve numeric claims`);
    if (pair.reviewStatus === 'hold') {
      assert.equal(pair.sesothoDraft, english, `${path}: held wording must remain exact English`);
      holds.push(path);
    }
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'all source lessons must be present');
  for (const [lessonIndex, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[lessonIndex];
    const path = `lessons[${lessonIndex}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: IDs and order must match`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: source image description needs a pair`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
    } else assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent image text`);
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sesothoDraft.split('\n\n').length, original.body.split('\n\n').length,
      `${path}.body: keep paragraph boundaries`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: keep key-point count/order`);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      checkPair(point, original.keyPoints[pointIndex], `${path}.keyPoints[${pointIndex}]`);
    }
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: keep quiz count/order`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const english = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, english.q, `${questionPath}.question`);
      assert.equal(question.options.length, english.options.length, `${questionPath}: keep option count/order`);
      for (const [optionIndex, option] of question.options.entries()) {
        checkPair(option, english.options[optionIndex], `${questionPath}.options[${optionIndex}]`);
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: answer index must not change`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: keyed answer must still match its source`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`);
    }
  }

  assert.deepEqual(holds, [
    'lessons[0] food-forest-l1.infographicAlt',
    'lessons[0] food-forest-l1.title',
    'lessons[0] food-forest-l1.body',
    'lessons[0] food-forest-l1.quiz[0].rationale',
    'lessons[0] food-forest-l1.quiz[1].rationale',
    'lessons[1] food-forest-l2.body',
    'lessons[1] food-forest-l2.keyPoints[0]',
    'lessons[1] food-forest-l2.keyPoints[1]',
    'lessons[1] food-forest-l2.keyPoints[2]',
    'lessons[1] food-forest-l2.keyPoints[3]',
    'lessons[1] food-forest-l2.quiz[0].question',
    'lessons[1] food-forest-l2.quiz[0].rationale',
    'lessons[1] food-forest-l2.quiz[1].rationale',
    'lessons[2] food-forest-l3.infographicAlt',
    'lessons[2] food-forest-l3.title',
    'lessons[2] food-forest-l3.body',
    'lessons[2] food-forest-l3.quiz[0].rationale',
    'lessons[2] food-forest-l3.quiz[1].rationale',
  ], 'uncertain planting, legal, and visually corrected image wording stay exact English');
  assert.doesNotMatch(source.lessons[0].infographicAlt ?? '', /root crops|seven layers/i,
    'the pictured woody roots and overlapping plant heights cannot support an exact crop or layer count');

  const namesAndClaims = [
    'Wild Fig', 'pecan', 'lemon', 'naartjie', 'black mulberry', 'Cape gooseberry', 'Wild Medlar',
    'wild garlic', 'sweet potato', 'granadilla', 'Mango', 'Quince', 'walnut', 'apple', 'pear', 'plum',
    'loquat', 'rosemary', 'Barbados cherry', 'avocado', 'Natal Mahogany', 'banana', 'pawpaw', 'litchi',
    'Wild Dagga', 'Marula', 'Mopane', 'baobab', 'Comfrey',
  ];
  const heldEnglish = draft.lessons.map(lesson => lesson.body.sesothoDraft).join('\n');
  for (const name of namesAndClaims) assert.ok(heldEnglish.includes(name), `held source must preserve ${name}`);
});

test('Sesotho chicken lesson preserves animal-care and manure guidance beside a narrow draft', () => {
  const source = COURSE_MODULES.find(module => module.id === 'small-livestock');
  assert.ok(source);
  const lesson = source.lessons.find(item => item.id === 'small-livestock-l1');
  assert.ok(lesson);
  const draft = SESOTHO_SMALL_LIVESTOCK_DRAFT.lessons[0];

  assert.equal(SESOTHO_SMALL_LIVESTOCK_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(SESOTHO_SMALL_LIVESTOCK_DRAFT.title.sourceEnglish, source.title);
  assert.equal(SESOTHO_SMALL_LIVESTOCK_DRAFT.description.sourceEnglish, source.description);
  assert.equal(draft.infographicAlt?.sourceEnglish, lesson.infographicAlt);
  assert.equal(draft.infographicAlt?.reviewStatus, 'hold');
  assert.match(lesson.infographicAlt ?? '', /darker scratched patch/);
  assert.doesNotMatch(lesson.infographicAlt ?? '', /enriched|fertilized|root crop/i,
    'the image description must not claim a soil result the picture cannot show');
  assert.equal(draft.title.sourceEnglish, lesson.title);
  assert.equal(draft.body.sourceEnglish, lesson.body);
  assert.equal(draft.body.sesothoDraft.split('\n\n').length, lesson.body.split('\n\n').length);
  assert.match(draft.body.sesothoDraft, /Di fata hara masala a dimela/);
  for (const held of [
    'Chickens can help an empty bed after harvest.',
    'Their manure and bedding can be composted and returned to the soil.',
    'Foraging does not replace a balanced diet, clean water, shelter or daily care.',
    'Move it before the ground becomes bare, muddy or heavily covered with manure.',
    'Fresh manure can carry germs.',
    'Ask an extension adviser how to manage manure safely before the next crop.',
  ]) {
    assert.ok(draft.body.sesothoDraft.includes(held), `keep exact English until safe Sesotho is checked: ${held}`);
  }
  assert.equal(draft.keyPoints.length, lesson.keyPoints.length);
  draft.keyPoints.forEach((point, index) => {
    assert.equal(point.reviewStatus, 'hold');
    assert.equal(point.sourceEnglish, lesson.keyPoints[index]);
    assert.equal(point.sesothoDraft, lesson.keyPoints[index]);
  });
  assert.equal(draft.quiz.length, lesson.quiz.length);
  draft.quiz.forEach((question, index) => {
    const original = lesson.quiz[index];
    assert.equal(question.sourceCorrectIndex, original.correct);
    assert.deepEqual(
      [question.question, ...question.options, question.rationale].map(pair => pair.sesothoDraft),
      [original.q, ...original.options, original.rationale],
      'animal-care and food-safety questions remain exact English',
    );
  });

  const card = resolveCourseModulePresentation(source, 'st');
  assert.equal(card.status, 'draft');
  assert.equal(card.title, SESOTHO_SMALL_LIVESTOCK_DRAFT.title.sesothoDraft);
  const presentation = resolveLearnerLessonPresentation(lesson, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.title, draft.title.sesothoDraft);
  assert.equal(presentation.content.body, draft.body.sesothoDraft);
  assert.deepEqual(presentation.content.quiz, lesson.quiz);
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: `${lesson.body} Changed.` }, 'st').status,
    'english-fallback', 'source drift must withdraw the complete paired draft');
  assert.equal(resolveCourseModulePresentation({ ...source, title: `${source.title} Changed.` }, 'st').status,
    'english-fallback');
  assert.deepEqual(resolveDeckLang(source.id, 'st'), { lang: 'en', exact: false });
  assert.deepEqual(resolveNarrationLang(source.id, 'st'), { lang: 'en', exact: false });
});

test('Sesotho bee lesson drafts only reviewed terms and keeps care, rules and quizzes in English', () => {
  const source = COURSE_MODULES.find(module => module.id === 'small-livestock');
  assert.ok(source);
  const lesson = source.lessons.find(item => item.id === 'small-livestock-l2');
  assert.ok(lesson);
  const draft = SESOTHO_SMALL_LIVESTOCK_DRAFT.lessons.find(item => item.id === lesson.id);
  assert.ok(draft, 'the L2 source-paired draft must be present');

  const checkHold = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string) => {
    assert.equal(pair.sourceEnglish, english, 'every field keeps its exact English source');
    assert.equal(pair.sesothoDraft, english, 'uncertain or practical guidance remains exact English');
    assert.equal(pair.reviewStatus, 'hold');
  };

  assert.equal(draft.id, lesson.id);
  checkHold(draft.infographicAlt!, lesson.infographicAlt!);
  assert.equal(draft.title.sourceEnglish, lesson.title);
  assert.equal(draft.title.reviewStatus, 'machine-draft');
  assert.equal(draft.title.sesothoDraft,
    'Linotsi: Ho Tsamaisa Phofo ea Lipalesa, Mahe a Linotsi le Kamano ea Lintho Tlhahong');
  assert.equal(draft.body.sourceEnglish, lesson.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = lesson.body.split('\n\n');
  const draftParagraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  assert.equal(draftParagraphs[0],
    'Linotši le likokoanyana tse ling li jara phofshoana ea lipalesa pakeng tsa lipalesa. ' +
    sourceParagraphs[0].slice('Honeybees and other insects carry pollen between flowers. '.length),
    'only the nonprocedural pollen-transfer sentence is drafted; its qualified crop claims stay exact English');
  assert.deepEqual(draftParagraphs.slice(1), sourceParagraphs.slice(1),
    'bee movement rules, hive care, pesticides, registration and swarm inspection stay exact English');
  assert.equal(draft.keyPoints.length, lesson.keyPoints.length);
  draft.keyPoints.forEach((point, index) => checkHold(point, lesson.keyPoints[index]));
  assert.equal(draft.quiz.length, lesson.quiz.length);
  draft.quiz.forEach((question, index) => {
    const original = lesson.quiz[index];
    assert.equal(question.sourceCorrectIndex, original.correct);
    checkHold(question.question, original.q);
    assert.equal(question.options.length, original.options.length);
    question.options.forEach((option, optionIndex) => checkHold(option, original.options[optionIndex]));
    checkHold(question.rationale, original.rationale);
  });

  const presentation = resolveLearnerLessonPresentation(lesson, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.title, draft.title.sesothoDraft);
  assert.equal(presentation.content.body, draft.body.sesothoDraft);
  assert.deepEqual(presentation.content.keyPoints, lesson.keyPoints);
  assert.deepEqual(presentation.content.quiz, lesson.quiz);
  assert.equal(resolveLearnerLessonPresentation(source.lessons.find(item => item.id === 'small-livestock-l3')!, 'st').status,
    'english-fallback', 'the unpaired L3 must remain in English');
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: `${lesson.body} Changed.` }, 'st').status,
    'english-fallback', 'changed source text withdraws the complete paired draft');
});
