import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-st-food-forest.ts';
import { SESOTHO_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-st-small-livestock.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { resolveDeckLang } from '../lib/course-deck.ts';
import { resolveNarrationLang } from '../lib/course-audio.ts';
import {
  FOREST_GUILD_FORBIDDEN_WORDS,
  FOREST_GUILD_KEPT_TERMS,
  FOREST_GUILD_NAMES,
  assertKeeps,
  assertKeepsTerms,
  checkCompleteLessonDraft,
  checkCompleteModuleDraft,
  checkKeptTerms,
  checkNamesVerbatim,
  checkSouthAfricanSesotho,
  checkSupportPlantTerms,
  checkThinningKept,
  draftText,
  sourceDraftPairs,
} from './regional-full-draft-checks.ts';

// Rewritten 2 October 2026: Food Forest is now a complete Sesotho draft (card, every lesson field and
// both quizzes in all three lessons), so the old pins on a few translated sentences and on the English
// holds give way to complete-draft checks. Species names, "support plant", "thinning", numbers, quiz
// order and correct answers still have to stay exact, and source drift still withdraws the draft.
test('Food Forest Sesotho draft translates every field and keeps species, support plants and quiz answers', () => {
  const source = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(source, 'the canonical Food Forest module must remain available');
  const draft = SESOTHO_FOOD_FOREST_DRAFT;
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  checkCompleteModuleDraft(source, draft, 'st', FOREST_GUILD_FORBIDDEN_WORDS.st);

  const pairs = sourceDraftPairs(draft, 'st');
  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  for (const [english, text] of pairs) {
    assert.doesNotMatch(text, nonLatin, `"${english}": the Sesotho draft uses Latin script`);
    assert.deepEqual(placeholders(text), placeholders(english), `"${english}": placeholders unchanged`);
  }
  assert.ok(checkNamesVerbatim(pairs, FOREST_GUILD_NAMES, 'Sesotho Food Forest') >= 41, 'every species mention checked');
  assert.ok(checkSupportPlantTerms(pairs, 'Sesotho Food Forest') >= 6, 'support plants and suitable supports checked');
  assert.ok(checkThinningKept(pairs, 'Sesotho Food Forest') >= 3, 'every thinning mention checked');
  assert.ok(checkKeptTerms(pairs, FOREST_GUILD_KEPT_TERMS, 'Sesotho Food Forest') >= 33, 'every kept technical term checked');
  checkSouthAfricanSesotho(pairs, 'Sesotho Food Forest');
  assert.doesNotMatch(source.lessons[0].infographicAlt ?? '', /root crops|seven layers/i,
    'the pictured woody roots and overlapping plant heights cannot support an exact crop or layer count');
  assert.deepEqual(resolveDeckLang(source.id, 'st'), { lang: 'st', exact: true },
    'the silent Sesotho deck pairs its unreviewed text with the exact English source');
  assert.deepEqual(resolveNarrationLang(source.id, 'st'), { lang: 'en', exact: false },
    'narration stays optional English; no regional audio is published');
});

// Rewritten 2 October 2026: the site-care lesson is translated in full instead of holding its material,
// pruning and timing guidance in English. The conditions that guidance depends on must survive: support
// plants and thinning stay named in English, cardboard stays under the mulch, and no year is promised.
test('Sesotho Food Forest site-care draft keeps its support-plant, cardboard, thinning and timing conditions', () => {
  const source = COURSE_MODULES.find(module => module.id === 'food-forest')!;
  const lesson = source.lessons.find(item => item.id === 'food-forest-l3')!;
  const draft = SESOTHO_FOOD_FOREST_DRAFT.lessons.find(item => item.id === lesson.id)!;
  checkCompleteLessonDraft(lesson, draft, 'st');
  const paragraphs = draftText(draft.body, 'st').split('\n\n');
  assertKeepsTerms(paragraphs[1], ['support plants'], 'temporary support plants stay named as support plants');
  assertKeepsTerms(paragraphs[4], ['cardboard', 'mulch'], 'plain cardboard under suitable mulch');
  assertKeepsTerms(paragraphs[8], ['support plants', 'thinning', 'mulch'], 'prune or thin support plants; cuttings as mulch');
  assertKeepsTerms(draftText(draft.quiz[1].question, 'st'), ['thinning', 'support plants'], 'the pruning-or-thinning question');
});

// Rewritten 2 October 2026: the chicken lesson is now a complete Sesotho draft, so the old pins on six
// held English sentences and English key points/quizzes give way to field-by-field draft checks that
// still require every animal-care, manure and food-crop condition to survive translation.
test('Sesotho chicken lesson drafts every field and keeps the animal-care, manure and food-crop conditions', () => {
  const source = COURSE_MODULES.find(module => module.id === 'small-livestock');
  assert.ok(source);
  const lesson = source.lessons.find(item => item.id === 'small-livestock-l1');
  assert.ok(lesson);
  const draft = SESOTHO_SMALL_LIVESTOCK_DRAFT.lessons[0];

  assert.equal(SESOTHO_SMALL_LIVESTOCK_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(SESOTHO_SMALL_LIVESTOCK_DRAFT.title.sourceEnglish, source.title);
  assert.equal(SESOTHO_SMALL_LIVESTOCK_DRAFT.description.sourceEnglish, source.description);
  assert.match(lesson.infographicAlt ?? '', /darker scratched patch/);
  assert.doesNotMatch(lesson.infographicAlt ?? '', /enriched|fertilized|root crop/i,
    'the image description must not claim a soil result the picture cannot show');
  checkCompleteLessonDraft(lesson, draft, 'st');
  assert.doesNotMatch(draftText(draft.infographicAlt!, 'st'), /monono|nontsha/i,
    'the Sesotho image description makes no soil-fertility claim either');

  const [foraging, tractor, safety] = draftText(draft.body, 'st').split('\n\n');
  assertKeeps(foraging, ['ha ho nke sebaka'], 'foraging does not replace feed, water, shelter or care');
  assertKeeps(tractor, ['Le suthise pele', 'Ha ho palo e le nngwe'], 'move before damage; no single bird number');
  assertKeeps(safety, ['hole le dimela tse nyenyane', 'Manyolo a matjha a ka jara', 'pele ho sejalo se latelang',
    'Dipidipidi (ducks)'], 'seedlings, fresh-manure germs, before the next crop, ducks named as ducks');
  assertKeeps(draftText(draft.keyPoints[2], 'st'), ['kamora kotulo', 'le ka mohla'], 'only after harvest, never near seedlings');

  const card = resolveCourseModulePresentation(source, 'st');
  assert.equal(card.status, 'draft');
  assert.equal(card.title, SESOTHO_SMALL_LIVESTOCK_DRAFT.title.sesothoDraft);
  assert.equal(resolveCourseModulePresentation({ ...source, title: `${source.title} Changed.` }, 'st').status,
    'english-fallback');
  assert.deepEqual(resolveDeckLang(source.id, 'st'), { lang: 'st', exact: true },
    'the silent Sesotho Small Livestock deck pairs its unreviewed text with the exact English source');
  assert.deepEqual(resolveNarrationLang(source.id, 'st'), { lang: 'en', exact: false });
});

// Rewritten 2 October 2026: the bee lesson is now a complete Sesotho draft. Movement rules, hive siting,
// registration and swarm inspection are translated with their conditions instead of held in English;
// the Department, demarcation line and other technical names stay in English inside the Sesotho.
test('Sesotho bee lesson drafts every field and keeps movement rules, registration and swarm conditions', () => {
  const source = COURSE_MODULES.find(module => module.id === 'small-livestock');
  assert.ok(source);
  const lesson = source.lessons.find(item => item.id === 'small-livestock-l2');
  assert.ok(lesson);
  const draft = SESOTHO_SMALL_LIVESTOCK_DRAFT.lessons.find(item => item.id === lesson.id);
  assert.ok(draft, 'the L2 source-paired draft must be present');

  checkCompleteLessonDraft(lesson, draft, 'st');
  assert.match(draftText(draft.title, 'st'), /^Dinotshi \(bees\)/,
    'South African Sesotho spelling for the Free State/QwaQwa edition, with the English animal name beside it');
  const [pollination, ranges, care] = draftText(draft.body, 'st').split('\n\n');
  assertKeeps(pollination, ['Hive ha e netefatse', 'pollination', 'avocado'], 'a hive does not guarantee yields');
  assertKeeps(ranges, ['ha di a lokela ho sebediswa e le tataiso', 'demarcation line', 'pele o fallisa dinotshi'],
    'natural ranges are not a movement guide; check the rules before moving bees');
  assertKeeps(care, ['pele o fumana hive', 'se tla pele', 'ha di bontshe', 'ngodiso', 'Department', 'e seng diagnosis'],
    'learn first, safety first, active bees prove nothing, registration, crowding is not a diagnosis');

  const l3Source = source.lessons.find(item => item.id === 'small-livestock-l3');
  assert.ok(l3Source);
  const l3Draft = SESOTHO_SMALL_LIVESTOCK_DRAFT.lessons.find(item => item.id === l3Source.id);
  assert.ok(l3Draft);
  assert.equal(resolveLearnerLessonPresentation(l3Source, 'st').status, 'draft');
  assert.equal(l3Draft.body.sourceEnglish, l3Source.body);
});
