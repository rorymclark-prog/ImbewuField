import type { jsPDF } from 'jspdf';

/** Core PDF fonts omit Tshivenda letters. Bundle the fonts so exports also work without a font request. */
export async function registerReportPdfFont(doc: jsPDF): Promise<string> {
  const [regular, bold] = await Promise.all([
    import('./report-fonts/noto-sans-regular.ts'),
    import('./report-fonts/noto-sans-bold.ts'),
  ]);
  doc.addFileToVFS('ImbewuSans-Regular.ttf', regular.default);
  doc.addFileToVFS('ImbewuSans-Bold.ttf', bold.default);
  doc.addFont('ImbewuSans-Regular.ttf', 'ImbewuSans', 'normal');
  doc.addFont('ImbewuSans-Bold.ttf', 'ImbewuSans', 'bold');
  return 'ImbewuSans';
}

/** Remove decorative emoji as before, while preserving letters, punctuation, figures and SI units. */
export function reportPdfText(text: string): string {
  return text.normalize('NFC')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[ \t]{2,}/g, ' ').trim();
}
