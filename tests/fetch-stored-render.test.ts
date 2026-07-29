import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPathInside,
  resolveJobSuffixes,
} from '../scripts/fetch-stored-render.mjs';

test('paid-render retrieval refuses repository descendants but permits a sibling temp directory', () => {
  assert.equal(isPathInside('/work/repo', '/work/repo/downloads'), true);
  assert.equal(isPathInside('/work/repo', '/work/repo'), true);
  assert.equal(isPathInside('/work/repo', '/work/render-audit'), false);
});

test('a render suffix must identify exactly one stored job before anything is downloaded', () => {
  const ids = [
    'userA_1785344428945_3h5mz9',
    'userA_1785068880049_pv9bkm',
  ];

  assert.deepEqual(
    resolveJobSuffixes(ids, ['1785344428945_3h5mz9', '1785068880049_pv9bkm']),
    ids,
  );
  assert.throws(
    () => resolveJobSuffixes(ids, ['not-there']),
    /matched 0 jobs/,
  );
  assert.throws(
    () => resolveJobSuffixes([...ids, 'userB_1785344428945_3h5mz9'], ['1785344428945_3h5mz9']),
    /matched 2 jobs/,
  );
});
