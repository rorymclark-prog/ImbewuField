import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_PLANT_GUILDS_DRAFT } from '../lib/course-translation-drafts-st-plant-guilds.ts';
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
  checkSouthAfricanSesotho,
  checkSupportPlantTerms,
  checkThinningKept,
  draftText,
  sourceDraftPairs,
} from './regional-full-draft-checks.ts';

// Rewritten 2 October 2026: Plant Selection & Guilds is now a complete Sesotho draft, so the old list of
// exact-English holds and the pins on individual sentences give way to complete-draft checks. Species,
// "support plant" (including bare "support" meaning these plants), "thinning", numbers, quiz order and
// correct answers stay exact; source drift still withdraws the draft.
test('Plant Selection & Guilds Sesotho draft translates every field and keeps species, support plants and quiz answers', () => {
  const source = COURSE_MODULES.find(module => module.id === 'plant-guilds');
  assert.ok(source, 'the canonical Plant Selection & Guilds module must remain available');
  const draft = SESOTHO_PLANT_GUILDS_DRAFT;
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  checkCompleteModuleDraft(source, draft, 'st', FOREST_GUILD_FORBIDDEN_WORDS.st);

  const pairs = sourceDraftPairs(draft, 'st');
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  for (const [english, text] of pairs) {
    assert.deepEqual(placeholders(text), placeholders(english), `"${english}": placeholders unchanged`);
  }
  assert.ok(checkNamesVerbatim(pairs, FOREST_GUILD_NAMES, 'Sesotho Plant Guilds') >= 19, 'every species mention checked');
  assert.ok(checkSupportPlantTerms(pairs, 'Sesotho Plant Guilds') >= 21, 'every support-plant mention checked');
  assert.ok(checkThinningKept(pairs, 'Sesotho Plant Guilds') >= 6, 'every thinning mention checked');
  assert.ok(checkKeptTerms(pairs, FOREST_GUILD_KEPT_TERMS, 'Sesotho Plant Guilds') >= 61, 'every kept technical term checked');
  checkSouthAfricanSesotho(pairs, 'Sesotho Plant Guilds');
  assert.ok(checkGlossedWords(pairs, 'Sesotho Plant Guilds') >= 15, 'insects, pests, bacteria and pods glossed at each mention');

  const [nitrogen, insects, guild] = draft.lessons.map(lesson => draftText(lesson.body, 'st').split('\n\n'));
  assertKeepsTerms(nitrogen[0], ['nitrogen', 'legume'], 'rhizobia convert nitrogen for the legume');
  assertKeepsTerms(nitrogen[6], ['Sesbania punicea', 'red sesbania'], 'the invasive species is named exactly');
  assertKeepsTerms(nitrogen[7], ['Sesbania sesban'], 'the project species-list restriction names the plant');
  assertKeepsTerms(insects[4], ['Bocking 14', 'viable seed'], 'Bocking 14 does not spread by viable seed');
  assertKeepsTerms(insects[8], ['Tulbaghia violacea'], 'wild garlic is named exactly');
  assertKeepsTerms(guild[6], ['support plant', 'thinning', 'chop-and-drop'], 'thinning through chop-and-drop');

  const sweetPotato = draft.lessons[2].quiz[1];
  assert.equal(sweetPotato.sourceCorrectIndex, 2);
  assert.equal(sweetPotato.options[2].sourceEnglish, source.lessons[2].quiz[1].options[2],
    'the keyed answer is still the comparison of food and cover benefits with competition');
  assertKeepsTerms(draftText(sweetPotato.question, 'st'), ['sweet potato', 'mulch'], 'the question names both choices');

  const shown = resolveLearnerLessonPresentation(source.lessons[0], 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draftText(draft.lessons[0].body, 'st'));
  assert.equal(resolveLearnerLessonPresentation({ ...source.lessons[0], body: `${source.lessons[0].body} ` }, 'st').status,
    'english-fallback', 'even whitespace drift in the English withdraws the draft');
  assert.deepEqual(resolveDeckLang(source.id, 'st'), { lang: 'st', exact: true },
    'the silent Sesotho deck pairs its unreviewed text with the exact English source');
  assert.deepEqual(resolveNarrationLang(source.id, 'st'), { lang: 'en', exact: false },
    'narration stays optional English; no regional audio is published');
});
