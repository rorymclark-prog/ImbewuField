// The isiXhosa drafts for the inline isiZulu branches (lib/xh-inline.ts, lib/locales/xh-inline/).
// Keyed by exact English, so the safety property is that every key is English some screen still
// shows: a key no source file contains is a retired draft and must be removed or re-drafted.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/xh-inline.test.ts

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { XH_INLINE_SOURCE } from '@/lib/locales/xh-inline/index';
import { inlineTemplate, inlineText, placeholdersOf, registerXhInline, xhInlineDraft } from '@/lib/xh-inline';

const ROOT = new URL('..', import.meta.url).pathname;
const SHARD_DIR = join(ROOT, 'lib/locales/xh-inline');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== 'locales' && name !== 'node_modules') sourceFiles(path, out); }
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(path);
  }
  return out;
}
const SOURCE = ['app', 'components', 'lib'].flatMap((d) => sourceFiles(join(ROOT, d))).map((f) => readFileSync(f, 'utf8')).join('\n');
// Literals may be written with escaped quotes or apostrophes in the source.
const inSource = (english: string) => [english, english.replace(/'/g, "\\'"), english.replace(/"/g, '\\"'), english.replace(/’/g, "\\u2019")]
  .some((form) => SOURCE.includes(form));

test('every shard is spread into the index', () => {
  const index = readFileSync(join(SHARD_DIR, 'index.ts'), 'utf8');
  for (const shard of readdirSync(SHARD_DIR).filter((n) => n !== 'index.ts' && n.endsWith('.ts'))) {
    const name = shard.replace(/\.ts$/, '');
    assert.match(index, new RegExp(`from '\\./${name}'`), `${shard} is not imported by lib/locales/xh-inline/index.ts`);
  }
});

test('every draft keeps its English {placeholders} and is not blank', () => {
  for (const [english, xhosa] of Object.entries(XH_INLINE_SOURCE)) {
    assert.ok(xhosa.trim() !== '', `blank draft for ${JSON.stringify(english)}`);
    assert.equal(placeholdersOf(xhosa), placeholdersOf(english), `placeholder drift for ${JSON.stringify(english)}`);
  }
});

test('every key is English that a source file still shows', () => {
  const stale = Object.keys(XH_INLINE_SOURCE).filter((english) => !inSource(english));
  assert.deepEqual(stale, [], 'retire or re-draft these isiXhosa inline drafts');
});

test('lookups: isiZulu keeps its wording, isiXhosa reads the drafts, everyone else gets English', () => {
  registerXhInline({ 'Save': 'Gcina', '{n} entries': 'Amangeniso angu-{n}', 'Bad {n}': 'Ayilunganga' });
  assert.equal(inlineText('zu', 'Save', 'Londoloza'), 'Londoloza');
  assert.equal(inlineText('xh', 'Save', 'Londoloza'), 'Gcina');
  assert.equal(inlineText('en', 'Save', 'Londoloza'), 'Save');
  assert.equal(inlineText('st', 'Save'), 'Save');
  assert.equal(inlineText('xh', 'Not drafted'), 'Not drafted');
  assert.equal(inlineTemplate('xh', '{n} entries', null, { n: 3 }), 'Amangeniso angu-3');
  assert.equal(inlineTemplate('en', '{n} entries', null, { n: 3 }), '3 entries');
  // A draft that dropped its placeholder would lose the figure, so English is shown.
  assert.equal(xhInlineDraft('Bad {n}'), null);
  registerXhInline(XH_INLINE_SOURCE);
});
