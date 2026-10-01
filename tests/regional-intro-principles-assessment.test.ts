import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ve.ts';
import { XITSONGA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ts.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

type Language = 've' | 'ts';
type RegionalPair = {
  sourceEnglish: string;
  reviewStatus: string;
  tshivendaDraft?: string;
  xitsongaDraft?: string;
};
type CandidatePair = { sourceEnglish: string; draft: string };
type CandidatePacket = {
  lessonId: string;
  status: string;
  keyPoints: CandidatePair[];
  quiz: Array<{
    question: CandidatePair;
    options: CandidatePair[];
    sourceCorrectIndex: number;
    rationale: CandidatePair;
  }>;
};

const intro = COURSE_MODULES.find(module => module.id === 'intro-permaculture')!;
const lesson = intro.lessons.find(item => item.id === 'intro-permaculture-l2')!;
const packets: Record<Language, CandidatePacket> = {
  ve: JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/VE-INTRO-L2-ASSESSMENT-CANDIDATES-2026-10-01.json', import.meta.url), 'utf8')),
  ts: JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/TS-INTRO-L2-ASSESSMENT-CANDIDATES-2026-10-01.json', import.meta.url), 'utf8')),
};
const drafts = {
  ve: TSHIVENDA_INTRO_PERMACULTURE_DRAFT.lessons.find(item => item.id === lesson.id)!,
  ts: XITSONGA_INTRO_PERMACULTURE_DRAFT.lessons.find(item => item.id === lesson.id)!,
};
const targetText = (pair: RegionalPair, language: Language) => language === 've' ? pair.tshivendaDraft : pair.xitsongaDraft;

function assertOrdered(text: string, terms: string[], message: string) {
  let from = 0;
  for (const term of terms) {
    const at = text.indexOf(term, from);
    assert.notEqual(at, -1, `${message}: missing or out-of-order “${term}”`);
    from = at + term.length;
  }
}

test('Introduction L2 assessments match reviewed packets, exact English sources and answer indexes', () => {
  for (const language of ['ve', 'ts'] as const) {
    const packet = packets[language];
    const draft = drafts[language];
    assert.equal(packet.lessonId, lesson.id);
    assert.equal(packet.status, 'learner-wired-machine-draft');
    assert.equal(draft.keyPoints.length, lesson.keyPoints.length);
    assert.equal(draft.quiz.length, lesson.quiz.length);
    assert.equal(packet.keyPoints.length, lesson.keyPoints.length);

    lesson.keyPoints.forEach((source, index) => {
      const pair = draft.keyPoints[index] as RegionalPair;
      assert.equal(pair.sourceEnglish, source, `${language} key point ${index} retains exact source`);
      assert.equal(pair.reviewStatus, 'machine-draft');
      assert.equal(targetText(pair, language), packet.keyPoints[index].draft, `${language} key point ${index} matches the checked candidate`);
    });

    lesson.quiz.forEach((source, index) => {
      const pair = draft.quiz[index];
      const candidate = packet.quiz[index];
      assert.equal(pair.question.sourceEnglish, source.q);
      assert.equal(pair.question.reviewStatus, 'machine-draft');
      assert.equal(targetText(pair.question as RegionalPair, language), candidate.question.draft);
      assert.equal(pair.options.length, source.options.length);
      assert.equal(candidate.options.length, source.options.length);
      pair.options.forEach((option, optionIndex) => {
        assert.equal(option.sourceEnglish, source.options[optionIndex], `${language} quiz ${index} option ${optionIndex} keeps source order`);
        assert.equal(option.reviewStatus, 'machine-draft');
        assert.equal(targetText(option as RegionalPair, language), candidate.options[optionIndex].draft);
      });
      assert.equal(pair.sourceCorrectIndex, source.correct, `${language} quiz ${index} answer index is unchanged`);
      assert.equal(pair.sourceCorrectIndex, candidate.sourceCorrectIndex);
      assert.equal(pair.options[pair.sourceCorrectIndex].sourceEnglish, source.options[source.correct]);
      assert.equal(pair.rationale.sourceEnglish, source.rationale);
      assert.equal(pair.rationale.reviewStatus, 'machine-draft');
      assert.equal(targetText(pair.rationale as RegionalPair, language), candidate.rationale.draft);
    });
  }
});

test('Introduction L2 keeps wet-season observation and adviser inspection before digging', () => {
  const cases: Array<{ language: Language; option: string; rationale: string; firstStep: string; adviser: string; beforeDigging: string }> = [
    {
      language: 've',
      option: drafts.ve.quiz[0].options[1].tshivendaDraft,
      rationale: drafts.ve.quiz[0].rationale.tshivendaDraft,
      firstStep: 'vhukando ha u ranga fhedzi',
      adviser: 'mueletshedzi wa henefho o gudedzwaho',
      beforeDigging: 'Musi ni sa athu bwa',
    },
    {
      language: 'ts',
      option: drafts.ts.quiz[0].options[1].xitsongaDraft,
      rationale: drafts.ts.quiz[0].rationale.xitsongaDraft,
      firstStep: 'ku xiyisisa i goza ro sungula ntsena',
      adviser: 'mutsundzuxi wa le ndhawini ya wena loyi a leteriweke',
      beforeDigging: 'u nga si cela',
    },
  ];
  for (const item of cases) {
    assert.ok(item.option);
    assert.ok(item.rationale);
    assert.match(item.option, /wet season|khalaṅwaha|nguva ya mpfula/);
    assert.match(item.option, /flows|elela|khulukaka/);
    assert.match(item.option, /pools|kuvhangana|hleng|hlengeletanaka/);
    assert.ok(item.rationale.includes(item.firstStep), `${item.language}: observation remains only the first step`);
    assert.ok(item.rationale.includes(item.adviser), `${item.language}: adviser remains local and trained`);
    assert.ok(item.rationale.includes(item.beforeDigging), `${item.language}: inspection remains before digging`);
    for (const term of ['slope', 'drainage', 'safe overflow route']) {
      assert.ok(item.rationale.includes(term), `${item.language}: retain site-check term ${term}`);
    }
  }
  assert.match(cases[1].option, /yin’we kumbe ku tlurisa/, 'the Xitsonga observation period remains at least one wet season');
  assert.match(cases[0].option, /at least one wet season/, 'the Tshivenda candidate retains the exact minimum period');
});

test('Introduction L2 poultry assessment preserves the harvest, safety and crop-return order', () => {
  const veOption = drafts.ve.quiz[1].options[1].tshivendaDraft!;
  const tsOption = drafts.ts.quiz[1].options[1].xitsongaDraft!;
  const veRationale = drafts.ve.quiz[1].rationale.tshivendaDraft!;
  const tsRationale = drafts.ts.quiz[1].rationale.xitsongaDraft!;

  for (const [language, option, rationale, afterHarvest, beforeReturn, cleanup] of [
    ['ve', veOption, veRationale, 'nga murahu ha harvest', 'musi edible crops dzi sa athu vhuya', 'khuhu dzi clean up pests'],
    ['ts', tsOption, tsRationale, 'endzhaku ka harvest', 'loko edible crops ti nga si vuya', 'tihuku ti basisa pests'],
  ] as const) {
    assert.ok(option.includes('chicken run'));
    assert.ok(option.includes('planting bed'));
    assert.ok(option.includes(afterHarvest), `${language}: chickens use the empty bed after harvest`);
    assert.ok(option.includes('safe management'));
    assert.ok(option.includes(beforeReturn), `${language}: safety check precedes edible crop return`);
    assert.ok(rationale.includes(cleanup), `${language}: chickens directly clean up pests`);
    assert.ok(rationale.includes('fertility'));
    assert.ok(rationale.includes('fixed pen'));
    assert.ok(rationale.includes('Fresh manure'));
    assert.ok(rationale.includes('germs'));
    assert.match(rationale, /nga hwalela germs|yi nga rhwala germs/, `${language}: manure can carry germs`);
    assert.ok(rationale.includes('safe management'));
    assert.ok(rationale.includes(beforeReturn), `${language}: rationale keeps the crop-return safety condition`);
  }
});

test('changed L2 key points or safety sources fail closed to the exact English lesson', () => {
  for (const language of ['ve', 'ts'] as const) {
    for (const changed of [
      { ...lesson, keyPoints: lesson.keyPoints.map((point, index) => index === 0 ? `${point} revised` : point) },
      { ...lesson, quiz: lesson.quiz.map((question, index) => index === 0 ? { ...question, rationale: `${question.rationale} revised` } : question) },
    ]) {
      const result = resolveLearnerLessonPresentation(changed, language);
      assert.equal(result.status, 'english-fallback', `${language}: a changed assessment source invalidates the paired lesson`);
      assert.deepEqual(result.content.keyPoints, changed.keyPoints);
      assert.deepEqual(result.content.quiz, changed.quiz);
    }
  }
});

test('other Xitsonga Intro lessons keep their exact-English hold records', () => {
  const heldFields = XITSONGA_INTRO_PERMACULTURE_DRAFT.holds;
  assert.ok(heldFields.some(hold => hold.lessonId === 'intro-permaculture-l1' && hold.field === 'keyPoints[1]'));
  assert.ok(heldFields.some(hold => hold.lessonId === 'intro-permaculture-l1' && hold.field === 'quiz[0].q'));
  assert.ok(heldFields.some(hold => hold.lessonId === 'intro-permaculture-l3' && hold.field === 'body'));
  assert.ok(heldFields.some(hold => hold.lessonId === 'intro-permaculture-l3' && hold.field === 'quiz[1].rationale'));
  assert.ok(!heldFields.some(hold => hold.lessonId === 'intro-permaculture-l2'),
    'completed assessment candidates no longer advertise superseded L2 holds');
});
