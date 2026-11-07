import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AF_DECK_ASSET_SIZES, AF_DECK_RELEASE_EXPECTED_COUNTS, AF_DECK_RELEASE_ROWS } from '../lib/course-deck-release-bindings-af-data.ts';
import { releasePairTarget } from '../lib/course-deck-release-bindings.ts';
import { CURRENT_DECK_RELEASE_BINDINGS, pairFromRelease } from '../lib/course-deck-release-bindings-registry.ts';
import { COURSE_DECKS, currentRegionalDeckSlide, resolveDeckLang, slideImageFor, slideImageUrl } from '../lib/course-deck.ts';
import { requiresLearnerNarrationChoice, resolveLearnerDeckLang } from '../lib/learner-deck-lang.ts';
import { availableNarrationLanguages, requiresExplicitNarrationChoice, trackUrl } from '../lib/course-audio.ts';
import { defaultOfflinePackVariant, offlinePack } from '../lib/offline-pack.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';

// Afrikaans Studies slide cards (scripts/build-af-deck-release.mjs): unreviewed source-paired drafts
// of the narration, rendered over the English slide with the exact English beneath. The generated
// rows are declarations; these checks recompute every digest from the pair files and real bytes.
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url));

test('every Studies module with a deck ships an Afrikaans card release, one card per English slide', () => {
  const withDecks = COURSE_MODULES.map(m => m.id).filter(id => COURSE_DECKS[id]);
  assert.deepEqual(AF_DECK_RELEASE_ROWS.map(r => r.moduleId).sort(), [...withDecks].sort());
  for (const row of AF_DECK_RELEASE_ROWS) {
    const source = englishSlideRecords(read(`docs/narration/${row.moduleId}.en.md`).toString());
    assert.equal(row.slides.length, source.length, row.moduleId);
    assert.equal(AF_DECK_RELEASE_EXPECTED_COUNTS[`${row.moduleId}.af`], source.length, row.moduleId);
    assert.equal(row.language, 'af');
    assert.equal(row.audioBinding, 'none', 'no Afrikaans recording exists; the cards are silent');
    assert.equal(row.reviewStatus, 'unreviewed');
  }
});

test('the Afrikaans release recomputes pair, wording and real image digests', () => {
  for (const row of AF_DECK_RELEASE_ROWS) {
    const pairBytes = read(row.pairPath);
    assert.equal(row.pairSha256, sha(pairBytes), `${row.moduleId}: pair digest`);
    const pair = JSON.parse(pairBytes.toString());
    assert.deepEqual(pairFromRelease(row), pair, `${row.moduleId}: the pair rebuilt from the release is exactly the file`);
    validatePairedDraft(pair, englishSlideRecords(read(`docs/narration/${row.moduleId}.en.md`).toString()), 'af');
    for (const slide of row.slides) {
      const actual = releasePairTarget(pair, row, slide.slide);
      assert.ok(actual, `${row.moduleId} ${slide.slide}: pair resolves`);
      assert.equal(slide.sourceHash, sha(JSON.stringify([slide.sourceHeading, ...slide.sourceEnglish])));
      assert.equal(slide.targetHash, sha(JSON.stringify([actual.heading, ...actual.body])));
      assert.equal(slide.targetHeading, actual.heading);
      assert.deepEqual(slide.targetText, actual.body);
      assert.deepEqual(currentRegionalDeckSlide(row.moduleId, 'af', slide.slide), slide,
        `${row.moduleId} ${slide.slide}: live English source and current pair resolve the published card`);
      const bytes = read('public' + slide.imageUrl);
      assert.equal(bytes.length, slide.imageBytes);
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8 ');
      assert.equal(bytes.readUInt16LE(26) & 0x3fff, slide.width);
      assert.equal(bytes.readUInt16LE(28) & 0x3fff, slide.height);
      assert.equal(sha(bytes), slide.imageSha256);
      assert.equal(AF_DECK_ASSET_SIZES[slide.imageUrl], bytes.length, `${slide.imageUrl}: offline size`);
    }
  }
});

test('Afrikaans readers get their cards, silent by default, and the English still if a pair drifts', () => {
  for (const row of AF_DECK_RELEASE_ROWS) {
    assert.deepEqual(resolveLearnerDeckLang(row.moduleId, 'af'), { lang: 'af', exact: true });
    assert.deepEqual(resolveDeckLang(row.moduleId, 'af'), { lang: 'en', exact: false }, 'the slide-folder resolver is unchanged');
    const first = row.slides[0];
    assert.deepEqual(slideImageFor(row.moduleId, 'af', first.slide),
      { url: first.imageUrl, lang: 'af', exact: true, aspectRatio: first.width / first.height });
    assert.equal(requiresLearnerNarrationChoice(row.moduleId, 'af'), true, 'no Afrikaans voice: the learner chooses');
    assert.equal(requiresLearnerNarrationChoice(row.moduleId, 'en'), requiresExplicitNarrationChoice(row.moduleId, 'en'));
    assert.equal(availableNarrationLanguages(row.moduleId).includes('af'), false);
    assert.equal(trackUrl(row.moduleId, 'af', first.slide), null);
    assert.equal(defaultOfflinePackVariant([row.moduleId], 'af'), 'slides');
    const pack = offlinePack(row.moduleId, 'af', 'standard', 'slides');
    assert.deepEqual(pack.missing, [], `${row.moduleId}: complete Afrikaans offline slide pack`);
    assert.equal(pack.entries.filter(e => e.kind === 'slide' && e.url.includes('/af-silent/')).length, row.slides.length);
  }
  // A drifted English source withdraws the whole card set; each slide shows its English still.
  const drifted = { has: CURRENT_DECK_RELEASE_BINDINGS.has, resolve: () => null };
  const row = AF_DECK_RELEASE_ROWS[0];
  assert.deepEqual(slideImageFor(row.moduleId, 'af', 1, drifted),
    { url: slideImageUrl(row.moduleId, 'en', 1), lang: 'en', exact: false });
});

test('the Afrikaans registry is separate: isiXhosa, Sesotho and isiZulu decks resolve exactly as before', () => {
  assert.equal(CURRENT_DECK_RELEASE_BINDINGS.has('intro-permaculture', 'xh'), true);
  assert.match(currentRegionalDeckSlide('intro-permaculture', 'xh', 1)?.imageUrl ?? '', /\/xh-silent\//);
  assert.equal(CURRENT_DECK_RELEASE_BINDINGS.has('intro-permaculture', 'st'), true);
  assert.ok(currentRegionalDeckSlide('intro-permaculture', 'st', 1));
  assert.equal(CURRENT_DECK_RELEASE_BINDINGS.has('soil-health', 'st'), false);
  assert.equal(slideImageFor('soil-health', 'st', 1)?.url, '/course-decks/soil-health/st/slide-01.webp');
  assert.equal(CURRENT_DECK_RELEASE_BINDINGS.has('intro-permaculture', 'zu'), false);
});
