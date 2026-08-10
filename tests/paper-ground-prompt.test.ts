import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildLockedIllustrationPrompt,
  groundContractFor,
  isPhotoPreservingStyle,
} from '@/lib/producer-prompt';

// THE PLAIN UNDERLAY HAD NO CONTRACT OF ITS OWN, AND IT COST A PAID RENDER.
//
// The prompt has only ever answered "what is under this?" two ways: keep the photograph
// (photo_plan, satellite_overlay) or paint the ground away (everything else). Rory rendered
// AI Polished over the PLAIN underlay — white paper, no photograph anywhere — in the Photo Plan
// style, whose whole contract is "every pixel that is not overlay stays the supplied satellite
// image". There was no satellite image. The model resolved the contradiction by inventing a flat
// khaki ground, and the app then burned the exact artwork back over it, so the only visible thing
// the paid pass did was replace clean white paper with mud.
//
// Rory: "It's a mess tho it didn't look like ai polished anything", and on the next attempt:
// "Even with ChatGPT, it's a hybrid mess."

test('the ground contract is decided by the source, and paper outranks the style', () => {
  // Paper wins even for the two styles that would otherwise promise to keep a photograph — that
  // promise is unkeepable when there is no photograph, and an unkeepable absolute instruction is
  // exactly what this file already documents producing indistinguishable hybrids.
  assert.equal(groundContractFor('photo_plan', 'paper'), 'paper');
  assert.equal(groundContractFor('satellite_overlay', 'paper'), 'paper');
  assert.equal(groundContractFor('homestead_storybook', 'paper'), 'paper');
  // With a photograph present nothing changes: the style decides, exactly as before.
  assert.equal(groundContractFor('photo_plan', 'photo'), 'photo');
  assert.equal(groundContractFor('homestead_storybook', 'photo'), 'paint');
  // And the default keeps every existing caller on its current answer.
  assert.equal(groundContractFor('photo_plan'), 'photo');
  assert.equal(groundContractFor('homestead_storybook'), 'paint');
  assert.equal(isPhotoPreservingStyle('photo_plan'), true, 'the style predicate itself is unchanged');
});

test('on paper the model is told to invent no ground at all', () => {
  const prompt = buildLockedIllustrationPrompt('Planting', 'photo_plan', 'Mango Tree x4', '', 'paper');
  assert.match(prompt, /KEEP THE PAPER WHITE/);
  assert.match(prompt, /PLAIN WHITE PAPER/);
  assert.match(prompt, /EVERY OTHER PIXEL IS STILL WHITE PAPER/);
  // The two clauses that ORDER a painted ground must be absent — they are what produced the khaki.
  assert.doesNotMatch(prompt, /TONAL HIERARCHY/, 'a painted forest context must not be ordered on paper');
  assert.doesNotMatch(prompt, /MATERIAL SEPARATION/, 'gouache ground texture must not be ordered on paper');
  assert.doesNotMatch(prompt, /PAINT WHAT IS THERE/);
  // And it must not promise to preserve a photograph that does not exist.
  assert.doesNotMatch(prompt, /KEEP THE PHOTOGRAPH/);
  assert.doesNotMatch(prompt, /real photographed pixels/);
});

test('a water sheet on paper also loses the ground-painting art direction', () => {
  // The water branch carries its OWN copies of TONAL HIERARCHY and MATERIAL SEPARATION. They were
  // skipped only for photo-preserving styles, so on paper they would have re-opened the exact
  // contradiction the sheet-level branch closes.
  const prompt = buildLockedIllustrationPrompt('Water', 'homestead_storybook', 'JoJo Tank 2500L x1', '', 'paper');
  assert.doesNotMatch(prompt, /TONAL HIERARCHY/);
  assert.doesNotMatch(prompt, /MATERIAL SEPARATION/);
  assert.match(prompt, /KEEP THE PAPER WHITE/);
  assert.match(prompt, /WATER FEATURE ROLE/, 'the water direction itself must survive');
});

test('the photo and painted contracts are byte-for-byte what they were', () => {
  // This change must be invisible to every render that has a photograph under it.
  for (const style of ['photo_plan', 'satellite_overlay', 'homestead_storybook'] as const) {
    assert.equal(
      buildLockedIllustrationPrompt('Planting', style, 'Mango Tree x4', 'brief'),
      buildLockedIllustrationPrompt('Planting', style, 'Mango Tree x4', 'brief', 'photo'),
      `${style} must be unchanged when a photograph is present`,
    );
  }
  const painted = buildLockedIllustrationPrompt('Planting', 'homestead_storybook', 'Mango Tree x4');
  assert.match(painted, /PAINT WHAT IS THERE/);
  assert.match(painted, /TONAL HIERARCHY|MATERIAL SEPARATION|turn this exact saved design composite/);
});

test('the renderer tells the prompt which ground it actually has', () => {
  // satDataUrl is null ONLY on the plain underlay (frameForUnderlay drops it), so it is the honest
  // test for "is there a photograph". A source guard because DesignGlossy imports canvas and React.
  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const calls = [...glossy.matchAll(/buildLockedIllustrationPrompt\([^)]*\)/g)];
  assert.ok(calls.length >= 2, 'both locked-illustration call sites must be accounted for');
  for (const call of calls) {
    assert.match(call[0], /renderFrame\.satDataUrl \? 'photo' : 'paper'/,
      `a locked render is still asking for a photographed ground unconditionally: ${call[0]}`);
  }
});
