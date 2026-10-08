import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { lightestManifestBefore } from './reading-title-lightest-media-history-checks.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const repositoryPath = (file: string) => resolve(root, file);
const folder = 'docs/study-translation-reviews/reading-title-lightest-next-2026-10-08/';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const proofBytes = readFileSync(repositoryPath(folder + 'applied-proof.json'));
const proofSha256 = '64bbf9d3875662a58e8b74b5a5a0b717266d66bd557eaf485f2716bae2210ab1';
assert.equal(sha(proofBytes), proofSha256, 'source-bound title/action proof remains immutable');
const proof = JSON.parse(proofBytes.toString()) as {
  completeFiles: Record<string, { beforeSha256: string; afterSha256: string; beforeBytes: number; afterBytes: number }>;
  nativeParagraph: { sourceEnglish: string; fullSourceEnglish: string; paragraphIndex: number; paragraphCount: number };
  nativeModuleSnapshots: { before: { path: string; sha256: string }; after: { path: string; sha256: string } };
  media: { renderProof: { path: string; sha256: string }; manifestProof: { path: string; sha256: string }; assetCount: number };
};
const changedPairs = new Set([
  'docs/narration/reading-landscape.st.paired-draft.json',
  'docs/narration/reading-landscape.ve.paired-draft.json',
  'docs/narration/reading-landscape.ts.paired-draft.json',
  'docs/narration/vegetables-staples.st.paired-draft.json',
]);
const snapshotName = (file: string) => file.endsWith('.ts') ? `${file.split('/').at(-1)}.txt` : file.split('/').at(-1)!;
let signature = '';

function ensureCurrentLayer(): void {
  const renderProof = readFileSync(repositoryPath(proof.media.renderProof.path));
  const manifestProof = readFileSync(repositoryPath(proof.media.manifestProof.path));
  assert.equal(sha(renderProof), proof.media.renderProof.sha256, 'compressed render and contact proof is immutable');
  assert.equal(sha(manifestProof), proof.media.manifestProof.sha256, 'complete manifest predecessor/output proof is immutable');
  const media = JSON.parse(renderProof.toString());
  assert.equal(media.cards.length, proof.media.assetCount);
  const files = [...Object.keys(proof.completeFiles), proof.nativeModuleSnapshots.before.path, proof.nativeModuleSnapshots.after.path,
    proof.media.renderProof.path, proof.media.manifestProof.path, ...media.cards.flatMap((row: any) => [row.asset, row.beforeAsset])];
  const next = files.map(file => {
    const stat = statSync(repositoryPath(file), { bigint: true });
    return [file, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
  }).join('|');
  if (next === signature) return;
  for (const [file, row] of Object.entries(proof.completeFiles)) {
    const before = readFileSync(repositoryPath(`${folder}before/${snapshotName(file)}`));
    const after = readFileSync(repositoryPath(file));
    assert.equal(before.byteLength, row.beforeBytes, `${file}: frozen full predecessor size`);
    assert.equal(sha(before), row.beforeSha256, `${file}: frozen full predecessor SHA`);
    assert.equal(after.byteLength, row.afterBytes, `${file}: current complete file size`);
    assert.equal(sha(after), row.afterSha256, `${file}: current source, target, status and unlisted bytes`);
  }
  for (const key of ['before', 'after'] as const) {
    const row = proof.nativeModuleSnapshots[key];
    assert.equal(sha(readFileSync(repositoryPath(row.path))), row.sha256, `full ${key} native registry snapshot is immutable`);
  }
  const currentMedia = media.cards.map((row: any) => {
    const bytes = readFileSync(repositoryPath(row.asset));
    assert.equal(bytes.length, row.afterBytes, `${row.asset}: exact current rendered bytes`);
    assert.equal(sha(bytes), row.afterSha256, `${row.asset}: exact current rendered SHA`);
    return row;
  });
  assert.equal(currentMedia.length, proof.media.assetCount);
  signature = next;
}

function pairSnapshot(file: string, phase: 'before' | 'after/paired'): any {
  return JSON.parse(readFileSync(repositoryPath(`${folder}${phase}/${file.split('/').at(-1)}`), 'utf8'));
}

/** Verify this newest exact layer before a historical deck test receives its predecessor. */
export function readingTitleLightestPairBefore<T>(file: string, actual: T): T {
  if (!changedPairs.has(file)) return actual;
  ensureCurrentLayer();
  const before = pairSnapshot(file, 'before');
  const after = pairSnapshot(file, 'after/paired');
  if (JSON.stringify(actual) === JSON.stringify(before)) return structuredClone(actual);
  assert.deepEqual(actual, after, `${file}: caller must supply the complete accepted current source/target/status/index and unlisted state`);
  return before as T;
}

/** Compose with older snapshots that have already rewound their own exact leaves. */
export function readingTitleLightestPairBeforeHistory<T>(file: string, actual: T): T {
  if (!changedPairs.has(file)) return actual;
  ensureCurrentLayer();
  const before = pairSnapshot(file, 'before');
  const after = pairSnapshot(file, 'after/paired');
  const restored: any = structuredClone(actual);
  if (file.includes('reading-landscape')) {
    const currentSlide = restored.slides.find((slide: any) => slide.n === 12);
    const beforeSlide = before.slides.find((slide: any) => slide.n === 12);
    const afterSlide = after.slides.find((slide: any) => slide.n === 12);
    assert.equal(currentSlide.english.heading, 'Lesson 3: Read Wind, Frost, and Slope', `${file}: exact canonical heading remains`);
    assert.equal(currentSlide.target.heading.status, afterSlide.target.heading.status, `${file}: heading review state is unchanged`);
    assert.ok(currentSlide.target.heading.text === beforeSlide.target.heading.text || currentSlide.target.heading.text === afterSlide.target.heading.text,
      `${file}: title is either the exact predecessor or accepted candidate`);
    currentSlide.target.heading = structuredClone(beforeSlide.target.heading);
    return restored;
  }
  const currentSlide = restored.slides.find((slide: any) => slide.n === 16);
  const beforeSlide = before.slides.find((slide: any) => slide.n === 16);
  const afterSlide = after.slides.find((slide: any) => slide.n === 16);
  assert.equal(currentSlide.english.body[4], beforeSlide.english.body[4], `${file}: exact canonical source remains`);
  const actualSegments = currentSlide.target.body[4].segments;
  assert.equal(actualSegments.map((segment: any) => segment.sourceEnglish).join(''), currentSlide.english.body[4], `${file}: ordered source segments remain complete`);
  const segmentIndex = 2;
  assert.ok(JSON.stringify(actualSegments[segmentIndex]) === JSON.stringify(beforeSlide.target.body[4].segments[segmentIndex])
    || JSON.stringify(actualSegments[segmentIndex]) === JSON.stringify(afterSlide.target.body[4].segments[segmentIndex]),
  `${file}: only the exact accepted predicate or its predecessor may be composed`);
  actualSegments[segmentIndex] = structuredClone(beforeSlide.target.body[4].segments[segmentIndex]);
  return restored;
}

/** Byte equivalent for historical validators that bind a whole paired file. */
export function readingTitleLightestFileBytesBefore(file: string, bytes: Uint8Array | string): Uint8Array | string {
  // The complete binary/manifest owner validates the exact live asset layer.
  // Once it has projected the live manifest, older source owners receive their
  // own exact frozen intermediate snapshots unchanged for their assertions.
  if (file === 'lib/course-asset-sizes.ts') {
    const live = readFileSync(repositoryPath(file));
    if (sha(Buffer.from(bytes).toString()) === sha(live.toString())) {
      const predecessor = lightestManifestBefore(live.toString());
      return typeof bytes === 'string' ? predecessor : Buffer.from(predecessor);
    }
    return bytes;
  }
  if (!(file in proof.completeFiles)) return bytes;
  ensureCurrentLayer();
  const current = Buffer.from(bytes).toString();
  const live = readFileSync(repositoryPath(file), 'utf8');
  const before = readFileSync(repositoryPath(`${folder}before/${snapshotName(file)}`));
  const afterFile = `${folder}after/${file.endsWith('.paired-draft.json') ? 'paired' : 'source'}/${snapshotName(file)}`;
  const after = readFileSync(repositoryPath(afterFile), 'utf8');
  if (current === live || current === after) return typeof bytes === 'string' ? before.toString() : before;
  if (current === before.toString()) return bytes;
  if (!file.endsWith('.paired-draft.json')) {
    assert.fail(`${file}: supplied bytes must be current or the exact accepted predecessor`);
  }
  const parsed = JSON.parse(current);
  const projected = readingTitleLightestPairBeforeHistory(file, parsed);
  if (JSON.stringify(projected) === JSON.stringify(parsed)) return bytes;
  const text = JSON.stringify(projected, null, 2) + '\n';
  return typeof bytes === 'string' ? text : Buffer.from(text);
}

/** Project the one native paragraph only after the complete registry is verified. */
export function readingTitleLightestNativeBefore<T>(actual: T): T {
  const identity = actual as any;
  if (identity?.id !== 'vegetables-staples' || identity?.language !== 'st') return actual;
  ensureCurrentLayer();
  const before = JSON.parse(readFileSync(repositoryPath(proof.nativeModuleSnapshots.before.path), 'utf8'));
  const after = JSON.parse(readFileSync(repositoryPath(proof.nativeModuleSnapshots.after.path), 'utf8'));
  if (JSON.stringify(actual) === JSON.stringify(before)) return structuredClone(actual);
  assert.deepEqual(actual, after, 'complete current registry: Sesotho Vegetables must match the accepted full after snapshot');
  return before as T;
}

/** Preserve old registry compositions after this exact learner paragraph is verified. */
export function readingTitleLightestNativeBeforeHistory<T>(actual: T): T {
  const identity = actual as any;
  if (identity?.id !== 'vegetables-staples' || identity?.language !== 'st') return actual;
  ensureCurrentLayer();
  const before = JSON.parse(readFileSync(repositoryPath(proof.nativeModuleSnapshots.before.path), 'utf8'));
  const after = JSON.parse(readFileSync(repositoryPath(proof.nativeModuleSnapshots.after.path), 'utf8'));
  const restored: any = structuredClone(actual);
  const currentLesson = restored.lessons.find((lesson: any) => lesson.id === 'vegetables-staples-l4');
  const beforeLesson = before.lessons.find((lesson: any) => lesson.id === 'vegetables-staples-l4');
  const afterLesson = after.lessons.find((lesson: any) => lesson.id === 'vegetables-staples-l4');
  assert.equal(currentLesson.body.sourceEnglish, proof.nativeParagraph.fullSourceEnglish, 'native body remains paired to exact canonical source');
  assert.equal(currentLesson.body.sourceEnglish.split('\n\n')[proof.nativeParagraph.paragraphIndex], proof.nativeParagraph.sourceEnglish,
    'the edited lesson paragraph remains bound to its exact canonical sentence group');
  assert.equal(currentLesson.body.reviewStatus, 'machine-draft', 'native body remains explicitly unreviewed');
  const paragraphs = currentLesson.body.sesothoDraft.split('\n\n');
  const oldParagraphs = beforeLesson.body.sesothoDraft.split('\n\n');
  const newParagraphs = afterLesson.body.sesothoDraft.split('\n\n');
  assert.equal(paragraphs.length, proof.nativeParagraph.paragraphCount, 'all native paragraph indices remain present');
  assert.ok(paragraphs[proof.nativeParagraph.paragraphIndex] === oldParagraphs[proof.nativeParagraph.paragraphIndex]
    || paragraphs[proof.nativeParagraph.paragraphIndex] === newParagraphs[proof.nativeParagraph.paragraphIndex],
  'the exact learner paragraph is either the accepted current text or its predecessor');
  paragraphs[proof.nativeParagraph.paragraphIndex] = oldParagraphs[proof.nativeParagraph.paragraphIndex];
  currentLesson.body.sesothoDraft = paragraphs.join('\n\n');
  return restored;
}

/** Rewind the resolved presentation before older tests compare the whole learner lesson. */
export function readingTitleLightestPresentationBeforeHistory<T extends { status?: string; content: any }>(value: T, lessonId: string, language: string): T {
  if (lessonId !== 'vegetables-staples-l4' || language !== 'st' || value.status !== 'draft') return value;
  ensureCurrentLayer();
  const beforeModule = JSON.parse(readFileSync(repositoryPath(proof.nativeModuleSnapshots.before.path), 'utf8'));
  const afterModule = JSON.parse(readFileSync(repositoryPath(proof.nativeModuleSnapshots.after.path), 'utf8'));
  const content = (module: any) => {
    const lesson = module.lessons.find((row: any) => row.id === lessonId);
    const text = (row: any) => row.reviewStatus === 'hold' ? row.sourceEnglish : row.sesothoDraft;
    return {
      title: text(lesson.title), body: text(lesson.body), keyPoints: lesson.keyPoints.map(text),
      quiz: lesson.quiz.map((row: any) => ({ q: text(row.question), options: row.options.map(text), correct: row.sourceCorrectIndex, rationale: text(row.rationale) })),
      infographicAlt: text(lesson.infographicAlt),
    };
  };
  const before = content(beforeModule);
  if (JSON.stringify(value.content) === JSON.stringify(before)) return structuredClone(value);
  assert.deepEqual(value.content, content(afterModule), 'complete current Sesotho Vegetables learner presentation before exact paragraph projection');
  return { ...structuredClone(value), content: before };
}
