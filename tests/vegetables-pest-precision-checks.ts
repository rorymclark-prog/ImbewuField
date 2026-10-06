import { vegetablesBeforeAssessmentOrdinary } from './vegetables-assessment-ordinary-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as st } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';

type Language = 'st' | 've' | 'ts';
const folder = '../docs/study-translation-reviews/vegetables-pest-precision-2026-10-06/';
const read = (name: string) => readFileSync(new URL(folder + name, import.meta.url));
const json = (name: string) => JSON.parse(read(name).toString('utf8'));
const before = json('native-before.json');
const after = json('native-after.json');
const sourceProof = json('canonical-source.json');
const packet = json('accepted-fields.json');
const manifest = json('packet-manifest.json');
const deckProof = json('accepted-deck-rows.json');
const drafts = { st, ve, ts } as const;
const targetKey = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
const sourceModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const sourceLesson = (lessonId: string) => sourceModule.lessons.find(lesson => lesson.id === lessonId)!;
const lessonAt = (draft: any, lessonId = 'vegetables-staples-l4') => draft.lessons.find((lesson: any) => lesson.id === lessonId)!;

const pinnedPacketHashes: Record<string, string> = {
  'native-before.json': 'af700b2581d458cd32824adbcfb74bf9c4d6b158a65b8c6b8f6a8610e9ef3219',
  'native-after.json': 'ca6212171a8731ccaba1830253e480b9d97f2c9622aba1ddf7afd25c3dbd0bb1',
  'canonical-source.json': '7b18e9ebda7209fb46a855fcb525d7aae70a1f63cdcec75ec3d4dfed784c9447',
  'accepted-fields.json': 'b4dd27daaedb61c8935b3ed8da7def304f490115f55886632cc103ce16024796',
  'accepted-deck-rows.json': '3120f2471dfa6ce4e4a653f73ad0591a8117f3ff855fe94d8ed71f5e961b8886',
  'deck-st-before.json': 'fc19541f123be910642ec741761a28516dfd4ef2f14c7e29212bb757cbb92cac',
  'deck-st-after.json': 'f3311a2940f819793f60f657a805245bf48d601db701a9c6992036233382d4b4',
  'deck-ve-before.json': '8d97a9a7c293bd9ac6baba9fd7958b2085f30fe36a0ba9837d0c52a298cc7f60',
  'deck-ve-after.json': 'f1b7f3f56dccf94ac3fb4b6a086e89b248085b654d759d365cd249a0ae45b792',
  'deck-ts-before.json': 'd869fedbd2216ae0313536e5c56372bd46152addf99a8eb07e0b1c200e621585',
  'deck-ts-after.json': '697aa04e6b4665b51f077b261f6e395640087c3b561d615ff4b6cc509e923e70',
};

function paragraphs(pair: any, language: Language): string[] {
  return pair[targetKey[language]].split('\n\n');
}

function sourceRows() {
  return new Map(sourceProof.fields.map((row: any) => [row.fieldId, row.sourceEnglish]));
}

function deckVisible(target: any): string {
  return target.status === 'mixed'
    ? target.segments.map((segment: any) => segment.status === 'draft' ? segment.text : segment.sourceEnglish).join('')
    : target.text;
}

function deckFrom(language: Language, stage: 'before' | 'after') {
  return json(`deck-${language}-${stage}.json`);
}

// Reconstruct only the nine later deck slots after validating their exact current
// source, visible target, segment coverage, and review status.
export function vegetablesDeckBeforePestPrecision<T>(language: Language, actual: T): T {
  const restored: any = structuredClone(actual);
  for (const row of deckProof.rows.filter((item: any) => item.language === language)) {
    const slide = restored.slides[row.slide - 1];
    const slot = slide.target.body[row.bodyIndex];
    assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish, `${language}/slide${row.slide}: current deck source edge`);
    assert.deepEqual(slot, deckFrom(language, 'after').slides[row.slide - 1].target.body[row.bodyIndex],
      `${language}/slide${row.slide}: current deck row matches the accepted complete target`);
    assert.equal(deckVisible(slot), row.recommendedTargetText, `${language}/slide${row.slide}: learner-visible target is exact`);
    if (slot.status === 'mixed') {
      assert.equal(slot.segments.map((segment: any) => segment.sourceEnglish).join(''), row.sourceEnglish,
        `${language}/slide${row.slide}: segment coverage remains exact`);
    }
    const previous = deckFrom(language, 'before').slides[row.slide - 1].target.body[row.bodyIndex];
    assert.equal(previous.status, slot.status, `${language}/slide${row.slide}: review status remains unchanged`);
    slide.target.body[row.bodyIndex] = structuredClone(previous);
  }
  return restored;
}

// Later review batches are applied only after validating the exact frozen target
// and source edge, preserving the earlier whole-module reconstruction checks.
export function vegetablesWithPestPrecisionCompletion<T>(language: Language, previous: T): T {
  const expected: any = structuredClone(previous);
  const lesson = lessonAt(expected);
  for (const row of packet.bodyRows.filter((item: any) => item.language === language)) {
    const pair = lesson.body;
    const index = row.paragraphIndex;
    const source = sourceLesson(row.lessonId).body.split('\n\n')[index];
    const body = paragraphs(pair, language);
    assert.equal(row.sourceEnglish, source, `${row.fieldId}: canonical paragraph remains exact`);
    assert.equal(pair.sourceEnglish.split('\n\n')[index], source, `${row.fieldId}: paired source remains exact`);
    assert.equal(body[index], row.currentTarget, `${row.fieldId}: historical target is the exact before-state`);
    assert.equal(pair.reviewStatus, row.reviewStatus, `${row.fieldId}: body review status is retained`);
    body[index] = row.acceptedTarget;
    pair[targetKey[language]] = body.join('\n\n');
  }
  for (const row of packet.keypointRows.filter((item: any) => item.language === language)) {
    const pair = lessonAt(expected, row.lessonId).keyPoints[row.keyPointIndex];
    assert.equal(pair.sourceEnglish, row.sourceEnglish, `${row.fieldId}: keypoint source remains exact`);
    assert.equal(pair.sourceEnglish, sourceLesson(row.lessonId).keyPoints[row.keyPointIndex]);
    assert.equal(pair[targetKey[language]], row.currentTarget, `${row.fieldId}: historical target is the exact before-state`);
    assert.equal(pair.reviewStatus, row.reviewStatus, `${row.fieldId}: keypoint review status is retained`);
    pair[targetKey[language]] = row.acceptedTarget;
  }
  return expected;
}

export function vegetablesBeforePestPrecision<T>(language: Language, actual: T): T {
  // 6 October: the separate accepted18 quiz layer must pass whole-current guards before this earlier pest rewind.
  const restored: any = vegetablesBeforeAssessmentOrdinary(language, actual);
  if (restored.lessons.every((item: any) => item.id === 'vegetables-staples-l2')) {
    assert.equal(language, 'ts', 'only the separate TS L2 registry has no pest-layer leaves');
    return restored;
  }
  assert.deepEqual(restored, after.drafts[language],
    `${language}: full actual pest-only registry passes its immutable after guard before any pest rewind`);
  const lesson = lessonAt(restored);
  for (const row of packet.bodyRows.filter((item: any) => item.language === language)) {
    const pair = lesson.body;
    const index = row.paragraphIndex;
    const body = paragraphs(pair, language);
    assert.equal(pair.sourceEnglish.split('\n\n')[index], row.sourceEnglish, `${row.fieldId}: current source edge before historical rewind`);
    assert.equal(sourceLesson(row.lessonId).body.split('\n\n')[index], row.sourceEnglish, `${row.fieldId}: current canonical source`);
    assert.equal(body[index], row.acceptedTarget, `${row.fieldId}: current accepted target before historical rewind`);
    assert.equal(pair.reviewStatus, row.reviewStatus);
    body[index] = row.currentTarget;
    pair[targetKey[language]] = body.join('\n\n');
  }
  for (const row of packet.keypointRows.filter((item: any) => item.language === language)) {
    const pair = lessonAt(restored, row.lessonId).keyPoints[row.keyPointIndex];
    assert.equal(pair.sourceEnglish, row.sourceEnglish, `${row.fieldId}: current keypoint source edge before historical rewind`);
    assert.equal(sourceLesson(row.lessonId).keyPoints[row.keyPointIndex], row.sourceEnglish);
    assert.equal(pair[targetKey[language]], row.acceptedTarget, `${row.fieldId}: current accepted target before historical rewind`);
    assert.equal(pair.reviewStatus, row.reviewStatus);
    pair[targetKey[language]] = row.currentTarget;
  }
  assert.deepEqual(restored, before.drafts[language],
    `${language}: rewinding only the accepted pest12 leaves restores the complete prior native snapshot`);
  return restored;
}

export function registerVegetablesPestPrecisionTests() {
  test('Vegetables pest precision applies only nine source-bound paragraphs and three Sesotho keypoints', () => {
    for (const [name, expectedHash] of Object.entries(pinnedPacketHashes)) {
      const actualHash = createHash('sha256').update(read(name)).digest('hex');
      assert.equal(actualHash, expectedHash, `${name}: accepted before/source/after evidence stays immutable`);
      assert.equal(manifest.sha256[name], expectedHash, `${name}: packet manifest records the verified bytes`);
    }
    assert.equal(packet.bodyRows.length, 9);
    assert.deepEqual(Object.fromEntries(['st', 've', 'ts'].map(language => [
      language, packet.bodyRows.filter((row: any) => row.language === language).length,
    ])), { st: 2, ve: 4, ts: 3 });
    assert.equal(packet.keypointRows.length, 3);
    assert.equal(sourceRows().size, 12);

    for (const language of ['st', 've', 'ts'] as const) {
      const current: any = drafts[language];
      const expectedFromBefore = vegetablesWithPestPrecisionCompletion(language, before.drafts[language]);
      assert.deepEqual(expectedFromBefore, after.drafts[language], `${language}: full after snapshot is exactly the authorized layer`);
      assert.deepEqual(vegetablesBeforeAssessmentOrdinary(language, current), expectedFromBefore, `${language}: every unlisted native field and status remains byte-equivalent in structure`);
      const lesson = lessonAt(current);
      const previousLesson = lessonAt(before.drafts[language]);
      assert.equal(lesson.body.reviewStatus, previousLesson.body.reviewStatus);
      assert.equal(lesson.body.sourceEnglish, sourceLesson('vegetables-staples-l4').body);
      assert.equal(paragraphs(lesson.body, language)[10], paragraphs(previousLesson.body, language)[10],
        `${language}: pesticide product, label, protection, harvest-wait and no-mixture instructions are unchanged`);
      assert.deepEqual(lesson.quiz.map((question: any) => question.sourceCorrectIndex),
        previousLesson.quiz.map((question: any) => question.sourceCorrectIndex), `${language}: answer positions remain unchanged`);
      const shown = resolveLearnerLessonPresentation(sourceLesson('vegetables-staples-l4'), language);
      assert.equal(shown.status, 'draft', `${language}: updated learner content remains visibly marked as draft`);
      assert.equal(shown.content.body, lesson.body[targetKey[language]]);
    }

    const sesothoL3 = st.lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!;
    const oldSesothoL3 = before.drafts.st.lessons.find((lesson: any) => lesson.id === 'vegetables-staples-l3');
    assert.deepEqual(sesothoL3.keyPoints.map(point => point.reviewStatus),
      oldSesothoL3.keyPoints.map((point: any) => point.reviewStatus), 'all edited assessment points remain machine drafts');
    assert.equal(sesothoL3.keyPoints[0].sesothoDraft,
      "Open-pollinated maize e o dumella ho boloka peo; hybrid seed won't breed true next season",
      'the genetics clause retains its exact canonical English wording after the Sesotho seed-saving prefix');
    assert.equal(st.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!.keyPoints[2].sesothoDraft,
      'Hloma dijalo tse hlokang head start; jala ka kotloloho dijalo tse sa rateng ho tshwenngwa ha metso');
    assert.equal(st.lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!.keyPoints[3].sesothoDraft,
      'Dimela tse kopantsweng di ntse di ka compete; laola sebaka, nako le metsi');
    assert.equal(sesothoL3.keyPoints[2].sesothoDraft, oldSesothoL3.keyPoints[2].sesothoDraft,
      'the young-leaves age qualifier remains unchanged');
  });

  test('Vegetables pest precision falls back when any edited canonical paragraph or keypoint drifts', () => {
    for (const row of packet.bodyRows) {
      const source = structuredClone(sourceLesson(row.lessonId));
      const sourceParts = source.body.split('\n\n');
      sourceParts[row.paragraphIndex] += ' Changed source condition.';
      source.body = sourceParts.join('\n\n');
      assert.equal(resolveLearnerLessonPresentation(source, row.language).status, 'english-fallback',
        `${row.fieldId}: exact paragraph binding detects source drift`);
      assert.equal(resolveLearnerLessonPresentation(source, row.language).content.body, source.body);
    }
    for (const row of packet.keypointRows) {
      const source = structuredClone(sourceLesson(row.lessonId));
      source.keyPoints[row.keyPointIndex] += ' Changed source condition.';
      assert.equal(resolveLearnerLessonPresentation(source, row.language).status, 'english-fallback',
        `${row.fieldId}: exact assessment binding detects source drift`);
    }
  });

  test('Vegetables pest paired decks preserve exact source coverage, held clauses, and every unlisted slot', () => {
    for (const [name, expectedHash] of Object.entries(pinnedPacketHashes).filter(([name]) => name.startsWith('deck-') || name === 'accepted-deck-rows.json')) {
      assert.equal(createHash('sha256').update(read(name)).digest('hex'), expectedHash,
        `${name}: immutable full-deck before/after evidence`);
      assert.equal(manifest.sha256[name], expectedHash, `${name}: manifest records the checked deck bytes`);
    }
    for (const language of ['st', 've', 'ts'] as const) {
      const path = new URL(`../docs/narration/vegetables-staples.${language}.paired-draft.json`, import.meta.url);
      const actual = JSON.parse(readFileSync(path, 'utf8'));
      const prior = deckFrom(language, 'before');
      const accepted = deckFrom(language, 'after');
      assert.deepEqual(actual, accepted, `${language}: all unlisted deck fields and target slots remain exact`);
      assert.equal(actual.reviewStatus, prior.reviewStatus, `${language}: deck stays in its existing review state`);
      const changed = deckProof.rows.filter((row: any) => row.language === language);
      assert.equal(changed.length, language === 've' ? 4 : language === 'st' ? 2 : 3);
      for (const row of changed) {
        const slide = actual.slides[row.slide - 1];
        const slot = slide.target.body[row.bodyIndex];
        assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish, `${language}/slide${row.slide}: source is byte-exact`);
        assert.equal(deckVisible(slot), row.recommendedTargetText, `${language}/slide${row.slide}: target composition is exact`);
        assert.equal(slot.status, row.currentTarget.status, `${language}/slide${row.slide}: status is preserved`);
        if (slot.status === 'mixed') {
          assert.equal(slot.segments.map((segment: any) => segment.sourceEnglish).join(''), row.sourceEnglish);
          const holds = slot.segments.filter((segment: any) => segment.status === 'english-hold').map((segment: any) => segment.sourceEnglish).join('');
          if (row.slide === 16) {
            for (const held of ['the lightest thing that works.', ' Physical removal', ', barriers']) {
              assert.ok(holds.includes(held), `${language}/slide${row.slide}: retain source English hold ${held}`);
            }
          }
          if (row.paragraphIndex === 1) {
            assert.ok(holds.includes('broad chemical use') && holds.includes('predators'),
              `${language}/slide${row.slide}: retain precise chemical-use and predator terms`);
          }
        }
      }
    }
  });
}
