import type { jsPDF } from 'jspdf';
import { pdfSafe } from './crop-export-pdf';
import { cropByKey } from './crop-catalog';
import { reportCropRows, reportCropMapLayout, reportCropMonths, reportCropCalendar } from './report-crop-plan';
import type { FactCropPlan } from './report-site-facts';

/** Compact text and vector drawing replace the six-pictures-per-page gallery. */
export function drawReportCropSummary(doc: jsPDF, crop: FactCropPlan, offset = 0): void {
  const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight(), margin = 44, width = w - 88;
  let y = 0;
  const text = (value: string, x: number, top: number, max: number, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor('#203d2d');
    const lines = doc.splitTextToSize(pdfSafe(value), max) as string[];
    doc.text(lines, x, top); return lines.length * size * 1.4;
  };
  const page = (title: string) => { doc.addPage('a4', 'portrait'); y = 45; y += text('SITE REPORT / CROP PLAN', margin, y, width, 9) + 18; y += text(title, margin, y, width, 21, true) + 16; };
  const need = (height: number, title = 'Crop plan - continued') => { if (y + height > h - 62) page(title); };
  page('Saved planting plan');
  y += text(crop.snapshot ? `Plan recorded ${new Date(crop.snapshot.capturedAt).toLocaleDateString('en-ZA')}. Planting dates are saved intentions; check field conditions.` : 'Older saved summary: bed names and sowing months were grouped separately. Exact bed-by-month links and varieties were not recorded.', margin, y, width) + 15;
  const col = [0, .31, .55, .72], widths = [.31, .24, .17, .28];
  function header() { ['Crop / variety', 'Bed / plot', 'Sowing', 'Status'].forEach((s, i) => text(s, margin + width * col[i], y, width * widths[i] - 10, 10, true)); y += 22; }
  header();
  for (const row of reportCropRows(crop)) {
    const values = [row.name + (row.variety !== 'Not recorded' ? ` - ${row.variety}` : ''), row.where, row.sow, row.status];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const rh = Math.max(...values.map((v, i) => doc.splitTextToSize(pdfSafe(v), width * widths[i] - 10).length * 14)) + 14;
    if (y + rh > h - 62) { page('Saved planting plan - continued'); header(); }
    values.forEach((v, i) => text(v, margin + width * col[i], y, width * widths[i] - 10));
    y += rh; doc.setDrawColor('#d2dfd5'); doc.line(margin, y - 7, margin + width, y - 7);
  }
  const s = crop.snapshot;
  if (!s) return;
  const months = reportCropMonths(s), calendar = reportCropCalendar(s);
  page(`Growing spaces - ${months[offset]}`);
  const shapes = reportCropMapLayout(s, offset), scale = width / 800;
  if (shapes.length) {
    for (const shape of shapes) {
      const points = shape.points.map(([x, py]) => [margin + x * scale, y + py * scale]);
      doc.setFillColor(shape.active ? '#d4e7d9' : '#f2f1ec'); doc.setDrawColor('#315740'); doc.setLineWidth(.8);
      doc.lines(points.slice(1).map((p, i) => [p[0] - points[i][0], p[1] - points[i][1]]), points[0][0], points[0][1], [1, 1], 'FD', true);
      doc.setFillColor('#173f2d'); doc.circle(margin + shape.cx * scale, y + shape.cy * scale, 8, 'F');
      doc.setTextColor('#ffffff'); doc.setFontSize(9); doc.text(String(shape.number), margin + shape.cx * scale, y + shape.cy * scale + 3, { align: 'center' });
    }
    y += 410 * scale + 18;
  }
  y += text('Numbers match saved bed outlines. Listed crops include growing, harvest and reserved field space. Planned occupancy, not confirmation of planting or a construction plan.', margin, y, width, 10) + 14;
  calendar.forEach((b, i) => {
    const value = `${i + 1}. ${b.label}: ${b.cells[offset].length ? b.cells[offset].map(c => `${cropByKey(c.cropKey)?.name ?? c.cropKey} (${c.share})`).join('; ') : 'No scheduled crop'}`;
    doc.setFontSize(10); const height = doc.splitTextToSize(pdfSafe(value), width).length * 14 + 8;
    need(height, `Growing spaces - ${months[offset]} (key)`); y += text(value, margin, y, width) + 8;
  });
  // Landscape occupancy and its legend are the existing crop-export renderer's work.
}
