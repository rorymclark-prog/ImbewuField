import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

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
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => `tests/${name}`)
    .sort();

  assert.equal(listed.length, unique.size, 'the canonical test command lists a test more than once');
  assert.deepEqual(
    [...unique].sort(),
    actual,
    'every tests/*.test.ts file must run under npm test, with no stale manifest entries',
  );
});
