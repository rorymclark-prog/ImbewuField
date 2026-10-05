import { vegetablesBeforeFuller } from './vegetables-l1-fuller-checks.ts';
import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

test('Vegetables and Staple Crops Sesotho draft keeps exact sources, agronomic figures and quiz answers', () => {
  const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples');
  assert.ok(source, 'the source module must remain available');
  // 5 October: preserve historical safeguards after validating every current completion edge.
  const draft = vegetablesBeforeFuller('st', SESOTHO_VEGETABLES_STAPLES_DRAFT);
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
    'lessons[2] vegetables-staples-l3.keyPoints[2]',
    'lessons[3] vegetables-staples-l4.infographicAlt',
    'lessons[3] vegetables-staples-l4.quiz[0].options[1]',
    'lessons[3] vegetables-staples-l4.quiz[0].rationale',
  ], 'seed physiology and precise product-registration/safety wording remain held while the three ordinary assessment fields are source-paired');

  const bedSource = source.lessons[0].body.split('\n\n');
  const bedDraft = draft.lessons[0].body.sesothoDraft.split('\n\n');
  // Localize simple framing while the soil decision and nursery sequence remain anchored to their source.
  assert.match(bedDraft[7], /^U se ke ua cheka wet clay\. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation\.$/,
    'the no-dig wet-clay prohibition and full severity/adviser/before-deeper-cultivation safeguard remain');
  assert.match(bedDraft[12], /^Others do better with a protected start in a nursery, then transplanting\. Tomatoes le brassicas ke tsa sehlopha seo\.$/,
    'the nursery/transplanting sequence is retained and tomato/brassica grouping is localized');
  assert.match(bedDraft[17], /^Jwale lokisetsa ho ya ka mobu wa hao — no-dig first, and dig deeper only if your ground genuinely needs it\.$/,
    'no-dig remains first and deeper digging is still limited to ground that genuinely needs it');
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
  // Translate the opening diagnosis cue, but keep the single-crop and chemical/predator causes exact.
  assert.ok(pestDraft[1].startsWith('Dimela tse nang le stress. '));
  assert.ok(pestDraft[1].endsWith('One crop dominating the ground. Or broad chemical use that has already removed the predators that were helping you.'),
    'the remaining causes, especially that broad chemical use has already removed helpful predators, stay exact');
  assert.match(pestDraft[2], /pele o phekola eng kapa eng.*system yohle/);
  assert.ok(pestDraft[3].includes('metsi') && pestDraft[3].includes('mobu o petetsane') && pestDraft[3].includes('ha o na phepo'));
  assert.ok(pestDraft[3].includes('dibatana tsa disenyi di se di thusa'),
    'the full water/soil/nutrient/predator diagnostic list and already-helping condition stay present');
  assert.match(pestDraft[5], /mehato e mene, ka tatellano/);
  assert.match(pestDraft[9], /Ke ka morao feela moo o nkang kgato/);
  assert.ok(pestDraft[9].endsWith('and start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Netefatsa hore ketso e loketse bothata, mme o behe leihlo sephethong.'), 'translate the fit and monitoring check while preserving the prior only-then/lightest/may-help sequence');
  assert.ok(pestDraft[8].includes('Beneficial insects') && pestDraft[8].includes('mosebetsi'),
    'the ordinary protection framing now includes the benefit insects provide');
  assert.equal(pestDraft[10], pestSource[10],
    'registration for the crop and pest, label directions, harvest waiting instructions, and the ban on improvised or stronger doses stay exact');
  const shownPests = resolveLearnerLessonPresentation(source.lessons[3], 'st');
  assert.equal(shownPests.status, 'draft');
  assert.deepEqual(shownPests.content.body.split('\n\n'), pestDraft,
    'the learner sees the same source-aligned diagnostic sequence covered above');
  const changedPestSource = { ...source.lessons[3], body: `${source.lessons[3].body}\nChanged diagnostic.` };
  assert.equal(resolveLearnerLessonPresentation(changedPestSource, 'st').status, 'english-fallback',
    'a changed diagnostic source cannot inherit these machine drafts');
  assert.equal(resolveLearnerLessonPresentation(changedPestSource, 'st').content.body, changedPestSource.body);
  const staplesSource = source.lessons[2].body.split('\n\n');
  const staplesDraft = draft.lessons[2].body.sesothoDraft.split('\n\n');
  const expectedStapleDraft = [
    "Staple e tshwanelwa ke sebaka sa yona hobane e fepa lelapa le kamora letsatsi la kotulo.",
    "E fana ka energy kapa protein. E a bolokwa, kapa e sala e le mobung ho fihlela o e hloka. Hangata e boetse e na le cultural memory.",
    "Staple e le nngwe e o siya o sa sireletseha. Tse pedi kapa ho feta di o fa dikgetho ha weather kapa pests di otla.",
    "Lema bonyane tse pedi. E seng se le seng.",
    "Ke staple efe eo lelapa la hao le itšetlehileng ka eona haholo hona joale? That's the one whose failure would hurt most — so that's the one that needs a companion.",
    "Staple e nngwe le e nngwe e o sireletsa kgahlanong le ntho e fapaneng.",
    "Maize e fana ka calories, ’me e ka bolokoa e omme. Open-pollinated maize e boetse e u lumella ho boloka peo ea hao, haeba u laola isolation le selection.",
    "Beans le cowpeas li fana ka protein harvest e ka bolokoang.",
    "Sweet potato e ba le drought tolerance e itseng ka mor’a hore storage roots tsa eona li bopehe. E hloka metsi libekeng tsa pele le ha storage roots li ntse li bopeha; water stress ka nako eo e ka fokotsa harvest. Its young leaves are edible too.",
    "Amadumbe e khona ho mamella wetter ground, moo lijalo tse ling tsa staple li thatafalloang teng.",
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
  assert.match(staplesDraft[3], /bonyane tse pedi.*E seng se le seng/, 'the minimum remains two, never one');
  assert.match(staplesDraft[4], /^Ke staple efe.*?hona joale\? That's the one whose failure would hurt most — so that's the one that needs a companion\.$/,
    'the household reliance question is localized while the conditional failure and companion consequence remain exact English');
  assert.match(staplesDraft[6], /calories.*bolokoa e omme.*Open-pollinated maize.*peo.*haeba.*isolation le selection/,
    'seed saving remains conditional on managing isolation and selection');
  assert.match(staplesDraft[7], /Beans le cowpeas.*protein harvest.*bolokoang/,
    'both named crops still provide a storable protein harvest');
  assert.match(staplesDraft[8], /drought tolerance.*ka mor’a hore storage roots.*libekeng tsa pele.*storage roots.*water stress.*e ka fokotsa harvest.*Its young leaves are edible too\.$/,
    'limited drought tolerance starts after storage roots form; early/root-forming water needs and possible loss under stress remain, with the young-leaves clause exact');
  assert.match(staplesDraft[9], /^Amadumbe.*wetter ground.*lijalo tse ling tsa staple li thatafalloang teng\.$/,
    'the wetter-ground anchor stays English while the comparison remains limited to other staples struggling there');
  for (const index of [0, 1, 2, 5, 10, 12, 13, 14, 15]) {
    assert.notEqual(staplesDraft[index], staplesSource[index],
      `staple paragraph ${index + 1}: defensible ordinary framing is drafted rather than left wholly in English`);
  }
});


test('Sesotho assessment drafts stay source-bound and fail closed when exact English changes', () => {
  const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples');
  assert.ok(source);
  const draft = SESOTHO_VEGETABLES_STAPLES_DRAFT;

  const l1 = source.lessons[0];
  const l1q = draft.lessons[0].quiz[1];
  assert.equal(l1q.sourceCorrectIndex, l1.quiz[1].correct);
  assert.equal(l1q.options[1].sourceEnglish, 'Brassicas, which need protection while small');
  assert.equal(l1q.options[1].sesothoDraft, 'Brassicas, tse hlokang tshireletso ha di sa le nyane');
  let shown = resolveLearnerLessonPresentation(l1, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.quiz[1].options[1], l1q.options[1].sesothoDraft);
  const changedL1 = { ...l1, quiz: l1.quiz.map((q, i) => i === 1 ? { ...q, options: q.options.map((o, j) => j === 1 ? `${o} changed` : o) } : q) };
  shown = resolveLearnerLessonPresentation(changedL1, 'st');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.quiz[1].options[1], changedL1.quiz[1].options[1]);

  const l2 = source.lessons[1];
  const l2q = draft.lessons[1].quiz[0];
  assert.equal(l2q.sourceCorrectIndex, l2.quiz[0].correct);
  assert.equal(l2q.question.sourceEnglish, 'Why sow lettuce in small batches every 2-3 weeks instead of all at once?');
  assert.equal(l2q.question.sesothoDraft, 'Ke hobaneng ha o jala lettuce ka dihlopha tse nyane dibeke tse ding le tse ding tse 2-3 ho e na le ho e jala kaofela hang?');
  shown = resolveLearnerLessonPresentation(l2, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.quiz[0].q, l2q.question.sesothoDraft);
  const changedL2 = { ...l2, quiz: l2.quiz.map((q, i) => i === 0 ? { ...q, q: `${q.q} changed` } : q) };
  shown = resolveLearnerLessonPresentation(changedL2, 'st');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.quiz[0].q, changedL2.quiz[0].q);
  assert.match(l2q.question.sesothoDraft, /dibeke tse ding le tse ding tse 2-3/);

  const l4 = source.lessons[3];
  const l4q = draft.lessons[3].quiz[1];
  assert.equal(l4q.sourceCorrectIndex, l4.quiz[1].correct);
  assert.equal(l4q.question.sourceEnglish, "A farmer's brassica leaves are turning yellow. Before assuming pests, what should she check first?");
  assert.equal(l4q.question.sesothoDraft, 'Ha makhasi a brassica a sehoai a fetoha mosehla, pele a nahana hore ke disenyi, o lokela ho hlahloba eng pele?');
  shown = resolveLearnerLessonPresentation(l4, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.quiz[1].q, l4q.question.sesothoDraft);
  const changedL4 = { ...l4, quiz: l4.quiz.map((q, i) => i === 1 ? { ...q, q: `${q.q} changed` } : q) };
  shown = resolveLearnerLessonPresentation(changedL4, 'st');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.quiz[1].q, changedL4.quiz[1].q);
  assert.match(l4q.question.sesothoDraft, /pele a nahana hore ke disenyi/);
});
