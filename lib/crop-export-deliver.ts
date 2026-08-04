// Getting a generated file (a .pdf plan, a .ics calendar) off the screen and
// onto the farmer's device.
//
// Share sheet FIRST where the platform can carry a file. ImbewuField's
// manifest declares `"display": "standalone"`, so an installed app has no
// browser chrome — and on iOS the share sheet is the only route that ends with
// the file actually saved (or sent straight into WhatsApp, which is how a plan
// reaches a facilitator in practice). Everywhere else, and whenever the share
// sheet cannot take files, a plain blob download — which is what a desktop
// browser wants anyway.
//
// This mirrors deliverPdf in lib/report-pdf.ts, which solves the same problem
// for the site-analysis report. It is deliberately NOT imported from there:
// that module is the report screen's, it is mid-change, and a shared checkout
// is a poor place to couple two features together. Worth merging into one
// helper once the report work lands.

export type FileDelivery = 'shared' | 'downloaded';

export async function deliverFile(blob: Blob, filename: string, shareTitle: string): Promise<FileDelivery> {
  const nav = typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { canShare?: (d: ShareData) => boolean });

  if (nav?.share && nav.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: shareTitle });
        return 'shared';
      }
    } catch (err) {
      // AbortError = the farmer dismissed the sheet. That is a completed
      // action, not a failed export — falling through would then ALSO trigger
      // a download they just declined.
      if (err instanceof Error && err.name === 'AbortError') return 'shared';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download on some WebKit builds.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
