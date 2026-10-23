import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { XITSONGA_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-ts-small-livestock.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { assertKeeps, checkAnimalNames, checkCompleteModuleDraft, FORBIDDEN_WORDS, sourceDraftPairs } from './regional-full-draft-checks.ts';

const sourceModule = COURSE_MODULES.find(module => module.id === 'small-livestock')!;
const body = (lesson: number, paragraph: number) =>
  XITSONGA_SMALL_LIVESTOCK_DRAFT.lessons[lesson].body.xitsongaDraft.split('\n\n')[paragraph];

// Rewritten 2 October 2026: the edition grew from two drafted L2 sentences (everything else held in English)
// to every lesson, key point, quiz and explanation, so the old pins on English holds give way to complete-draft
// checks. The module title keeps its earlier wording; the description now names ducks as masekwa.
test('Xitsonga Small Livestock drafts the module card and every lesson, with animal names checked separately', () => {
  const draft = XITSONGA_SMALL_LIVESTOCK_DRAFT;
  checkCompleteModuleDraft(sourceModule, draft, 'ts', FORBIDDEN_WORDS.ts);
  assert.ok(checkAnimalNames(sourceDraftPairs(draft, 'ts'), 'ts', 'Xitsonga Small Livestock') >= 30);
  assert.equal(draft.title.xitsongaDraft, 'Ku Hlanganisa Swifuwo Leswitsongo');
  assert.ok(draft.description.xitsongaDraft.includes('masekwa (ducks)'), 'the duck name is glossed on the module card');
  assert.deepEqual(draft.holds, [], 'no passage is held in English');
});

test('Small Livestock Xitsonga card resolves only against its exact module source pair', () => {
  const shown = resolveCourseModulePresentation(sourceModule, 'ts');
  assert.deepEqual(shown, {
    title: XITSONGA_SMALL_LIVESTOCK_DRAFT.title.xitsongaDraft,
    description: XITSONGA_SMALL_LIVESTOCK_DRAFT.description.xitsongaDraft,
    status: 'draft',
  });
  assert.equal(resolveCourseModulePresentation({ ...sourceModule, description: `${sourceModule.description} Changed.` }, 'ts').status,
    'english-fallback');
});

test('Small Livestock Xitsonga source drift returns any lesson to English', () => {
  for (const lesson of sourceModule.lessons) {
    assert.equal(resolveLearnerLessonPresentation(lesson, 'ts').status, 'draft', `${lesson.id} shows its labelled draft`);
    const changedSource: Lesson = { ...lesson, body: `${lesson.body}\nChanged.` };
    const shown = resolveLearnerLessonPresentation(changedSource, 'ts');
    assert.equal(shown.status, 'english-fallback');
    assert.equal(shown.content.body, changedSource.body);
  }
});

test('Small Livestock Xitsonga keeps every scope, factor and safety condition in the translated prose', () => {
  assertKeeps(body(1, 0), ['tinxaka (varieties)', 'pollination', 'a yi tiyisekisi', 'xiyimo xa moya (weather)', 'mati',
    'rihanyo ra swimilana', "pollinators tin'wana", 'avocado'], 'a hive does not guarantee yields; other factors matter');
  assertKeeps(body(1, 1), ['a hi nkongomiso', 'demarcation line', 'ku nga si fambisiwa tinyoxi'],
    'natural ranges are not a movement guide; check the rules before moving bees');
  assertKeeps(body(0, 0), ['a ku tekeli ndhawu'], 'foraging does not replace a balanced diet or daily care');
  assertKeeps(body(0, 1), ['yi nga si'], 'move the pen before the ground is bare, muddy or covered in manure');
  assertKeeps(body(0, 2), ['ekule na swimilana leswintshwa', 'Mavi lamantshwa ma nga rhwala germs',
    'loko ku nga si va ku byariwa', 'Masekwa (ducks)'], 'seedlings, fresh-manure germs, before the next crop, ducks');
  assertKeeps(body(2, 0), ['hi ku helela ku nga si tirhisiwa'], 'compost manure fully before using it near food crops');
  assertKeeps(body(2, 1), ['U nga titshegi'], 'do not rely on guinea fowl for tick protection');
  assertKeeps(body(2, 3), ['a hi ku tekela ndhawu loku tiyisekisiweke', 'U nga yimisi vutshunguri'],
    'chickens are not proven goat worm control; do not stop treatment');
});
