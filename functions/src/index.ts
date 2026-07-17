// ImbewuField — background AI render worker.
//
// WHY THIS EXISTS: gpt-image-2 renders take minutes; Vercel kills any request past 60s, and at
// thousands of users you can't hold a long HTTP request open per person. So the browser writes a
// job to Firestore (`render_jobs/{jobId}`) with each sheet's input composite already uploaded to
// Storage; THIS function (triggered by that write, 9-min budget) calls OpenAI's image API directly
// for each sheet, writes the raw styled image back to Storage, and flips that sheet's status. The
// browser polls the job doc and does the fast, deterministic composite-back (boundary clip +
// burned labels) itself — so all the accurate-map logic stays client-side and only the slow model
// call is backgrounded. No fal, no Vercel Pro.
//
// SETUP (see functions/README before first deploy):
//   • REGION below MUST match this project's Firestore database region (a Firestore trigger can
//     only run where the database lives). fieldproof-sa's default is us-central1 — change if yours
//     differs, or `firebase deploy` will reject the trigger.
//   • Set the key: `firebase functions:secrets:set OPENAI_API_KEY`
//   • The OpenAI org must be VERIFIED to use gpt-image models.

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions, logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

initializeApp();

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

// Firestore-trigger region MUST equal the database region. Override if fieldproof-sa isn't us-central1.
const REGION = 'us-central1';
const MODEL = 'gpt-image-2'; // the sharp engine Rory wants; runs fine inside the 9-min budget here
const CONCURRENCY = 3; // parallel sheets — enough to be quick, low enough to respect OpenAI rate caps
const MAX_RETRIES = 2; // per sheet, on 429 (rate limit) / 5xx

setGlobalOptions({ region: REGION, maxInstances: 20 });

interface RenderSheet {
  key: string;
  label: string;
  prompt: string;
  inputPath: string; // Storage path the browser uploaded the composite to
  status: 'queued' | 'running' | 'done' | 'error';
  outputPath?: string; // Storage path this worker writes the raw styled image to
  error?: string;
}
interface RenderJob {
  uid: string;
  siteId: string;
  style: string;
  engine: string;
  sheets: RenderSheet[];
  status: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One OpenAI image edit — the ONLY slow, network-bound step. Retries on 429/5xx with backoff.
async function openaiEdit(key: string, imageB64: string, prompt: string, attempt = 0): Promise<string> {
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', prompt);
  form.append('n', '1');
  form.append('size', 'auto'); // maps are landscape — let the model match the composite's aspect
  form.append('quality', 'high'); // no 60s cap to fit under here, so use the best tier
  form.append('image[]', new Blob([Buffer.from(imageB64, 'base64')], { type: 'image/jpeg' }), 'composite.jpg');

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      await sleep(1500 * (attempt + 1));
      return openaiEdit(key, imageB64, prompt, attempt + 1);
    }
    throw new Error(`network: ${String(e)}`);
  }

  if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
    await sleep(2000 * (attempt + 1));
    return openaiEdit(key, imageB64, prompt, attempt + 1);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image');
  return b64;
}

// Patch a single sheet in the job's `sheets` array. A transaction is required because several
// sheets finish concurrently and a naive read-modify-write would lose updates.
async function patchSheet(ref: DocumentReference, key: string, patch: Partial<RenderSheet>): Promise<void> {
  await getFirestore().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data() as RenderJob | undefined;
    if (!data) return;
    const sheets = data.sheets.map((s) => (s.key === key ? { ...s, ...patch } : s));
    tx.update(ref, { sheets, updatedAt: new Date().toISOString() });
  });
}

export const runRenderJob = onDocumentCreated(
  { document: 'render_jobs/{jobId}', secrets: [OPENAI_API_KEY], timeoutSeconds: 540, memory: '1GiB' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data() as RenderJob;
    const ref = snap.ref;
    const jobId = event.params.jobId as string;
    const bucket = getStorage().bucket();
    const key = OPENAI_API_KEY.value();

    if (!job.sheets?.length) {
      await ref.update({ status: 'complete', updatedAt: new Date().toISOString() });
      return;
    }
    await ref.update({ status: 'running', updatedAt: new Date().toISOString() });

    // Concurrency-limited pool over the sheets.
    const queue = [...job.sheets];
    async function worker(): Promise<void> {
      for (;;) {
        const sheet = queue.shift();
        if (!sheet) return;
        try {
          await patchSheet(ref, sheet.key, { status: 'running' });
          const [buf] = await bucket.file(sheet.inputPath).download();
          const outB64 = await openaiEdit(key, buf.toString('base64'), sheet.prompt);
          const outPath = `renders/${job.uid}/${jobId}/output-${sheet.key}.jpg`;
          await bucket.file(outPath).save(Buffer.from(outB64, 'base64'), { contentType: 'image/jpeg' });
          await patchSheet(ref, sheet.key, { status: 'done', outputPath: outPath });
        } catch (err) {
          logger.error(`render sheet failed: ${sheet.key}`, err);
          await patchSheet(ref, sheet.key, { status: 'error', error: String(err).slice(0, 300) });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, job.sheets.length) }, worker));

    const fresh = (await ref.get()).data() as RenderJob;
    const done = fresh.sheets.every((s) => s.status === 'done' || s.status === 'error');
    await ref.update({ status: done ? 'complete' : 'running', updatedAt: new Date().toISOString() });
  },
);
