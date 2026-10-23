import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w18-35 closed ThemePanel has no shadow and is hidden', () => {
  const s = read('components/ThemePanel.tsx');
  assert.match(s, /boxShadow: open \? '-8px 0 32px rgba\(0,0,0,0\.2\)' : 'none'/);
  assert.match(s, /visibility: open \? 'visible' : 'hidden'/);
});
