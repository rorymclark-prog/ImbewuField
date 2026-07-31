/**
 * Client-side copy of the render worker's public job contract. The worker owns
 * security; tests compare this with functions/src/render-job-contract.ts so the
 * two deployment bundles cannot silently drift.
 */
export const RENDER_SHEET_KEYS = [
  'all',
  'water',
  'zones',
  // Earthworks (05) split out of Water and got full AI support (Hybrid + Full Treatment), so its
  // per-sheet queue jobs (key 'earthworks', via sheetRenderRoute's 'one-via-queue' path) need to
  // pass this contract's key allow-list — otherwise renderSheetContractError rejects every
  // Earthworks AI render with "Unknown render sheet" before it ever reaches the worker. This is a
  // plain string array, not typed against GlossyLayerFilter, so tsc could not have caught the gap.
  //
  // functions/src/render-job-contract.ts is a second, independent copy of this same list (Cloud
  // Functions has its own deployment bundle and cannot import this file — see that file's header
  // comment). It carries the identical 'earthworks' entry; tests/render-jobs.test.ts's
  // cross-bundle drift check enforces that the two stay in step, and caught it when only this
  // side had been updated. The Functions change is in the source tree but is NOT live until the
  // functions bundle is deployed.
  'earthworks',
  'planting',
  'structures',
  'sector',
  'base',
  'implementation',
] as const;

export type RenderSheetKey = typeof RENDER_SHEET_KEYS[number];

export const MAX_RENDER_SHEETS_PER_JOB = 5;

export interface RenderSheetIdentity {
  key: string;
  prompt?: unknown;
}

export function renderSheetContractError(
  sheets: readonly RenderSheetIdentity[],
): string | null {
  if (sheets.length === 0) return 'Nothing to render.';
  if (sheets.length > MAX_RENDER_SHEETS_PER_JOB) {
    return `Too many sheets in one job (max ${MAX_RENDER_SHEETS_PER_JOB}).`;
  }
  const known = new Set<string>(RENDER_SHEET_KEYS);
  const seen = new Set<string>();
  for (const sheet of sheets) {
    if (!known.has(sheet.key)) return `Unknown render sheet “${sheet.key}”.`;
    if (seen.has(sheet.key)) return `Sheet “${sheet.key}” appears more than once in this render job.`;
    seen.add(sheet.key);
    if (typeof sheet.prompt !== 'string' || !sheet.prompt.trim()) {
      return `Sheet “${sheet.key}” has no render instructions.`;
    }
  }
  return null;
}
