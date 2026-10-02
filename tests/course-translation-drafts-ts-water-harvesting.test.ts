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

const source = COURSE_MODULES.find(module => module.id === 'water-harvesting')!;
const digits = (value: string) => value.match(/\d+/g) ?? [];

test('Food Forest Xitsonga draft keeps species caution and crop care exact English', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(sourceModule);
  const sourceLesson = sourceModule.lessons[0];
  const draftLesson = XITSONGA_FOOD_FOREST_DRAFT.lessons[0];
  assert.equal(draftLesson.id, sourceLesson.id);
  assert.equal(draftLesson.title.sourceEnglish, sourceLesson.title);
  assert.equal(draftLesson.title.reviewStatus, 'hold');
  assert.equal(draftLesson.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
  assert.equal(draftLesson.body.sourceEnglish, sourceLesson.body);
  assert.deepEqual(draftLesson.keyPoints.map(point => point.xitsongaDraft), sourceLesson.keyPoints);
  assert.deepEqual(draftLesson.quiz.map(question => question.sourceCorrectIndex), sourceLesson.quiz.map(question => question.correct));
  const shown = resolveLearnerLessonPresentation(sourceLesson, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.title, sourceLesson.title);
  assert.deepEqual(shown.content.keyPoints, sourceLesson.keyPoints);
  assert.deepEqual(shown.content.quiz, sourceLesson.quiz);
  const sourceParagraphs: string[] = sourceLesson.body.split('\n\n');
  const shownParagraphs: string[] = shown.content.body.split('\n\n');
  assert.equal(shownParagraphs.length, sourceParagraphs.length);
  for (const [index, paragraph] of sourceParagraphs.entries()) {
    if ([0, 1, 2, 3, 4, 5, 6, 7, 8, 11].includes(index)) assert.notEqual(shownParagraphs[index], paragraph);
    else assert.equal(shownParagraphs[index], paragraph);
  }
  assert.equal(shownParagraphs[9], sourceParagraphs[9],
    'local species suitability and permission remain exact English');
  assert.equal(shownParagraphs[10], sourceParagraphs[10],
    'establishment care remains exact English');
  assert.equal(shownParagraphs[12], sourceParagraphs[12],
    'competition and care guidance remain exact English');
  assert.equal(resolveLearnerLessonPresentation({ ...sourceLesson, body: `${sourceLesson.body} Changed.` }, 'ts').status,
    'english-fallback');
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
    } else {
      assert.deepEqual(draftLesson.keyPoints.map(point => point.xitsongaDraft), sourceLesson.keyPoints);
    }
    assert.deepEqual(draftLesson.quiz.map(question => question.sourceCorrectIndex), sourceLesson.quiz.map(question => question.correct));
    const shown = resolveLearnerLessonPresentation(sourceLesson, 'ts');
    assert.equal(shown.status, 'draft');
    assert.deepEqual(shown.content.quiz, sourceLesson.quiz);
    assert.deepEqual(shown.content.keyPoints, draftLesson.id === 'market-community-l1'
      ? ['Tsala nhlayo ya ntshovelo ni laha wu yeke kona hi ku hambana ni mali', ...sourceLesson.keyPoints.slice(1)]
      : sourceLesson.keyPoints);
    const sourceParagraphs: string[] = sourceLesson.body.split('\n\n');
    const draftParagraphs: string[] = shown.content.body.split('\n\n');
    assert.equal(draftParagraphs.length, sourceParagraphs.length);
    const translatedIndices = draftLesson.id === 'market-community-l1' ? [0, 1, 2, 3, 4, 6, 7, 14]
      : draftLesson.id === 'market-community-l2' ? [0] : [3, 4, 5, 9];
    for (const [index, paragraph] of sourceParagraphs.entries()) {
      if (translatedIndices.includes(index)) assert.notEqual(draftParagraphs[index], paragraph);
      else assert.equal(draftParagraphs[index], paragraph);
    }
    if (draftLesson.id === 'market-community-l2') {
      for (const index of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) assert.equal(draftParagraphs[index], sourceParagraphs[index],
        'market costs, box terms, reliable supply and fixed delivery stay exact English');
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
      for (const index of [5, 8, 9, 10, 11, 12, 13, 15, 16]) assert.equal(draftParagraphs[index], sourceParagraphs[index],
        'crop comparisons, prices, financial examples and planting timing remain exact English');
      assert.deepEqual(draftLesson.quiz.map(question => question.sourceCorrectIndex), [2, 1],
        'the held quizzes keep their original answer keys');
    }
    const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body} Changed.` };
    assert.equal(resolveLearnerLessonPresentation(changedSource, 'ts').status, 'english-fallback');
  }
});

test('Water L1 and L2 show source-paired Xitsonga drafts while unresolved lessons remain English', () => {
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
  for (const required of [
    'Do not plant trees on an earth dam wall.',
    'A diverter does not make the remaining water safe to drink.',
    'Water that looks clear may still contain germs or chemicals. Ask the local health authority about testing and treatment suited to the intended use.',
    'A basic filter alone is not a drinking-water guarantee. Water used on food crops also needs a safety assessment.',
  ]) assert.ok(exactHolds.some(held => held.includes(required)), `safety or legal claim needs an exact hold: ${required}`);
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
