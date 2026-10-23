import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w17-02: MyRecords card captions use --text-secondary, not --text-muted', () => {
  const src = read('components/MyRecords.tsx');
  for (const key of ['myRecordsTotalHarvested', 'myRecordsNoDesigns']) {
    const i = src.indexOf(`t('${key}')`);
    assert.ok(i > 0, key);
    const before = src.slice(Math.max(0, i - 220), i);
    assert.ok(!before.includes("color: 'var(--text-muted)'"), `${key} still muted`);
    assert.ok(before.includes("color: 'var(--text-secondary)'"), `${key} not secondary`);
  }
});

test('w17-03: network sort chip text uses forest-800 (>=4.5:1 on its tint in every column)', () => {
  const src = read('app/network/page.tsx');
  assert.ok(src.includes("sort === key ? 'var(--color-forest-800)' : INK_MUTED"));
  assert.ok(!src.includes("sort === key ? 'var(--emerald)'"));
});
