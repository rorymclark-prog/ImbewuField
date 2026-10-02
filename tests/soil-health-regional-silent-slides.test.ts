import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';

type Evidence = {
  baselineHead: string;
  candidateRows: Array<{ languageCode: string; languageName: string; slideNumber: number; bodyPartIndex: number; pairedSourceExactEnglish: string; candidate: string; renderedSlideAsset: string }>;
  pairedInputs: Array<{ language: string; path: string; baselineSlidesSha256: string; reconstructedSlidesSha256: string }>;
  changedAssets: Array<{ path: string; sha256: string; baselineSha256: string }>;
  preservedRegionalAssets: Array<{ path: string; sha256: string; baselineSha256: string }>;
  preservedEnglishArt: Array<{ path: string; sha256: string; bytes: number }>;
};
const evidence = JSON.parse(readFileSync('docs/study-translation-reviews/SOIL-HEALTH-REGIONAL-SILENT-SLIDES-2026-10-03.json', 'utf8')) as Evidence;
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
    const baseline = evidence.pairedInputs.find((item) => item.language === lang)!;
    const restored = structuredClone(packet.slides);
    for (const row of rows) restored[row.slideNumber - 1].target.body[row.bodyPartIndex] = { status: 'english-hold' };
    const reconstructedHash = sha(JSON.stringify(restored));
    assert.equal(reconstructedHash, baseline.baselineSlidesSha256,
      `${lang}: all non-target fields and target cells reconstruct the reviewed baseline`);
    assert.equal(reconstructedHash, baseline.reconstructedSlidesSha256);
  }
});

test('only the twelve inspected Soil frames change; all other regional frames and source art stay byte-identical', () => {
  assert.equal(evidence.changedAssets.length, 12);
  assert.equal(evidence.preservedRegionalAssets.length, 48);
  assert.equal(evidence.preservedEnglishArt.length, 4);
  for (const row of evidence.changedAssets) {
    const bytes = readFileSync(row.path);
    assert.equal(sha(bytes), row.sha256, `${row.path}: retain visually inspected rendered bytes`);
    assert.notEqual(row.sha256, row.baselineSha256, `${row.path}: intended frame must actually differ from baseline`);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  for (const row of evidence.preservedRegionalAssets) {
    const bytes = readFileSync(row.path);
    assert.equal(sha(bytes), row.sha256, `${row.path}: retain the reviewed unaffected frame`);
    assert.equal(row.sha256, row.baselineSha256, `${row.path}: untargeted regional frame equals baseline`);
  }
  for (const row of evidence.preservedEnglishArt) {
    const bytes = readFileSync(row.path);
    assert.equal(bytes.length, row.bytes);
    assert.equal(sha(bytes), row.sha256, `${row.path}: source illustration remains unchanged`);
  }
});
