import { sitePdfText, isNativePdfLanguage } from './site-pdf-copy';
import { reportPdfText } from './report-pdf-font';
import { recordsDate } from './records-months';
import { reportUiMonth } from './report-localisation';
import type { jsPDF } from 'jspdf';
import { pdfSafe } from './crop-export-pdf';
import { reportSowingCalendar } from './report-crop-plan';
import type { FactCropPlan } from './report-site-facts';

/** A single crop-by-month overview; bed allocations remain in the working report. */
export function drawReportCropSummary(doc: jsPDF, crop: FactCropPlan, _offset = 0, language = 'en', font='helvetica', bottom?: number): void {
  const margin = 40, width = 515, nameWidth = 167, monthWidth = (width - nameWidth) / 12;
  let y = 0;
  const native=isNativePdfLanguage(language),safe=native?reportPdfText:pdfSafe;
  const limit=bottom??782;
  const tr = (en: string, zu?: string) => sitePdfText(en,language,{},zu);
  const text = (value: string, x: number, top: number, max: number, size = 10, bold = false) => {
    doc.setFont(font, bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor('#203d2d');
    const lines = doc.splitTextToSize(safe(value), max) as string[];
    doc.text(lines, x, top); return lines.length * size * 1.3;
  };
  const s = crop.snapshot, calendar = s ? reportSowingCalendar(s,language) : null;
  function page(continued = false) {
    doc.addPage('a4', 'portrait'); y = 42;
    y += text(tr('SITE REPORT / PLANTING', 'UMBIKO WENDAWO / UKUTSHALA'), margin, y, width, 9) + 14;
    y += text(tr('Seasonal sowing calendar', 'Ikhalenda lokuhlwanyela'), margin, y, width, 21, true) + 8;
    if (s) y += text(`${tr('Saved plan', 'Uhlelo olugciniwe')}: ${native?recordsDate(language,new Date(s.capturedAt),true):new Date(s.capturedAt).toLocaleDateString('en-ZA')}${continued ? tr(' - continued') : ''}`, margin, y, width, 9) + 8;
    y += text(tr("S = sow seed (in trays for transplant crops). T = check seedlings; transplant when ready. Check water and field conditions before planting."), margin, y, width, 9) + 14;
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
    y += text(tr("This older report has grouped sowing months without dated planting records."), margin, y, width) + 12;
    for (const c of crop.crops) {
      if (y > Math.min(744,limit-38)) page(true);
      y += text(`${c.name}: ${c.sowMonths.map(month=>native?reportUiMonth(language,month):month).join(', ') || tr('Not recorded', 'Akubhalwanga')}`, margin, y, width) + 8;
    }
    return;
  }
  for (const row of calendar.rows) {
    doc.setFont(font, 'normal'); doc.setFontSize(9);
    const lines = doc.splitTextToSize(safe(row.name), nameWidth - 10) as string[];
    const height = Math.max(26, lines.length * 12 + 10);
    if (y + height > Math.min(748,limit-16)) page(true);
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
    for (const line of doc.splitTextToSize(safe(note), width) as string[]) {
      if (y + 24 > Math.min(748,limit-16)) page(true);
      y += text(line, margin, y + 8, width, 9);
    }
    y += 10;
  }
  const note = tr("Bed allocations, varieties, seed buying and monthly jobs are in the separate crop-plan report. This calendar shows planned starts, not confirmation of planting.");
  doc.setFont(font,'normal');doc.setFontSize(9);
  const noteRoom=native?(doc.splitTextToSize(safe(note),width) as string[]).length*9*1.3+42:68;
  if (y + noteRoom > limit) page(true);
  y += 12; y += text(note, margin, y, width, 9) + 8;
  if (s) {
    doc.setFontSize(9); doc.setTextColor('#24583c');
    doc.textWithLink(safe(tr('Open current crop planner', 'Vula uhlelo lwezitshalo lwamanje')), margin, y, { url: `https://imbewufield.vercel.app/facilitator/crops?canvasSite=${encodeURIComponent(s.siteId)}` });
  }
}
