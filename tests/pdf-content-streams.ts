import { inflateSync } from 'node:zlib';

/** jsPDF now compresses image-rich reports for phones. Assertions must inspect
 * the content streams, not mistake compressed bytes for missing visible text.
 * This helper is for the direct-length streams emitted by our own PDF builder. */
export function pdfContentStreams(input: ArrayBuffer): string {
  const source = Buffer.from(input).toString('latin1');
  const streams: string[] = [];
  const headers = /<<([\s\S]*?)>>\s*stream\r?\n/g;
  for (let match; (match = headers.exec(source));) {
    const dictionary = match[1];
    const length = /\/Length\s+(\d+)/.exec(dictionary);
    if (!length) continue;
    const start = match.index + match[0].length;
    const bytes = Buffer.from(source.slice(start, start + Number(length[1])), 'latin1');
    headers.lastIndex = start + Number(length[1]);
    if (dictionary.includes('/Subtype /Image')) continue;
    streams.push((dictionary.includes('/FlateDecode') ? inflateSync(bytes) : bytes).toString('latin1'));
  }
  return streams.join('\n');
}
