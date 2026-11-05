import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { GrowerJournalLink, JournalEntry, JournalNurserySowingObservation } from '../lib/field-journal.ts';
import { createJournalEntry, editJournalEntry, inspectJournalNurserySowing, normaliseJournal } from '../lib/field-journal.ts';
import { buildJournalCsv, buildJournalHtml, type JournalExportOptions } from '../lib/journal-export.ts';

const link: GrowerJournalLink = { version: 1, scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' },
  plantingId: 'private-accepted-planting-id', bedId: 'private-bed-id', eventKind: 'nursery-start', plannedDate: '2028-02-01' };
function legacy(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return { id: 'legacy-note', date: '2028-02-03', title: 'Recorded words', notes: 'Original note.\nA second line.',
    category: 'planting', bedLabel: 'Recorded bed', cropName: 'Recorded crop', createdAt: 1000, updatedAt: 1000, ...overrides };
}
const legacyCases: { entries: JournalEntry[]; options: JournalExportOptions }[] = [
  { entries: [], options: {} },
  { entries: [legacy()], options: {} },
  { entries: [legacy({ title: '=SUM(1,2)', notes: 'Exact "quoted" words\nwith comma, and line', photos: ['data:image/png;base64,AAAA', 'https://arbitrary.invalid/omitted'] }),
    legacy({ id: 'linked-legacy', growerCycleLink: link })], options: { lang: 'zu', sample: true, generatedAt: 'Explicit preparation label', title: 'Selected <copy>', selection: 'Explicit selection', includePhotos: false } },
  { entries: [legacy({ growerCycleLink: { version: 99, retained: 'never exported' }, bedId: 'old-bed' })], options: { sample: true, selection: 'Selected historical notes' } },
  { entries: [legacy({ photos: ['data:image/jpeg;base64,AAAA'] })], options: { lang: 'en', generatedAt: 'Synthetic receipt text', includePhotos: true } },
  { entries: [legacy()], options: { lang: 'xh' } },
];

// Captured from the actual untouched parent journal-export.ts before this change.
// These are byte identities, not a second exporter or a normalized-output comparison.
const legacyHashes: readonly { csv: string; html: string }[] = [
  { csv: 'db86d7f231430d0c73d719c4c5f03eedde5b4d7c7b39dacbb1e39b87ee8fdb57', html: '2b47eed5acbeb4a5258a492b173e4b59ff7dde274223dac8ce7576740681db32' },
  { csv: '678b7da2c4b84119d44d046aad4b9d33e5116b1f172f9743667fffd0db912bc0', html: 'f0a7cbb21310ecf70b6d4f3a13915dc06804e5123beef1a65cdaaab7076cd61d' },
  { csv: '25d6e82aa3db48c6c470987112ab4421079c4b40fe1209a2da579cb663f0a074', html: '9053b675973f0c17f0293150e3067effef5efe48061685affb142b385c4e4944' },
  { csv: 'd030765c085e2ffadda22af8698fbf8919d2dd114854bdf9ed08e12b627bdabe', html: '7b6d7a46511b29b4903a0530b455b17ac4964bb0dbae09ad25fd9c7d151037a0' },
  { csv: '48436f84ca6c7443fa7ca81fa101eb46bce0b40689e7e519a376599f39eb6018', html: '440e7637d89a2eab94eeceee5a0722d36f2c793547e18e3ba40eeb53726c614c' },
  { csv: '678b7da2c4b84119d44d046aad4b9d33e5116b1f172f9743667fffd0db912bc0', html: 'f0a7cbb21310ecf70b6d4f3a13915dc06804e5123beef1a65cdaaab7076cd61d' },
];

function payload(traysUsed: number | null = null): JournalNurserySowingObservation {
  return { kind: 'nursery-sowing-observation', version: 1, traysUsed,
    references: { variety: 'Entered variety', seedLotReference: 'Entered lot', raisingBatchReference: 'Entered raising batch' } };
}
function observation(value: unknown = payload()): JournalEntry {
  return { ...legacy({ id: 'observed-note', bedId: link.bedId }), growerCycleLink: structuredClone(link), nurserySowing: value };
}
function csvRecords(text: string): { header: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let index = text.charCodeAt(0) === 0xfeff ? 1 : 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (character === '\r' && text[index + 1] === '\n' && !quoted) {
      row.push(cell); rows.push(row); row = []; cell = ''; index++;
    } else cell += character;
  }
  assert.equal(quoted, false); assert.equal(cell, ''); assert.equal(row.length, 0);
  const [header, ...body] = rows;
  assert.ok(header); assert.equal(new Set(header).size, header.length);
  for (const values of body) assert.equal(values.length, header.length);
  return { header, rows: body.map(values => Object.fromEntries(header.map((key, index) => [key, values[index]]))) };
}
const addedColumns = ['Nursery sowing observation status (English)', 'Physical trays used (including partly filled trays)',
  'Recorded variety / cultivar (user-entered)', 'Recorded seed-lot reference (user-entered)',
  'Recorded raising-batch reference (user-entered)', 'Planned nursery start (UTC calendar date)'];

test('all legacy-only CSV and HTML copies retain the exact parent bytes across old languages, links, photos, samples and empty selections', () => {
  assert.equal(legacyHashes.length, legacyCases.length);
  legacyCases.forEach(({ entries, options }, index) => {
    const hash = (text: string) => createHash('sha256').update(text).digest('hex');
    assert.equal(hash(buildJournalCsv(entries, options)), legacyHashes[index].csv, `Legacy CSV fixture ${index}`);
    assert.equal(hash(buildJournalHtml(entries, options)), legacyHashes[index].html, `Legacy HTML fixture ${index}`);
  });
});

test('selected observed history appends six explicit fields while preserving the existing observed date and all original CSV columns', () => {
  const original = [observation(payload(0)), observation(payload(null)), legacy()];
  const before = structuredClone(original);
  const output = csvRecords(buildJournalCsv(original));
  const baselineHeader = csvRecords(buildJournalCsv(original.map(({ nurserySowing: _value, ...entry }) => entry))).header;
  assert.deepEqual(output.header, [...baselineHeader, ...addedColumns]);
  assert.equal(output.rows[0][addedColumns[0]], 'Observed');
  assert.equal(output.rows[0][addedColumns[1]], '0'); assert.equal(output.rows[1][addedColumns[1]], 'Unknown');
  assert.equal(output.rows[0][addedColumns[2]], 'Entered variety');
  assert.equal(output.rows[0][addedColumns[3]], 'Entered lot');
  assert.equal(output.rows[0][addedColumns[4]], 'Entered raising batch');
  assert.equal(output.rows[0][addedColumns[5]], '2028-02-01');
  assert.equal(output.rows[0].Date, '2028-02-03');
  for (const key of addedColumns) assert.equal(output.rows[2][key], '');
  assert.deepEqual(original, before);
});

test('blank reference snapshots export Not recorded, while real count and source date are retained without a live plan', () => {
  const entry = observation({ ...payload(3), references: { variety: null, seedLotReference: null, raisingBatchReference: null } });
  assert.equal(inspectJournalNurserySowing(entry).status, 'observed');
  const record = csvRecords(buildJournalCsv([entry])).rows[0];
  assert.equal(record[addedColumns[1]], '3');
  for (const key of addedColumns.slice(2, 5)) assert.equal(record[key], 'Not recorded');
  const html = buildJournalHtml([entry]);
  assert.match(html, /Observed day<\/dt><dd>2028-02-03/);
  assert.match(html, /Planned nursery start \(UTC calendar date\)<\/dt><dd>2028-02-01/);
  assert.equal((html.match(/Not recorded/g) ?? []).length, 3);
  assert.match(html, /user-entered, not verified seed identity/);
  assert.doesNotMatch(html, /private-accepted-planting-id|site:0\.00000,0\.00000/);
});

test('malformed, future, unlinked or non-nursery payloads export only a hold and never checked count, labels or raw evidence', () => {
  const secret = 'SYNTHETIC MALFORMED PRIVATE PAYLOAD';
  const entries = [observation({ ...payload(9), version: 2, raw: secret }), observation(null),
    observation({ ...payload(9), kind: 'planned-nursery-reference' }),
    { ...observation(), growerCycleLink: null }, { ...observation(), growerCycleLink: { ...link, eventKind: 'field-entry' } },
    { ...observation(), nurserySowing: undefined }];
  for (const entry of entries) {
    const record = csvRecords(buildJournalCsv([entry])).rows[0];
    assert.equal(record[addedColumns[0]], 'Needs review');
    for (const key of addedColumns.slice(1)) assert.equal(record[key], '');
    const html = buildJournalHtml([entry]);
    assert.match(html, /Nursery sowing observation needs review/);
    for (const output of [html, buildJournalCsv([entry])]) {
      assert.equal(output.includes(secret), false); assert.equal(output.includes('Entered lot'), false);
      assert.equal(output.includes('Entered variety'), false); assert.equal(output.includes('Entered raising batch'), false);
    }
    assert.doesNotMatch(html, /<dt>Physical trays used/);
  }
});

test('unknown, zero and partly filled physical-tray counts are described as observations rather than planned full-tray equivalents', () => {
  const zero = buildJournalHtml([observation(payload(0))]);
  const unknown = buildJournalHtml([observation(payload(null))]);
  assert.match(zero, /Physical trays used \(including partly filled trays\)<\/dt><dd>0/);
  assert.match(unknown, /Physical trays used \(including partly filled trays\)<\/dt><dd>Unknown/);
  for (const output of [zero, unknown]) {
    const snapshot = output.match(/<section lang="en" class="basis"><h3>Recorded nursery sowing[\s\S]*?<\/section>/)?.[0];
    assert.ok(snapshot);
    // This is a claim about the observation, not unrelated layout CSS such as
    // the unchanged photo max-width:100% in the self-contained document.
    assert.doesNotMatch(snapshot, /observed stock|stock movement|germination rate|100%/);
  }
});

test('CSV protects formula-prefixed snapshot labels and HTML escapes their markup without changing stored history', () => {
  const labels = ['=SUM(1,2)', '+SUM(1)', '-1+2', '@SUM(1)', '  =1', '</dd><script>bad()</script><img src=x>'];
  for (const label of labels) {
    const entry = observation({ ...payload(1), references: { variety: label, seedLotReference: label, raisingBatchReference: label } });
    const before = structuredClone(entry);
    const record = csvRecords(buildJournalCsv([entry])).rows[0];
    for (const key of addedColumns.slice(2, 5)) assert.equal(record[key], /^[\s]*[=+@-]/.test(label) ? `'${label}` : label);
    const html = buildJournalHtml([entry]);
    assert.doesNotMatch(html, /<script>|<img src=x>/);
    if (label.startsWith('</dd>')) assert.match(html, /&lt;\/dd&gt;&lt;script&gt;bad\(\)&lt;\/script&gt;/);
    assert.deepEqual(entry, before);
  }
});

test('later reference edits or legacy note editing cannot rewrite the exported historical snapshot', () => {
  const snapshot = payload(2);
  const created = createJournalEntry({ date: '2028-02-03', title: 'Own observation', notes: 'Entered note', category: 'planting',
    bedId: link.bedId, growerCycleLink: link, nurserySowing: snapshot }, 1000);
  const loaded = normaliseJournal([created])[0];
  const edited = editJournalEntry(loaded, { date: loaded.date, title: loaded.title, notes: 'An explicit note correction', category: 'planting',
    nurserySowing: { ...payload(99), references: { ...snapshot.references, seedLotReference: 'Later planned lot' } } }, 2000);
  const records = csvRecords(buildJournalCsv([edited])).rows[0];
  assert.equal(records[addedColumns[1]], '2'); assert.equal(records[addedColumns[3]], 'Entered lot');
  assert.equal(buildJournalHtml([edited]).includes('Later planned lot'), false);
});

test('export scope is only selected observations and new English fields remain explicit inside an isiZulu copy', () => {
  const selected = observation(payload(0)), excluded = observation({ ...payload(), references: { ...payload().references, seedLotReference: 'EXCLUDED SNAPSHOT' } });
  const csv = buildJournalCsv([selected], { lang: 'zu', sample: true });
  const html = buildJournalHtml([selected], { lang: 'zu', sample: true });
  assert.match(csv, /^\uFEFF"Usuku"/); assert.equal(csv.includes('EXCLUDED SNAPSHOT'), false);
  assert.match(html, /<html lang="zu">/); assert.match(html, /<section lang="en" class="basis"><h3>Recorded nursery sowing/);
  assert.equal(html.includes('EXCLUDED SNAPSHOT'), false);
  const legacyOnly = csvRecords(buildJournalCsv([legacy()]));
  for (const key of addedColumns) assert.equal(legacyOnly.header.includes(key), false);
  assert.equal(Object.hasOwn(excluded, 'nurserySowing'), true);
});
