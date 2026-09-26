import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import sesotho from '../lib/locales/st.ts';
import tshivenda from '../lib/locales/ve.ts';

const overviewKeys = [
  'studentContinue', 'studentModulesComplete', 'studentSaveBeforeSignal',
  'studentSaveAvailable', 'studentSaveModule',
] as const;

const placeholders = (value: string) => [...value.matchAll(/\{[^}]+\}/g)].map(([token]) => token).sort();
const english = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');

function englishSource(key: string): string {
  const source = english.match(new RegExp(`^  ${key}: '([^']*)',?$`, 'm'))?.[1];
  assert.ok(source, `${key} must retain its English source`);
  return source;
}

test('regional Student overview drafts preserve the placeholders used by the course page', () => {
  for (const dict of [sesotho, tshivenda]) {
    for (const key of overviewKeys) {
      assert.ok(dict[key]?.trim(), `${key} must have visible draft copy`);
      assert.deepEqual(placeholders(dict[key]), placeholders(englishSource(key)),
        `${key} must preserve the English source placeholders`);
    }
    assert.deepEqual(placeholders(dict.studentModulesComplete), ['{done}', '{total}']);
    assert.deepEqual(placeholders(dict.studentSaveModule), ['{title}']);
  }
});
