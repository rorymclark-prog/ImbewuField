import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fairSharingZuluSilentRows } from './intro-fair-sharing-history-checks.ts';
import { COURSE_NARRATION, fullNarrationUrl, trackTitle, trackUrl } from '../lib/course-audio.ts';
import { animationUrls, slideImageFor, slideImageUrl } from '../lib/course-deck.ts';
import { isiZuluDeckReviewHold, isiZuluDeckReviewHoldEntries } from '../lib/course-deck-review-holds.ts';
import {
  ISIZULU_DECK_SOURCE_BINDINGS,
  resolveIsiZuluDeckSourcePair,
  type DeckTranscriptRegistry,
} from '../lib/course-deck-source-bindings.ts';
import { COURSE_TRANSCRIPTS } from '../lib/course-transcripts.ts';
import { ISIZULU_SILENT_DECK_DRAFT_ROWS } from '../lib/course-deck-silent-drafts-data.ts';
import { ISIZULU_SILENT_DECK_TEXT_CANDIDATES } from '../lib/course-deck-silent-safety-text-candidates.ts';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { englishSlideRecords } from '../scripts/paired-draft-slides.mjs';
import {
  createIsiZuluSilentDeckDraftRegistry,
  resolveIsiZuluSilentDeckDraft as resolveSilentDraftFromRegistry,
  type IsiZuluSilentDeckDraftInput,
} from '../lib/course-deck-silent-drafts.ts';
import { resolveIsiZuluSilentDeckDraft as resolveRegisteredSilentDraft } from '../lib/course-deck-silent-drafts-registry.ts';

const publicRoot = new URL('../public/', import.meta.url);
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const assetSha256 = (url: string) => sha256(readFileSync(new URL(url.replace(/^\//, ''), publicRoot)));

// Read the encoded pixels' dimensions, rather than accepting a reviewer JSON's size claim.
function webpDimensions(bytes: Buffer): { width: number; height: number } {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    assert.ok(data + size <= bytes.length, 'WebP chunk is complete');
    if (kind === 'VP8 ') {
      assert.equal(bytes.subarray(data + 3, data + 6).toString('hex'), '9d012a');
      return { width: bytes.readUInt16LE(data + 6) & 0x3fff,
        height: bytes.readUInt16LE(data + 8) & 0x3fff };
    }
    if (kind === 'VP8X') return { width: 1 + bytes.readUIntLE(data + 4, 3),
      height: 1 + bytes.readUIntLE(data + 7, 3) };
    offset = data + size + (size % 2);
  }
  throw new Error('No supported encoded WebP dimensions');
}

test('every corrected silent ZU card carries its checked source and image while voice playback follows exact wording holds', () => {
  const packet = JSON.parse(readFileSync(new URL(
    '../docs/study-translation-reviews/ISIZULU-SILENT-HELD-SLIDE-CANDIDATES-2026-10-05.json', import.meta.url), 'utf8'));
  // Fair/equal distinctions add two independent silent revisions; the prior
  // Earlier full source/target/asset checks remain in this complete enumeration.
  const expected = [...packet.rows.filter((row: any) => row.currentHold), ...fairSharingZuluSilentRows.map(row => ({
    ...row, proposedSilentTarget: row.correctedTarget, proposedSilentZuluTitle: row.correctedTitle,
  }))];
  // A later independently checked longest-versus-long correction adds Reading14; preserve every earlier card check.
  const reading14 = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/reading-comparisons-2026-10-07/reading-zu14-silent-row.json', import.meta.url), 'utf8'));
  expected.push({ ...reading14, proposedSilentTarget: reading14.correctedTarget, proposedSilentZuluTitle: reading14.correctedTitle });
  expected.push(...ISIZULU_SILENT_DECK_TEXT_CANDIDATES.map((row) => ({
    ...row, proposedSilentTarget: row.correctedTarget, proposedSilentZuluTitle: row.correctedTitle,
  })));
  const keys = (rows: readonly { moduleId: string; slide: number }[]) => rows.map(row =>
    `${row.moduleId}:${row.slide}`).sort();
  assert.deepEqual(keys(ISIZULU_SILENT_DECK_DRAFT_ROWS), keys(expected),
    'no approved card is silently omitted, duplicated, or replaced by a temporary English-only input');
  const registeredKeys = new Set(keys(ISIZULU_SILENT_DECK_DRAFT_ROWS));
  assert.ok(isiZuluDeckReviewHoldEntries().every((row) => registeredKeys.has(`${row.moduleId}:${row.slide}`)),
    'every playback hold has its exact silent visual source pair registered');
  for (const row of ISIZULU_SILENT_DECK_DRAFT_ROWS) {
    const checked = expected.find((candidate: any) => candidate.moduleId === row.moduleId && candidate.slide === row.slide);
    assert.deepEqual(row.sourceEnglish, checked.sourceEnglish);
    assert.deepEqual(row.correctedTarget, checked.proposedSilentTarget);
    assert.equal(row.correctedTitle, checked.proposedSilentZuluTitle);
    assert.equal(row.targetHash, sha256(Buffer.from(JSON.stringify({
      heading: row.correctedTitle, body: row.correctedTarget,
    }))));
    assert.equal(row.sourceHash, sha256(Buffer.from(JSON.stringify(row.sourceEnglish))));
    const authored = englishSlideRecords(readFileSync(new URL(
      `../docs/narration/${row.moduleId}.en.md`, import.meta.url), 'utf8')).find((slide: any) => slide.n === row.slide);
    assert.ok(authored);
    assert.equal(row.sourceHeading, authored.heading);
    assert.deepEqual(row.sourceEnglish, authored.body, 'exact authored source, including later paragraphs');
    const bytes = readFileSync(new URL(row.imageUrl.slice(1), publicRoot));
    assert.equal(sha256(bytes), row.imageSha256);
    assert.equal(bytes.length, row.imageBytes);
    assert.equal(COURSE_ASSET_SIZES[row.imageUrl], bytes.length);
    assert.deepEqual(webpDimensions(bytes), { width: row.width, height: row.height });
    assert.ok(resolveRegisteredSilentDraft(row.moduleId, row.slide));
    assert.deepEqual(slideImageFor(row.moduleId, 'zu', row.slide), {
      url: row.imageUrl, lang: 'zu', exact: true, aspectRatio: row.width / row.height,
    });
    const binding = ISIZULU_DECK_SOURCE_BINDINGS.find((candidate) =>
      candidate.moduleId === row.moduleId && candidate.slide === row.slide);
    assert.ok(binding, `${row.moduleId}:${row.slide}: source and recorded media identity remains registered`);
    assert.equal(trackUrl(row.moduleId, 'zu', row.slide),
      isiZuluDeckReviewHold(row.moduleId, row.slide) ? null : binding.audioUrl,
      'old speech remains playable only when no exact-slide meaning hold applies');
    assert.equal(animationUrls(row.moduleId, row.slide, 'zu'), null);
    assert.equal(row.audioBinding, 'none');
    assert.equal(row.reviewStatus, 'unreviewed');
  }
  for (const candidate of ISIZULU_SILENT_DECK_TEXT_CANDIDATES) {
    const row = ISIZULU_SILENT_DECK_DRAFT_ROWS.find((draft) => draft.moduleId === candidate.moduleId && draft.slide === candidate.slide)!;
    const binding = ISIZULU_DECK_SOURCE_BINDINGS.find((item) => item.moduleId === candidate.moduleId && item.slide === candidate.slide)!;
    assert.equal(row.correctedTitle, candidate.correctedTitle);
    assert.deepEqual(row.correctedTarget, candidate.correctedTarget);
    assert.equal(row.targetHash, candidate.targetHash);
    assert.deepEqual(slideImageFor(candidate.moduleId, 'zu', candidate.slide), {
      url: row.imageUrl, lang: 'zu', exact: true, aspectRatio: row.width / row.height,
    }, `${candidate.moduleId}:${candidate.slide}: the selected ZU still is the new silent card`);
    assert.equal(trackUrl(candidate.moduleId, 'zu', candidate.slide),
      isiZuluDeckReviewHold(candidate.moduleId, candidate.slide) ? null : binding.audioUrl,
      `${candidate.moduleId}:${candidate.slide}: old speech is held only when the visible silent target differs`);
    assert.equal(sha256(readFileSync(new URL(binding.audioUrl.slice(1), publicRoot))), binding.audioSha256,
      `${candidate.moduleId}:${candidate.slide}: original recorded bytes and binding stay unchanged`);
    assert.equal(sha256(readFileSync(new URL(binding.imageUrl.slice(1), publicRoot))), binding.imageSha256,
      `${candidate.moduleId}:${candidate.slide}: original isiZulu JPEG stays unchanged`);
    assert.equal(animationUrls(candidate.moduleId, candidate.slide, 'zu'), null,
      `${candidate.moduleId}:${candidate.slide}: no animation or added media binding`);
    if (!isiZuluDeckReviewHold(candidate.moduleId, candidate.slide)) {
      assert.deepEqual(binding.recordedTarget, candidate.correctedTarget,
        `${candidate.moduleId}:${candidate.slide}: unchanged recording wording remains safely aligned to its silent text`);
    }
  }
});

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

type MutableSilentDraft = {
  -readonly [Key in keyof IsiZuluSilentDeckDraftInput]:
    Key extends 'sourceEnglish' | 'correctedTarget' ? string[] : IsiZuluSilentDeckDraftInput[Key]
};
const silentDraftFixture = (): MutableSilentDraft => {
  const binding = ISIZULU_DECK_SOURCE_BINDINGS[0];
  return {
    moduleId: binding.moduleId,
    slide: binding.slide,
    sourceHeading: binding.sourceHeading,
    sourceEnglish: [...binding.source],
    correctedTitle: 'Isihloko esingabuyekezwanga',
    correctedTarget: ['Umbhalo olungisiwe ongakabuyekezwa.'],
    sourceHash: binding.sourceHash,
    targetHash: '1'.repeat(64),
    imageUrl: `/course-decks/${binding.moduleId}/zu-silent/slide-${String(binding.slide).padStart(2, '0')}.webp`,
    imageSha256: '2'.repeat(64),
    imageBytes: 12345,
    width: 1440,
    height: 5400,
    reviewStatus: 'unreviewed',
    audioBinding: 'none',
  };
};

test('silent ZU registry checks immutable source/title and requires a silent unreviewed card', () => {
  const binding = ISIZULU_DECK_SOURCE_BINDINGS[0];
  const candidate = silentDraftFixture();
  const registry = createIsiZuluSilentDeckDraftRegistry([candidate]);
  assert.equal(resolveSilentDraftFromRegistry(registry, binding.moduleId, binding.slide)?.correctedTitle,
    candidate.correctedTitle);

  const reordered = silentDraftFixture();
  reordered.sourceEnglish = [...reordered.sourceEnglish].reverse();
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([reordered]), /source text or order differs/);

  const changedTitle = silentDraftFixture();
  changedTitle.sourceHeading = 'Changed English heading';
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([changedTitle]), /Source heading differs/);

  const staleManifestTitle = silentDraftFixture();
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([staleManifestTitle], COURSE_TRANSCRIPTS,
    () => ({ en: 'Changed title', zu: binding.registeredZuluTitle })), /source or title drifted/);

  const changedSource = silentDraftFixture();
  changedSource.sourceEnglish[0] += ' New instruction.';
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([changedSource]), /source text or order differs/);

  const wrongSnapshotHash = silentDraftFixture();
  wrongSnapshotHash.sourceHash = '3'.repeat(64);
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([wrongSnapshotHash]), /Source hash differs/);

  const wrongAudioBinding = silentDraftFixture();
  wrongAudioBinding.audioBinding = 'legacy-recording' as 'none';
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([wrongAudioBinding]), /no audio binding/);
});

test('silent ZU registry freezes copies and stops resolving after live source drift', () => {
  const binding = ISIZULU_DECK_SOURCE_BINDINGS[0];
  const candidate = silentDraftFixture();
  const originalSource = [...candidate.sourceEnglish];
  const originalTarget = [...candidate.correctedTarget];
  const registry = createIsiZuluSilentDeckDraftRegistry([candidate]);
  const row = resolveSilentDraftFromRegistry(registry, binding.moduleId, binding.slide);
  assert.ok(row);
  assert.ok(Object.isFrozen(registry));
  assert.ok(Object.isFrozen(row));
  assert.ok(Object.isFrozen(row.sourceEnglish));
  assert.ok(Object.isFrozen(row.correctedTarget));

  candidate.sourceEnglish[0] = 'Caller mutation after registration.';
  candidate.correctedTarget[0] = 'Caller mutation after registration.';
  assert.deepEqual(row.sourceEnglish, originalSource);
  assert.deepEqual(row.correctedTarget, originalTarget);
  assert.equal(resolveSilentDraftFromRegistry(registry, binding.moduleId, binding.slide), row);

  const driftedTranscripts = structuredClone(COURSE_TRANSCRIPTS) as typeof COURSE_TRANSCRIPTS;
  (driftedTranscripts as any)[binding.moduleId].en[binding.slide][0] += ' Drift.';
  assert.equal(resolveSilentDraftFromRegistry(registry, binding.moduleId, binding.slide, driftedTranscripts), null,
    'a checked card stops resolving if its live English source changes');
});

test('the Reading 7 image-only English cue stays a separately attributed source, outside both transcript strings', () => {
  const binding = ISIZULU_DECK_SOURCE_BINDINGS.find(({ moduleId, slide }) =>
    moduleId === 'reading-landscape' && slide === 7)!;
  const cue = {
    language: 'en' as const,
    label: 'English cue from original slide image — not narration source',
    text: 'Check safe overflow with a trained local adviser',
    sourceImageUrl: '/course-decks/reading-landscape/en/slide-07.jpg',
    sourceImageSha256: '16eb6ee68e24f69ab115a29f2e9588c094715cc14983ecf312f84b1cdb8cd348',
    identitySha256: '5b366035bbf36ef0efaf1c951c7bf6576f50ea95b57137b436d429cbf0a19e9b',
  };
  const row: MutableSilentDraft = {
    ...silentDraftFixture(),
    moduleId: binding.moduleId,
    slide: binding.slide,
    sourceHeading: binding.sourceHeading,
    sourceEnglish: [...binding.source],
    sourceHash: binding.sourceHash,
    imageUrl: `/course-decks/${binding.moduleId}/zu-silent/slide-07.webp`,
    supplementalImageCue: cue,
  };
  const registry = createIsiZuluSilentDeckDraftRegistry([row]);
  const resolved = resolveSilentDraftFromRegistry(registry, binding.moduleId, binding.slide);
  assert.ok(resolved);
  assert.deepEqual(resolved.supplementalImageCue, cue);
  assert.ok(!resolved.sourceEnglish.includes(cue.text), 'image-only authored cue is not added to canonical narration source');
  assert.ok(!resolved.correctedTarget.includes(cue.text), 'English image cue is not represented as translated isiZulu text');
  assert.equal(assetSha256(cue.sourceImageUrl), cue.sourceImageSha256,
    'the supplemental cue remains bound to the checked English source image');
  const { identitySha256, ...cueIdentity } = cue;
  assert.equal(sha256(Buffer.from(JSON.stringify(cueIdentity))), identitySha256,
    'the cue content and original image digest have their own independent identity');

  const missingCue = { ...row };
  delete missingCue.supplementalImageCue;
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([missingCue]), /Supplemental image cue is required/);
  const changedCue = { ...row, supplementalImageCue: { ...cue, text: 'Check overflow with a trained local adviser' } };
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([changedCue]), /Supplemental image cue identity drifted/);
  const changedSourceIdentity = { ...row, supplementalImageCue: { ...cue, sourceImageSha256: '0'.repeat(64) } };
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([changedSourceIdentity]), /Supplemental image cue identity drifted/);
  const changedCueIdentity = { ...row, supplementalImageCue: { ...cue, identitySha256: '0'.repeat(64) } };
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([changedCueIdentity]), /Supplemental image cue identity drifted/);
  const movedCue = { ...silentDraftFixture(), supplementalImageCue: cue };
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([movedCue]), /Supplemental image cue identity drifted/);
});

test('the six accepted silent safety cards are source-bound, rendered and runtime-registered as unreviewed', () => {
  const snapshot = JSON.parse(readFileSync(new URL(
    '../docs/study-translation-reviews/zulu-six-silent-safety-text-candidates-2026-10-08.json', import.meta.url), 'utf8'));
  const expectedKeys = [
    'intro-permaculture:14', 'reading-landscape:4', 'reading-landscape:7',
    'food-forest:7', 'food-forest:11', 'food-forest:12',
  ].sort();
  const key = (row: { moduleId: string; slide: number }) => `${row.moduleId}:${row.slide}`;
  assert.deepEqual(ISIZULU_SILENT_DECK_TEXT_CANDIDATES.map(key).sort(), expectedKeys);
  assert.deepEqual(snapshot.rows.map(key).sort(), expectedKeys);
  assert.equal(snapshot.status, 'accepted source-bound text; locally rendered and runtime-registered, unreviewed');
  assert.equal(snapshot.acceptedPacketSha256,
    '80b56bf5ee4a2f60877f9c11254d9c0e792f80a2f97fee235c301059834d3be3');

  for (const row of ISIZULU_SILENT_DECK_TEXT_CANDIDATES) {
    const snap = snapshot.rows.find((candidate: any) => key(candidate) === key(row));
    const binding = ISIZULU_DECK_SOURCE_BINDINGS.find((candidate) => key(candidate) === key(row));
    assert.ok(binding);
    assert.deepEqual(row.sourceEnglish, binding.source);
    assert.equal(row.sourceHeading, binding.sourceHeading);
    assert.equal(row.sourceHash, binding.sourceHash);
    assert.equal(row.sourceHash, sha256(Buffer.from(JSON.stringify(row.sourceEnglish))));
    assert.equal(row.targetHash, sha256(Buffer.from(JSON.stringify({
      heading: row.correctedTitle, body: row.correctedTarget,
    }))));
    assert.equal(row.reviewStatus, 'unreviewed');
    assert.equal(row.audioBinding, 'none');
    if (key(row) === 'intro-permaculture:14') {
      assert.equal(row.sourceHash, snap.sourceHash, 'the appended integration sentence does not change the bound English source');
      assert.equal(row.correctedTarget[1], snap.correctedTarget[1].replace(
        ' ngemva kokuvuna. Gcina izinkukhu',
        ' ngemva kokuvuna. Lokhu kuwukuhlanganisa. Gcina izinkukhu',
      ));
      assert.deepEqual({ ...row, correctedTarget: snap.correctedTarget, targetHash: snap.targetHash }, snap,
        'only the reviewed one-sentence insertion differs from the immutable six-card packet');
    } else if (key(row) === 'food-forest:11') {
      assert.equal(row.sourceHash, snap.sourceHash, 'the bounded imperative edit keeps the original source binding');
      assert.deepEqual({ ...row, correctedTarget: snap.correctedTarget, targetHash: snap.targetHash }, snap,
        'only the reviewed imperative prefix differs from the immutable six-card packet');
    } else assert.deepEqual(snap, row);
  }
  const forest11 = ISIZULU_SILENT_DECK_TEXT_CANDIDATES.find((row) => key(row) === 'food-forest:11')!;
  assert.ok(forest11.correctedTarget.some((paragraph) => paragraph.includes(
    'Hlola isitshalo ngasinye against frost, soil, mature size and the approved local species list.')));
  assert.equal(forest11.targetHash, '246fcd057be649d47381cfa9454239475637ab2992843deb5eebc032bd321060');
  assert.ok(!forest11.correctedTarget.some((paragraph) => paragraph.includes('ngokwe-')),
    'the bounded imperative does not add an unreviewed comparison construction');
  const intro14 = ISIZULU_SILENT_DECK_TEXT_CANDIDATES.find((row) => key(row) === 'intro-permaculture:14')!;
  assert.ok(intro14.correctedTarget[1].includes(
    'ngemva kokuvuna. Lokhu kuwukuhlanganisa. Gcina izinkukhu zingasondeli ezitshalweni ezivunelwa ukudliwa.'));
  assert.equal(intro14.targetHash, 'bda06454d2cf6fd558b8c584ba438077eb275d8b386fea391b406714e19dd2d4');
  assert.match(isiZuluDeckReviewHold('intro-permaculture', 14) ?? '', /original recording and binding remain unchanged/,
    'the unchanged recording is withheld beside the new explicit integration clause');
  const repairProofBytes = readFileSync(new URL(
    '../docs/study-translation-reviews/zulu-silent-sentence-repairs-2026-10-08/successor-proof.json', import.meta.url));
  assert.equal(sha256(repairProofBytes), 'ec4943b8bd34e031cbd082f6c402a5d2edb234d10b2470db345b39bc2c25eaf6',
    'the two-card source-bound successor proof stays immutable');
  const repairProof = JSON.parse(repairProofBytes.toString());
  for (const repair of repairProof.changes) {
    const candidate = ISIZULU_SILENT_DECK_TEXT_CANDIDATES.find((row) => key(row) === repair.key)!;
    const prior = snapshot.rows.find((row: any) => key(row) === repair.key)!;
    assert.deepEqual(repair.sourceEnglish, candidate.sourceEnglish, `${repair.key}: proof remains bound to exact English source`);
    assert.equal(repair.sourceHash, candidate.sourceHash, `${repair.key}: source identity stays fixed`);
    assert.deepEqual(repair.beforeTarget, prior.correctedTarget, `${repair.key}: exact predecessor target is retained in proof`);
    assert.deepEqual(repair.afterTarget, candidate.correctedTarget, `${repair.key}: exact current target is proven`);
    assert.equal(repair.reviewStatus, candidate.reviewStatus);
    assert.equal(repair.audioBinding, candidate.audioBinding);
  }
  const holdProof = repairProof.playbackSafetyHold;
  const beforeHold = readFileSync(new URL(`../docs/study-translation-reviews/zulu-silent-sentence-repairs-2026-10-08/${holdProof.before.path}`, import.meta.url));
  const afterHold = readFileSync(new URL(`../docs/study-translation-reviews/zulu-silent-sentence-repairs-2026-10-08/${holdProof.after.path}`, import.meta.url));
  const liveHold = readFileSync(new URL('../lib/course-deck-review-holds.ts', import.meta.url));
  assert.equal(sha256(beforeHold), holdProof.before.sha256);
  assert.equal(sha256(afterHold), holdProof.after.sha256);
  assert.deepEqual(afterHold, liveHold, 'the complete playback-hold source equals its saved successor snapshot');
  const holdLine = "    14: 'The corrected silent card explicitly names integration after the arrangement example, while the original recording only gives the arrangement; withhold the old speech beside this added distinction until its wording is checked. The original recording and binding remain unchanged.',\n";
  assert.equal(liveHold.toString().split(holdLine).length - 1, 1, 'the playback-safety hold has one exact entry');
  assert.deepEqual(Buffer.from(liveHold.toString().replace(holdLine, '')), beforeHold,
    'the new hold is the only difference from its exact saved predecessor');
  const reading7 = ISIZULU_SILENT_DECK_TEXT_CANDIDATES.find((row) => key(row) === 'reading-landscape:7')!;
  assert.ok(reading7.supplementalImageCue);
  assert.ok(!reading7.sourceEnglish.includes(reading7.supplementalImageCue.text));
  assert.ok(!reading7.correctedTarget.includes(reading7.supplementalImageCue.text));
  assert.equal(reading7.sourceHash, ISIZULU_DECK_SOURCE_BINDINGS.find((row) => key(row) === key(reading7))!.sourceHash,
    'the image-authored adviser cue does not alter canonical narration source identity');
  assert.equal(resolveRegisteredSilentDraft('reading-landscape', 14)?.imageUrl,
    '/course-decks/reading-landscape/zu-silent/slide-14.webp', 'the existing Reading 14 correction is unchanged');
  for (const candidate of ISIZULU_SILENT_DECK_TEXT_CANDIDATES) {
    const runtime = resolveRegisteredSilentDraft(candidate.moduleId, candidate.slide);
    assert.ok(runtime, `${key(candidate)} resolves through the runtime registry`);
    assert.equal(runtime!.imageSha256, ISIZULU_SILENT_DECK_DRAFT_ROWS.find((row) => key(row) === key(candidate))!.imageSha256);
    assert.equal(runtime!.reviewStatus, 'unreviewed');
    assert.equal(runtime!.audioBinding, 'none');
  }
});

test('silent ZU registry rejects duplicate identities and invalid image/hash metadata', () => {
  const binding = ISIZULU_DECK_SOURCE_BINDINGS[0];
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([silentDraftFixture(), silentDraftFixture()]), /Duplicate.*identity/);

  const badUrl = silentDraftFixture();
  badUrl.imageUrl = `/course-decks/${binding.moduleId}/zu/slide-01.webp`;
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([badUrl]), /isiZulu WebP slide path/);

  const badImageHash = silentDraftFixture();
  badImageHash.imageSha256 = 'xyz';
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([badImageHash]), /Invalid image hash or byte size/);

  const badTargetHash = silentDraftFixture();
  badTargetHash.targetHash = 'abcd';
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([badTargetHash]), /Invalid target SHA-256/);

  const badBytes = silentDraftFixture();
  badBytes.imageBytes = 0;
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([badBytes]), /Invalid image hash or byte size/);

  const badWidth = silentDraftFixture();
  badWidth.width = 1439;
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([badWidth]), /dimensions must be 1440x5400 or taller/);

  const badHeight = silentDraftFixture();
  badHeight.height = 5399;
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([badHeight]), /dimensions must be 1440x5400 or taller/);

  const reviewed = silentDraftFixture();
  reviewed.reviewStatus = 'reviewed' as 'unreviewed';
  assert.throws(() => createIsiZuluSilentDeckDraftRegistry([reviewed]), /must remain unreviewed/);

  const forgedRow = Object.freeze({
    ...silentDraftFixture(),
    sourceEnglish: Object.freeze([...binding.source]),
    correctedTarget: Object.freeze(['Forged row']),
  });
  const forgedRegistry = Object.freeze({ [`${binding.moduleId}:${binding.slide}`]: forgedRow });
  assert.equal(resolveSilentDraftFromRegistry(forgedRegistry, binding.moduleId, binding.slide), null,
    'freezing caller-created objects does not turn them into factory-checked registry authority');
  assert.deepEqual(Object.keys(createIsiZuluSilentDeckDraftRegistry([])), []);
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
      const silentDraft = resolveRegisteredSilentDraft(binding.moduleId, binding.slide);
      if (silentDraft) {
        assert.deepEqual(shown, {
          url: silentDraft.imageUrl,
          lang: 'zu',
          exact: true,
          aspectRatio: silentDraft.width / silentDraft.height,
        }, `${binding.moduleId} slide ${binding.slide}: reviewed correction can provide a silent still while the old track stays held`);
      } else {
        assert.deepEqual(shown, {
          url: slideImageUrl(binding.moduleId, 'en', binding.slide),
          lang: 'en',
          exact: false,
        }, `${binding.moduleId} slide ${binding.slide}: flagged wording uses English until a corrected still is registered`);
      }
    } else {
      const silentDraft = resolveRegisteredSilentDraft(binding.moduleId, binding.slide);
      if (silentDraft) {
        assert.deepEqual(shown, {
          url: silentDraft.imageUrl,
          lang: 'zu',
          exact: true,
          aspectRatio: silentDraft.width / silentDraft.height,
        }, `${binding.moduleId} slide ${binding.slide}: the exact-source silent still is selected`);
      } else {
        assert.deepEqual(shown, { url: binding.imageUrl, lang: 'zu', exact: true },
          `${binding.moduleId} slide ${binding.slide}: an unflagged pair without a silent revision keeps its ZU still`);
      }
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
  // 2026-10-06: hashes above still protect the archived pair/audio; updated published text is silent.
  assert.equal(trackUrl('intro-permaculture', 'st', 22), null);
  assert.equal(fullNarrationUrl('intro-permaculture', 'st'), null);
  assert.deepEqual(slideImageFor('intro-permaculture', 'st', 22), {
    url: '/course-decks/intro-permaculture/st-silent/slide-22.webp', lang: 'st', exact: true, aspectRatio: 1440 / 5400,
  }, 'ST Introduction uses its new exact-source silent pair; archived bytes remain protected above');
});

test('all 28 independent isiZulu meaning flags suppress only their exact slides and affected full tracks', () => {
  // 8 October 2026: Intro14's silent card now says the arrangement is integration;
  // the preserved recording omits that clause, so suppress only that exact slide's audio.
  const expected = [
    'intro-permaculture:6', 'intro-permaculture:7', 'intro-permaculture:14', 'intro-permaculture:22',
    'reading-landscape:5', 'reading-landscape:14', 'reading-landscape:15', 'reading-landscape:16',
    'food-forest:11',
    'soil-health:1',
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
  assert.equal(fullNarrationUrl('food-forest', 'zu'), null,
    'the isiZulu Food Forest continuous track stays unavailable beside its exact slide-11 hold');
  assert.equal(fullNarrationUrl('food-forest', 'en'), '/course-audio/food-forest/en/full.mp3',
    'the isiZulu hold does not affect the English narration');
  assert.ok(entries.every(({ reason }) => reason.trim().length > 40), 'every hold names its specific source risk');
  const soilSlide13 = ISIZULU_DECK_SOURCE_BINDINGS.find(({ moduleId, slide }) => moduleId === 'soil-health' && slide === 13);
  assert.ok(soilSlide13, 'Soil Health slide 13 has an immutable English/recorded ZU pair');
  assert.equal(soilSlide13.sourceHeading, 'Keep Seed Pods and Contaminants Out',
    'the heading is generic and does not add the body’s wattle detail');
  assert.ok(soilSlide13.recordedTarget[0].includes('wattle'),
    'the unchanged recorded body preserves the source-specific wattle instruction');
  const soilSlide13Pair = resolveIsiZuluDeckSourcePair('soil-health', 13);
  assert.deepEqual(soilSlide13Pair?.source, soilSlide13.source);
  assert.deepEqual(soilSlide13Pair?.recordedTarget, soilSlide13.recordedTarget);
  assert.equal(isiZuluDeckReviewHold('soil-health', 13), null,
    'a generic title may accompany a more specific, correctly paired body without creating a false hold');
  assert.equal(trackUrl('soil-health', 'zu', 13), soilSlide13.audioUrl,
    'the existing ZU recording remains playable because its body still matches its exact source snapshot');
  assert.deepEqual(slideImageFor('soil-health', 'zu', 13), {
    url: soilSlide13.imageUrl, lang: 'zu', exact: true,
  }, 'the existing ZU slide remains visible beside that recorded body');
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

test('one changed source row withdraws its clip while an independently held full ZU track stays unavailable', () => {
  const moduleId = 'food-forest';
  const slide = 1;
  const mutableTranscripts = COURSE_TRANSCRIPTS as unknown as Record<string, Record<string, Record<number, string[]>>>;
  const target = mutableTranscripts[moduleId].zu[slide];
  assert.equal(isiZuluDeckReviewHold(moduleId, slide), null);
  assert.equal(fullNarrationUrl(moduleId, 'zu'), null,
    'another slide has an exact meaning hold, so the continuous recording is already unavailable');

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
