import type { OrgReportSummary } from '@/lib/report-org-summary';
import { deliverFile, type FileDelivery } from '@/lib/file-delivery';

// ── NGO/funder aggregate impact report → PDF ──────────────────────────────
//
// Phase 4 of the NGO/funder dashboard build (see PROGRESS.md / plan). `lib/report-pdf.ts`'s
// `ReportPdfMeta` is shaped around a single farmer's SITE — biome, lat/lon, rainfall, soil pH —
// none of which an org-wide report has one honest value for (it covers many gardens, in many
// places, with many soils). Forcing this into that shape would mean inventing a biome or
// coordinates for a document meant to go to a funder. `lib/survey-pdf.ts` faced the same
// mismatch for the opposite reason (too small, not too broad) and made the same call: its own
// small, plain jsPDF builder rather than a forced fit.

export type OrgReportPdfDelivery = FileDelivery;

/** File-system-safe name for the exported report. */
export function orgReportPdfFilename(orgName: string, date = new Date()): string {
  const safe = (orgName || 'Organisation')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'Organisation';
  const stamp = Number.isNaN(date.getTime()) ? 'undated' : date.toISOString().slice(0, 10);
  return `ImbewuField-${safe}-Impact-Report-${stamp}.pdf`;
}

const INK = { text: [32, 25, 15], muted: [110, 96, 74], green: [31, 77, 43], gold: [154, 96, 30] } as const;

/** Build the org's aggregate impact report as a PDF blob. Throws if jsPDF cannot be loaded. */
export async function buildOrgReportPdf(
  orgName: string,
  summary: OrgReportSummary,
  dateLabel: string,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const M = 46;
  const CW = PW - M * 2;
  const BOTTOM = doc.internal.pageSize.getHeight() - 40;
  let y = M;

  const setInk = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const need = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = M; } };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); setInk(INK.text);
  doc.text(orgName || 'Organisation', M, y); y += 24;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); setInk(INK.muted);
  doc.text(`Impact report · ${dateLabel}`, M, y); y += 26;

  // Consent disclosure UP FRONT — every total below this line is scoped to consenting farmers
  // only, and a reader must see that before the numbers, not in a footnote after them.
  const consentLine = summary.totalFarmers > 0
    ? `${summary.consentedFarmers} of ${summary.totalFarmers} farmers have opted in to share their data. `
      + 'Every figure below covers only those farmers.'
    : 'No farmers are recorded for this organisation yet.';
  doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); setInk(INK.gold);
  const consentLines = doc.splitTextToSize(consentLine, CW) as string[];
  doc.text(consentLines, M, y); y += consentLines.length * 13 + 18;

  // ── Summary stats ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); setInk(INK.green);
  doc.text('Summary', M, y); y += 16;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); setInk(INK.text);
  const stats: [string, string][] = [
    ['Gardens', String(summary.gardens)],
    ['Farmers sharing data', `${summary.consentedFarmers} of ${summary.totalFarmers}`],
    ['Production logged', `${summary.productionKg.toFixed(1)} kg`],
    ['Sold', `${summary.salesKg.toFixed(1)} kg · R${summary.salesAmount.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`],
    ['Average training complete', `${summary.avgCoursesPct}%`],
  ];
  for (const [label, value] of stats) {
    need(14);
    doc.text(label, M, y);
    doc.text(value, M + 220, y);
    y += 14;
  }
  y += 12;

  // ── Per-farmer table ──
  need(20);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); setInk(INK.green);
  doc.text('By farmer', M, y); y += 16;

  const cols = [
    { label: 'Farmer', w: 130 },
    { label: 'Garden', w: 110 },
    { label: 'Shared', w: 50 },
    { label: 'Prod. kg', w: 55 },
    { label: 'Sold kg', w: 50 },
    { label: 'Sales R', w: 60 },
    { label: 'Training', w: 45 },
  ];
  const drawHeader = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setInk(INK.muted);
    let x = M;
    for (const c of cols) { doc.text(c.label, x, y); x += c.w; }
    y += 12;
    doc.setDrawColor(226, 216, 196);
    doc.line(M, y - 8, M + CW, y - 8);
  };
  drawHeader();

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  for (const r of summary.farmers) {
    need(14);
    if (y === M + 12) drawHeader(); // page just broke — repeat the header
    const pct = r.coursesTotal > 0 ? Math.round((r.coursesDone / r.coursesTotal) * 100) : 0;
    const cells = r.consented
      ? [r.name, r.gardenName, 'Yes', r.productionKg.toFixed(1), r.salesKg.toFixed(1), r.salesAmount.toFixed(0), `${pct}%`]
      : [r.name, r.gardenName, 'Not yet', '—', '—', '—', '—'];
    setInk(r.consented ? INK.text : INK.muted);
    let x = M;
    cells.forEach((cell, i) => {
      const w = cols[i].w;
      const lines = doc.splitTextToSize(cell, w - 4) as string[];
      doc.text(lines[0] ?? '', x, y);
      x += w;
    });
    y += 14;
  }

  y += 10;
  need(24);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setInk(INK.muted);
  const trust = 'Figures are sums of what farmers logged in ImbewuField — nothing here is estimated or inferred.';
  doc.text(doc.splitTextToSize(trust, CW) as string[], M, y); y += 12;
  doc.text('Generated by ImbewuField', M, y);

  return doc.output('blob');
}

export async function deliverOrgReportPdf(blob: Blob, filename: string): Promise<OrgReportPdfDelivery> {
  return deliverFile(blob, filename, 'ImbewuField Impact Report');
}
