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
const evidence = JSON.parse(readFileSync('docs/study-translation-reviews/SOIL-HEALTH-REGIONAL-SILENT-SLIDES-2026-10-03.json', 'utf8')) as Evidence;
const latestEvidence = JSON.parse(readFileSync('docs/study-translation-reviews/SOIL-SOURCE-PAIRED-SLIDES-RENDER-VERIFICATION-2026-10-03.json', 'utf8')) as LatestEvidence;
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

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
    const rows = evidence.candidateRows.filter((row) => row.languageCode === lang);
    assert.equal(rows.length, 5);
    for (const row of rows) {
      const slide = slides[row.slideNumber - 1];
      assert.equal(slide.english.body[row.bodyPartIndex], row.pairedSourceExactEnglish,
        `${lang} slide ${row.slideNumber} must remain attached to its exact English source`);
      assert.deepEqual(slide.target.body[row.bodyPartIndex], { status: 'draft', text: row.candidate });
      assert.equal(row.renderedSlideAsset, `public/course-decks/soil-health/${lang}/slide-${String(row.slideNumber).padStart(2, '0')}.webp`);
    }

    const latestRows = latestEvidence.targetFieldChanges.filter((row) => row.language === lang);
    assert.equal(latestRows.length, lang === 've' ? 34 : 33,
      `${lang}: verify each newly reused or bounded field recorded for this language`);
    const baseline = evidence.pairedInputs.find((item) => item.language === lang)!;
    const restored = structuredClone(packet.slides);
    for (const row of latestRows) {
      const target = slides[row.slide - 1].target.body[row.bodyIndex];
      assert.equal(slides[row.slide - 1].english.body[row.bodyIndex], row.sourceEnglish,
        `${lang} slide ${row.slide}: current target keeps the exact recorded source`);
      assert.deepEqual(target, row.currentTarget,
        `${lang} slide ${row.slide}: retain the actual latest reviewed target field`);
      restored[row.slide - 1].target.body[row.bodyIndex] = structuredClone(row.previousTarget);
    }
    // Rewind the newer source-paired batch first, then the original fifteen drafts.
    // This reconstructs the same historical baseline without mistaking authorized new drafts for unrelated edits.
    for (const row of rows) restored[row.slideNumber - 1].target.body[row.bodyPartIndex] = { status: 'english-hold' };
    const reconstructedHash = sha(JSON.stringify(restored));
    assert.equal(reconstructedHash, baseline.baselineSlidesSha256,
      `${lang}: all non-target fields and target cells reconstruct the reviewed baseline`);
    assert.equal(reconstructedHash, baseline.reconstructedSlidesSha256);
  }
});

test('all sixty Soil frames retain their rendered proof while only the forty intended frames change', () => {
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

  for (const row of latestEvidence.changed) {
    const bytes = readFileSync(row.path);
    assert.equal(sha(bytes), row.sha256, `${row.path}: retain visually inspected rendered bytes`);
    assert.equal(bytes.length, row.bytes, `${row.path}: retain the inspected file size`);
    assert.notEqual(row.sha256, row.baselineSha256, `${row.path}: a changed target must redraw its intended frame`);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  for (const row of latestEvidence.preservedAssetProof) {
    const bytes = readFileSync(row.path);
    assert.equal(sha(bytes), row.sha256, `${row.path}: retain the reviewed unaffected frame`);
    assert.equal(bytes.length, row.bytes, `${row.path}: retain the source-matched frame size`);
    assert.equal(row.sha256, row.baselineSha256, `${row.path}: untargeted regional frame remains byte-identical`);
  }
  for (const row of evidence.preservedEnglishArt) {
    const bytes = readFileSync(row.path);
    assert.equal(bytes.length, row.bytes);
    assert.equal(sha(bytes), row.sha256, `${row.path}: source illustration remains unchanged`);
  }
});
