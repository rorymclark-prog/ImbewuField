/**
 * Client-side copy of the render worker's public job contract. The worker owns
 * security; tests compare this with functions/src/render-job-contract.ts so the
 * two deployment bundles cannot silently drift.
 */
export const RENDER_SHEET_KEYS = [
  'all',
  'water',
  'zones',
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
