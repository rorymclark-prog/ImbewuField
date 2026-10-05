import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COURSE_NARRATION, fullNarrationUrl, trackTitle, trackUrl } from '../lib/course-audio.ts';
import { animationUrls, slideImageFor, slideImageUrl } from '../lib/course-deck.ts';
import { isiZuluDeckReviewHold, isiZuluDeckReviewHoldEntries } from '../lib/course-deck-review-holds.ts';
import {
  ISIZULU_DECK_SOURCE_BINDINGS,
  resolveIsiZuluDeckSourcePair,
  type DeckTranscriptRegistry,
} from '../lib/course-deck-source-bindings.ts';
import { COURSE_TRANSCRIPTS } from '../lib/course-transcripts.ts';

const publicRoot = new URL('../public/', import.meta.url);
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const assetSha256 = (url: string) => sha256(readFileSync(new URL(url.replace(/^\//, ''), publicRoot)));

test('all 240 isiZulu deck pairs resolve to the exact registered source and recorded words', () => {
  assert.equal(ISIZULU_DECK_SOURCE_BINDINGS.length, 240);
  assert.equal(new Set(ISIZULU_DECK_SOURCE_BINDINGS.map(({ moduleId, slide }) => `${moduleId}:${slide}`)).size, 240);
  const counts = ISIZULU_DECK_SOURCE_BINDINGS.reduce<Record<string, number>>((result, { moduleId }) => {
    result[moduleId] = (result[moduleId] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, {
    'intro-permaculture': 22,
    'reading-landscape': 21,
    'water-harvesting': 24,
    'soil-health': 20,
    'vegetables-staples': 18,
    'seeds-sovereignty': 24,
    'plant-guilds': 51,
    'food-forest': 20,
    'small-livestock': 20,
    'market-community': 20,
  }, 'the snapshot covers the ten registered modules and each expected deck length');

  for (const binding of ISIZULU_DECK_SOURCE_BINDINGS) {
    const track = COURSE_NARRATION[binding.moduleId]?.tracks.find(({ slide }) => slide === binding.slide);
    assert.ok(track, `${binding.moduleId} slide ${binding.slide} has a registered narration title`);
    assert.equal(binding.sourceHeading, trackTitle(track, 'en'));
    assert.equal(binding.registeredEnglishTitle, trackTitle(track, 'en'));
    assert.equal(binding.registeredZuluTitle, trackTitle(track, 'zu'));
    assert.equal(binding.reviewStatus, 'unreviewed');
    assert.equal(binding.semanticReview, 'not-established-by-inventory');
    assert.equal(sha256(Buffer.from(JSON.stringify(binding.source))), binding.sourceHash,
      `${binding.moduleId} slide ${binding.slide}: immutable English text digest`);
    assert.equal(sha256(Buffer.from(JSON.stringify(binding.recordedTarget))), binding.targetHash,
      `${binding.moduleId} slide ${binding.slide}: immutable recorded-wording digest`);

    const resolved = resolveIsiZuluDeckSourcePair(binding.moduleId, binding.slide, COURSE_TRANSCRIPTS, {
      en: trackTitle(track, 'en'),
      zu: trackTitle(track, 'zu'),
    });
    assert.ok(resolved, `${binding.moduleId} slide ${binding.slide} remains source-bound`);
    assert.deepEqual(resolved.source, binding.source);
    assert.deepEqual(resolved.recordedTarget, binding.recordedTarget);
    assert.equal(resolved.reviewStatus, 'unreviewed');
  }
});

test('the source snapshot covers exact deck/audio assets without changing the ST Introduction recordings', () => {
  for (const binding of ISIZULU_DECK_SOURCE_BINDINGS) {
    assert.equal(slideImageUrl(binding.moduleId, 'zu', binding.slide), binding.imageUrl,
      `${binding.moduleId} slide ${binding.slide}: registered isiZulu still URL`);
    assert.equal(assetSha256(binding.imageUrl), binding.imageSha256,
      `${binding.moduleId} slide ${binding.slide}: source-paired image bytes`);
    assert.equal(assetSha256(binding.audioUrl), binding.audioSha256,
      `${binding.moduleId} slide ${binding.slide}: recorded audio bytes`);

    const holdReason = isiZuluDeckReviewHold(binding.moduleId, binding.slide);
    assert.equal(trackUrl(binding.moduleId, 'zu', binding.slide), holdReason ? null : binding.audioUrl,
      `${binding.moduleId} slide ${binding.slide}: raw recording is retained, while only held ZU URLs are suppressed`);
    const shown = slideImageFor(binding.moduleId, 'zu', binding.slide);
    if (holdReason) {
      assert.deepEqual(shown, {
        url: slideImageUrl(binding.moduleId, 'en', binding.slide),
        lang: 'en',
        exact: false,
      }, `${binding.moduleId} slide ${binding.slide}: flagged wording is paired with the English still`);
    } else {
      assert.deepEqual(shown, { url: binding.imageUrl, lang: 'zu', exact: true },
        `${binding.moduleId} slide ${binding.slide}: an unflagged exact pair keeps its ZU still`);
    }
  }

  // The ST Introduction clips are separately hash-pinned: source pairing must not
  // silently alter the existing narration that Rory has already published for review.
  const expectedStIntroAudio = {
    'full.mp3': 'c2411fd63e864a7bf158547a921ab9613ccd8d40d6d2cd09ec0974492ffe9510',
    'slide-01.mp3': 'e6126d03971fc957eb8465625e6c1cbad9653b8cfa9c06a8fc364b640eb426cb',
    'slide-02.mp3': '852d9d98894ba4466145433f620a8898450c2cdd5c813f5cb7956b722b9a783b',
    'slide-03.mp3': '4b870e2ea0eb2501ebc2e6f2c6ac9874edb3ed47c5b701287e36146f80ebe0f4',
    'slide-04.mp3': '767a4f3a50ba255c7a468ae05986f9544e69dfab7bc35f5e571ddaa3017c3a2e',
    'slide-05.mp3': '24f8a79fd1aa23799957968385c2e22d4202364fc9b8d9bb2b34100182a340b5',
    'slide-06.mp3': 'f0fe5f1c8b8700321a56aa5f081e1afe0ae28094926c6fcd56e7ac88e15a07cd',
    'slide-07.mp3': '4908700e6b6b8b7ac1841716be0c9abd9da4b9d47e235f9bb96cd6459eaa2d35',
    'slide-08.mp3': '781e1107d13a46f1a75a0282b5f70275b1f4ef54fb5ce3f40b22ca1c390585f6',
    'slide-09.mp3': 'f7430be929f4244e796127abf7e01dc1741933395c957361fd6bf9f5ba9f8243',
    'slide-10.mp3': 'd2f7359238379c1dbe8ee0f168f45c2802d76f3bb64f408dd719f7f70abee5e9',
    'slide-11.mp3': '182c16cc99390ac6a6f4094540ad069cf871a2c469edda8d6cc74107afd7c279',
    'slide-12.mp3': 'bef2ab756beea6e941455389219dbe131d0a9da64ced8ff07ab72b2b424fe271',
    'slide-13.mp3': '741918799e5ddd653ad0a4638d4edfe664aeaf40f8329e8f7bced856a94ce80e',
    'slide-14.mp3': 'ee77bce0d1d64cb219771930cc6952794fe54566cd403c5c7e8cdc2ed3b83742',
    'slide-15.mp3': 'e98f413d6e6875fdea5eb272bf89347ff95683efcd31aef2fde21c90bc319bd0',
    'slide-16.mp3': '2d96297c2a3c073bfd12d95e1086bbf0c82b76396d0a00f4fd56dc54a86a4a10',
    'slide-17.mp3': 'cfc2f59c05ed362256699ad8645f0546a1d5b3574fa65d023a57d10d2442a474',
    'slide-18.mp3': '85ea7f16de208a83af15c423bbc0f3ca452c605194f621c557243dfd5b333f84',
    'slide-19.mp3': '95988c9559a92e7fabe49d213f3d3dffdf1f416e3a938997d5430fa9b36781d3',
    'slide-20.mp3': 'f281ce330f09951d197196df8d3c5d09219f32e2e77bba5f69c7f58adc8b37fb',
    'slide-21.mp3': '91dd1d172982254fa040a0d2b9820226b98b1e016d292c7ef7f5c935ee985bcd',
    'slide-22.mp3': '38a4980a865fbde9541176d1d4d42eac0c4699448a7026c21c4fd8294d508cd6',
  } as const;
  const stAudioDir = '/course-audio/intro-permaculture/st/';
  for (const [filename, expectedHash] of Object.entries(expectedStIntroAudio)) {
    assert.equal(assetSha256(`${stAudioDir}${filename}`), expectedHash, `ST Introduction ${filename} remains byte-identical`);
  }
  assert.equal(trackUrl('intro-permaculture', 'en', 22), '/course-audio/intro-permaculture/en/slide-22.mp3');
  assert.equal(trackUrl('intro-permaculture', 'st', 22), '/course-audio/intro-permaculture/st/slide-22.mp3');
  assert.equal(fullNarrationUrl('intro-permaculture', 'st'), '/course-audio/intro-permaculture/st/full.mp3');
  assert.deepEqual(slideImageFor('intro-permaculture', 'st', 22), {
    url: slideImageUrl('intro-permaculture', 'st', 22), lang: 'st', exact: true,
  }, 'ST Introduction remains on its own existing slide pair');
});

test('the 24 independent isiZulu meaning flags suppress only their exact slides and affected full tracks', () => {
  const expected = [
    'intro-permaculture:22',
    'reading-landscape:5', 'reading-landscape:15', 'reading-landscape:16',
    'soil-health:1', 'soil-health:13',
    'water-harvesting:10',
    'vegetables-staples:16', 'vegetables-staples:18',
    'market-community:14',
    'plant-guilds:22', 'plant-guilds:28', 'plant-guilds:40',
    'seeds-sovereignty:6', 'seeds-sovereignty:11', 'seeds-sovereignty:12',
    'seeds-sovereignty:14', 'seeds-sovereignty:15', 'seeds-sovereignty:20', 'seeds-sovereignty:24',
    'small-livestock:2', 'small-livestock:3', 'small-livestock:8', 'small-livestock:11',
  ];
  const entries = isiZuluDeckReviewHoldEntries();
  assert.deepEqual(entries.map(({ moduleId, slide }) => `${moduleId}:${slide}`).sort(), [...expected].sort());
  assert.ok(entries.every(({ reason }) => reason.trim().length > 40), 'every hold names its specific source risk');
  assert.equal(isiZuluDeckReviewHold('intro-permaculture', 10), null,
    'the second check rejected the earlier Introduction slide 10 flag');
  assert.equal(trackUrl('intro-permaculture', 'zu', 10), '/course-audio/intro-permaculture/zu/slide-10.mp3');
  assert.deepEqual(slideImageFor('intro-permaculture', 'zu', 10), {
    url: slideImageUrl('intro-permaculture', 'zu', 10), lang: 'zu', exact: true,
  });

  const heldModules = [...new Set(entries.map(({ moduleId }) => moduleId))];
  for (const moduleId of heldModules) {
    assert.equal(fullNarrationUrl(moduleId, 'zu'), null, `${moduleId}: full narration contains at least one held slide`);
    assert.ok(fullNarrationUrl(moduleId, 'en'), `${moduleId}: English full narration remains available`);
  }
  assert.equal(trackUrl('seeds-sovereignty', 'en', 15), '/course-audio/seeds-sovereignty/en/slide-15.mp3');
  assert.ok(animationUrls('seeds-sovereignty', 15, 'en'), 'English animation remains available on the held seed slide');
  assert.equal(animationUrls('seeds-sovereignty', 15, 'zu'), null,
    'a held isiZulu transcript cannot play its mismatched labelled animation');
});

test('a missing or edited English/isiZulu transcript or changed title withdraws the pair', () => {
  const moduleId = 'intro-permaculture';
  const slide = 1;
  const titles = { en: 'Introduction to Permaculture', zu: 'Isingeniso Se-Permaculture' };
  const clone = (): Record<string, Record<string, Record<number, string[]>>> => structuredClone(COURSE_TRANSCRIPTS);

  assert.equal(resolveIsiZuluDeckSourcePair('unknown-module', slide), null);
  assert.equal(resolveIsiZuluDeckSourcePair(moduleId, 999), null);

  const missingSource = clone();
  delete missingSource[moduleId].en[slide];
  assert.equal(resolveIsiZuluDeckSourcePair(moduleId, slide, missingSource as DeckTranscriptRegistry, titles), null,
    'a missing current source row cannot be paired');

  const missingTarget = clone();
  delete missingTarget[moduleId].zu[slide];
  assert.equal(resolveIsiZuluDeckSourcePair(moduleId, slide, missingTarget as DeckTranscriptRegistry, titles), null,
    'a missing recorded target row cannot be paired');

  const changedSource = clone();
  changedSource[moduleId].en[slide][0] += ' changed';
  assert.equal(resolveIsiZuluDeckSourcePair(moduleId, slide, changedSource as DeckTranscriptRegistry, titles), null,
    'wording drift in source fails closed');

  const reorderedSource = clone();
  reorderedSource[moduleId].en[slide].reverse();
  assert.equal(resolveIsiZuluDeckSourcePair(moduleId, slide, reorderedSource as DeckTranscriptRegistry, titles), null,
    'same-count source paragraph reordering fails closed');

  const extraTarget = clone();
  extraTarget[moduleId].zu[slide].push('Additional recorded words.');
  assert.equal(resolveIsiZuluDeckSourcePair(moduleId, slide, extraTarget as DeckTranscriptRegistry, titles), null,
    'target paragraph count drift fails closed');

  assert.equal(resolveIsiZuluDeckSourcePair(moduleId, slide, COURSE_TRANSCRIPTS, { ...titles, en: 'Different heading' }), null,
    'a changed registered English title fails closed');
  assert.equal(resolveIsiZuluDeckSourcePair(moduleId, slide, COURSE_TRANSCRIPTS, { ...titles, zu: 'Different isiZulu title' }), null,
    'a changed registered isiZulu title fails closed');

  const resolved = resolveIsiZuluDeckSourcePair(moduleId, slide, COURSE_TRANSCRIPTS, titles);
  assert.equal(resolved?.reviewStatus, 'unreviewed', 'exact pairing does not claim semantic or fluent approval');
});

test('a drifted registered isiZulu source or title falls back to English and suppresses ZU media', () => {
  const moduleId = 'seeds-sovereignty';
  const slide = 7;
  const mutableTranscripts = COURSE_TRANSCRIPTS as unknown as Record<string, Record<string, Record<number, string[]>>>;
  const target = mutableTranscripts[moduleId].zu[slide];
  const track = COURSE_NARRATION[moduleId].tracks.find((entry) => entry.slide === slide)!;
  const oldTitle = track.title;
  const englishStill = slideImageUrl(moduleId, 'en', slide);
  assert.equal(isiZuluDeckReviewHold(moduleId, slide), null, 'the fixture is not independently held');
  assert.equal(trackUrl(moduleId, 'zu', slide), `/course-audio/${moduleId}/zu/slide-07.mp3`);
  assert.ok(animationUrls(moduleId, slide, 'zu'), 'the exact pair makes this labeled ZU animation available');

  try {
    mutableTranscripts[moduleId].zu[slide] = [...target, 'Unpaired new sentence.'];
    assert.equal(trackUrl(moduleId, 'zu', slide), null);
    assert.equal(fullNarrationUrl(moduleId, 'zu'), null);
    assert.equal(animationUrls(moduleId, slide, 'zu'), null);
    assert.deepEqual(slideImageFor(moduleId, 'zu', slide), { url: englishStill, lang: 'en', exact: false });
  } finally {
    mutableTranscripts[moduleId].zu[slide] = target;
  }

  try {
    track.title = `${oldTitle} changed`;
    assert.equal(trackUrl(moduleId, 'zu', slide), null, 'registered title drift invalidates the title-bound pair');
    assert.deepEqual(slideImageFor(moduleId, 'zu', slide), { url: englishStill, lang: 'en', exact: false });
  } finally {
    track.title = oldTitle;
  }
});

test('one changed source row withdraws a formerly usable ZU continuous narration track', () => {
  const moduleId = 'food-forest';
  const slide = 1;
  const mutableTranscripts = COURSE_TRANSCRIPTS as unknown as Record<string, Record<string, Record<number, string[]>>>;
  const target = mutableTranscripts[moduleId].zu[slide];
  assert.equal(isiZuluDeckReviewHold(moduleId, slide), null);
  assert.equal(fullNarrationUrl(moduleId, 'zu'), `/course-audio/${moduleId}/zu/full.mp3`);

  try {
    mutableTranscripts[moduleId].zu[slide] = [...target, 'A new unpaired sentence.'];
    assert.equal(trackUrl(moduleId, 'zu', slide), null, 'the changed slide clip fails closed');
    assert.equal(fullNarrationUrl(moduleId, 'zu'), null,
      'a continuous recording is unavailable when any included source-bound slide has drifted');
  } finally {
    mutableTranscripts[moduleId].zu[slide] = target;
  }
});

test('the source and recorded wording arrays cannot be altered through the exported snapshot', () => {
  const binding = ISIZULU_DECK_SOURCE_BINDINGS[0];
  assert.ok(Object.isFrozen(ISIZULU_DECK_SOURCE_BINDINGS));
  assert.ok(Object.isFrozen(binding));
  assert.ok(Object.isFrozen(binding.source));
  assert.ok(Object.isFrozen(binding.recordedTarget));
});
