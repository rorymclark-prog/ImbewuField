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
import { doc, onSnapshot, serverTimestamp, setDoc, Timestamp, type FirestoreError } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';

export type RenderSheetStatus = 'queued' | 'running' | 'done' | 'error';
export type RenderJobStatus = 'queued' | 'running' | 'complete' | 'failed' | 'error';

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
  compositeDataUrl: string; // data:image/jpeg;base64,… — the model input
}

/** A sheet's state as it lives in the job doc (input uploaded; worker fills output/status). */
export interface RenderSheetState {
  key: string;
  label: string;
  prompt: string;
  inputPath: string;
  status: RenderSheetStatus;
  outputPath?: string;
  error?: string;
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
export async function enqueueRenderJob(opts: {
  siteId: string;
  style: string;
  engine: string;
  sheets: RenderSheetSpec[];
}): Promise<string> {
  const fb = getFirebase();
  const uid = fb?.auth.currentUser?.uid;
  if (!fb || !uid) throw new RenderJobError('You need to be signed in to generate AI sheets.');
  if (opts.sheets.length === 0) throw new RenderJobError('Nothing to render.');
  // Fail fast against the SAME limits the security rules enforce, before uploading anything.
  if (opts.sheets.length > MAX_SHEETS_PER_JOB) {
    throw new RenderJobError(`Too many sheets in one job (max ${MAX_SHEETS_PER_JOB}).`);
  }
  for (const s of opts.sheets) {
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
        return { key: s.key, label: s.label, prompt: s.prompt, inputPath, status: 'queued' };
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
