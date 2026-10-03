import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { XITSONGA_PLANT_GUILDS_DRAFT } from '../lib/course-translation-drafts-ts-plant-guilds.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveDeckLang } from '../lib/course-deck.ts';
import { resolveNarrationLang } from '../lib/course-audio.ts';
import {
  FOREST_GUILD_FORBIDDEN_WORDS,
  FOREST_GUILD_KEPT_TERMS,
  FOREST_GUILD_NAMES,
  assertKeepsTerms,
  checkCompleteModuleDraft,
  checkGlossedWords,
  checkKeptTerms,
  checkNamesVerbatim,
  checkSupportPlantTerms,
  checkThinningKept,
  draftText,
  sourceDraftPairs,
} from './regional-full-draft-checks.ts';

const sourceModule = COURSE_MODULES.find(module => module.id === 'plant-guilds')!;
const sourceLessonById = new Map(sourceModule.lessons.map(lesson => [lesson.id, lesson]));

// Rewritten 2 October 2026: Plant Guilds is now a complete Xitsonga draft (all three lessons, card, both
// quizzes per lesson), so the old pins on six selected paragraphs, exact-English holds and the hold list
// give way to complete-draft checks. Species, "support plant", "thinning", numbers, quiz order and
// correct answers stay exact, and the hold list is empty because nothing is left in English.
test('Plant Guilds Xitsonga draft translates every field and keeps species, support plants and quiz answers', () => {
  const draft = XITSONGA_PLANT_GUILDS_DRAFT;
  assert.equal(draft.sourceMetadata.durationMins, sourceModule.durationMins);
  assert.equal(draft.sourceMetadata.category, sourceModule.category);
  assert.deepEqual(draft.holds, [], 'no passage is held in English');
  checkCompleteModuleDraft(sourceModule, draft, 'ts', FOREST_GUILD_FORBIDDEN_WORDS.ts);

  const pairs = sourceDraftPairs(draft, 'ts');
  assert.ok(checkNamesVerbatim(pairs, FOREST_GUILD_NAMES, 'Xitsonga Plant Guilds') >= 19, 'every species mention checked');
  assert.ok(checkSupportPlantTerms(pairs, 'Xitsonga Plant Guilds') >= 21, 'every support-plant mention checked');
  assert.ok(checkThinningKept(pairs, 'Xitsonga Plant Guilds') >= 6, 'every thinning mention checked');
  assert.ok(checkKeptTerms(pairs, FOREST_GUILD_KEPT_TERMS, 'Xitsonga Plant Guilds') >= 61, 'every kept technical term checked');
  assert.ok(checkGlossedWords(pairs, 'Xitsonga Plant Guilds') >= 15, 'insects, pests, bacteria and pods glossed at each mention');
  assert.deepEqual(resolveDeckLang(sourceModule.id, 'ts'), { lang: 'ts', exact: true },
    'the silent Xitsonga deck pairs its unreviewed text with the exact English source');
  assert.deepEqual(resolveNarrationLang(sourceModule.id, 'ts'), { lang: 'en', exact: false },
    'narration stays optional English; no regional audio is published');
});

// Rewritten 2 October 2026: lesson 1 used to fall back to English because it had no Xitsonga text. It
// now has a complete draft, so Study shows that draft, labelled unreviewed, beside the English.
test('Plant Guilds lesson 1 shows its labelled Xitsonga draft', () => {
  const lesson = sourceLessonById.get('plant-guilds-l1')!;
  const draft = XITSONGA_PLANT_GUILDS_DRAFT.lessons.find(item => item.id === lesson.id)!;
  const shown = resolveLearnerLessonPresentation(lesson, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.title, draftText(draft.title, 'ts'));
  assert.equal(shown.content.body, draftText(draft.body, 'ts'));
});

// Rewritten 2 October 2026: the legal, biological and management sentences that used to be held in
// English are translated, with the names and technical terms they depend on kept exact in English.
test('Plant Guilds legal, biological and management drafts keep their names and technical terms', () => {
  const [nitrogen, insects, guild] = XITSONGA_PLANT_GUILDS_DRAFT.lessons.map(lesson => draftText(lesson.body, 'ts').split('\n\n'));
  assertKeepsTerms(nitrogen[6], ['Sesbania punicea', 'red sesbania'], 'the invasive species is named exactly');
  assertKeepsTerms(nitrogen[7], ['Sesbania sesban'], 'the project species-list restriction names the plant');
  assertKeepsTerms(insects[4], ['Bocking 14', 'viable seed'], 'Bocking 14 does not spread by viable seed');
  assertKeepsTerms(insects[6], ['ladybirds', 'aphids', 'parasitoid wasps', 'African basil'], 'helpful insects and flowers');
  assertKeepsTerms(insects[8], ['Tulbaghia violacea'], 'wild garlic is named exactly');
  assertKeepsTerms(guild[4], ['mulch'], 'plant into a suitable season and mulch');
  assertKeepsTerms(guild[6], ['support plant', 'thinning', 'chop-and-drop'], 'thinning through chop-and-drop');
  assertKeepsTerms(guild[7], ['thinning'], 'thinning does not instantly stop root competition');
});

test('Plant Guilds source drift sends the affected lesson back to exact English', () => {
  const lesson = sourceLessonById.get('plant-guilds-l2')!;
  const changedSource: Lesson = { ...lesson, body: `${lesson.body}\nChanged.` };
  const shown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.body, changedSource.body);
});
