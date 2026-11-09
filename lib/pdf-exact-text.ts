import type { jsPDF } from 'jspdf';
import { registerReportPdfFont } from './report-pdf-font';

/** jsPDF's UTF-16 encoder uses the registered font cmap and silently omits
 * missing glyphs. Check that exact authority before handing user labels to it. */
export async function exactPdfTextWriter(doc: jsPDF, unsupported: () => Error) {
  const family = await registerReportPdfFont(doc);
  doc.setFont(family, 'normal');
  const metadata = doc.getFont().metadata;
  const seenGlyphs = new Map<number, number>();
  function select(text: string) {
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index), glyph: unknown = metadata.cmap?.unicode?.codeMap?.[code];
      if (typeof glyph !== 'number' || glyph <= 0 || metadata.characterToGlyph(code) !== glyph
        || (seenGlyphs.has(glyph) && seenGlyphs.get(glyph) !== code)) {
        throw unsupported();
      }
      // The embedded ToUnicode map is keyed by glyph. Two distinct characters
      // sharing one glyph cannot both retain their original text in this PDF.
      seenGlyphs.set(glyph, code);
    }
    doc.setFont(family, 'normal'); doc.setFontSize(10);
  }
  return { select, lines(text: string, width: number) {
    select(text);
    const lines: string[] = []; let line = '';
    // Retain every entered code point, including repeated spaces and combining
    // marks. The ordinary copy formatter intentionally normalizes punctuation.
    for (const character of text) {
      if (line && doc.getTextWidth(line + character) > width) { lines.push(line); line = ''; }
      line += character;
    }
    if (line) lines.push(line);
    return lines;
  } };
}
