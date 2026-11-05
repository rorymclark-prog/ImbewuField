import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { GrowerJournalLink, JournalEntry, JournalNurseryProgressObservation } from '../lib/field-journal.ts';
import { buildJournalCsv, buildJournalHtml, type JournalExportOptions } from '../lib/journal-export.ts';

const link: GrowerJournalLink = { version: 1, scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' },
  plantingId: 'private-original-planting', bedId: 'private-original-bed', eventKind: 'nursery-start', plannedDate: '2028-02-01' };
function legacy(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return { id: 'legacy-entry', date: '2028-02-09', title: 'Own historical words', notes: 'Line one.\nOriginal "quoted" words.',
    category: 'planting', bedLabel: 'Historical bed label', createdAt: 1000, updatedAt: 1000, ...overrides };
}
function sowing(traysUsed: number | null = 0): JournalEntry {
  return legacy({ id: 'sowing-entry', growerCycleLink: link, nurserySowing: { kind: 'nursery-sowing-observation', version: 1,
    traysUsed, references: { variety: 'Entered variety', seedLotReference: null, raisingBatchReference: 'Entered batch' } } });
}
const priorCases: { entries: JournalEntry[]; options: JournalExportOptions }[] = [
  { entries: [], options: {} }, { entries: [legacy()], options: {} },
  { entries: [legacy({ title: '=SUM(1,2)', notes: '<script>text only</script>', photos: ['data:image/png;base64,AAAA'] })],
    options: { lang: 'zu', sample: true, title: 'Explicit title', selection: 'Explicit selected rows', generatedAt: 'Explicit copy receipt', includePhotos: false } },
  { entries: [sowing(0)], options: {} }, { entries: [sowing(null)], options: { sample: true } },
  { entries: [legacy(), sowing(3)], options: { lang: 'zu', generatedAt: 'Opaque copy receipt', includePhotos: true } },
  { entries: [legacy({ growerCycleLink: { version: 99, raw: 'PRIVATE LINK EVIDENCE' } }),
    { ...sowing(), nurserySowing: { version: 99, raw: 'PRIVATE SOWING EVIDENCE' } }], options: { lang: 'en' } },
  { entries: [sowing()], options: { lang: 'xh' } },
];
// Captured from actual parent builders before any progress model/export edit.
// Byte preservation is required here; no alternative exporter is embedded.
const priorHashes: readonly { csv: string; html: string }[] = [
  { csv: 'db86d7f231430d0c73d719c4c5f03eedde5b4d7c7b39dacbb1e39b87ee8fdb57', html: '2b47eed5acbeb4a5258a492b173e4b59ff7dde274223dac8ce7576740681db32' },
  { csv: '46ac843ee0f82d8777b78b977414713da7b738041f91329f52f3e4c1d0ec2e9e', html: 'c3007a9ad94487343aefdba602c4c3c55ebda004a842a13f77adf315aee831b2' },
  { csv: '4181cb453fce2006b23ccd1de258b9c271ef329eb3aec234af312f90a9b9a7fd', html: '3390e145704452e7a0edee3243a7947bfcb4118ebd0379ebbc6ce9f6f78f908c' },
  { csv: '629350b7fc28ab129f9963622dcac847eb43e5be2dc8cdf6a99e8590c998493c', html: '9d61a2c6856e138e53fee1e035693b80daf237d28b480bcfb4a8e3d3c06743c4' },
  { csv: '78758c06f64935ec12813e770b3b3c668d627824b4d692ea5c8745bebb32c938', html: '34a6750804b31f78146c739b85581c8535634dff803b26c71540986f5c5e02f9' },
  { csv: 'ee84ad3b32207954c200ff45e887177bddfbcdb5b0a93d7e83485791737978ce', html: 'afc5b69da27d677af5e31225f023361d4fb5fc91f0a23a587e78035e84c05576' },
  { csv: '8e47494cd154124b0ef36f9a344395fc89633618a020d497a2a824bc7302dbb7', html: '8877aeacc32207417a1ad352a6befe07be20105599e3e77687617ed2f2e4bf25' },
  { csv: '629350b7fc28ab129f9963622dcac847eb43e5be2dc8cdf6a99e8590c998493c', html: '9d61a2c6856e138e53fee1e035693b80daf237d28b480bcfb4a8e3d3c06743c4' },
];
function payload(stage: JournalNurseryProgressObservation['stage'] = 'emerged',
  coverage: JournalNurseryProgressObservation['coverage'] = 'checked-subset', plantsObserved = 0): JournalNurseryProgressObservation {
  return { kind: 'nursery-progress-observation', version: 1, stage, coverage, plantsObserved,
    references: { variety: 'Entered variety', seedLotReference: 'Entered lot', raisingBatchReference: 'Entered raising label' } };
}
function progress(value: unknown = payload()): JournalEntry {
  return legacy({ id: 'progress-entry', growerCycleLink: structuredClone(link), nurseryProgress: value });
}
function csvRows(text: string) {
  const records: string[][] = []; let cells: string[] = [], cell = '', quoted = false;
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { cells.push(cell); cell = ''; }
    else if (c === '\r' && text[i + 1] === '\n' && !quoted) { cells.push(cell); records.push(cells); cells = []; cell = ''; i++; }
    else cell += c;
  }
  assert.equal(quoted, false); assert.equal(cell, ''); assert.equal(cells.length, 0);
  const [header, ...body] = records; assert.ok(header); assert.equal(new Set(header).size, header.length);
  for (const row of body) assert.equal(row.length, header.length);
  return { header, rows: body.map(row => Object.fromEntries(header.map((key, i) => [key, row[i]]))) };
}
const columns = ['Nursery progress observation status (English)', 'Observed stage (grower assessment)',
  'Count coverage', 'Plants observed', 'Progress variety / cultivar (user-entered)',
  'Progress seed-lot reference (user-entered)', 'Progress raising-batch reference (user-entered)',
  'Progress planned nursery start (UTC calendar date)'];

test('every legacy and sowing-only copy preserves the actual parent CSV and HTML bytes without progress fields', () => {
  assert.equal(priorHashes.length, priorCases.length);
  priorCases.forEach(({ entries, options }, index) => {
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    assert.equal(hash(buildJournalCsv(entries, options)), priorHashes[index].csv, `Prior CSV ${index}`);
    assert.equal(hash(buildJournalHtml(entries, options)), priorHashes[index].html, `Prior HTML ${index}`);
  });
});

test('CSV appends conditional progress evidence without changing existing date, sowing columns or other selected records', () => {
  const entries = [progress(payload('alive', 'checked-subset', 0)), sowing(), legacy()];
  const before = structuredClone(entries);
  const result = csvRows(buildJournalCsv(entries));
  const oldHeader = csvRows(buildJournalCsv(entries.map(({ nurseryProgress: _payload, ...entry }) => entry))).header;
  assert.deepEqual(result.header, [...oldHeader, ...columns]);
  assert.equal(result.rows[0][columns[0]], 'Observed'); assert.equal(result.rows[0][columns[1]], 'Alive (grower assessment)');
  assert.equal(result.rows[0][columns[2]], 'Checked subset'); assert.equal(result.rows[0][columns[3]], '0');
  assert.equal(result.rows[0][columns[4]], 'Entered variety'); assert.equal(result.rows[0][columns[5]], 'Entered lot');
  assert.equal(result.rows[0][columns[6]], 'Entered raising label'); assert.equal(result.rows[0][columns[7]], '2028-02-01');
  assert.equal(result.rows[0].Date, '2028-02-09');
  for (const record of result.rows.slice(1)) for (const key of columns) assert.equal(record[key], '');
  assert.deepEqual(entries, before);
});

test('all explicit stages and coverage remain separate dated assessments, never certified readiness or a summed inventory', () => {
  const entries = [progress(payload('emerged', 'whole-batch', 7)), progress(payload('alive', 'checked-subset', 5)), progress(payload('ready', 'checked-subset', 3))];
  const records = csvRows(buildJournalCsv(entries)).rows;
  assert.deepEqual(records.map(row => row[columns[1]]), ['Emerged (grower assessment)', 'Alive (grower assessment)', 'Ready (grower assessment)']);
  assert.deepEqual(records.map(row => row[columns[2]]), ['Whole batch', 'Checked subset', 'Checked subset']);
  assert.deepEqual(records.map(row => row[columns[3]]), ['7', '5', '3']);
  const output = buildJournalHtml(entries);
  assert.equal((output.match(/<h3>Recorded nursery count<\/h3>/g) ?? []).length, 3);
  assert.match(output, /not a readiness certificate/); assert.match(output, /not available stock or crop capacity/);
  assert.match(output, /Observed day<\/dt><dd>2028-02-09/);
  assert.match(output, /Planned nursery start \(UTC calendar date\)<\/dt><dd>2028-02-01/);
  assert.doesNotMatch(output, /<dt>Total plants|<dt>Germination|private-original-planting|site:0\.00000,0\.00000/);
});

test('malformed, missing, proposed and dual payloads export a review hold without checked counts, labels or raw contents', () => {
  const secret = 'PRIVATE RAW PROGRESS EVIDENCE';
  const entries = [progress(null), progress({ ...payload(), version: 2, raw: secret }), progress({ ...payload(), plantsObserved: null }),
    progress({ ...payload(), kind: 'planned-nursery-reference' }), { ...progress(), nurseryProgress: undefined },
    { ...progress(), growerCycleLink: null }, { ...progress(), nurserySowing: sowing().nurserySowing }];
  for (const entry of entries) {
    const record = csvRows(buildJournalCsv([entry])).rows[0]; assert.equal(record[columns[0]], 'Needs review');
    for (const key of columns.slice(1)) assert.equal(record[key], '');
    const output = buildJournalHtml([entry]); assert.match(output, /Nursery progress observation needs review/);
    for (const copy of [output, buildJournalCsv([entry])]) {
      assert.equal(copy.includes(secret), false); assert.equal(copy.includes('Entered lot'), false);
      assert.equal(copy.includes('Entered variety'), false); assert.equal(copy.includes('Entered raising label'), false);
    }
    assert.doesNotMatch(output, /<dt>Plants observed/);
  }
});

test('historical nullable reference snapshots remain Not recorded and do not need a live planting lookup', () => {
  const entry = progress({ ...payload('ready', 'whole-batch', 0), references: { variety: null, seedLotReference: null, raisingBatchReference: null } });
  const record = csvRows(buildJournalCsv([entry])).rows[0];
  for (const key of columns.slice(4, 7)) assert.equal(record[key], 'Not recorded');
  const output = buildJournalHtml([entry]); assert.equal((output.match(/Not recorded/g) ?? []).length, 3);
  assert.match(output, /reference labels are user-entered, not verified seed identity/);
});

test('progress labels use the existing spreadsheet formula and HTML escaping without changing stored observations', () => {
  for (const label of ['=SUM(1,2)', '+SUM(1)', '-1+2', '@SUM(1)', '  =1', '</dd><script>bad()</script><img src=x>']) {
    const entry = progress({ ...payload(), references: { variety: label, seedLotReference: label, raisingBatchReference: label } });
    const before = structuredClone(entry), record = csvRows(buildJournalCsv([entry])).rows[0];
    for (const key of columns.slice(4, 7)) assert.equal(record[key], /^[\s]*[=+@-]/.test(label) ? `'${label}` : label);
    const output = buildJournalHtml([entry]); assert.doesNotMatch(output, /<script>|<img src=x>/);
    if (label.startsWith('</dd>')) assert.match(output, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
    assert.deepEqual(entry, before);
  }
});

test('progress export is selection-bound with explicit English fields in an isiZulu sample copy', () => {
  const selected = progress(), excluded = progress({ ...payload(), references: { ...payload().references, seedLotReference: 'EXCLUDED REFERENCE' } });
  const csv = buildJournalCsv([selected], { lang: 'zu', sample: true }), output = buildJournalHtml([selected], { lang: 'zu', sample: true });
  assert.match(csv, /^\uFEFF"Usuku"/); assert.equal(csv.includes('EXCLUDED REFERENCE'), false);
  assert.match(output, /<html lang="zu">/); assert.match(output, /<section lang="en" class="basis"><h3>Recorded nursery count/);
  assert.equal(output.includes('EXCLUDED REFERENCE'), false);
  assert.equal(Object.hasOwn(excluded, 'nurseryProgress'), true);
});
