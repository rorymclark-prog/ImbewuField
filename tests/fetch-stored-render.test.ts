import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPathInside,
  resolveJobSuffixes,
  shouldRefuseServiceAccount,
  isIgnoredByGit,
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

// The guard's purpose is to stop a credential that could be COMMITTED, not one that merely lives in
// the working tree. This repo keeps serviceAccount.json at its root behind .gitignore, and an
// inside-the-repo-only test refused it — the tool could not be run at all against the only
// credential that exists. These pin the corrected meaning.
test('a git-ignored credential inside the repo is allowed, because it cannot be committed', () => {
  assert.equal(shouldRefuseServiceAccount({ inside: true, ignored: true }), false);
});

test('an unignored credential inside the repo is still refused', () => {
  assert.equal(shouldRefuseServiceAccount({ inside: true, ignored: false }), true);
});

test('a credential outside the repo is never the tool’s business', () => {
  assert.equal(shouldRefuseServiceAccount({ inside: false, ignored: false }), false);
});

test('an ignore check that cannot run answers false, so the guard fails CLOSED', () => {
  type Runner = Parameters<typeof isIgnoredByGit>[2];
  const exits = (status: number): Runner => ((() => ({ status })) as unknown as Runner);
  const throws: Runner = ((() => { throw new Error('git missing'); }) as unknown as Runner);

  assert.equal(isIgnoredByGit('/repo', '/repo/serviceAccount.json', throws), false);
  // ...and a non-zero exit is likewise not a licence to read the file.
  assert.equal(isIgnoredByGit('/repo', '/repo/x.json', exits(1)), false);
  assert.equal(isIgnoredByGit('/repo', '/repo/x.json', exits(0)), true);
});
