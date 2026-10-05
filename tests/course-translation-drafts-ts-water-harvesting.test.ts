import { marketAcceptedTarget, checkMarketTeachingExample, checkMarketPriceQuestion, checkMarketGapQuestion } from './market-l1-completion-checks.ts';
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

test('Xitsonga Market drafts retain exact sources, conditional sales and unchanged quiz meanings', () => {
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
      assert.ok(draftLesson.keyPoints.every(point => point.reviewStatus === 'machine-draft'), 'ordinary harvest, price and crop-timing key points remain unreviewed drafts');
      assert.ok(draftLesson.keyPoints[0].xitsongaDraft.includes('ntshovelo') && draftLesson.keyPoints[0].xitsongaDraft.includes('mali'), 'the harvest-versus-cash distinction remains explicit');
    } else if (draftLesson.id === 'market-community-l2') {
      assert.ok(draftLesson.keyPoints.every(point => point.reviewStatus === 'machine-draft'),
        'checked ordinary supply and compliance framing now joins the existing customer/cost drafts');
      assert.ok(draftLesson.keyPoints[2].xitsongaDraft.includes('ntsena loko supply ni customer terms'),
      'the box promise remains conditional on supporting supply and customer terms');
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
    assert.deepEqual(shown.content.quiz, sourceLesson.quiz.map((question, index) => ({
      q: draftLesson.quiz[index].question.xitsongaDraft,
      options: draftLesson.quiz[index].options.map(pair => pair.xitsongaDraft),
      correct: question.correct,
      rationale: draftLesson.quiz[index].rationale.xitsongaDraft,
    })));
    assert.deepEqual(shown.content.keyPoints, draftLesson.keyPoints.map(pair => pair.xitsongaDraft));
    const sourceParagraphs: string[] = sourceLesson.body.split('\n\n');
    const draftParagraphs: string[] = shown.content.body.split('\n\n');
    assert.equal(draftParagraphs.length, sourceParagraphs.length);
    // Reviewed L1 and L3 market framing joins the drafts; untranslated technical holds stay exact.
    const translatedIndices = draftLesson.id === 'market-community-l1' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
      : draftLesson.id === 'market-community-l2' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        : draftLesson.id === 'market-community-l3' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
          : [0, 3, 4, 5, 7, 8, 9, 10];
    for (const [index, paragraph] of sourceParagraphs.entries()) {
      if (translatedIndices.includes(index)) assert.notEqual(draftParagraphs[index], paragraph);
      else assert.equal(draftParagraphs[index], paragraph);
    }
    if (draftLesson.id === 'market-community-l1') {
      assert.ok(draftParagraphs[8].includes('best yield per bed') && draftParagraphs[8].includes('the most return for each hour of work'), 'the ranking comparison keeps both best and most anchors exact');
    }
    if (draftLesson.id === 'market-community-l2') {
      assert.equal(draftLesson.body.sourceEnglish, sourceLesson.body);
      assert.equal(draftLesson.body.reviewStatus, 'machine-draft');
      assert.equal(draftParagraphs[0], 'Vutisa leswaku muxavi u lava yini: product, nhlayo, quality, delivery na siku ra ku hakela.',
        'the existing localized customer-needs paragraph is preserved byte-for-byte');
      assert.ok(draftParagraphs[4].includes('regular selection eka vaxavi lava pfumelelaneke'),
        'regular selection is for agreed customers');
      assert.ok(draftParagraphs[9].includes('Loko production yi cinca vhiki na vhiki') &&
        draftParagraphs[9].includes('papalata ku tshembisa fixed delivery leyi u nga ta ka u nga swi koti ku yi nyika'),
      'variable production must not become an unsupportable fixed promise');
      assert.ok(draftParagraphs[10].startsWith('Offer surplus leyi u nga na yona'),
        'the surplus offer and customer-agreement framing is now drafted');
      assert.ok(draftParagraphs[1].startsWith('Pimanisa '));
      assert.ok(draftParagraphs[1].includes('market fees, transport, ku paka ni leswi nga xavisiwangiki'));
      assert.ok(draftParagraphs[1].includes('nxavo wo xavisa'));
      assert.ok(draftParagraphs[2].startsWith('Kambisisa milawu ya makete'));
      assert.ok(draftParagraphs[2].includes('Informal stall a xi vuli hi xoxe leswaku a ku na milawu kumbe costs.'));
      assert.ok(draftParagraphs[3].includes('can retain more of the sale price'));
      assert.ok(draftParagraphs[3].startsWith('Direct selling can retain more of the sale price, kambe swi tlhela swi teka nkarhi,'),
        'the bounded price claim and ordinary time/customer-care conditions stay together');
      assert.ok(draftParagraphs[5].startsWith('Pfumelelanani hi contents, price, payment na leswi humelelaka loko crops are short.'));
      assert.ok(draftParagraphs[5].endsWith('only when customers and growers can keep the agreement.'),
        'regular orders remain conditional on both sides keeping the agreement');
      assert.ok(draftParagraphs[6].startsWith('Sungula hi '));
      assert.ok(draftParagraphs[6].includes('what you can reliably supply') && draftParagraphs[6].includes('na leswi vaxavi va swi lavaka'),
        'the exact reliable-supply condition stays English while ordinary customer framing is drafted');
      assert.ok(draftParagraphs[7].startsWith('Kambisisa costs'));
      assert.ok(draftParagraphs[7].includes('u nga se tshembisa ku nyika regular boxes'),
        'household food and cost checks must precede the promise');
      assert.ok(draftParagraphs[8].includes('Vukulu bya ndhawu ya xirhapa kumbe nhlayo ya vaxavi ntsena a swi vhumbi mali leyi nghenaka.'),
        'area or customer count alone must not predict income');
      assert.ok(draftParagraphs[8].includes('Ringeta arrangement leyi u nga kotaka ku yi lawula'));
      assert.ok(draftParagraphs[8].includes(' kutani u tsala results'),
        'ordinary manageable-trial framing and recording results are localized');
      assert.ok(draftParagraphs[11].startsWith('Hlamusela maendlelo ya wena ya ku byala hi vutshembeki.'));
      assert.ok(draftParagraphs[11].endsWith('Loko u nga se tirhisa label, kambisisa any certification or claim the buyer requires.'),
        'the buyer-required claim check remains before label use');
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
      assert.equal(draftParagraphs[7], 'Nguva yin’we ya tirhekhodo yi hlamula swivutiso leswi pfunaka.',
        'one season of records answers practical questions without weakening the source claim with “can”');
      assert.equal(draftParagraphs[2], 'Tirhisa vuxokoxoko byole ku sirhelela swakudya swa ndyangu ni ku endla swiboho swa bindzu swo antswa.');
      assert.equal(draftParagraphs[4], 'Tsala kilograms ta matamatisi, dozens ta matandza ni bundles ta morogo, kutani u tsala laha xin\'wana ni xin\'wana xi yeke kona.',
        'unit labels and produce names stay exact while the recording action is drafted');
      assert.equal(draftParagraphs[14], 'Tirhisa rekhodo ya wena ku kuma leswaku swakudya swa ndyangu swi kayivela rini.');
      // Checked ordinary destinations/months/price framing replaces its holds; decision safeguards remain exact.
      for (const index of [8, 9, 11, 15, 16]) assert.notEqual(draftParagraphs[index], sourceParagraphs[index],
        `approved ordinary paragraph ${index + 1} is paired as a draft`);
      checkMarketTeachingExample('ts', draftParagraphs[12], sourceParagraphs[12]);
      assert.ok(draftParagraphs[8].includes('best yield per bed') && draftParagraphs[8].includes('the most return for each hour of work'), 'the best/most comparison stays exact');
      assert.ok(draftParagraphs[11].includes('production, packing and selling costs'), 'the cost categories remain named in English');
      assert.ok(draftParagraphs[15].includes('swiyimo swa ku byala') && draftParagraphs[15].includes('nkarhi lowu ntshovelo wu languteriwaka ku fika ha wona'), 'planting conditions and expected harvest time stay explicit in learner wording');
      assert.ok(draftParagraphs[16].includes('loko mpfula, mati kumbe swibyariwa swi tsandzeka'), 'backup planning remains tied to failure conditions');
      for (const index of [5, 10, 13]) assert.notEqual(draftParagraphs[index], sourceParagraphs[index]);
      assert.ok(draftParagraphs[5].includes('mukhuva lowu wo olova'), 'ordinary simple-habit wording is localized');
      assert.ok(draftParagraphs[13].includes('a wu tiyisisi'), 'the higher asking price is not presented as a guaranteed sale');
      assert.deepEqual(draftLesson.quiz.map(question => question.sourceCorrectIndex), [2, 1],
        'both quiz answer keys remain in canonical order');
      const priceQuestion = draftLesson.quiz[0];
      assert.equal(priceQuestion.question.reviewStatus, 'machine-draft');
      checkMarketPriceQuestion('ts', priceQuestion.question.xitsongaDraft);
      assert.deepEqual(priceQuestion.options.map(option => option.sourceEnglish), sourceLesson.quiz[0].options);
      assert.ok(priceQuestion.options.every(option => option.reviewStatus === 'machine-draft'));
      assert.ok(priceQuestion.rationale.xitsongaDraft.includes('le hansi ka cost') &&
        priceQuestion.rationale.xitsongaDraft.includes('u nga se endla xiboho'),
      'price remains below cost, with review before the next decision');

      const gapQuestion = draftLesson.quiz[1];
      const gapSource = sourceLesson.quiz[1];
      assert.equal(gapQuestion.sourceCorrectIndex, 1);
      assert.deepEqual(gapQuestion.options.map(option => option.sourceEnglish), gapSource.options,
        'translated choices preserve the original option order');
      checkMarketGapQuestion('ts', gapQuestion.question.xitsongaDraft);
      assert.ok(gapQuestion.options[1].xitsongaDraft.includes('swibyariwa leswi lulameleke ndhawu ya wena') &&
        gapQuestion.options[1].xitsongaDraft.includes('nkarhi wa swona wa ntshovelo'),
        'the keyed action retains locally suitable crops and harvest timing');
      assert.ok(gapQuestion.rationale.xitsongaDraft.startsWith('Tirhekhodo ti komba ku pfumaleka.') &&
        gapQuestion.rationale.xitsongaDraft.includes('local climate') &&
        gapQuestion.rationale.xitsongaDraft.includes('mati') &&
        gapQuestion.rationale.xitsongaDraft.includes('nkarhi lowu ntshovelo wu languteriweke'),
        'the rationale retains local climate, water and expected harvest-time conditions');
      assert.equal(gapQuestion.options[3].reviewStatus, 'machine-draft',
        'ordinary records framing is drafted while the soil-fertility diagnosis stays an exact English anchor');
      assert.equal(gapQuestion.options[3].xitsongaDraft, marketAcceptedTarget('ts', 'quiz[1].options[3]'));
      assert.ok(gapQuestion.options[3].xitsongaDraft.includes('xiphiqo xa soil fertility'));
      assert.equal(gapQuestion.sourceCorrectIndex, 1,
        'the soil-fertility statement remains the same false distractor');

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
        assert.equal(question.question.reviewStatus, 'machine-draft');
        assert.equal(question.rationale.reviewStatus, 'machine-draft');
        assert.ok(question.options.every(option => option.reviewStatus === 'machine-draft' ||
          (option.reviewStatus === 'hold' && option.xitsongaDraft === option.sourceEnglish)));
      }
      assert.ok(draftLesson.quiz[0].question.xitsongaDraft.endsWith('Hi yihi channel leyi n’wi fanelaka best?'),
        'the best-channel comparison must not become merely a suitable-channel question');
      assert.equal(draftLesson.quiz[1].options[3].reviewStatus, 'machine-draft');
      assert.equal(draftLesson.quiz[1].options[3].xitsongaDraft, 'Box schemes ti papalata tax obligations',
        'the false distractor keeps the positive avoid claim without changing it into a tax exemption or negation');
      assert.equal(draftLesson.quiz[1].sourceCorrectIndex, 2,
        'the translated false tax claim stays at its original distractor position');
      assert.ok(draftLesson.quiz[1].options[1].xitsongaDraft.includes('ku charge extra for packaging'),
        'the distractor describes charging a customer, not the grower paying');
    }
    const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body} Changed.` };
    assert.equal(resolveLearnerLessonPresentation(changedSource, 'ts').status, 'english-fallback');
  }
});

test('Water L1-L4 show source-paired Xitsonga drafts while retained technical holds stay exact', () => {
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

test('2026-10-05 Xitsonga holds remain exact and superseded whole-paragraph holds retain safety checks', () => {
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
      if (hold.lessonId === 'water-harvesting-l3' && hold.field === 'title') {
        assert.equal(pair.xitsongaDraft, 'Rainwater Tanks and Roof Catchment: Ku hlengeleta ni ku sirhelela mati');
        assert.equal(pair.reviewStatus, 'machine-draft', 'the approved ordinary title phrase replaces its superseded hold');
      } else {
        assert.equal(pair.xitsongaDraft, hold.sourceText, `${hold.field} must remain exact English`);
        assert.equal(pair.reviewStatus, 'hold');
      }
    }
    assert.ok(hold.reason.length > 0);
  }

  // 2026-10-05: these seven previous exact-paragraph holds now have checked mixed-language
  // learner text. Their full source/target/provenance remains in the dated applied packet;
  // the assertions below protect the same safety and quantity meanings at clause level.
  for (const [lessonId, field] of [
    ['water-harvesting-l2', 'body[7]'],
    ['water-harvesting-l3', 'body[3]'], ['water-harvesting-l3', 'body[5]'], ['water-harvesting-l3', 'body[11]'],
    ['water-harvesting-l4', 'body[1]'], ['water-harvesting-l4', 'body[2]'], ['water-harvesting-l4', 'body[4]'],
  ]) {
    assert.equal(draft.holds.some(hold => hold.lessonId === lessonId && hold.field === field), false,
      `${lessonId} ${field}: replaced exact-paragraph hold must not mask the checked learner wording`);
  }
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
  assert.ok(paragraphs[3].includes('a wu ku byeli') && paragraphs[3].includes('dry spell') &&
    paragraphs[3].includes('supply') && paragraphs[3].includes('loku u ku pulaneke'),
  'annual totals do not promise dry-spell supply, and users compare it with planned use');
  assert.ok(paragraphs[4].includes('mati man’wana ya runoff yo sungula') &&
    paragraphs[4].includes('yi hambukisa') && paragraphs[4].includes('ma nga ngheni etankini'),
  'divert only some first runoff away from the tank');
  assert.ok(paragraphs[5].includes('supplier ya sizing na maintenance') &&
    paragraphs[5].includes('a ku na volume yin’we') && paragraphs[5].includes('roof yin’wana na yin’wana'),
  'follow supplier sizing and maintenance; no single diversion volume fits every roof');
  assert.ok(paragraphs[6].includes('Diverter a yi endli leswaku mati lawa ma saleke ma hlayiseka ku nwa.'));
  assert.ok(paragraphs[10].toLowerCase().includes('screen openings against insects'));
  assert.ok(paragraphs[10].includes('Keep rainwater separate from drinking-water pipes.'));
  assert.ok(paragraphs[11].includes('Mati lama vonakaka ma basile ma nga ha va') &&
    paragraphs[11].includes('germs kumbe chemicals') && paragraphs[11].includes('local health authority') &&
    paragraphs[11].includes('testing na treatment') && paragraphs[11].includes('intended use'),
  'clear appearance does not establish safety; testing and treatment follow intended use');
  assert.ok(paragraphs[12].includes('Basic filter ntsena a yi tiyisisi') &&
    paragraphs[12].includes('food crops') && paragraphs[12].includes('safety assessment'),
  'retain filter no-guarantee and food-crop safety assessment');
  const irrigationQuiz = paired.quiz[1];
  assert.equal(irrigationQuiz.sourceCorrectIndex, 1);
  assert.ok(irrigationQuiz.options[1].xitsongaDraft.includes('leti nga contaminate crops leti dyiwaka'),
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
  assert.ok(paragraphs[0].includes('some water can soak into suitable soil'),
    'keep can and suitable soil: slowing runoff does not guarantee infiltration');
  assert.ok(paragraphs[0].includes('Ndlela leyi faneleke ndhawu ya wena yi titshege hi misava'),
    'distinguish the site from soil when selecting a design');
  assert.ok(paragraphs[7].includes('Kuma nkambelo wa laha kaya u nga si cela eka steep, wet kumbe unstable land'),
    'assessment must precede digging on every source land condition');
  assert.ok(!paragraphs[7].includes('rhelela ngopfu'),
    'do not narrow the steep-land assessment warning to very steep land');
  const changed = { ...canonical, body: canonical.body.replace('some water can soak', 'all water will soak') };
  assert.notEqual(changed.body, canonical.body, 'the possibility-drift fixture must change the source');
  const shown = resolveLearnerLessonPresentation(changed, 'ts');
  assert.equal(shown.status, 'english-fallback', 'withdraw drafts after source changes infiltration certainty');
  assert.equal(shown.content.body, changed.body);
});

test('Water L2 Xitsonga preserves dry periods, overflow sequence and dam safeguards', () => {
  const canonical = source.lessons.find(lesson => lesson.id === 'water-harvesting-l2')!;
  const paired = draft.lessons.find(lesson => lesson.id === canonical.id)!;
  assert.equal(paired.body.sourceEnglish, canonical.body);
  assert.equal(paired.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = canonical.body.split('\n\n');
  const paragraphs = paired.body.xitsongaDraft.split('\n\n');
  assert.equal(paragraphs.length, 9);
  assert.equal(sourceParagraphs.length, paragraphs.length);
  assert.ok(paragraphs[1].includes('plan for dry periods') && paragraphs[1].includes('damu leri teleke a ri tiyisisiwi'),
    'retain the wider dry-period meaning and no-guarantee condition');
  assert.ok(paragraphs[1].startsWith('Tinguva ta mpfula ti hambana eAfrika Dzonga hinkwaro.'),
    'preserve the established localized South Africa sentence exactly');
  assert.ok(paragraphs[2].startsWith('U nga si cinca watercourse') && paragraphs[2].includes('authorisation') && paragraphs[2].includes('water authority'),
    'keep the water-authority check before either regulated activity');
  assert.ok(paragraphs[3].includes('site investigation') && paragraphs[3].includes('design hi munhu loyi a nga na suitable qualifications') &&
    paragraphs[3].includes('Catchment runoff') && paragraphs[3].includes('downstream risk') && paragraphs[3].includes('safe spillway'),
  'retain the site investigation, qualified designer and listed dam-safety factors');
  assert.ok(paragraphs[5].includes('can erode and breach the wall') &&
    paragraphs[5].includes('Kunguhatela ndlela leyi hlayisekeke') && paragraphs[5].includes('u nga si sungula ku aka'),
  'retain overflow/breach meaning and plan the safe route before construction');
  assert.ok(paragraphs[6].startsWith('Mati ma nga lahleka hi evaporation na seepage.') &&
    paragraphs[6].includes('Kamba mpimo wa mati') && paragraphs[6].includes('ku huma ka mati') &&
    paragraphs[6].includes('ku kukuleka ka misava'),
  'keep evaporation distinct from steam and preserve the existing checks');
  assert.ok(paragraphs[7].includes('spillway yi nga pfaleki') &&
    paragraphs[7].includes('bank cover leyi boxiweke eka design') &&
    paragraphs[7].includes('U nga byali mirhi') && paragraphs[7].includes('earth dam wall'),
  'keep the spillway clear, use the design-specified bank cover and prohibit trees on the earth dam wall');
  assert.ok(paragraphs[8].startsWith('Swiharhi swi nga onha tibangi ta damu') &&
    paragraphs[8].includes('a swi endli mati ma basa kumbe ma hlayiseka'),
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
  assert.ok(candidateParagraphs[0].includes('germs, salts, cleaning products ni swilo swin’wana'),
    'preserve the full household-water contaminant scope');
  assert.ok(candidateParagraphs[1].includes('U nga katsi mati ya toilet') &&
    candidateParagraphs[1].includes('nappies') && candidateParagraphs[1].includes('munhu loyi a vabyaka') &&
    candidateParagraphs[1].includes('mati yo hlantswa swiharhi') &&
    candidateParagraphs[1].includes('U nga tirhisi nakambe') && candidateParagraphs[1].includes('harmful chemicals'),
  'exclude every source water in the list and prohibit reuse of chemically harmful water');
  assert.ok(candidateParagraphs[2].includes('Before any reuse') && candidateParagraphs[2].includes('municipality') &&
    candidateParagraphs[2].includes('qualified local sanitation adviser') && candidateParagraphs[2].includes('source') &&
    candidateParagraphs[2].includes('vukorhokeri bya mati na sanitation') && candidateParagraphs[2].includes('intended use na site') &&
    candidateParagraphs[2].includes('Loko ndzayo leyi yi nga kumeki kumbe yi nga ri erivaleni') &&
    candidateParagraphs[2].includes('u nga ma tirhisi nakambe'),
  'require municipal and qualified local sanitation checks before reuse; unclear or unavailable advice means no reuse');
  assert.ok(candidateParagraphs[3].startsWith('A generic picture a hi pulani ya purasi.'),
    'retain the exact design-limit sentence while other ordinary clauses are paired');
  for (const clause of [
    'Soil and mulch do not disinfect wastewater.',
    'Keep wastewater away from drinking-water plumbing and prevent contact with people or animals.',
    'Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.',
  ]) assert.ok(candidateParagraphs[3].includes(clause), `retain exact operational clause: ${clause}`);
  const stopTrigger = candidateParagraphs[4];
  assert.ok(stopTrigger.includes('Loko reuse system yi ri karhi yi tirha') &&
    stopTrigger.includes('naswona') && stopTrigger.includes('mati ma nunha') &&
    stopTrigger.includes('ma yima kumbe ma onha swimilana') &&
    stopTrigger.includes('tshika ku ma tirhisa') && stopTrigger.includes('qualified local adviser') &&
    stopTrigger.indexOf('yi ri karhi yi tirha') < stopTrigger.indexOf('naswona') &&
    stopTrigger.indexOf('naswona') < stopTrigger.indexOf('mati ma nunha') &&
    stopTrigger.indexOf('kumbe ma onha swimilana') < stopTrigger.indexOf('tshika ku ma tirhisa'),
  'when a system is operating, any listed bad-water sign means stop use and seek qualified local advice');
  assert.ok(paired.title.xitsongaDraft.startsWith('Greywater:'), 'retain the exact technical title term');
  assert.deepEqual(paired.keyPoints.map(point => point.sourceEnglish), canonical.keyPoints);
  assert.deepEqual(paired.quiz.map(item => item.sourceCorrectIndex), canonical.quiz.map(item => item.correct));
  assert.deepEqual(paired.quiz.map(item => item.sourceCorrectIndex), [1, 1]);
  assert.equal(paired.quiz[0].options[1].xitsongaDraft, canonical.quiz[0].options[1], 'keep the correct local-check instruction exact');
  assert.ok(paired.quiz[1].rationale.xitsongaDraft.includes('ma nga va na germs, salts na chemicals') &&
    paired.quiz[1].rationale.xitsongaDraft.includes('Ku vonaka ma clear') &&
    paired.quiz[1].rationale.xitsongaDraft.includes('ku pfumaleka ka nun’hwelo') &&
    paired.quiz[1].rationale.xitsongaDraft.includes('kumbe mulch') &&
    paired.quiz[1].rationale.xitsongaDraft.includes('a swi tiyisisi'),
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
