import { expandedSourceBefore } from './core-ordinary-expanded-history-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { veReadingFrostSourceBefore } from './ve-reading-frost-history-checks.ts';
import { lightestManifestBefore } from './reading-title-lightest-media-history-checks.ts';

const folder = 'docs/study-translation-reviews/reading-comparisons-2026-10-07/';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const bytes = readFileSync(folder + 'reading-zu14-release-file-proof.json');
assert.equal(sha(bytes), '208e6d2dde9eb9ef10ffdf7d7bf2c2a880c0e7f4a756627f56fee983d7c47165');
export const reading14Files = JSON.parse(bytes.toString());

// New independent silent-card identity adds one manifest entry. Dated media tests
// must validate that whole addition before reconstructing their earlier inventories.
export function reading14ManifestBefore(value: string): string {
  const file = 'lib/course-asset-sizes.ts';
  const proof = reading14Files[file];
  assert.equal(sha(proof.before), proof.beforeSha256);
  assert.equal(sha(proof.after), proof.afterSha256);
  const live = readFileSync(file, 'utf8');
  const projected = veReadingFrostSourceBefore(file, live) as string;
  assert.equal(projected, proof.after, 'entire Reading14 manifest after exact latest VE frost projection');
  // The newest four-card layer first validates its full current manifest and
  // exact HEAD predecessor. Older owners then project through expanded,
  // current-batch, followup and frost snapshots in their existing order.
  const lightestPredecessor = lightestManifestBefore(live);
  if (value === live || value === expandedSourceBefore(file, live) || value === lightestPredecessor) value = projected;
  if (value === proof.before) return value;
  assert.equal(value, proof.after, 'supplied complete Reading14 manifest after the later two-card VE layer');
  return proof.before;
}
