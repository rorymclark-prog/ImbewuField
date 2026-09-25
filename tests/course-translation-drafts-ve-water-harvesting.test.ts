import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ve-water-harvesting.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { resolveDeckLang } from '../lib/course-deck.ts';
import { resolveNarrationLang } from '../lib/course-audio.ts';

test('Water Harvesting Tshivenda draft keeps safety guidance exact and answer mapping intact', () => {
  const source = COURSE_MODULES.find(module => module.id === 'water-harvesting');
  assert.ok(source, 'the draft must stay paired to the canonical Water Harvesting module');
  const draft = TSHIVENDA_WATER_HARVESTING_DRAFT;
  assert.equal(draft.language, 've');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const titles: Record<string, string> = {
    'water-harvesting': 'U Kuvhanganedza Maḓi',
    'water-harvesting-l1': 'Swales na Berms: U Fhungudza Luvhilo lwa Maḓi kha Mudzengamo',
    'water-harvesting-l2': 'Madamu na Madzivha a Bulasini: U Vhulunga Maḓi a Tshifhinga tsha Gomelelo',
    'water-harvesting-l3': 'Matangi a Maḓi a Mvula na U Kuvhanganya Ṱhangani: U Kuvhanganedza na U Tsireledza Maḓi',
  };
  const checkPair = (pair: { sourceEnglish: string; tshivendaDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: retain exact English beside every draft`);
    assert.ok(pair.tshivendaDraft.trim(), `${path}: draft or explicit English hold must exist`);
    assert.deepEqual(numberTokens(pair.tshivendaDraft), numberTokens(english), `${path}: preserve all figures`);
    if (pair.reviewStatus === 'hold') assert.equal(pair.tshivendaDraft, english, `${path}: held safety text must stay exact English`);
    else assert.equal(pair.reviewStatus, 'machine-draft', `${path}: translated text must be marked machine draft`);
  };

  checkPair(draft.title, source.title, 'module.title');
  assert.equal(draft.title.tshivendaDraft, titles[source.id]);
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.description.reviewStatus, 'hold', 'module claim involving greywater stays English');
  assert.equal(draft.lessons.length, 4, 'all four core lessons are represented');
  for (const [i, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[i];
    const path = `lessons[${i}] ${original.id}`;
    assert.equal(lesson.id, original.id);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: pair source infographic copy`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
      assert.equal(lesson.infographicAlt.reviewStatus, 'hold', `${path}: safety diagram copy stays English`);
    } else assert.equal(lesson.infographicAlt, undefined);
    checkPair(lesson.title, original.title, `${path}.title`);
    if (titles[original.id]) assert.equal(lesson.title.tshivendaDraft, titles[original.id]);
    else assert.equal(lesson.title.reviewStatus, 'hold', 'greywater reuse title stays English');
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.reviewStatus, 'hold', `${path}: engineering, water quality and sanitation guidance stays English`);
    assert.deepEqual(lesson.body.tshivendaDraft.split('\n\n'), original.body.split('\n\n'), `${path}: retain paragraph boundaries`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length);
    for (const [j, point] of lesson.keyPoints.entries()) {
      checkPair(point, original.keyPoints[j], `${path}.keyPoints[${j}]`);
      assert.equal(point.reviewStatus, 'hold', `${path}: actionable safety summary stays English`);
    }
    assert.equal(lesson.quiz.length, original.quiz.length);
    for (const [j, question] of lesson.quiz.entries()) {
      const originalQuestion = original.quiz[j];
      checkPair(question.question, originalQuestion.q, `${path}.quiz[${j}].question`);
      assert.equal(question.options.length, originalQuestion.options.length);
      for (const [k, option] of question.options.entries()) checkPair(option, originalQuestion.options[k], `${path}.quiz[${j}].options[${k}]`);
      assert.equal(question.sourceCorrectIndex, originalQuestion.correct, `${path}.quiz[${j}]: answer index stays unchanged`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, originalQuestion.options[originalQuestion.correct], `${path}.quiz[${j}]: correct answer remains paired`);
      checkPair(question.rationale, originalQuestion.rationale, `${path}.quiz[${j}].rationale`);
      assert.equal(question.question.reviewStatus, 'hold', `${path}: water-safety quiz remains English`);
    }
  }

  const held = [draft.description, ...draft.lessons.flatMap(l => [l.body, ...l.keyPoints, ...l.quiz.flatMap(q => [q.question, ...q.options, q.rationale])])]
    .filter(p => p.reviewStatus === 'hold').map(p => p.sourceEnglish).join('\n');
  for (const criticalClaim of ['safe overflow', 'earth dam wall', 'first-flush diverter', 'not make the remaining water safe to drink', 'qualified local sanitation adviser', 'soil and mulch do not disinfect']) {
    assert.ok(held.toLowerCase().includes(criticalClaim.toLowerCase()), `critical claim stays held in English: ${criticalClaim}`);
  }
});

test('Tshivenda Water Harvesting presents only its labelled title draft and keeps instruction media English', () => {
  const source = COURSE_MODULES.find(module => module.id === TSHIVENDA_WATER_HARVESTING_DRAFT.id);
  assert.ok(source, 'the canonical Water Harvesting module must exist');
  const modulePresentation = resolveCourseModulePresentation(source, 've');
  assert.equal(modulePresentation.status, 'draft');
  assert.equal(modulePresentation.title, TSHIVENDA_WATER_HARVESTING_DRAFT.title.tshivendaDraft);
  assert.equal(modulePresentation.description, source.description,
    'the module description stays English while its translation is held');

  assert.equal(source.lessons.length, TSHIVENDA_WATER_HARVESTING_DRAFT.lessons.length);
  for (const [index, lesson] of source.lessons.entries()) {
    const draft = TSHIVENDA_WATER_HARVESTING_DRAFT.lessons[index];
    const presentation = resolveLearnerLessonPresentation(lesson, 've');
    assert.equal(presentation.status, 'draft', lesson.id);
    assert.equal(presentation.content.title, draft.title.reviewStatus === 'hold'
      ? lesson.title : draft.title.tshivendaDraft, `${lesson.id}: only explicitly drafted titles change`);
    assert.equal(presentation.content.body, lesson.body, `${lesson.id}: safety instruction remains English`);
    assert.deepEqual(presentation.content.keyPoints, lesson.keyPoints, `${lesson.id}: safety summary remains English`);
    assert.deepEqual(presentation.content.quiz, lesson.quiz, `${lesson.id}: water-safety quiz remains English`);
    assert.equal(draft.title.sourceEnglish, lesson.title, `${lesson.id}: title is paired to exact English source`);

    const changedSource = { ...lesson, body: `${lesson.body} Changed.` };
    assert.equal(resolveLearnerLessonPresentation(changedSource, 've').status, 'english-fallback',
      `${lesson.id}: changed source withdraws the entire paired draft`);
  }

  assert.equal(resolveCourseModulePresentation({ ...source, title: `${source.title} Changed.` }, 've').status,
    'english-fallback', 'changed module source withdraws its card title');
  assert.deepEqual(resolveDeckLang(source.id, 've'), { lang: 'en', exact: false },
    'Tshivenda slide deck remains explicitly identified as English');
  assert.deepEqual(resolveNarrationLang(source.id, 've'), { lang: 'en', exact: false },
    'Tshivenda narration remains explicitly identified as English');
});

test('Soil Health Tshivenda review data stays source-paired and holds every instruction in English', () => {
  const source = COURSE_MODULES.find(module => module.id === 'soil-health');
  assert.ok(source, 'Soil Health draft must remain paired to its canonical English module');
  const draft = TSHIVENDA_SOIL_HEALTH_DRAFT;
  assert.equal(draft.language, 've');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(source.lessons.length, 3);
  assert.equal(draft.lessons.length, 3);
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  const translated = new Map([
    ['module.title', 'Mutakalo wa Mavu na Muvhundo (Composting)'],
    ['module.description', 'Fhatani mavu a re na vhutshilo nga manyoro (compost), mulitshi (mulch), zwimela zwa u thivhela (cover crops) na mabodo a mahuvhane (worm farms).'],
    ['lessons[0].title', 'U Pfesesa Mavu A Vhoiwe: Mutheo wa Zwoṱhe'],
    ['lessons[1].title', 'U Ita na U Shumisa Manyoro (Compost)'],
    ['lessons[2].title', 'Mulitshi (Mulching) na Zwimela zwa u Thivhela (Cover Crops): U Tsireledza na U Fhaṱa Mavu'],
  ]);
  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  let heldFields = 0;
  const checkPair = (pair: { sourceEnglish: string; tshivendaDraft: string; reviewStatus: string }, english: string, path: string, shouldTranslate = false) => {
    assert.equal(pair.sourceEnglish, english, `${path}: preserve the exact English source`);
    assert.ok(pair.tshivendaDraft.trim(), `${path}: include translated wording or an exact-English hold`);
    assert.deepEqual(numberTokens(pair.tshivendaDraft), numberTokens(english), `${path}: preserve numeric tokens`);
    if (shouldTranslate) {
      assert.equal(pair.reviewStatus, 'machine-draft', `${path}: label AI text as an unreviewed draft`);
      assert.equal(pair.tshivendaDraft, translated.get(path), `${path}: keep the Agy output unchanged`);
    } else {
      heldFields++;
      assert.equal(pair.reviewStatus, 'hold', `${path}: farming content must remain held for fluent local review`);
      assert.equal(pair.tshivendaDraft, english, `${path}: held wording must stay exact English`);
    }
  };

  checkPair(draft.title, source.title, 'module.title', true);
  checkPair(draft.description, source.description, 'module.description', true);
  for (const [index, lesson] of source.lessons.entries()) {
    const paired = draft.lessons[index];
    const path = `lessons[${index}]`;
    assert.equal(paired.id, lesson.id);
    if (lesson.infographicAlt) checkPair(paired.infographicAlt!, lesson.infographicAlt, `${path}.infographicAlt`);
    else assert.equal(paired.infographicAlt, undefined);
    checkPair(paired.title, lesson.title, `${path}.title`, true);
    checkPair(paired.body, lesson.body, `${path}.body`);
    assert.deepEqual(paired.body.tshivendaDraft.split('\n\n'), lesson.body.split('\n\n'), `${path}: preserve paragraph boundaries`);
    assert.equal(paired.keyPoints.length, lesson.keyPoints.length);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      checkPair(paired.keyPoints[pointIndex], point, `${path}.keyPoints[${pointIndex}]`);
    }
    assert.equal(paired.quiz.length, lesson.quiz.length);
    assert.equal(lesson.quiz.length, 2, `${path}: preserve both source quiz items`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const pairedQuestion = paired.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(pairedQuestion.question, question.q, `${questionPath}.question`);
      assert.equal(pairedQuestion.options.length, question.options.length);
      for (const [optionIndex, option] of question.options.entries()) {
        checkPair(pairedQuestion.options[optionIndex], option, `${questionPath}.options[${optionIndex}]`);
      }
      assert.equal(pairedQuestion.sourceCorrectIndex, question.correct, `${questionPath}: preserve answer index`);
      assert.equal(pairedQuestion.options[pairedQuestion.sourceCorrectIndex]?.sourceEnglish, question.options[question.correct],
        `${questionPath}: keep the correct answer paired to its source option`);
      checkPair(pairedQuestion.rationale, question.rationale, `${questionPath}.rationale`);
    }
  }

  assert.equal(heldFields, 54, 'hold every illustration description, body, key point and quiz field');
  assert.equal(resolveCourseModulePresentation(source, 've').status, 'english-fallback',
    'review data alone must not expose this module in Study before explicit wiring');
});
