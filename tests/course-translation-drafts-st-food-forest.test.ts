import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-st-food-forest.ts';
import { SESOTHO_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-st-small-livestock.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { resolveDeckLang } from '../lib/course-deck.ts';
import { resolveNarrationLang } from '../lib/course-audio.ts';
import { assertKeeps, checkCompleteLessonDraft, draftText } from './regional-full-draft-checks.ts';

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
    if (original.id === 'food-forest-l1') {
      const sourceParagraphs = original.body.split('\n\n');
      const draftParagraphs = lesson.body.sesothoDraft.split('\n\n');
      assert.equal(lesson.body.reviewStatus, 'machine-draft');
      const translatedParagraphs = new Map([
        [0, 'Moru wa tlhaho o tlatsa sebaka ho tloha makaleng a hodimo ho isa metsong.'],
        [1, 'Dimela tse fapaneng di sebedisa kganya le mongobo tse fumanehang boemong ba tsona.'],
        // The two descriptive forest-pattern lines now accompany the silent slide; planting advice stays held.
        [2, 'Food forest e etsisa mokgwa ona ka productive species.'],
        [3, 'Phello ha se sejalo se le seng moleng o le mong, empa ke mekhahlelo (layers) e mengata e molemo e melang hammoho.'],
        [4, 'Nahana ka canopy e telele, difate tse nyane, dihlahla le dimela tsa herbaceous.'],
        [6, 'Bophahamo ba dimela le dibaka tsa ho di jala di itshetlehile ka mofuta wa semela le sebaka. Mekgahlelo ena ke ya ho rala; ha e bolele meedi e behilweng ya bophahamo.'],
        [7, 'Mohlala wa pele wa Highveld o kenyelletsa Wild Fig kapa pecan tse hodimo ho lemon, naartjie le black mulberry.'],
        [8, 'Mohlala oo o beha Cape gooseberry le Wild Medlar mmoho le vegetables, wild garlic, sweet potato le granadilla.'],
        [11, 'Ha dimela di ntse di hola, moriti le masalla a makgasi di fetola maemo a ka tlase ho tsona.'],
      ]);
      for (const [index, expected] of translatedParagraphs) assert.equal(draftParagraphs[index], expected);
      sourceParagraphs.forEach((paragraph, index) => {
        if (!translatedParagraphs.has(index)) assert.equal(draftParagraphs[index], paragraph, `Food Forest L1 paragraph ${index + 1} stays English`);
      });
    }
    if (original.id === 'food-forest-l2') {
      const sourceParagraphs = original.body.split('\n\n');
      const draftParagraphs = lesson.body.sesothoDraft.split('\n\n');
      assert.equal(lesson.body.reviewStatus, 'machine-draft');
      assert.equal(lesson.title.reviewStatus, 'machine-draft', 'retain the already-visible L2 title draft');
      assert.equal(lesson.infographicAlt?.reviewStatus, 'machine-draft', 'retain the already-visible L2 image-description draft');
      assert.deepEqual(lesson.keyPoints.map(point => point.reviewStatus), ['hold', 'hold', 'hold', 'hold'],
        'retain existing L2 key-point holds');
      assert.deepEqual(lesson.quiz.map(question => [question.question.reviewStatus, question.options.map(option => option.reviewStatus), question.rationale.reviewStatus]), [
        ['hold', ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft'], 'hold'],
        ['machine-draft', ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft'], 'hold'],
      ], 'retain all pre-existing L2 quiz draft and hold statuses');
      assert.equal(draftParagraphs[9],
        'Dimela tsa tlhaho (indigenous plants) tse loketseng sebaka di ka tshehetsa habitat e le karolo ya moralo.');
      sourceParagraphs.forEach((paragraph, index) => {
        if (index !== 9) assert.equal(draftParagraphs[index], paragraph, `Food Forest L2 paragraph ${index + 1} stays English`);
      });
    }
    if (original.id === 'food-forest-l3') {
      const sourceParagraphs = original.body.split('\n\n');
      const draftParagraphs = lesson.body.sesothoDraft.split('\n\n');
      assert.equal(lesson.body.reviewStatus, 'machine-draft');
      assert.equal(lesson.title.reviewStatus, 'hold', 'retain the existing L3 title hold');
      assert.equal(lesson.infographicAlt?.reviewStatus, 'hold', 'retain the existing L3 image-description hold');
      assert.deepEqual(lesson.keyPoints.map(point => point.reviewStatus), ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft'],
        'retain the already-visible L3 key-point drafts');
      assert.deepEqual(lesson.quiz.map(question => [question.question.reviewStatus, question.options.map(option => option.reviewStatus), question.rationale.reviewStatus]), [
        ['machine-draft', ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft'], 'hold'],
        ['machine-draft', ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft'], 'hold'],
      ], 'retain all pre-existing L3 quiz draft and hold statuses');
      assert.equal(draftParagraphs[0],
        'Qala ka ho hlahloba site, phepelo ya metsi le tlhokomelo e fumanehang. Sireletsa mobu o pepesitsweng esale pele.');
      assert.equal(draftParagraphs[2],
        'Difate tsa sehlooho (main trees) le mekgahlelo e ka tlase (lower layers) di ka kenngwa ha maemo a dumela. ' +
        'Ground cover ha e hloke ho ema ho fihlela qetellong; qoba dimela tse qothisanang le difate tse nyane.');
      assert.equal(draftParagraphs[3],
        'Qala ka sebaka seo o ka se nosetsang le ho se hlokomela. Hlahloba dimela tse seng di le teng pele o di tlosa.');
      assert.equal(draftParagraphs[6],
        'Sheba kamoo moriti, metso le metsi a fumanehang di amang dimela tse haufi kateng.');
      assert.equal(draftParagraphs[9],
        'Kgetha monyetla wa ho lema ha mongobo wa mobu le maemo a lehodimo a lebelletsweng di tshehetsa establishment.');
      assert.equal(draftParagraphs[10],
        'Pula e ka thusa, empa hlahloba root zone mme o boloke leano la nosetso la backup. Qoba ho lema mobung o tletseng metsi.');
      sourceParagraphs.forEach((paragraph, index) => {
        if (![0, 2, 3, 6, 9, 10].includes(index)) assert.equal(draftParagraphs[index], paragraph, `Food Forest L3 paragraph ${index + 1} stays English`);
      });
    }
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

  assert.deepEqual(holds.filter(path => path.startsWith('lessons[0]')), [
    'lessons[0] food-forest-l1.infographicAlt',
    'lessons[0] food-forest-l1.title',
    'lessons[0] food-forest-l1.quiz[0].rationale',
    'lessons[0] food-forest-l1.quiz[1].rationale',
  ], 'uncertain planting, legal, and visually corrected image wording stay exact English');
  assert.deepEqual(holds.filter(path => path.startsWith('lessons[1]') || path.startsWith('lessons[2]')), [
    'lessons[1] food-forest-l2.keyPoints[0]',
    'lessons[1] food-forest-l2.keyPoints[1]',
    'lessons[1] food-forest-l2.keyPoints[2]',
    'lessons[1] food-forest-l2.keyPoints[3]',
    'lessons[1] food-forest-l2.quiz[0].question',
    'lessons[1] food-forest-l2.quiz[0].rationale',
    'lessons[1] food-forest-l2.quiz[1].rationale',
    'lessons[2] food-forest-l3.infographicAlt',
    'lessons[2] food-forest-l3.title',
    'lessons[2] food-forest-l3.quiz[0].rationale',
    'lessons[2] food-forest-l3.quiz[1].rationale',
  ], 'retain existing holds; the only new drafts are the selected L2/L3 body sentences');
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

test('Sesotho Food Forest site-care draft keeps uncertain material and pruning guidance in English', () => {
  const source = COURSE_MODULES.find(module => module.id === 'food-forest')!;
  const lesson = source.lessons.find(item => item.id === 'food-forest-l3')!;
  const draft = SESOTHO_FOOD_FOREST_DRAFT.lessons.find(item => item.id === lesson.id)!;
  assert.equal(draft.body.sourceEnglish, lesson.body);
  const shown = resolveLearnerLessonPresentation(lesson, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.sesothoDraft);
  assert.equal(draft.body.sesothoDraft.split('\n\n').length, lesson.body.split('\n\n').length);
  for (const held of [
    'Where appropriate, plain cardboard under suitable mulch can suppress unwanted growth.',
    'Prune or thin support plants when needed, using methods suited to each species.',
    'Check young plants after planting. Harvest timing and outside inputs depend on the species, site and care; there is no guaranteed fifth-year result.',
  ]) assert.ok(draft.body.sesothoDraft.includes(held), `keep meaning-sensitive guidance exact English: ${held}`);
  assert.match(draft.body.sesothoDraft, /Sireletsa mobu o pepesitsweng esale pele/);
  assert.match(draft.body.sesothoDraft, /Qoba ho lema mobung o tletseng metsi/);
});

// Rewritten 2 October 2026: the chicken lesson is now a complete Sesotho draft, so the old pins on six
// held English sentences and English key points/quizzes give way to field-by-field draft checks that
// still require every animal-care, manure and food-crop condition to survive translation.
test('Sesotho chicken lesson drafts every field and keeps the animal-care, manure and food-crop conditions', () => {
  const source = COURSE_MODULES.find(module => module.id === 'small-livestock');
  assert.ok(source);
  const lesson = source.lessons.find(item => item.id === 'small-livestock-l1');
  assert.ok(lesson);
  const draft = SESOTHO_SMALL_LIVESTOCK_DRAFT.lessons[0];

  assert.equal(SESOTHO_SMALL_LIVESTOCK_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(SESOTHO_SMALL_LIVESTOCK_DRAFT.title.sourceEnglish, source.title);
  assert.equal(SESOTHO_SMALL_LIVESTOCK_DRAFT.description.sourceEnglish, source.description);
  assert.match(lesson.infographicAlt ?? '', /darker scratched patch/);
  assert.doesNotMatch(lesson.infographicAlt ?? '', /enriched|fertilized|root crop/i,
    'the image description must not claim a soil result the picture cannot show');
  checkCompleteLessonDraft(lesson, draft, 'st');
  assert.doesNotMatch(draftText(draft.infographicAlt!, 'st'), /monono|nontsha/i,
    'the Sesotho image description makes no soil-fertility claim either');

  const [foraging, tractor, safety] = draftText(draft.body, 'st').split('\n\n');
  assertKeeps(foraging, ['ha ho nke sebaka'], 'foraging does not replace feed, water, shelter or care');
  assertKeeps(tractor, ['Le suthise pele', 'Ha ho palo e le nngwe'], 'move before damage; no single bird number');
  assertKeeps(safety, ['hole le dimela tse nyenyane', 'Manyolo a matjha a ka jara', 'pele ho sejalo se latelang',
    'Dipidipidi (ducks)'], 'seedlings, fresh-manure germs, before the next crop, ducks named as ducks');
  assertKeeps(draftText(draft.keyPoints[2], 'st'), ['kamora kotulo', 'le ka mohla'], 'only after harvest, never near seedlings');

  const card = resolveCourseModulePresentation(source, 'st');
  assert.equal(card.status, 'draft');
  assert.equal(card.title, SESOTHO_SMALL_LIVESTOCK_DRAFT.title.sesothoDraft);
  assert.equal(resolveCourseModulePresentation({ ...source, title: `${source.title} Changed.` }, 'st').status,
    'english-fallback');
  assert.deepEqual(resolveDeckLang(source.id, 'st'), { lang: 'st', exact: true },
    'the silent Sesotho Small Livestock deck pairs its unreviewed text with the exact English source');
  assert.deepEqual(resolveNarrationLang(source.id, 'st'), { lang: 'en', exact: false });
});

// Rewritten 2 October 2026: the bee lesson is now a complete Sesotho draft. Movement rules, hive siting,
// registration and swarm inspection are translated with their conditions instead of held in English;
// the Department, demarcation line and other technical names stay in English inside the Sesotho.
test('Sesotho bee lesson drafts every field and keeps movement rules, registration and swarm conditions', () => {
  const source = COURSE_MODULES.find(module => module.id === 'small-livestock');
  assert.ok(source);
  const lesson = source.lessons.find(item => item.id === 'small-livestock-l2');
  assert.ok(lesson);
  const draft = SESOTHO_SMALL_LIVESTOCK_DRAFT.lessons.find(item => item.id === lesson.id);
  assert.ok(draft, 'the L2 source-paired draft must be present');

  checkCompleteLessonDraft(lesson, draft, 'st');
  assert.match(draftText(draft.title, 'st'), /^Dinotshi \(bees\)/,
    'South African Sesotho spelling for the Free State/QwaQwa edition, with the English animal name beside it');
  const [pollination, ranges, care] = draftText(draft.body, 'st').split('\n\n');
  assertKeeps(pollination, ['Hive ha e netefatse', 'pollination', 'avocado'], 'a hive does not guarantee yields');
  assertKeeps(ranges, ['ha di a lokela ho sebediswa e le tataiso', 'demarcation line', 'pele o fallisa dinotshi'],
    'natural ranges are not a movement guide; check the rules before moving bees');
  assertKeeps(care, ['pele o fumana hive', 'se tla pele', 'ha di bontshe', 'ngodiso', 'Department', 'e seng diagnosis'],
    'learn first, safety first, active bees prove nothing, registration, crowding is not a diagnosis');

  const l3Source = source.lessons.find(item => item.id === 'small-livestock-l3');
  assert.ok(l3Source);
  const l3Draft = SESOTHO_SMALL_LIVESTOCK_DRAFT.lessons.find(item => item.id === l3Source.id);
  assert.ok(l3Draft);
  assert.equal(resolveLearnerLessonPresentation(l3Source, 'st').status, 'draft');
  assert.equal(l3Draft.body.sourceEnglish, l3Source.body);
});
