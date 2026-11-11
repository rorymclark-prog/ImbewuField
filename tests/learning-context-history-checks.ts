import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The reviewed learning notice is a newer UI layer, not a change to the dated
// course source. Older owners may see their exact predecessor only after both
// the complete mounted page and the complete notice have passed their own pins.
const root = fileURLToPath(new URL('../', import.meta.url));
const page = 'app/student/page.tsx';
const notice = 'components/studies/LearningRegionNotice.tsx';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const currentPageSha = 'ece4f0787a0e0c5e14d6d5f406aef782e195cedb22b1578013a0b2781e173730';
const previousPageSha = 'a361890bfdb03c22e74a01b61516f759cf93225ca20b83edf422aa37a9712272';
const additions = [
  Buffer.from("import LearningRegionContext from '@/components/studies/LearningRegionNotice';\n"),
  Buffer.from('        <LearningRegionContext scope="core-farming" />\n'),
];

function removeReviewedAdditions(supplied: Uint8Array): Buffer {
  let bytes = Buffer.from(supplied);
  for (const addition of additions) {
    const offset = bytes.indexOf(addition);
    assert.ok(offset >= 0, page + ': the exact reviewed learning-context addition is present');
    assert.equal(bytes.indexOf(addition, offset + addition.length), -1, page + ': each reviewed addition occurs exactly once');
    // Only the declared byte spans disappear; all unlisted bytes retain order.
    bytes = Buffer.concat([bytes.subarray(0, offset), bytes.subarray(offset + addition.length)]);
  }
  assert.equal(bytes.length, 88053, page + ': exact pre-learning-context successor size');
  assert.equal(sha(bytes), previousPageSha, page + ': only the reviewed additions separate the complete historical successor');
  return bytes;
}

export function ensureLearningContextCurrent(): void {
  // Do not reuse a successful stat signature here. Historical callers can nest
  // inside an older checked scope; a changed current read must still be visible.
  const live = readFileSync(resolve(root, page));
  assert.equal(live.length, 88187, page + ': complete actual live successor size');
  assert.equal(sha(live), currentPageSha, page + ': complete actual live successor, including every unlisted byte');
  const component = readFileSync(resolve(root, notice));
  assert.equal(component.length, 9886, notice + ': complete actual live successor size');
  assert.equal(sha(component), '334871cadceedffd6dd2c6de33a9457ade8b89882685c03e5bcebb81488ae747',
    notice + ': complete actual live successor of the reviewed learning-context layer');
  removeReviewedAdditions(live);
}

/** Reverse only the exact reviewed UI additions. Unknown caller bytes stay
 * exposed to the original dated owner's complete byte/hash assertions. */
export function learningContextSourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  if (file !== page) return supplied;
  ensureLearningContextCurrent();
  if (sha(supplied) !== currentPageSha) return supplied;
  const before = removeReviewedAdditions(typeof supplied === 'string' ? Buffer.from(supplied) : supplied);
  return (typeof supplied === 'string' ? before.toString()
    : Buffer.isBuffer(supplied) ? Buffer.from(before) : new Uint8Array(before)) as T;
}
