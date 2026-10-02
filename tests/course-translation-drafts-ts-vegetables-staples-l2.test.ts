import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { XITSONGA_VEGETABLES_STAPLES_L2_DRAFT } from '../lib/course-translation-drafts-ts-vegetables-staples-l2.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const sourceModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!;
const sourceParagraphsSelected = [
  'Succession planting is a calendar habit, not a special crop.',
  'Less waste during a glut. Fresh food for longer. And the labour spreads out across the season instead of landing on you all at once.',
];
const draftParagraphsSelected = [
  'Ku byala swibyariwa hi ku landzelelana i ntolovelo wa khalendara, a hi xibyariwa xo hlawuleka.',
  'Ku lahleka ka swakudya ka hunguteka loko ku ri na ntshovelo wo tala. Ku va na swakudya swo tenga nkarhi wo leha. Ntirho wu hangalaka hi nkarhi wa nguva, ematshan\'weni yo ku wu humelela hinkwawo hi nkarhi wun\'we.',
];

test('Vegetables & Staple Crops L2 exposes its source-paired body and bounded assessment drafts', () => {
  const moduleDraft = XITSONGA_VEGETABLES_STAPLES_L2_DRAFT;
  const draft = moduleDraft.lessons[0];
  assert.equal(moduleDraft.id, sourceModule.id);
  assert.equal(moduleDraft.language, 'ts');
  assert.equal(moduleDraft.reviewStatus, 'machine-draft');
  assert.equal(draft.id, sourceLesson.id);
  assert.equal(draft.body.sourceEnglish, sourceLesson.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');

  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const localizedParagraphs = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(localizedParagraphs.length, sourceParagraphs.length);
  assert.deepEqual([0, 3].map(index => sourceParagraphs[index]), sourceParagraphsSelected);
  assert.deepEqual([0, 3].map(index => localizedParagraphs[index]), draftParagraphsSelected);
  for (const index of [10, 12, 13, 14, 15, 19]) {
    assert.equal(localizedParagraphs[index], sourceParagraphs[index], `body paragraph ${index} keeps its complete crop-specific or conditional claim exact English`);
  }
  assert.ok(localizedParagraphs[1].includes('Hlawula swakudya') && localizedParagraphs[1].includes('xitsongo'));
  assert.ok(localizedParagraphs[2].includes('short row') && localizedParagraphs[2].includes('two to three weeks'));
  assert.ok(localizedParagraphs[4].startsWith('Separate sowings swi nga hunguta risk'));
  assert.ok(localizedParagraphs[4].endsWith('They do not guarantee a harvest if difficult conditions continue.'));
  assert.ok(localizedParagraphs[5].includes('fast crop') && localizedParagraphs[5].includes('small batches'));
  assert.ok(localizedParagraphs[7].includes('Then two to three weeks later') && localizedParagraphs[7].includes('xa vumune'));
  assert.ok(localizedParagraphs[8].startsWith('Loko crop timing yi lulamile, harvests can begin to overlap.'));
  assert.ok(localizedParagraphs[8].endsWith('The first batch will not always be ready by the fourth sowing.'));
  assert.ok(localizedParagraphs[9].startsWith('Two to three weeks i starting rhythm, a hi nawu.'));
  assert.ok(localizedParagraphs[11].startsWith('Intercropping is not just crowding different plants together.'), 'the definition of intercropping remains exact before its localized framing');
  assert.ok(localizedParagraphs[16].startsWith('Timing i ya nkoka.'));
  assert.ok(localizedParagraphs[17].startsWith('Swibyariwa swi nga ha phikizana. Give them suitable space, water and light.'));
  assert.ok(localizedParagraphs[17].includes('Beans fix nitrogen with root bacteria, but do not assume they immediately feed the maize; nutrients in residues are released during decomposition.'));
  assert.ok(localizedParagraphs[18].startsWith('Ndyangu wu nga va na hungry gap:'));
  assert.ok(localizedParagraphs[20].includes('U nga tekeleli calendar') && localizedParagraphs[20].includes("tin'hweti ta wena"));
  assert.ok(localizedParagraphs[21].startsWith('Ti tsale ehansi.'));

  assert.equal(draft.title.sourceEnglish, 'Succession Planting and Intercropping');
  assert.equal(draft.title.xitsongaDraft, 'Succession planting na intercropping');
  assert.equal(draft.title.reviewStatus, 'machine-draft');
  assert.equal(draft.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
  assert.equal(draft.infographicAlt?.xitsongaDraft, sourceLesson.infographicAlt);
  assert.deepEqual(draft.keyPoints.map(item => item.sourceEnglish), sourceLesson.keyPoints);
  assert.deepEqual(draft.keyPoints.map(item => item.sourceEnglish), sourceLesson.keyPoints);
  assert.deepEqual(draft.keyPoints.map(item => item.xitsongaDraft), [
    'Byalani staggered sowings, mi lulamisa interval hi ku ya hi crop, weather na household use.',
    'The Three Sisters yi huma eka Indigenous farming traditions in the Americas.',
    'Tirhisani household food records ku kuma ni ku pulanela hungry gap.',
    'Intercropped plants can still compete; lawulani space, timing na mati.',
  ]);
  assert.deepEqual(draft.keyPoints.map(item => item.reviewStatus), ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft']);
  assert.match(draft.keyPoints[1].xitsongaDraft, /The Three Sisters.*Indigenous farming traditions in the Americas/);
  assert.equal(draft.quiz.length, sourceLesson.quiz.length);
  for (const [index, question] of draft.quiz.entries()) {
    const source = sourceLesson.quiz[index];
    assert.equal(question.question.sourceEnglish, source.q);
    assert.deepEqual(question.options.map(option => option.sourceEnglish), source.options);
    assert.deepEqual(question.options.map(option => option.xitsongaDraft), index === 0
      ? [source.options[0], 'Yi nyika steady harvest, ku nga ri glut leyi landzeleriwaka hi gap.', source.options[2], source.options[3]]
      : source.options,
      'the drafted answer remains at its canonical position and all other option wording is preserved');
    assert.equal(question.sourceCorrectIndex, source.correct);
    assert.equal(question.rationale.sourceEnglish, source.rationale);
    assert.equal(question.rationale.xitsongaDraft, index === 0
      ? 'A single large sowing matures all at once — ku byala hi ku landzelelana swi hangalasa harvest leswaku yi fambisana ni leswi ndyangu wu nga swi tirhisaka hakunene.'
      : source.rationale);
    assert.equal(question.rationale.reviewStatus, index === 0 ? 'machine-draft' : 'hold');
  }
  assert.equal(draft.quiz[0].question.reviewStatus, 'machine-draft');
  assert.match(draft.quiz[0].question.xitsongaDraft, /lettuce.*small batches.*2-3 weeks/);
  assert.match(draft.quiz[0].question.xitsongaDraft, /hinkwayona hi nkarhi wun'we/);
  assert.equal(draft.quiz[0].options[1].reviewStatus, 'machine-draft');
  assert.equal(draft.quiz[0].rationale.reviewStatus, 'machine-draft');
  assert.equal(draft.quiz[1].question.xitsongaDraft, sourceLesson.quiz[1].q);
  assert.equal(draft.quiz[1].question.reviewStatus, 'hold');
  assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), [1, 1]);
  assert.equal(draft.quiz[0].question.sourceEnglish, 'Why sow lettuce in small batches every 2-3 weeks instead of all at once?',
    'the candidate must stay bound to the checked literal instead of following future canonical edits');

  const shown = resolveLearnerLessonPresentation(sourceLesson, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.equal(shown.content.keyPoints[1], draft.keyPoints[1].xitsongaDraft);
  assert.equal(shown.content.keyPoints[2], draft.keyPoints[2].xitsongaDraft,
    'the checked household-records framing appears at its existing key-point position');
  assert.equal(shown.content.quiz[0].q, draft.quiz[0].question.xitsongaDraft);
  assert.equal(shown.content.quiz[0].options[0], sourceLesson.quiz[0].options[0]);
  assert.equal(shown.content.quiz[0].options[1], draft.quiz[0].options[1].xitsongaDraft);
  assert.equal(shown.content.quiz[0].rationale, draft.quiz[0].rationale.xitsongaDraft);
  assert.equal(shown.content.quiz[1].q, sourceLesson.quiz[1].q);
});

test('Vegetables & Staple Crops L2 retains precise crop, timing and sowing conditions', () => {
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const draftParagraphs = XITSONGA_VEGETABLES_STAPLES_L2_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n');
  for (const index of [10, 12, 13, 14, 15, 19]) {
    assert.equal(draftParagraphs[index], sourceParagraphs[index]);
  }
  assert.ok(draftParagraphs[2].includes('two to three weeks'));
  assert.ok(draftParagraphs[7].includes('Then two to three weeks later'));
  assert.ok(draftParagraphs[12].includes('Indigenous farming traditions in the Americas'));
  assert.ok(draftParagraphs[17].includes('Beans fix nitrogen'));
});

test('Vegetables & Staple Crops L2 keeps sowing-risk and harvest uncertainty exact English', () => {
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const localizedParagraphs = XITSONGA_VEGETABLES_STAPLES_L2_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n');
  assert.match(sourceParagraphs[4], /Separate sowings may reduce the risk/);
  assert.match(sourceParagraphs[4], /They do not guarantee a harvest if difficult conditions continue/);
  assert.match(localizedParagraphs[4], /^Separate sowings swi nga hunguta risk/);
  assert.match(localizedParagraphs[4], /They do not guarantee a harvest if difficult conditions continue\.$/);
  assert.match(localizedParagraphs[8], /can begin to overlap/);
  assert.match(localizedParagraphs[8], /will not always be ready by the fourth sowing/);
  assert.match(localizedParagraphs[9], /starting rhythm, a hi nawu/);
  assert.match(localizedParagraphs[9], /may hold longer/);
  assert.match(localizedParagraphs[9], /may speed things up, or cause a failure/);
  assert.match(localizedParagraphs[17], /Beans fix nitrogen with root bacteria/);
  assert.match(localizedParagraphs[17], /do not assume they immediately feed the maize/);
  assert.match(localizedParagraphs[17], /released during decomposition/);
});

test('Vegetables & Staple Crops L2 source drift and undrafted lessons fall back to English', () => {
  const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body}\nChanged.` };
  const changed = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(changed.status, 'english-fallback');
  assert.equal(changed.content.body, changedSource.body);
  const changedKeyPoint: Lesson = { ...sourceLesson, keyPoints: [sourceLesson.keyPoints[0], 'Changed source condition', ...sourceLesson.keyPoints.slice(2)] };
  const changedCandidateKeyPoint: Lesson = { ...sourceLesson, keyPoints: ['Changed sowing instruction', ...sourceLesson.keyPoints.slice(1)] };
  assert.equal(resolveLearnerLessonPresentation(changedCandidateKeyPoint, 'ts').status, 'english-fallback',
    'a changed staggered-sowing instruction invalidates its frozen source pair');
  const changedPointPresentation = resolveLearnerLessonPresentation(changedKeyPoint, 'ts');
  assert.equal(changedPointPresentation.status, 'english-fallback');
  assert.deepEqual(changedPointPresentation.content.keyPoints, changedKeyPoint.keyPoints);
  const changedQuestion: Lesson = { ...sourceLesson, quiz: [{ ...sourceLesson.quiz[0], q: `${sourceLesson.quiz[0].q} Changed.` }, sourceLesson.quiz[1]] };
  const changedQuestionPresentation = resolveLearnerLessonPresentation(changedQuestion, 'ts');
  assert.equal(changedQuestionPresentation.status, 'english-fallback');
  assert.equal(changedQuestionPresentation.content.quiz[0].q, changedQuestion.quiz[0].q);
  const changedOptionValues = [...sourceLesson.quiz[0].options];
  changedOptionValues[1] += ' Changed.';
  const changedCandidateOption: Lesson = { ...sourceLesson, quiz: [{ ...sourceLesson.quiz[0], options: changedOptionValues }, sourceLesson.quiz[1]] };
  assert.equal(resolveLearnerLessonPresentation(changedCandidateOption, 'ts').status, 'english-fallback',
    'a changed answer source cannot leave a stale candidate exposed in a draft quiz');
  const changedRationale: Lesson = { ...sourceLesson, quiz: [{ ...sourceLesson.quiz[0], rationale: `${sourceLesson.quiz[0].rationale} Changed.` }, sourceLesson.quiz[1]] };
  assert.equal(resolveLearnerLessonPresentation(changedRationale, 'ts').status, 'english-fallback',
    'a changed explanation source withdraws the complete lesson draft');

  assert.equal(resolveLearnerLessonPresentation(sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!, 'ts').status,
    'draft', 'L3 is separately source-paired in this combined batch');
  // L1 now has a checked body draft; unregistered lessons and changed sources still fail closed.
  assert.equal(resolveLearnerLessonPresentation(sourceModule.lessons[0], 'ts').status, 'draft');
  // L4 now has independently checked framing; every registered body remains source-bound.
  const fourth = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!;
  assert.equal(resolveLearnerLessonPresentation(fourth, 'ts').status, 'draft');
  const changedFourth = { ...fourth, body: fourth.body + ' Changed safety condition.' };
  assert.equal(resolveLearnerLessonPresentation(changedFourth, 'ts').status, 'english-fallback');
  assert.equal(resolveLearnerLessonPresentation(changedFourth, 'ts').content.body, changedFourth.body);
});
