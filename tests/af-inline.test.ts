// The Afrikaans drafts for the app's inline English (lib/xh-inline.ts, lib/locales/af-inline/).
// Keyed by exact English, like the isiXhosa shards: every key must be English some screen still
// shows, so a key no source file contains is a retired draft and must be removed or re-drafted.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/af-inline.test.ts

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { AF_INLINE_SOURCE } from '@/lib/locales/af-inline/index';
import { XH_INLINE_SOURCE } from '@/lib/locales/xh-inline/index';
import { inlineDraft, inlineTemplate, inlineText, placeholdersOf, registerInlineDrafts, registerXhInline } from '@/lib/xh-inline';

const ROOT = new URL('..', import.meta.url).pathname;
const SHARD_DIR = join(ROOT, 'lib/locales/af-inline');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'locales' && name !== 'node_modules') sourceFiles(path, out); }
    else if (/\.(tsx?|mjs|json)$/.test(name)) out.push(path);
  }
  return out;
}
const SOURCE = ['app', 'components', 'lib'].flatMap((d) => sourceFiles(join(ROOT, d))).map((f) => readFileSync(f, 'utf8')).join('\n');
const inSource = (english: string) => [english, english.replace(/'/g, "\\'"), english.replace(/"/g, '\\"'), english.replace(/’/g, "\\u2019"), JSON.stringify(english).slice(1, -1)]
  .some((form) => SOURCE.includes(form));
const numbers = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join('|');

test('every Afrikaans shard is spread into the index', () => {
  const index = readFileSync(join(SHARD_DIR, 'index.ts'), 'utf8');
  for (const shard of readdirSync(SHARD_DIR).filter((n) => n !== 'index.ts' && n.endsWith('.ts'))) {
    const name = shard.replace(/\.ts$/, '');
    assert.match(index, new RegExp(`from '\\./${name}'`), `${shard} is not imported by lib/locales/af-inline/index.ts`);
  }
});

test('every Afrikaans draft keeps its English {placeholders} and numbers and is not blank', () => {
  for (const [english, afrikaans] of Object.entries(AF_INLINE_SOURCE)) {
    assert.ok(afrikaans.trim() !== '', `blank draft for ${JSON.stringify(english)}`);
    assert.equal(placeholdersOf(afrikaans), placeholdersOf(english), `placeholder drift for ${JSON.stringify(english)}`);
    assert.equal(numbers(afrikaans), numbers(english), `number drift for ${JSON.stringify(english)}`);
  }
});

test('every Afrikaans key is English that a source file still shows', () => {
  const stale = Object.keys(AF_INLINE_SOURCE).filter((english) => !inSource(english));
  assert.deepEqual(stale, [], 'retire or re-draft these Afrikaans inline drafts');
});

test('Afrikaans covers every English string isiXhosa covers', () => {
  const missing = Object.keys(XH_INLINE_SOURCE).filter((english) => !(english in AF_INLINE_SOURCE));
  assert.deepEqual(missing, [], 'draft Afrikaans for these inline strings');
});

test('lookups: each draft language reads only its own map; everyone else gets English', () => {
  registerXhInline({ 'Save': 'Gcina' });
  registerInlineDrafts('af', { 'Save': 'Stoor', '{n} entries': '{n} inskrywings', 'Bad {n}': 'Sleg' });
  assert.equal(inlineText('af', 'Save', 'Londoloza'), 'Stoor');
  assert.equal(inlineText('xh', 'Save', 'Londoloza'), 'Gcina');
  assert.equal(inlineText('zu', 'Save', 'Londoloza'), 'Londoloza');
  assert.equal(inlineText('st', 'Save'), 'Save');
  assert.equal(inlineText('af', 'Not drafted'), 'Not drafted');
  assert.equal(inlineTemplate('af', '{n} entries', null, { n: 3 }), '3 inskrywings');
  // A draft that dropped its placeholder would lose the figure, so English is shown.
  assert.equal(inlineDraft('af', 'Bad {n}'), null);
  registerXhInline(XH_INLINE_SOURCE);
  registerInlineDrafts('af', AF_INLINE_SOURCE);
});
