import type { jsPDF } from 'jspdf';
import { pdfSafe } from './crop-export-pdf';
import { reportSowingCalendar } from './report-crop-plan';
import type { FactCropPlan } from './report-site-facts';

/** A single crop-by-month overview; bed allocations remain in the working report. */
export function drawReportCropSummary(doc: jsPDF, crop: FactCropPlan, _offset = 0, language = 'en'): void {
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
