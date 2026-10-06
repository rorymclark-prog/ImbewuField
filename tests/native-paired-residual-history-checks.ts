import { finalLanguageNextPairedBytesBefore, finalLanguageNextDeckBeforeHistory } from './final-language-next-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';

const root = '../docs/study-translation-reviews/final-native-ordinary-application-2026-10-06/native-paired-residual-layer-2026-10-06/';
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const fieldBytes = readFileSync(new URL(`${root}applied-fields.json`, import.meta.url));
const fileHashBytes = readFileSync(new URL(`${root}file-hashes.json`, import.meta.url));
assert.equal(digest(fieldBytes), 'c879a58dd82a02eb27d5b876dcaca431682572bf6e2b4842880dcfefa170c914',
  'the frozen 13-cell source/target authority stays exact');
assert.equal(digest(fileHashBytes), '5d764194deca1698eb90fe885a5392b0d1bd4878684b6dd29197f8ce2d39b646',
  'the newest full-file before/after hashes stay exact');
const proof = JSON.parse(fieldBytes.toString());
const hashes = JSON.parse(fileHashBytes.toString());
const paths = [...new Set(proof.fields.map((row: any) => row.paired.path))] as string[];
assert.equal(proof.fields.length, 13, 'the accepted paired layer contains exactly thirteen cells');
assert.equal(paths.length, 6, 'the accepted paired layer covers six complete paired files');

function canonicalSource(row: any): string {
  const module = COURSE_MODULES.find(item => item.id === row.moduleId);
  assert.ok(module, `${row.moduleId}: canonical module exists`);
  const lesson = module.lessons.find(item => item.id === row.native.lessonId);
  assert.ok(lesson, `${row.native.lessonId}: canonical lesson exists`);
  const match = row.native.fieldLocator.match(/^body\.paragraph\[(\d+)\]$/);
  assert.ok(match, `${row.native.fieldLocator}: paired ordinary row has an exact paragraph locator`);
  return lesson.body.split('\n\n')[Number(match[1])];
}

function visible(target: any): string {
  return target.status === 'mixed'
    ? target.segments.map((part: any) => part.status === 'draft' ? part.text : part.sourceEnglish).join('')
    : target.text;
}

/** Check every current pair file/cell before returning this layer's complete previous deck. */
export function deckBeforeNativePairedResidual<T extends { language: string; slides: any[] }>(actual: T, moduleId: 'vegetables-staples' | 'market-community'): T {
  const currentFiles: Record<string, any> = {};
  for (const path of paths) {
    // Later 39 paired cells must pass their entire current layer before this older hash.
    const bytes = Buffer.from(finalLanguageNextPairedBytesBefore(path, readFileSync(path)));
    const expectedHash = hashes[path];
    assert.ok(expectedHash, `${path}: newest layer has a full-file hash binding`);
    assert.equal(digest(bytes), expectedHash.after, `${path}: current complete paired file hash matches the accepted after-state`);
    const current = JSON.parse(bytes.toString());
    const acceptedAfter = JSON.parse(readFileSync(new URL(`${root}after/paired-files/${path.split('/').pop()}`, import.meta.url), 'utf8'));
    assert.deepEqual(current, acceptedAfter, `${path}: full current deck, including every unlisted field, matches accepted after`);
    const previous = JSON.parse(readFileSync(new URL(`${root}before/paired-files/${path.split('/').pop()}`, import.meta.url), 'utf8'));
    assert.equal(digest(readFileSync(new URL(`${root}before/paired-files/${path.split('/').pop()}`, import.meta.url))), expectedHash.before,
      `${path}: complete pre-residual deck matches its frozen before hash`);
    currentFiles[path] = { current, previous };
  }

  for (const row of proof.fields) {
    const source = canonicalSource(row);
    assert.equal(source, row.sourceEnglish, `${row.order}: current canonical source remains exact`);
    assert.equal(row.paired.sourceJoin, source, `${row.order}: accepted source segments join to the canonical paragraph`);
    assert.equal(row.paired.sourceJoinExact, true, `${row.order}: the complete source join is proven`);
    assert.equal(row.paired.renderedTarget, row.native.appliedTarget, `${row.order}: reviewed render equals the full native target`);
    assert.equal(row.paired.renderedEqualsNative, true, `${row.order}: deck rendering remains identical to its native field`);
    const doc = currentFiles[row.paired.path]?.current;
    assert.ok(doc, `${row.order}: paired authority file is part of the complete checked set`);
    const slide = doc.slides.find((entry: any) => entry.n === row.paired.slide);
    assert.ok(slide, `${row.order}: accepted slide index exists`);
    assert.equal(slide.english.body[row.paired.bodyIndex], source, `${row.order}: exact source remains at its accepted body index`);
    const target = slide.target.body[row.paired.bodyIndex];
    assert.deepEqual(target, row.paired.appliedTarget, `${row.order}: full current target/status/provenance equals accepted target`);
    assert.equal(visible(target), row.paired.renderedTarget, `${row.order}: learner-visible composition equals the accepted full target`);
  }

  const pairedPath = `docs/narration/${moduleId}.${actual.language}.paired-draft.json`;
  assert.ok(currentFiles[pairedPath], `${actual.language}: caller deck belongs to the validated six-file set`);
  assert.deepEqual(finalLanguageNextDeckBeforeHistory(pairedPath, actual), currentFiles[pairedPath].current, `${pairedPath}: caller supplied the verified current deck`);
  return structuredClone(currentFiles[pairedPath].previous);
}

export function vegetablesDeckBeforeNativePairedResidual<T extends { language: string; slides: any[] }>(actual: T): T {
  return deckBeforeNativePairedResidual(actual, 'vegetables-staples');
}
