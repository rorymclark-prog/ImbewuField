import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

type Data = Record<string, any>;
const root = 'docs/study-translation-reviews/soil-water-residual-2026-10-06/';
const baselineBytes = readFileSync(root + 'baseline-before.json');
const baseline = JSON.parse(baselineBytes.toString()) as Data;
const proofBytes = readFileSync('docs/study-translation-reviews/soil-water-residual-implementation-2026-10-06.json');
const proof = JSON.parse(proofBytes.toString()) as Data;
const mediaBytes = readFileSync('docs/media/soil-water-residual-2026-10-06/frames.json');
const media = JSON.parse(mediaBytes.toString()) as Data;
const sizeBeforeBytes = readFileSync(root + 'asset-sizes-before.json');
const sizeBefore = JSON.parse(sizeBeforeBytes.toString()) as Data;
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const keyFor = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;

function assertBoundProof() {
  assert.equal(hash(baselineBytes), '691fa5d8108366d09df19875bc77e01575ca30979fc67cae21ed3dcc39c1cbe7');
  assert.equal(hash(proofBytes), 'eec8f0206784f039323d9eb5ce84be6b409b25e632ec6f7d9470f8f32acd398b');
  assert.equal(hash(mediaBytes), 'abfc32697890076025c169f4efa854ef433e30107a23776e7a76c4e353afb9d3');
  assert.equal(proof.actualNativeLeafDeltas.length, 46);
  assert.equal(proof.actualPairedCellDeltas.length, 19);
  assert.equal(hash(sizeBeforeBytes), '4def1431e09db640069dfc013642c2e313ccef5c2e45c86db4c0a40548559ea4');
}

function nativeSlot(native: Data, row: Data) {
  const lesson = native.lessons.find((item: Data) => item.id === row.lessonId);
  assert.ok(lesson, row.fieldId);
  let match = row.field.match(/^body(?:\.paragraph)?\[(\d+)\]$/);
  if (match) {
    const index = Number(match[1]);
    return {
      source: lesson.body.sourceEnglish.split('\n\n')[index],
      target: lesson.body[keyFor[row.language as keyof typeof keyFor]].split('\n\n')[index],
      status: lesson.body.reviewStatus,
      set(target: string) {
        const key = keyFor[row.language as keyof typeof keyFor];
        const paragraphs = lesson.body[key].split('\n\n');
        paragraphs[index] = target;
        lesson.body[key] = paragraphs.join('\n\n');
      },
    };
  }
  let pair: Data;
  if (row.field === 'title' || row.field === 'infographicAlt') pair = lesson[row.field];
  else if ((match = row.field.match(/^keyPoints\[(\d+)\]$/))) pair = lesson.keyPoints[Number(match[1])];
  else if ((match = row.field.match(/^quiz\[(\d+)\]\.(question|rationale)$/))) pair = lesson.quiz[Number(match[1])][match[2]];
  else if ((match = row.field.match(/^quiz\[(\d+)\]\.options?\[(\d+)\]$/))) pair = lesson.quiz[Number(match[1])].options[Number(match[2])];
  else throw new Error(`Unmapped residual history field ${row.fieldId}`);
  const key = keyFor[row.language as keyof typeof keyFor];
  return {
    source: pair.sourceEnglish,
    target: pair[key],
    status: pair.reviewStatus,
    set(target: string) { pair[key] = target; },
  };
}

/** Rebuild the exact new native objects from the immutable pre-residual snapshot. */
export function soilWaterResidualNativeAfter(language: 'st' | 've' | 'ts', moduleId: 'soil-health' | 'water-harvesting'): Data {
  assertBoundProof();
  const path = `lib/course-translation-drafts-${language}-${moduleId === 'soil-health' ? 'soil-health' : 'water-harvesting'}.ts`;
  const expected = structuredClone(baseline.nativeBefore[path]) as Data;
  const rows = (proof.actualNativeLeafDeltas as Data[]).filter((row: Data) => row.path === path);
  for (const row of rows) {
    const slot = nativeSlot(expected, row);
    assert.equal(slot.source, row.sourceEnglish, row.fieldId);
    assert.equal(slot.target, row.before, row.fieldId);
    assert.equal(slot.status, row.statusBefore, row.fieldId);
    slot.set(row.after);
  }
  return expected;
}

/** Verify the complete new live native object, then expose its exact pre-residual layer. */
export function soilWaterResidualNativeBefore<T extends Data>(language: 'st' | 've' | 'ts', moduleId: 'soil-health' | 'water-harvesting', current: T): T {
  const expected = soilWaterResidualNativeAfter(language, moduleId);
  const path = `lib/course-translation-drafts-${language}-${moduleId === 'soil-health' ? 'soil-health' : 'water-harvesting'}.ts`;
  assert.deepEqual(current, expected, `${path}: complete current residual state matches the accepted source-bound layer`);
  return structuredClone(baseline.nativeBefore[`lib/course-translation-drafts-${language}-${moduleId === 'soil-health' ? 'soil-health' : 'water-harvesting'}.ts`]) as T;
}

/** Verify all 19 cells and every unlisted deck object before rewinding this layer. */
export function soilWaterResidualPairedBefore<T extends { slides: Data[] }>(deck: T, path: string): T {
  assertBoundProof();
  const prior = structuredClone(baseline.pairedBefore[path]) as T;
  assert.ok(prior, path);
  const expected = structuredClone(prior) as T;
  const rows = (proof.actualPairedCellDeltas as Data[]).filter((row: Data) => row.path === path);
  for (const row of rows) {
    const slide = expected.slides[row.slide - 1];
    assert.ok(slide, row.fieldId);
    const source = row.field === 'heading' ? slide.english.heading : slide.english.body[row.bodyIndex];
    const cell = row.field === 'heading' ? slide.target.heading : slide.target.body[row.bodyIndex];
    assert.equal(source, row.sourceEnglish, row.fieldId);
    assert.equal(cell.text, row.before, row.fieldId);
    assert.equal(cell.status, row.statusBefore, row.fieldId);
    assert.equal(cell.provenance, row.provenanceBefore, row.fieldId);
    cell.text = row.after;
    cell.status = row.statusAfter;
    cell.provenance = row.provenanceAfter;
  }
  assert.deepEqual(deck, expected, `${path}: complete current residual state matches accepted cells and preserves unlisted deck data`);
  return prior;
}

/** Validate current frame bytes and rewind only the 18 measured manifest entries for earlier media guards. */
export function soilWaterResidualAssetSizesBefore(currentManifest?: string): string {
  assertBoundProof();
  const manifest = currentManifest ?? readFileSync('lib/course-asset-sizes.ts', 'utf8');
  assert.equal(hash(Buffer.from(manifest)), media.courseAssetSizesAggregate.sha256After);
  let prior = manifest;
  for (const frame of media.renderedFrames as Data[]) {
    const asset = '/' + frame.path.replace(/^public\//, '');
    const oldBytes = sizeBefore.entries[asset];
    assert.ok(oldBytes, `${asset}: old size is bound to the pre-residual manifest`);
    const currentEntry = `'${asset}': ${frame.bytes}`;
    assert.equal(prior.split(currentEntry).length - 1, 1, `${asset}: current measured size appears once`);
    prior = prior.replace(currentEntry, `'${asset}': ${oldBytes}`);
  }
  const currentSummary = media.courseAssetSizesAggregate.generatedSummaryLine;
  assert.equal(prior.split(currentSummary).length - 1, 1, 'the generated summary line appears once');
  prior = prior.replace(currentSummary, sizeBefore.priorSummaryLine);
  assert.equal(hash(Buffer.from(prior)), sizeBefore.sourceSha256,
    'rewinding only the 18 residual sizes and aggregate restores the complete prior manifest');
  return prior;
}

export function soilWaterResidualValidateCurrentFrames(): void {
  assertBoundProof();
  for (const frame of media.renderedFrames as Data[]) {
    const bytes = readFileSync(frame.path);
    assert.equal(hash(bytes), frame.sha256After, `${frame.path}: current residual frame SHA is exact`);
    assert.equal(bytes.length, frame.bytes, `${frame.path}: current residual frame size is exact`);
  }
}

export function soilWaterResidualMediaBefore(path: string): { sha256: string; bytes: number } | null {
  assertBoundProof();
  const frame = (media.renderedFrames as Data[]).find((row: Data) => row.path === path);
  if (!frame) return null;
  const bytes = readFileSync(path);
  assert.equal(hash(bytes), frame.sha256After, `${path}: current frame must match the approved render`);
  assert.equal(bytes.length, frame.bytes, `${path}: current frame byte count must match the measured render`);
  return { sha256: frame.sha256Before, bytes: sizeBefore.entries['/' + path.replace(/^public\//, '')] };
}
