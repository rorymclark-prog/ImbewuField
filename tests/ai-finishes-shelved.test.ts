import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The AI finishes (Hybrid / Full Treatment) are SHELVED, not deleted: not offered, so nobody
// spends a paid render on them, but every line of the pipeline stays put and every sheet already
// paid for still opens. These are source guards because the thing being protected is an ABSENCE
// (no paid button) plus a PRESENCE (the pipeline is still importable) — neither is observable from
// a unit call, and both are exactly the kind of thing a later edit removes by accident.

const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');

test('the AI finishes are shelved, and the shelf has an escape hatch', () => {
  assert.match(glossy, /const AI_FINISHES_SHELVED = true;/,
    'the paid finishes must stay unadvertised until someone deliberately un-shelves them');
  // Without the hatch, looking at the shelved work again needs a code change and a deploy.
  assert.match(glossy, /aifinish/,
    'the studio must still be openable with the finishes revealed, for review');
});

test('no paid render can be started while shelved, from ANY entry point', () => {
  // EVERY call site, not one per mode: the first version of this test looked only at the first
  // match per mode and so missed a third entry point — the one-tap "polish this sheet" flip, which
  // started a paid full render straight from an exact result. A shelf with a door left open is not
  // a shelf, and the leak was invisible until every site was enumerated.
  const sites = [...glossy.matchAll(/runLockedPolishFlow\('(hybrid|full)'\)/g)];
  assert.ok(sites.length >= 3, 'every paid entry point must be accounted for here');
  for (const site of sites) {
    const before = glossy.slice(Math.max(0, site.index! - 900), site.index!);
    assert.match(before, /aiFinishesVisible/,
      `a ${site[1]} render can be started from an ungated control near index ${site.index}`);
  }
});

test('shelving never hides a sheet a farmer has already paid for', () => {
  // The gallery reads stored results by provenance, and must not consult the shelf flag: a paid
  // hybrid sheet rendered last month still opens, downloads and shares after shelving.
  const galleryRegion = glossy.slice(glossy.indexOf('pushGallery'));
  assert.doesNotMatch(galleryRegion.slice(0, 40_000), /AI_FINISHES_SHELVED|aiFinishesVisible/,
    'gallery playback of stored paid renders must be independent of the shelf');
});

test('the shelved pipeline is still present to come back to', () => {
  // Rory: "shelve it but don't delete it I may decide to look at it again later."
  const flow = readFileSync(new URL('../lib/locked-polish-flow.ts', import.meta.url), 'utf8');
  assert.match(flow, /SheetOutputMode/, 'the three-mode flow must survive shelving');
  assert.match(flow, /fullTreatmentProtectPolicy/, 'the polish protect policy must survive shelving');
});
