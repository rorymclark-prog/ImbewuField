import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w20-37: nav never clips, title and divider only when set and hidden at lg when nav shows', () => {
  const h = read('components/layout/AppHeader.tsx');
  assert.doesNotMatch(h, /overflow-hidden whitespace-nowrap/);
  assert.match(h, /ml-2 shrink-0 whitespace-nowrap/);
  assert.match(h, /\{title && \(/);
  assert.match(h, /lg:hidden/);
  assert.match(read('app/ngo/page.tsx'), /hidden sm:inline-flex lg:hidden/);
});
