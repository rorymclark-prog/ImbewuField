import type { ExpenseLog, ProductionLog, SalesLog } from './db/types';
import type { SavedInvoice } from './invoices';
import { financePeriodBounds, isInFinancePeriod, type FinancePeriod } from './farm-metrics';
import { cashIncomeTotal, cashLedgerSales, invoiceSalesForPaidInvoice } from './invoice-sales';
import { decimalQuantitySum, quantityTotals, recordQuantity, recordQuantityLabel, recordUnit, type RecordQuantityRow } from './farm-records';
import { numberLabel, randCentsLabel } from './format-figures';
import { suspectedDuplicateIncomeIds, DUPLICATE_ROW_NOTE } from './duplicate-income';
import { buildFinanceSeries } from './finance-series';
import { localTodayISODate } from './field-teams';
import type { ReportChart, ReportMetric, ReportSection, ReportTable } from './programme-report-pdf';

export type FarmReportKind = 'production' | 'finance';
export type FarmReportComparison = 'none' | 'previous' | 'year';
export type FarmReportOptions = {
  kind: FarmReportKind; period: FinancePeriod; now: Date; farm: string; sample: boolean;
  reference?: Date; comparison?: FarmReportComparison;
  production: readonly ProductionLog[]; sales: readonly SalesLog[];
  expenses: readonly ExpenseLog[]; invoices: readonly SavedInvoice[];
};
export type FarmReport = {
  title: string; period: string; date: string; filename: string;
  metrics: ReportMetric[]; chart?: ReportChart; sections: ReportSection[]; tables: ReportTable[];
};

const moneyKnown = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const money = (value: unknown) => moneyKnown(value) ? randCentsLabel(value) : 'Not recorded';
const validDate = (value: string | undefined | null) => Boolean(value && Number.isFinite(Date.parse(value)));
const dateLabel = (value: string | undefined) => validDate(value) ? value!.slice(0, 10) : 'Date unavailable';
const unique = <T extends { id: string }>(rows: readonly T[]): T[] => [...new Map(rows.map(row => [row.id, row])).values()];
const quantityText = (rows: readonly RecordQuantityRow[]) => quantityTotals(rows).map(row => `${numberLabel(row.quantity)} ${row.unit === 'each' ? 'items' : row.unit}`).join(' + ') || 'No known quantities';
const quantityMetric = (rows: readonly RecordQuantityRow[]) => {
  const totals = quantityTotals(rows);
  if (!totals.length) return rows.length ? 'Not recorded' : 'No entries';
  return totals.length === 1 ? quantityText(rows) : `${totals.length} units recorded`;
};

/** Name the exact calendar period the Records book uses, including summer across New Year. */
export function farmReportPeriod(period: FinancePeriod, reference: Date, today = reference): string {
  const { start, end } = financePeriodBounds(period, reference);
  const last = new Date(end.getFullYear(), end.getMonth(), 0);
  return `${localTodayISODate(start)} to ${localTodayISODate(last)} · ${end > today ? 'current period is incomplete' : 'past calendar period; record completeness unknown'}`;
}

export function farmComparisonReference(period: FinancePeriod, reference: Date, comparison: FarmReportComparison): Date {
  const { start, months } = financePeriodBounds(period, reference);
  return new Date(start.getFullYear(), start.getMonth() - (comparison === 'year' ? 12 : months), 1);
}

// Each column reuses the full report's invoice reconciliation and validity checks.
// No-entry books cannot become an apparent fall in production or household income.
function farmComparisonTable(options: FarmReportOptions, reference: Date): ReportTable {
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
  const change = (x: number | null, y: number | null, unit: string) => x === null || y === null ? 'Not comparable' : `${y - x > 0 ? '+' : ''}${unit === 'R' ? randCentsLabel(y - x) : `${numberLabel(y - x)} ${unit}`}`;
  const cash = (label: string, x: number | null, y: number | null) => [label, x === null ? 'No usable entries' : randCentsLabel(x), y === null ? 'No usable entries' : randCentsLabel(y), change(x, y, 'R')];
  const quantityRows = (label: string, source: 'production' | 'sold') => {
    const units = [...new Set(values.flatMap(value => value[source].map(recordUnit)))].filter((unit): unit is NonNullable<ReturnType<typeof recordUnit>> => unit !== null);
    return units.map(unit => {
      const reading = (value: typeof a) => {
        const rows = value[source].filter(row => recordUnit(row) === unit);
        return rows.length && rows.every(row => recordQuantity(row) !== null) ? quantityTotals(rows).find(row => row.unit === unit)?.quantity ?? null : null;
      };
      const x = reading(b), y = reading(a);
      return [`${label} · ${unit}`, x === null ? 'No usable entries' : `${numberLabel(x)} ${unit}`, y === null ? 'No usable entries' : `${numberLabel(y)} ${unit}`, change(x, y, unit)];
    });
  };
  return { title: 'Historical period comparison', keepAllRowsInSummary: true,
    note: `Earlier: ${reports[0].period}. Selected: ${reports[1].period}. Absolute changes in recorded totals only; calendar periods can differ in length and season. Current periods are incomplete. No time normalisation or causal claim. Missing or invalid source entries withhold the affected comparison. Unpaid invoices are today's snapshot and are not compared.`,
    columns: ['Measure', 'Earlier period', 'Selected period', 'Recorded change'], columnWeights: [1.5, 1.2, 1.2, 1.1],
    rows: options.kind === 'production' ? [...quantityRows('Harvest', 'production'), ...quantityRows('Sale quantities', 'sold')] : [cash('Money received', b.receipts, a.receipts), cash('Costs recorded', b.costs, a.costs), cash('Recorded cash margin', b.receipts !== null && b.costs !== null ? b.receipts - b.costs : null, a.receipts !== null && a.costs !== null ? a.receipts - a.costs : null)] };
}

export function buildFarmReport(options: FarmReportOptions): FarmReport {
  const { now, period, kind } = options;
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
  const periodLabel = farmReportPeriod(period, reference, now);
  const title = kind === 'production' ? 'Farm production report' : 'Farm finance report';
  const missingDates = allProduction.filter(row => !validDate(row.logged_at)).length + allSales.filter(row => !validDate(row.sold_at)).length
    + allExpenses.filter(row => !validDate(row.spent_at)).length + allInvoices.filter(row => !validDate(row.status === 'paid' ? row.paidAt : row.dateISO)).length;
  const missingQuantities = [...production, ...soldQuantities].filter(row => recordQuantity(row) === null).length;
  const cropNames = [...new Set([...production, ...soldQuantities].map(row => row.crop.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));
  const cropRows = cropNames.map(crop => {
    const picked = production.filter(row => row.crop.trim() === crop), sold = soldQuantities.filter(row => row.crop.trim() === crop);
    return [crop, picked.length ? quantityText(picked) : 'No harvest entries', sold.length ? quantityText(sold) : 'No sale quantities', `${picked.length} harvest / ${sold.length} sale entries`];
  });
  const checkDuplicates = suspectedDuplicateIncomeIds([
    ...sales.filter(row => moneyKnown(row.amount)).map(row => ({ id: `sale-${row.id}`, kind: 'sale' as const, amount: row.amount, iso: row.sold_at })),
    ...invoices.filter(row => moneyKnown(row.total)).map(row => ({ id: `invoice-${row.id}`, kind: 'invoice' as const, amount: row.total, iso: row.paidAt! })),
  ]);
  const sources: ReportSection = { title: 'Sources & method', lines: [
    'Source: the harvest, sales and expense books available to this account, plus invoices saved on this device. This export does not establish that the books are complete or independently verified.',
    'Dates use the same local-calendar period as Records. Harvest, sale, expense and invoice-payment dates determine which entries appear. Some dates record when an entry was saved; check the event date independently.',
    'A paid local invoice is counted once as money received. Its linked sale rows are replaced by its recorded quantities. An invoice unavailable on this device may appear through linked sales; non-produce charges may then be absent.',
    'Quantities stay in their recorded units. Bags, crates, eggs, items and other counts are never converted to kilograms. Names are kept as recorded; differently named crops are not automatically merged.',
    'No modelled harvest, guide price, planned production, opening bank balance or estimated household spending enters this report.',
  ] };
  const scope: ReportSection = { title: 'Scope & reporting basis', lines: [
    `Farm / business: ${options.farm}. Prepared ${date}.`,
    `Record period: ${periodLabel}. This report covers all gardens in the available book; it is not a single-site export.`,
    'Only dated entries in the selected period contribute to period totals. Unpaid invoices are a separate current snapshot, as recorded on this device.',
    ...(options.sample ? ['DEMONSTRATION RECORDS: illustrative figures, not evidence of real production or finances.'] : []),
    'Personal farm report: review the contents before sharing. Organisation and funder access remain governed by the existing consent controls.',
  ] };
  const coverage: ReportTable = { title: 'Record coverage & checks', note: 'Counts describe readable entries in this selection. A book with no entries is not evidence of no farming activity.', keepAllRowsInSummary: true, columns: ['Source / check', 'Entries', 'Meaning'], rows: [
    ['Harvest book', String(production.length), 'Dated harvest entries in the selected period'],
    ['Direct / unrepresented sales', String(sales.length), 'Cash sale entries after local invoice replacement'],
    ['Paid local invoices', String(invoices.length), 'Counted once, using their payment date'],
    ['Expense book', String(expenses.length), 'Dated costs; completeness is not established'],
    ['Unavailable quantities', String(missingQuantities), 'These entries contribute no inferred weight or count'],
    ['Unavailable dates · all available records', String(missingDates), 'Cannot be allocated to a reporting period'],
    ['Possible double entries', String(checkDuplicates.size), 'Manual sales and invoices to review; no entry is silently removed'],
    ['Future-dated entries', String(futureDates.length), 'Included when inside the calendar selection, as in Records; check these dates'],
  ] };
  const sections: ReportSection[] = [
    { title: 'At a glance', lines: kind === 'production' ? [
      `${production.length} harvest entries contain ${quantityText(production)}. Recorded sale quantities: ${quantityText(soldQuantities)}.`,
      'Harvests and sales may refer to different picking dates, stored produce or bought-in stock. Their difference is not measured household consumption, donations or losses.',
    ] : [
      `Money received: ${receiptsKnown ? randCentsLabel(receipts) : 'unavailable amount in the selected receipts'}. Costs recorded: ${expensesKnown && costs !== null ? randCentsLabel(costs) : 'unavailable amount in the selected costs'}.`,
      `Recorded cash margin: ${margin === null ? 'not available' : randCentsLabel(margin)}. This is receipts minus logged expenses, not full accounting profit or a bank balance.`,
      `${unpaid.length} local invoices are currently marked unpaid. They do not enter money received.`,
    ] }, scope,
    { title: 'What needs a closer look', lines: [
      ...(!production.length && !sales.length && !invoices.length && !expenses.length ? ['No dated entries are available for this period. Choose another period or record the activity; no result is inferred.'] : []),
      ...(missingDates ? [`${missingDates} available records have no usable event date and cannot enter period totals. Review the source records.`] : []),
      ...(missingQuantities ? [`${missingQuantities} harvest or sale entries have no usable quantity. Their weights and counts remain unavailable.`] : []),
      ...(checkDuplicates.size ? [`${checkDuplicates.size} income entries need a possible-duplicate check. ${DUPLICATE_ROW_NOTE}`] : []),
      ...(futureDates.length ? [`${futureDates.length} entries have future dates within this calendar selection. They remain included, as in Records; review their dates before sharing.`] : []),
      'Record household use, donations, losses and stock movements separately before making a food-use balance. Those observations are not supplied by these books.',
      'Achieved yield per area needs a matching crop, measured growing area and crop-cycle dates. The current map or plan alone does not provide that comparison.',
      ...(kind === 'finance' ? ['Check missing costs, unpaid invoices and supporting slips before sharing the report. Untagged costs are never allocated to crop profit.'] : []),
    ] }, sources,
  ];
  const metrics: ReportMetric[] = kind === 'production' ? [
    { label: 'Harvest logged', value: quantityMetric(production), detail: quantityText(production) },
    { label: 'Sale quantities', value: quantityMetric(soldQuantities), detail: quantityText(soldQuantities) },
    { label: 'Harvest entries', value: String(production.length), detail: 'Dated records in this period' },
    { label: 'Produce names', value: String(cropNames.length), detail: 'As recorded; not a biodiversity score' },
  ] : [
    { label: 'Money received', value: receiptsKnown ? randCentsLabel(receipts) : 'Not available', detail: `${sales.length} sale entries + ${invoices.length} paid invoices` },
    { label: 'Costs recorded', value: expensesKnown && costs !== null ? randCentsLabel(costs) : 'Not available', detail: `${expenses.length} expense entries; completeness unknown` },
    { label: 'Recorded cash margin', value: margin === null ? 'Not available' : randCentsLabel(margin), detail: 'Recorded receipts minus costs; not accounting profit' },
    { label: 'Unpaid invoices now', value: unpaidTotal === null ? 'Not available' : randCentsLabel(unpaidTotal), detail: `${unpaid.length} local invoices; current snapshot` },
  ];
  const table: ReportTable = { title: 'Production by recorded name', note: 'Units stay separate. A sale quantity follows its cash/payment date and may come from an earlier harvest. No food-use residual is calculated.', columns: ['Produce', 'Harvest recorded', 'Sold quantities', 'Entries'], rows: cropRows };
  const harvestLog: ReportTable = { title: 'Harvest entries', note: 'Only dated entries in the selected period. The report keeps recorded names and units.', columns: ['Date', 'Produce', 'Quantity'], rows: [...production].sort((a, b) => a.logged_at.localeCompare(b.logged_at)).map(row => [dateLabel(row.logged_at), row.crop, recordQuantityLabel(row)]), includeInSummary: false };
  const cashRows = [
    ...sales.map(row => ({ date: row.sold_at, id: `sale-${row.id}`, cells: [dateLabel(row.sold_at), `${row.crop} · sale`, money(row.amount), '', 'Sales book'] })),
    ...invoices.map(row => ({ date: row.paidAt!, id: `invoice-${row.id}`, cells: [dateLabel(row.paidAt), `Invoice ${row.no}`, money(row.total), '', 'Paid local invoice'] })),
    ...expenses.map(row => ({ date: row.spent_at, id: `expense-${row.id}`, cells: [dateLabel(row.spent_at), row.item, '', money(row.amount), row.category || 'Expense book'] })),
  ].sort((a, b) => a.date.localeCompare(b.date)).map(row => [...row.cells, checkDuplicates.has(row.id) ? 'Review possible duplicate' : '']);
  const ledger: ReportTable = { title: 'Cash record detail', note: 'Paid invoice totals replace their linked sales once. Possible manual duplicates remain included until reviewed. Buyer and supplier contact details are omitted.', columns: ['Date', 'Entry', 'Money in', 'Money out', 'Source', 'Check'], rows: cashRows, includeInSummary: false, columnWeights: [1, 1.8, 1.1, 1.1, 1.2, 1.2] };
  const outstanding: ReportTable = { title: 'Unpaid invoices · current snapshot', note: `Local invoices issued on or before ${date}, currently marked unpaid. This is not restricted to the selected cash period and is not an independently confirmed receivable balance.`, columns: ['Invoice', 'Issued', 'Due', 'Amount'], rows: unpaid.map(row => [String(row.no), dateLabel(row.dateISO), row.dueDateISO || 'Not set', money(row.total)]) };
  const costCategories = [...new Set(expenses.map(row => row.category || 'Uncategorised'))].sort();
  const costsTable: ReportTable = { title: 'Costs by recorded category', note: 'All logged categories are included. Missing labour, depreciation, stock and other costs are not estimated.', columns: ['Category', 'Recorded costs', 'Entries'], rows: costCategories.map(category => {
    const rows = expenses.filter(row => (row.category || 'Uncategorised') === category);
    const total = rows.every(row => moneyKnown(row.amount)) ? decimalQuantitySum(rows.map(row => row.amount)) : null;
    return [category, total === null ? 'Not available' : randCentsLabel(total), String(rows.length)];
  }) };
  // Records uses whole calendar periods. If an imported entry is future-dated,
  // its month must still appear here rather than silently disagreeing with totals.
  const bounds = financePeriodBounds(period, reference);
  const seriesEnd = new Date(bounds.end.getFullYear(), bounds.end.getMonth(), 0);
  const monthly = buildFinanceSeries(production, sales, expenses, invoices, seriesEnd, bounds.months).months
    .filter(month => isInFinancePeriod(new Date(month.year, month.month - 1, 1).toISOString(), period, reference));
  const monthKey = (date: string) => { const parsed = new Date(date); return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`; };
  const monthlyTable: ReportTable = { title: 'Month by month', note: 'The same local-calendar series as Records, restricted to this selection. No entries means no recorded result. The current month is incomplete. Any future-dated entries in this selection are included and must be checked. Recorded cash margin is not a bank balance or full profit.', columns: ['Month', 'Money received', 'Costs recorded', 'Cash margin'], rows: monthly.map(month => {
    const validReceipts = sales.filter(row => monthKey(row.sold_at) === month.key).every(row => moneyKnown(row.amount)) && invoices.filter(row => monthKey(row.paidAt!) === month.key).every(row => moneyKnown(row.total));
    const validCosts = expenses.filter(row => monthKey(row.spent_at) === month.key).every(row => moneyKnown(row.amount));
    return [month.longLabel, !month.hasRecords ? 'No entries' : validReceipts ? randCentsLabel(month.moneyInZar) : 'Not available', !month.hasRecords ? 'No entries' : validCosts ? randCentsLabel(month.moneyOutZar) : 'Not available', !month.hasRecords ? 'No entries' : validReceipts && validCosts ? randCentsLabel(month.netZar) : 'Not available'];
  }) };
  const knownWeights = cropNames.flatMap(crop => {
    const rows = production.filter(row => row.crop.trim() === crop && recordUnit(row) === 'kg');
    const total = quantityTotals(rows).find(row => row.unit === 'kg');
    return total ? [{ label: crop, value: total.quantity, display: `${numberLabel(total.quantity)} kg` }] : [];
  });
  const chartRows = [...knownWeights].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'en')).slice(0, 8);
  const comparison = options.comparison && options.comparison !== 'none' ? [farmComparisonTable(options, reference)] : [];
  return { title, period: periodLabel, date, filename: `ImbewuField-farm-${kind}-${period}-${localTodayISODate(bounds.start)}-${options.comparison || 'none'}-${date}`,
    metrics, sections, tables: [...comparison, ...(kind === 'production' ? [table, coverage, harvestLog] : [monthlyTable, costsTable, outstanding, coverage, ledger])],
    chart: kind === 'production' && knownWeights.length ? { title: 'Recorded harvest weight', note: `Showing ${chartRows.length} of ${knownWeights.length} recorded produce names with known weight, largest totals first. Every name and unit remains in the tables. These are recorded totals, not a performance ranking.`, rows: chartRows } : undefined,
  };
}
