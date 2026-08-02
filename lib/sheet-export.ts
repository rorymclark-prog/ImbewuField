/**
 * Exporting saved plan sheets: how many, at what quality, in what format.
 *
 * Rory asked for this in one breath — "lets be able to select and download multiple files at once
 * with a quality selector and also perhaps just have a share option? file options jpeg or pdf etc"
 * — and the four asks are really one job: a farmer has nine sheets in the gallery and needs to get
 * some subset of them off the phone and to somebody else.
 *
 * The pure decisions live here so they can be tested without a canvas: what a file is called, how
 * much a quality step actually costs, and which formats can carry a set rather than one image.
 * The pixel work and the share sheet stay in the component, where the browser APIs are.
 */

export type SheetExportFormat = 'jpeg' | 'png' | 'pdf';
export type SheetExportQuality = 'high' | 'medium' | 'low';

export interface SheetExportProfile {
  /** Multiplier on the sheet's own pixel width. 1 = the full render. */
  scale: number;
  /** JPEG encoder quality. Ignored by PNG, which is lossless. */
  jpegQuality: number;
  label: string;
  hint: string;
}

/**
 * WHY THREE STEPS AND WHY THESE NUMBERS. A plan sheet renders around 2500px wide, which is right
 * for print and heavy for WhatsApp on a rural connection — the single most likely way one of these
 * actually reaches another person. 'high' is the full sheet, unscaled, for printing and for the
 * funder. 'medium' halves the linear size (a quarter of the pixels) and is the one to send. 'low'
 * exists for a farmer on a metered connection who needs the other person to see the layout at all.
 *
 * Scale is applied to BOTH axes, so the aspect — and therefore the A-series proportion the sheets
 * are composed at — is preserved at every step.
 */
export const SHEET_EXPORT_PROFILES: Readonly<Record<SheetExportQuality, SheetExportProfile>> = {
  high: { scale: 1, jpegQuality: 0.92, label: 'High', hint: 'full size — for printing' },
  medium: { scale: 0.5, jpegQuality: 0.82, label: 'Medium', hint: 'good on a phone' },
  low: { scale: 0.3, jpegQuality: 0.7, label: 'Low', hint: 'smallest — for slow data' },
};

/** PDF carries a whole set in one file; the image formats produce one file per sheet. This is the
 *  difference that decides whether "download 6" means one download or six. */
export function isMultiSheetFormat(format: SheetExportFormat): boolean {
  return format === 'pdf';
}

/**
 * Filename-safe slug.
 *
 * The combining-mark strip is load-bearing, not decoration: NFKD decomposes "è" into "e" plus a
 * combining accent, and without removing the accent it becomes a separator — so "Ubhejane Crèche"
 * came out "ubhejane-cre-che". Half the sites this app is used on have an accent or a click letter
 * in the name, so the accent has to be folded away, not split on. Caught by this module's own test.
 */
function exportSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** A filename someone can find again on a phone, and that sorts sensibly beside its siblings. */
export function sheetExportFileName(
  placeName: string | undefined,
  sheetLabel: string,
  format: SheetExportFormat,
  index?: number,
): string {
  const slug = exportSlug;
  const site = slug(placeName ?? 'site') || 'site';
  const sheet = slug(sheetLabel) || 'sheet';
  // A numeric prefix only when exporting a SET, so a lone download is not called "01-" for no
  // reason, and a set lands in the file browser in the order it was rendered rather than
  // alphabetically by sheet name.
  const prefix = index === undefined ? '' : `${String(index + 1).padStart(2, '0')}-`;
  const extension = format === 'pdf' ? 'pdf' : format === 'png' ? 'png' : 'jpg';
  return `${site}-${prefix}${sheet}.${extension}`;
}

/** The name for a whole set in one file. */
export function sheetSetFileName(placeName: string | undefined, count: number): string {
  const site = exportSlug(placeName ?? 'site') || 'site';
  return `${site}-plan-${count}-sheets.pdf`;
}

/** MIME type for a chosen image format. PDF is assembled separately and never goes through the
 *  canvas encoder, so it is not a valid input here. */
export function imageMimeType(format: Exclude<SheetExportFormat, 'pdf'>): string {
  return format === 'png' ? 'image/png' : 'image/jpeg';
}
