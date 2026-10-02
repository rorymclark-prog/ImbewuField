// Shared assertions for complete regional Study drafts (Seeds and Small Livestock, 2 October 2026).
// Not a test file: the module tests import it. Every learner-facing field must be a labelled machine
// draft beside its exact English source, with numbers, quiz order and correct answers unchanged, and
// the learner view must fall back to English as soon as any source text drifts.
import assert from 'node:assert/strict';

import type { CourseModule, Lesson } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';

export type RegionalLanguage = 'st' | 'ts' | 've';

const DRAFT_FIELD = { st: 'sesothoDraft', ts: 'xitsongaDraft', ve: 'tshivendaDraft' } as const;

type Pair = { sourceEnglish: string; reviewStatus: string } & Partial<Record<(typeof DRAFT_FIELD)[RegionalLanguage], string>>;
type DraftLesson = {
  id: string;
  title: Pair;
  body: Pair;
  infographicAlt?: Pair;
  keyPoints: Pair[];
  quiz: Array<{ question: Pair; options: Pair[]; sourceCorrectIndex: number; rationale: Pair }>;
};
type DraftModule = { id: string; language: string; reviewStatus: string; title: Pair; description: Pair; lessons: DraftLesson[] };

const numbers = (text: string) => new Set(text.match(/\d+(?:[.,]\d+)?/g) ?? []);
const NUMBER_WORDS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', twelve: '12',
  twenty: '20', thirty: '30', forty: '40', fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90', hundred: '100',
};

/** No number dropped or changed. A draft may repeat a source number (F1 named again instead of "their") or
 * write a number the English spells out ("ten seeds" as 10), but it may not introduce any other number. */
function assertSameNumbers(draft: string, english: string, path: string) {
  const source = numbers(english);
  const spelled = new Set(Object.entries(NUMBER_WORDS)
    .filter(([word]) => new RegExp(`\\b${word}\\b`, 'i').test(english)).map(([, digits]) => digits));
  for (const number of source) assert.ok(numbers(draft).has(number), `${path}: keeps the number ${number}`);
  for (const number of numbers(draft)) {
    assert.ok(source.has(number) || spelled.has(number), `${path}: introduces no new number (${number})`);
  }
}

export const draftText = (pair: Pair, language: RegionalLanguage) => pair[DRAFT_FIELD[language]] ?? '';

/** One field: exact English source, translated (not copied) draft, explicit machine-draft label, same numbers. */
export function checkTranslatedPair(pair: Pair, english: string, language: RegionalLanguage, path: string): string {
  const draft = draftText(pair, language);
  assert.equal(pair.sourceEnglish, english, `${path}: keeps the exact English source`);
  assert.equal(pair.reviewStatus, 'machine-draft', `${path}: translated draft, not an English hold`);
  assert.ok(draft.trim(), `${path}: draft text exists`);
  assert.notEqual(draft.trim(), english.trim(), `${path}: ordinary prose is translated, not left in English`);
  assertSameNumbers(draft, english, path);
  return draft;
}

/** A complete lesson: title, image description, every paragraph, key point, question, option and explanation. */
export function checkCompleteLessonDraft(lesson: Lesson, draft: DraftLesson, language: RegionalLanguage): string[] {
  const path = lesson.id;
  const texts = [checkTranslatedPair(draft.title, lesson.title, language, `${path} title`)];
  if (lesson.infographicAlt) {
    assert.ok(draft.infographicAlt, `${path}: image description draft`);
    texts.push(checkTranslatedPair(draft.infographicAlt, lesson.infographicAlt, language, `${path} image description`));
  }
  assert.equal(draft.body.sourceEnglish, lesson.body, `${path}: body keeps the exact English source`);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = lesson.body.split('\n\n');
  const paragraphs = draftText(draft.body, language).split('\n\n');
  assert.equal(paragraphs.length, sourceParagraphs.length, `${path}: one draft paragraph per source paragraph`);
  paragraphs.forEach((paragraph, index) => {
    assert.notEqual(paragraph.trim(), sourceParagraphs[index].trim(), `${path} paragraph ${index + 1}: no English hold`);
    assertSameNumbers(paragraph, sourceParagraphs[index], `${path} paragraph ${index + 1}`);
  });
  texts.push(...paragraphs);
  assert.equal(draft.keyPoints.length, lesson.keyPoints.length, `${path}: key point count`);
  draft.keyPoints.forEach((point, index) =>
    texts.push(checkTranslatedPair(point, lesson.keyPoints[index], language, `${path} key point ${index + 1}`)));
  assert.equal(draft.quiz.length, lesson.quiz.length, `${path}: quiz count and order`);
  draft.quiz.forEach((question, index) => {
    const source = lesson.quiz[index];
    const at = `${path} quiz ${index + 1}`;
    assert.equal(question.sourceCorrectIndex, source.correct, `${at}: correct answer index unchanged`);
    texts.push(checkTranslatedPair(question.question, source.q, language, `${at} question`));
    assert.equal(question.options.length, source.options.length, `${at}: option count`);
    question.options.forEach((option, optionIndex) =>
      texts.push(checkTranslatedPair(option, source.options[optionIndex], language, `${at} option ${optionIndex + 1}`)));
    texts.push(checkTranslatedPair(question.rationale, source.rationale, language, `${at} explanation`));
  });

  const shown = resolveLearnerLessonPresentation(lesson, language);
  assert.equal(shown.status, 'draft', `${path}: the learner view labels this as an unreviewed draft`);
  assert.equal(shown.content.title, draftText(draft.title, language));
  assert.equal(shown.content.body, draftText(draft.body, language));
  assert.deepEqual(shown.content.keyPoints, draft.keyPoints.map(point => draftText(point, language)));
  assert.deepEqual(shown.content.quiz.map(question => question.q), draft.quiz.map(question => draftText(question.question, language)));
  assert.deepEqual(shown.content.quiz.map(question => question.correct), lesson.quiz.map(question => question.correct),
    `${path}: answered-quiz feedback still uses the canonical correct index`);
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: `${lesson.body} Changed.` }, language).status,
    'english-fallback', `${path}: body drift withdraws the draft`);
  const driftedQuiz = lesson.quiz.map((question, index) => index === 0 ? { ...question, q: `${question.q} Changed?` } : question);
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, quiz: driftedQuiz }, language).status,
    'english-fallback', `${path}: quiz drift withdraws the draft`);
  const movedAnswer = lesson.quiz.map((question, index) =>
    index === 0 ? { ...question, correct: (question.correct + 1) % question.options.length } : question);
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, quiz: movedAnswer }, language).status,
    'english-fallback', `${path}: a changed correct answer withdraws the draft`);
  return texts;
}

/** Every field of a module as [English source, draft] pairs (body split into paragraphs). */
export function sourceDraftPairs(draft: DraftModule, language: RegionalLanguage): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const add = (pair: Pair) => pairs.push([pair.sourceEnglish, draftText(pair, language)]);
  add(draft.title);
  add(draft.description);
  for (const lesson of draft.lessons) {
    add(lesson.title);
    if (lesson.infographicAlt) add(lesson.infographicAlt);
    const english = lesson.body.sourceEnglish.split('\n\n');
    draftText(lesson.body, language).split('\n\n').forEach((paragraph, index) => pairs.push([english[index] ?? '', paragraph]));
    lesson.keyPoints.forEach(add);
    for (const question of lesson.quiz) {
      add(question.question);
      question.options.forEach(add);
      add(question.rationale);
    }
  }
  return pairs;
}

/** A complete module edition: card, every lesson in source order, and words that must never appear. */
export function checkCompleteModuleDraft(
  source: CourseModule,
  draft: DraftModule,
  language: RegionalLanguage,
  forbidden: RegExp[],
): string[] {
  assert.equal(draft.id, source.id);
  assert.equal(draft.language, language);
  assert.equal(draft.reviewStatus, 'machine-draft');
  const texts = [
    checkTranslatedPair(draft.title, source.title, language, `${source.id} module title`),
    checkTranslatedPair(draft.description, source.description, language, `${source.id} module description`),
  ];
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id),
    'every lesson is drafted, in source order');
  source.lessons.forEach((lesson, index) => texts.push(...checkCompleteLessonDraft(lesson, draft.lessons[index], language)));
  for (const text of texts) for (const word of forbidden) assert.doesNotMatch(text, word);

  const card = resolveCourseModulePresentation(source, language);
  assert.equal(card.status, 'draft');
  assert.equal(card.title, draftText(draft.title, language));
  assert.equal(card.description, draftText(draft.description, language));
  assert.equal(resolveCourseModulePresentation({ ...source, description: `${source.description} Changed.` }, language).status,
    'english-fallback', 'module card source drift withdraws the draft');
  return texts;
}

/** Words that must never appear: earlier drafts used them for the wrong animal, the wrong action or a
 * non-word ("frog" for duck, "pollution" for pollination, invented "swarm" verb forms). */
export const FORBIDDEN_WORDS: Record<RegionalLanguage, RegExp[]> = {
  st: [/\bmatata\b/i, /\bdithunya\b/i, /swarma/i, /swarmile/i, /tulafatso/i, /\bmodula\b/i, /kokonyana/i],
  ts: [/\bmasekwe\b/i, /swarma/i, /swarmile/i, /nsindza/i, /yi nga va ni swiluva/i],
  ve: [/\bmuvula\b/i, /nyanḓadza/i, /thyakisa/i, /\byo swarm\b/i, /tshi swarm\b/i, /(?:^|\s)(?:dzi)?huku\b/i, /nyuki/i],
};

const ANIMAL_NAMES: Array<[RegExp, Record<RegionalLanguage, string>]> = [
  [/\bducks?\b/i, { st: 'pidipidi', ts: 'sekwa', ve: 'dakisi' }],
  [/\bchickens?\b|\bhens?\b|\bpoultry\b/i, { st: 'kgoho', ts: 'huku', ve: 'khuhu' }],
  [/\bbees?\b|\bhoney-?bees?\b/i, { st: 'notshi', ts: 'nyoxi', ve: 'ṋotshi' }],
  [/\bgoats?\b/i, { st: 'podi', ts: 'mbuti', ve: 'mbudzi' }],
];
// Fixed English names kept as technical terms or species names; the animal inside them is not a separate mention.
const KEPT_ENGLISH_NAMES = /honey-bee control measures|chicken tractors?|Cape honeybee|African honeybee/gi;

/** Animal names are checked on their own, apart from the translation pass, because an earlier draft
 * turned ducks into frogs: wherever the English names one of these animals, the draft names the same
 * animal. Returns how many mentions were checked so a caller can prove the check ran. */
export function checkAnimalNames(pairs: Array<[string, string]>, language: RegionalLanguage, path: string): number {
  let checked = 0;
  for (const [english, draft] of pairs) {
    const named = english.replace(KEPT_ENGLISH_NAMES, '');
    for (const [pattern, names] of ANIMAL_NAMES) {
      if (!pattern.test(named)) continue;
      checked += 1;
      assert.ok(draft.normalize('NFC').toLowerCase().includes(names[language].normalize('NFC')),
        `${path}: "${english}" must name the same animal (${names[language]}), not a different one`);
    }
  }
  return checked;
}

/** Qualifications such as "before", "do not" and "may" survive translation: each phrase must appear. */
export function assertKeeps(text: string, phrases: string[], path: string) {
  for (const phrase of phrases) {
    assert.ok(text.normalize('NFC').includes(phrase.normalize('NFC')), `${path}: keeps "${phrase}"`);
  }
}

type SlidePart = { status: string; text?: string; provenance?: string; backTranslation?: string };
type PairedSlide = { n: number; english: { heading: string; body: string[] }; target: { heading: SlidePart; body: SlidePart[] } };

/** Every heading and paragraph of a silent regional deck is a visibly unreviewed machine draft with its blind
 * back-translation, the source numbers unchanged and no forbidden word. Returns [English, draft] pairs so a
 * caller can run the separate animal-name check on the slide text as well. */
export function checkCompleteSlideDrafts(slides: PairedSlide[], language: RegionalLanguage, path: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const slide of slides) {
    const parts: Array<[SlidePart, string, string]> = [[slide.target.heading, slide.english.heading, `${path} slide ${slide.n} heading`]];
    slide.target.body.forEach((part, index) => parts.push([part, slide.english.body[index], `${path} slide ${slide.n} paragraph ${index + 1}`]));
    for (const [part, english, at] of parts) {
      const text = part.text ?? '';
      assert.equal(part.status, 'draft', `${at}: translated draft, not an English hold`);
      assert.ok(text.trim() && text.trim() !== english.trim(), `${at}: ordinary prose is translated, not left in English`);
      assert.match(part.provenance ?? '', /unreviewed-machine-draft/, `${at}: visibly unreviewed`);
      assert.ok(part.backTranslation?.trim(), `${at}: keeps its blind back-translation`);
      assertSameNumbers(text, english, at);
      for (const word of FORBIDDEN_WORDS[language]) assert.doesNotMatch(text, word, `${at}: no forbidden word`);
      pairs.push([english, text]);
    }
  }
  return pairs;
}
