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
import { ensureDocumentArchitecture, stripLeadingNumber } from '@/lib/report-structure';
import { drainCanvasToDataUrl } from '@/lib/release-canvas';
import { ASSURANCE_ONE_LINE } from '@/lib/plan-assurance';
import { pdfSafe } from '@/lib/crop-export-pdf';

export type ReportBlock =
  | { kind: 'title'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'numbered'; marker: string; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'paragraph'; text: string };

/**
 * Does this document already open with its own cover?
 *
 * Tested on the FIRST heading rather than on a title string, because the cover's title carries the
 * farm's name and the report can be generated in eleven languages — matching the words would go
 * stale the first time either changed. A document whose first content is an `# ` heading has a
 * title of its own, and drawing a second one above it is what produced two covers in one PDF.
 */
export function hasOwnCover(markdown: string): boolean {
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    return /^#\s+\S/.test(trimmed);
  }
  return false;
}

/**
 * Strip the inline markdown the report generator emits (bold/italic/code).
 *
 * The doc comment claimed italic all along; the code only handled bold and code. So the two places
 * that use `_emphasis_` printed their underscores literally:
 *
 *     _no researched rate — get a local quote_
 *
 * on every unpriced BOQ line, and again around the cost disclaimer. Those are precisely the two
 * sentences that stop a reader treating the priced subtotal as the full build cost, and they were
 * the ones wearing punctuation that made them look like a formatting fault.
 *
 * The italic rule will not match when a word character sits against an underscore, so snake_case
 * identifiers and file names inside the text survive intact.
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g, '$1')
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
  minWidth = 80,
): number[] {
  const cols = Math.max(1, headers.length);
  if (!Number.isFinite(totalWidth) || totalWidth <= 0) return new Array(cols).fill(0);
  if (cols * minWidth >= totalWidth) return new Array(cols).fill(totalWidth / cols);

  const weights = headers.map((h, c) => {
    let longest = h.length;
    for (const row of rows) longest = Math.max(longest, (row[c] ?? '').length);
    // One long plant list must not squeeze every short label into a column
    // only a few letters wide. Dampen length differences before allocating.
    return Math.sqrt(Math.max(1, longest));
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

/** One saved design sheet, named but NOT loaded. See ReportPdfMeta.loadSheetImage. */
export interface ReportPdfSheet {
  id: string;
  label: string;
}

export interface ReportPdfMeta {
  visuals?: import('./report-visuals').ReportVisuals;
  visualAssets?: import('./report-visual-pdf').VisualPdfAssets;
  biome: string;
  lat: number;
  lon: number;
  rainfallMm: number;
  soilPh?: number;
  language?: string;
  meanTempC: number;
  /** Already-localised date string for the cover line. */
  dateLabel: string;
  /**
   * The farmer's design sheets to append as plates — IDENTIFIED, not supplied.
   *
   * Rory: "Our report still doesn't have the images the design maps we create" — and it never
   * could, because this module had no image capability at all. It does now, and the sheets arrive
   * as ids because a saved sheet is a 1–3 MB data URL and a farmer can have dozens: handing this
   * function an array of them would put every sheet in memory at once, which is precisely the
   * shape that has been killing the page on iOS all week (lib/sheet-store.ts's memory contract).
   */
  sheets?: ReportPdfSheet[];
  /** Fetches ONE sheet's full image, called immediately before it is drawn and never held after. */
  loadSheetImage?: (id: string) => Promise<string | null>;
  /**
   * The farmer's photographs of the ground, SUPPLIED rather than identified.
   *
   * The opposite of `sheets` above, and for the opposite reason: these are the ≤400px thumbnails
   * lib/site-evidence.ts keeps in localStorage, a few tens of KB each, so the indirection that
   * keeps a 1–3 MB plan sheet out of memory would be ceremony with no purpose here.
   */
  photos?: ReportPdfPhoto[];
}

/** One ground photograph, ready to draw. */
export interface ReportPdfPhoto {
  label: string;
  note?: string;
  /** A `data:image/jpeg;base64,…` URL — jsPDF draws these directly. */
  dataUrl: string;
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

/** Longest edge a sheet is drawn at inside the PDF.
 *
 *  A saved sheet master is up to 2730 px wide. Embedding that costs ~10 MB decoded per plate and
 *  buys nothing: an A4 page at 150 dpi is about 1240 px across the text column, so anything beyond
 *  ~1600 px is invisible on paper and pure weight in a file a farmer sends over WhatsApp. */
const SHEET_PLATE_MAX_PX = 1600;

/** Downscale one sheet for print and release the scratch canvas immediately.
 *
 *  Returns null rather than throwing: a plate that cannot be drawn must never cost the farmer the
 *  whole report, which is the document that actually matters. */
export async function sheetPlate(
  dataUrl: string,
  maxPx: number = SHEET_PLATE_MAX_PX,
  quality = 0.82,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('sheet image unreadable'));
      el.src = dataUrl;
    });
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    if (!w0 || !h0) return null;
    const scale = Math.min(1, maxPx / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // A sheet has a paper ground and JPEG has no alpha; paint white first so any transparent
    // margin prints as paper rather than black.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    // JPEG, not PNG: these are photographic/painted plans, and PNG would multiply the file size a
    // farmer has to send. drainCanvasToDataUrl frees the backing store the moment the bytes are
    // out — the same discipline the sheet pipeline itself now follows.
    return { dataUrl: drainCanvasToDataUrl(canvas, 'image/jpeg', quality), width: w, height: h };
  } catch {
    return null;
  }
}

export async function buildReportPdf(rawMarkdown: string, meta: ReportPdfMeta): Promise<Blob> {
  // A SAVED REPORT IS AN ARTEFACT, AND ARTEFACTS OUTLIVE THE CODE THAT MADE THEM. The API
  // assembles cover, contents and section numbers for every report it generates — but a report
  // saved before that existed keeps its original flat markdown for good, and exported with no
  // contents page and no numbering (Rory, of an 11 August export: "does it have the new layout
  // yet?"). Applying the architecture here means the FILE is right whatever the age of the text
  // inside it. Idempotent: a document that already has a Contents page is passed through
  // untouched — see ensureDocumentArchitecture.
  // Core PDF fonts cannot encode emoji or arbitrary Unicode. Sanitize BEFORE
  // measuring, or widths are measured for glyphs jsPDF cannot actually draw.
  const markdown = pdfSafe(ensureDocumentArchitecture(rawMarkdown));
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 46;
  const CW = PW - M * 2;
  const BOTTOM = PH - 54;
  let y = 0;

  const setInk = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);

  // Every page carries the trust line, exactly as lib/crop-export-pdf.ts does. A document that
  // leaves the room without its caveats is worse than one that never had them — this is the
  // artefact most likely to be handed to a funder or an extension officer.
  const footer = (pageNumber = doc.getNumberOfPages()) => {
    // Page breaks must not change the font of the paragraph being carried over.
    // Previously the 6.5pt footer leaked into body text after need() added a page.
    const font = doc.getFont();
    const fontSize = doc.getFontSize();
    const textColor = doc.getTextColor();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setInk(INK.muted);
    doc.text(meta.language === 'zu' ? 'Kwenziwe yi-ImbewuField' : 'Generated by ImbewuField', M, PH - 30);
    doc.text(String(pageNumber), PW - M, PH - 30, { align: 'right' });
    doc.setFontSize(6.5);
    const assurance = doc.splitTextToSize(meta.language === 'zu' ? 'Umhlahlandlela wokuhlela ongakahlolwa uchwepheshe. Qinisekisa umhlabathi nezilinganiso nomeluleki wendawo.' : ASSURANCE_ONE_LINE, CW) as string[];
    doc.text(assurance.slice(0, 2), PW / 2, PH - 20, { align: 'center' });
    doc.setFont(font.fontName, font.fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(textColor);
  };

  const newPage = () => { footer(); doc.addPage(); y = M + 8; };
  // Reports whether it broke the page, so the table below can repeat its header on the new one —
  // every other call site just ignores the return value, exactly as before this was added.
  const need = (h: number): boolean => { if (y + h <= BOTTOM) return false; newPage(); return true; };

  // Keep normal paragraphs together; carry an unusually long paragraph across
  // pages line by line without clipping its ending or shrinking its type.
  const textLines = (lines: string[], x: number, step: number) => {
    if (lines.length * step < BOTTOM - M - 8) need(lines.length * step);
    for (const line of lines) { need(step); doc.text(line, x, y); y += step; }
  };

  // ── Cover block ────────────────────────────────────────────────────────────
  //
  // ONLY when the document has not brought its own. Reports now open with a code-authored cover —
  // title, reference, issue date, revision, provenance, status — and that whole block was being
  // passed in as body markdown UNDERNEATH this one. The exported PDF carried two covers with two
  // different titles ("Permaculture Site Analysis Report", then "Permaculture Site Report — <farm>")
  // where the report the farmer read on screen has exactly one.
  //
  // The markdown cover wins when present: it is the document the farmer reviewed, and it is the
  // one carrying the reference a funder quotes. This block stays for reports saved before that
  // cover existed, which would otherwise export with no cover at all — hence a conditional rather
  // than a deletion, even though deleting would leave `meta` unused and look tidier.
  if (meta.visuals && meta.visualAssets) {
    const { drawVisualReportFront } = await import('./report-visual-pdf');
    drawVisualReportFront(doc, meta.visuals, meta.visualAssets, meta.dateLabel);
    const visualPages = doc.getNumberOfPages();
    for (let page = 1; page <= visualPages; page++) { doc.setPage(page); footer(page); }
    doc.addPage();
    y = M + 18;
  } else if (!hasOwnCover(markdown)) {
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
      `Rainfall ${meta.rainfallMm} mm/yr · Soil pH ${meta.soilPh ?? 'not measured'} · Mean temp ${meta.meanTempC}°C`,
      M, y,
    );
    y += 12;
    doc.setDrawColor(198, 186, 160); doc.line(M, y, PW - M, y);
    y += 22;
  } else {
    y = M + 18;
  }

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
        // The PDF may number an older report now. Match its chapter by the same title rule
        // as the document assembler, so illustrations survive added/changed numbering.
        const chapter=Object.entries(meta.visualAssets?.chapters??{}).find(([heading])=>stripLeadingNumber(pdfSafe(stripInlineMarkdown(heading)))===stripLeadingNumber(block.text));
        for (const graphic of chapter?.[1] ?? []) {
          const info=doc.getImageProperties(graphic.image);
          const height=Math.min(345,CW*info.height/info.width);
          doc.setFont('helvetica','normal');doc.setFontSize(9);
          const caption=doc.splitTextToSize(graphic.caption,CW) as string[];
          need(height+caption.length*12+43);
          doc.setFont('helvetica','bold');doc.setFontSize(12);setInk(INK.green);
          doc.text(graphic.title,M,y+9);y+=22;
          const width=height*info.width/info.height;
          doc.addImage(graphic.image,'PNG',M+(CW-width)/2,y,width,height,undefined,'FAST');y+=height+14;
          doc.setFont('helvetica','normal');doc.setFontSize(9);setInk(INK.muted);
          textLines(caption,M,12);y+=14;
        }
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
        textLines(lines, M, 14);
        break;
      }
      case 'bullet': {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setInk(INK.text);
        const lines = doc.splitTextToSize(block.text, CW - 14);
        need(lines.length * 13 + 4);
        setInk(INK.green); doc.text('•', M + 2, y); setInk(INK.text);
        textLines(lines, M + 14, 13); y += 2;
        break;
      }
      case 'numbered': {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setInk(INK.text);
        const lines = doc.splitTextToSize(block.text, CW - 20);
        need(lines.length * 13 + 4);
        doc.setFont('helvetica', 'bold'); setInk(INK.gold);
        doc.text(`${block.marker}.`, M + 2, y);
        doc.setFont('helvetica', 'normal'); setInk(INK.text);
        textLines(lines, M + 20, 13); y += 2;
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
          const fullHeight = tallest * 11 + 8;
          // Keep ordinary rows intact, then split only a row too tall for a page.
          if (y + fullHeight > BOTTOM && y > M + 8) {
            newPage();
            if (!bold) drawRow(block.headers, true);
          }
          let offset = 0;
          while (offset < tallest) {
            if (BOTTOM - y < 19) { newPage(); if (!bold) drawRow(block.headers, true); }
            const take = Math.max(1, Math.min(tallest - offset, Math.floor((BOTTOM - y - 8) / 11)));
            doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(8.5);
            let x = M;
            setInk(bold ? INK.muted : INK.text);
            wrapped.forEach((w, c) => { const chunk = w.slice(offset, offset + take); if (chunk.length) doc.text(chunk, x + 2, y); x += widths[c]; });
            y += take * 11 + 4;
            doc.setDrawColor(210, 215, 211); doc.line(M, y - 6, PW - M, y - 6);
            offset += take;
            if (offset < tallest) { newPage(); if (!bold) drawRow(block.headers, true); }
          }
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
        textLines(lines, M, 13); y += 5;
      }
    }
  }

  // ── The design maps ──────────────────────────────────────────────────────────
  //
  // Appended as plates rather than woven between sections: they are drawn at a different scale to
  // everything else, a reader flips to them, and a section boundary is the wrong place to break a
  // full-page map. One page each, one image in memory at a time.
  const plates = meta.sheets ?? [];
  if (plates.length && meta.loadSheetImage) {
    let plateNumber = 0;
    for (const sheet of plates) {
      let source: string | null = null;
      try {
        source = await meta.loadSheetImage(sheet.id);
      } catch {
        source = null;
      }
      if (!source) continue; // a missing sheet costs its plate, never the report
      const plate = await sheetPlate(source);
      source = null; // the full-resolution original is done with; do not hold it across the draw
      if (!plate) continue;

      // footer() stamps the page being LEFT — the same thing newPage() does for the body above.
      // A raw doc.addPage() here was skipping it, so every page up to the second-last in the whole
      // document (the last body page, and every plate but the final one) left the reader's screen
      // with no page number and no trust line, and only the very last page in the file ever got
      // one — exactly backwards for a document whose own comment above says a page without its
      // caveats is worse than a page that never had them.
      footer();
      doc.addPage();
      y = M + 12;
      plateNumber += 1;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      setInk(INK.green);
      doc.text(`Figure ${plateNumber} — ${stripInlineMarkdown(sheet.label)}`, M, y);
      y += 16;

      // Fit inside the margins without ever enlarging: a plan printed larger than its own
      // resolution is a blurry plan, and these are documents people measure off.
      const captionRoom = 18;
      const availW = CW;
      const availH = BOTTOM - y - captionRoom;
      const fit = Math.min(availW / plate.width, availH / plate.height);
      const drawW = plate.width * fit;
      const drawH = plate.height * fit;
      doc.addImage(plate.dataUrl, 'JPEG', M + (availW - drawW) / 2, y, drawW, drawH, undefined, 'FAST');
      y += drawH + 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setInk(INK.muted);
      doc.text('Geometry and counts come from your saved design.', M, y);
    }
  }

  // ── The farmer's own photographs ─────────────────────────────────────────────
  //
  // After the plans, for the same reason the model is shown them in that order: the drawings say
  // what is where, the photographs say what state it is in. Supplied here as data URLs rather than
  // fetched by id, unlike the sheets above — these are the ≤400px thumbnails site-evidence keeps
  // in localStorage, so the whole set is a few hundred KB and the memory contract that forces the
  // sheets to arrive as ids does not apply. Two of them to a page: a photograph printed a full page
  // wide from a 400px original is a blurry photograph.
  const photos = meta.photos ?? [];
  if (photos.length) {
    const HALF = (CW - 14) / 2;
    for (let i = 0; i < photos.length; i += 2) {
      // Same footer-before-addPage discipline as the plates loop above.
      footer();
      doc.addPage();
      y = M + 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      setInk(INK.green);
      doc.text('Your photographs of this land', M, y);
      y += 16;

      for (const [col, photo] of [photos[i], photos[i + 1]].entries()) {
        if (!photo) continue;
        const x = M + col * (HALF + 14);
        let ty = y;
        try {
          // 4:3 box, cover-cropped by jsPDF's own aspect handling is not available, so the box is
          // sized to the width and a fixed 3:4 height — the photos are phone snaps and this keeps
          // the two columns level regardless of orientation.
          doc.addImage(photo.dataUrl, 'JPEG', x, ty, HALF, HALF * 0.75, undefined, 'FAST');
        } catch {
          continue; // an unreadable photo costs its slot, never the report
        }
        ty += HALF * 0.75 + 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        setInk(INK.green);
        const head = doc.splitTextToSize(`Photo ${i + col + 1} — ${photo.label}`, HALF);
        doc.text(head, x, ty);
        ty += head.length * 10;
        if (photo.note) {
          doc.setFont('helvetica', 'italic');
          setInk(INK.muted);
          const note = doc.splitTextToSize(`“${photo.note}”`, HALF);
          doc.text(note, x, ty);
        }
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
