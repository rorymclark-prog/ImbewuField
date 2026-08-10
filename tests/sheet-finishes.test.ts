import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// TWO FINISHES, AND ONLY TWO. Rory: "I just want an exact version for now and a ai render polished
// version also those 2 because you haven't been able to fix the hybrid properly and messes the ai
// polished version too."
//
// So the picker offers Exact Canvas and ONE paid AI render, and the SECOND paid pass — Full
// Treatment — is shelved: not offered, so nobody spends a render on it, but not deleted either
// ("shelve it but don't delete it I may decide to look at it again later"), so every line of the
// pipeline stays put and every sheet already paid for still opens.
//
// These are source guards because what is being protected is a SHAPE — one free button, one paid
// button, and no second way to spend two renders — which is not observable from a unit call, and is
// exactly the kind of thing a later edit undoes without noticing.

const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');

test('the second paid pass is shelved, and the shelf has an escape hatch', () => {
  assert.match(glossy, /const SECOND_POLISH_PASS_SHELVED = true;/,
    'Full Treatment must stay unadvertised until someone deliberately un-shelves it');
  // Without the hatch, looking at the shelved work again needs a code change and a deploy.
  assert.match(glossy, /aifinish/,
    'the studio must still be openable with the second pass revealed, for review');
});

test('the single AI render is a standing finish and never consults the shelf', () => {
  // THE REGRESSION THIS EXISTS TO STOP. Shelving once took BOTH paid tiers away, which left the
  // studio with no AI finish at all — Rory: "i wanted the hybrid shelved not the ai!!!! i didnt say
  // remoe the ai". The offered finish must be reachable with no query string and no flag.
  const sites = [...glossy.matchAll(/runLockedPolishFlow\('hybrid'\)/g)];
  assert.ok(sites.length >= 2, 'the AI Polished button and the one-tap flip must both be present');
  for (const site of sites) {
    const before = glossy.slice(Math.max(0, site.index! - 900), site.index!);
    assert.doesNotMatch(before, /fullTreatmentVisible/,
      `the offered AI finish must not be gated on the shelf (near index ${site.index})`);
  }
});

test('no second paid pass can be started while shelved, from ANY entry point', () => {
  // EVERY call site, not one per mode: an earlier version of this test looked only at the first
  // match and so missed a third entry point — the one-tap "polish this sheet" flip, which quietly
  // started a TWO-render Full Treatment from a button labelled "1 AI render". A shelf with a door
  // left open is not a shelf, and that leak was invisible until every site was enumerated.
  const sites = [...glossy.matchAll(/runLockedPolishFlow\('full'\)/g)];
  assert.ok(sites.length >= 1, 'every Full Treatment entry point must be accounted for here');
  for (const site of sites) {
    const before = glossy.slice(Math.max(0, site.index! - 900), site.index!);
    assert.match(before, /fullTreatmentVisible/,
      `a second paid pass can be started from an ungated control near index ${site.index}`);
  }
});

test('the one-tap polish spends exactly what its label promises', () => {
  // It reads "1 AI render" and used to start a Full Treatment, which is two. Whatever that button
  // says about cost, it must dispatch the single-render flow.
  const flip = glossy.slice(glossy.indexOf('AI-polish this exact map') - 2600);
  assert.match(flip.slice(0, 2600), /runLockedPolishFlow\('hybrid'\)/,
    'the one-tap polish must run the single paid render');
  assert.doesNotMatch(flip.slice(0, 2600), /runLockedPolishFlow\('full'\)/);
});

test('shelving never hides a sheet a farmer has already paid for', () => {
  // The gallery reads stored results by provenance, and must not consult the shelf flag: a paid
  // Full Treatment sheet rendered last month still opens, downloads and shares after shelving.
  const galleryRegion = glossy.slice(glossy.indexOf('pushGallery'));
  assert.doesNotMatch(galleryRegion.slice(0, 40_000), /SECOND_POLISH_PASS_SHELVED|fullTreatmentVisible/,
    'gallery playback of stored paid renders must be independent of the shelf');
});

test('the shelved pipeline is still present to come back to', () => {
  // Rory: "shelve it but don't delete it I may decide to look at it again later."
  const flow = readFileSync(new URL('../lib/locked-polish-flow.ts', import.meta.url), 'utf8');
  assert.match(flow, /SheetOutputMode/, 'the three-mode flow must survive shelving');
  assert.match(flow, /fullTreatmentProtectPolicy/, 'the polish protect policy must survive shelving');
});

test('the internal stage name is untouched, so paid sheets keep their provenance', () => {
  // Only the words on the button changed. 'hybrid' is the stage name in the render queue, in stored
  // resultKind and in every gallery entry already written to a farmer's device — renaming it would
  // strand sheets that have already been paid for behind a label nothing looks up.
  assert.match(i18n, /designGlossyAiHybrid: 'AI Polished'/, 'the farmer-facing name is the result, not the plumbing');
  const jobs = readFileSync(new URL('../lib/render-jobs.ts', import.meta.url), 'utf8');
  assert.match(jobs, /'hybrid' \| 'ai-polished' \| 'legacy-ai'/, 'stored provenance must not be renamed');
});

test('a finished sheet is badged with the button the farmer pressed', () => {
  // Rory, on his first AI Polished render, seeing it come back stamped "GEOMETRY-LOCKED HYBRID":
  // "Still doing the hybrid?" It was not — one paid pass, exactly as the button promised — but
  // every badge still carried the internal stage name, so the app looked like it had quietly run
  // something the picker no longer offers.
  //
  // The stored resultKind stays 'hybrid' (see the provenance test above); only the words change.
  assert.doesNotMatch(glossy, /Geometry-locked hybrid/, 'no badge may name the internal stage');
  assert.doesNotMatch(glossy, /'AI hybrid'/, 'no label may name the internal stage');
  assert.match(glossy, /AI Polished · geometry locked/, 'the single paid pass is badged as AI Polished');
  // The shelved second pass keeps a distinct name, so a sheet already paid for still says which of
  // the two produced it.
  assert.match(glossy, /AI Polished \+ 2nd pass/);
});
