// Client side of the background AI-render pipeline (worker: functions/src/index.ts).
//
// Flow: the browser builds each sheet's composite (existing DesignGlossy code), calls
// enqueueRenderJob() to upload those composites to Storage + write ONE job doc, then
// subscribeRenderJob() streams the worker's progress. As each sheet flips to 'done', the browser
// downloads the raw styled image with fetchRenderOutput() and runs its own fast, deterministic
// composite-back (boundary clip + burned labels). Only the slow OpenAI call lives in the worker;
// everything accurate stays here. See functions/README.md for the schema + deploy.

import { getFirebase } from '@/lib/firebase/init';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';

export type RenderSheetStatus = 'queued' | 'running' | 'done' | 'error';

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
  status: 'queued' | 'running' | 'complete';
  createdAt: string;
  updatedAt: string;
}

export class RenderJobError extends Error {}

/** Uploads each composite to Storage and writes the job doc; the Cloud Function takes it from there.
 *  Returns the jobId to subscribe to. */
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

  // jobId is uid-scoped so Storage/Firestore rules can gate on the owner by path.
  const jobId = `${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const sheets: RenderSheetState[] = [];
  for (const s of opts.sheets) {
    const inputPath = `renders/${uid}/${jobId}/input-${s.key}.jpg`;
    await uploadString(ref(fb.storage, inputPath), s.compositeDataUrl, 'data_url');
    sheets.push({ key: s.key, label: s.label, prompt: s.prompt, inputPath, status: 'queued' });
  }

  const now = new Date().toISOString();
  const job: RenderJobDoc = {
    uid,
    siteId: opts.siteId,
    style: opts.style,
    engine: opts.engine,
    sheets,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(fb.db, 'render_jobs', jobId), job);
  return jobId;
}

/** Streams the job doc. Returns an unsubscribe fn. Calls back with null if Firebase isn't set up. */
export function subscribeRenderJob(jobId: string, cb: (job: RenderJobDoc | null) => void): () => void {
  const fb = getFirebase();
  if (!fb) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(fb.db, 'render_jobs', jobId),
    (snap) => cb(snap.exists() ? (snap.data() as RenderJobDoc) : null),
    () => cb(null),
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
    r.onerror = () => reject(new RenderJobError('Could not read render image.'));
    r.readAsDataURL(blob);
  });
}
