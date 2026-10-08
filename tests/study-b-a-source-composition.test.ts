import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studyBAProjectToA, studyBAProjectToB, assertStudyBAComposedBytes, ensureStudyBACompositionCurrent } from './study-b-a-source-composition-history-checks.ts';

test('B+A source layers recover their exact independent worker and manifest predecessors', () => {
  ensureStudyBACompositionCurrent();
  for (const file of ['app/sw.js/route.ts', 'lib/course-asset-sizes.ts']) {
    const live = readFileSync(file);
    assertStudyBAComposedBytes(file, live);
    const aOnly = studyBAProjectToA(file, live);
    const bOnly = studyBAProjectToB(file, live);
    assert.ok(Buffer.from(aOnly).length > 0);
    assert.ok(Buffer.from(bOnly).length > 0);
    assertStudyBAComposedBytes(file, Buffer.from(live));
    const corrupted = Buffer.from(live);
    corrupted[corrupted.length - 2] = corrupted[corrupted.length - 2] === 0x20 ? 0x21 : 0x20;
    assert.equal(corrupted.length, live.length, 'same-size source corruption remains detectable');
    assert.throws(() => assertStudyBAComposedBytes(file, corrupted), /byte-exact integrated source/,
      `${file}: same-size unlisted corruption cannot satisfy the current full-source proof`);
  }
});
