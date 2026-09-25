import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// CLAUDE.md: ochre is a FILL, not text — as text it is 2.54:1 on paper. /login and /gate painted
// their error copy with var(--color-ochre-light) anyway; --gold-dim is the token declared for
// exactly this (ochre-toned text with real contrast). The input border may still use the ochre
// fill token — only the error text itself is pinned here.

const FILES = ['../app/login/page.tsx', '../app/gate/page.tsx'];

for (const rel of FILES) {
  test(`${rel.replace('../', '')} error text uses --gold-dim, not the ochre fill token`, () => {
    const source = readFileSync(new URL(rel, import.meta.url), 'utf8');
    const errorParagraph = source.slice(source.indexOf('role="alert"'));
    const snippet = errorParagraph.slice(0, errorParagraph.indexOf('</p>'));
    assert.ok(snippet.includes('var(--gold-dim)'), 'the alert text must use var(--gold-dim)');
    assert.ok(
      !snippet.includes('var(--color-ochre-light)'),
      'the alert text must not use the ochre fill token — it fails contrast as text',
    );
  });
}
