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

test('w20-03: exchange/account controls use the sans font', () => {
  for (const p of ['app/account/page.tsx', 'components/exchange/ExchangeGuide.tsx', 'components/exchange/NewListingForm.tsx', 'components/exchange/ExchangeBoard.tsx']) {
    const s = read(p);
    for (const m of s.matchAll(/<(button|input|select|textarea)\b[\s\S]*?className=(?:"[^"]*"|\{`[^`]*`\})/g)) {
      assert.doesNotMatch(m[0], /font-display/, `${p}: ${m[0].slice(0, 80)}`);
    }
  }
});

test('w20-04: chips are inline-flex; stats are a phone grid', () => {
  const s = read('components/exchange/ExchangeBoard.tsx');
  assert.match(s, /display: 'inline-flex',\s*alignItems: 'center',\s*gap: 4,\s*padding: '6px 11px'/);
  assert.match(s, /grid grid-cols-3 gap-x-3 gap-y-2 sm:flex/);
});

test('w20-05: journal and evidence titles use the hashed display font variable', () => {
  for (const p of ['components/journal/FieldJournal.tsx', 'components/journal/JournalEntrySheet.tsx', 'components/EvidenceSheet.tsx', 'components/EvidenceCatalogue.tsx']) {
    const s = read(p);
    assert.doesNotMatch(s, /font: '[^']*Newsreader/, p);
    assert.match(s, /var\(--font-display\), Georgia, serif/, p);
  }
});

test('w20-06: offline page gives farmers plain copy and hides the information-request count', () => {
  const s = read('app/offline/page.tsx');
  assert.match(s, /plainCopy = role === 'farmer' \|\| role === 'student'/);
  assert.match(s, /offlineSavedEntriesDescriptionFarmer/);
  assert.match(s, /!plainCopy&&cached\.length>0/);
  assert.match(read('lib/i18n.tsx'), /offlineSavedEntriesDescriptionFarmer: 'Journal notes, records and photos wait here/);
  assert.match(read('lib/locales/zu.ts'), /w20-06: unreviewed isiZulu draft/);
});
