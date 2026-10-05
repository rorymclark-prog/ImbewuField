import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';

type Evidence = {
  baselineHead: string;
  candidateRows: Array<{ languageCode: string; languageName: string; slideNumber: number; bodyPartIndex: number; pairedSourceExactEnglish: string; candidate: string; renderedSlideAsset: string }>;
  pairedInputs: Array<{ language: string; path: string; baselineSlidesSha256: string; reconstructedSlidesSha256: string }>;
  preservedEnglishArt: Array<{ path: string; sha256: string; bytes: number }>;
};
type LatestEvidence = {
  targetFieldChanges: Array<{
    language: string;
    slide: number;
    bodyIndex: number;
    sourceEnglish: string;
    previousTarget: unknown;
    currentTarget: unknown;
  }>;
  changed: Array<{ path: string; sha256: string; baselineSha256: string; bytes: number }>;
  preservedAssetProof: Array<{ path: string; sha256: string; baselineSha256: string; bytes: number }>;
};
type OrdinaryEvidence = {
  targetFieldChanges: Array<{
    module: string;
    language: string;
    slide: number;
    field: 'heading' | 'body';
    bodyIndex: number | null;
    sourceEnglish: string;
    previousTarget: unknown;
    currentTarget: unknown;
  }>;
};
type FrameProof = {
  decks: Array<{
    module: string;
    language: string;
    pairedSource: string;
    pairedSourceSha256: string;
    changedSlides: number[];
    changed: Array<{ path: string; sha256: string; baselineSha256: string; bytes: number }>;
    preserved: Array<{ path: string; sha256: string; baselineSha256: string; bytes: number }>;
  }>;
};
const evidence = JSON.parse(readFileSync('docs/study-translation-reviews/SOIL-HEALTH-REGIONAL-SILENT-SLIDES-2026-10-03.json', 'utf8')) as Evidence;
const latestEvidence = JSON.parse(readFileSync('docs/study-translation-reviews/SOIL-SOURCE-PAIRED-SLIDES-RENDER-VERIFICATION-2026-10-03.json', 'utf8')) as LatestEvidence;
const ordinaryEvidence = JSON.parse(readFileSync('docs/study-translation-reviews/SOIL-WATER-ORDINARY-SLIDES-2026-10-05.json', 'utf8')) as OrdinaryEvidence;
const frameProof = JSON.parse(readFileSync('docs/media/soil-water-ordinary-2026-10-05/frames.json', 'utf8')) as FrameProof;
const fullerEvidence = JSON.parse(readFileSync('docs/study-translation-reviews/SOIL-DECK-FULLER-LEARNER-REUSE-2026-10-05.json', 'utf8')) as LatestEvidence;
const fullerFrames = JSON.parse(readFileSync('docs/media/soil-learner-fuller-2026-10-05/frames.json', 'utf8')) as { changed: LatestEvidence['changed']; preserved: Array<{ path: string; sha256: string; bytes: number }>; pairedSourceHashes: Record<string, string> };
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
// Headings and paragraphs changed by the 4–5 October ordinary-prose completion (see the review README).
const ordinarySoilFields = { st: 34, ve: 36, ts: 40 } as const;

test('Soil slide drafts remain paired to the exact narration and preserve every untouched target cell', () => {
  const source = englishSlideRecords(readFileSync('docs/narration/soil-health.en.md', 'utf8'));
  assert.equal(evidence.candidateRows.length, 15);
  for (const lang of ['st', 've', 'ts'] as const) {
    const file = `docs/narration/soil-health.${lang}.paired-draft.json`;
    const packet = JSON.parse(readFileSync(file, 'utf8'));
    const slides = validatePairedDraft(packet, source, lang);
    const driftedSource = structuredClone(source);
    driftedSource[0].body[1] += ' changed after review';
    assert.throws(() => validatePairedDraft(packet, driftedSource, lang), /English body differs from narration/,
      `${lang}: changing the canonical source must invalidate this paired draft`);
    assert.equal(packet.reviewStatus, 'unreviewed');
    // Rewind newest first: the 4–5 October ordinary-prose layer (headings and bodies), then the 3 October source-paired
    // batch, then the original fifteen drafts. Each layer's recorded value is checked against the state the newer layers
    // leave behind, so every authorized edit is bound to its exact source and no other target cell can move.
    const restored = structuredClone(packet.slides);
    // The later fuller-learner batch superseded 69 dated targets. Verify current values first, then reconstruct
    // the prior reviewed state so historical untouched-cell coverage remains able to catch regressions.
    const fullerRows = fullerEvidence.targetFieldChanges.filter((row) => row.language === lang);
    assert.equal(fullerRows.length, { st: 17, ve: 25, ts: 27 }[lang]);
    for (const row of fullerRows) {
      const slide = restored[row.slide - 1];
      assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish);
      assert.deepEqual(slide.target.body[row.bodyIndex], row.currentTarget);
      slide.target.body[row.bodyIndex] = structuredClone(row.previousTarget);
    }
    const ordinaryRows = ordinaryEvidence.targetFieldChanges.filter((row) => row.module === 'soil-health' && row.language === lang);
    assert.equal(ordinaryRows.length, ordinarySoilFields[lang],
      `${lang}: verify each ordinary-prose field recorded for this language`);
    for (const row of ordinaryRows) {
      const slide = restored[row.slide - 1];
      if (row.field === 'heading') {
        assert.equal(slide.english.heading, row.sourceEnglish, `${lang} slide ${row.slide}: heading keeps its exact source`);
        assert.deepEqual(slide.target.heading, row.currentTarget, `${lang} slide ${row.slide}: retain the recorded heading draft`);
        slide.target.heading = structuredClone(row.previousTarget);
      } else {
        const bodyIndex = row.bodyIndex!;
        assert.equal(slide.english.body[bodyIndex], row.sourceEnglish, `${lang} slide ${row.slide}: body keeps its exact source`);
        assert.deepEqual(slide.target.body[bodyIndex], row.currentTarget, `${lang} slide ${row.slide}: retain the recorded draft`);
        slide.target.body[bodyIndex] = structuredClone(row.previousTarget);
      }
    }

    const latestRows = latestEvidence.targetFieldChanges.filter((row) => row.language === lang);
    assert.equal(latestRows.length, lang === 've' ? 34 : 33,
      `${lang}: verify each newly reused or bounded field recorded for this language`);
    const baseline = evidence.pairedInputs.find((item) => item.language === lang)!;
    for (const row of latestRows) {
      assert.equal(restored[row.slide - 1].english.body[row.bodyIndex], row.sourceEnglish,
        `${lang} slide ${row.slide}: current target keeps the exact recorded source`);
      assert.deepEqual(restored[row.slide - 1].target.body[row.bodyIndex], row.currentTarget,
        `${lang} slide ${row.slide}: retain the actual latest reviewed target field`);
      restored[row.slide - 1].target.body[row.bodyIndex] = structuredClone(row.previousTarget);
    }

    const rows = evidence.candidateRows.filter((row) => row.languageCode === lang);
    assert.equal(rows.length, 5);
    for (const row of rows) {
      assert.equal(slides[row.slideNumber - 1].english.body[row.bodyPartIndex], row.pairedSourceExactEnglish,
        `${lang} slide ${row.slideNumber} must remain attached to its exact English source`);
      assert.deepEqual(restored[row.slideNumber - 1].target.body[row.bodyPartIndex], { status: 'draft', text: row.candidate });
      assert.equal(row.renderedSlideAsset, `public/course-decks/soil-health/${lang}/slide-${String(row.slideNumber).padStart(2, '0')}.webp`);
      restored[row.slideNumber - 1].target.body[row.bodyPartIndex] = { status: 'english-hold' };
    }
    const reconstructedHash = sha(JSON.stringify(restored));
    assert.equal(reconstructedHash, baseline.baselineSlidesSha256,
      `${lang}: all non-target fields and target cells reconstruct the reviewed baseline`);
    assert.equal(reconstructedHash, baseline.reconstructedSlidesSha256);
  }
});

test('all sixty Soil frames retain their rendered proof while only the intended frames change', () => {
  assert.equal(latestEvidence.changed.length, 40);
  assert.equal(latestEvidence.preservedAssetProof.length, 20);
  assert.equal(evidence.preservedEnglishArt.length, 4);
  const allRegionalPaths = [
    ...latestEvidence.changed.map((row) => row.path),
    ...latestEvidence.preservedAssetProof.map((row) => row.path),
  ];
  const expectedRegionalPaths = ['st', 've', 'ts'].flatMap((lang) =>
    Array.from({ length: 20 }, (_, slide) =>
      `public/course-decks/soil-health/${lang}/slide-${String(slide + 1).padStart(2, '0')}.webp`));
  assert.equal(new Set(allRegionalPaths).size, 60, 'each regional frame appears exactly once in the visual proof');
  assert.deepEqual([...allRegionalPaths].sort(), expectedRegionalPaths.sort(),
    'the proof covers all twenty Soil frames in each regional language');

  // Rewritten 5 October 2026: the ordinary-prose render redrew the frames whose paired target changed. Each redraw
  // must start from the bytes inspected on 3 October, and every frame it left alone must still match that proof.
  const soilDecks = frameProof.decks.filter((deck) => deck.module === 'soil-health');
  assert.equal(soilDecks.length, 3);
  const redrawn = new Map(soilDecks.flatMap((deck) => deck.changed).map((row) => [row.path, row]));
  const untouched = new Map(soilDecks.flatMap((deck) => deck.preserved).map((row) => [row.path, row]));
  assert.equal(redrawn.size + untouched.size, 60, 'the ordinary-prose render accounts for every regional Soil frame once');
  for (const deck of soilDecks) {
    const packet = JSON.parse(readFileSync(deck.pairedSource, 'utf8'));
    assert.equal(sha(readFileSync(deck.pairedSource)), fullerFrames.pairedSourceHashes[deck.language],
      `${deck.language}: latest rendered frames bind the actual paired draft`);
    for (const row of fullerEvidence.targetFieldChanges.filter((row) => row.language === deck.language)) {
      assert.deepEqual(packet.slides[row.slide - 1].target.body[row.bodyIndex], row.currentTarget);
      packet.slides[row.slide - 1].target.body[row.bodyIndex] = structuredClone(row.previousTarget);
    }
    assert.equal(deck.pairedSourceSha256, sha(JSON.stringify(packet, null, 2) + '\n'),
      `${deck.language}: the newer layer reconstructs the prior paired input exactly`);
  }

  for (const row of latestEvidence.changed) {
    assert.notEqual(row.sha256, row.baselineSha256, `${row.path}: a changed target must redraw its intended frame`);
  }
  for (const row of latestEvidence.preservedAssetProof) {
    assert.equal(row.sha256, row.baselineSha256, `${row.path}: untargeted regional frame remained byte-identical on 3 October`);
  }
  const fullerRedrawn = new Map(fullerFrames.changed.map((row) => [row.path, row]));
  const fullerPreserved = new Map(fullerFrames.preserved.map((row) => [row.path, row]));
  assert.equal(fullerRedrawn.size, 34);
  for (const row of [...latestEvidence.changed, ...latestEvidence.preservedAssetProof]) {
    const bytes = readFileSync(row.path);
    const later = redrawn.get(row.path);
    const final = fullerRedrawn.get(row.path);
    const priorSha = later?.sha256 ?? row.sha256;
    const priorBytes = later?.bytes ?? row.bytes;
    if (final) {
      assert.equal(final.baselineSha256, priorSha, `${row.path}: fuller redraw starts from prior reviewed bytes`);
      assert.notEqual(final.sha256, final.baselineSha256);
      assert.equal(sha(bytes), final.sha256);
      assert.equal(bytes.length, final.bytes);
    } else {
      assert.equal(fullerPreserved.get(row.path)?.sha256, priorSha);
      assert.equal(sha(bytes), priorSha);
      assert.equal(bytes.length, priorBytes);
    }
    if (later) {
      assert.equal(later.baselineSha256, row.sha256, `${row.path}: the redraw starts from the 3 October proof`);
      assert.notEqual(later.sha256, later.baselineSha256, `${row.path}: a changed target redraws its frame`);
      // Current bytes were checked above; this assertion preserves the historical render chain.
    } else {
      assert.equal(untouched.get(row.path)?.sha256, row.sha256, `${row.path}: the ordinary-prose render left this frame alone`);
      // Current bytes were checked above, including every untargeted frame.
    }
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  for (const row of evidence.preservedEnglishArt) {
    const bytes = readFileSync(row.path);
    assert.equal(bytes.length, row.bytes);
    assert.equal(sha(bytes), row.sha256, `${row.path}: source illustration remains unchanged`);
  }
});
