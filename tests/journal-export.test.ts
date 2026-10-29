import test from 'node:test';
import assert from 'node:assert/strict';
import type { JournalEntry } from '@/lib/field-journal';
import { buildJournalCsv, buildJournalHtml } from '@/lib/journal-export';
import { filterJournalEntries } from '@/lib/journal-view';

function entry(id: string, overrides: Partial<JournalEntry> = {}): JournalEntry {
  return { id, date: '2026-10-12', title: 'Checked the bed', notes: 'Leaves recovered.\nChecked again after rain.', category: 'maintenance', bedId: 'bed-1', bedLabel: 'Old bed name', cropName: 'Recorded crop', createdAt: 1, updatedAt: 1, ...overrides };
}

test('both copies contain the selected original observations rather than the entire journal', () => {
  const rows = [entry('selected', { notes: 'Exact words, with a "quote"\nand another line.' }), entry('excluded', { notes: 'PRIVATE EXCLUDED NOTE', date: '2026-09-01' })];
  const selected = filterJournalEntries(rows, { from: '2026-10-01' });
  const csv = buildJournalCsv(selected);
  const html = buildJournalHtml(selected);
  assert.match(csv, /"Exact words, with a ""quote""\nand another line\."/);
  assert.match(html, /Exact words, with a &quot;quote&quot;\nand another line\./);
  for (const copy of [csv, html]) {
    assert.ok(copy.includes('2026-10-12'));
    assert.ok(copy.includes('Old bed name'));
    assert.ok(copy.includes('Recorded crop'));
    assert.ok(!copy.includes('PRIVATE EXCLUDED NOTE'));
    assert.ok(copy.includes('available on this device'));
    assert.ok(copy.includes('not verified measurements'));
  }
  assert.match(csv, /^\uFEFF"Date"/);
});

test('spreadsheet copies escape formula-like notes and labels without changing the farmer record', () => {
  for (const payload of ['=HYPERLINK("https://bad")', '+SUM(1,2)', '-1+2', '@SUM(1)', '  =1', '\t=1', '\n=1']) {
    const row = entry('a', { title: payload, notes: payload, bedLabel: payload, bedId: payload, cropName: payload });
    const before = structuredClone(row);
    const csv = buildJournalCsv([row], { selection: payload });
    assert.ok(csv.includes(`"'${payload.replace(/"/g, '""')}"`), payload);
    assert.deepEqual(row, before);
  }
  assert.ok(buildJournalCsv([entry('safe', { title: 'Normal note' })]).includes('"Normal note"'));
});

test('printable copies treat notes, titles, metadata and labels as text, never active markup', () => {
  const attack = '</h2><script>alert(1)</script><img src=x onerror=alert(1)>';
  const output = buildJournalHtml([entry('a', { title: attack, notes: attack, bedLabel: attack, cropName: attack })], { title: attack, selection: attack, generatedAt: attack });
  assert.ok(!output.includes('<script>'));
  assert.ok(!output.includes('<img src=x'));
  assert.ok(!output.includes('</h2><script>'));
  assert.ok(output.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.match(output, /default-src 'none'/);
  assert.match(output, /form-action 'none'/);
});

test('offline copies embed stored raster photographs and visibly omit active or remote image payloads', () => {
  const good = 'data:image/png;base64,iVBORw0KGgo=';
  const sources = [good, 'https://example.com/private.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AAA" onerror="alert(1)'];
  const row = entry('photos', { photos: sources });
  const output = buildJournalHtml([row]);
  assert.ok(output.includes(`src="${good}"`));
  assert.ok(!output.includes('src="https://'));
  assert.ok(!output.includes('src="data:image/svg'));
  assert.ok(!output.includes('onerror'));
  assert.ok(output.includes('3 attached photos omitted'));
  assert.ok(output.includes('2026-10-12 · Checked the bed · Photo 1'));
  const withoutPhotos = buildJournalHtml([row], { includePhotos: false });
  assert.ok(!withoutPhotos.includes('<img src='));
  assert.ok(withoutPhotos.includes('4 attached photos omitted from this copy by selection'));
});

test('sample exports carry a demonstration marker and never present observations as site-wide evidence', () => {
  for (const output of [buildJournalCsv([entry('a')], { sample: true }), buildJournalHtml([entry('a')], { sample: true })]) {
    assert.ok(output.includes('DEMONSTRATION JOURNAL'));
    assert.ok(output.includes('illustrative entries'));
  }
  assert.ok(!buildJournalHtml([entry('a')]).includes('DEMONSTRATION JOURNAL'));
  assert.ok(buildJournalHtml([entry('a')]).includes('not a site-wide assessment'));
});

test('omitting an unavailable photograph keeps each remaining photo number consistent with the journal viewer', () => {
  const output = buildJournalHtml([entry('photos', { photos: [
    'https://example.com/unavailable.jpg',
    'data:image/png;base64,iVBORw0KGgo=',
    'data:image/jpeg;base64,AAAA',
  ] })]);
  assert.ok(output.includes('Attached journal photo 2'));
  assert.ok(output.includes('Checked the bed · Photo 2'));
  assert.ok(output.includes('Checked the bed · Photo 3'));
  assert.ok(!output.includes('Attached journal photo 1'));
  assert.ok(output.includes('1 attached photo omitted'));
});

test('empty selections remain empty instead of exporting a fixture or the full journal', () => {
  const csv = buildJournalCsv([]);
  assert.equal(csv.split('\r\n').filter(Boolean).length, 1);
  const output = buildJournalHtml([], { selection: 'No matching entries' });
  assert.ok(output.includes('0 selected entries'));
  assert.ok(output.includes('No journal entries were selected.'));
  assert.ok(output.includes('No matching entries'));
});

test('creating copies does not rewrite stored observations or add generated data to them', () => {
  const rows = [entry('a', { photos: ['data:image/jpeg;base64,AAAA'] })];
  const before = structuredClone(rows);
  buildJournalCsv(rows, { sample: true, selection: 'Some selection' });
  buildJournalHtml(rows, { sample: true, generatedAt: '2026-10-29' });
  assert.deepEqual(rows, before);
});
