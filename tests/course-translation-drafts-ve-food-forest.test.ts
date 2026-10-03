import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ve-food-forest.ts';
import { resolveDeckLang } from '../lib/course-deck.ts';
import { resolveNarrationLang } from '../lib/course-audio.ts';
import {
  FOREST_GUILD_FORBIDDEN_WORDS,
  FOREST_GUILD_KEPT_TERMS,
  FOREST_GUILD_NAMES,
  assertKeepsTerms,
  checkCompleteLessonDraft,
  checkCompleteModuleDraft,
  checkKeptTerms,
  checkNamesVerbatim,
  checkSupportPlantTerms,
  checkThinningKept,
  draftText,
  sourceDraftPairs,
} from './regional-full-draft-checks.ts';

// Rewritten 2 October 2026: Food Forest is now a complete Tshivenda draft. The old tests pinned one L2
// body sentence, three L3 sentences and every other field as an exact-English hold; they now require
// every field to be a labelled machine draft while species, "support plant", "thinning", numbers, quiz
// order and correct answers stay exact, and words a blind reader misread (chopped as "rotted", a tree
// species for a trunk) never appear.
test('Tshivenda Food Forest draft translates every field and keeps species, support plants and quiz answers', () => {
  const source = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(source, 'Food Forest must remain in the canonical Study source');
  const draft = TSHIVENDA_FOOD_FOREST_DRAFT;
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  checkCompleteModuleDraft(source, draft, 've', FOREST_GUILD_FORBIDDEN_WORDS.ve);

  const pairs = sourceDraftPairs(draft, 've');
  assert.ok(checkNamesVerbatim(pairs, FOREST_GUILD_NAMES, 'Tshivenda Food Forest') >= 41, 'every species mention checked');
  assert.ok(checkSupportPlantTerms(pairs, 'Tshivenda Food Forest') >= 6, 'support plants and suitable supports checked');
  assert.ok(checkThinningKept(pairs, 'Tshivenda Food Forest') >= 3, 'every thinning mention checked');
  assert.ok(checkKeptTerms(pairs, FOREST_GUILD_KEPT_TERMS, 'Tshivenda Food Forest') >= 33, 'every kept technical term checked');
  assert.deepEqual(resolveDeckLang(source.id, 've'), { lang: 've', exact: true },
    'the silent Tshivenda deck pairs its unreviewed text with the exact English source');
  assert.deepEqual(resolveNarrationLang(source.id, 've'), { lang: 'en', exact: false },
    'narration stays optional English; no regional audio is published');
});

// Rewritten 2 October 2026: the species and site-care lessons were mostly held in English. Translated in
// full, they must still name the kept technical terms their conditions depend on.
test('Tshivenda Food Forest species and site-care drafts keep their technical terms and conditions', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(sourceModule);
  const [, species, siteCare] = sourceModule.lessons;
  const speciesDraft = TSHIVENDA_FOOD_FOREST_DRAFT.lessons[1];
  const siteCareDraft = TSHIVENDA_FOOD_FOREST_DRAFT.lessons[2];
  checkCompleteLessonDraft(species, speciesDraft, 've');
  checkCompleteLessonDraft(siteCare, siteCareDraft, 've');

  const speciesBody = draftText(speciesDraft.body, 've').split('\n\n');
  assertKeepsTerms(speciesBody[1], ['Mango', 'Quince', 'winter chilling'], 'frost damage and winter chilling');
  assertKeepsTerms(speciesBody[4], ['approved local species list'], 'check each plant against the approved list');
  assertKeepsTerms(speciesBody[9], ['indigenous', 'habitat'], 'indigenous plants can support habitat');
  const careBody = draftText(siteCareDraft.body, 've').split('\n\n');
  assertKeepsTerms(careBody[1], ['support plants'], 'temporary support plants stay named as support plants');
  assertKeepsTerms(careBody[4], ['cardboard', 'mulch'], 'plain cardboard under suitable mulch');
  assertKeepsTerms(careBody[8], ['support plants', 'thinning', 'mulch'], 'prune or thin support plants; cuttings as mulch');
  assertKeepsTerms(careBody[10], ['root zone'], 'check the root zone even when it rains');
});
