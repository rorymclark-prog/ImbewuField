import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-st-small-livestock.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { assertKeeps, checkAnimalNames, checkCompleteModuleDraft, FORBIDDEN_WORDS, sourceDraftPairs } from './regional-full-draft-checks.ts';

// Rewritten 2 October 2026: L3 was a single drafted checklist paragraph with farm guidance held in English.
// The whole Sesotho edition is now drafted, so this checks the module card and every lesson, checks animal
// names on their own (an earlier draft confused ducks with frogs) and requires the L3 manure, tick and
// goat-worm conditions to survive translation.
test('Sesotho Small Livestock drafts the module card and every lesson, with animal names checked separately', () => {
  const source = COURSE_MODULES.find(module => module.id === 'small-livestock');
  assert.ok(source, 'the canonical Small Livestock module must exist');
  const draft = SESOTHO_SMALL_LIVESTOCK_DRAFT;
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  checkCompleteModuleDraft(source, draft, 'st', FORBIDDEN_WORDS.st);
  assert.ok(checkAnimalNames(sourceDraftPairs(draft, 'st'), 'st', 'Sesotho Small Livestock') >= 30);
  assert.ok(draft.description.sesothoDraft.includes('dipidipidi (ducks)'), 'the duck name is glossed on the module card');

  const [manure, guineaFowl, checklist, goats] = draft.lessons[2].body.sesothoDraft.split('\n\n');
  assertKeeps(manure, ['a ka jara', 'ka botlalo pele', 'a kanna a se ke'],
    'fresh manure can carry germs; compost it fully before use near food crops; scraps may not be enough');
  assertKeeps(guineaFowl, ['di kanna tsa ja ticks', 'O se ke wa itshetleha', 'morero wa bophelo bo botle ba diphoofolo'],
    'guinea fowl may eat ticks; do not rely on them; follow an animal-health plan');
  assertKeeps(checklist, ['phoofolo ka nngwe', 'metsi', 'terata (fencing)'], 'water, feed, shelter, fencing and daily care');
  assertKeeps(goats, ['ha se mokgwa o netefaditsweng', 'parasite plan', 'O se ke wa emisa kalafo'],
    'chickens are not proven goat worm control; do not stop treatment');
  assert.equal(resolveCourseModulePresentation({ ...source, durationMins: source.durationMins + 1 }, 'st').status,
    'english-fallback', 'changed module metadata withdraws the paired draft');
});
