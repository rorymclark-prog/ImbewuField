import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// `npm test` names every test file explicitly rather than globbing. That is a deliberate choice —
// the run order is stable and a half-written file cannot break the suite by existing — but it has
// one sharp edge: writing a test file is not the same as running it, and nothing says so.
//
// On 2026-07-29 two files were sitting in tests/ unregistered. One was `design-studio.test.ts`:
// 266 lines, 8 passing assertions about the design rules, committed days earlier and never once
// executed by CI. It passed when finally run, so nothing was broken — but it had been protecting
// nothing the whole time, and the suite total never moved, so there was no signal at all. The next
// orphan might be the one that would have caught a real regression.
//
// A test that is never run is worse than no test: it is a false sense of cover. So the registry
// checks itself.

const ROOT = new URL('..', import.meta.url);

test('every test file on disk is registered in the npm test script', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));
  const script: string = pkg.scripts?.test ?? '';
  const registered = new Set(script.match(/tests\/[A-Za-z0-9._-]+\.test\.ts/g) ?? []);

  const onDisk = readdirSync(new URL('tests', ROOT))
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => `tests/${f}`);

  const orphans = onDisk.filter((f) => !registered.has(f));
  assert.deepEqual(
    orphans,
    [],
    'these test files exist but never run — add them to the "test" script in package.json',
  );
});

test('the npm test script does not name a file that no longer exists', () => {
  // The mirror failure: a renamed or deleted test leaves a stale entry, and `node --test` exits
  // non-zero on a missing path — which reads as "the suite is broken" rather than "the list is".
  const pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));
  const script: string = pkg.scripts?.test ?? '';
  const registered = script.match(/tests\/[A-Za-z0-9._-]+\.test\.ts/g) ?? [];

  const onDisk = new Set(
    readdirSync(new URL('tests', ROOT))
      .filter((f) => f.endsWith('.test.ts'))
      .map((f) => `tests/${f}`),
  );

  const missing = registered.filter((f) => !onDisk.has(f));
  assert.deepEqual(missing, [], 'the test script names files that are not in tests/');
});

test('no test file is registered twice', () => {
  // A duplicate silently doubles a module's runtime and inflates the pass count, which is the
  // number everyone reads to decide whether the suite grew.
  const pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));
  const registered = (pkg.scripts?.test ?? '').match(/tests\/[A-Za-z0-9._-]+\.test\.ts/g) ?? [];
  const seen = new Set<string>();
  const dupes = registered.filter((f: string) => (seen.has(f) ? true : (seen.add(f), false)));
  assert.deepEqual(dupes, [], 'duplicate entries in the npm test script');
});
