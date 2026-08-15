/**
 * The lender record, as an A4 PDF — reshapes lib/credit-pack.ts's aggregates into the document a
 * farmer hands to a bank. Follows the jsPDF pattern already established by lib/invoice-pdf.ts
 * (measure, wrap, paginate — never trust a fixed y) and lib/report-pdf.ts (footer on every page,
 * layoutTableColumns for tables that must not starve a narrow column).
 *
 * THE NON-NEGOTIABLE THIS FILE EXISTS TO ENFORCE. ImbewuField falls back to a local sample sandbox
 * (lib/sample-mode.ts) whenever Firebase is not configured, so an evaluator or a farmer with no
 * signal can still see a fully-populated demo farm. A PDF full of Ubhejane Crèche's demo numbers,
 * handed to a real bank as if it were this farmer's own record, is a far worse failure than any
 * bug in this file's arithmetic — so `buildCreditPackPdf` REFUSES to run at all while sample mode
 * is on. It checks before touching jsPDF, so the refusal does not depend on anything about the PDF
 * pipeline working correctly; it is the first line of the function, full stop.
 */

import { isSampleMode } from './sample-mode';
import { deliverFile, type FileDelivery } from './file-delivery';
import { layoutTableColumns } from './report-pdf';
import { formatInvoiceZar, formatQuantity } from './invoice-document';
import type { ExpenseCategory, ExpenseLog, ProductionLog, SalesLog } from './db/types';
import {
  buildMonthlyCashFlow,
  creditPackCashFlowSummary,
  creditPackHasAnyRecords,
  creditPackIncomeConsistency,
  creditPackTrackRecord,
  hasEnoughForConsistencyTrend,
  hasHarvestHistory,
  hasSalesHistory,
  CREDIT_PACK_ASSURANCE_ONE_LINE,
  CREDIT_PACK_FRAMING_PARAGRAPHS,
  CREDIT_PACK_TRAILING_MONTHS,
} from './credit-pack';

/** Thrown by buildCreditPackPdf when called while sample mode is on. Never caught silently —
 *  callers must show the farmer why nothing was produced, not swallow it. */
export class CreditPackSampleModeError extends Error {
  constructor() {
    super('This export is disabled while you are viewing the sample farm. Sign in and turn off the sample to export your own records.');
    this.name = 'CreditPackSampleModeError';
  }
}

export interface CreditPackFarmerIdentity {
  name: string | null;
  farmName: string | null;
  phone: string | null;
}

export interface CreditPackDocumentInput {
  farmer: CreditPackFarmerIdentity;
  production: ProductionLog[];
  sales: SalesLog[];
  expenses: ExpenseLog[];
  /** Defaults to `new Date()`. Exposed for tests, and so the cover date and the trailing-months
   *  window are always computed from the same instant. */
  now?: Date;
}

/** File-system-safe name for the exported document, same convention as reportPdfFilename. */
export function creditPackPdfFilename(farmName: string | null | undefined, date = new Date()): string {
  const safe = (farmName || 'Farm')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'Farm';
  const stamp = Number.isNaN(date.getTime()) ? 'undated' : date.toISOString().slice(0, 10);
  return `ImbewuField-Records-${safe}-${stamp}.pdf`;
}

const INK = {
  text: [32, 25, 15] as const,
  muted: [154, 130, 104] as const,
  green: [31, 77, 43] as const,
  rule: [226, 216, 196] as const,
};

function categoryLabel(category: ExpenseCategory | 'uncategorised'): string {
  if (category === 'uncategorised') return 'Uncategorised';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function dateLabel(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Build the lender record as a PDF blob. Throws CreditPackSampleModeError in sample mode, and
 *  throws whatever jsPDF throws if it cannot load — same contract as buildReportPdf. */
export async function buildCreditPackPdf(input: CreditPackDocumentInput): Promise<Blob> {
  if (isSampleMode()) throw new CreditPackSampleModeError();

  const now = input.now ?? new Date();
  const months = buildMonthlyCashFlow(input.sales, input.expenses, now, CREDIT_PACK_TRAILING_MONTHS);
  const consistency = creditPackIncomeConsistency(months);
  const cashFlow = creditPackCashFlowSummary(months, input.expenses);
  const track = creditPackTrackRecord(input.production, input.sales);

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 48;
  const CW = PW - M * 2;
  const BOTTOM = PH - 58;
  let y = 0;

  const setInk = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const setRule = (c: readonly number[]) => doc.setDrawColor(c[0], c[1], c[2]);

  const footer = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setInk(INK.muted);
    doc.text(String(doc.getNumberOfPages()), PW - M, PH - 34, { align: 'right' });
    doc.setFontSize(6.5);
    const lines = (doc.splitTextToSize(CREDIT_PACK_ASSURANCE_ONE_LINE, CW) as string[]).slice(0, 3);
    doc.text(lines, PW / 2, PH - 30, { align: 'center' });
  };

  const newPage = () => { footer(); doc.addPage(); y = M + 8; };
  const need = (h: number) => { if (y + h > BOTTOM) newPage(); };

  /** Draw wrapped body text and advance y. */
  const paragraph = (text: string, size = 9.5, lineHeight = 13, color: readonly number[] = INK.text) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    setInk(color);
    const lines = doc.splitTextToSize(text, CW) as string[];
    need(lines.length * lineHeight + 6);
    doc.text(lines, M, y);
    y += lines.length * lineHeight + 6;
  };

  const heading = (text: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setInk(INK.green);
    need(30);
    y += 6;
    doc.text(text, M, y);
    y += 8;
    setRule(INK.rule);
    doc.line(M, y, PW - M, y);
    y += 16;
  };

  const emptyNote = (text: string) => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    setInk(INK.muted);
    const lines = doc.splitTextToSize(text, CW) as string[];
    need(lines.length * 13 + 10);
    doc.text(lines, M, y);
    y += lines.length * 13 + 10;
  };

  const drawTable = (headers: string[], rows: string[][], rightAlign: Set<number> = new Set()) => {
    const widths = layoutTableColumns(headers, rows, CW);
    const drawRow = (cells: string[], bold: boolean) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      const wrapped = headers.map((_, c) =>
        doc.splitTextToSize(cells[c] ?? '', Math.max(10, widths[c] - 8)) as string[]);
      const tallest = Math.max(1, ...wrapped.map((w) => w.length));
      need(tallest * 11 + 8);
      let x = M;
      setInk(bold ? INK.muted : INK.text);
      wrapped.forEach((lines, c) => {
        if (rightAlign.has(c)) {
          lines.forEach((line, li) => doc.text(line, x + widths[c] - 4, y + li * 11, { align: 'right' }));
        } else {
          doc.text(lines, x + 2, y);
        }
        x += widths[c];
      });
      y += tallest * 11 + 4;
      setRule(INK.rule);
      doc.line(M, y - 6, PW - M, y - 6);
    };
    y += 4;
    drawRow(headers, true);
    for (const row of rows) drawRow(row, false);
    y += 10;
  };

  /* ── Cover ─────────────────────────────────────────────────────────────── */
  y = M + 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); setInk(INK.text);
  doc.text('ImbewuField', M, y);
  y += 22;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); setInk(INK.green);
  doc.text('Farm records — for a lender', M, y);
  y += 20;

  const farmerName = input.farmer.name?.trim();
  const farmName = input.farmer.farmName?.trim();
  if (farmerName) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); setInk(INK.text);
    doc.text(farmerName, M, y);
    y += 18;
  }
  if (farmName) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); setInk(INK.muted);
    doc.text(farmName, M, y);
    y += 15;
  }

  const generatedLabel = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setInk(INK.muted);
  doc.text(`Generated ${generatedLabel}`, M, y);
  if (months.length > 0) {
    doc.text(`Covers ${months[0].label} to ${months[months.length - 1].label}`, PW - M, y, { align: 'right' });
  }
  y += 14;
  setRule(INK.rule);
  doc.line(M, y, PW - M, y);
  y += 22;

  for (const para of CREDIT_PACK_FRAMING_PARAGRAPHS) paragraph(para);

  // Snapshot — a handful of headline numbers, every one traceable to a section further in.
  need(70);
  y += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setInk(INK.green);
  doc.text('AT A GLANCE', M, y);
  y += 16;
  const snapshot: string[] = [];
  if (months.length > 0) {
    snapshot.push(`${months.length} month${months.length === 1 ? '' : 's'} of records, income logged in ${consistency.monthsWithIncome} of them`);
    snapshot.push(`Total income in this period: ${formatInvoiceZar(cashFlow.totalIncomeZar)} · total costs: ${formatInvoiceZar(cashFlow.totalExpensesZar)}`);
  }
  if (track.saleEntryCount > 0) {
    snapshot.push(`${track.saleEntryCount} sale${track.saleEntryCount === 1 ? '' : 's'} logged, ${formatQuantity(track.totalSoldKg)} kg sold in total`);
  }
  if (track.harvestEntryCount > 0) {
    snapshot.push(`${track.harvestEntryCount} harvest${track.harvestEntryCount === 1 ? '' : 's'} logged, ${formatQuantity(track.totalHarvestedKg)} kg harvested in total`);
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); setInk(INK.text);
  for (const line of snapshot) {
    const wrapped = doc.splitTextToSize(`•  ${line}`, CW - 8) as string[];
    need(wrapped.length * 13 + 2);
    doc.text(wrapped, M, y);
    y += wrapped.length * 13 + 2;
  }

  /* ── Income consistency ───────────────────────────────────────────────── */
  newPage();
  heading('Income consistency, month by month');
  if (!hasEnoughForConsistencyTrend(consistency)) {
    emptyNote(
      months.length === 0
        ? 'No dated sales or costs have been logged yet, so there is no month-by-month record to show. This section will fill in as the farmer logs sales in ImbewuField.'
        : 'Income has been logged in fewer than two separate months so far, so a month-by-month trend would not mean much yet. This section will fill in as more months of sales are logged.',
    );
  } else {
    paragraph(
      `Income was logged in ${consistency.monthsWithIncome} of the last ${consistency.monthsCovered} months on record. `
      + `Average income across all of those months, including the quiet ones, is ${formatInvoiceZar(consistency.avgMonthlyIncomeZar)}.`,
      9.5, 13, INK.muted,
    );
    drawTable(
      ['Month', 'Sales income', 'Costs', 'Net', '# sales'],
      months.map((m) => [
        m.label,
        formatInvoiceZar(m.incomeZar),
        formatInvoiceZar(m.expensesZar),
        formatInvoiceZar(m.netZar),
        String(m.saleCount),
      ]),
      new Set([1, 2, 3, 4]),
    );
  }

  /* ── Cash flow summary ────────────────────────────────────────────────── */
  newPage();
  heading('Cash flow summary');
  if (months.length === 0) {
    emptyNote('No dated sales or costs have been logged yet, so there is no cash flow to summarise.');
  } else {
    paragraph(
      `Over ${cashFlow.monthsCovered} month${cashFlow.monthsCovered === 1 ? '' : 's'}: `
      + `${formatInvoiceZar(cashFlow.totalIncomeZar)} in sales income, ${formatInvoiceZar(cashFlow.totalExpensesZar)} in logged costs, `
      + `for a net cash flow of ${formatInvoiceZar(cashFlow.netZar)}.`,
      10, 14, INK.text,
    );
    if (cashFlow.byCategory.length === 0) {
      emptyNote('No costs have been logged for this period yet.');
    } else {
      drawTable(
        ['Cost category', 'Amount', '# entries'],
        cashFlow.byCategory.map((c) => [categoryLabel(c.category), formatInvoiceZar(c.zar), String(c.count)]),
        new Set([1, 2]),
      );
    }
  }

  /* ── Harvest & sales track record ─────────────────────────────────────── */
  newPage();
  heading('Harvest and sales track record');
  if (!hasHarvestHistory(track)) {
    emptyNote('No harvests have been logged yet.');
  } else {
    paragraph(
      `${track.harvestEntryCount} harvest${track.harvestEntryCount === 1 ? '' : 's'} logged, `
      + `${formatQuantity(track.totalHarvestedKg)} kg in total, from ${dateLabel(track.firstHarvestIso)} to ${dateLabel(track.lastHarvestIso)}.`,
      10, 14, INK.text,
    );
  }
  if (!hasSalesHistory(track)) {
    emptyNote('No sales have been logged yet.');
  } else {
    paragraph(
      `${track.saleEntryCount} sale${track.saleEntryCount === 1 ? '' : 's'} logged, `
      + `${formatQuantity(track.totalSoldKg)} kg sold for ${formatInvoiceZar(track.totalRevenueZar)} in total, `
      + `from ${dateLabel(track.firstSaleIso)} to ${dateLabel(track.lastSaleIso)}.`,
      10, 14, INK.text,
    );
  }
  if (track.topCrops.length > 0) {
    y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setInk(INK.green);
    need(18);
    doc.text('BY CROP', M, y);
    y += 4;
    drawTable(
      ['Crop', 'Harvested', 'Sold', 'Revenue'],
      track.topCrops.map((c) => [
        c.crop,
        `${formatQuantity(c.harvestedKg)} kg`,
        `${formatQuantity(c.soldKg)} kg`,
        formatInvoiceZar(c.revenueZar),
      ]),
      new Set([1, 2, 3]),
    );
  }

  footer();
  return doc.output('blob');
}

export type CreditPackDelivery = FileDelivery;

/** Get the finished lender record onto the farmer's device — same share/download rule as
 *  deliverPdf in lib/report-pdf.ts. */
export async function deliverCreditPackPdf(blob: Blob, filename: string): Promise<CreditPackDelivery> {
  return deliverFile(blob, filename, 'ImbewuField Farm Records');
}

/** True when there is nothing to export — the UI should disable the button rather than let a
 *  farmer generate an empty document with their name on it. */
export function creditPackReady(production: ProductionLog[], sales: SalesLog[], expenses: ExpenseLog[]): boolean {
  return creditPackHasAnyRecords(production, sales, expenses);
}
