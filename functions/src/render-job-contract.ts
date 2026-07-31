// Cloud Functions has its own deployment bundle, so it cannot import the web
// app's lib/render-job-contract.ts. A root test compares the two public
// contracts. This worker-side copy remains the security and billing authority.
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

export const MAX_RENDER_SHEETS_PER_JOB = 5;

interface UntrustedSheet {
  key?: unknown;
  prompt?: unknown;
  showcase?: unknown;
  geometryLock?: unknown;
  useProtectMaskForEdit?: unknown;
  resultKind?: unknown;
}

interface UntrustedJob {
  uid?: unknown;
  siteId?: unknown;
  style?: unknown;
  provider?: unknown;
  engine?: unknown;
  sheets?: unknown;
}

export function workerRenderJobContractError(job: UntrustedJob): string | null {
  if (typeof job.uid !== 'string' || !job.uid) return 'invalid owner';
  if (typeof job.siteId !== 'string' || !job.siteId) return 'invalid site';
  if (typeof job.style !== 'string' || !job.style) return 'invalid style';
  if (job.provider !== undefined && job.provider !== 'openai' && job.provider !== 'gemini') return 'invalid provider';
  if (job.engine !== 'openai') return 'invalid engine';
  if (!Array.isArray(job.sheets) || job.sheets.length === 0) return 'no sheets';
  if (job.sheets.length > MAX_RENDER_SHEETS_PER_JOB) return 'too many sheets';

  const known = new Set<string>(RENDER_SHEET_KEYS);
  const resultKinds = new Set(['hybrid', 'ai-polished', 'legacy-ai']);
  const seen = new Set<string>();
  for (const raw of job.sheets as UntrustedSheet[]) {
    if (!raw || typeof raw !== 'object' || typeof raw.key !== 'string' || !known.has(raw.key)) {
      return 'unknown sheet';
    }
    if (seen.has(raw.key)) return 'duplicate sheet';
    seen.add(raw.key);
    if (typeof raw.prompt !== 'string' || !raw.prompt.trim()) return 'empty prompt';
    if (raw.showcase !== undefined && typeof raw.showcase !== 'boolean') return 'invalid showcase flag';
    if (raw.geometryLock !== undefined && typeof raw.geometryLock !== 'boolean') return 'invalid geometry lock flag';
    if (
      raw.useProtectMaskForEdit !== undefined
      && typeof raw.useProtectMaskForEdit !== 'boolean'
    ) return 'invalid mask mode';
    if (raw.showcase === true && raw.geometryLock === true) return 'conflicting render authority';
    if (raw.resultKind !== undefined && !resultKinds.has(raw.resultKind as string)) {
      return 'invalid result kind';
    }
  }
  return null;
}
