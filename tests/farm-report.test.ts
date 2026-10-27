import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFarmReport, farmReportPeriod, type FarmReportOptions } from '../lib/farm-report';
import type { ProductionLog, SalesLog, ExpenseLog } from '../lib/db/types';
import type { SavedInvoice } from '../lib/invoices';
import { recordQuantityPayload } from '../lib/farm-records';
import { buildProgrammePdf } from '../lib/programme-report-pdf';
import { pdfContentStreams } from './pdf-content-streams';

const at = '2026-01-12T10:00:00';
const harvest = (id: string, kg: number, date = at): ProductionLog => ({ id, profile_id: 'owner', garden_id: null, crop: 'Swiss chard', kg, photo_url: null, logged_at: date, created_at: date });
const sale = (id: string, amount: number, extra: Partial<SalesLog> = {}): SalesLog => ({ id, profile_id: 'owner', garden_id: null, crop: 'Swiss chard', kg: 3, amount, buyer: 'PRIVATE BUYER', sold_at: at, created_at: at, ...extra });
const cost = (id: string, amount: number): ExpenseLog => ({ id, profile_id: 'owner', garden_id: null, item: 'Recorded expense', amount, supplier: 'PRIVATE SUPPLIER', spent_at: at, created_at: at });
const invoice = (extra: Partial<SavedInvoice> = {}): SavedInvoice => ({ id: 'invoice-1', no: 1, billTo: 'PRIVATE BUYER', items: [{ desc: 'Swiss chard', qty: 3, unit: 'kg', price: 20 }], total: 60, dateISO: at, paidAt: at, status: 'paid', ...extra });
const options = (extra: Partial<FarmReportOptions> = {}): FarmReportOptions => ({ kind: 'finance', period: 'season', now: new Date('2026-01-15T12:00:00'), farm: 'Example farm', sample: false, production: [], sales: [], expenses: [], invoices: [], ...extra });
const metric = (report: ReturnType<typeof buildFarmReport>, label: string) => report.metrics.find(row => row.label === label)!.value;

test('a farmer PDF counts the paid invoice once, including charges that are not produce quantities', () => {
  const report = buildFarmReport(options({ sales: [sale('linked', 60, { invoice_id: 'invoice-1' }), sale('direct', 20)], invoices: [invoice({ total: 75 })], expenses: [cost('cost', 25)] }));
  assert.equal(metric(report, 'Money received'), 'R95,00');
  assert.equal(metric(report, 'Recorded cash margin'), 'R70,00');
  const rows = report.tables.find(row => row.title === 'Cash record detail')!.rows;
  assert.equal(rows.length, 3);
  assert.equal(report.tables.find(row => row.title === 'Month by month')!.rows.find(row => row[0] === 'Jan 2026')![1], 'R95,00');
  assert.ok(!JSON.stringify(report).includes('PRIVATE BUYER'));
  assert.ok(!JSON.stringify(report).includes('PRIVATE SUPPLIER'));
});

test('summer reports retain December entries across New Year and exclude the previous summer', () => {
  const report = buildFarmReport(options({ production: [harvest('dec', 5, '2025-12-20T10:00:00'), harvest('jan', 3), harvest('old', 99, '2025-01-12T10:00:00')], kind: 'production' }));
  assert.equal(metric(report, 'Harvest logged'), '8 kg');
  assert.match(report.period, /^2025-12-01 to 2026-02-28/);
  assert.match(farmReportPeriod('year', options().now), /^2026-01-01 to 2026-12-31/);
});

test('a future-dated entry counted by the calendar selection remains visible in the monthly breakdown', () => {
  const report = buildFarmReport(options({ period: 'year', sales: [sale('future', 40, { sold_at: '2026-12-10T12:00:00' })] }));
  assert.equal(metric(report, 'Money received'), 'R40,00');
  assert.equal(report.tables.find(table => table.title === 'Month by month')!.rows.find(row => row[0] === 'Dec 2026')![1], 'R40,00');
  // w23-06 re-pin: the count still discloses the entry; the noun now agrees with it (was "1 entries have").
  assert.match(JSON.stringify(report.sections), /1 entry has a future date/);
});

test('egg counts and packaged sales remain their actual units and never inflate harvest weight', () => {
  const report = buildFarmReport(options({ kind: 'production', production: [harvest('weight', 10), { ...harvest('count', 0), crop: 'Eggs', ...recordQuantityPayload(12, 'eggs') }], invoices: [invoice({ items: [{ desc: 'Swiss chard', qty: 2, unit: 'crates', price: 30 }] })] }));
  const cropRows = report.tables.find(table => table.title === 'Production by recorded name')!.rows;
  assert.equal(cropRows.find(row => row[0] === 'Eggs')![1], '12 eggs');
  assert.equal(cropRows.find(row => row[0] === 'Swiss chard')![2], '2 crates');
  assert.equal(report.chart!.rows.reduce((sum, row) => sum + row.value, 0), 10);
  assert.equal(metric(report, 'Harvest logged'), '2 units recorded');
});

test('an unpaid invoice and its linked sale cannot become a received payment', () => {
  const report = buildFarmReport(options({ invoices: [invoice({ status: 'unpaid', paidAt: undefined })], sales: [sale('linked', 60, { invoice_id: 'invoice-1' })] }));
  assert.equal(metric(report, 'Money received'), 'R0,00');
  assert.equal(metric(report, 'Unpaid invoices now'), 'R60,00');
  assert.equal(report.tables.find(row => row.title === 'Cash record detail')!.rows.length, 0);
});

test('unpaid invoices are labelled as a current snapshot and cannot be mistaken for period income', () => {
  const report = buildFarmReport(options({ period: 'month', invoices: [invoice({ status: 'unpaid', paidAt: undefined, dateISO: '2025-10-12T10:00:00' })] }));
  assert.equal(metric(report, 'Unpaid invoices now'), 'R60,00');
  assert.match(report.tables.find(row => row.title.startsWith('Unpaid invoices'))!.note, /not restricted to the selected cash period/);
});

test('missing dates and quantities are disclosed rather than converted into current production', () => {
  const report = buildFarmReport(options({ kind: 'production', production: [harvest('no-date', 999, ''), { ...harvest('bad-quantity', 0), kg: null }] }));
  assert.equal(metric(report, 'Harvest logged'), 'Not recorded');
  assert.equal(report.chart, undefined);
  const text = JSON.stringify(report);
  // w23-06 re-pin: singular agreement (was "1 available records have").
  assert.match(text, /1 available record has no usable event date/);
  // w23-06 re-pin: singular agreement (was "1 harvest or sale entries have").
  assert.match(text, /1 harvest or sale entry has no usable quantity/);
  assert.ok(!text.includes('999'));
});

test('malformed money cannot produce an apparent complete margin and negative margins stay negative', () => {
  let report = buildFarmReport(options({ sales: [sale('s', Number.NaN)], expenses: [cost('c', 20)] }));
  assert.equal(metric(report, 'Money received'), 'Not available');
  assert.equal(metric(report, 'Recorded cash margin'), 'Not available');
  report = buildFarmReport(options({ sales: [sale('s', 10)], expenses: [cost('c', 20)] }));
  assert.equal(metric(report, 'Recorded cash margin'), '-R10,00');
});

test('an empty book describes no recorded entries and does not claim household food or profit', () => {
  const report = buildFarmReport(options({ kind: 'production' }));
  assert.equal(metric(report, 'Harvest logged'), 'No entries');
  const text = JSON.stringify(report);
  assert.match(text, /No dated entries are available/);
  assert.match(text, /not measured household consumption/);
  assert.ok(!report.metrics.some(row => /profit|household|yield per/i.test(row.label)));
});

test('possible duplicate manual income remains visible for a human review and repeated source IDs count once', () => {
  const row = sale('same-id', 60);
  const report = buildFarmReport(options({ sales: [row, structuredClone(row)], invoices: [invoice()] }));
  assert.equal(metric(report, 'Money received'), 'R120,00');
  assert.equal(report.tables.find(table => table.title === 'Cash record detail')!.rows.filter(row => row.at(-1) === 'Review possible duplicate').length, 2);
});

test('both downloadable farmer editions preserve scope, current-invoice caveat and farm identity', async () => {
  const report = buildFarmReport(options({ invoices: [invoice({ status: 'unpaid', paidAt: undefined })], sample: true }));
  for (const format of ['summary', 'full'] as const) {
    const pdf = await buildProgrammePdf(report.title, true, report.sections, format, undefined, [], 'Evidence', undefined, { metrics: report.metrics, tables: report.tables, subtitle: report.period, date: report.date, reportLabel: 'Farm records', ownerLabel: 'Farm / business' });
    const text = pdfContentStreams(pdf.output('arraybuffer'));
    assert.match(text, /Farm finance report/);
    assert.match(text, /DEMONSTRATION RECORDS/);
    assert.match(text, /Example farm/);
    assert.match(text, /Unpaid invoices/);
    assert.match(text, /current snapshot/);
    assert.match(text, /Farm records/);
    assert.match(text, /Unavailable dates/);
    assert.match(text, /Possible double entries/);
  }
});

test('a six-column cash ledger carries its last entry across pages with readable headings', async () => {
  const report = buildFarmReport(options({ sales: Array.from({ length: 45 }, (_, index) => sale(`sale-${index}`, 20 + index)) }));
  const pdf = await buildProgrammePdf(report.title, false, report.sections, 'full', undefined, [], 'Evidence', undefined, { metrics: report.metrics, tables: report.tables });
  const text = pdfContentStreams(pdf.output('arraybuffer'));
  assert.match(text, /R64,00/);
  assert.ok((text.match(/Money in/g) ?? []).length >= 2);
  assert.ok((text.match(/Money out/g) ?? []).length >= 2);
});

test('isiXhosa reader: the report body is isiXhosa, every figure and recorded name is unchanged, and English is untouched', async () => {
  const { XH_INLINE_SOURCE } = await import('../lib/locales/xh-inline/index');
  const { registerXhInline } = await import('../lib/xh-inline');
  const figures = (value: unknown) => (JSON.stringify(value).match(/\d+(?:[.,]\d+)?/g) ?? []).join(' ');
  const eggs = { ...harvest('count', 0), crop: 'Eggs', ...recordQuantityPayload(12, 'eggs') };
  const base = {
    production: [harvest('a', 10), harvest('b', 4, '2025-12-20T10:00:00'), eggs, { ...harvest('nodate', 999), logged_at: '' }],
    sales: [sale('direct', 20), sale('linked', 60, { invoice_id: 'invoice-1' })],
    expenses: [cost('cost', 25), { ...cost('tagged', 5), category: 'Seed' }] as ExpenseLog[],
    invoices: [invoice({ total: 75 }), invoice({ id: 'invoice-2', no: 2, status: 'unpaid', paidAt: undefined, dueDateISO: '2026-02-01' })],
  };
  try {
    registerXhInline(XH_INLINE_SOURCE);
    for (const kind of ['production', 'finance'] as const) {
      const english = buildFarmReport(options({ ...base, kind }));
      // Omitting the language, or asking for English or isiZulu, is the same English report.
      assert.deepEqual(buildFarmReport(options({ ...base, kind, language: 'en' })), english);
      assert.deepEqual(buildFarmReport(options({ ...base, kind, language: 'zu' })), english);
      const xh = buildFarmReport(options({ ...base, kind, language: 'xh' }));
      assert.notEqual(xh.title, english.title);
      assert.notEqual(xh.period, english.period);
      assert.deepEqual(xh.sections.map(s => s.title).filter(title => english.sections.some(s => s.title === title)), [], 'every section title is isiXhosa');
      assert.deepEqual(xh.tables.map(table => table.title).filter(title => english.tables.some(table => table.title === title)), [], 'every table title is isiXhosa');
      assert.deepEqual(xh.metrics.map(m => m.label).filter(label => english.metrics.some(m => m.label === label)), [], 'every metric label is isiXhosa');
      // Same shape: sections, lines, tables, rows, columns, chart rows.
      assert.deepEqual(xh.sections.map(s => s.lines.length), english.sections.map(s => s.lines.length));
      assert.deepEqual(xh.tables.map(table => [table.rows.length, table.columns.length]), english.tables.map(table => [table.rows.length, table.columns.length]));
      assert.equal(xh.chart?.rows.length, english.chart?.rows.length);
      // Every section line is isiXhosa, and so is every table title/note/column and the chart wording.
      xh.sections.forEach((section, i) => section.lines.forEach((line, n) => assert.notEqual(line, english.sections[i].lines[n], `section line ${i}.${n} is isiXhosa`)));
      xh.tables.forEach((table, i) => { assert.notEqual(table.note, english.tables[i].note); table.columns.forEach((column, n) => assert.notEqual(column, english.tables[i].columns[n], `${table.title} column ${n}`)); });
      if (english.chart) { assert.notEqual(xh.chart!.title, english.chart.title); assert.notEqual(xh.chart!.note, english.chart.note); }
      // Money, counts and dates are exact, recorded names stay as recorded, the download name is English.
      for (const amount of JSON.stringify(english).match(/-?R\d[\d\s,]*/g) ?? []) assert.ok(JSON.stringify(xh).includes(amount), `${amount} survives`);
      const numbersIn = (value: string) => (value.match(/\d[\d\s,]*/g) ?? []).map(number => number.trim());
      assert.deepEqual(xh.metrics.map(m => numbersIn(m.value)), english.metrics.map(m => numbersIn(m.value)));
      assert.deepEqual(xh.metrics.map(m => numbersIn(m.detail ?? '')), english.metrics.map(m => numbersIn(m.detail ?? '')));
      assert.equal(xh.filename, english.filename);
      assert.equal(xh.date, english.date);
      assert.match(xh.period, /^2025-12-01 .*2026-02-28 · /);
      const text = JSON.stringify(xh);
      assert.ok(!text.includes('PRIVATE BUYER') && !text.includes('PRIVATE SUPPLIER'));
      for (const name of ['Swiss chard', 'Eggs', 'Recorded expense', 'Example farm', '12 eggs']) if (JSON.stringify(english).includes(name)) assert.ok(text.includes(name), `${name} stays as recorded`);
      assert.ok(figures(xh.tables.map(table => table.rows.map(row => row.filter(cell => /\d/.test(cell) && !/[a-z]/i.test(cell)))))
        === figures(english.tables.map(table => table.rows.map(row => row.filter(cell => /\d/.test(cell) && !/[a-z]/i.test(cell))))), 'purely numeric cells (amounts, counts, dates) are identical');
    }
    // The money words are the money book's.
    const finance = buildFarmReport(options({ ...base, kind: 'finance', language: 'xh' }));
    const ledger = finance.tables.find(table => table.columns.includes('Imali engenayo'))!;
    assert.deepEqual(ledger.columns.slice(2, 4), ['Imali engenayo', 'Imali ephumayo']);
    assert.ok(finance.metrics.some(m => m.label === 'Imali eseleyo ebhaliweyo'));
    // The month rows use isiXhosa month names with the same year.
    assert.match(String(finance.tables[0].rows[0][0]), /^(Jan|Feb|Mat|Epr|Mey|Jun|Jul|Aga|Sep|Okt|Nov|Dis) 20\d\d$/);
  } finally { registerXhInline({}); }
  // Without the isiXhosa drafts loaded (the server, English readers) the English comes back unchanged.
  assert.deepEqual(buildFarmReport(options({ ...base, language: 'xh' })), buildFarmReport(options({ ...base })));
});
