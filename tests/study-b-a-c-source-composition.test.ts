import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ensureStudyBACCompositionCurrent,
  studyABCProjectToAB,
  studyABCProjectToA,
  studyABCProjectToB,
  studyABCProjectToC,
  studyABCProjectToMain69,
} from './study-b-a-c-source-composition-history-checks.ts';

test('B+A+C history projections restore each complete immutable worker and manifest owner', () => {
  ensureStudyBACCompositionCurrent();
  const proof = JSON.parse(readFileSync('docs/study-translation-reviews/study-b-a-c-integration-2026-10-08/composition-proof.json', 'utf8'));
  for (const file of ['app/sw.js/route.ts', 'lib/course-asset-sizes.ts']) {
    const source = readFileSync(file);
    const row = proof.files.find((item: any) => item.path === file);
    const projections: Record<string, (file: string, value: Uint8Array) => string | Uint8Array> = {
      main69: studyABCProjectToMain69,
      afterB: studyABCProjectToB,
      afterA: studyABCProjectToA,
      afterC: studyABCProjectToC,
      afterAB: studyABCProjectToAB,
    };
    for (const [phase, project] of Object.entries(projections)) {
      const actual = Buffer.from(project(file, source));
      const expected = readFileSync(row.snapshots[phase].path);
      assert.deepEqual(actual, expected, `${file}: the complete ${phase} source snapshot is recovered`);
    }
    const corrupted = Buffer.from(source);
    corrupted[corrupted.length - 2] ^= 1;
    assert.equal(corrupted.length, source.length, `${file}: mutation leaves the same file size`);
    assert.throws(() => studyABCProjectToAB(file, corrupted), /byte-exact integrated source/,
      `${file}: a same-size unlisted source mutation cannot enter a historical projection`);
  }
});
