import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import type { Lesson } from '../lib/course-modules.ts';
import { XITSONGA_WATER_HARVESTING_DRAFT as draft } from '../lib/course-translation-drafts-ts-water-harvesting.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';
import { XITSONGA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ts-food-forest.ts';
import type { XitsongaCourseModuleDraft, XitsongaSourcePair } from '../lib/course-translation-drafts-ts.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { checkCompleteLessonDraft } from './regional-full-draft-checks.ts';

const source = COURSE_MODULES.find(module => module.id === 'water-harvesting')!;
const digits = (value: string) => value.match(/\d+/g) ?? [];

// Rewritten 2 October 2026 (Food Forest batch; the Water tests in this file are unchanged): Food Forest
// L1 is now a complete Xitsonga draft, so the pins on three paragraphs held in English give way to a
// complete-lesson check. Species caution and care are translated; every species name stays exact.
test('Food Forest Xitsonga L1 draft translates species caution and crop care with species names exact', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(sourceModule);
  const sourceLesson = sourceModule.lessons[0];
  const draftLesson = XITSONGA_FOOD_FOREST_DRAFT.lessons[0];
  checkCompleteLessonDraft(sourceLesson, draftLesson, 'ts');
  const paragraphs = draftLesson.body.xitsongaDraft.split('\n\n');
  for (const name of ['Highveld', 'Wild Fig', 'pecan', 'lemon', 'naartjie', 'black mulberry']) {
    assert.ok(paragraphs[7].includes(name), `the Highveld example keeps ${name}`);
  }
  for (const name of ['Cape gooseberry', 'Wild Medlar', 'wild garlic', 'sweet potato', 'granadilla']) {
    assert.ok(paragraphs[8].includes(name), `the lower-layer example keeps ${name}`);
  }
  assert.ok(paragraphs[9].includes('frost tolerance'), 'check identity, frost tolerance, mature size and local restrictions first');
});

test('Xitsonga Market drafts pair bounded sales text and keep uncertain decisions and quizzes in English', () => {
  const market = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(market);
  assert.deepEqual(XITSONGA_MARKET_COMMUNITY_DRAFT.lessons.map(lesson => lesson.id),
    ['market-community-l1', 'market-community-l2', 'market-community-l3']);

  for (const draftLesson of XITSONGA_MARKET_COMMUNITY_DRAFT.lessons) {
    const sourceLesson: Lesson | undefined = market.lessons.find(lesson => lesson.id === draftLesson.id);
    assert.ok(sourceLesson);
    assert.equal(draftLesson.title.sourceEnglish, sourceLesson.title);
    assert.equal(draftLesson.body.sourceEnglish, sourceLesson.body);
    assert.equal(draftLesson.body.reviewStatus, 'machine-draft');
    assert.equal(draftLesson.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
    assert.deepEqual(draftLesson.keyPoints.map(point => point.sourceEnglish), sourceLesson.keyPoints);
    if (draftLesson.id === 'market-community-l1') {
      assert.deepEqual(draftLesson.keyPoints.map(point => point.xitsongaDraft), [
        'Tsala nhlayo ya ntshovelo ni laha wu yeke kona hi ku hambana ni mali',
        sourceLesson.keyPoints[1], sourceLesson.keyPoints[2], sourceLesson.keyPoints[3],
      ]);
      assert.equal(draftLesson.keyPoints[0].reviewStatus, 'machine-draft');
      assert.deepEqual(draftLesson.keyPoints.slice(1).map(point => point.reviewStatus), ['hold', 'hold', 'hold']);
    } else if (draftLesson.id === 'market-community-l2') {
      assert.deepEqual(draftLesson.keyPoints.map(point => point.reviewStatus), ['machine-draft', 'machine-draft', 'hold', 'hold']);
      assert.deepEqual(draftLesson.keyPoints.slice(2).map(point => point.xitsongaDraft), sourceLesson.keyPoints.slice(2),
        'regular-supply and compliance key points keep their prior exact-English holds');
      assert.ok(draftLesson.keyPoints[0].xitsongaDraft.includes('product') && draftLesson.keyPoints[0].xitsongaDraft.includes('nhlayo'),
        'the agreed product category and quantity remain explicit');
      assert.ok(draftLesson.keyPoints[1].xitsongaDraft.includes('costs') && draftLesson.keyPoints[1].xitsongaDraft.includes('selling price'),
        'the costs, losses and selling-price comparison remains present');
    } else if (draftLesson.id !== 'market-community-l3') {
      assert.deepEqual(draftLesson.keyPoints.map(point => point.xitsongaDraft), sourceLesson.keyPoints);
    }
    assert.deepEqual(draftLesson.quiz.map(question => question.sourceCorrectIndex), sourceLesson.quiz.map(question => question.correct));
    const shown = resolveLearnerLessonPresentation(sourceLesson, 'ts');
    assert.equal(shown.status, 'draft');
    // Study renders each paired draft while exact-English holds keep their source wording.
    assert.deepEqual(shown.content.quiz, ['market-community-l1', 'market-community-l3'].includes(draftLesson.id) ? sourceLesson.quiz.map((question, index) => ({
      q: draftLesson.quiz[index].question.xitsongaDraft,
      options: draftLesson.quiz[index].options.map(pair => pair.xitsongaDraft),
      correct: question.correct,
      rationale: draftLesson.quiz[index].rationale.xitsongaDraft,
    })) : sourceLesson.quiz);
    assert.deepEqual(shown.content.keyPoints, draftLesson.keyPoints.map(pair => pair.xitsongaDraft));
    const sourceParagraphs: string[] = sourceLesson.body.split('\n\n');
    const draftParagraphs: string[] = shown.content.body.split('\n\n');
    assert.equal(draftParagraphs.length, sourceParagraphs.length);
    // Reviewed Market L1 destinations/months/price framing join the prior drafts; technical holds stay exact.
    const translatedIndices = draftLesson.id === 'market-community-l1' ? [0, 1, 2, 3, 4, 5, 6, 7, 10, 13, 14]
      : draftLesson.id === 'market-community-l2' ? [0, 1, 2, 3, 5, 6, 7, 8, 10, 11] : [0, 3, 4, 5, 7, 8, 9, 10];
    for (const [index, paragraph] of sourceParagraphs.entries()) {
      if (translatedIndices.includes(index)) assert.notEqual(draftParagraphs[index], paragraph);
      else assert.equal(draftParagraphs[index], paragraph);
    }
    if (draftLesson.id === 'market-community-l2') {
      assert.equal(draftLesson.body.sourceEnglish, sourceLesson.body);
      assert.equal(draftLesson.body.reviewStatus, 'machine-draft');
      assert.equal(draftParagraphs[0], 'Vutisa leswaku muxavi u lava yini: product, nhlayo, quality, delivery na siku ra ku hakela.',
        'the existing localized customer-needs paragraph is preserved byte-for-byte');
      for (const index of [4, 9]) assert.equal(draftParagraphs[index], sourceParagraphs[index],
        `unresolved commercial commitment paragraph ${index} remains exact English`);
      assert.ok(draftParagraphs[10].startsWith('Offer surplus leyi u nga na yona'),
        'the surplus offer and customer-agreement framing is now drafted');
      assert.ok(draftParagraphs[1].startsWith('Pimanisa '));
      assert.ok(draftParagraphs[1].includes('market fees, transport, packing and unsold produce'));
      assert.ok(draftParagraphs[1].includes('selling price'));
      assert.ok(draftParagraphs[2].startsWith('Kambisisa market rules'));
      assert.ok(draftParagraphs[2].includes('An informal stall does not automatically have no rules or costs.'));
      assert.ok(draftParagraphs[3].includes('can retain more of the sale price'));
      assert.ok(draftParagraphs[3].startsWith('Direct selling can retain more of the sale price, kambe swi tlhela swi teka nkarhi,'),
        'the bounded price claim and ordinary time/customer-care conditions stay together');
      assert.ok(draftParagraphs[5].startsWith('Pfumelelanani hi contents, price, payment and what happens when crops are short.'));
      assert.ok(draftParagraphs[5].endsWith('Regular orders help planning only when customers and growers can keep the agreement.'),
        'regular orders remain conditional on both sides keeping the agreement');
      assert.ok(draftParagraphs[6].startsWith('Sungula hi '));
      assert.ok(draftParagraphs[6].includes('what you can reliably supply') && draftParagraphs[6].includes('na leswi vaxavi va swi lavaka'),
        'the exact reliable-supply condition stays English while ordinary customer framing is drafted');
      assert.ok(draftParagraphs[7].startsWith('Kambisisa costs'));
      assert.ok(draftParagraphs[7].includes('before promising regular boxes'));
      assert.ok(draftParagraphs[8].startsWith('Garden area or customer count alone does not predict income.'));
      assert.ok(draftParagraphs[8].includes('Ringeta ndlela leyi u nga kotaka ku yi lawula'));
      assert.ok(draftParagraphs[8].includes(' kutani u tsala results'),
        'ordinary manageable-trial framing and recording results are localized');
      assert.ok(draftParagraphs[11].startsWith('Hlamusela maendlelo ya wena ya ku byala hi vutshembeki.'));
      assert.ok(draftParagraphs[11].endsWith('Check any certification or claim the buyer requires before using a label.'));
      const changedBody = { ...sourceLesson, body: `${sourceLesson.body} Changed commercial condition.` };
      const changedPresentation = resolveLearnerLessonPresentation(changedBody, 'ts');
      assert.equal(changedPresentation.status, 'english-fallback');
      assert.equal(changedPresentation.content.body, changedBody.body);
    }
    if (draftLesson.id === 'market-community-l1') {
      const draftParagraphsSource = draftLesson.body.xitsongaDraft.split('\n\n');
      assert.equal(draftParagraphs[0], draftParagraphsSource[0],
        'select the Xitsonga source-paired learner draft');
      assert.equal(draftParagraphs[3], draftParagraphsSource[3],
        'select the source-paired sentence about recording each harvest as it happens');
      assert.equal(draftParagraphs[6], draftParagraphsSource[6],
        'select the source-paired end-of-season memory reminder');
      assert.equal(draftParagraphs[1], 'Ku tsala tindlela leti ntshovelo wu tirhisiwaka ha tona swi ku pfuna ku vona leswi purasi ri swi humesaka ni leswi fikelelaka vaxavi.',
        'the distinct harvest uses remain visible beside the exact English source');
      assert.equal(draftParagraphs[7], 'Matsalwa ya nguva yin’we ma nga hlamula swivutiso leswi pfunaka.',
        'the season-of-records concept is screened while crop and price decisions stay in English');
      assert.equal(draftParagraphs[2], 'Tirhisa vuxokoxoko byole ku sirhelela swakudya swa ndyangu ni ku endla swiboho swa bindzu swo antswa.');
      assert.equal(draftParagraphs[4], 'Tsala kilograms ta matamatisi, dozens ta matandza ni bundles ta morogo, kutani u tsala laha xin\'wana ni xin\'wana xi yeke kona.',
        'unit labels and produce names stay exact while the recording action is drafted');
      assert.equal(draftParagraphs[14], 'Tirhisa rekhodo ya wena ku kuma leswaku swakudya swa ndyangu swi kayivela rini.');
      // Checked ordinary destinations/months/price framing replaces its holds; decision safeguards remain exact.
      for (const index of [8, 9, 11, 12, 15, 16]) assert.equal(draftParagraphs[index], sourceParagraphs[index],
        'crop comparisons, cost categories, numerical example and planting timing remain exact English');
      for (const index of [5, 10, 13]) assert.notEqual(draftParagraphs[index], sourceParagraphs[index]);
      assert.ok(draftParagraphs[5].startsWith('Use the same simple habit'));
      assert.ok(draftParagraphs[13].includes('a higher asking price is not a guaranteed sale.'));
      assert.deepEqual(draftLesson.quiz.map(question => question.sourceCorrectIndex), [2, 1],
        'both quiz answer keys remain in canonical order');
      const priceQuestion = draftLesson.quiz[0];
      assert.equal(priceQuestion.question.reviewStatus, 'hold');
      assert.equal(priceQuestion.question.xitsongaDraft, sourceLesson.quiz[0].q);
      assert.equal(priceQuestion.rationale.xitsongaDraft, sourceLesson.quiz[0].rationale);
      assert.deepEqual(priceQuestion.options.map(option => [option.xitsongaDraft, option.reviewStatus]),
        sourceLesson.quiz[0].options.map(option => [option, 'hold']),
        'the full R15 sale/R18 cost quiz remains exact English');

      const gapQuestion = draftLesson.quiz[1];
      const gapSource = sourceLesson.quiz[1];
      assert.equal(gapQuestion.sourceCorrectIndex, 1);
      assert.deepEqual(gapQuestion.options.map(option => option.sourceEnglish), gapSource.options,
        'translated choices preserve the original option order');
      assert.ok(gapQuestion.question.xitsongaDraft.startsWith("A farmer's records show she's short of vegetables every June and July."),
        'the recurring June/July shortage wording stays exact');
      assert.ok(gapQuestion.options[1].xitsongaDraft.includes('swibyariwa leswi lulameleke ndhawu ya wena') &&
        gapQuestion.options[1].xitsongaDraft.includes('nkarhi wa swona wa ntshovelo'),
        'the keyed action retains locally suitable crops and harvest timing');
      assert.ok(gapQuestion.rationale.xitsongaDraft.startsWith('Records identify the gap.') &&
        gapQuestion.rationale.xitsongaDraft.includes('local climate') &&
        gapQuestion.rationale.xitsongaDraft.includes('mati') &&
        gapQuestion.rationale.xitsongaDraft.includes('nkarhi lowu languteriweke wa ntshovelo'),
        'the rationale retains local climate, water and expected harvest-time conditions');
      assert.equal(gapQuestion.options[3].xitsongaDraft, gapSource.options[3]);
      assert.equal(gapQuestion.options[3].reviewStatus, 'hold', 'the soil-fertility distractor stays exact English');

      const changedQuestion = { ...sourceLesson, quiz: sourceLesson.quiz.map((question, index) => index === 1
        ? { ...question, q: `${question.q} Changed timing.` }
        : question) };
      const changedPresentation = resolveLearnerLessonPresentation(changedQuestion, 'ts');
      assert.equal(changedPresentation.status, 'english-fallback', 'changed assessment source withdraws its paired draft');
      assert.deepEqual(changedPresentation.content.quiz, changedQuestion.quiz);
    }
    if (draftLesson.id === 'market-community-l2') {
      assert.deepEqual(draftLesson.quiz.map(question => question.sourceCorrectIndex), [2, 2]);
      for (const question of draftLesson.quiz) {
        assert.equal(question.question.reviewStatus, 'hold');
        assert.equal(question.question.xitsongaDraft, question.question.sourceEnglish);
        assert.equal(question.rationale.reviewStatus, 'hold');
        assert.equal(question.rationale.xitsongaDraft, question.rationale.sourceEnglish);
        assert.ok(question.options.every(option => option.reviewStatus === 'hold' && option.xitsongaDraft === option.sourceEnglish),
          'both L2 quizzes retain exact-English stems, options and rationales');
      }
    }
    const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body} Changed.` };
    assert.equal(resolveLearnerLessonPresentation(changedSource, 'ts').status, 'english-fallback');
  }
});

test('Water L1-L4 show source-paired Xitsonga drafts with exact-source English holds', () => {
  const module = resolveCourseModulePresentation(source, 'ts');
  assert.equal(module.status, 'draft');
  assert.equal(module.title, 'Ku hlengeleta Mati');
  assert.equal(module.description, source.description);

  const first = resolveLearnerLessonPresentation(source.lessons[0], 'ts');
  assert.equal(first.status, 'draft');
  assert.notEqual(first.content.title, source.lessons[0].title);
  assert.notEqual(first.content.body, source.lessons[0].body);
  assert.deepEqual(first.content.quiz, source.lessons[0].quiz);

  for (const lesson of source.lessons.slice(1)) {
    const unreleased = resolveLearnerLessonPresentation(lesson, 'ts');
    if (lesson.id === 'water-harvesting-l2') {
      assert.equal(unreleased.status, 'draft');
      assert.equal(unreleased.content.body,
        draft.lessons.find(item => item.id === lesson.id)?.body.xitsongaDraft);
    } else if (lesson.id === 'water-harvesting-l3' || lesson.id === 'water-harvesting-l4') {
      assert.equal(unreleased.status, 'draft');
      assert.equal(unreleased.content.body,
        draft.lessons.find(item => item.id === lesson.id)?.body.xitsongaDraft);
    } else {
      assert.equal(unreleased.status, 'english-fallback');
      assert.equal(unreleased.content.body, lesson.body);
    }
  }
});

function pairForHold(hold: XitsongaCourseModuleDraft['holds'][number]): XitsongaSourcePair | undefined {
  if (hold.lessonId === 'module') {
    if (hold.field === 'title') return draft.title;
    if (hold.field === 'description') return draft.description;
    return undefined;
  }

  const lesson = draft.lessons.find(item => item.id === hold.lessonId);
  if (!lesson) return undefined;
  if (hold.field === 'title') return lesson.title;
  if (hold.field === 'infographicAlt') return lesson.infographicAlt;
  const body = hold.field.match(/^body(?:\[(\d+)\])?$/);
  if (body) return lesson.body;
  const point = hold.field.match(/^keyPoints\[(\d+)\]$/);
  if (point) return lesson.keyPoints[Number(point[1])];
  const quiz = hold.field.match(/^quiz\[(\d+)\]\.(question|rationale|options\[(\d+)\])$/);
  if (!quiz) return undefined;
  const item = lesson.quiz[Number(quiz[1])];
  if (quiz[2] === 'question') return item?.question;
  if (quiz[2] === 'rationale') return item?.rationale;
  return item?.options[Number(quiz[3])];
}

test('Water Harvesting Xitsonga data retains all canonical sources, lesson shape and quiz indexes', () => {
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.language, 'ts');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.description.sourceEnglish, source.description);
  assert.equal(draft.lessons.length, source.lessons.length);

  for (const [index, lesson] of draft.lessons.entries()) {
    const original = source.lessons[index];
    assert.ok(original);
    assert.equal(lesson.id, original.id);
    assert.equal(lesson.title.sourceEnglish, original.title);
    assert.equal(lesson.infographicAlt?.sourceEnglish, original.infographicAlt);
    assert.equal(lesson.body.sourceEnglish, original.body);
    assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), original.keyPoints);
    assert.equal(lesson.quiz.length, original.quiz.length);

    const pairs = [lesson.title, ...(lesson.infographicAlt ? [lesson.infographicAlt] : []), lesson.body,
      ...lesson.keyPoints, ...lesson.quiz.flatMap(item => [item.question, ...item.options, item.rationale])];
    for (const pair of pairs) {
      assert.deepEqual(digits(pair.xitsongaDraft), digits(pair.sourceEnglish), `${lesson.id} figures changed`);
    }

    for (const [quizIndex, item] of lesson.quiz.entries()) {
      const sourceItem = original.quiz[quizIndex];
      assert.equal(item.question.sourceEnglish, sourceItem.q);
      assert.deepEqual(item.options.map(option => option.sourceEnglish), sourceItem.options);
      assert.equal(item.rationale.sourceEnglish, sourceItem.rationale);
      assert.equal(item.sourceCorrectIndex, sourceItem.correct, `${lesson.id} quiz ${quizIndex} answer index changed`);
    }
  }
});

test('Water Harvesting held wording remains exact where dam, water-law and reuse claims need local review', () => {
  assert.ok(draft.holds.length > 0);
  for (const hold of draft.holds) {
    const pair = pairForHold(hold);
    assert.ok(pair, `${hold.lessonId} ${hold.field} must resolve to a source pair`);
    const heldBodyParagraph = hold.field.match(/^body\[(\d+)\]$/);
    if (heldBodyParagraph) {
      const paragraphs = pair.xitsongaDraft.split('\n\n');
      assert.equal(paragraphs[Number(heldBodyParagraph[1])], hold.sourceText, `${hold.field} must remain an exact paragraph hold`);
      if (hold.lessonId === 'water-harvesting-l2') {
        assert.equal(pair.reviewStatus, 'machine-draft', `${hold.field}: a retained paragraph must not hold the translated body`);
      } else {
        assert.ok(['hold', 'machine-draft'].includes(pair.reviewStatus), `${hold.field}: hold metadata must remain explicit`);
      }
    } else if (hold.field === 'body') {
      assert.equal(pair.xitsongaDraft, hold.sourceText, `${hold.field} must remain exact English`);
      assert.equal(pair.reviewStatus, 'hold');
    } else {
      assert.equal(pair.xitsongaDraft, hold.sourceText, `${hold.field} must remain exact English`);
      assert.equal(pair.reviewStatus, 'hold');
    }
    assert.ok(hold.reason.length > 0);
  }

  const exactHolds = draft.holds.map(hold => hold.sourceText);
  assert.ok(exactHolds.some(held => held.includes('Keep the spillway clear and maintain the bank cover specified in the design. Do not plant trees')),
    'retain the high-consequence earth-dam restriction as exact English');
});

test('Water L2 Xitsonga exposes the checked heading and assessment draft while retaining marked technical holds', () => {
  const canonical = source.lessons.find(lesson => lesson.id === 'water-harvesting-l2')!;
  const paired = draft.lessons.find(lesson => lesson.id === canonical.id)!;
  assert.equal(paired.title.reviewStatus, 'machine-draft');
  assert.notEqual(paired.title.xitsongaDraft, canonical.title);
  const holdFields = draft.holds.filter(hold => hold.lessonId === canonical.id);
  for (const hold of holdFields) {
    const pair = pairForHold(hold)!;
    const heldBodyParagraph = hold.field.match(/^body\[(\d+)\]$/);
    if (heldBodyParagraph) {
      assert.equal(pair.xitsongaDraft.split('\n\n')[Number(heldBodyParagraph[1])], hold.sourceText);
      assert.equal(pair.reviewStatus, 'machine-draft');
    } else {
      assert.equal(pair.reviewStatus, 'hold');
      assert.equal(pair.xitsongaDraft, pair.sourceEnglish);
    }
  }
  assert.deepEqual(paired.quiz.map(item => item.sourceCorrectIndex), [1, 1]);
  assert.equal(paired.keyPoints[0].reviewStatus, 'machine-draft');
  assert.equal(paired.keyPoints[2].reviewStatus, 'machine-draft');
  assert.equal(paired.keyPoints[3].reviewStatus, 'machine-draft');
  assert.equal(paired.quiz[0].question.reviewStatus, 'machine-draft');
  assert.equal(paired.quiz[1].question.reviewStatus, 'machine-draft');
  assert.equal(paired.quiz[1].options[1].reviewStatus, 'machine-draft');
  assert.equal(paired.quiz[1].rationale.reviewStatus, 'machine-draft');

  const shown = resolveLearnerLessonPresentation(canonical, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.title, paired.title.xitsongaDraft);
  assert.equal(shown.content.infographicAlt, canonical.infographicAlt);
  assert.deepEqual(shown.content.keyPoints, paired.keyPoints.map(point => point.xitsongaDraft));
  assert.deepEqual(shown.content.quiz.map(question => question.correct), [1, 1]);
  assert.equal(shown.content.body, paired.body.xitsongaDraft,
    'the exact-source body draft remains paired with its canonical English source');

  const changedKeyPoint = { ...canonical, keyPoints: canonical.keyPoints.map((point, index) =>
    index === 0 ? `${point} changed` : point) };
  const fallback = resolveLearnerLessonPresentation(changedKeyPoint, 'ts');
  assert.equal(fallback.status, 'english-fallback');
  assert.deepEqual(fallback.content.keyPoints, changedKeyPoint.keyPoints,
    'a changed key-point source withdraws the whole source-paired lesson');
});

test('Water L3 Xitsonga keeps roof losses, first-flush limits and water-safety clauses source-bound', () => {
  const canonical = source.lessons.find(lesson => lesson.id === 'water-harvesting-l3')!;
  const paired = draft.lessons.find(lesson => lesson.id === canonical.id)!;
  const sourceParagraphs = canonical.body.split('\n\n');
  const paragraphs = paired.body.xitsongaDraft.split('\n\n');
  assert.equal(paragraphs.length, 13);
  assert.deepEqual(paired.quiz.map(item => item.sourceCorrectIndex), [1, 1]);
  assert.deepEqual(paired.keyPoints.map(point => point.sourceEnglish), canonical.keyPoints);
  assert.equal(paragraphs[0], 'Lwangu ra wena ri nga hlengeleta mati ya mpfula. Ntsengo wu titshege hi vukulu bya lwangu, mpfula na ku lahleka ka mati.');
  assert.ok(paragraphs[2].includes('Then allow for water that misses the gutter, is diverted or overflows a full tank.'));
  assert.ok(paragraphs[3].startsWith('An annual total does not tell you how much water will be available during a dry spell.'));
  assert.ok(paragraphs[4].includes('some of the first runoff'));
  assert.equal(paragraphs[5], sourceParagraphs[5]);
  assert.ok(paragraphs[6].includes('Diverter a yi endli leswaku mati lawa ma saleke ma hlayiseka ku nwa.'));
  assert.ok(paragraphs[10].toLowerCase().includes('screen openings against insects'));
  assert.ok(paragraphs[10].includes('Keep rainwater separate from drinking-water pipes.'));
  assert.ok(paragraphs[11].startsWith('Water that looks clear may still contain germs or chemicals.'));
  assert.ok(paragraphs[12].includes('Basic filter ntsena a yi tiyisisi') &&
    paragraphs[12].includes('food crops') && paragraphs[12].includes('safety assessment'),
  'retain filter no-guarantee and food-crop safety assessment');
  const irrigationQuiz = paired.quiz[1];
  assert.equal(irrigationQuiz.sourceCorrectIndex, 1);
  assert.ok(irrigationQuiz.options[1].xitsongaDraft.includes('leti nga contaminate edible crops'),
    'retain the can-contaminate modality and edible-crop exposure');
  assert.ok(irrigationQuiz.rationale.xitsongaDraft.includes('swi nga hunguta contamination') &&
    irrigationQuiz.rationale.xitsongaDraft.includes('a swi tiyisisi') &&
    irrigationQuiz.rationale.xitsongaDraft.includes('intended use'),
  'first-flush guidance reduces contamination but does not certify later water');
  const changed = { ...canonical, body: canonical.body.replace('some of the first runoff', 'all of the first runoff') };
  assert.notEqual(changed.body, canonical.body);
  const fallback = resolveLearnerLessonPresentation(changed, 'ts');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changed.body);
});

test('Water L1 Xitsonga keeps infiltration possible and requires assessment for all listed land conditions', () => {
  const canonical = source.lessons.find(lesson => lesson.id === 'water-harvesting-l1')!;
  const paired = draft.lessons.find(lesson => lesson.id === canonical.id)!;
  assert.equal(paired.body.sourceEnglish, canonical.body);
  assert.equal(paired.body.reviewStatus, 'machine-draft');
  const paragraphs = paired.body.xitsongaDraft.split('\n\n');
  assert.equal(paragraphs.length, canonical.body.split('\n\n').length);
  // The earlier wording made infiltration an outcome and narrowed steep land to very steep.
  assert.ok(paragraphs[0].includes('so some water can soak into suitable soil'),
    'keep can and suitable soil: slowing runoff does not guarantee infiltration');
  assert.ok(paragraphs[0].includes('Ndlela leyi faneleke ndhawu ya wena yi titshege hi misava'),
    'distinguish the site from soil when selecting a design');
  assert.ok(paragraphs[7].includes('Kuma nkambelo wa laha kaya u nga si cela eka steep, wet or unstable land'),
    'assessment must precede digging on every source land condition');
  assert.ok(!paragraphs[7].includes('rhelela ngopfu'),
    'do not narrow the steep-land assessment warning to very steep land');
  const changed = { ...canonical, body: canonical.body.replace('some water can soak', 'all water will soak') };
  assert.notEqual(changed.body, canonical.body, 'the possibility-drift fixture must change the source');
  const shown = resolveLearnerLessonPresentation(changed, 'ts');
  assert.equal(shown.status, 'english-fallback', 'withdraw drafts after source changes infiltration certainty');
  assert.equal(shown.content.body, changed.body);
});

test('Water L2 Xitsonga preserves dry periods, overflow sequence and exact safety holds', () => {
  const canonical = source.lessons.find(lesson => lesson.id === 'water-harvesting-l2')!;
  const paired = draft.lessons.find(lesson => lesson.id === canonical.id)!;
  assert.equal(paired.body.sourceEnglish, canonical.body);
  assert.equal(paired.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = canonical.body.split('\n\n');
  const paragraphs = paired.body.xitsongaDraft.split('\n\n');
  assert.equal(paragraphs.length, 9);
  assert.equal(sourceParagraphs.length, paragraphs.length);
  assert.ok(paragraphs[1].includes('plan for dry periods') && paragraphs[1].includes('damu leri teleke a ri tiyisiwangi'),
    'retain the wider dry-period meaning and no-guarantee condition');
  assert.ok(paragraphs[1].startsWith('Tinguva ta mpfula ti hambana eAfrika Dzonga hinkwayo.'),
    'preserve the established localized South Africa sentence exactly');
  assert.ok(paragraphs[2].includes('Loko u nga si cinca watercourse') && paragraphs[2].includes('authorisation') && paragraphs[2].includes('water authority'),
    'keep the water-authority check before either regulated activity');
  assert.ok(paragraphs[3].includes('site investigation') && paragraphs[3].includes('design hi munhu loyi a nga na suitable qualifications') &&
    paragraphs[3].includes('Catchment runoff') && paragraphs[3].includes('downstream risk') && paragraphs[3].includes('safe spillway'),
  'retain the site investigation, qualified designer and listed dam-safety factors');
  assert.ok(paragraphs[5].startsWith('An uncontrolled overflow can erode and breach the wall.') &&
    paragraphs[5].includes('Kunguhatela ndlela leyi hlayisekeke') && paragraphs[5].includes('u nga si sungula ku aka'),
  'retain overflow/breach meaning and plan the safe route before construction');
  assert.ok(paragraphs[6].startsWith('Mati ma nga lahleka hi evaporation and seepage.') &&
    paragraphs[6].includes('Kamba xiyimo xa mati') && paragraphs[6].includes('ku lutla'),
  'keep evaporation distinct from steam and preserve the existing checks');
  assert.equal(paragraphs[7], sourceParagraphs[7], 'keep the high-consequence spillway, bank-cover and tree restrictions exact English');
  assert.ok(paragraphs[8].startsWith('Animals can damage banks and add manure to the water.') &&
    paragraphs[8].includes('a swi endli mati ma basa kumbe ku hlayiseka'),
  'preserve all-animal scope and the no-cleanliness/no-safety inference');
  const changed = { ...canonical, body: canonical.body.replace('dry periods', 'drought only') };
  assert.notEqual(changed.body, canonical.body);
  const shown = resolveLearnerLessonPresentation(changed, 'ts');
  assert.equal(shown.status, 'english-fallback', 'withdraw the whole lesson when its source conditions change');
  assert.equal(shown.content.body, changed.body);
});


test('Water L4 Xitsonga preserves source scope, sanitation gates, prohibitions and conditional stop action', () => {
  const canonical = source.lessons.find(lesson => lesson.id === 'water-harvesting-l4')!;
  const paired = draft.lessons.find(lesson => lesson.id === canonical.id)!;
  const sourceParagraphs = canonical.body.split('\n\n');
  const candidateParagraphs = paired.body.xitsongaDraft.split('\n\n');
  assert.equal(sourceParagraphs.length, 5);
  assert.equal(candidateParagraphs.length, 5);
  assert.equal(paired.body.sourceEnglish, canonical.body);
  assert.equal(paired.body.reviewStatus, 'machine-draft');
  assert.ok(candidateParagraphs[0].includes('ni other substances'), 'preserve the full harmful-substance scope');
  assert.equal(candidateParagraphs[1], sourceParagraphs[1], 'keep all excluded source waters and chemical prohibition exact');
  assert.equal(candidateParagraphs[2], sourceParagraphs[2], 'keep the before-any-reuse local-authority and no-advice rule exact');
  assert.ok(candidateParagraphs[3].startsWith('Xifaniso xa ntolovelo'), 'draft the ordinary framing sentence');
  for (const clause of [
    'Soil and mulch do not disinfect wastewater.',
    'Keep it away from drinking-water plumbing and prevent contact with people or animals.',
    'Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.',
  ]) assert.ok(candidateParagraphs[3].includes(clause), `retain exact operational clause: ${clause}`);
  assert.equal(candidateParagraphs[4], sourceParagraphs[4], 'keep the full AND/OR stop trigger and advice action exact');
  assert.ok(paired.title.xitsongaDraft.startsWith('Greywater:'), 'retain the exact technical title term');
  assert.deepEqual(paired.keyPoints.map(point => point.sourceEnglish), canonical.keyPoints);
  assert.deepEqual(paired.quiz.map(item => item.sourceCorrectIndex), canonical.quiz.map(item => item.correct));
  assert.deepEqual(paired.quiz.map(item => item.sourceCorrectIndex), [1, 1]);
  assert.equal(paired.quiz[0].options[1].xitsongaDraft, canonical.quiz[0].options[1], 'keep the correct local-check instruction exact');
  assert.ok(paired.quiz[1].rationale.xitsongaDraft.includes('Neither clear appearance, lack of smell nor mulch proves'),
    'clear-looking water and lack of smell do not establish safety');

  const shown = resolveLearnerLessonPresentation(canonical, 'ts');
  assert.equal(shown.status, 'draft', 'expose the source-paired L4 draft in the Xitsonga resolver');
  assert.equal(shown.content.title, paired.title.xitsongaDraft);
  assert.equal(shown.content.body, paired.body.xitsongaDraft);
  assert.deepEqual(shown.content.keyPoints, paired.keyPoints.map(point => point.xitsongaDraft));
  assert.deepEqual(shown.content.quiz.map(item => item.correct), [1, 1]);

  const changedSource = { ...canonical, body: canonical.body.replace('toilet water', 'another source') };
  assert.notEqual(changedSource.body, canonical.body, 'fixture changes the canonical safety-source scope');
  const fallback = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(fallback.status, 'english-fallback', 'source drift withdraws the complete paired lesson');
  assert.equal(fallback.content.body, changedSource.body);
});
