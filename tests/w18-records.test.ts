import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w18-35 closed ThemePanel has no shadow and is hidden', () => {
  const s = read('components/ThemePanel.tsx');
  assert.match(s, /boxShadow: open \? '-8px 0 32px rgba\(0,0,0,0\.2\)' : 'none'/);
  assert.match(s, /visibility: open \? 'visible' : 'hidden'/);
});

test('w18-36 records inputs follow the theme tokens without !important', () => {
  const s = read('app/records/Records.module.css');
  const line = s.split('\n').find(l => l.includes(':global(input), .page :global(select)')) ?? '';
  assert.match(line, /background: var\(--bg-1\)/);
  assert.match(line, /color: var\(--text-primary\)/);
  assert.doesNotMatch(line, /!important|#fffdf7|#302c24/);
  assert.match(s, /::placeholder[^}]*var\(--text-muted\)/);
});
