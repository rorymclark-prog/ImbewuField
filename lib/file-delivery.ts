// Getting a generated file — a .pdf plan, a .pdf report, an .ics calendar —
// off the screen and onto the farmer's device.
//
// THE ONE COPY. There were two (lib/crop-export-deliver.ts and deliverPdf in
// lib/report-pdf.ts), both carrying the same bug, and the older one's own
// comment said "worth merging into one helper once the report work lands".
// The report work landed; three separate copies of a planting-density formula
// silently drifting apart on the same day (see crop-catalog.ts plantsPerM2)
// settled the argument.
//
// ── The bug this file exists to fix ────────────────────────────────────────
//
// Both copies tried navigator.share FIRST whenever canShare({files}) said yes.
// That reads as "prefer the native route", and on a phone it is right: an
// installed iOS PWA has no browser chrome, and the share sheet is the only
// path that ends with the file saved to Files or sent into WhatsApp, which is
// how a plan actually reaches a facilitator.
//
// But desktop Chrome ALSO answers yes to canShare({files}), and the macOS
// share sheet has no "Save to Files" and no Print — it offers AirDrop, Mail,
// Messages, Notes, Shortcuts, Freeform, Copy. So the owner, on a Mac, pressed
// "Print / export PDF", got a sheet with nowhere to put the file, and the
// download fallback below never ran because the share had already "succeeded":
// "there is no print options how do we save a pdf to downloads or email etc".
// There was no route. The answer was to email it to himself.
//
// ── The rule ───────────────────────────────────────────────────────────────
//
// Share first only where a share sheet can actually STORE a file — which in
// practice means a touch-primary device. `(pointer: coarse)` is the honest
// test: it asks what the input device is, not what the browser is called, so
// it needs no user-agent sniffing and no allow-list to maintain. A desktop
// with a touchscreen answers coarse only when touch is the primary pointer.
//
// And regardless of the default, BOTH routes stay available to the caller, so
// a farmer is never trapped in the one his device happens to prefer.

export type FileDelivery = 'shared' | 'downloaded' | 'cancelled';
export type FileShare = 'shared' | 'cancelled' | 'unavailable';

type ShareCapableNavigator = Navigator & { canShare?: (data: ShareData) => boolean };

function nav(): ShareCapableNavigator | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator as ShareCapableNavigator);
}

/** Can this device put a file somewhere useful via the OS share sheet? */
export function canShareFiles(blobType = 'application/pdf'): boolean {
  const n = nav();
  if (!n?.share || !n.canShare) return false;
  try {
    return n.canShare({ files: [new File([], 'probe', { type: blobType })] });
  } catch {
    return false;
  }
}

/**
 * Touch-primary — the devices whose share sheet ends in a saved file. Absent
 * matchMedia (SSR, old engines) we answer false, which routes to download:
 * the failure mode of an unnecessary download is a file in Downloads, and the
 * failure mode of an unnecessary share sheet is the dead end above.
 */
export function prefersShareSheet(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

type DownloadContextCurrent = () => boolean | Promise<boolean>;
type DownloadHandoffCurrent = () => boolean;

function prepareDownload(blob: Blob, filename: string): { download: (handoffCurrent?: DownloadHandoffCurrent) => FileDelivery; discard: () => void } {
  const url = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | null = null;
  let released = false;
  function release(delayed: boolean) {
    if (released) return;
    released = true;
    try { anchor?.remove(); }
    finally {
      // Revoking immediately can cancel a handed-off download on WebKit.
      if (delayed) setTimeout(() => URL.revokeObjectURL(url), 10_000);
      else URL.revokeObjectURL(url);
    }
  }
  try {
    anchor = document.createElement('a');
    anchor.hidden = true;
    anchor.tabIndex = -1;
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
  } catch (error) {
    release(false);
    throw error;
  }
  return {
    download(handoffCurrent) {
      let admitted = false;
      try { admitted = handoffCurrent === undefined || handoffCurrent() === true; } catch { /* A withdrawn view cannot hand off its file. */ }
      if (!admitted) { release(false); return 'cancelled'; }
      try { anchor!.click(); }
      catch (error) { release(false); throw error; }
      release(true);
      return 'downloaded';
    },
    discard: () => release(false),
  };
}

async function downloadCurrentFile(blob: Blob, filename: string, contextCurrent: DownloadContextCurrent, handoffCurrent?: DownloadHandoffCurrent): Promise<FileDelivery> {
  const current = async () => { try { return (await contextCurrent()) === true; } catch { return false; } };
  if (!await current()) return 'cancelled';
  const prepared = prepareDownload(blob, filename);
  // Preparation can outlive the original saved-source view. Its caller owns
  // the actual fresh-reader check; a hidden anchor grants no permission itself.
  if (!await current()) { prepared.discard(); return 'cancelled'; }
  // Other promise continuations may retire the view after the fresh read passes.
  // Its synchronous revocation predicate runs in the click path without awaiting.
  return prepared.download(handoffCurrent);
}

/** The unguarded form stays synchronous; a guarded handoff awaits fresh admission. */
export function downloadFile(blob: Blob, filename: string): FileDelivery;
export function downloadFile(blob: Blob, filename: string, contextCurrent: undefined): FileDelivery;
export function downloadFile(blob: Blob, filename: string, contextCurrent: DownloadContextCurrent, handoffCurrent?: DownloadHandoffCurrent): Promise<FileDelivery>;
export function downloadFile(blob: Blob, filename: string, contextCurrent?: DownloadContextCurrent, handoffCurrent?: DownloadHandoffCurrent): FileDelivery | Promise<FileDelivery> {
  return contextCurrent === undefined ? prepareDownload(blob, filename).download() : downloadCurrentFile(blob, filename, contextCurrent, handoffCurrent);
}

/** Explicit sharing honours the choice on desktop too, and reports cancellation separately. */
export async function shareFile(blob: Blob, filename: string, title: string): Promise<FileShare> {
  const n = nav();
  if (!n?.share || !n.canShare) return 'unavailable';
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (!n.canShare({ files: [file] })) return 'unavailable';
    await n.share({ files: [file], title });
    return 'shared';
  } catch (err) {
    // AbortError = the farmer dismissed the sheet. That is a completed action,
    // not a failed export — falling through would then ALSO trigger a download
    // he just declined.
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    return 'unavailable';
  }
}

/**
 * Open the file in a new tab. On desktop this is the real answer to "there is
 * no print options": the browser's own PDF viewer arrives with Print and
 * Download built into it, which is more than any button here can offer.
 * Returns false if a popup blocker ate it, so the caller can fall back.
 */
export function openFileInTab(blob: Blob): boolean {
  const url = URL.createObjectURL(blob);
  // `noopener` in window.open makes a successfully opened tab return null in
  // real browsers. That looked blocked and downloaded a second copy. Detach the
  // blank tab before navigating, so we can distinguish an actual blocked popup.
  const win = window.open('', '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  if (!win) return false;
  try {
    win.opener = null;
    win.location.replace(url);
    return true;
  } catch {
    win.close();
    return false;
  }
}

/** The default route for this device, with the other always still available. */
export async function deliverFile(blob: Blob, filename: string, shareTitle: string, contextCurrent?: () => boolean): Promise<FileDelivery> {
  const current = () => { try { return contextCurrent === undefined || contextCurrent() === true; } catch { return false; } };
  if (!current()) return 'cancelled';
  if (prefersShareSheet()) {
    const result = await shareFile(blob, filename, shareTitle);
    if (result !== 'unavailable') return result;
  }
  // A share sheet may outlive the account/site that produced this private file.
  // Withdrawing that original context also withdraws its delayed download fallback.
  if (!current()) return 'cancelled';
  return contextCurrent ? downloadFile(blob, filename, contextCurrent, contextCurrent) : downloadFile(blob, filename);
}
