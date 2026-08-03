// Cloud Functions has its own deployment bundle, so it cannot import the web
// app's lib/render-job-contract.ts. A root test compares the two public
// contracts. This worker-side copy remains the security and billing authority.
export const RENDER_SHEET_KEYS = [
  'all',
  'water',
  'zones',
  // Earthworks (sheet 05) split out of Water with full AI support. This is the SERVER-side copy of
  // the key allow-list — the actual billing/security authority — and it must stay identical to
  // lib/render-job-contract.ts. tests/render-jobs.test.ts's cross-bundle drift check exists
  // precisely to catch a one-sided edit here, and it did.
  'earthworks',
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

/**
 * Which image APIs a job may be billed against.
 *
 * THIS USED TO BE TWO FIELDS AND THAT WAS A BUG WITH TEETH. The job doc carries `engine`, written
 * by enqueueRenderJob — but the worker branched on a SECOND field, `provider`, which nothing ever
 * wrote. So `job.provider === 'gemini'` was permanently false. Opening the engine gate alone would
 * therefore have enqueued a Gemini job, validated it, and then rendered it on OpenAI and billed
 * OpenAI, with a picture coming back and no way to tell from the outside. A silent wrong-vendor
 * charge is worse than the rejection it replaced, so `provider` is gone: ONE field decides, and it
 * is the same field the client writes.
 */
export const RENDER_ENGINES = ['openai', 'gemini'] as const;
export type RenderEngine = (typeof RENDER_ENGINES)[number];

/** Type predicate, not a bare `includes`: the old `engine !== 'openai'` check NARROWED, and the
 *  worker relies on that to treat the field as a known vendor rather than `unknown`. */
export function isRenderEngine(value: unknown): value is RenderEngine {
  return typeof value === 'string' && (RENDER_ENGINES as readonly string[]).includes(value);
}

interface UntrustedJob {
  uid?: unknown;
  siteId?: unknown;
  style?: unknown;
  engine?: unknown;
  sheets?: unknown;
}

export function workerRenderJobContractError(job: UntrustedJob): string | null {
  if (typeof job.uid !== 'string' || !job.uid) return 'invalid owner';
  if (typeof job.siteId !== 'string' || !job.siteId) return 'invalid site';
  if (typeof job.style !== 'string' || !job.style) return 'invalid style';
  if (!isRenderEngine(job.engine)) return 'invalid engine';
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
