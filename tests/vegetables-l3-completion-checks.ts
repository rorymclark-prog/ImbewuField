import { vegetablesBeforeL3Ordinary, vegetablesL3PresentationBeforeOrdinary } from './vegetables-l3-ordinary-residual-checks.ts';
import { vegetablesAssessmentPresentationBeforeOrdinary } from './vegetables-assessment-ordinary-checks.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as st } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { vegetablesBeforePestPrecision, vegetablesDeckBeforePestPrecision } from './vegetables-pest-precision-checks.ts';

type Language = 'st' | 've' | 'ts';
const folder = '../docs/study-translation-reviews/vegetables-l3-completion-2026-10-06/';
const read = (name: string) => readFileSync(new URL(folder + name, import.meta.url), 'utf8');
const packet = JSON.parse(read('root-reviewed-candidates.json'));
const baseline = JSON.parse(read('native-before.json'));
const plan = JSON.parse(read('implementation-plan.json'));
const drafts = { st, ve, ts };
const keys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' };
const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!;
const parts = (path: string) => path.replace(/\[(\d+)\]/g, '.$1').split('.');
const get = (object: any, path: string): any => parts(path).reduce((value, key) => value[key], object);
const contentPath = (path: string) => path.replace('.question', '.q');
const lessonAt = (draft: any) => draft.lessons.find((lesson: any) => lesson.id === source.id);

export function vegetablesL3BeforeCompletion<T>(language: Language, actual: T): T {
  // The later 6 October pest/assessment precision layer is validated and rewound
  // first so this older L3 history assertion still checks its original claim.
  const restored: any = vegetablesBeforePestPrecision(language, actual);
  const shown = vegetablesAssessmentPresentationBeforeOrdinary(source, language);
  for (const row of packet.candidates.filter((row: any) => row.language === language)) {
    const live = get(lessonAt(restored), row.fieldPath);
    const old = get(lessonAt(baseline[language]), row.fieldPath);
    assert.equal(live.sourceEnglish, row.sourceEnglish, `${row.id}: current source guard`);
    assert.equal(get(source, contentPath(row.fieldPath)), row.sourceEnglish, `${row.id}: canonical source`);
    assert.equal(live[keys[language]], row.candidate, `${row.id}: current reviewed target before inversion`);
    assert.equal(get(shown.content, contentPath(row.fieldPath)), row.candidate, `${row.id}: actual learner sees the reviewed draft`);
    assert.equal(live.reviewStatus, row.candidate === row.currentTarget ? old.reviewStatus : 'machine-draft');
    assert.equal(old[keys[language]], row.currentTarget, `${row.id}: frozen before target`);
    Object.assign(get(lessonAt(restored), row.fieldPath), old);
  }
  return restored;
}

// 6 October: earlier L3 assertions describe English assessment holds. Verify every
// current source/target/status first, then reconstruct only the documented leaves.
export function vegetablesL3PresentationBeforeCompletion(lesson: Lesson, language: Language) {
  assert.equal(lesson.id, source.id);
  vegetablesL3BeforeCompletion(language, drafts[language]);
  const shown = vegetablesAssessmentPresentationBeforeOrdinary(lesson, language);
  for (const row of packet.candidates.filter((row: any) => row.language === language)) {
    const path = parts(contentPath(row.fieldPath));
    const parent = path.slice(0, -1).reduce((value: any, key: string) => value[key], shown.content);
    parent[path.at(-1)!] = row.currentTarget;
  }
  return shown;
}

// Later completion is layered onto older whole-module expectations, so the original
// coverage still rejects every unlisted edit instead of pinning obsolete English holds.
export function vegetablesWithL3Completion<T>(language: Language, previous: T): T {
  const expected: any = structuredClone(previous);
  const lesson = lessonAt(expected);
  if (!lesson) {
    assert.equal(language, 'ts', 'only the separate Xitsonga L2 registry lacks L3');
    assert.ok(expected.lessons.every((item: any) => item.id === 'vegetables-staples-l2'));
    return expected;
  }
  for (const row of packet.candidates.filter((row: any) => row.language === language)) {
    const pair = get(lesson, row.fieldPath);
    assert.equal(pair.sourceEnglish, row.sourceEnglish, `${row.id}: historical source edge`);
    assert.equal(pair[keys[language]], row.currentTarget, `${row.id}: historical target edge`);
    if (row.candidate !== row.currentTarget) {
      pair[keys[language]] = row.candidate;
      pair.reviewStatus = 'machine-draft';
    }
  }
  return expected;
}

export function registerVegetablesL3CompletionTests() {
  test('reviewed L3 leaves preserve exact source/current edges and every unlisted native field', () => {
    assert.equal(createHash('sha256').update(read('root-reviewed-candidates.json')).digest('hex'),
      'd02929530d7797935e0da7dadb98716851ea17131aa0fe6def4984905823e51a',
      '6 October root accepted both final staple repairs; prior independent input remains separately archived');
    assert.equal(packet.candidates.length, 34);
    assert.equal(packet.candidates.filter((row: any) => row.candidate !== row.currentTarget).length, 30);
    for (const language of ['st', 've', 'ts'] as const) {
      assert.deepEqual(vegetablesL3BeforeCompletion(language, drafts[language]), baseline[language],
        `${language}: rewinding only 30 documented target/status leaves restores the entire prior module`);
      // 6 October: validate the complete later twelve-span layer before this historical unchanged-body claim.
      assert.deepEqual(lessonAt(vegetablesBeforeL3Ordinary(language, drafts[language])).body, lessonAt(baseline[language]).body,
        `${language}: all sixteen body paragraphs, technical holds and localized prefixes are unchanged`);
      assert.deepEqual(lessonAt(drafts[language]).quiz.map((q: any) => q.sourceCorrectIndex), [1, 1]);
      assert.equal(resolveLearnerLessonPresentation(source, language).status, 'draft');
    }
  });

  test('changed L3 source leaves and answer positions withdraw stale drafts instead of inheriting new guidance', () => {
    for (const row of packet.candidates) {
      const changed = structuredClone(source);
      const path = parts(contentPath(row.fieldPath));
      const parent: any = path.slice(0, -1).reduce((value: any, key: string) => value[key], changed);
      parent[path.at(-1)!] += ' Changed source condition.';
      const shown = resolveLearnerLessonPresentation(changed, row.language);
      assert.equal(shown.status, 'english-fallback', `${row.id}: literal source guard must notice drift`);
      assert.equal(get(shown.content, contentPath(row.fieldPath)), get(changed, contentPath(row.fieldPath)));
    }
    for (const language of ['st', 've', 'ts'] as const) for (const index of [0, 1]) {
      const changed = structuredClone(source); changed.quiz[index].correct = 0;
      assert.equal(resolveLearnerLessonPresentation(changed, language).status, 'english-fallback',
        `${language}/quiz${index}: unchanged B,B cannot follow an edited correct index`);
    }
  });

  test('staple identity, grain/vine/pole and half below ground cannot broaden to important crops or reverse the diagram', () => {
    for (const language of ['ve', 'ts'] as const) {
      const shown = resolveLearnerLessonPresentation(source, language).content;
      assert.match(shown.infographicAlt!, /staple/);
      assert.match(shown.infographicAlt!, /grain.*vine/);
      assert.match(shown.infographicAlt!, language === 've' ? /kha thanda.*hafu.*fhasi ha mavu/ : /eka nsika.*hafu.*ehansi ka misava/);
      assert.match(shown.quiz[1].q, /staple/);
      assert.match(shown.quiz[1].options[3], /staple/);
      assert.doesNotMatch(shown.quiz[1].q, /tshimela tsha vhuthogwa/);
      assert.doesNotMatch(shown.quiz[1].options[3], /tshimela tsha vhuthogwa/);
      assert.match(shown.quiz[1].options[3], language === 've' ? /fhedzi.*miṅwaha.*muthihi/ : /ntsena.*ku hundza lembe rin’we/);
      assert.deepEqual(shown.quiz.map(q => q.correct), [1, 1]);
    }
  });

  test('limited drought tolerance follows root formation and early water need while young leaves remain age specific', () => {
    const patterns = { st: /drought tolerance e itseng ka mora hore storage roots di bopehe.*metsi qalong.*young leaves/,
      ve: /drought tolerance nyana nga murahu ha musi storage roots dzo no vhumbea.*maḓi mathomoni.*young leaves/,
      ts: /drought tolerance nyana endzhaku ka loko storage roots ti vumbekile.*mati eku sunguleni.*young leaves/ };
    for (const language of ['st', 've', 'ts'] as const) {
      const target = resolveLearnerLessonPresentation(source, language).content.keyPoints[2];
      assert.match(target, patterns[language]);
      assert.doesNotMatch(target, /new leaves|all leaves|drought.proof/i);
    }
  });

  test('seed possibility, future negatives, always, no cultivation and wetter-than-maize comparisons remain bounded', () => {
    for (const language of ['ve', 'ts'] as const) {
      // 6 October: this earlier English niche assertion follows full accepted18 current validation.
      const shown = vegetablesAssessmentPresentationBeforeOrdinary(source, language).content;
      assert.match(shown.quiz[0].rationale, language === 've' ? /i nga mela.*zwi nga fhambana.*stable.*pollination.*u fhira/ : /yi nga mela.*swi nga hambana.*stable.*pollination.*ku hundza/);
      assert.match(shown.quiz[0].options[1], language === 've' ? /a i nga ḓo breed true.*a zwi nga ḓo fana/ : /a yi nge breed true.*a swi nge fani/);
      assert.match(shown.quiz[0].options[2], language === 've' ? /i dzulela u vha more drought-tolerant/ : /^Open-pollinated maize is always more drought-tolerant$/);
      assert.match(shown.quiz[1].options[1], language === 've' ? /u fhira ane maize ya konḓelela.*tsini ha lwanzhe.*mvula nnzhi/ : /ku hundza leyi maize yi yi tiyiselaka.*kusuhi ni lwandle.*mpfula yo tala/);
      assert.match(shown.quiz[1].options[2], language === 've' ? /^A i ṱoḓi cultivation na luthihi$/ : /^A yi lavi cultivation nikatsongo$/);
      assert.equal(shown.quiz[1].rationale, source.quiz[1].rationale,
        'exact English preserves would struggle, the niche and other staples not handling it well');
    }
  });

  test('all 48 existing whole-paragraph slide reuses and their independently localized prefixes remain byte exact', () => {
    assert.equal(plan.checkedLearnerParagraphReuses.length, 48);
    for (const file of plan.pairedFiles) {
      const language = file.path.match(/vegetables-staples\.(st|ve|ts)\.paired-draft\.json$/)?.[1] as Language | undefined;
      assert.ok(language, `${file.path}: historical paired deck language is explicit`);
      const live = JSON.parse(readFileSync(new URL('../' + file.path, import.meta.url), 'utf8'));
      const prior = vegetablesDeckBeforePestPrecision(language, live);
      const priorBytes = `${JSON.stringify(prior, null, 2)}\n`;
      assert.equal(createHash('sha256').update(priorBytes).digest('hex'), file.sha256,
        `${file.path}: unchanged headings, target schemas, source cards and unlisted slots need no rerender`);
    }
    for (const row of plan.checkedLearnerParagraphReuses) {
      assert.equal(source.body.split('\n\n')[row.canonicalLearnerParagraphIndex], row.sourceEnglish);
      assert.equal(vegetablesL3PresentationBeforeOrdinary(source, row.language).content.body.split('\n\n')[row.canonicalLearnerParagraphIndex], row.currentDeckTarget);
      assert.equal(row.learnerTarget, row.currentDeckTarget);
      assert.equal(row.action, 'preserve-identical-existing-cell');
    }
  });
}
