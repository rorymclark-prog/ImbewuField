// ── Site Analysis Report → PDF ───────────────────────────────────────────────
//
// Why this file exists at all: "Export PDF" used to be `window.print()`.
// ImbewuField's manifest declares `"display": "standalone"`, so once a farmer
// installs the app to their home screen the report opens in a standalone
// window — and iOS Safari has no print affordance there. `window.print()`
// resolves without throwing and without showing anything, so the button looked
// dead on exactly the device most of our farmers use. Nothing was catchable in
// a try/catch, which is why it never surfaced an error either.
//
// The fix is to stop asking the browser for a print dialog and to build the
// document ourselves with jsPDF (already a dependency — app/invoice/page.tsx
// ships a PDF the same way), then hand it to the device: the share sheet where
// files can be shared (iOS/Android → "Save to Files", WhatsApp, mail), a plain
// blob download everywhere else (desktop).
//
// The markdown → block parsing is deliberately pure and exported so it can be
// tested without a DOM, a browser, or jsPDF.

import { deliverFile, type FileDelivery } from '@/lib/file-delivery';

export type ReportBlock =
  | { kind: 'title'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'numbered'; marker: string; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'paragraph'; text: string };

/** Strip the inline markdown the report generator emits (bold/italic/code). */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*/g, '')
    .trim();
}

function splitRow(line: string): string[] {
  // "| a | b |" → ['a','b'].  Leading/trailing pipes produce empty edge cells.
  const cells = line.split('|');
  if (cells.length && cells[0].trim() === '') cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map((c) => stripInlineMarkdown(c));
}

const SEPARATOR_ROW = /^[\s|:-]+$/;

/**
 * Parse the generated report markdown into a flat list of layout blocks.
 * Mirrors what renderReport() draws on screen so the PDF and the screen agree.
 */
export function parseReportMarkdown(markdown: string): ReportBlock[] {
  const lines = (markdown ?? '').split('\n');
  const blocks: ReportBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: stripInlineMarkdown(line.slice(3)) });
    } else if (line.startsWith('### ')) {
      blocks.push({ kind: 'h3', text: stripInlineMarkdown(line.slice(4)) });
    } else if (line.startsWith('# ')) {
      blocks.push({ kind: 'title', text: stripInlineMarkdown(line.slice(2)) });
    } else if (line.trimStart().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        if (!SEPARATOR_ROW.test(lines[i])) rows.push(splitRow(lines[i]));
        i++;
      }
      if (rows.length) {
        const [headers, ...body] = rows;
        blocks.push({ kind: 'table', headers, rows: body });
      }
      continue; // i already advanced past the table
    } else if (/^\*\*.+\*\*$/.test(line.trim())) {
      blocks.push({ kind: 'bold', text: stripInlineMarkdown(line) });
    } else if (/^\d+\.\s/.test(line.trim())) {
      const trimmed = line.trim();
      const marker = trimmed.match(/^\d+/)![0];
      blocks.push({ kind: 'numbered', marker, text: stripInlineMarkdown(trimmed.replace(/^\d+\.\s*/, '')) });
    } else if (/^[-•*]\s/.test(line.trim())) {
      blocks.push({ kind: 'bullet', text: stripInlineMarkdown(line.trim().replace(/^[-•*]\s*/, '')) });
    } else {
      blocks.push({ kind: 'paragraph', text: stripInlineMarkdown(line) });
    }
    i++;
  }

  return blocks;
}

/**
 * Column widths for a table, proportional to the longest cell in each column
 * but never narrower than `minWidth`. Pure so the pagination maths is testable.
 */
export function layoutTableColumns(
  headers: string[],
  rows: string[][],
  totalWidth: number,
  minWidth = 46,
): number[] {
  const cols = Math.max(1, headers.length);
  if (!Number.isFinite(totalWidth) || totalWidth <= 0) return new Array(cols).fill(0);
  if (cols * minWidth >= totalWidth) return new Array(cols).fill(totalWidth / cols);

  const weights = headers.map((h, c) => {
    let longest = h.length;
    for (const row of rows) longest = Math.max(longest, (row[c] ?? '').length);
    return Math.max(1, longest);
  });
  const sum = weights.reduce((a, b) => a + b, 0);

  // First pass: proportional. Then lift anything under minWidth and take the
  // difference back off the columns that still have slack.
  const widths = weights.map((w) => (w / sum) * totalWidth);
  let debt = 0;
  for (let c = 0; c < cols; c++) {
    if (widths[c] < minWidth) { debt += minWidth - widths[c]; widths[c] = minWidth; }
  }
  if (debt > 0) {
    const slack = widths.reduce((a, w) => a + Math.max(0, w - minWidth), 0);
    if (slack > 0) {
      for (let c = 0; c < cols; c++) {
        const spare = Math.max(0, widths[c] - minWidth);
        widths[c] -= debt * (spare / slack);
      }
    }
  }
  return widths;
}

export interface ReportPdfMeta {
  biome: string;
  lat: number;
  lon: number;
  rainfallMm: number;
  soilPh: number;
  meanTempC: number;
  /** Already-localised date string for the cover line. */
  dateLabel: string;
}

/** File-system-safe name for the exported document. */
export function reportPdfFilename(biome: string, date = new Date()): string {
  const safe = (biome || 'Site')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'Site';
  const stamp = Number.isNaN(date.getTime()) ? 'undated' : date.toISOString().slice(0, 10);
  return `ImbewuField-Site-Report-${safe}-${stamp}.pdf`;
}

const INK = { text: [32, 25, 15], muted: [110, 96, 74], green: [31, 77, 43], gold: [154, 96, 30] } as const;

/** Build the report as a PDF blob. Throws if jsPDF cannot be loaded. */
export async function buildReportPdf(markdown: string, meta: ReportPdfMeta): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 46;
  const CW = PW - M * 2;
  const BOTTOM = PH - 54;
  let y = 0;

  const setInk = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);

  const footer = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setInk(INK.muted);
    doc.text('Generated by ImbewuField', M, PH - 30);
    doc.text(String(doc.getNumberOfPages()), PW - M, PH - 30, { align: 'right' });
  };

  const newPage = () => { footer(); doc.addPage(); y = M + 8; };
  const need = (h: number) => { if (y + h > BOTTOM) newPage(); };

  // ── Cover block ────────────────────────────────────────────────────────────
  y = M + 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); setInk(INK.text);
  doc.text('ImbewuField', M, y);
  y += 20;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); setInk(INK.green);
  doc.text('Permaculture Site Analysis Report', M, y);
  y += 18;
  doc.setFontSize(9); setInk(INK.muted);
  doc.text(
    `${meta.biome} · ${Math.abs(meta.lat).toFixed(4)}°S ${meta.lon.toFixed(4)}°E · ${meta.dateLabel}`,
    M, y,
  );
  y += 13;
  doc.text(
    `Rainfall ${meta.rainfallMm} mm/yr · Soil pH ${meta.soilPh} · Mean temp ${meta.meanTempC}°C`,
    M, y,
  );
  y += 12;
  doc.setDrawColor(198, 186, 160); doc.line(M, y, PW - M, y);
  y += 22;

  // ── Body ───────────────────────────────────────────────────────────────────
  for (const block of parseReportMarkdown(markdown)) {
    switch (block.kind) {
      case 'title': {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); setInk(INK.text);
        const lines = doc.splitTextToSize(block.text, CW);
        need(lines.length * 20 + 8);
        doc.text(lines, M, y); y += lines.length * 20 + 8;
        break;
      }
      case 'h2': {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); setInk(INK.green);
        const lines = doc.splitTextToSize(block.text, CW);
        // A heading alone at the foot of a page is worse than a slightly short page.
        need(lines.length * 17 + 34);
        y += 10;
        doc.text(lines, M, y); y += lines.length * 17;
        doc.setDrawColor(226, 216, 196); doc.line(M, y - 4, PW - M, y - 4);
        y += 8;
        break;
      }
      case 'h3': {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); setInk(INK.gold);
        const lines = doc.splitTextToSize(block.text, CW);
        need(lines.length * 15 + 26);
        y += 8;
        doc.text(lines, M, y); y += lines.length * 15 + 3;
        break;
      }
      case 'bold': {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setInk(INK.text);
        const lines = doc.splitTextToSize(block.text, CW);
        need(lines.length * 14 + 6);
        y += 5;
        doc.text(lines, M, y); y += lines.length * 14;
        break;
      }
      case 'bullet': {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setInk(INK.text);
        const lines = doc.splitTextToSize(block.text, CW - 14);
        need(lines.length * 13 + 4);
        setInk(INK.green); doc.text('•', M + 2, y); setInk(INK.text);
        doc.text(lines, M + 14, y); y += lines.length * 13 + 2;
        break;
      }
      case 'numbered': {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setInk(INK.text);
        const lines = doc.splitTextToSize(block.text, CW - 20);
        need(lines.length * 13 + 4);
        doc.setFont('helvetica', 'bold'); setInk(INK.gold);
        doc.text(`${block.marker}.`, M + 2, y);
        doc.setFont('helvetica', 'normal'); setInk(INK.text);
        doc.text(lines, M + 20, y); y += lines.length * 13 + 2;
        break;
      }
      case 'table': {
        const widths = layoutTableColumns(block.headers, block.rows, CW);
        const drawRow = (cells: string[], bold: boolean) => {
          doc.setFont('helvetica', bold ? 'bold' : 'normal');
          doc.setFontSize(8.5);
          const wrapped = block.headers.map((_, c) =>
            doc.splitTextToSize(cells[c] ?? '', Math.max(10, widths[c] - 8)) as string[],
          );
          const tallest = Math.max(1, ...wrapped.map((w) => w.length));
          need(tallest * 11 + 8);
          let x = M;
          setInk(bold ? INK.muted : INK.text);
          wrapped.forEach((w, c) => { doc.text(w, x + 2, y); x += widths[c]; });
          y += tallest * 11 + 4;
          doc.setDrawColor(232, 224, 208); doc.line(M, y - 6, PW - M, y - 6);
        };
        y += 8;
        drawRow(block.headers, true);
        for (const row of block.rows) drawRow(row, false);
        y += 8;
        break;
      }
      default: {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setInk(INK.text);
        const lines = doc.splitTextToSize(block.text, CW);
        need(lines.length * 13 + 6);
        doc.text(lines, M, y); y += lines.length * 13 + 5;
      }
    }
  }

  footer();
  return doc.output('blob');
}

export type PdfDelivery = FileDelivery;

/**
 * Get the finished report PDF onto the farmer's device.
 *
 * The share-then-download logic used to live here in full, with a second copy
 * in lib/crop-export-deliver.ts. Both preferred the share sheet whenever
 * canShare({files}) allowed it — which desktop Chrome does, while the macOS
 * share sheet offers no way to save a file, so the download was unreachable on
 * exactly the machine that wanted it. One helper now: lib/file-delivery.ts,
 * which also documents how that dead end was found.
 */
export async function deliverPdf(blob: Blob, filename: string): Promise<PdfDelivery> {
  return deliverFile(blob, filename, 'ImbewuField Site Analysis Report');
}
