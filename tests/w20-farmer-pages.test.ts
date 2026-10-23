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

test('w20-02: exchange crop chips and lede use produceLabel; task board keys have zu drafts', () => {
  assert.match(read('components/exchange/ExchangeBoard.tsx'), /produceLabel\(c\.cropKey, lang\)/);
  assert.match(read('components/exchange/ExchangeLede.tsx'), /produceLabel\(crop\.cropKey, lang\)/);
  const zu = read('lib/locales/zu.ts');
  for (const k of ['taskVerbPrep', 'taskVerbSow', 'taskVerbTransplant', 'taskVerbMulch', 'taskVerbHarvest', 'taskVerbTerminateCover', 'taskVerbWeedEarly', 'taskVerbWeedMid', 'taskBedLabel', 'taskDueThisMonth', 'taskDueNextMonth', 'taskDueInMonths']) {
    assert.match(zu, new RegExp(`\\n  ${k}: "`), k);
  }
  assert.match(zu, /w20-02: unreviewed isiZulu drafts/);
});
