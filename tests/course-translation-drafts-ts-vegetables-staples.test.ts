import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const sourceModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!;
const selectedDraftParagraphs = [
  'Xiya leswaku swibyariwa leswi swi tsandzeka eka swiyimo swo hambana. Hi yona mhaka ya kona.',
  'Resilience a swi vuli leswaku a ku na lexi tsandzekaka.',
  "Swi vula leswaku ku tsandzeka kun'we a ku herisi kungu ra swakudya ra ndyangu wa wena.",
  'Xibyariwa xin\'we i "point of failure" yin\'we.',
  'Two or more staples give you more ways to keep eating.',
  'Swibyariwa swo hambana swi tirhisa mati, misava na tinguva hi tindlela to hambana. Ku hambana loku hi kona ku va nsirhelelo.',
];
const selectedEnglishParagraphs = [
  "Notice that they fail in different conditions. That's the whole point.",
  "Resilience doesn't mean nothing fails.",
  "It means one failure doesn't finish your household's food plan.",
  'One crop is one point of failure.',
  'Two or more staples give you more ways to keep eating.',
  'Different crops use water, soil and seasons differently. That difference is the protection.',
];

test('Vegetables & Staple Crops L3 pairs the one-failure concept and holds the staple-count claim', () => {
  const draft = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons[0];
  assert.equal(XITSONGA_VEGETABLES_STAPLES_DRAFT.id, sourceModule.id);
  assert.equal(XITSONGA_VEGETABLES_STAPLES_DRAFT.language, 'ts');
  assert.equal(XITSONGA_VEGETABLES_STAPLES_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(draft.id, sourceLesson.id);
  assert.equal(draft.body.sourceEnglish, sourceLesson.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');

  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const localizedParagraphs = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(sourceParagraphs.length, 16);
  assert.equal(localizedParagraphs.length, sourceParagraphs.length);
  assert.deepEqual(sourceParagraphs.slice(10), selectedEnglishParagraphs);
  assert.deepEqual(localizedParagraphs.slice(0, 10), sourceParagraphs.slice(0, 10),
    'species-specific crop claims and farming instructions stay exact English');
  assert.deepEqual(localizedParagraphs.slice(10), selectedDraftParagraphs);
  assert.equal(localizedParagraphs[12], selectedDraftParagraphs[2], 'the one-failure sentence keeps its full household food-plan scope');
  assert.equal(localizedParagraphs[14], sourceParagraphs[14], 'the full staple-count sentence remains exact English');

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
  for (const lesson of sourceModule.lessons.filter(lesson => !['vegetables-staples-l1', 'vegetables-staples-l2', 'vegetables-staples-l3'].includes(lesson.id))) {
    const other = resolveLearnerLessonPresentation(lesson, 'ts');
    assert.equal(other.status, 'english-fallback');
    assert.equal(other.content.body, lesson.body);
  }
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
  assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), source.quiz.map(question => question.correct));
  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.deepEqual(shown.content.keyPoints, source.keyPoints);
  assert.deepEqual(shown.content.quiz, source.quiz);
  const changed = { ...source, body: source.body + ' Changed planting condition.' };
  assert.equal(resolveLearnerLessonPresentation(changed, 'ts').status, 'english-fallback');
});
