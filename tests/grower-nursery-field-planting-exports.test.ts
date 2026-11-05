import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react-test-renderer';
import ts from 'typescript';
import * as journal from '../lib/field-journal.ts';
import type { GrowerJournalLink, JournalEntry, JournalNurseryFieldPlantingObservation } from '../lib/field-journal.ts';
import { buildJournalCsv, buildJournalHtml, type JournalExportOptions } from '../lib/journal-export.ts';
import { filterJournalEntries } from '../lib/journal-view.ts';
import { mountJournal, renderedButton, renderedText } from './journal-workflow-renderer.ts';

const link: GrowerJournalLink = { version: 1, scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' },
  plantingId: 'private-original-planting', bedId: 'original-bed', eventKind: 'field-entry', plannedDate: '2028-02-10' };
function legacy(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return { id: 'original-entry', date: '2028-02-12', title: 'Original observation title', notes: 'Original note.\nExact "quoted" words.',
    category: 'planting', bedLabel: 'Recorded bed label', cropName: 'Recorded crop label', createdAt: 1000, updatedAt: 1000, ...overrides };
}
function nursery(kind: 'sowing' | 'progress'): JournalEntry {
  return legacy({ id: kind, growerCycleLink: { ...link, eventKind: 'nursery-start', plannedDate: '2028-02-01' },
    ...(kind === 'sowing' ? { nurserySowing: { kind: 'nursery-sowing-observation', version: 1, traysUsed: null,
      references: { variety: 'Prior variety', seedLotReference: null, raisingBatchReference: 'Prior raising label' } } }
      : { nurseryProgress: { kind: 'nursery-progress-observation', version: 1, plantsObserved: 0, stage: 'ready', coverage: 'checked-subset',
        references: { variety: 'Prior variety', seedLotReference: 'Prior lot', raisingBatchReference: null } } }) });
}
const priorCases: { entries: JournalEntry[]; options: JournalExportOptions }[] = [
  { entries: [], options: {} }, { entries: [legacy()], options: {} },
  { entries: [legacy({ title: '=SUM(1,2)', photos: ['data:image/png;base64,AAAA'] })],
    options: { lang: 'zu', sample: true, title: 'Explicit title', selection: 'Explicit selection', generatedAt: 'Opaque receipt text', includePhotos: false } },
  { entries: [legacy({ growerCycleLink: link })], options: {} },
  { entries: [nursery('sowing')], options: {} }, { entries: [nursery('progress')], options: { sample: true } },
  { entries: [legacy(), nursery('sowing'), nursery('progress')], options: { lang: 'zu', generatedAt: 'Explicit preparation text' } },
  { entries: [legacy({ growerCycleLink: { version: 99, raw: 'PRIVATE LINK' } }),
    { ...nursery('sowing'), nurseryProgress: nursery('progress').nurseryProgress }], options: { lang: 'en' } },
];
// Captured from the actual old exporter before this lane edits its source.
// The fixture matrix includes prior mixed evidence, not just happy-path rows.
const priorHashes: readonly { csv: string; html: string }[] = [
  { csv: 'db86d7f231430d0c73d719c4c5f03eedde5b4d7c7b39dacbb1e39b87ee8fdb57', html: '2b47eed5acbeb4a5258a492b173e4b59ff7dde274223dac8ce7576740681db32' },
  { csv: 'b5762036aabbca0623381073b1f9dbaee81b81d098dedf1eb41489b2b9dd0a41', html: '562db62c1dfc2333c66b57ab000d1e46c961ffc64dc12e335bdd9f49730209b1' },
  { csv: '16ce4f6d0044972213e9cfce8610f83a0b31fa1033b45a83fcf611a0bae7e1b5', html: '42cac66a7c70813fd6a3fe4bcf609863e16762844f137bc2e5c1ce095d356004' },
  { csv: '0c8746acbf6bee7a04adb9935808e865cb9213baf7e6cd961995d068326e5c97', html: 'a2ee8237d4286881cea9c1465b6212b4d0da65885492599165112a212cc7aa04' },
  { csv: 'a55b534fbef9cc841dd97104b81883c78c62315bc5f8f7699be5b58d14b435b5', html: '2d367388b89ca228689f5e808548e348d2c97eed9c937c5530480f5a201664a7' },
  { csv: '783acfa326037e55415749daae38dc814d58757c8b9e539ca9e75b527d78e02a', html: 'f9234265c8aa92b901ccc9a28519d50890fe4a3f491171534887ea5cfd8bad11' },
  { csv: 'fb99e5e5e6e2a3f2f37199af17e7bf39d0c18a30d254975f1c9622516145b950', html: 'd47feea624a2b7d2c71462cd635c91a56404d1b9a75e6ae55dba80438f811ae1' },
  { csv: 'da5e7b6e721f8d19ca0b762e7bc0a260eba45ff8a792cfac33f7bf577ba92503', html: '513fca78e85c1cf5773692a24468a247924fb60523f42bd2b1ba571ac87696ec' },
];
function payload(plantsPlanted = 0): JournalNurseryFieldPlantingObservation {
  return { kind: 'nursery-field-planting-observation', version: 1, plantsPlanted,
    references: { variety: 'Historical variety', seedLotReference: 'Historical lot', raisingBatchReference: 'Historical raising label' } };
}
function entry(value: unknown = payload(), overrides: Partial<JournalEntry> = {}): JournalEntry {
  return legacy({ id: 'field-planting', bedId: link.bedId, growerCycleLink: structuredClone(link), nurseryFieldPlanting: value, ...overrides });
}
function csvRecords(text: string) {
  const rows: string[][] = []; let cells: string[] = [], cell = '', quoted = false;
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { cells.push(cell); cell = ''; }
    else if (c === '\r' && text[i + 1] === '\n' && !quoted) { cells.push(cell); rows.push(cells); cells = []; cell = ''; i++; }
    else cell += c;
  }
  assert.equal(quoted, false); assert.equal(cell, ''); assert.equal(cells.length, 0);
  const [header, ...body] = rows; assert.ok(header); assert.equal(new Set(header).size, header.length);
  for (const row of body) assert.equal(row.length, header.length);
  return { header, rows: body.map(row => Object.fromEntries(header.map((key, i) => [key, row[i]]))) };
}
const columns = ['Nursery field planting observation status (English)', 'Plants planted during this recorded work',
  'Field planting variety / cultivar (user-entered)', 'Field planting seed-lot reference (user-entered)',
  'Field planting raising-batch reference (user-entered)', 'Planned field entry (UTC calendar date)'];
const require = createRequire(import.meta.url);
function actualSummary() {
  const source = readFileSync(new URL('../components/journal/JournalNurseryFieldPlantingSummary.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as { default: React.ComponentType<{ entry: unknown }> } };
  new Function('require', 'module', 'exports', compiled)((name: string) => name === '@/lib/field-journal' ? journal : require(name), module, module.exports);
  return module.exports.default;
}

test('old journal CSV and HTML bytes remain identical for legacy, sowing, progress and previously mixed evidence without the new marker', () => {
  assert.equal(priorHashes.length, priorCases.length);
  priorCases.forEach(({ entries, options }, index) => {
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    assert.equal(hash(buildJournalCsv(entries, options)), priorHashes[index].csv, `Prior CSV ${index}`);
    assert.equal(hash(buildJournalHtml(entries, options)), priorHashes[index].html, `Prior HTML ${index}`);
  });
});

test('CSV preserves original fields and adds distinct selected field-planting columns with explicit zero and a separate planned date', () => {
  const rows = [entry(), nursery('sowing'), nursery('progress'), legacy()], before = structuredClone(rows);
  const result = csvRecords(buildJournalCsv(rows));
  const oldHeader = csvRecords(buildJournalCsv(rows.map(({ nurseryFieldPlanting: _value, ...row }) => row))).header;
  assert.deepEqual(result.header, [...oldHeader, ...columns]);
  assert.equal(result.rows[0][columns[0]], 'Observed'); assert.equal(result.rows[0][columns[1]], '0');
  assert.equal(result.rows[0][columns[2]], 'Historical variety'); assert.equal(result.rows[0][columns[3]], 'Historical lot');
  assert.equal(result.rows[0][columns[4]], 'Historical raising label'); assert.equal(result.rows[0][columns[5]], '2028-02-10');
  assert.equal(result.rows[0].Date, '2028-02-12'); assert.equal(result.rows[0]['Recorded crop'], 'Recorded crop label');
  for (const row of result.rows.slice(1)) for (const key of columns) assert.equal(row[key], '');
  assert.deepEqual(rows, before);
});

test('historical observed counts and nullable labels print without live-plan reauthorization, stock arithmetic or inferred prior-record links', () => {
  const row = entry({ ...payload(7), references: { variety: null, seedLotReference: null, raisingBatchReference: null } });
  const record = csvRecords(buildJournalCsv([row])).rows[0];
  assert.equal(record[columns[1]], '7'); for (const key of columns.slice(2, 5)) assert.equal(record[key], 'Not recorded');
  const output = buildJournalHtml([row]);
  assert.match(output, /Observed day<\/dt><dd>2028-02-12/);
  assert.match(output, /Planned field entry \(UTC calendar date\)<\/dt><dd>2028-02-10/);
  assert.match(output, /Plants planted during this recorded work<\/dt><dd>7/);
  assert.equal((output.match(/Not recorded/g) ?? []).length, 3);
  assert.match(output, /not a stock balance, survival result or completed batch/);
  assert.match(output, /not verified seed identity/);
  assert.doesNotMatch(output, /private-original-planting|site:0\.00000,0\.00000|sowingEntryId|progressEntryId/);
});

test('future, malformed, missing, nursery-start or mixed field-planting evidence exports only a hold without checked quantities or raw labels', () => {
  const secret = 'PRIVATE MALFORMED EVIDENCE';
  for (const row of [entry(null), entry({ ...payload(99), version: 2, raw: secret }), entry({ ...payload(), plantsPlanted: null }),
    entry(undefined, { nurseryFieldPlanting: undefined }), entry(payload(), { growerCycleLink: { ...link, eventKind: 'nursery-start' } }),
    entry(payload(), { nurserySowing: nursery('sowing').nurserySowing }), entry(payload(), { nurseryProgress: nursery('progress').nurseryProgress })]) {
    const record = csvRecords(buildJournalCsv([row])).rows[0]; assert.equal(record[columns[0]], 'Needs review');
    for (const key of columns.slice(1)) assert.equal(record[key], '');
    const output = buildJournalHtml([row]); assert.match(output, /Nursery field planting observation needs review/);
    for (const copy of [output, buildJournalCsv([row])]) {
      assert.equal(copy.includes(secret), false); assert.equal(copy.includes('Historical lot'), false); assert.equal(copy.includes('Historical variety'), false);
    }
    assert.doesNotMatch(output, /<dt>Plants planted during this recorded work/);
  }
});

test('CSV formula guards and HTML escaping protect snapshot labels while keeping the original entry untouched', () => {
  for (const label of ['=SUM(1,2)', '+SUM(1)', '-1+2', '@SUM(1)', '  =1', '</dd><script>bad()</script><img src=x>']) {
    const row = entry({ ...payload(), references: { variety: label, seedLotReference: label, raisingBatchReference: label } });
    const before = structuredClone(row), record = csvRecords(buildJournalCsv([row])).rows[0];
    for (const key of columns.slice(2, 5)) assert.equal(record[key], /^[\s]*[=+@-]/.test(label) ? `'${label}` : label);
    const output = buildJournalHtml([row]); assert.doesNotMatch(output, /<script>|<img src=x>/);
    if (label.startsWith('</dd>')) assert.match(output, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
    assert.deepEqual(row, before);
  }
});

test('search includes only inspected historical labels and zero, retains original filters and never searches malformed raw evidence or private IDs', () => {
  const valid = entry(), held = entry({ ...payload(), version: 2, raw: 'RAW SECRET SEARCH' }, { id: 'held', title: 'Held original title' });
  const rows = [valid, held, legacy()];
  assert.deepEqual(filterJournalEntries(rows, { query: 'historical lot 0' }).map(row => row.id), [valid.id]);
  assert.deepEqual(filterJournalEntries(rows, { query: 'raw secret search' }), []);
  assert.deepEqual(filterJournalEntries(rows, { query: 'private-original-planting' }), []);
  assert.deepEqual(filterJournalEntries(rows, { query: 'held original title' }).map(row => row.id), ['held']);
  assert.deepEqual(filterJournalEntries(rows, { query: 'historical lot', from: '2028-02-13' }), []);
  assert.deepEqual(filterJournalEntries(rows, { query: 'historical lot', category: 'harvest' }), []);
  assert.equal(filterJournalEntries(rows, { query: 'original note' }).length, 3);
});

test('the actual readonly summary distinguishes observed and planned days, escapes labels and holds unsafe payloads with zero getter calls', () => {
  const Summary = actualSummary(), row = entry(), before = structuredClone(row);
  const output = renderToStaticMarkup(React.createElement(Summary, { entry: row }));
  assert.match(output, /Plants planted during this recorded work<\/dt><dd>0/);
  assert.match(output, /Observed day<\/dt><dd>2028-02-12/); assert.match(output, /Planned field entry \(UTC calendar date\)<\/dt><dd>2028-02-10/);
  assert.equal(renderToStaticMarkup(React.createElement(Summary, { entry: legacy() })), '');
  let getters = 0; const unsafe = entry();
  Object.defineProperty(unsafe, 'nurseryFieldPlanting', { enumerable: true, get() { getters++; throw Error('Do not execute'); } });
  const held = renderToStaticMarkup(React.createElement(Summary, { entry: unsafe }));
  assert.match(held, /Stored nursery field planting evidence needs review/); assert.equal(held.includes('Historical lot'), false);
  assert.equal(getters, 0); assert.deepEqual(row, before);
  const attack = entry({ ...payload(), references: { variety: '<script>bad()</script>', seedLotReference: null, raisingBatchReference: null } });
  const escaped = renderToStaticMarkup(React.createElement(Summary, { entry: attack }));
  assert.doesNotMatch(escaped, /<script>/); assert.match(escaped, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
});

test('real journal timeline, opened entry sheet and ordinary edit retain a readonly historical field-planting snapshot', async () => {
  const row = entry(), app = await mountJournal({ entries: [row] });
  try {
    assert.equal(app.renderer.root.findAllByProps({ 'aria-label': 'Recorded nursery field planting observation' }).length, 1);
    const open = app.renderer.root.findByProps({ 'aria-label': `Edit entry: ${row.title}` });
    await act(async () => open.props.onClick());
    const sheet = app.renderer.root.findByType(app.Sheet);
    assert.equal(sheet.findAllByProps({ 'aria-label': 'Recorded nursery field planting observation' }).length, 1);
    assert.match(renderedText(sheet), /Historical lot/);
    await act(async () => sheet.findByType('textarea').props.onChange({ target: { value: 'An explicit note correction.' } }));
    await act(async () => sheet.findByType('form').props.onSubmit({ preventDefault() {} }));
    assert.equal(app.stored[0].notes, 'An explicit note correction.');
    assert.deepEqual(app.stored[0].nurseryFieldPlanting, row.nurseryFieldPlanting);
    assert.deepEqual(app.stored[0].growerCycleLink, row.growerCycleLink);
  } finally { await app.close(); }
});

test('real journal search and export handlers select the matching observation and actual builders preserve its downloaded content', async () => {
  const selected = entry(), excluded = legacy({ id: 'excluded', notes: 'EXCLUDED NOTE' });
  const app = await mountJournal({ entries: [selected, excluded] });
  try {
    await act(async () => app.renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value: 'Historical lot' } }));
    assert.equal(app.renderer.root.findAllByType('article').length, 1);
    await act(async () => renderedButton(app.renderer, 'CSV').props.onClick());
    await act(async () => renderedButton(app.renderer, 'Printable copy').props.onClick());
    assert.deepEqual(app.exports.map(copy => copy.entries.map(row => row.id)), [[selected.id], [selected.id]]);
    const csv = buildJournalCsv(app.exports[0].entries, app.exports[0].options);
    const html = buildJournalHtml(app.exports[1].entries, app.exports[1].options);
    assert.equal(csvRecords(csv).rows[0][columns[1]], '0'); assert.match(html, /Recorded field planting/);
    for (const copy of [csv, html]) { assert.equal(copy.includes('EXCLUDED NOTE'), false); assert.equal(copy.includes('Historical lot'), true); }
  } finally { await app.close(); }
});

test('held history remains visibly held in the real journal instead of becoming an ordinary note or a zero count', async () => {
  const app = await mountJournal({ entries: [entry({ ...payload(), version: 2, raw: 'RAW SECRET' })] });
  try {
    const summary = app.renderer.root.findByProps({ 'aria-label': 'Nursery field planting observation needs review' });
    assert.match(renderedText(summary), /count and reference labels are withheld/);
    assert.equal(renderedText(summary).includes('RAW SECRET'), false);
    assert.equal(summary.findAllByType('dd').length, 0);
  } finally { await app.close(); }
});

test('new English field-planting fields remain explicit in a selected isiZulu sample copy', () => {
  const csv = buildJournalCsv([entry()], { lang: 'zu', sample: true }), output = buildJournalHtml([entry()], { lang: 'zu', sample: true });
  assert.match(csv, /^\uFEFF"Usuku"/); assert.match(output, /<html lang="zu">/);
  assert.match(output, /<section lang="en" class="basis"><h3>Recorded field planting/);
  assert.equal(csvRecords(csv).rows[0][columns[1]], '0');
});
