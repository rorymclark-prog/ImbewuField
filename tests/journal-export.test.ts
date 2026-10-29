import test from 'node:test';
import assert from 'node:assert/strict';
import type { JournalEntry } from '@/lib/field-journal';
import { buildJournalCsv, buildJournalHtml } from '@/lib/journal-export';
import { filterJournalEntries } from '@/lib/journal-view';
import { FARM_MEMORY_ZU, farmMemoryCategoryLabel } from '@/lib/farm-memory-copy';

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

test('isiZulu copies translate their controls and reporting basis while keeping original farmer evidence exact', () => {
  const rows = [entry('a', { title: 'My original title', notes: 'Lokhu engikubonile.\nOriginal words, "quoted".', bedLabel: 'My own bed', cropName: 'My original crop' })];
  const before = structuredClone(rows);
  const csv = buildJournalCsv(rows, { lang: 'zu', sample: true });
  const output = buildJournalHtml(rows, { lang: 'zu', sample: true, generatedAt: '2026-10-29' });
  assert.ok(csv.startsWith('\uFEFF"Usuku","Isigaba","Isihloko","Amanothi"'));
  const csvHeader = csv.split('\r\n')[0];
  for (const label of ['Umbhede oqoshiwe', 'I-ID yombhede oqoshiwe', 'Isitshalo esiqoshiwe', 'Izithombe ezifakiwe', 'Umthombo werekhodi', 'Okukhethiwe']) assert.ok(csvHeader.includes(`"${label}"`));
  assert.ok(csv.includes('"Lokhu engikubonile.\nOriginal words, ""quoted""."'));
  assert.match(output, /<html lang="zu">/);
  for (const copy of [csv, output]) {
    assert.ok(copy.includes('My original title'));
    assert.ok(copy.includes('My own bed'));
    assert.ok(copy.includes('My original crop'));
    assert.ok(copy.includes('2026-10-12'));
    assert.ok(copy.includes(FARM_MEMORY_ZU.exportBasis));
    assert.ok(copy.includes(FARM_MEMORY_ZU.exportDemo));
    assert.ok(copy.includes(FARM_MEMORY_ZU.draftNotice));
    assert.ok(copy.includes(farmMemoryCategoryLabel('zu', 'maintenance')));
    assert.ok(!copy.includes('Farmer observations from the journal'));
  }
  assert.ok(csv.includes('"bed-1"'), 'the stored reference is not translated');
  assert.ok(output.includes(FARM_MEMORY_ZU.exportPrintHelp));
  assert.ok(output.includes(FARM_MEMORY_ZU.exportFooter));
  for (const englishControl of ['Journal copy', 'Field journal — selected entries', 'Recorded bed:', 'Recorded crop:', 'Copy prepared', 'This copy works offline.', 'Original wording retained', 'Selected journal entries', 'DEMONSTRATION JOURNAL']) {
    assert.ok(!output.includes(englishControl), `${englishControl}: exported controls must follow isiZulu`);
  }
  assert.deepEqual(rows, before);
});

test('isiZulu exports keep formula and HTML protections, sample markers and original photo numbering', () => {
  const payload = '=HYPERLINK("https://bad")';
  const attack = '<script>alert(1)</script>';
  const row = entry('a', { title: attack, notes: payload, photos: ['https://example.com/unavailable.jpg', 'data:image/png;base64,iVBORw0KGgo='] });
  const csv = buildJournalCsv([row], { lang: 'zu', selection: payload });
  const output = buildJournalHtml([row], { lang: 'zu', title: attack, selection: attack });
  assert.ok(csv.includes('"\'=HYPERLINK(""https://bad"")"'));
  assert.ok(output.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!output.includes('<script>'));
  assert.ok(output.includes('default-src \'none\''));
  assert.ok(!output.includes('src="https://'));
  assert.ok(output.includes('Isithombe sejenali esifakiwe 2'));
  assert.ok(output.includes('Isithombe 2'));
  assert.ok(!output.includes('Isithombe sejenali esifakiwe 1'));
  assert.ok(output.includes('Isithombe esingu-1 asifakiwe'));
  const withoutPhotos = buildJournalHtml([row], { lang: 'zu', includePhotos: false });
  assert.ok(!withoutPhotos.includes('<img src='));
  assert.ok(withoutPhotos.includes('Izithombe ezingu-2 azifakiwe kule khophi ngokukhetha kwakho.'));
  const empty = buildJournalHtml([], { lang: 'zu' });
  assert.ok(empty.includes(FARM_MEMORY_ZU.exportEmpty));
  assert.ok(empty.includes('okungu-0'));
  assert.match(buildJournalHtml([], { lang: 'xh' }), /<html lang="en">/);
});
