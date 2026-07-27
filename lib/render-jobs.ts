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

export type RenderSheetStatus = 'queued' | 'running' | 'done' | 'error';
export type RenderJobStatus = 'queued' | 'running' | 'complete' | 'failed' | 'error';
export type RenderResultKind = 'hybrid' | 'ai-polished' | 'legacy-ai';

/** Max sheets per job and max bytes per composite — MUST match firestore.rules / storage.rules. */
export const MAX_SHEETS_PER_JOB = 5;
export const MAX_COMPOSITE_BYTES = 12 * 1024 * 1024;
/** How long a job doc + its Storage artifacts live (also enforced by GCS lifecycle + Firestore TTL). */
const JOB_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** What the caller hands enqueueRenderJob per sheet — the built composite + the full model prompt. */
export interface RenderSheetSpec {
  key: string; // stable per-layer id: 'all' | 'water' | 'zones' | 'planting' | 'structures'
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

export interface RenderJobDoc {
  uid: string;
  siteId: string;
  style: string;
  engine: string;
  sheets: RenderSheetState[];
  status: RenderJobStatus;
  error?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  expireAt?: Timestamp;
}

export class RenderJobError extends Error {}

/** Approx decoded byte size of a base64 data URL without allocating the buffer. */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor(b64.length * 0.75);
}

/** Uploads each composite to Storage and writes the job doc; the Cloud Function takes it from there.
 *  Uploads run in parallel; on ANY failure every already-uploaded object is rolled back so no
 *  orphans are left, and the caller sees one clean error. Returns the jobId to subscribe to. */
/** True when a protect mask has at least one fully opaque (protected) pixel. */
async function maskProtectsSomething(maskDataUrl: string): Promise<boolean> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('mask load failed'));
      el.src = maskDataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] === 255) return true;
    return false;
  } catch {
    return false; // cannot verify it protects anything -> do not send it
  }
}

export async function enqueueRenderJob(opts: {
  siteId: string;
  style: string;
  engine: string;
  sheets: RenderSheetSpec[];
}): Promise<string> {
  // Sample farm is look-don't-spend: AI renders bill a real OpenAI account and write
  // renders/{uid} storage, so they're off while sampling. The exact (no-AI) sheets all work
  // in the sample — this only blocks the billed path. (Safety layer 2, lib/sample-mode.ts.)
  if (isSampleMode()) {
    throw new RenderJobError('AI sheets are switched off in the sample farm. Exit the sample and open your own farm to render AI sheets.');
  }
  const fb = getFirebase();
  const uid = fb?.auth.currentUser?.uid;
  if (!fb || !uid) throw new RenderJobError('You need to be signed in to generate AI sheets.');
  if (opts.sheets.length === 0) throw new RenderJobError('Nothing to render.');
  // Fail fast against the SAME limits the security rules enforce, before uploading anything.
  if (opts.sheets.length > MAX_SHEETS_PER_JOB) {
    throw new RenderJobError(`Too many sheets in one job (max ${MAX_SHEETS_PER_JOB}).`);
  }
  for (const s of opts.sheets) {
    if (hasConflictingRenderAuthority(s)) {
      throw new RenderJobError(`Sheet “${s.label}” requested two incompatible render modes.`);
    }
    if (dataUrlBytes(s.compositeDataUrl) > MAX_COMPOSITE_BYTES) {
      throw new RenderJobError(`Sheet “${s.label}” is too large to upload (max 12 MB).`);
    }
  }

  const jobId = `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Upload all composites concurrently; track successes so we can roll them back on any failure.
  const uploaded: string[] = [];
  let sheets: RenderSheetState[];
  try {
    sheets = await Promise.all(
      opts.sheets.map(async (s): Promise<RenderSheetState> => {
        const inputPath = `renders/${uid}/${jobId}/input-${s.key}.jpg`;
        await uploadString(ref(fb.storage, inputPath), s.compositeDataUrl, 'data_url');
        uploaded.push(inputPath);
        let protectMaskPath: string | undefined;
        // A mask that protects NOTHING must never be uploaded. At the edits endpoint a fully
        // transparent mask is not a no-op — it states that every pixel is editable, and a real
        // render answered that by discarding the supplied aerial photograph and generating a
        // different farm. (The mirror case, a fully OPAQUE mask, silently reverted the render;
        // see maskEditableFraction in lib/image-producer.) Neither extreme is ever intended.
        if (s.protectMaskDataUrl && await maskProtectsSomething(s.protectMaskDataUrl)) {
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
      }),
    );
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

/** Streams the job doc. Returns an unsubscribe fn. `onError` (if given) fires on a listener error
 *  distinct from job-not-found, so the UI can show "connection lost" rather than "job gone". */
export function subscribeRenderJob(
  jobId: string,
  cb: (job: RenderJobDoc | null) => void,
  onError?: (err: FirestoreError) => void,
): () => void {
  const fb = getFirebase();
  if (!fb) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(fb.db, 'render_jobs', jobId),
    (snap) => cb(snap.exists() ? (snap.data() as RenderJobDoc) : null),
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
