/**
 * The invoice as an A4 PDF — the file that actually gets WhatsApped to the buyer.
 *
 * Renders `InvoiceDocument` and computes nothing; see `lib/invoice-document.ts`.
 *
 * The previous writer laid text out by adding to a running `y` and drawing the footer at a fixed
 * 808pt. A4 is 842pt tall, so an invoice with more than about twenty lines wrote items off the
 * bottom of page one and simply lost them — the total still printed, so the arithmetic looked
 * right while the lines it was made of were gone. Long buyer names and addresses ran off the
 * right edge for the same reason. This version measures, wraps and breaks pages.
 */

import type { InvoiceDocument } from './invoice-document';

const PAGE = { width: 595.28, height: 841.89 };
const M = 48;
const CONTENT_W = PAGE.width - M * 2;
const FOOTER_Y = PAGE.height - 34;
/** Where the last item row may end before a new page is required. */
const BODY_BOTTOM = FOOTER_Y - 28;

const INK: [number, number, number] = [32, 25, 15];
const MUTED: [number, number, number] = [140, 122, 98];
const BODY: [number, number, number] = [92, 80, 64];
const GREEN: [number, number, number] = [31, 77, 43];
const RULE: [number, number, number] = [226, 216, 196];
const HAIRLINE: [number, number, number] = [240, 233, 220];

type Doc = import('jspdf').jsPDF;

export async function buildInvoicePdf(doc: InvoiceDocument, fileName: string): Promise<File> {
  const { jsPDF } = await import('jspdf');
  const pdf: Doc = new jsPDF({ unit: 'pt', format: 'a4' });

  let y = 0;
  let page = 1;

  const setInk = (c: [number, number, number]) => pdf.setTextColor(c[0], c[1], c[2]);
  const setRule = (c: [number, number, number]) => pdf.setDrawColor(c[0], c[1], c[2]);

  const footer = () => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    setInk(MUTED);
    pdf.text(doc.footer, PAGE.width / 2, FOOTER_Y, { align: 'center' });
    pdf.text(`Invoice ${doc.number} · page ${page}`, PAGE.width - M, FOOTER_Y, { align: 'right' });
  };

  /** Start a new page, carrying the column headings so a continued table stays readable. */
  const newPage = () => {
    footer();
    pdf.addPage();
    page += 1;
    y = 64;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    setInk(MUTED);
    pdf.text(`Invoice ${doc.number} continued`, M, y);
    y += 14;
    setRule(RULE);
    pdf.line(M, y, PAGE.width - M, y);
    y += 16;
  };

  const room = (needed: number) => {
    if (y + needed > BODY_BOTTOM) newPage();
  };

  /** Draw wrapped text and return the height consumed. */
  const wrapped = (text: string, x: number, width: number, lineHeight: number, align: 'left' | 'right' = 'left') => {
    const parts: string[] = pdf.splitTextToSize(text, width);
    for (const part of parts) {
      pdf.text(part, align === 'right' ? x + width : x, y, { align });
      y += lineHeight;
    }
    return parts.length * lineHeight;
  };

  /* ── Letterhead ─────────────────────────────────────────── */
  // The enterprise logo, when set, leads on the left and the text block indents past
  // it — the same order as the screen document, so the WhatsApped PDF and the printed
  // page are the same letterhead. A logo that jsPDF cannot decode must not take the
  // whole invoice down with it: the document is what the buyer pays from, so a failed
  // image is dropped and everything else still prints.
  const LOGO = 44;
  let headX = M;
  if (doc.sellerLogo) {
    try {
      pdf.addImage(doc.sellerLogo, M, 54, LOGO, LOGO, undefined, 'FAST');
      headX = M + LOGO + 12;
    } catch {
      headX = M;
    }
  }
  // With a logo the text starts past it and runs to the right margin; without one it
  // starts at the margin and stops short of the app mark that sits in the corner.
  const headW = headX === M ? CONTENT_W - 46 : PAGE.width - M - headX;

  y = 70;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  setInk(INK);
  // Reserve the mark square so a long trading name cannot run underneath it.
  wrapped(doc.sellerName || ' ', headX, headW, 21);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  setInk(BODY);
  for (const line of doc.sellerLines) {
    y += 1;
    wrapped(line, headX, headW, 12);
  }

  // The app's own mark only stands in when there is no enterprise logo.
  if (headX === M) {
    pdf.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
    pdf.roundedRect(PAGE.width - M - 32, 54, 32, 32, 6, 6, 'F');
  }

  /* ── Invoice number, dates, reference ───────────────────── */
  y += 14;
  setRule(RULE);
  pdf.line(M, y, PAGE.width - M, y);
  y += 15;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  setInk(INK);
  pdf.text(`Invoice ${doc.number}`, M, y);
  pdf.setFont('helvetica', 'normal');
  setInk(MUTED);
  const meta = [`Issued ${doc.issuedLabel}`];
  if (doc.dueLabel) meta.push(`Due ${doc.dueLabel}`);
  if (doc.referenceLabel) meta.push(`Your ref ${doc.referenceLabel}`);
  pdf.text(meta.join('   ·   '), PAGE.width - M, y, { align: 'right' });
  y += 9;
  pdf.line(M, y, PAGE.width - M, y);

  /* ── Bill to ────────────────────────────────────────────── */
  y += 24;
  pdf.setFontSize(7.5);
  setInk(MUTED);
  pdf.text('BILL TO', M, y);
  y += 14;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  setInk(INK);
  wrapped(doc.buyerName || '—', M, CONTENT_W * 0.6, 15);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  setInk(BODY);
  for (const line of doc.buyerLines) wrapped(line, M, CONTENT_W * 0.6, 12);

  /* ── Line items ─────────────────────────────────────────── */
  y += 18;
  pdf.setFontSize(7.5);
  setInk(MUTED);
  pdf.text('ITEM', M, y);
  pdf.text('AMOUNT', PAGE.width - M, y, { align: 'right' });
  y += 7;
  setRule(RULE);
  pdf.line(M, y, PAGE.width - M, y);
  y += 16;

  const amountW = 90;
  const descW = CONTENT_W - amountW - 16;

  for (const row of doc.rows) {
    room(34);
    const rowTop = y;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    setInk(INK);
    const descH = wrapped(row.desc, M, descW, 13);
    pdf.setFontSize(8.5);
    setInk(MUTED);
    const detailH = wrapped(row.detail, M, descW, 11);

    // The amount belongs on the row's FIRST line, whatever the description wrapped to.
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    setInk(INK);
    pdf.text(row.amount, PAGE.width - M, rowTop, { align: 'right' });

    y = rowTop + Math.max(descH + detailH, 13) + 5;
    setRule(HAIRLINE);
    pdf.line(M, y - 4, PAGE.width - M, y - 4);
  }

  /* ── Total ──────────────────────────────────────────────── */
  room(46);
  y += 6;
  pdf.setLineWidth(1.5);
  setRule(GREEN);
  pdf.line(M, y, PAGE.width - M, y);
  pdf.setLineWidth(1);
  y += 21;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  setInk(INK);
  pdf.text('Total due', M, y);
  pdf.setFontSize(17);
  setInk(GREEN);
  pdf.text(doc.totalLabel, PAGE.width - M, y, { align: 'right' });
  y += 10;

  if (doc.paidStamp) {
    room(28);
    y += 14;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(46, 107, 58);
    pdf.text(doc.paidStamp.toUpperCase(), M, y);
  }

  /* ── How to pay ─────────────────────────────────────────── */
  if (doc.bankingLines.length > 0) {
    room(30 + doc.bankingLines.length * 12);
    y += 24;
    setRule(RULE);
    pdf.line(M, y, PAGE.width - M, y);
    y += 16;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    setInk(MUTED);
    pdf.text('HOW TO PAY', M, y);
    y += 13;
    pdf.setFontSize(9.5);
    setInk(INK);
    for (const line of doc.bankingLines) wrapped(line, M, CONTENT_W * 0.7, 12);
  }

  if (doc.notes) {
    room(30);
    y += 14;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    setInk(BODY);
    wrapped(doc.notes, M, CONTENT_W, 12);
  }

  footer();
  return new File([pdf.output('blob')], fileName, { type: 'application/pdf' });
}
