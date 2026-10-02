import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const sourceModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!;
const checkedL3SourceParagraphs = [
  "A staple earns its place because it feeds the household beyond the day of harvest.",
  "It carries energy or protein. It stores, or it stays in the ground until you need it. And often it carries cultural memory too.",
  "One staple leaves you vulnerable. Two or more give you options when weather or pests hit.",
  "Grow at least two. Not one.",
  "Which staple does your household rely on most heavily right now? That's the one whose failure would hurt most — so that's the one that needs a companion.",
  "Each staple protects you against something different.",
  "Maize gives calories, and stores dry. Open-pollinated maize also lets you save your own seed, if you manage isolation and selection.",
  "Beans and cowpeas give a storable protein harvest.",
  "Sweet potato develops some drought tolerance after its storage roots form. It needs water in the first weeks and while roots are forming; water stress then can reduce the harvest. Its young leaves are edible too.",
  "Amadumbe handles wetter ground, where other staples struggle.",
  "Notice that they fail in different conditions. That's the whole point.",
  "Resilience doesn't mean nothing fails.",
  "It means one failure doesn't finish your household's food plan.",
  "One crop is one point of failure.",
  "Two or more staples give you more ways to keep eating.",
  "Different crops use water, soil and seasons differently. That difference is the protection."
];
const checkedL3SourceEnglish = checkedL3SourceParagraphs.join('\n\n');
const checkedL3DraftParagraphs = [
  "A staple earns its place hikuva yi phamela ndyangu ni le ndzhaku ka siku ra ntshovelo.",
  "Yi nyika energy kumbe protein. It stores, or it stays in the ground until you need it. Hakanyingi yi tlhela yi rhwala cultural memory.",
  "Staple yin'we yi ku siya u nga sirhelelekanga. Swimbirhi kumbe ku fhira swi ku nyika tindlela to hlawula loko maxelo kumbe pests ti hlasela.",
  "Byala swimbirhi kumbe ku fhira. Ku nga ri xin'we.",
  "Which staple does your household rely on most heavily right now? That's the one whose failure would hurt most — so that's the one that needs a companion.",
  "Staple yin'wana ni yin'wana yi ku sirhelela eka xilo xo hambana.",
  "Maize gives calories, and stores dry. Open-pollinated maize also lets you save your own seed, if you manage isolation and selection.",
  "Beans and cowpeas give a storable protein harvest.",
  "Sweet potato develops some drought tolerance after its storage roots form. It needs water in the first weeks and while roots are forming; water stress then can reduce the harvest. Its young leaves are edible too.",
  "Amadumbe handles wetter ground, where other staples struggle.",
  "Xiya leswaku swibyariwa leswi swi tsandzeka eka swiyimo swo hambana. Hi yona mhaka ya kona.",
  "Resilience a swi vuli leswaku a ku na lexi tsandzekaka.",
  "Swi vula leswaku ku tsandzeka kun'we a ku herisi kungu ra swakudya ra ndyangu wa wena.",
  "Xibyariwa xin'we i \"point of failure\" yin'we.",
  "Two or more staples give you more ways to keep eating.",
  "Swibyariwa swo hambana swi tirhisa mati, misava na tinguva hi tindlela to hambana. Ku hambana loku hi kona ku va nsirhelelo."
];

test('Vegetables & Staple Crops L3 keeps its checked source frozen while adding bounded Xitsonga framing', () => {
  const draft = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons[0];
  assert.equal(XITSONGA_VEGETABLES_STAPLES_DRAFT.id, sourceModule.id);
  assert.equal(XITSONGA_VEGETABLES_STAPLES_DRAFT.language, 'ts');
  assert.equal(XITSONGA_VEGETABLES_STAPLES_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(draft.id, sourceLesson.id);
  assert.equal(sourceLesson.body, checkedL3SourceEnglish,
    'a changed canonical lesson source requires a new checked source pair');
  assert.equal(draft.body.sourceEnglish, checkedL3SourceEnglish,
    'the learner draft stays bound to the exact reviewed English rather than following future edits');
  assert.equal(draft.body.reviewStatus, 'machine-draft');

  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const localizedParagraphs = draft.body.xitsongaDraft.split('\n\n');
  assert.deepEqual(sourceParagraphs, checkedL3SourceParagraphs,
    'canonical body order and paragraph boundaries still match the checked packet');
  assert.equal(localizedParagraphs.length, sourceParagraphs.length);
  assert.deepEqual(localizedParagraphs, checkedL3DraftParagraphs,
    'ordinary framing is localized while checked existing paragraphs and holds stay in place');
  for (const index of [4, 6, 7, 8, 9, 14]) {
    assert.equal(localizedParagraphs[index], sourceParagraphs[index],
      `paragraph ${index} retains its unresolved superlative or crop-specific agronomic claim exactly`);
  }
  for (const index of [10, 11, 12, 13, 15]) {
    assert.equal(localizedParagraphs[index], checkedL3DraftParagraphs[index],
      `existing Xitsonga paragraph ${index} remains byte-for-byte preserved`);
  }

  assert.equal(draft.title.sourceEnglish, sourceLesson.title);
  assert.equal(draft.title.xitsongaDraft, sourceLesson.title);
  assert.equal(draft.title.reviewStatus, 'hold');
  assert.equal(draft.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
  assert.equal(draft.infographicAlt?.xitsongaDraft, sourceLesson.infographicAlt);
  assert.deepEqual(draft.keyPoints.map(item => item.sourceEnglish), sourceLesson.keyPoints);
  assert.deepEqual(draft.keyPoints.map(item => item.xitsongaDraft), sourceLesson.keyPoints);
  assert.ok(draft.keyPoints.every(item => item.reviewStatus === 'hold'));
  assert.equal(draft.quiz.length, sourceLesson.quiz.length);
  for (const [index, question] of draft.quiz.entries()) {
    const source = sourceLesson.quiz[index];
    assert.equal(question.question.sourceEnglish, source.q);
    assert.equal(question.question.xitsongaDraft, source.q);
    assert.deepEqual(question.options.map(option => option.sourceEnglish), source.options);
    assert.deepEqual(question.options.map(option => option.xitsongaDraft), source.options);
    assert.equal(question.sourceCorrectIndex, source.correct);
    assert.equal(question.rationale.sourceEnglish, source.rationale);
    assert.equal(question.rationale.xitsongaDraft, source.rationale);
  }

  const shown = resolveLearnerLessonPresentation(sourceLesson, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.deepEqual(shown.content.keyPoints, sourceLesson.keyPoints);
  assert.deepEqual(shown.content.quiz, sourceLesson.quiz);
});

test('Vegetables & Staple Crops L3 source drift and undrafted lesson sources fall back to English', () => {
  const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body}\nChanged.` };
  const shown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.body, changedSource.body);

  assert.equal(resolveLearnerLessonPresentation(sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!, 'ts').status,
    'draft', 'L2 is separately source-paired in this combined batch');
  // L4 now has independently checked framing; every registered body remains source-bound.
  const fourth = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!;
  assert.equal(resolveLearnerLessonPresentation(fourth, 'ts').status, 'draft');
  const changedFourth = { ...fourth, body: fourth.body + ' Changed safety condition.' };
  assert.equal(resolveLearnerLessonPresentation(changedFourth, 'ts').status, 'english-fallback');
  assert.equal(resolveLearnerLessonPresentation(changedFourth, 'ts').content.body, changedFourth.body);
});

test('Vegetables & Staple Crops L3 preserves the one-failure scope while holding the staple-count claim', () => {
  const paragraphs = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n');
  assert.match(paragraphs[11], /Resilience a swi vuli leswaku a ku na lexi tsandzekaka/);
  assert.match(paragraphs[12], /ku tsandzeka kun'we a ku herisi kungu ra swakudya ra ndyangu wa wena/);
  assert.match(paragraphs[13], /point of failure/);
  assert.equal(paragraphs[14], sourceLesson.body.split('\n\n')[14]);
  assert.match(paragraphs[14], /^Two or more staples give you more ways to keep eating\.$/);
  assert.match(paragraphs[15], /mati, misava na tinguva/);
});

// L1 now has a body draft; the remaining farming and assessment fields remain exact-source holds.
test('Xitsonga bed paragraphs preserve dimensions, access and soil restrictions and withdraw on source drift', () => {
  const source = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!;
  const matches = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons.filter(lesson => lesson.id === source.id);
  assert.equal(matches.length, 1);
  const draft = matches[0];
  const paragraphs = draft.body.xitsongaDraft.split('\n\n');
  const english = source.body.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(paragraphs.length, english.length);
  for (const index of [2, 6, 7, 8, 9, 12, 15, 17]) {
    assert.equal(paragraphs[index], english[index], 'hold geometry, soil suitability, establishment sequence and dimensions');
  }
  assert.ok(paragraphs[0].includes('Roots slow down.'));
  assert.ok(paragraphs[1].endsWith('Permanent paths, and a bed narrow enough to reach into from both sides.'));
  assert.ok(paragraphs[11].endsWith("They do better sown straight where they'll grow. Beans, carrots and maize belong in that group."));
  assert.ok(paragraphs[13].includes('crop, variety and local conditions. Check the packet and local grower advice. Watch for crowding as plants develop.'));
  assert.ok(paragraphs[16].endsWith('Mark the rectangle, and mark both access paths.'));
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.title.xitsongaDraft, 'Ku Lulamisa ni ku Byala Mabedhe ya Wena.');
  assert.equal(draft.title.reviewStatus, 'machine-draft');
  assert.equal(draft.infographicAlt?.xitsongaDraft, source.infographicAlt);
  assert.equal(draft.infographicAlt?.reviewStatus, 'hold');
  assert.deepEqual(draft.keyPoints.map(item => item.sourceEnglish), source.keyPoints);
  assert.deepEqual(draft.keyPoints.map(item => item.xitsongaDraft), source.keyPoints);
  assert.ok(draft.keyPoints.every(item => item.reviewStatus === 'hold'));
  assert.equal(draft.quiz.length, source.quiz.length);
  for (const [index, question] of draft.quiz.entries()) {
    const original = source.quiz[index];
    assert.equal(question.question.sourceEnglish, original.q);
    assert.deepEqual(question.options.map(option => option.sourceEnglish), original.options);
    assert.deepEqual(question.sourceCorrectIndex, original.correct);
    assert.equal(question.rationale.sourceEnglish, original.rationale);
    assert.equal(question.rationale.xitsongaDraft, original.rationale);
    assert.equal(question.rationale.reviewStatus, 'hold');
    assert.deepEqual(question.options.map(option => option.reviewStatus), index === 0 ? ['machine-draft', 'hold', 'hold', 'hold'] : ['hold', 'hold', 'hold', 'hold'],
      'only the reviewed ordinary distractor is drafted; option order remains canonical');
  }
  assert.equal(draft.quiz[0].question.xitsongaDraft, 'Hikokwalaho ka yini u hlayisa vegetable bed e le 1-1.2m wide ku ri na ku yi endla yi anama ku tlurisa?');
  assert.equal(draft.quiz[0].question.reviewStatus, 'machine-draft');
  assert.equal(draft.quiz[0].options[0].xitsongaDraft, 'Mabedhe lama anameke ma kuma dyambu ro tala ngopfu.');
  assert.equal(draft.quiz[0].options[0].reviewStatus, 'machine-draft');
  assert.equal(draft.quiz[0].options[1].reviewStatus, 'hold');
  assert.equal(draft.quiz[1].question.xitsongaDraft, 'Hi xihi xibyariwa lexi faneleke ngopfu ku byariwa hi direct-seeding ku ri na transplanting?');
  assert.equal(draft.quiz[1].question.reviewStatus, 'machine-draft');
  assert.equal(draft.quiz[1].sourceCorrectIndex, 2);
  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.equal(shown.content.keyPoints[0], source.keyPoints[0]);
  assert.equal(shown.content.quiz[0].q, draft.quiz[0].question.xitsongaDraft);
  assert.equal(shown.content.quiz[0].options[0], draft.quiz[0].options[0].xitsongaDraft);
  assert.equal(shown.content.quiz[0].options[1], source.quiz[0].options[1]);
  assert.equal(shown.content.quiz[1].q, draft.quiz[1].question.xitsongaDraft);
  const changed = { ...source, body: source.body + ' Changed planting condition.' };
  assert.equal(resolveLearnerLessonPresentation(changed, 'ts').status, 'english-fallback');
});


test('Pest framing retains four-step order and exact treatment safeguards beside unchanged English', () => {
  const source = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!;
  const matches = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons.filter(lesson => lesson.id === source.id);
  assert.equal(matches.length, 1);
  const draft = matches[0];
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const english = source.body.split('\n\n');
  const paragraphs = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(paragraphs.length, 12);
  for (const index of [1, 3, 4, 6, 7, 10]) assert.equal(paragraphs[index], english[index]);
  for (const index of [0, 2, 5, 8, 9, 11]) assert.notEqual(paragraphs[index], english[index]);
  assert.equal(paragraphs[5], 'Tirha hi magoza ya mune, hi ku landzelelana.');
  assert.ok(paragraphs[8].endsWith("Beneficial insects are doing work you'd otherwise do yourself."));
  assert.ok(paragraphs[9].startsWith('Vumune. Hi kona ntsena u tekaka goza —'));
  assert.ok(paragraphs[9].endsWith(english[9].slice(english[9].indexOf('—') + 2)));
  assert.ok(paragraphs[11].startsWith("Tshembeka eka wena n'winyi"));
  assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), source.quiz.map(question => question.correct));
  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.deepEqual(shown.content.quiz, source.quiz);
  assert.deepEqual(shown.content.keyPoints, source.keyPoints);
});
