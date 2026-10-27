import type { ExpenseLog, ProductionLog, SalesLog } from './db/types';
import type { SavedInvoice } from './invoices';
import { financePeriodBounds, isInFinancePeriod, type FinancePeriod } from './farm-metrics';
import { cashIncomeTotal, cashLedgerSales, invoiceSalesForPaidInvoice } from './invoice-sales';
import { decimalQuantitySum, quantityTotals, recordQuantity, recordQuantityLabel, recordUnit, type RecordQuantityRow } from './farm-records';
import { numberLabel, randCentsLabel } from './format-figures';
import { inlineTemplate } from './xh-inline';
import { recordsMonthShort } from './records-months';
import { recordsDraft } from './records-regional-drafts';
import { suspectedDuplicateIncomeIds, DUPLICATE_ROW_NOTE } from './duplicate-income';
import { buildFinanceSeries } from './finance-series';
import { localTodayISODate } from './field-teams';
import type { ReportChart, ReportMetric, ReportSection, ReportTable } from './programme-report-pdf';


export type FarmReportKind = 'production' | 'finance';
/** The language of the report's fixed wording. English (the default) and isiZulu build the English
 * report byte-for-byte; 'xh' reads the isiXhosa drafts in lib/locales/xh-inline/g34-farm-report-body.ts,
 * keyed by each English string. Recorded data (names, units, amounts, dates) is never translated. */
export type FarmReportLanguage = 'en' | 'zu' | 'xh';
type Say = (english: string, vars?: Record<string, string | number>) => string;
const sayIn = (language: string | undefined): Say => (english, vars = {}) => inlineTemplate(language ?? 'en', english, null, vars);
// w23-06: "1 local invoices" read as a slip in a document a farmer shares; counts agree with their noun.
const countOf = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
// The translated report body keeps singular and plural as two whole English templates instead, so each
// has its own isiXhosa draft (an isiXhosa noun class changes more than the noun).
const plural = (t: Say) => (n: number, one: string, many: string, vars: Record<string, string | number>) => t(n === 1 ? one : many, vars);
export type FarmReportComparison = 'none' | 'previous' | 'year';
export type FarmReportOptions = {
  kind: FarmReportKind; period: FinancePeriod; now: Date; farm: string; sample: boolean;
  reference?: Date; comparison?: FarmReportComparison;
  language?: FarmReportLanguage;
  production: readonly ProductionLog[]; sales: readonly SalesLog[];
  expenses: readonly ExpenseLog[]; invoices: readonly SavedInvoice[];
};
export type FarmReport = {
  title: string; period: string; date: string; filename: string;
  metrics: ReportMetric[]; chart?: ReportChart; sections: ReportSection[]; tables: ReportTable[];
};

const moneyKnown = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const validDate = (value: string | undefined | null) => Boolean(value && Number.isFinite(Date.parse(value)));
const unique = <T extends { id: string }>(rows: readonly T[]): T[] => [...new Map(rows.map(row => [row.id, row])).values()];
// A unit the farmer typed stays as typed; only the report's own word for 'each' is translated.
const unitWord = (t: Say, unit: string) => unit === 'each' ? t('items') : unit;
const quantityText = (t: Say, rows: readonly RecordQuantityRow[]) => quantityTotals(rows).map(row => `${numberLabel(row.quantity)} ${unitWord(t, row.unit)}`).join(' + ') || t('No known quantities');
const quantityMetric = (t: Say, rows: readonly RecordQuantityRow[]) => {
  const totals = quantityTotals(rows);
  if (!totals.length) return rows.length ? t('Not recorded') : t('No entries');
  return totals.length === 1 ? quantityText(t, rows) : t('{n} units recorded', { n: totals.length });
};
/** recordQuantityLabel with the report's own words ('items', 'Quantity not recorded') said in the reader's language. */
const quantityLabel = (t: Say, row: RecordQuantityRow) => {
  const label = recordQuantityLabel(row);
  if (label === 'Quantity not recorded') return t(label);
  return recordUnit(row) === 'each' && label.endsWith(' items') ? `${label.slice(0, -' items'.length)} ${t('items')}` : label;
};

/** Name the exact calendar period the Records book uses, including summer across New Year. */
export function farmReportPeriod(period: FinancePeriod, reference: Date, today = reference, language?: FarmReportLanguage): string {
  const { start, end } = financePeriodBounds(period, reference);
  const last = new Date(end.getFullYear(), end.getMonth(), 0);
  const vars = { start: localTodayISODate(start), end: localTodayISODate(last) };
  return sayIn(language)(end > today ? '{start} to {end} · current period is incomplete' : '{start} to {end} · past calendar period; record completeness unknown', vars);
}

export function farmComparisonReference(period: FinancePeriod, reference: Date, comparison: FarmReportComparison): Date {
  const { start, months } = financePeriodBounds(period, reference);
  return new Date(start.getFullYear(), start.getMonth() - (comparison === 'year' ? 12 : months), 1);
}

// Each column reuses the full report's invoice reconciliation and validity checks.
// No-entry books cannot become an apparent fall in production or household income.
function farmComparisonTable(options: FarmReportOptions, reference: Date): ReportTable {
  const t = sayIn(options.language);
  const before = farmComparisonReference(options.period, reference, options.comparison!);
  const reports = [before, reference].map(date => buildFarmReport({ ...options, reference: date, comparison: 'none' }));
  const values = [before, reference].map(date => {
    const inside = (value: string | undefined) => isInFinancePeriod(value, options.period, date);
    const production = unique(options.production).filter(row => inside(row.logged_at));
    const allInvoices = unique(options.invoices);
    const invoices = allInvoices.filter(row => row.status === 'paid' && inside(row.paidAt));
    const sales = cashLedgerSales(unique(options.sales), allInvoices.map(row => row.id)).filter(row => inside(row.sold_at));
    const expenses = unique(options.expenses).filter(row => inside(row.spent_at));
    const receipts = sales.length + invoices.length > 0 && sales.every(row => moneyKnown(row.amount)) && invoices.every(row => moneyKnown(row.total)) ? cashIncomeTotal(sales, invoices) : null;
    const costs = expenses.length > 0 && expenses.every(row => moneyKnown(row.amount)) ? decimalQuantitySum(expenses.map(row => row.amount)) : null;
    return { production, sold: [...sales, ...invoices.flatMap(invoiceSalesForPaidInvoice)], receipts: typeof receipts === 'number' && Number.isFinite(receipts) ? receipts : null, costs: typeof costs === 'number' ? costs : null };
  });
  const [b, a] = values;
  const noUsable = t('No usable entries');
  const change = (x: number | null, y: number | null, unit: string) => x === null || y === null ? t('Not comparable') : `${y - x > 0 ? '+' : ''}${unit === 'R' ? randCentsLabel(y - x) : `${numberLabel(y - x)} ${unit}`}`;
  const cash = (label: string, x: number | null, y: number | null) => [label, x === null ? noUsable : randCentsLabel(x), y === null ? noUsable : randCentsLabel(y), change(x, y, 'R')];
  // Units stay exactly as recorded (only the fixed labels are said in the reader's language).
  const quantityRows = (label: string, source: 'production' | 'sold') => {
    const units = [...new Set(values.flatMap(value => value[source].map(recordUnit)))].filter((unit): unit is NonNullable<ReturnType<typeof recordUnit>> => unit !== null);
    return units.map(unit => {
      const reading = (value: typeof a) => {
        const rows = value[source].filter(row => recordUnit(row) === unit);
        return rows.length && rows.every(row => recordQuantity(row) !== null) ? quantityTotals(rows).find(row => row.unit === unit)?.quantity ?? null : null;
      };
      const x = reading(b), y = reading(a);
      return [`${label} · ${unit}`, x === null ? noUsable : `${numberLabel(x)} ${unit}`, y === null ? noUsable : `${numberLabel(y)} ${unit}`, change(x, y, unit)];
    });
  };
  return { title: t('Historical period comparison'), keepAllRowsInSummary: true,
    note: t("Earlier: {earlier}. Selected: {selected}. Absolute changes in recorded totals only; calendar periods can differ in length and season. Current periods are incomplete. No time normalisation or causal claim. Missing or invalid source entries withhold the affected comparison. Unpaid invoices are today's snapshot and are not compared.", { earlier: reports[0].period, selected: reports[1].period }),
    columns: [t('Measure'), t('Earlier period'), t('Selected period'), t('Recorded change')], columnWeights: [1.5, 1.2, 1.2, 1.1],
    rows: options.kind === 'production' ? [...quantityRows(t('Harvest'), 'production'), ...quantityRows(t('Sale quantities'), 'sold')] : [cash(t('Money received'), b.receipts, a.receipts), cash(t('Costs recorded'), b.costs, a.costs), cash(t('Recorded cash margin'), b.receipts !== null && b.costs !== null ? b.receipts - b.costs : null, a.receipts !== null && a.costs !== null ? a.receipts - a.costs : null)] };
}

export function buildFarmReport(options: FarmReportOptions): FarmReport {
  const { now, period, kind } = options;
  const lang = options.language ?? 'en';
  /** A fixed sentence or label; `{name}` placeholders take the recorded values. */
  const t = sayIn(lang);
  const tn = plural(t);
  const money = (value: unknown) => moneyKnown(value) ? randCentsLabel(value) : t('Not recorded');
  const dateLabel = (value: string | undefined) => validDate(value) ? value!.slice(0, 10) : t('Date unavailable');
  // isiXhosa wording is in play only once the isiXhosa drafts are loaded (before that, e.g. on the server, the report is English throughout).
  const xhOn = lang === 'xh' && t('At a glance') !== 'At a glance';
  const notAvailable = t('Not available');
  // The shared 'Amount' draft means a quantity; on a money column use the money book's own word (Isixa).
  const amountWord = xhOn ? recordsDraft('xh', 'Amount') ?? t('Amount') : t('Amount');
  const reference = options.reference ?? now;
  if (!Number.isFinite(reference.getTime()) || localTodayISODate(reference) > localTodayISODate(now)) throw Error('Choose a report date on or before today.');
  const inPeriod = (date: string | undefined) => isInFinancePeriod(date, period, reference);
  const allProduction = unique(options.production), allSales = unique(options.sales), allExpenses = unique(options.expenses), allInvoices = unique(options.invoices);
  const production = allProduction.filter(row => inPeriod(row.logged_at));
  const invoices = allInvoices.filter(invoice => invoice.status === 'paid' && inPeriod(invoice.paidAt));
  // All local invoice IDs matter, including unpaid ones. A linked sale cannot
  // become cash simply because its invoice is outside this report's date range.
  const sales = cashLedgerSales(allSales, allInvoices.map(invoice => invoice.id)).filter(row => inPeriod(row.sold_at));
  const soldQuantities = [...sales, ...invoices.flatMap(invoiceSalesForPaidInvoice)];
  const expenses = allExpenses.filter(row => inPeriod(row.spent_at));
  const receiptValuesKnown = sales.every(row => moneyKnown(row.amount)) && invoices.every(row => moneyKnown(row.total));
  const expensesKnown = expenses.every(row => moneyKnown(row.amount));
  const receipts = cashIncomeTotal(sales.filter(row => moneyKnown(row.amount)), invoices.filter(row => moneyKnown(row.total)));
  const receiptsKnown = receiptValuesKnown && Number.isFinite(receipts);
  const costs = decimalQuantitySum(expenses.filter(row => moneyKnown(row.amount)).map(row => row.amount));
  const margin = receiptsKnown && expensesKnown && costs !== null ? decimalQuantitySum([receipts, -costs]) : null;
  const unpaid = allInvoices.filter(invoice => invoice.status === 'unpaid' && validDate(invoice.dateISO) && Date.parse(invoice.dateISO) <= now.getTime());
  const unpaidTotal = unpaid.every(invoice => moneyKnown(invoice.total)) ? decimalQuantitySum(unpaid.map(invoice => invoice.total)) : null;
  const date = localTodayISODate(now);
  const selectedDates = [...production.map(row => row.logged_at), ...sales.map(row => row.sold_at), ...expenses.map(row => row.spent_at), ...invoices.map(row => row.paidAt!)];
  const futureDates = selectedDates.filter(value => Date.parse(value) > now.getTime());
  const periodLabel = farmReportPeriod(period, reference, now, lang);
  const title = kind === 'production' ? t('Farm production report') : t('Farm finance report');
  const missingDates = allProduction.filter(row => !validDate(row.logged_at)).length + allSales.filter(row => !validDate(row.sold_at)).length
    + allExpenses.filter(row => !validDate(row.spent_at)).length + allInvoices.filter(row => !validDate(row.status === 'paid' ? row.paidAt : row.dateISO)).length;
  const missingQuantities = [...production, ...soldQuantities].filter(row => recordQuantity(row) === null).length;
  const cropNames = [...new Set([...production, ...soldQuantities].map(row => row.crop.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));
  const cropRows = cropNames.map(crop => {
    const picked = production.filter(row => row.crop.trim() === crop), sold = soldQuantities.filter(row => row.crop.trim() === crop);
    return [crop, picked.length ? quantityText(t, picked) : t('No harvest entries'), sold.length ? quantityText(t, sold) : t('No sale quantities'), tn(sold.length, '{harvests} harvest / {sales} sale entry', '{harvests} harvest / {sales} sale entries', { harvests: picked.length, sales: sold.length })];
  });
  const checkDuplicates = suspectedDuplicateIncomeIds([
    ...sales.filter(row => moneyKnown(row.amount)).map(row => ({ id: `sale-${row.id}`, kind: 'sale' as const, amount: row.amount, iso: row.sold_at })),
    ...invoices.filter(row => moneyKnown(row.total)).map(row => ({ id: `invoice-${row.id}`, kind: 'invoice' as const, amount: row.total, iso: row.paidAt! })),
  ]);
  const sources: ReportSection = { title: t('Sources & method'), lines: [
    t('Source: the harvest, sales and expense books available to this account, plus invoices saved on this device. This export does not establish that the books are complete or independently verified.'),
    t('Dates use the same local-calendar period as Records. Harvest, sale, expense and invoice-payment dates determine which entries appear. Some dates record when an entry was saved; check the event date independently.'),
    t('A paid local invoice is counted once as money received. Its linked sale rows are replaced by its recorded quantities. An invoice unavailable on this device may appear through linked sales; non-produce charges may then be absent.'),
    t('Quantities stay in their recorded units. Bags, crates, eggs, items and other counts are never converted to kilograms. Names are kept as recorded; differently named crops are not automatically merged.'),
    t('No modelled harvest, guide price, planned production, opening bank balance or estimated household spending enters this report.'),
  ] };
  const scope: ReportSection = { title: t('Scope & reporting basis'), lines: [
    t('Farm / business: {farm}. Prepared {date}.', { farm: options.farm, date }),
    t('Record period: {period}. This report covers all gardens in the available book; it is not a single-site export.', { period: periodLabel }),
    t('Only dated entries in the selected period contribute to period totals. Unpaid invoices are a separate current snapshot, as recorded on this device.'),
    ...(options.sample ? [t('DEMONSTRATION RECORDS: illustrative figures, not evidence of real production or finances.')] : []),
    t('Personal farm report: review the contents before sharing. Organisation and funder access remain governed by the existing consent controls.'),
  ] };
  const coverage: ReportTable = { title: t('Record coverage & checks'), note: t('Counts describe readable entries in this selection. A book with no entries is not evidence of no farming activity.'), keepAllRowsInSummary: true, columns: [t('Source / check'), t('Entries'), t('Meaning')], rows: [
    [t('Harvest book'), String(production.length), t('Dated harvest entries in the selected period')],
    [t('Direct / unrepresented sales'), String(sales.length), t('Cash sale entries after local invoice replacement')],
    [t('Paid local invoices'), String(invoices.length), t('Counted once, using their payment date')],
    [t('Expense book'), String(expenses.length), t('Dated costs; completeness is not established')],
    [t('Unavailable quantities'), String(missingQuantities), t('These entries contribute no inferred weight or count')],
    [t('Unavailable dates · all available records'), String(missingDates), t('Cannot be allocated to a reporting period')],
    [t('Possible double entries'), String(checkDuplicates.size), t('Manual sales and invoices to review; no entry is silently removed')],
    [t('Future-dated entries'), String(futureDates.length), t('Included when inside the calendar selection, as in Records; check these dates')],
  ] };
  const sections: ReportSection[] = [
    { title: t('At a glance'), lines: kind === 'production' ? [
      t('{n} harvest entries contain {harvest}. Recorded sale quantities: {sold}.', { n: production.length, harvest: quantityText(t, production), sold: quantityText(t, soldQuantities) }),
      t('Harvests and sales may refer to different picking dates, stored produce or bought-in stock. Their difference is not measured household consumption, donations or losses.'),
    ] : [
      t('Money received: {received}. Costs recorded: {costs}.', { received: receiptsKnown ? randCentsLabel(receipts) : t('unavailable amount in the selected receipts'), costs: expensesKnown && costs !== null ? randCentsLabel(costs) : t('unavailable amount in the selected costs') }),
      t('Recorded cash margin: {margin}. This is receipts minus logged expenses, not full accounting profit or a bank balance.', { margin: margin === null ? t('not available') : randCentsLabel(margin) }),
      tn(unpaid.length, '{n} local invoice is currently marked unpaid. It does not enter money received.', '{n} local invoices are currently marked unpaid. They do not enter money received.', { n: unpaid.length }),
    ] }, scope,
    { title: t('What needs a closer look'), lines: [
      ...(!production.length && !sales.length && !invoices.length && !expenses.length ? [t('No dated entries are available for this period. Choose another period or record the activity; no result is inferred.')] : []),
      ...(missingDates ? [tn(missingDates, '{n} available record has no usable event date and cannot enter period totals. Review the source record.', '{n} available records have no usable event date and cannot enter period totals. Review the source records.', { n: missingDates })] : []),
      ...(missingQuantities ? [tn(missingQuantities, '{n} harvest or sale entry has no usable quantity. Their weights and counts remain unavailable.', '{n} harvest or sale entries have no usable quantity. Their weights and counts remain unavailable.', { n: missingQuantities })] : []),
      ...(checkDuplicates.size ? [t('{n} income entries need a possible-duplicate check. {note}', { n: checkDuplicates.size, note: t(DUPLICATE_ROW_NOTE) })] : []),
      ...(futureDates.length ? [tn(futureDates.length, '{n} entry has a future date within this calendar selection. It remains included, as in Records; review its date before sharing.', '{n} entries have future dates within this calendar selection. They remain included, as in Records; review their dates before sharing.', { n: futureDates.length })] : []),
      t('Record household use, donations, losses and stock movements separately before making a food-use balance. Those observations are not supplied by these books.'),
      t('Achieved yield per area needs a matching crop, measured growing area and crop-cycle dates. The current map or plan alone does not provide that comparison.'),
      ...(kind === 'finance' ? [t('Check missing costs, unpaid invoices and supporting slips before sharing the report. Untagged costs are never allocated to crop profit.')] : []),
    ] }, sources,
  ];
  const metrics: ReportMetric[] = kind === 'production' ? [
    { label: t('Harvest logged'), value: quantityMetric(t, production), detail: quantityText(t, production) },
    { label: t('Sale quantities'), value: quantityMetric(t, soldQuantities), detail: quantityText(t, soldQuantities) },
    { label: t('Harvest entries'), value: String(production.length), detail: t('Dated records in this period') },
    { label: t('Produce names'), value: String(cropNames.length), detail: t('As recorded; not a biodiversity score') },
  ] : [
    { label: t('Money received'), value: receiptsKnown ? randCentsLabel(receipts) : notAvailable, detail: `${tn(sales.length, '{n} sale entry', '{n} sale entries', { n: sales.length })} + ${tn(invoices.length, '{n} paid invoice', '{n} paid invoices', { n: invoices.length })}` },
    { label: t('Costs recorded'), value: expensesKnown && costs !== null ? randCentsLabel(costs) : notAvailable, detail: tn(expenses.length, '{n} expense entry; completeness unknown', '{n} expense entries; completeness unknown', { n: expenses.length }) },
    { label: t('Recorded cash margin'), value: margin === null ? notAvailable : randCentsLabel(margin), detail: t('Recorded receipts minus costs; not accounting profit') },
    { label: t('Unpaid invoices now'), value: unpaidTotal === null ? notAvailable : randCentsLabel(unpaidTotal), detail: tn(unpaid.length, '{n} local invoice; current snapshot', '{n} local invoices; current snapshot', { n: unpaid.length }) },
  ];
  const table: ReportTable = { title: t('Production by recorded name'), note: t('Units stay separate. A sale quantity follows its cash/payment date and may come from an earlier harvest. No food-use residual is calculated.'), columns: [t('Produce'), t('Harvest recorded'), t('Sold quantities'), t('Entries')], rows: cropRows };
  const harvestLog: ReportTable = { title: t('Harvest entries'), note: t('Only dated entries in the selected period. The report keeps recorded names and units.'), columns: [t('Date'), t('Produce'), t('Quantity')], rows: [...production].sort((a, b) => a.logged_at.localeCompare(b.logged_at)).map(row => [dateLabel(row.logged_at), row.crop, quantityLabel(t, row)]), includeInSummary: false };
  const cashRows = [
    ...sales.map(row => ({ date: row.sold_at, id: `sale-${row.id}`, cells: [dateLabel(row.sold_at), t('{crop} · sale', { crop: row.crop }), money(row.amount), '', t('Sales book')] })),
    ...invoices.map(row => ({ date: row.paidAt!, id: `invoice-${row.id}`, cells: [dateLabel(row.paidAt), t('Invoice {no}', { no: row.no }), money(row.total), '', t('Paid local invoice')] })),
    ...expenses.map(row => ({ date: row.spent_at, id: `expense-${row.id}`, cells: [dateLabel(row.spent_at), row.item, '', money(row.amount), row.category || t('Expense book')] })),
  ].sort((a, b) => a.date.localeCompare(b.date)).map(row => [...row.cells, checkDuplicates.has(row.id) ? t('Review possible duplicate') : '']);
  const ledger: ReportTable = { title: t('Cash record detail'), note: t('Paid invoice totals replace their linked sales once. Possible manual duplicates remain included until reviewed. Buyer and supplier contact details are omitted.'), columns: [t('Date'), t('Entry'), t('Money in'), t('Money out'), t('Source'), t('Check')], rows: cashRows, includeInSummary: false, columnWeights: [1, 1.8, 1.1, 1.1, 1.2, 1.2] };
  const outstanding: ReportTable = { title: t('Unpaid invoices · current snapshot'), note: t('Local invoices issued on or before {date}, currently marked unpaid. This is not restricted to the selected cash period and is not an independently confirmed receivable balance.', { date }), columns: [t('Invoice'), t('Issued'), t('Due'), amountWord], rows: unpaid.map(row => [String(row.no), dateLabel(row.dateISO), row.dueDateISO || t('Not set'), money(row.total)]) };
  // The English 'Uncategorised' groups the rows; only the label shown to the reader is translated.
  const costCategories = [...new Set(expenses.map(row => row.category || 'Uncategorised'))].sort();
  const costsTable: ReportTable = { title: t('Costs by recorded category'), note: t('All logged categories are included. Missing labour, depreciation, stock and other costs are not estimated.'), columns: [t('Category'), t('Recorded costs'), t('Entries')], rows: costCategories.map(category => {
    const rows = expenses.filter(row => (row.category || 'Uncategorised') === category);
    const total = rows.every(row => moneyKnown(row.amount)) ? decimalQuantitySum(rows.map(row => row.amount)) : null;
    return [category === 'Uncategorised' ? t('Uncategorised') : category, total === null ? notAvailable : randCentsLabel(total), String(rows.length)];
  }) };
  // Records uses whole calendar periods. If an imported entry is future-dated,
  // its month must still appear here rather than silently disagreeing with totals.
  const bounds = financePeriodBounds(period, reference);
  const seriesEnd = new Date(bounds.end.getFullYear(), bounds.end.getMonth(), 0);
  const monthly = buildFinanceSeries(production, sales, expenses, invoices, seriesEnd, bounds.months).months
    .filter(month => isInFinancePeriod(new Date(month.year, month.month - 1, 1).toISOString(), period, reference));
  const monthKey = (date: string) => { const parsed = new Date(date); return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`; };
  const noEntries = t('No entries');
  const monthlyTable: ReportTable = { title: t('Month by month'), note: t('The same local-calendar series as Records, restricted to this selection. No entries means no recorded result. The current month is incomplete. Any future-dated entries in this selection are included and must be checked. Recorded cash margin is not a bank balance or full profit.'), columns: [t('Month'), t('Money received'), t('Costs recorded'), t('Cash margin')], rows: monthly.map(month => {
    const validReceipts = sales.filter(row => monthKey(row.sold_at) === month.key).every(row => moneyKnown(row.amount)) && invoices.filter(row => monthKey(row.paidAt!) === month.key).every(row => moneyKnown(row.total));
    const validCosts = expenses.filter(row => monthKey(row.spent_at) === month.key).every(row => moneyKnown(row.amount));
    // isiXhosa month names, the ones the Records book uses; English keeps finance-series' own label.
    const monthName = xhOn ? `${recordsMonthShort(lang, month.month)} ${month.year}` : month.longLabel;
    return [monthName, !month.hasRecords ? noEntries : validReceipts ? randCentsLabel(month.moneyInZar) : notAvailable, !month.hasRecords ? noEntries : validCosts ? randCentsLabel(month.moneyOutZar) : notAvailable, !month.hasRecords ? noEntries : validReceipts && validCosts ? randCentsLabel(month.netZar) : notAvailable];
  }) };
  const knownWeights = cropNames.flatMap(crop => {
    const rows = production.filter(row => row.crop.trim() === crop && recordUnit(row) === 'kg');
    const total = quantityTotals(rows).find(row => row.unit === 'kg');
    return total ? [{ label: crop, value: total.quantity, display: `${numberLabel(total.quantity)} kg` }] : [];
  });
  const chartRows = [...knownWeights].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'en')).slice(0, 8);
  const comparison = options.comparison && options.comparison !== 'none' ? [farmComparisonTable(options, reference)] : [];
  // The file name is built from English (the downloaded name is the same for every reader).
  return { title, period: periodLabel, date, filename: `ImbewuField-farm-${kind}-${period}-${localTodayISODate(bounds.start)}-${options.comparison || 'none'}-${date}`,
    metrics, sections, tables: [...comparison, ...(kind === 'production' ? [table, coverage, harvestLog] : [monthlyTable, costsTable, outstanding, coverage, ledger])],
    chart: kind === 'production' && knownWeights.length ? { title: t('Recorded harvest weight'), note: t('Showing {shown} of {total} recorded produce names with known weight, largest totals first. Every name and unit remains in the tables. These are recorded totals, not a performance ranking.', { shown: chartRows.length, total: knownWeights.length }), rows: chartRows } : undefined,
  };
}
