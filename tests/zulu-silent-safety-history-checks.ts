import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const repositoryPath = (path: string) => resolve(root, path);
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const proofPath = 'docs/study-translation-reviews/zulu-silent-safety-next-2026-10-08/source-layer-proof.json';
const proofBytes = readFileSync(repositoryPath(proofPath));
assert.equal(sha(proofBytes), 'cb195a30adcc990fe520a36d2cab1413e1f811d04fa8959b55f4c1d5d41eb0d8',
  'the complete six-card successor source proof stays immutable');
const proof = JSON.parse(proofBytes.toString());
assert.equal(proof.baseHead, 'fb6c4b58aed409c9d907b56affd69e0117a189fc');
assert.equal(proof.acceptedTextPacketSha256, '80b56bf5ee4a2f60877f9c11254d9c0e792f80a2f97fee235c301059834d3be3');

/** Project only byte-exact current worker/manifest files to this layer's saved predecessor. */
export function zuluSilentSafetySourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  const row = proof.files.find((item: any) => item.path === file);
  if (!row) return bytes;
  const before = readFileSync(repositoryPath(row.beforeSnapshot));
  const after = readFileSync(repositoryPath(row.afterSnapshot));
  assert.equal(before.byteLength, row.beforeBytes, `${file}: exact six-card layer predecessor size`);
  assert.equal(sha(before), row.beforeSha256, `${file}: exact six-card layer predecessor digest`);
  assert.equal(after.byteLength, row.afterBytes, `${file}: full current file snapshot size`);
  assert.equal(sha(after), row.afterSha256, `${file}: full current file snapshot digest`);
  if (row.id === 'manifest') {
    const beforeText = before.toString();
    const afterText = after.toString();
    const entries = (text: string) => Object.fromEntries([...text.matchAll(/^  '([^']+)': (\d+),$/gm)]
      .map((match) => [match[1], Number(match[2])]));
    const beforeEntries = entries(beforeText);
    const afterEntries = entries(afterText);
    const added = Object.fromEntries(Object.entries(afterEntries).filter(([key]) => !Object.hasOwn(beforeEntries, key)));
    assert.deepEqual(added, proof.manifestDelta.added, 'the only new course-size rows are the six rendered stills');
    for (const [key, bytes] of Object.entries(beforeEntries)) {
      assert.equal(afterEntries[key], bytes, `${key}: every pre-existing manifest entry is unchanged`);
    }
    const normalizedAfter = afterText
      .replace(/^\/\/ 1936 files, 721\.7 MB total\.$/m, proof.manifestDelta.summaryBefore)
      .replace(/^  '([^']+)': \d+,\n/gm, (line, key) => Object.hasOwn(added, key) ? '' : line);
    assert.equal(normalizedAfter, beforeText, 'after manifest preserves all unlisted lines and formatting');
  }
  const live = readFileSync(repositoryPath(file));
  assert.equal(live.byteLength, row.afterBytes, `${file}: live complete file size`);
  assert.equal(sha(live), row.afterSha256, `${file}: live complete file matches reviewed six-card layer`);
  const supplied = Buffer.from(bytes);
  if (supplied.equals(live)) return typeof bytes === 'string' ? before.toString() : before;
  return bytes;
}
