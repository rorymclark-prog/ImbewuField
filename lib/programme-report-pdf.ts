import type { ProgrammeBranding, VenuePhoto } from './programme-evidence';
import { pdfSafe } from '@/lib/crop-export-pdf';

export type ReportSection = { title: string; lines: string[] };

export async function buildProgrammePdf(title: string, sample: boolean, sections: ReportSection[], format: 'summary' | 'full', branding?: ProgrammeBranding, photos: VenuePhoto[] = [], photoHeading = 'Training venue evidence', visual?: { visuals: import('./report-visuals').ReportVisuals; assets: import('./report-visual-pdf').VisualPdfAssets; date: string }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ compress: true });
  if (visual) {
    const { drawVisualReportFront } = await import('./report-visual-pdf');
    drawVisualReportFront(doc, visual.visuals, visual.assets, visual.date);
    doc.addPage();
  }
  let y = 25;
  const partners = branding ? (['organisation','garden','funder'] as const).filter(k => branding[k].label || branding[k].image) : [];
  if (partners.length && branding) {
    partners.forEach((key, index) => {
      const x = 18 + index * 60, partner = branding[key];
      if (partner.image) { const image = doc.getImageProperties(partner.image); const ratio = Math.min(22 / image.width, 18 / image.height); doc.addImage(partner.image, image.fileType, x, 14, image.width * ratio, image.height * ratio); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(70);
      doc.text(pdfSafe(key === 'organisation' ? 'IMPLEMENTED BY' : key === 'garden' ? 'COMMUNITY / PROJECT' : 'SUPPORTED BY'), x, 38);
      doc.setFontSize(9); doc.text(doc.splitTextToSize(pdfSafe(partner.label), 55).slice(0, 2), x, 43);
    });
    y = 62;
  }
  doc.setDrawColor(73, 107, 76); doc.setLineWidth(0.6); doc.line(18, y - 6, 192, y - 6);
  doc.setTextColor(25);
  const newPage = () => { doc.addPage(); y = 23; };
  const line = (text: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 15 : 11);
    doc.setTextColor(bold ? 30 : 35, bold ? 67 : 35, bold ? 43 : 35);
    // Measure the same supported characters that will be printed.
    const rows = doc.splitTextToSize(pdfSafe(text), 174) as string[];
    for (const row of rows) {
      if (y > 272) newPage();
      doc.text(row, 18, y);
      y += bold ? 8 : 6;
    }
    y += 3;
  };
  line(title, true);
  line(`${sample ? 'SAMPLE - fictional demonstration data' : 'Recorded programme information'} | Generated ${new Date().toISOString().slice(0, 10)}`);
  line(format === 'summary' ? 'Brief summary: up to five items per section. Use the full report for all items.' : 'Full report');
  for (const section of sections) {
    // Keep a heading with at least the start of its content.
    if (y > 250) newPage();
    line(section.title, true);
    const lines = format === 'summary' ? section.lines.slice(0, 5) : section.lines;
    (lines.length ? lines : ['Nothing recorded yet.']).forEach(text => line(text));
  }
  if (photos.length && !visual) {
    newPage(); line(photoHeading, true);
    for (const photo of photos) {
      const image = doc.getImageProperties(photo.image);
      const ratio = Math.min(150 / image.width, 78 / image.height);
      const height = image.height * ratio;
      if (y + height + 28 > 270) newPage();
      doc.addImage(photo.image, image.fileType, 18, y, image.width * ratio, height);
      y += height + 7;
      line(photo.caption);
    }
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`${sample ? 'SAMPLE - NOT ACTUAL RESULTS | ' : ''}ImbewuField | ${page} / ${pages}`, 18, 287);
  }
  return doc;
}
