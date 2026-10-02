import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-st-water-harvesting.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

test('Water Harvesting Sesotho draft preserves exact sources, safety holds and quiz indexes', () => {
  const source = COURSE_MODULES.find(module => module.id === 'water-harvesting');
  assert.ok(source, 'the translated module must have an English source');
  const draft = SESOTHO_WATER_HARVESTING_DRAFT;
  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.description.sourceEnglish, source.description);
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;
  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: exact English source must be retained`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: draft or exact English hold must be present`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: status must be explicit`);
    assert.doesNotMatch(pair.sesothoDraft, nonLatin, `${path}: keep draft text in Latin script`);
    assert.doesNotMatch(pair.sesothoDraft, /lePREFIX/, `${path}: reject translation artifacts`);
    assert.deepEqual(placeholders(pair.sesothoDraft), placeholders(english), `${path}: preserve placeholders`);
    assert.deepEqual(numberTokens(pair.sesothoDraft), numberTokens(english), `${path}: preserve any figures`);
    if (pair.reviewStatus === 'hold') {
      assert.equal(pair.sesothoDraft, english, `${path}: held content must remain exact English`);
    }
    for (const term of ['swale', 'berm', 'spillway', 'first-flush diverter', 'greywater', 'South Africa']) {
      if (english.toLowerCase().includes(term.toLowerCase())) {
        assert.ok(pair.sesothoDraft.toLowerCase().includes(term.toLowerCase()), `${path}: preserve exact source term ${term}`);
      }
    }
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'all four source lessons must be represented');

  const holds: string[] = [];
  for (const [index, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[index];
    const path = `lessons[${index}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: lesson IDs and order must match`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: infographic alt must be paired`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
      if (lesson.infographicAlt.reviewStatus === 'hold') holds.push(`${path}.infographicAlt`);
    } else {
      assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent infographic text`);
    }
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sesothoDraft.split('\n\n').length, original.body.split('\n\n').length,
      `${path}.body: preserve source paragraph boundaries`);
    if (lesson.body.reviewStatus === 'hold') holds.push(`${path}.body`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: key point count must match`);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      const pointPath = `${path}.keyPoints[${pointIndex}]`;
      checkPair(point, original.keyPoints[pointIndex], pointPath);
      if (point.reviewStatus === 'hold') holds.push(pointPath);
    }
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: quiz count must match`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const english = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, english.q, `${questionPath}.question`);
      if (question.question.reviewStatus === 'hold') holds.push(`${questionPath}.question`);
      assert.equal(question.options.length, english.options.length, `${questionPath}: option count/order must match`);
      for (const [optionIndex, option] of question.options.entries()) {
        checkPair(option, english.options[optionIndex], `${questionPath}.options[${optionIndex}]`);
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: answer index must stay unchanged`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: correct option must still point to the exact source answer`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`);
      if (question.rationale.reviewStatus === 'hold') holds.push(`${questionPath}.rationale`);
    }
  }
  assert.deepEqual(holds, [
    'lessons[0] water-harvesting-l1.infographicAlt',
    'lessons[0] water-harvesting-l1.keyPoints[0]',
    'lessons[0] water-harvesting-l1.quiz[0].rationale',
    'lessons[3] water-harvesting-l4.body',
  ], 'unreviewed contour key point and other held safety wording must remain exact English');

  const waterL2Source = source.lessons.find(lesson => lesson.id === 'water-harvesting-l2');
  const waterL2Draft = draft.lessons.find(lesson => lesson.id === 'water-harvesting-l2');
  assert.ok(waterL2Source && waterL2Draft);
  assert.equal(waterL2Draft.body.sourceEnglish, waterL2Source.body);
  assert.equal(waterL2Draft.body.reviewStatus, 'machine-draft');
  const waterL2SourceParagraphs = waterL2Source.body.split('\n\n');
  const waterL2Paragraphs = waterL2Draft.body.sesothoDraft.split('\n\n');
  assert.equal(waterL2SourceParagraphs.length, 9);
  assert.equal(waterL2Paragraphs.length, waterL2SourceParagraphs.length);
  const waterL2Visible = resolveLearnerLessonPresentation(waterL2Source, 'st');
  assert.equal(waterL2Visible.status, 'draft');
  assert.equal(waterL2Visible.content.body, waterL2Draft.body.sesothoDraft,
    'show the exact source-paired Sesotho body as a visibly unreviewed learner draft');
  assert.ok(waterL2Paragraphs[1].includes('dry periods') && waterL2Paragraphs[1].includes('ha le a tiisetswa'),
    'keep dry periods broader than drought and retain the no-guarantee qualifier');
  assert.ok(waterL2Paragraphs[6].startsWith('Metsi a ka lahleha ka evaporation and seepage.') &&
    waterL2Paragraphs[6].includes('Hlahloba boemo ba metsi') && waterL2Paragraphs[6].includes('kgoholeho'),
  'retain the correct evaporation/seepage terms and preserve the checks');
  const waterL2ProtectionQuiz = waterL2Draft.quiz[1];
  assert.equal(waterL2ProtectionQuiz.sourceCorrectIndex, waterL2Source.quiz[1].correct);
  assert.ok(waterL2ProtectionQuiz.options[waterL2ProtectionQuiz.sourceCorrectIndex].sesothoDraft.includes('keep the spillway clear'),
    'the correct protection option must say the spillway stays unobstructed, not merely clean');
  assert.ok(waterL2ProtectionQuiz.rationale.sesothoDraft.includes('A clear spillway (spillway e sa thibehang)'),
    'the feedback must preserve the spillway-clear requirement');
  assert.equal(waterL2Visible.content.quiz[1].options[waterL2ProtectionQuiz.sourceCorrectIndex],
    waterL2ProtectionQuiz.options[waterL2ProtectionQuiz.sourceCorrectIndex].sesothoDraft);
  assert.equal(waterL2Visible.content.quiz[1].rationale, waterL2ProtectionQuiz.rationale.sesothoDraft);
  assert.ok(waterL2Paragraphs[7].startsWith('Keep the spillway clear and maintain the bank cover specified in the design.') &&
    waterL2Paragraphs[7].endsWith('O se ke wa jala difate hodima lerako la letamo la mobu.'),
  'preserve unobstructed spillway and design-specified cover, plus the existing tree prohibition');
  const changedWaterL2 = {
    ...waterL2Source,
    body: waterL2Source.body.replace('dry periods', 'drought only'),
  };
  assert.notEqual(changedWaterL2.body, waterL2Source.body);
  const waterL2Fallback = resolveLearnerLessonPresentation(changedWaterL2, 'st');
  assert.equal(waterL2Fallback.status, 'english-fallback', 'withdraw the paired lesson if its water-planning source changes');
  assert.equal(waterL2Fallback.content.body, changedWaterL2.body);

  const swaleSource = source.lessons[0];
  const visible = resolveLearnerLessonPresentation(swaleSource, 'st');
  assert.equal(visible.status, 'draft');
  assert.equal(visible.content.body, draft.lessons[0].body.sesothoDraft,
    'the exact-source-paired Sesotho body should be shown as an unreviewed learner draft');
  assert.equal(visible.content.infographicAlt, swaleSource.infographicAlt);
  assert.equal(visible.content.keyPoints[0], swaleSource.keyPoints[0]);
  assert.equal(visible.content.quiz[0].q, draft.lessons[0].quiz[0].question.sesothoDraft);
  assert.equal(visible.content.quiz[0].rationale, swaleSource.quiz[0].rationale);
  assert.equal(visible.content.quiz[1].q, draft.lessons[0].quiz[1].question.sesothoDraft,
    'the second question should use its exact-source-paired Sesotho draft');

  const body = draft.lessons[0].body;
  assert.equal(body.reviewStatus, 'machine-draft');
  assert.equal(body.sourceEnglish, swaleSource.body);
  assert.equal(body.sesothoDraft.split('\n\n').length, 8);
  for (const requiredMeaning of [
    'level trench on contour',
    'slight, controlled grade',
    'safe outlet',
    'Pele o tjheka, trained local adviser a hlahlobe line, overflow le receiving point',
    'downhill side',
    'di ka nka moisture e bolokilweng mobung ka mora pula, ho ya ka site',
    'e ka tlatsa swale ka potlako ho feta kamoo metsi a kenellang mobung',
    'Rera safe overflow pele o tjheka',
    'ha e a tshwanela ho senya slope ka erosion',
    'metsi a senyang ho moahisani',
    'Downstream swale kapa dam e lokela ho kgona ho amohela metsi ao ka polokeho',
    'Slope feela ha e bolele',
    'local assessment pele o tjheka mobung o steep, wet kapa unstable',
  ]) {
    assert.ok(body.sesothoDraft.includes(requiredMeaning),
      `the body must retain this source condition or technical distinction: ${requiredMeaning}`);
  }

  const changedSource = {
    ...swaleSource,
    body: swaleSource.body.replace(
      'Get a local assessment before digging on steep, wet or unstable land.',
      'Dig on steep, wet or unstable land without an assessment.',
    ),
  };
  const drifted = resolveLearnerLessonPresentation(changedSource, 'st');
  assert.equal(drifted.status, 'english-fallback', 'source drift must withdraw the complete paired body');
  assert.equal(drifted.content.body, changedSource.body);

  const quiz0Question = draft.lessons[0].quiz[0].question;
  assert.equal(quiz0Question.reviewStatus, 'machine-draft');
  assert.ok(quiz0Question.sesothoDraft.includes('one end'),
    'the source says one end, so the candidate must not narrow it to a point');
  assert.ok(quiz0Question.sesothoDraft.includes('Ka mora pula e matla'));
  assert.ok(quiz0Question.sesothoDraft.includes('pele se fetola earthwork'));
  assert.equal(draft.lessons[0].quiz[0].rationale.reviewStatus, 'hold',
    'the geometry rationale remains exact English pending its separate review');
  assert.equal(draft.lessons[0].quiz[0].rationale.sesothoDraft,
    draft.lessons[0].quiz[0].rationale.sourceEnglish);
  const quiz1Question = draft.lessons[0].quiz[1].question;
  assert.equal(quiz1Question.reviewStatus, 'machine-draft');
  assert.ok(quiz1Question.sesothoDraft.includes('mobung o moepa'));
  assert.ok(quiz1Question.sesothoDraft.includes('pele se tjheka'));
});
