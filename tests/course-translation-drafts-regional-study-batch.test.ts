import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-st-food-forest.ts';
import { XITSONGA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ts-food-forest.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ve-food-forest.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { TSHIVENDA_PLANT_GUILDS_DRAFT } from '../lib/course-translation-drafts-ve-plant-guilds.ts';
import { resolveDeckLang } from '../lib/course-deck.ts';
import { resolveNarrationLang } from '../lib/course-audio.ts';
import {
  FOREST_GUILD_FORBIDDEN_WORDS,
  FOREST_GUILD_KEPT_TERMS,
  FOREST_GUILD_NAMES,
  assertKeepsTerms,
  checkCompleteLessonDraft,
  checkCompleteModuleDraft,
  checkGlossedWords,
  checkKeptTerms,
  checkNamesVerbatim,
  checkSupportPlantTerms,
  checkThinningKept,
  draftText,
  sourceDraftPairs,
} from './regional-full-draft-checks.ts';

const sourceModule = (moduleId: string) => {
  const module = COURSE_MODULES.find(item => item.id === moduleId);
  assert.ok(module, `canonical ${moduleId} module is available`);
  return module;
};
const sourceLesson = (moduleId: string, lessonId: string) => {
  const lesson = sourceModule(moduleId).lessons.find(item => item.id === lessonId);
  assert.ok(lesson, `canonical ${lessonId} lesson is available`);
  return lesson;
};

// Rewritten 2 October 2026: the planning-layers lesson is now drafted in every field instead of nine
// selected paragraphs, so the pin on one sentence becomes a complete-lesson check. The layer terms and
// the frost-tolerance and leaf-litter conditions keep their English technical terms.
test('Sesotho Food Forest planning layers are a complete source-paired draft visible in Study', () => {
  const source = sourceLesson('food-forest', 'food-forest-l1');
  const draft = SESOTHO_FOOD_FOREST_DRAFT.lessons.find(item => item.id === source.id);
  assert.ok(draft);
  checkCompleteLessonDraft(source, draft, 'st');
  const paragraphs = draftText(draft.body, 'st').split('\n\n');
  assert.equal(paragraphs.length, source.body.split('\n\n').length,
    'the translated paragraphs must not shift later planting safeguards');
  assertKeepsTerms(paragraphs[4], ['canopy', 'herbaceous'], 'the layer names');
  assertKeepsTerms(paragraphs[9], ['frost tolerance'], 'check identity and frost tolerance first');
  assertKeepsTerms(paragraphs[11], ['leaf litter'], 'shade and leaf litter change conditions');
});

// Rewritten 2 October 2026: Tshivenda L1 used to pair three selected paragraphs; every paragraph, key
// point and quiz field is now a labelled draft, still withdrawn when the English changes.
test('Tshivenda Food Forest L1 is a complete source-paired draft and falls back after source drift', () => {
  const source = sourceLesson('food-forest', 'food-forest-l1');
  const draft = TSHIVENDA_FOOD_FOREST_DRAFT.lessons.find(item => item.id === source.id);
  assert.ok(draft);
  checkCompleteLessonDraft(source, draft, 've');
  const paragraphs = draftText(draft.body, 've').split('\n\n');
  assertKeepsTerms(paragraphs[9], ['frost tolerance'], 'check identity and frost tolerance first');
  assertKeepsTerms(paragraphs[11], ['leaf litter'], 'shade and leaf litter change conditions');
  assertKeepsTerms(paragraphs[12], ['thinning'], 'prune, thin or adjust lower planting');
});

test('Tshivenda market records pair the customer-use sentence while prices and advice stay held', () => {
  const source = sourceLesson('market-community', 'market-community-l1');
  const draft = TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === source.id);
  assert.ok(draft);
  const sourceParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.tshivendaDraft.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  assert.equal(draftParagraphs[1],
    'U ṅwala nḓila dzo fhambanaho dza u shumisa zwibveledzwa zwi ni thusa u vhona zwine bulasi ḽa bveledza na zwine zwa swika kha vharengi.');
  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.tshivendaDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...source, body: `${source.body} changed` }, 've').status,
    'english-fallback');
});

// Rewritten 2 October 2026: Xitsonga Food Forest is now a complete draft (it used to cover two L2
// paragraphs and one L3 sentence, with everything else held in English), so the hold pins give way to a
// complete-module check with species, support plants, thinning and quiz answers kept exact.
test('Xitsonga Food Forest draft translates every field and keeps species, support plants and quiz answers', () => {
  const source = sourceModule('food-forest');
  const draft = XITSONGA_FOOD_FOREST_DRAFT;
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.deepEqual(draft.holds, [], 'no passage is held in English');
  checkCompleteModuleDraft(source, draft, 'ts', FOREST_GUILD_FORBIDDEN_WORDS.ts);
  const pairs = sourceDraftPairs(draft, 'ts');
  assert.ok(checkNamesVerbatim(pairs, FOREST_GUILD_NAMES, 'Xitsonga Food Forest') >= 41, 'every species mention checked');
  assert.ok(checkSupportPlantTerms(pairs, 'Xitsonga Food Forest') >= 6, 'support plants and suitable supports checked');
  assert.ok(checkThinningKept(pairs, 'Xitsonga Food Forest') >= 3, 'every thinning mention checked');
  assert.ok(checkKeptTerms(pairs, FOREST_GUILD_KEPT_TERMS, 'Xitsonga Food Forest') >= 33, 'every kept technical term checked');
  assert.deepEqual(resolveDeckLang(source.id, 'ts'), { lang: 'ts', exact: true });
  assert.deepEqual(resolveNarrationLang(source.id, 'ts'), { lang: 'en', exact: false },
    'narration stays optional English; no regional audio is published');
});

// Rewritten 2 October 2026: the species lesson used to hold everything but two paragraphs in English.
test('Xitsonga Food Forest species lesson keeps frost, the approved species list and habitat terms', () => {
  const source = sourceLesson('food-forest', 'food-forest-l2');
  const draft = XITSONGA_FOOD_FOREST_DRAFT.lessons.find(item => item.id === source.id);
  assert.ok(draft, 'Study needs a registered source-paired Xitsonga L2 lesson');
  checkCompleteLessonDraft(source, draft, 'ts');
  const paragraphs = draftText(draft.body, 'ts').split('\n\n');
  assertKeepsTerms(paragraphs[1], ['Mango', 'Quince', 'winter chilling'], 'frost damage and winter chilling');
  assertKeepsTerms(paragraphs[4], ['approved local species list'], 'check each plant against the approved list');
  assertKeepsTerms(paragraphs[9], ['indigenous', 'habitat'], 'indigenous plants can support habitat');
  assertKeepsTerms(paragraphs[10], ['ecosystem'], 'choose for your ecosystem');
});

// Rewritten 2 October 2026: the closing lesson used to translate one sentence and hold uncertain care
// in English. All of it is drafted now, keeping the terms that care depends on.
test('Xitsonga Food Forest closing lesson keeps support plants, cardboard under mulch, thinning and the root zone', () => {
  const source = sourceLesson('food-forest', 'food-forest-l3');
  const draft = XITSONGA_FOOD_FOREST_DRAFT.lessons.find(item => item.id === source.id);
  assert.ok(draft, 'Study needs a source-paired Xitsonga closing lesson');
  checkCompleteLessonDraft(source, draft, 'ts');
  const paragraphs = draftText(draft.body, 'ts').split('\n\n');
  assertKeepsTerms(paragraphs[1], ['support plants'], 'temporary support plants stay named as support plants');
  assertKeepsTerms(paragraphs[4], ['cardboard', 'mulch'], 'plain cardboard under suitable mulch');
  assertKeepsTerms(paragraphs[8], ['support plants', 'thinning', 'mulch'], 'prune or thin support plants; cuttings as mulch');
  assertKeepsTerms(paragraphs[10], ['root zone'], 'check the root zone even when it rains');
  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draftText(draft.body, 'ts'));
});

// Added 2 October 2026: Tshivenda Plant Guilds is a new complete draft, registered for Study and the
// silent deck at the same time.
test('Tshivenda Plant Guilds draft translates every field and keeps species, support plants and quiz answers', () => {
  const source = sourceModule('plant-guilds');
  const draft = TSHIVENDA_PLANT_GUILDS_DRAFT;
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  checkCompleteModuleDraft(source, draft, 've', FOREST_GUILD_FORBIDDEN_WORDS.ve);
  const pairs = sourceDraftPairs(draft, 've');
  assert.ok(checkNamesVerbatim(pairs, FOREST_GUILD_NAMES, 'Tshivenda Plant Guilds') >= 19, 'every species mention checked');
  assert.ok(checkSupportPlantTerms(pairs, 'Tshivenda Plant Guilds') >= 21, 'every support-plant mention checked');
  assert.ok(checkThinningKept(pairs, 'Tshivenda Plant Guilds') >= 6, 'every thinning mention checked');
  assert.ok(checkKeptTerms(pairs, FOREST_GUILD_KEPT_TERMS, 'Tshivenda Plant Guilds') >= 61, 'every kept technical term checked');
  assert.ok(checkGlossedWords(pairs, 'Tshivenda Plant Guilds') >= 15, 'insects, pests, bacteria and pods glossed at each mention');
  const [nitrogen, insects, guild] = draft.lessons.map(lesson => draftText(lesson.body, 've').split('\n\n'));
  assertKeepsTerms(nitrogen[6], ['Sesbania punicea', 'red sesbania'], 'the invasive species is named exactly');
  assertKeepsTerms(insects[4], ['Bocking 14', 'viable seed'], 'Bocking 14 does not spread by viable seed');
  assertKeepsTerms(guild[6], ['support plant', 'thinning', 'chop-and-drop'], 'thinning through chop-and-drop');
  assert.deepEqual(resolveDeckLang(source.id, 've'), { lang: 've', exact: true });
  assert.deepEqual(resolveNarrationLang(source.id, 've'), { lang: 'en', exact: false },
    'narration stays optional English; no regional audio is published');
});
