import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

// Emulator-backed suites have their own command because running them here would make the
// canonical no-services test lane fail on every developer checkout. They are still explicit
// tests, and package.json's test:rules script is the registration point for this one.
// KEEP IN SYNC WITH tests/test-registry.test.ts, which holds its own copy of this set.
const EXTERNAL_TEST_FILES = new Set([
  'firestore-rules.test.ts',
  'storage-rules.test.ts',
  'provision-org.emulator.test.ts',
]);

test('npm test runs every repository test file exactly once', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    scripts?: { test?: unknown };
  };
  const command = packageJson.scripts?.test;
  if (typeof command !== 'string') {
    assert.fail('package.json must define the canonical test command');
  }

  const listed = command.match(/tests\/[^ ]+\.test\.ts/g) ?? [];
  const unique = new Set(listed);
  const actual = readdirSync(new URL('.', import.meta.url))
    .filter((name) => name.endsWith('.test.ts') && !EXTERNAL_TEST_FILES.has(name))
    .map((name) => `tests/${name}`)
    .sort();

  assert.equal(listed.length, unique.size, 'the canonical test command lists a test more than once');
  assert.deepEqual(
    [...unique].sort(),
    actual,
    'every tests/*.test.ts file must run under npm test, with no stale manifest entries',
  );
});
