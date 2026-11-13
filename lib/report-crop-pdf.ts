import type { jsPDF } from 'jspdf';
import { pdfSafe } from './crop-export-pdf';
import { exactPdfTextWriter } from './pdf-exact-text';
import { originalQuantityEntryLine } from './international/grower-cycle-intent';
import { reportSowingCalendar, reportCropRows, type ReportCropRow, type ReportProductionYear } from './report-crop-plan';
import type { FactCropPlan } from './report-site-facts';

async function drawSavedCropRows(doc: jsPDF, rows: readonly ReportCropRow[], heading: string, note: string): Promise<void> {
  // Load the bundled exact-glyph font only when authored quantity evidence is
  // actually printed. Ordinary report prose keeps its existing formatter.
  const hasHistoricalEvidence = rows.some(row => row.provisionalEvidence);
  const exact = rows.some(row => row.intent?.originalQuantityEntry || row.provisionalEvidence)
    ? await exactPdfTextWriter(doc, () => Error(hasHistoricalEvidence
      ? 'Historical crop evidence cannot be printed faithfully. Open the saved record to retain its original text.'
      : 'An original entered weight cannot be printed faithfully. Review the saved request or download its CSV to retain the exact text.')) : null;
  let continuationLabel: string | null = null;
  const continuationContext = () => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const lines = continuationLabel ? doc.splitTextToSize(pdfSafe(continuationLabel), 515) as string[] : [];
    return { lines, top: lines.length ? 62 + lines.length * 13 + 5 : 70 };
  };
  function page(continued = false) {
    doc.addPage('a4', 'portrait'); doc.setFont('helvetica', 'bold'); doc.setFontSize(continued ? 10 : 17);
    doc.text(`${heading}${continued ? ' (continued)' : ''}`, 40, continued ? 45 : 48);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    if (continued && continuationLabel) {
      const context = continuationContext();
      doc.text(context.lines, 40, 62); return context.top;
    }
    return 70;
  }
  page();
  const lines = doc.splitTextToSize(pdfSafe(note), 515) as string[]; doc.text(lines, 40, 76);
  let y = 76 + lines.length * 13 + 14;
  function write(text: readonly string[], authored = false) {
    for (const line of text) {
      if (y + 13 > 770) y = page(true);
      if (authored) exact!.select(line);
      else { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); }
      doc.text(line, 40, y); y += 13;
    }
  }
  for (const row of rows) {
    const entry = row.intent?.originalQuantityEntry;
    const authored = entry ? originalQuantityEntryLine(entry) : null;
    const readback = [row.name, `saved sowing: ${row.sow || 'Not recorded'}`, row.where,
      ...(row.intent ? [row.status] : [])].join(' - ');
    // Keep every raw authored code point through wrapping and PDF encoding;
    // pdfSafe/splitTextToSize intentionally normalize ordinary copy.
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    write(doc.splitTextToSize(pdfSafe(readback), 515));
    for (const line of row.intent?.lines ?? []) {
      if (authored === line && exact) write(exact.lines(line, 515), true);
      else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        write(doc.splitTextToSize(pdfSafe(line), 515));
      }
    }
    if (row.provisionalEvidence) {
      continuationLabel = `${row.name} - ${row.where}; historical source evidence as accepted`;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      write(doc.splitTextToSize(pdfSafe(continuationLabel), 515));
      for (const line of row.provisionalEvidence.lines) {
        const freshTop = continuationContext().top;
        exact!.select(line);
        const wrapped = doc.splitTextToSize(line, 515) as string[];
        // The inspected PDF left a lone "Unknown" after its evidence label on
        // the next page. Keep each source paragraph together when it fits.
        if (wrapped.length * 13 <= 770 - freshTop && y + wrapped.length * 13 > 770) y = page(true);
        write(wrapped, true);
      }
      continuationLabel = null;
    }
    y += 8;
  }
}

/** Product windows and sowing starts accompany the report; bed allocations remain in the working plan. */
export async function drawReportCropSummary(doc: jsPDF, crop: FactCropPlan, _offset = 0, language = 'en', allowCataloguePlanning = false): Promise<void> {
  if (!allowCataloguePlanning) {
    await drawSavedCropRows(doc, reportCropRows(crop), 'Saved sowing records',
      'Local crop guidance, inherited forecasts and derived task calendars are unavailable for the current site context. These are saved entries, not locally reviewed recommendations.');
    return;
  }
  const ownRows = reportCropRows(crop).filter(row => row.intent);
  if (ownRows.length) await drawSavedCropRows(doc, ownRows, 'Saved own-cycle planning intent',
    'Archived grower estimates, not current geometry approval or observed sowing or harvest. Repeated original requests belong to whole demands, not per-cycle totals.');
  if (crop.snapshot?.annualProduction) drawReportProductionYear(doc, crop.snapshot.annualProduction, crop.snapshot.capturedAt, language);
  const margin = 40, width = 515, nameWidth = 167, monthWidth = (width - nameWidth) / 12;
  let y = 0;
  const tr = (en: string, zu: string) => language === 'zu' ? zu : en;
  const text = (value: string, x: number, top: number, max: number, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor('#203d2d');
    const lines = doc.splitTextToSize(pdfSafe(value), max) as string[];
    doc.text(lines, x, top); return lines.length * size * 1.3;
  };
  const s = crop.snapshot, calendar = s ? reportSowingCalendar(s) : null;
  function page(continued = false) {
    doc.addPage('a4', 'portrait'); y = 42;
    y += text(tr('SITE REPORT / PLANTING', 'UMBIKO WENDAWO / UKUTSHALA'), margin, y, width, 9) + 14;
    y += text(tr('Seasonal sowing calendar', 'Ikhalenda lokuhlwanyela'), margin, y, width, 21, true) + 8;
    if (s) y += text(`${tr('Saved plan', 'Uhlelo olugciniwe')}: ${new Date(s.capturedAt).toLocaleDateString('en-ZA')}${continued ? ' - continued' : ''}`, margin, y, width, 9) + 8;
    y += text(tr('S = sow seed (in trays for transplant crops). T = check seedlings; transplant when ready. Check water and field conditions before planting.', 'S = hlwanyela imbewu. T = hlola izithombo; tshala uma sezilungile. Hlola amanzi nezimo zendawo.'), margin, y, width, 9) + 14;
    if (calendar) {
      doc.setFillColor('#edf3ee'); doc.rect(margin, y - 10, width, 30, 'F');
      text(tr('Crop', 'Isitshalo'), margin + 5, y + 3, nameWidth - 10, 10, true);
      calendar.months.forEach((label, i) => {
        const [month, year] = label.split(' '), x = margin + nameWidth + i * monthWidth;
        text(month, x + 2, y, monthWidth - 3, 8, true); text(year, x + 2, y + 12, monthWidth - 3, 7);
      });
      y += 28;
    }
  }
  page();
  if (!calendar) {
    y += text(tr('This older report has grouped sowing months without dated planting records.', 'Lo mbiko omdala awunawo amarekhodi okutshala anezinsuku.'), margin, y, width) + 12;
    for (const c of crop.crops) {
      if (y > 744) page(true);
      y += text(`${c.name}: ${c.sowMonths.join(', ') || tr('Not recorded', 'Akubhalwanga')}`, margin, y, width) + 8;
    }
    return;
  }
  for (const row of calendar.rows) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const lines = doc.splitTextToSize(pdfSafe(row.name), nameWidth - 10) as string[];
    const height = Math.max(26, lines.length * 12 + 10);
    if (y + height > 748) page(true);
    text(row.name, margin + 5, y + 7, nameWidth - 10, 9);
    row.cells.forEach((cell, i) => {
      const x = margin + nameWidth + i * monthWidth;
      if (cell.sow || cell.transplant) {
        doc.setFillColor(cell.sow ? '#d5e9d9' : '#f4e4c4'); doc.roundedRect(x + 2, y - 5, monthWidth - 4, height - 5, 3, 3, 'F');
        text(cell.sow && cell.transplant ? 'S/T' : cell.sow ? 'S' : 'T', x + 5, y + 8, monthWidth - 8, 9, true);
      }
    });
    y += height; doc.setDrawColor('#d2dfd5'); doc.line(margin, y - 7, margin + width, y - 7);
  }
  if (!calendar.rows.length) y += text(tr('No new sowing or transplant task is scheduled in this period.', 'Akukho ukuhlwanyela noma ukutshala okusha okuhleliwe kulesi sikhathi.'), margin, y + 8, width, 9) + 14;
  if (calendar.unscheduled.length) {
    const note = `${tr('No new start in this period', 'Akukho ukuqala okusha kulesi sikhathi')}: ${calendar.unscheduled.join(', ')}.`;
    doc.setFontSize(9);
    for (const line of doc.splitTextToSize(pdfSafe(note), width) as string[]) {
      if (y + 24 > 748) page(true);
      y += text(line, margin, y + 8, width, 9);
    }
    y += 10;
  }
  const note = tr('Bed allocations, varieties, seed buying and monthly jobs are in the separate crop-plan report. This calendar shows planned starts, not confirmation of planting.', 'Imininingwane yemibhede, izinhlobo zezitshalo nemisebenzi yenyanga isembikweni wohlelo lwezitshalo. Leli khalenda likhombisa okuhleliwe.');
  if (y + 68 > 782) page(true);
  y += 12; y += text(note, margin, y, width, 9) + 8;
  if (s) {
    doc.setFontSize(9); doc.setTextColor('#24583c');
    doc.textWithLink(pdfSafe(tr('Open current crop planner', 'Vula uhlelo lwezitshalo lwamanje')), margin, y, { url: `https://imbewufield.vercel.app/facilitator/crops?canvasSite=${encodeURIComponent(s.siteId)}` });
  }
}

/** The report freezes the planner's own product windows; exporting never recalculates a season. */
export function drawReportProductionYear(doc: jsPDF, production: ReportProductionYear, capturedAt: string, language = 'en'): void {
  const margin = 40, width = 515, nameWidth = 167, monthWidth = (width - nameWidth) / 12;
  let y = 0, bodyTop = 0;
  const write = (value: string, x: number, top: number, max: number, size = 9, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor('#203d2d');
    const lines = doc.splitTextToSize(pdfSafe(value), max) as string[];
    doc.text(lines, x, top); return lines.length * size * 1.3;
  };
  function page() {
    doc.addPage('a4', 'portrait'); y = 42;
    y += write('SITE REPORT / ANNUAL PRODUCTION', margin, y, width) + 14;
    y += write('Food and products through the year', margin, y, width, 20, true) + 8;
    y += write(`Saved plan: ${new Date(capturedAt).toLocaleDateString('en-ZA')}${language !== 'en' ? ' / Production overview in English' : ''}`, margin, y, width) + 8;
    y += write('P = plan or local season. R = sourced reference. - = timing not established. These windows are not harvest records, measured stock or evidence of enough food. Proposed trees may take years to produce; housing is not an animal count.', margin, y, width) + 15;
    doc.setFillColor('#edf3ee'); doc.rect(margin, y - 10, width, 30, 'F');
    write('Product', margin + 5, y + 3, nameWidth - 10, 10, true);
    production.months.forEach((label, i) => {
      const [month, year] = label.split(' '), x = margin + nameWidth + i * monthWidth;
      write(month, x + 2, y, monthWidth - 3, 8, true); write(year, x + 2, y + 12, monthWidth - 3, 7);
    });
    y += 34; bodyTop = y;
  }
  page();
  if (!production.rows.length) write('No crop or mapped product rows are recorded for this site. An empty plan is not evidence of a food gap.', margin, y, width);
  for (const row of production.rows) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    const nameLines = doc.splitTextToSize(pdfSafe(`${row.name} / ${row.product}`), nameWidth - 10) as string[];
    const headingHeight = Math.max(30, nameLines.length * 13 + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const notes = doc.splitTextToSize(pdfSafe(`${{crop:'Crop','food-forest':'Food forest',animal:'Animal product'}[row.kind]}: ${row.note}`), width - 10) as string[];
    // The real export left "first-year crop promised" on a new page without its preceding "No".
    // Reserve the complete row whenever it fits a fresh page; unusually long notes still use
    // the existing labelled continuation rather than disappearing or overflowing the paper.
    const rowHeight = headingHeight + notes.length * (9 * 1.3 + 1) + 15;
    const openingRoom = rowHeight <= 752 - bodyTop ? rowHeight : headingHeight + 42;
    if (y + openingRoom > 752) page();
    write(`${row.name} / ${row.product}`, margin + 5, y + 7, nameWidth - 10, 10, true);
    production.months.forEach((_month, i) => {
      const x = margin + nameWidth + i * monthWidth, active = row.months.includes(i);
      if (active) { doc.setFillColor(row.reference ? '#f4e4c4' : '#d5e9d9'); doc.roundedRect(x + 2, y - 5, monthWidth - 4, headingHeight - 5, 3, 3, 'F'); }
      write(active ? row.reference ? 'R' : 'P' : '-', x + 9, y + 8, monthWidth - 10, 9, active);
    });
    y += headingHeight;
    for (const note of notes) {
      if (y + 15 > 752) { page(); y += write(`${row.name} / continued`, margin + 5, y, width - 10, 9, true) + 6; }
      y += write(note, margin + 5, y + 4, width - 10) + 1;
    }
    y += 15; doc.setDrawColor('#d2dfd5'); doc.line(margin, y - 7, margin + width, y - 7);
  }
}
