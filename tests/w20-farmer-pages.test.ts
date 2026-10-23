import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('w20-01: listing card kind badge cannot be overlapped by the status column', () => {
  const s = read('components/exchange/ListingCard.tsx');
  assert.match(s, /gridTemplateColumns: 'minmax\(min-content, 1fr\) auto'/);
  assert.match(s, /flex flex-col items-end gap-1/);
  assert.match(s, /font-bold uppercase shrink-0/);
});
