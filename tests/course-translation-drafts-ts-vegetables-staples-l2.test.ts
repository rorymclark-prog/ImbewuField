import { vegetablesBeforeAssessmentOrdinary, vegetablesAssessmentPresentationBeforeOrdinary } from './vegetables-assessment-ordinary-checks.ts';
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
  // 6 October: validate the full later accepted quiz layer before retaining this older bounded-hold scenario.
  const moduleDraft = vegetablesBeforeAssessmentOrdinary('ts', XITSONGA_VEGETABLES_STAPLES_L2_DRAFT);
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
  assert.equal(localizedParagraphs[12], 'The Three Sisters i xifaniso lexi humaka eka Indigenous farming traditions in the Americas.',
    'the example frame is localized while the named system and culturally specific attribution stay exact');
  assert.match(localizedParagraphs[14], /^Beans ti khandziya maize, and store as protein\.$/, 'the climbing action is drafted while the ambiguous protein-storage claim stays exact English');
  assert.ok(localizedParagraphs[1].includes('Hlawula swakudya') && localizedParagraphs[1].includes('xitsongo'));
  assert.equal(localizedParagraphs[2], 'Byala ntila wo koma mavhiki man’wana ni man’wana mambirhi ku ya eka manharhu.',
    'the short row and recurring two-to-three-week interval stay together');
  assert.ok(localizedParagraphs[4].startsWith('Ku byala hi minkarhi leyi hambaneke'));
  assert.ok(localizedParagraphs[4].includes('A swi tiyisisi ntshovelo loko swiyimo swo tika swi ya mahlweni.'), 'the draft keeps the no-guarantee condition tied to continuing difficult conditions');
  assert.ok(localizedParagraphs[5].includes('fast crop') && /small batches|swiphemu leswitsongo/.test(localizedParagraphs[5]));
  assert.ok(localizedParagraphs[7].includes('Endzhaku ka two to three weeks') && localizedParagraphs[7].includes('xa vumune'));
  assert.ok(localizedParagraphs[8].startsWith('Loko nkarhi wa crop wu lulamile, minkarhi ya ntshovelo yi nga sungula ku overlap.'), 'the condition and possibility that harvest timing can overlap remain explicit');
  assert.ok(localizedParagraphs[8].includes('A hi minkarhi hinkwako') && localizedParagraphs[8].endsWith('ku byariwa ka vumune ku endliwa.'), 'the first batch is not promised ready by sowing four');
  assert.ok(localizedParagraphs[9].startsWith('Mavhiki mambirhi ku ya eka manharhu i starting rhythm, a hi nawu.'),
    'the interval is localized and remains a starting rhythm rather than a law; the uncertain term stays in English');
  assert.ok(localizedParagraphs[11].startsWith('Intercropping a hi crowding ntsena ka swibyariwa swo hambana endhawini yin’we.'), 'the definition is localized while retaining exact technical anchors for intercropping and crowding');
  assert.equal(localizedParagraphs[13], 'Maize yi nyika ku leha ni structure.', 'retain Maize and the structural role; do not narrow structure to shape/form');
  assert.equal(localizedParagraphs[21], 'Ti tsale ehansi. Kutani hlawula xibyariwa ni siku ro byala leri nga tisa swakudya eka nkarhi wolowo.', 'preserve the crop choice, sowing date and purpose of filling the previously named food gap');
  assert.ok(localizedParagraphs[16].startsWith('Nkarhi wu ni nkoka.'));
  assert.ok(localizedParagraphs[17].startsWith('Swibyariwa swi nga ha phikizana. Nyika swibyariwa ndhawu leyi faneleke, mati ni ku vonakala.'), 'the draft keeps suitable space, water and light together before the unchanged nitrogen/residue conditions');
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
    'Swibyariwa leswi byariwe swin’we swi nga ha phikizana; lawulani ndhawu, nkarhi na mati.',
  ]);
  assert.deepEqual(draft.keyPoints.map(item => item.reviewStatus), ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft']);
  assert.match(draft.keyPoints[1].xitsongaDraft, /The Three Sisters.*Indigenous farming traditions in the Americas/);
  assert.equal(draft.quiz.length, sourceLesson.quiz.length);
  for (const [index, question] of draft.quiz.entries()) {
    const source = sourceLesson.quiz[index];
    assert.equal(question.question.sourceEnglish, source.q);
    assert.deepEqual(question.options.map(option => option.sourceEnglish), source.options);
    assert.deepEqual(question.options.map(option => option.xitsongaDraft), index === 0
      ? ['Yi tirhisa less seed hi ku angarhela.', 'Yi nyika ntshovelo leyi tshamaka yi ri kona hi ku landzelelana, ku nga ri ntshovelo wo tala ngopfu kutani ku landzela nkarhi wa ku pfumaleka.', 'Lettuce yi mila better hi swiphemu leswitsongo.', 'Yi hunguta pest pressure.']
      : [source.options[0], source.options[1], 'Only loko matluka ya pumpkin ma endla ndzhuti eka them.', 'Yi nga never be released.'],
      'the checked L2 options remain aligned to their canonical positions, including translated framing around held technical wording');
    assert.equal(question.sourceCorrectIndex, source.correct);
    assert.equal(question.rationale.sourceEnglish, source.rationale);
    assert.equal(question.rationale.xitsongaDraft, index === 0
      ? 'Ku byala lokukulu kan’we ku endla leswaku swimilani swi vupfa hi nkarhi wun’we — ku byala hi ku hambanisa minkarhi swi hangalasa ntshovelo leswaku wu fambisana ni leswi ndyangu wu nga swi tirhisaka hakunene.'
      : source.rationale);
    assert.equal(question.rationale.reviewStatus, index === 0 ? 'machine-draft' : 'hold');
  }
  assert.equal(draft.quiz[0].question.reviewStatus, 'machine-draft');
  assert.equal(draft.quiz[0].question.xitsongaDraft,
    'Hikokwalaho ka yini u byala lettuce hi swiphemu leswitsongo mavhiki man’wana ni man’wana mambirhi ku ya eka manharhu, ematshan’weni yo yi byala hinkwayona hi nkarhi wun’we?');
  assert.match(draft.quiz[0].question.xitsongaDraft, /hinkwayona hi nkarhi/);
  assert.deepEqual(draft.quiz[0].options.map(option => option.reviewStatus), ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft']);
  assert.equal(draft.quiz[0].rationale.reviewStatus, 'machine-draft');
  assert.equal(draft.quiz[1].question.xitsongaDraft, sourceLesson.quiz[1].q);
  assert.equal(draft.quiz[1].question.reviewStatus, 'hold');
  assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), [1, 1]);
  assert.equal(draft.quiz[0].question.sourceEnglish, 'Why sow lettuce in small batches every 2-3 weeks instead of all at once?',
    'the candidate must stay bound to the checked literal instead of following future canonical edits');

  const shown = vegetablesAssessmentPresentationBeforeOrdinary(sourceLesson, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.equal(shown.content.keyPoints[1], draft.keyPoints[1].xitsongaDraft);
  assert.equal(shown.content.keyPoints[2], draft.keyPoints[2].xitsongaDraft,
    'the checked household-records framing appears at its existing key-point position');
  assert.equal(shown.content.quiz[0].q, draft.quiz[0].question.xitsongaDraft);
  assert.equal(shown.content.quiz[0].options[0], 'Yi tirhisa less seed hi ku angarhela.');
  assert.equal(shown.content.quiz[0].options[1], draft.quiz[0].options[1].xitsongaDraft);
  assert.equal(shown.content.quiz[0].rationale, draft.quiz[0].rationale.xitsongaDraft);
  assert.equal(shown.content.quiz[1].q, sourceLesson.quiz[1].q);
});

test('Vegetables L2 drafts garden observation and seasonal possibilities while holding cultural and crop-specific claims', () => {
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const draftParagraphs = XITSONGA_VEGETABLES_STAPLES_L2_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length,
    'the learner paragraph order and count must stay aligned to the English source');
  assert.equal(draftParagraphs[12], 'The Three Sisters i xifaniso lexi humaka eka Indigenous farming traditions in the Americas.',
    'the Three Sisters example frame is localized around the exact cultural attribution');
  assert.match(draftParagraphs[14], /^Beans ti khandziya maize, and store as protein\.$/, 'only the ambiguous protein-storage clause stays English; the climbing action is localized');
  assert.ok(draftParagraphs[10].startsWith("Languta leswi humelelaka ensin'wini ya wena, u lulamisa interval."));
  assert.ok(draftParagraphs[10].endsWith('Ku xiyisisa leswi hi swona vutshila.'),
    'the observation skill is still explicit after translating the instruction');
  assert.ok(draftParagraphs[15].startsWith('Pumpkin yi hangalaka'));
  assert.ok(draftParagraphs[15].includes('misava') && draftParagraphs[15].includes('ndzhuti') && draftParagraphs[15].includes('hlayisa moisture'),
    'the draft keeps the soil-shading and moisture-holding effects without adding a soil-moisture location claim');
  assert.ok(draftParagraphs[19].startsWith('Hungry gap ya wena yi nga fika endzhaku ka loko maize leyi hlayisiweke yi herile.'));
  assert.ok(draftParagraphs[19].includes('winter greens ti nga si lulama'));
  assert.ok(draftParagraphs[19].endsWith('Yi nga fika hi nkarhi wo oma loko mati ma hunguta leswi xirhapa xi nga swi humesaka.'),
    'all three possible gap timings and the water-limiting condition remain present');
  assert.match(draftParagraphs[2], /mavhiki man’wana ni man’wana mambirhi ku ya eka manharhu/);
  assert.ok(draftParagraphs[7].includes('Endzhaku ka two to three weeks'));
  assert.ok(draftParagraphs[12].includes('Indigenous farming traditions in the Americas'));
  assert.ok(draftParagraphs[17].includes('Beans fix nitrogen'));
  assert.match(draftParagraphs[14], /and store as protein/);
});

test('Vegetables & Staple Crops L2 keeps sowing-risk and harvest uncertainty source-paired', () => {
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const localizedParagraphs = XITSONGA_VEGETABLES_STAPLES_L2_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n');
  assert.match(sourceParagraphs[4], /Separate sowings may reduce the risk/);
  assert.match(sourceParagraphs[4], /They do not guarantee a harvest if difficult conditions continue/);
  assert.match(localizedParagraphs[4], /^Ku byala hi minkarhi leyi hambaneke/);
  assert.match(localizedParagraphs[4], /A swi tiyisisi ntshovelo loko swiyimo swo tika swi ya mahlweni\.$/, 'the no-guarantee and continuing-difficult-conditions qualification remain together in the localized paragraph');
  assert.match(localizedParagraphs[8], /yi nga sungula ku overlap/);
  assert.match(localizedParagraphs[8], /A hi minkarhi hinkwako/);
  assert.match(localizedParagraphs[8], /ku byariwa ka vumune/);
  assert.match(localizedParagraphs[9], /i starting rhythm, a hi nawu/);
  assert.match(localizedParagraphs[9], /may hold longer/);
  assert.match(localizedParagraphs[9], /Ku hisa ku nga endla leswaku swilo swi hatlisa kumbe swi tsandzeka/);
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
