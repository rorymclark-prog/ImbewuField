import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-st-vegetables-staples.ts';

test('Vegetables and Staple Crops Sesotho draft keeps exact sources, agronomic figures and quiz answers', () => {
  const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples');
  assert.ok(source, 'the source module must remain available');
  const draft = SESOTHO_VEGETABLES_STAPLES_DRAFT;
  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;
  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: exact English source must be retained`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: draft or exact English hold must be present`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: status must be explicit`);
    assert.doesNotMatch(pair.sesothoDraft, nonLatin, `${path}: keep draft text in Latin script`);
    assert.deepEqual(placeholders(pair.sesothoDraft), placeholders(english), `${path}: preserve placeholders`);
    assert.deepEqual(numberTokens(pair.sesothoDraft), numberTokens(english), `${path}: preserve source figures exactly`);
    if (pair.reviewStatus === 'hold') assert.equal(pair.sesothoDraft, english, `${path}: held text must remain exact English`);
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'all four lessons must be paired');
  const holds: string[] = [];
  for (const [lessonIndex, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[lessonIndex];
    const path = `lessons[${lessonIndex}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: IDs and order must match`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: source infographic text needs a pair`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
      if (lesson.infographicAlt.reviewStatus === 'hold') holds.push(`${path}.infographicAlt`);
    } else assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent infographic text`);
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sesothoDraft.split('\n\n').length, original.body.split('\n\n').length,
      `${path}.body: keep source paragraph boundaries`);
    if (lesson.body.reviewStatus === 'hold') holds.push(`${path}.body`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: key point count must match`);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      checkPair(point, original.keyPoints[pointIndex], `${path}.keyPoints[${pointIndex}]`);
      if (point.reviewStatus === 'hold') holds.push(`${path}.keyPoints[${pointIndex}]`);
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
        if (option.reviewStatus === 'hold') holds.push(`${questionPath}.options[${optionIndex}]`);
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: answer index must stay unchanged`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: correct option must still point to the exact source answer`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`);
      if (question.rationale.reviewStatus === 'hold') holds.push(`${questionPath}.rationale`);
    }
  }
  assert.deepEqual(holds, [
    'lessons[0] vegetables-staples-l1.quiz[1].options[1]',
    'lessons[1] vegetables-staples-l2.quiz[0].question',
    'lessons[2] vegetables-staples-l3.keyPoints[2]',
    'lessons[3] vegetables-staples-l4.infographicAlt',
    'lessons[3] vegetables-staples-l4.quiz[0].options[1]',
    'lessons[3] vegetables-staples-l4.quiz[0].rationale',
    'lessons[3] vegetables-staples-l4.quiz[1].question',
  ], 'uncertain crop and pest passages stay exact English until reviewed');

  const bedSource = source.lessons[0].body.split('\n\n');
  const bedDraft = draft.lessons[0].body.sesothoDraft.split('\n\n');
  // New source-paired ordinary prose replaces whole-paragraph holds; precise conditions still bind.
  for (const index of [7, 12, 17]) {
    assert.equal(bedDraft[index], bedSource[index], `bed paragraph ${index + 1}: soil prohibition, crop grouping and deeper-cultivation conditions stay English`);
  }
  for (const [index, condition] of [
    [1, 'Permanent paths, and a bed narrow enough to reach into from both sides.'],
    [2, 'At that width you can reach the centre from either path, and your feet never touch the growing area.'],
    [5, 'least disturbance that solves your problem'],
    [6, 'build fertility on top'],
    [8, 'water needs somewhere to drain away to'],
    [9, 'you want to catch and hold what rain you get'],
    [11, "They do better sown straight where they'll grow. Beans, carrots and maize belong in that group."],
    [13, 'spacing guidance for the crop, variety and local conditions'],
    [14, 'mark the bed out'],
    [16, 'mark both access paths'],
  ] as const) assert.ok(bedDraft[index].includes(condition), `bed paragraph ${index + 1}: preserve ${condition}`);
  assert.match(bedDraft[6], /boholo ba mobu wa dirapa/, 'no-dig suits most garden soils, not every soil');
  assert.match(bedDraft[15], /Bophara ba One point two metres\. Bolelele ba Three metres/, 'width and length cannot swap');
  const pestSource = source.lessons[3].body.split('\n\n');
  const pestDraft = draft.lessons[3].body.sesothoDraft.split('\n\n');
  // Ordinary step framing now has checked drafts; causal ecology and treatment safeguards remain English.
  for (const index of [1, 10]) {
    assert.equal(pestDraft[index], pestSource[index], `pest paragraph ${index + 1}: precise ecology and treatment safeguards stay exact English`);
  }
  assert.match(pestDraft[2], /pele o phekola eng kapa eng.*system yohle/);
  assert.match(pestDraft[5], /mehato e mene, ka tatellano/);
  assert.match(pestDraft[9], /Ke ka morao feela moo o nkang kgato/);
  assert.ok(pestDraft[9].endsWith('and start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Check that the action suits the problem and monitor the result.'));
  assert.ok(pestDraft[8].endsWith('Beneficial insects are doing work you\'d otherwise do yourself.'));
  const staplesSource = source.lessons[2].body.split('\n\n');
  const staplesDraft = draft.lessons[2].body.sesothoDraft.split('\n\n');
  const expectedStapleDraft = [
    "Staple e tshwanelwa ke sebaka sa yona hobane e fepa lelapa le kamora letsatsi la kotulo.",
    "E fana ka energy kapa protein. E a bolokwa, kapa e sala e le mobung ho fihlela o e hloka. Hangata e boetse e na le cultural memory.",
    "Staple e le nngwe e o siya o sa sireletseha. Tse pedi kapa ho feta di o fa dikgetho ha weather kapa pests di otla.",
    "Grow at least two. Not one.",
    "Which staple does your household rely on most heavily right now? That's the one whose failure would hurt most — so that's the one that needs a companion.",
    "Staple e nngwe le e nngwe e o sireletsa kgahlanong le ntho e fapaneng.",
    "Maize gives calories, and stores dry. Open-pollinated maize also lets you save your own seed, if you manage isolation and selection.",
    "Beans and cowpeas give a storable protein harvest.",
    "Sweet potato develops some drought tolerance after its storage roots form. It needs water in the first weeks and while roots are forming; water stress then can reduce the harvest. Its young leaves are edible too.",
    "Amadumbe handles wetter ground, where other staples struggle.",
    "Hlokomela hore di hloleha maemong a fapaneng. Ke yona ntlha yohle.",
    "Ho mamella maemo a thata ha ho bolele hore ha ho letho le hlolehang.",
    "Ho bolela hore ho hloleha ho le hong ha ho fedise morero wa dijo wa lelapa la hao.",
    "Sejalo se le seng ke point of failure e le nngwe.",
    "Dijalo tse pedi kapa ho feta tsa staple di o fa ditsela tse ngata tsa ho tswela pele o ja.",
    "Dijalo tse fapaneng di sebedisa water, soil le seasons ka ditsela tse fapaneng. Phapang eo ke yona protection."
  ];
  assert.equal(staplesSource.length, 16, 'the staple lesson still has all sixteen source paragraphs');
  assert.deepEqual(staplesDraft, expectedStapleDraft,
    'Sesotho body follows the source-paired candidate while preserving exact holds and the existing translation');
  assert.equal(staplesDraft.length, staplesSource.length,
    'no paragraph can be dropped or shifted away from its agronomic source');
  assert.equal(staplesDraft[11], 'Ho mamella maemo a thata ha ho bolele hore ha ho letho le hlolehang.',
    'the already localized resilience paragraph remains byte-for-byte unchanged');
  for (const index of [3, 4, 6, 7, 8, 9]) {
    assert.equal(staplesDraft[index], staplesSource[index],
      `staple paragraph ${index + 1}: unresolved agreement, comparative or crop-specific conditions stay exact English`);
  }
  for (const index of [0, 1, 2, 5, 10, 12, 13, 14, 15]) {
    assert.notEqual(staplesDraft[index], staplesSource[index],
      `staple paragraph ${index + 1}: defensible ordinary framing is drafted rather than left wholly in English`);
  }
});
