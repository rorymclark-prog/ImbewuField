import { reading14ManifestBefore } from './reading-comparisons-media-history-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { precisionNativeBefore, precisionSourceBytesBefore } from './study-precision-history-checks.ts';

// The dated release tests still protect their full historical scope. Validate
// the complete reviewed fairness layer before exposing any predecessor to them.
const folder = 'docs/study-translation-reviews/intro-fair-sharing-2026-10-07/';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const hashes: Record<string, string> = {
  'before.json': '8f61f45e5c2ec9f83b575cdee15d7bef4eac4daeb8e229b4ec22e6821b9af38e',
  'after.json': 'a1baac139b00fe5230c9f35c699aa5b5ad3ff78a5798e18ce8ae4ed48ac5017f',
  'ts-paired-before.json': '0a358078b515eab624df8735a022a7e4a5b70c1e2a67b2ae551937296e327729',
  'ts-paired-after.json': '94dc11005a921723e0a6722d18b868d0533d40983a014b84fcea436a104f424c',
  'file-proof.json': 'add3a1b4c82bd2fe8c6c9bf1c5708f88fa911e8539120e9c68d0158946520c66',
  'assets.json': 'ed592cf3872b4c89224244fc8463522ebe0e84310be7f058de0dc5d210cdf3a9',
  'zu-silent-rows.json': '1138b6604ea3a0ab9f7cedef862677adda04fb87f4bc6772ea6a99ac23de18a3',
};
const read = (name: string) => {
  const bytes = readFileSync(folder + name);
  assert.equal(sha(bytes), hashes[name], `${name}: immutable checked fairness proof`);
  return JSON.parse(bytes.toString());
};
const before = read('before.json');
const after = read('after.json');
const pairBefore = read('ts-paired-before.json');
const pairAfter = read('ts-paired-after.json');
const files = read('file-proof.json');
export const fairSharingAssets: any[] = read('assets.json').assets;
export const fairSharingZuluSilentRows: any[] = read('zu-silent-rows.json');

export function fairSharingNativeBefore<T>(actual: T): T {
  assert.deepEqual(actual, after.ts, 'complete current TS module matches eight reviewed fairness fields, including all unlisted sources and indexes');
  return structuredClone(before.ts);
}

export function fairSharingZuluBefore<T>(actual: T): T {
  actual = precisionNativeBefore('zu', actual);
  assert.deepEqual(actual, after.zu, 'complete current ZU registry matches three reviewed fairness fields, including all unlisted lessons');
  return structuredClone(before.zu);
}

export function fairSharingPairBefore<T>(file: string, actual: T): T {
  if (file !== 'docs/narration/intro-permaculture.ts.paired-draft.json') return actual;
  // Some older composition layers have already projected these exact three
  // cells. Accept only that complete frozen predecessor, never a partial rewind.
  if (JSON.stringify(actual) === JSON.stringify(pairBefore)) return structuredClone(pairBefore);
  assert.deepEqual(actual, pairAfter, 'complete TS paired deck matches the three reviewed fairness cells without source or neighbour drift');
  return structuredClone(pairBefore);
}

export function fairSharingPresentationBefore<T extends { status: string; content: any }>(lesson: { id: string }, language: string, shown: T): T {
  if (lesson.id !== 'intro-permaculture-l1' || language !== 'ts' || shown.status !== 'draft') return shown;
  const prior = before.ts.lessons.find((row: any) => row.id === lesson.id);
  const text = (pair: any) => pair.reviewStatus === 'hold' ? pair.sourceEnglish : pair.xitsongaDraft;
  const latest = after.ts.lessons.find((row: any) => row.id === lesson.id);
  assert.deepEqual(shown.content, {
    title: text(latest.title), body: text(latest.body), infographicAlt: text(latest.infographicAlt),
    keyPoints: latest.keyPoints.map(text), quiz: latest.quiz.map((row: any) => ({
      q: text(row.question), options: row.options.map(text), correct: row.sourceCorrectIndex, rationale: text(row.rationale),
    })),
  }, 'real current TS presentation matches the complete checked fairness layer before a dated view');
  return { ...shown, content: { ...shown.content,
    title: text(prior.title), body: text(prior.body), infographicAlt: text(prior.infographicAlt),
    keyPoints: prior.keyPoints.map(text), quiz: prior.quiz.map((row: any) => ({
      q: text(row.question), options: row.options.map(text), correct: row.sourceCorrectIndex, rationale: text(row.rationale),
    })),
  } };
}

export function fairSharingSourceBytesBefore(file: string, bytes: string | Uint8Array): string {
  if (file === 'lib/course-asset-sizes.ts') bytes = reading14ManifestBefore(Buffer.from(bytes).toString());
  bytes = precisionSourceBytesBefore(file, bytes);
  const row = files[file];
  if (!row) return Buffer.from(bytes).toString();
  assert.equal(sha(bytes), row.after.sha256, `${file}: entire current file matches the reviewed fairness layer`);
  const previous = readFileSync(folder + row.before.path);
  assert.equal(sha(previous), row.before.sha256, `${file}: exact complete predecessor`);
  return previous.toString();
}

export function fairSharingAssetBefore(path: string, bytes: Uint8Array) {
  const row = fairSharingAssets.find(row => 'public' + row.url === path);
  if (!row) return null;
  assert.equal(bytes.length, row.bytes, `${path}: corrected card's measured byte count`);
  assert.equal(sha(bytes), row.sha256, `${path}: corrected card's full content hash`);
  return row.before && { bytes: row.before.bytes, sha256: row.before.sha256, width: row.width, height: row.height };
}
