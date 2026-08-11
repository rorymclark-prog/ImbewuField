// Client side of the background AI-render pipeline (worker: functions/src/index.ts).
//
// Flow: the browser builds each sheet's composite (existing DesignGlossy code), calls
// enqueueRenderJob() to upload those composites to Storage + write ONE job doc, then
// subscribeRenderJob() streams the worker's progress. As each sheet flips to 'done', the browser
// downloads the raw styled image with fetchRenderOutput() and runs its own fast, deterministic
// composite-back (boundary clip + burned labels). Only the slow OpenAI call lives in the worker.
//
// SECURITY NOTE: the worker treats this doc as untrusted — it derives inputPath itself, allow-lists
// keys, clamps prompts, and enforces a per-user daily quota + kill switch. The caps below are the
// SAME numbers the security rules enforce (keep them in sync). See functions/README.md.

import { getFirebase } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { doc, onSnapshot, serverTimestamp, setDoc, Timestamp, type FirestoreError } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';
import { hasConflictingRenderAuthority } from '@/lib/render-policy';
import { releaseCanvas, releaseImageSource } from '@/lib/release-canvas';
import {
  MAX_RENDER_SHEETS_PER_JOB,
  RENDER_SHEET_KEYS,
  isRenderEngine,
  renderSheetContractError,
} from '@/lib/render-job-contract';

export type RenderSheetStatus = 'queued' | 'running' | 'done' | 'error';
export type RenderJobStatus = 'queued' | 'running' | 'complete' | 'failed' | 'error';
export type RenderResultKind = 'hybrid' | 'ai-polished' | 'legacy-ai';

/** Max sheets per job and max bytes per composite — MUST match firestore.rules / storage.rules. */
export const MAX_SHEETS_PER_JOB = MAX_RENDER_SHEETS_PER_JOB;
export const MAX_COMPOSITE_BYTES = 12 * 1024 * 1024;
/** How long a job doc + its Storage artifacts live (also enforced by GCS lifecycle + Firestore TTL). */
const JOB_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Run memory-heavy sheet work in order. The output order matches the input order, but unlike
 * Promise.all only one worker may actively decode or allocate a full-resolution raster at a time. */
export async function mapSerially<T, R>(
  values: readonly T[],
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < values.length; index += 1) {
    results.push(await worker(values[index], index));
  }
  return results;
}

/** What the caller hands enqueueRenderJob per sheet — the built composite + the full model prompt. */
export interface RenderSheetSpec {
  key: string; // stable per-layer id: 'all' | 'water' | 'zones' | 'earthworks' | 'planting' | 'structures'
  label: string;
  prompt: string; // the complete prompt (built client-side so all prompt logic stays here)
  compositeDataUrl: string; // data:image/png;base64,… — the model input
  protectMaskDataUrl?: string; // optional geometry-lock mask for the strict queue path
  /**
   * Pass the protect mask to the edits endpoint as well as using it for deterministic restoration.
   * AI-polish jobs set this false: GPT keeps the style reference, then the browser restores every
   * protected source pixel after generation. Older callers retain the original masked-edit path.
   */
  useProtectMaskForEdit?: boolean;
  // Showcase ("AI legend") sheet: the model drew its own legend/labels, so the finisher must NOT
  // clip/burn/chrome it. Persisted ON THE JOB DOC (not React state) because renders outlive the
  // component — a remount that re-attaches by job id must finish each sheet the way it was
  // ENQUEUED, not the way the freshly-reset UI happens to look. (Audit finding: reattach used to
  // finish sheets with the default style + strict pipeline.)
  showcase?: boolean;
  /** Persist the lock decision with the job. A render can outlive the component or browser tab. */
  geometryLock?: boolean;
  /** Explicit workflow stage; never infer this from a visual style or authority flags. */
  resultKind?: RenderResultKind;
}

/** A sheet's state as it lives in the job doc (input uploaded; worker fills output/status). */
export interface RenderSheetState {
  key: string;
  label: string;
  prompt: string;
  inputPath: string;
  protectMaskPath?: string;
  useProtectMaskForEdit?: boolean;
  status: RenderSheetStatus;
  outputPath?: string;
  error?: string;
  showcase?: boolean; // see RenderSheetSpec.showcase
  geometryLock?: boolean; // see RenderSheetSpec.geometryLock
  resultKind?: RenderResultKind;
}

/**
 * How hard the paid model is asked to work. This is a MONEY dial, not a taste dial: at the size
 * these sheets are rendered, 'high' costs roughly 4x 'medium' and roughly 35x 'low'.
 *
 * It is worth testing rather than assuming, because of what the AI is actually for here — it
 * paints an underlayer, and every piece of exact geometry, every label and the whole legend are
 * composited back on top afterwards (see lib/image-producer.ts). So the model is buying texture
 * and tone, not accuracy, and a large part of the detail 'high' pays for is covered up again.
 *
 * Absent on older job docs, which the worker must read as 'high' — the setting the app used
 * before this existed.
 */
export type RenderQuality = 'high' | 'medium' | 'low';

export const RENDER_QUALITIES: readonly RenderQuality[] = ['high', 'medium', 'low'] as const;

/**
 * What a paid render's quality adds to that sheet's cache key.
 *
 * The quality dial exists "so the SAME sheet can be rendered all three ways and compared before
 * anyone commits to one" (RENDER_QUALITY_CHOICES in DesignGlossy). It could not do that: all three
 * shared one cache slot, so switching the dial re-served whichever picture was rendered last, and
 * the setting looked like it did nothing. At roughly 4x medium and 35x low, that is a control a
 * farmer pays real money to exercise and could not see the result of.
 *
 * EMPTY ON 'high' — the default, and the only value that existed before the dial did — and empty
 * on a job doc with no quality at all, which older jobs must read as 'high' for the same reason the
 * worker does. Every sheet already in a farmer's gallery therefore stays addressable under the key
 * it was stored with. This is the same discipline underlayCacheSuffix documents, and it is the
 * reason this can ship without a PLAN_VERSION bump: nothing already paid for is orphaned.
 *
 * ONLY PAID KEYS. Quality is an instruction to the model, so it changes nothing about a
 * deterministic exact sheet's pixels; appending it there would split those caches for no reason.
 */
export function qualityCacheSuffix(quality: RenderQuality | undefined): string {
  return !quality || quality === 'high' ? '' : `:q${quality}`;
}

export interface RenderJobDoc {
  uid: string;
  siteId: string;
  style: string;
  engine: string;
  quality?: RenderQuality;
  sheets: RenderSheetState[];
  status: RenderJobStatus;
  error?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  expireAt?: Timestamp;
}

export class RenderJobError extends Error {}

// ── Resume-attempt budget ─────────────────────────────────────────────────────
//
// DesignGlossy persists the active job id so a reload can re-attach to a render that takes
// minutes. But re-attaching to a FINISHED job runs the heaviest client path in the app — download
// the output, the input and the mask, pixel-diff them, reassemble the sheet — and on 10 August
// that path is exactly what iOS was killing for memory. The kill reloads the page, the reload
// finds the same persisted job id, re-runs the same path, and dies the same way, until Safari
// gives up with "A problem repeatedly occurred" — the app bricked on that URL with no way out
// but clearing site data.
//
// So automatic re-attachment is BUDGETED. Every resume attempt is recorded BEFORE it runs (a
// killed page cannot record anything after); completing or abandoning the job clears the count.
// A job that has already burned the budget is not resumed — the pointer is cleared and the
// farmer is told plainly, which turns "my app is broken" into "that render didn't open".
// The limit is 2: one legitimate reconnect after an innocent reload, one retry for luck.

export const RENDER_RESUME_ATTEMPT_LIMIT = 2;

/** The one slice of Storage these helpers touch — injectable so the policy is testable. */
export interface ResumeAttemptStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const resumeAttemptsKey = (siteId: string) => `imbewu_render_job_attempts_${siteId}`;

/** Record one resume attempt and return the new total. Call BEFORE re-attaching. */
export function recordResumeAttempt(store: ResumeAttemptStore, siteId: string): number {
  try {
    const raw = Number(store.getItem(resumeAttemptsKey(siteId)));
    const next = (Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0) + 1;
    store.setItem(resumeAttemptsKey(siteId), String(next));
    return next;
  } catch {
    return 1; // storage unavailable: behave like a first attempt rather than refusing to resume
  }
}

/** Forget the count — the job completed, failed cleanly, or its pointer was cleared. */
export function clearResumeAttempts(store: ResumeAttemptStore, siteId: string): void {
  try {
    store.removeItem(resumeAttemptsKey(siteId));
  } catch {
    /* ignore */
  }
}

/** True once the budget is spent: this attempt (and every later one) must not auto-resume. */
export function resumeAttemptsExhausted(attempts: number): boolean {
  return attempts > RENDER_RESUME_ATTEMPT_LIMIT;
}

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;
const SHEET_STATUSES = new Set<RenderSheetStatus>(['queued', 'running', 'done', 'error']);
const JOB_STATUSES = new Set<RenderJobStatus>(['queued', 'running', 'complete', 'failed', 'error']);
const RESULT_KINDS = new Set<RenderResultKind>(['hybrid', 'ai-polished', 'legacy-ai']);
const SHEET_KEYS = new Set<string>(RENDER_SHEET_KEYS);

function imageDataPayload(dataUrl: string): string | null {
  const match = IMAGE_DATA_URL.exec(dataUrl);
  if (!match || match[1].length % 4 !== 0) return null;
  return match[1];
}

/** Approx decoded byte size of a base64 data URL without allocating the buffer. */
export function dataUrlBytes(dataUrl: string): number {
  const b64 = imageDataPayload(dataUrl);
  if (!b64) return 0;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(b64.length * 0.75) - padding);
}

function validImageDataUrl(value: string): boolean {
  return imageDataPayload(value) !== null;
}

/** Pure fail-fast validation; no upload or billable job exists until this passes. */
export function renderJobRequestError(sheets: readonly RenderSheetSpec[]): string | null {
  const contractError = renderSheetContractError(sheets);
  if (contractError) return contractError;
  for (const sheet of sheets) {
    if (!sheet.label.trim()) return `Sheet “${sheet.key}” has no label.`;
    if (hasConflictingRenderAuthority(sheet)) {
      return `Sheet “${sheet.label}” requested two incompatible render modes.`;
    }
    if (sheet.showcase !== undefined && typeof sheet.showcase !== 'boolean') {
      return `Sheet “${sheet.label}” has an invalid showcase flag.`;
    }
    if (sheet.geometryLock !== undefined && typeof sheet.geometryLock !== 'boolean') {
      return `Sheet “${sheet.label}” has an invalid geometry-lock flag.`;
    }
    if (
      sheet.useProtectMaskForEdit !== undefined
      && typeof sheet.useProtectMaskForEdit !== 'boolean'
    ) {
      return `Sheet “${sheet.label}” has an invalid protection-mask mode.`;
    }
    if (sheet.resultKind !== undefined && !RESULT_KINDS.has(sheet.resultKind)) {
      return `Sheet “${sheet.label}” has an invalid result kind.`;
    }
    if (!validImageDataUrl(sheet.compositeDataUrl)) {
      return `Sheet “${sheet.label}” does not contain a valid image.`;
    }
    if (dataUrlBytes(sheet.compositeDataUrl) >= MAX_COMPOSITE_BYTES) {
      return `Sheet “${sheet.label}” is too large to upload (must be under 12 MB).`;
    }
    if (sheet.protectMaskDataUrl && !validImageDataUrl(sheet.protectMaskDataUrl)) {
      return `Sheet “${sheet.label}” has an invalid protection mask.`;
    }
    if (sheet.protectMaskDataUrl && dataUrlBytes(sheet.protectMaskDataUrl) >= MAX_COMPOSITE_BYTES) {
      return `Sheet “${sheet.label}” protection mask is too large to upload (must be under 12 MB).`;
    }
  }
  return null;
}

/** A usable mask must leave the model something to paint and protect at least part of one pixel.
 * Partial alpha counts on both sides because deterministic restoration blends it proportionally. */
export function maskHasProtectedAndEditablePixels(maskPixels: Uint8ClampedArray): boolean {
  let hasProtected = false;
  let hasEditable = false;
  for (let i = 3; i < maskPixels.length; i += 4) {
    const alpha = maskPixels[i];
    if (alpha > 0) hasProtected = true;
    if (alpha < 255) hasEditable = true;
    if (hasProtected && hasEditable) return true;
  }
  return false;
}

async function maskIsUsable(maskDataUrl: string): Promise<boolean> {
  let canvas: HTMLCanvasElement | null = null;
  let img: HTMLImageElement | null = null;
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('mask load failed'));
      el.src = maskDataUrl;
    });
    canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return maskHasProtectedAndEditablePixels(data);
  } catch {
    return false; // cannot verify both mask roles -> do not send it
  } finally {
    if (img) releaseImageSource(img);
    if (canvas) releaseCanvas(canvas);
  }
}

/** Uploads each composite to Storage and writes the job doc; the Cloud Function takes it from there.
 * Full-resolution sheet uploads run serially; on ANY failure every already-uploaded object is rolled back so no
 * orphans are left, and the caller sees one clean error. Returns the jobId to subscribe to. */
export async function enqueueRenderJob(opts: {
  siteId: string;
  style: string;
  engine: string;
  /** Omitted means 'high' — the setting every render used before this dial existed. */
  quality?: RenderQuality;
  sheets: RenderSheetSpec[];
}): Promise<string> {
  // Sample farm is look-don't-spend: AI renders bill a real OpenAI account and write
  // renders/{uid} storage, so they're off while sampling. The exact (no-AI) sheets all work
  // in the sample — this only blocks the billed path. (Safety layer 2, lib/sample-mode.ts.)
  if (isSampleMode()) {
    throw new RenderJobError('AI sheets are switched off in the sample farm. Exit the sample and open your own farm to render AI sheets.');
  }
  const requestError = renderJobRequestError(opts.sheets);
  if (requestError) throw new RenderJobError(requestError);
  if (!opts.siteId.trim()) throw new RenderJobError('Choose a farm before rendering AI sheets.');
  if (!isRenderEngine(opts.engine)) throw new RenderJobError('Unknown AI render engine.');
  if (!opts.style.trim()) throw new RenderJobError('Choose a render style.');
  const fb = getFirebase();
  const uid = fb?.auth.currentUser?.uid;
  if (!fb || !uid) throw new RenderJobError('You need to be signed in to generate AI sheets.');

  const jobId = `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Track successes so a later failure can roll them back. Serial work is intentional: validating
  // four masks together retained four canvases plus four ImageData arrays (~75 MiB at Standard)
  // before the photographs and composite data URLs were counted.
  const uploaded: string[] = [];
  let sheets: RenderSheetState[];
  try {
    sheets = await mapSerially(opts.sheets, async (s): Promise<RenderSheetState> => {
      const inputPath = `renders/${uid}/${jobId}/input-${s.key}.jpg`;
      await uploadString(ref(fb.storage, inputPath), s.compositeDataUrl, 'data_url');
      uploaded.push(inputPath);
      let protectMaskPath: string | undefined;
      // A mask that protects NOTHING must never be uploaded. At the edits endpoint a fully
      // transparent mask is not a no-op — it states that every pixel is editable, and a real
      // render answered that by discarding the supplied aerial photograph and generating a
      // different farm. (The mirror case, a fully OPAQUE mask, silently reverted the render;
      // see maskEditableFraction in lib/image-producer.) Neither extreme is ever intended.
      if (s.protectMaskDataUrl && await maskIsUsable(s.protectMaskDataUrl)) {
        protectMaskPath = `renders/${uid}/${jobId}/mask-${s.key}.png`;
        await uploadString(ref(fb.storage, protectMaskPath), s.protectMaskDataUrl, 'data_url');
        uploaded.push(protectMaskPath);
      }
      // Persist false as well as true. Reattachment must never infer a finished sheet's authority
      // from whichever style happens to be selected in the freshly-mounted UI.
      return {
        key: s.key,
        label: s.label,
        prompt: s.prompt,
        inputPath,
        ...(protectMaskPath ? { protectMaskPath } : {}),
        ...(typeof s.useProtectMaskForEdit === 'boolean'
          ? { useProtectMaskForEdit: s.useProtectMaskForEdit }
          : {}),
        status: 'queued',
        showcase: s.showcase === true,
        ...(typeof s.geometryLock === 'boolean' ? { geometryLock: s.geometryLock } : {}),
        ...(s.resultKind ? { resultKind: s.resultKind } : {}),
      };
    });
  } catch (err) {
    await Promise.allSettled(uploaded.map((p) => deleteObject(ref(fb.storage, p))));
    throw new RenderJobError(`Could not upload your maps for rendering: ${String(err instanceof Error ? err.message : err)}`);
  }

  try {
    await setDoc(doc(fb.db, 'render_jobs', jobId), {
      uid,
      siteId: opts.siteId,
      style: opts.style,
      engine: opts.engine,
      // Spread rather than assign: an explicit `undefined` is not a legal Firestore value, and a
      // job doc WITHOUT this field must keep meaning 'high' for every render already in flight.
      ...(opts.quality ? { quality: opts.quality } : {}),
      sheets,
      status: 'queued',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + JOB_TTL_MS),
    });
  } catch (err) {
    await Promise.allSettled(uploaded.map((p) => deleteObject(ref(fb.storage, p))));
    throw new RenderJobError(`Could not start the render job: ${String(err instanceof Error ? err.message : err)}`);
  }
  return jobId;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Firestore snapshots are network data, even though the worker normally authored the updates.
 * Accept only the paths and states this exact job can own before the browser downloads any image. */
export function normaliseRenderJobDoc(jobId: string, value: unknown): RenderJobDoc | null {
  if (!nonEmptyString(jobId) || jobId.includes('/')) return null;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const job = value as Record<string, unknown>;
  if (
    !nonEmptyString(job.uid)
    || !jobId.startsWith(`${job.uid}_`)
    || !nonEmptyString(job.siteId)
    || !nonEmptyString(job.style)
    || !isRenderEngine(job.engine)
    || typeof job.status !== 'string'
    || !JOB_STATUSES.has(job.status as RenderJobStatus)
    || !Array.isArray(job.sheets)
    || job.sheets.length === 0
    || job.sheets.length > MAX_SHEETS_PER_JOB
  ) return null;
  if (job.error !== undefined && typeof job.error !== 'string') return null;

  const seen = new Set<string>();
  const sheets: RenderSheetState[] = [];
  for (const value of job.sheets) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const sheet = value as Record<string, unknown>;
    if (
      typeof sheet.key !== 'string'
      || !SHEET_KEYS.has(sheet.key)
      || seen.has(sheet.key)
      || !nonEmptyString(sheet.label)
      || !nonEmptyString(sheet.prompt)
      || typeof sheet.status !== 'string'
      || !SHEET_STATUSES.has(sheet.status as RenderSheetStatus)
    ) return null;
    seen.add(sheet.key);

    const root = `renders/${job.uid}/${jobId}`;
    if (sheet.inputPath !== `${root}/input-${sheet.key}.jpg`) return null;
    if (sheet.protectMaskPath !== undefined && sheet.protectMaskPath !== `${root}/mask-${sheet.key}.png`) {
      return null;
    }
    // Older jobs used JPEG output before the worker switched to PNG. Both remain durable for the
    // job TTL, but neither may escape this job's derived owner/key namespace.
    const validOutputPaths = new Set([
      `${root}/output-${sheet.key}.png`,
      `${root}/output-${sheet.key}.jpg`,
    ]);
    if (sheet.status === 'done') {
      if (typeof sheet.outputPath !== 'string' || !validOutputPaths.has(sheet.outputPath)) return null;
    } else if (sheet.outputPath !== undefined) {
      return null;
    }
    if (
      sheet.useProtectMaskForEdit !== undefined
      && typeof sheet.useProtectMaskForEdit !== 'boolean'
    ) return null;
    if (sheet.showcase !== undefined && typeof sheet.showcase !== 'boolean') return null;
    if (sheet.geometryLock !== undefined && typeof sheet.geometryLock !== 'boolean') return null;
    if (hasConflictingRenderAuthority(sheet)) return null;
    if (
      sheet.resultKind !== undefined
      && (
        typeof sheet.resultKind !== 'string'
        || !RESULT_KINDS.has(sheet.resultKind as RenderResultKind)
      )
    ) return null;
    if (sheet.error !== undefined && typeof sheet.error !== 'string') return null;

    sheets.push({
      key: sheet.key,
      label: sheet.label,
      prompt: sheet.prompt,
      inputPath: sheet.inputPath,
      status: sheet.status as RenderSheetStatus,
      ...(sheet.protectMaskPath === undefined ? {} : { protectMaskPath: sheet.protectMaskPath as string }),
      ...(sheet.useProtectMaskForEdit === undefined
        ? {}
        : { useProtectMaskForEdit: sheet.useProtectMaskForEdit }),
      ...(sheet.outputPath === undefined ? {} : { outputPath: sheet.outputPath as string }),
      ...(sheet.error === undefined ? {} : { error: sheet.error }),
      ...(sheet.showcase === undefined ? {} : { showcase: sheet.showcase }),
      ...(sheet.geometryLock === undefined ? {} : { geometryLock: sheet.geometryLock }),
      ...(sheet.resultKind === undefined ? {} : { resultKind: sheet.resultKind as RenderResultKind }),
    });
  }

  return {
    uid: job.uid,
    siteId: job.siteId,
    style: job.style,
    engine: job.engine,
    sheets,
    status: job.status as RenderJobStatus,
    ...(job.error === undefined ? {} : { error: job.error }),
  };
}

/** Streams the job doc. Returns an unsubscribe fn. `onError` (if given) fires on a listener error
 *  distinct from job-not-found, so the UI can show "connection lost" rather than "job gone". */
export function subscribeRenderJob(
  jobId: string,
  cb: (job: RenderJobDoc | null) => void,
  onError?: (err: FirestoreError) => void,
): () => void {
  if (!nonEmptyString(jobId) || jobId.includes('/')) {
    cb(null);
    return () => {};
  }
  const fb = getFirebase();
  if (!fb) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(fb.db, 'render_jobs', jobId),
    (snap) => cb(snap.exists() ? normaliseRenderJobDoc(jobId, snap.data()) : null),
    (err) => {
      console.error('[render-jobs] subscribe listener error', jobId, err);
      if (onError) onError(err);
      else cb(null);
    },
  );
}

/** Downloads a finished sheet's raw styled image as a data URL, ready for the client composite-back. */
export async function fetchRenderOutput(outputPath: string): Promise<string> {
  const fb = getFirebase();
  if (!fb) throw new RenderJobError('Firebase unavailable.');
  const url = await getDownloadURL(ref(fb.storage, outputPath));
  const res = await fetch(url);
  if (!res.ok) throw new RenderJobError(`Could not fetch render (${res.status}).`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new RenderJobError(`Could not read render image: ${r.error?.message ?? 'unknown error'}`));
    r.readAsDataURL(blob);
  });
}
