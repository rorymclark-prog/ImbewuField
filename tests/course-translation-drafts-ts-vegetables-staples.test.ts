import { vegetablesBeforeFuller } from './vegetables-l1-fuller-checks.ts';
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
  "Hi xihi staple lexi ndyangu wa wena wu titshegeke ngopfu hi xona sweswi? That's the one whose failure would hurt most — so that's the one that needs a companion.",
  "Staple yin'wana ni yin'wana yi ku sirhelela eka xilo xo hambana.",
  "Maize yi nyika calories naswona yi hlayiseka loko yi omile. Open-pollinated maize yi tlhela yi ku pfumelela ku hlayisa mbewu ya wena, loko u endla isolation na selection.",
  "Beans na cowpeas swi nyika protein harvest leyi nga hlayisiwa.",
  "Sweet potato yi kuma drought tolerance nyana endzhaku ka loko storage roots ta yona ti vumbekile. Yi lava mati eka mavhiki yo sungula ni loko storage roots ti ha vumbeka; water stress hi nkarhi wolowo yi nga hunguta harvest. Its young leaves are edible too.",
  "Amadumbe yi kota ku tiyisela eka wetter ground, where other staples struggle.",
  "Xiya leswaku swibyariwa leswi swi tsandzeka eka swiyimo swo hambana. Hi yona mhaka ya kona.",
  "Resilience a swi vuli leswaku a ku na lexi tsandzekaka.",
  "Swi vula leswaku ku tsandzeka kun'we a ku herisi kungu ra swakudya ra ndyangu wa wena.",
  "Xibyariwa xin'we i \"point of failure\" yin'we.",
  "Two or more staples swi ku nyika tindlela to tala ta ku ya mahlweni u dya.",
  "Swibyariwa swo hambana swi tirhisa mati, misava na tinguva hi tindlela to hambana. Ku hambana loku hi kona ku va nsirhelelo."
];

test('Vegetables & Staple Crops L3 keeps source-bound framing and crop conditions while leaving technical clauses exact', () => {
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
  assert.match(localizedParagraphs[4], /^Hi xihi staple.*sweswi\? That's the one whose failure would hurt most — so that's the one that needs a companion\.$/,
    'the reliance question is localized while its counterfactual consequence and companion claim stay exact English');
  assert.match(localizedParagraphs[6], /calories.*loko yi omile.*Open-pollinated maize.*loko.*isolation na selection/,
    'seed saving stays conditional on isolation and selection');
  assert.match(localizedParagraphs[7], /Beans na cowpeas.*protein harvest.*nga hlayisiwa/,
    'beans and cowpeas retain the storable protein claim');
  assert.match(localizedParagraphs[8], /drought tolerance.*endzhaku ka loko storage roots.*mavhiki yo sungula.*storage roots.*water stress.*yi nga hunguta harvest.*Its young leaves are edible too\.$/,
    'drought tolerance follows root formation, water timing and possible stress loss remain, and the young-leaves clause stays exact');
  assert.match(localizedParagraphs[9], /^Amadumbe.*wetter ground, where other staples struggle\.$/,
    'Amadumbe retains its wetter-ground comparison without broadening the site claim');
  assert.match(localizedParagraphs[14], /Two or more staples/,
    'the two-or-more staple resilience threshold remains explicit');
  for (const index of [10, 11, 12, 13, 15]) {
    assert.equal(localizedParagraphs[index], checkedL3DraftParagraphs[index],
      `existing Xitsonga paragraph ${index} remains byte-for-byte preserved`);
  }

  assert.equal(draft.title.sourceEnglish, "Staple Crops: Maize, Beans, and Root Vegetables");
  assert.equal(draft.title.xitsongaDraft, "Staple Crops: Maize, Beans, na Root Vegetables");
  assert.equal(draft.title.reviewStatus, 'machine-draft');
  assert.equal(draft.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
  assert.equal(draft.infographicAlt?.xitsongaDraft, sourceLesson.infographicAlt);
  assert.deepEqual(draft.keyPoints.map(item => item.sourceEnglish), sourceLesson.keyPoints);
  assert.deepEqual(draft.keyPoints.map(item => item.xitsongaDraft), sourceLesson.keyPoints);
  assert.ok(draft.keyPoints.every(item => item.reviewStatus === 'hold'));
  assert.equal(draft.quiz.length, sourceLesson.quiz.length);
  for (const [index, question] of draft.quiz.entries()) {
    const source = sourceLesson.quiz[index];
    assert.equal(question.question.sourceEnglish, source.q);
    const expectedQuestion = index === 0
      ? "Hikokwalaho ka yini u hlawula open-pollinated maize ematshan'weni ya hybrid variety loko u kunguhata ku hlayisa mbewu ya wena?"
      : index === 1
        ? "Hikokwalaho ka yini amadumbe (taro) yi ri nhlawulo lowunene wa staple eka swiphemu swa KZN?"
        : source.q;
    assert.equal(question.question.xitsongaDraft, expectedQuestion);
    assert.equal(question.question.reviewStatus, index < 2 ? 'machine-draft' : 'hold');
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
  const expectedShownQuiz = sourceLesson.quiz.map((question, index) => ({
    ...question,
    q: index === 0 ? draft.quiz[0].question.xitsongaDraft : index === 1 ? draft.quiz[1].question.xitsongaDraft : question.q,
  }));
  assert.deepEqual(shown.content.quiz, expectedShownQuiz);
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

test('Vegetables & Staple Crops L3 preserves the one-failure scope and the minimum two-crop safeguard', () => {
  const paragraphs = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n');
  assert.match(paragraphs[11], /Resilience a swi vuli leswaku a ku na lexi tsandzekaka/);
  assert.match(paragraphs[12], /ku tsandzeka kun'we a ku herisi kungu ra swakudya ra ndyangu wa wena/);
  assert.match(paragraphs[13], /point of failure/);
  assert.match(paragraphs[14], /Two or more staples/, 'at least two staples still provide multiple ways to continue eating');
  assert.match(paragraphs[15], /mati, misava na tinguva/);
});

// Historical L1 before-state keeps its original holds; the 5 October fuller batch is verified before reconstruction.
test('Xitsonga bed paragraphs preserve dimensions, access and soil restrictions and withdraw on source drift', () => {
  const source = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!;
  // 5 October: the original holds are historical, while source-bound full current targets are validated before inversion.
  const matches = vegetablesBeforeFuller('ts', XITSONGA_VEGETABLES_STAPLES_DRAFT).lessons.filter(lesson => lesson.id === source.id);
  assert.equal(matches.length, 1);
  const draft = matches[0];
  const paragraphs = draft.body.xitsongaDraft.split('\n\n');
  const english = source.body.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(paragraphs.length, english.length);
  assert.match(paragraphs[2], /^One metre to one point two metres hi ku anama\. Lowu hi wona mpimo lowu tirhaka\. At that width you can reach the centre from either path, and your feet never touch the growing area\.$/,
    'keep both source dimensions, working-width meaning, reach from either path and the no-step growing-area limit');
  assert.match(paragraphs[6], /^No-dig yi lulamela most garden soils\. Tshika soil structure yi ri tano, kutani u aka fertility ehenhla\.$/,
    'no-dig remains suitable for most garden soils and does not disturb the soil structure');
  assert.match(paragraphs[7], /^U nga keli wet clay\. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation\.$/,
    'the wet-clay prohibition and full severe-condition/adviser/before-deeper-cultivation safeguard remain');
  assert.match(paragraphs[8], /^Raised beds ti lulamela wet ground, laha mati ma faneleke ku kuma ndhawu yo huma ma ya kona\.$/,
    'raised-bed advice stays bounded to wet ground and a drainage outlet');
  assert.match(paragraphs[9], /^Sunken beds ti lulamela dry ground, laha u lavaka ku khoma ni ku hlayisa mpfula leyi u yi kumaka\.$/,
    'sunken-bed advice retains the dry-ground condition and source-limited rain-catching purpose');
  assert.match(paragraphs[12], /^Others do better with a protected start in a nursery, then transplanting\. Tomatoes na brassicas swi wela eka ntlawa wolowo\.$/,
    'preserve the nursery-first/transplanting sequence and exact crop names while translating their grouping');
  assert.match(paragraphs[15], /^One point two metres hi ku anama\. Three metres hi ku leha\. I bed yin'we ya ku titoloveta\.$/,
    'retain both dimensions in source order while translating width, length and the one-bed practice framing');
  assert.match(paragraphs[17], /^Kutani lulamisa hi ku ya hi misava ya wena — sungula hi no-dig, kutani u dig deeper ntsena loko misava ya wena hakunene yi swi lava\.$/,
    'no-dig stays first and deeper digging stays conditional on the ground genuinely needing it');
  assert.ok(paragraphs[0].includes('Roots slow down.'));
  assert.ok(paragraphs[1].endsWith('Permanent paths, and a bed narrow enough to reach into from both sides.'));
  assert.ok(paragraphs[11].endsWith("They do better sown straight where they'll grow. Beans, carrots and maize belong in that group."));
  assert.equal(paragraphs[13], 'Landzelela spacing guidance for the crop, variety and local conditions. Kambela leswi tsariweke eka phakiti ni switsundzuxo swa varimi va le ndhawini. Langutela crowding loko swibyariwa swi ri karhi swi kula.', 'translate ordinary packet and local-grower advice while keeping the spacing, crop, variety, conditions and crowding anchor source-bound');
  assert.equal(paragraphs[3], "Sweswi ehleketa hi mabedhe ya wena. Xana u nga swi kota ku fika exikarhini handle ko kandziya endzeni? Famba u ya ringeta leswi u nga si byala swin'wana.", 'the access test explicitly asks whether the grower can reach the middle without stepping inside');
  assert.ok(paragraphs[16].endsWith('Mark the rectangle, and mark both access paths.'));
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.title.xitsongaDraft, 'Ku Lulamisa ni ku Byala Mabedhe ya Wena.');
  assert.equal(draft.title.reviewStatus, 'machine-draft');
  assert.equal(draft.infographicAlt?.xitsongaDraft, source.infographicAlt);
  assert.equal(draft.infographicAlt?.reviewStatus, 'hold');
  assert.deepEqual(draft.keyPoints.map(item => item.sourceEnglish), source.keyPoints);
  const expectedKeyPoints = [...source.keyPoints];
  expectedKeyPoints[1] = 'Assess compaction na drainage u nga si hlawula deeper cultivation; do not work wet clay.';
  assert.deepEqual(draft.keyPoints.map(item => item.xitsongaDraft), expectedKeyPoints);
  assert.deepEqual(draft.keyPoints.map(item => item.reviewStatus), ['hold', 'machine-draft', 'hold', 'hold']);
  assert.equal(draft.quiz.length, source.quiz.length);
  for (const [index, question] of draft.quiz.entries()) {
    const original = source.quiz[index];
    assert.equal(question.question.sourceEnglish, original.q);
    assert.deepEqual(question.options.map(option => option.sourceEnglish), original.options);
    assert.deepEqual(question.sourceCorrectIndex, original.correct);
    assert.equal(question.rationale.sourceEnglish, original.rationale);
    assert.equal(question.rationale.xitsongaDraft, index === 0
      ? 'Ku kandziya growing soil ku endla compaction ni ku onha roots — bed leyi u nga yi fikelelaka ku suka ematlhelweni haswimbirhi yi vula leswaku a wu boheki ku kandziya growing soil.'
      : original.rationale);
    assert.equal(question.rationale.reviewStatus, index === 0 ? 'machine-draft' : 'hold');
    assert.deepEqual(question.options.map(option => option.reviewStatus), index === 0 ? ['machine-draft', 'hold', 'hold', 'machine-draft'] : ['hold', 'hold', 'hold', 'hold'],
      'the checked ordinary distractors are drafted without changing option order or the correct answer');
  }
  assert.equal(draft.quiz[0].question.xitsongaDraft, 'Hikokwalaho ka yini u hlayisa vegetable bed e le 1-1.2m wide ku ri na ku yi endla yi anama ku tlurisa?');
  assert.equal(draft.quiz[0].question.reviewStatus, 'machine-draft');
  assert.equal(draft.quiz[0].options[0].xitsongaDraft, 'Mabedhe lama anameke ma kuma dyambu ro tala ngopfu.');
  assert.equal(draft.quiz[0].options[0].reviewStatus, 'machine-draft');
  assert.equal(draft.quiz[0].options[1].reviewStatus, 'hold');
  assert.equal(draft.quiz[0].options[3].xitsongaDraft, 'I nawu lowu nga cinciki, lowu nga riki na practical reason.');
  assert.equal(draft.quiz[0].rationale.xitsongaDraft, 'Ku kandziya growing soil ku endla compaction ni ku onha roots — bed leyi u nga yi fikelelaka ku suka ematlhelweni haswimbirhi yi vula leswaku a wu boheki ku kandziya growing soil.');
  assert.equal(draft.quiz[1].question.xitsongaDraft, 'Hi xihi xibyariwa lexi faneleke ngopfu ku byariwa hi direct-seeding ku ri na transplanting?');
  assert.equal(draft.quiz[1].question.reviewStatus, 'machine-draft');
  assert.equal(draft.quiz[1].sourceCorrectIndex, 2);
  const current = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons.find(lesson => lesson.id === source.id)!;
  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, current.body.xitsongaDraft);
  assert.equal(shown.content.keyPoints[0], current.keyPoints[0].xitsongaDraft);
  assert.equal(shown.content.quiz[0].q, current.quiz[0].question.xitsongaDraft);
  assert.equal(shown.content.quiz[0].options[0], current.quiz[0].options[0].xitsongaDraft);
  assert.equal(shown.content.quiz[0].options[1], current.quiz[0].options[1].xitsongaDraft);
  assert.equal(shown.content.quiz[0].options[3], current.quiz[0].options[3].xitsongaDraft);
  assert.equal(shown.content.quiz[0].rationale, current.quiz[0].rationale.xitsongaDraft);
  assert.equal(shown.content.quiz[1].q, current.quiz[1].question.xitsongaDraft);
  const changed = { ...source, body: source.body + ' Changed planting condition.' };
  assert.equal(resolveLearnerLessonPresentation(changed, 'ts').status, 'english-fallback');
});


test('Pest framing keeps the diagnostic order and treatment safeguards in the source-bound draft', () => {
  const source = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!;
  const matches = XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons.filter(lesson => lesson.id === source.id);
  assert.equal(matches.length, 1);
  const draft = matches[0];
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const english = source.body.split('\n\n');
  const paragraphs = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(paragraphs.length, 12);
  assert.ok(paragraphs[1].startsWith('Swibyariwa leswi nga na stress. '));
  assert.ok(paragraphs[1].endsWith('One crop dominating the ground. Kumbe broad chemical use leyi se yi suseke predators leti a ti ku pfuna.'),
    'the draft preserves crop dominance and the already-removed-predators cause while localizing the remaining framing');
  assert.ok(paragraphs[3].startsWith('Xana xibyariwa xi pfumala mati? Soil yi compacted kumbe yi “hungry”?'));
  assert.ok(paragraphs[3].includes('predators se ti ku pfuna hi ku tirha eka xiphiqo lexi'),
    'the diagnostic question still asks whether predators are already helping');
  assert.match(paragraphs[4], /^A yellow leaf a swi vuli automatically leswaku ku ni insect\./,
    'the now-localized diagnostic still names a yellow leaf, keeps the negative meaning and automatically qualifier, and does not claim an insect is present');
  assert.ok(paragraphs[4].includes('mati') && paragraphs[4].includes('nutrition') && paragraphs[4].includes('timitsu'));
  assert.ok(paragraphs[4].endsWith('Kuma leswaku i yini u nga si teka goza.'),
    'the grower must identify which cause before acting');
  assert.ok(paragraphs[6].startsWith('Xo sungula. Languta pattern ya ku onhaka, tlhelo ra le hansi ra tluka, tsinde, ni swibyariwa leswi nga ekusuhi.'));
  assert.ok(paragraphs[7].startsWith('Vumbirhi. Kambela stress.') && /timitsu/.test(paragraphs[7]) && /nutrition/.test(paragraphs[7]) && /drainage/.test(paragraphs[7]));
  assert.ok(paragraphs[9].startsWith('Vumune. Hi kona ntsena u tekaka goza —'));
  assert.ok(paragraphs[9].includes('sungula hi the lightest thing that works.'));
  assert.ok(paragraphs[9].includes('Physical removal, barriers kumbe ku cinca crop care swi nga pfuna.'));
  assert.ok(paragraphs[9].endsWith('Kambela leswaku goza ri fambisana ni xiphiqo, kutani u ya mahlweni u kambela vuyelo.'),
    'the step still comes only after diagnosis, begins with the lightest effective option, and checks fit and result');
  assert.notEqual(paragraphs[10], english[10]);
  for (const safeguard of ['registered for that crop and pest', 'label ya yona', 'neem products', 'protection and harvest waiting instructions', 'Do not improvise mixtures or stronger doses']) {
    assert.ok(paragraphs[10].includes(safeguard), `the treatment safeguard remains explicit: ${safeguard}`);
  }
  const changedDiagnosticSource = {
    ...source,
    body: source.body.replace('A yellow leaf is not automatically an insect.', 'A yellow leaf is not always an insect.'),
  };
  assert.notEqual(changedDiagnosticSource.body, source.body);
  assert.equal(resolveLearnerLessonPresentation(changedDiagnosticSource, 'ts').status, 'english-fallback',
    'changing the diagnostic qualifier withdraws this source-bound draft instead of serving a stale translated caution');
  for (const index of [0, 1, 2, 5, 8, 9, 10, 11]) assert.notEqual(paragraphs[index], english[index]);
  assert.equal(paragraphs[5], 'Tirha hi magoza ya mune, hi ku landzelelana.');
  assert.ok(paragraphs[8].includes('Beneficial insects') && paragraphs[8].includes('ntirho'));
  assert.ok(paragraphs[9].startsWith('Vumune. Hi kona ntsena u tekaka goza —'));
  assert.ok(paragraphs[9].includes('sungula hi the lightest thing that works. Physical removal, barriers kumbe ku cinca crop care swi nga pfuna.'), 'the action still comes only after the earlier checks and keeps its qualified method choices');
  assert.ok(paragraphs[9].endsWith('Kambela leswaku goza ri fambisana ni xiphiqo, kutani u ya mahlweni u kambela vuyelo.'), 'the draft retains the problem-fit and outcome-monitoring checks');
  assert.ok(paragraphs[11].startsWith("Tshembeka eka wena n'winyi"));
  assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), source.quiz.map(question => question.correct));
  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.deepEqual(shown.content.quiz.map(q => q.correct), source.quiz.map(q => q.correct));
  assert.deepEqual(shown.content.quiz.map(q => q.q), draft.quiz.map(q => q.question.xitsongaDraft));
  assert.deepEqual(shown.content.quiz[0].options, draft.quiz[0].options.map(option => option.xitsongaDraft));
  assert.deepEqual(shown.content.keyPoints, draft.keyPoints.map(point => point.xitsongaDraft));
});


test('L1/L3 assessment candidates withdraw when their exact English question or answer source changes', () => {
  const l1 = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!;
  const changedL1Quiz: Lesson = { ...l1, quiz: [{ ...l1.quiz[0], rationale: `${l1.quiz[0].rationale} Changed.` }, l1.quiz[1]] };
  assert.equal(resolveLearnerLessonPresentation(changedL1Quiz, 'ts').status, 'english-fallback');
  assert.equal(resolveLearnerLessonPresentation(changedL1Quiz, 'ts').content.quiz[0].rationale, changedL1Quiz.quiz[0].rationale);

  const changedL3Question: Lesson = { ...sourceLesson, quiz: [{ ...sourceLesson.quiz[0], q: `${sourceLesson.quiz[0].q} Changed.` }, sourceLesson.quiz[1]] };
  assert.equal(resolveLearnerLessonPresentation(changedL3Question, 'ts').status, 'english-fallback');
  assert.equal(resolveLearnerLessonPresentation(changedL3Question, 'ts').content.quiz[0].q, changedL3Question.quiz[0].q);
  assert.deepEqual(XITSONGA_VEGETABLES_STAPLES_DRAFT.lessons[0].quiz.map(question => question.sourceCorrectIndex), [1, 1]);
});
