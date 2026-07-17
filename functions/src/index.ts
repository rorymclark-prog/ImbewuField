// ImbewuField — background AI render worker (hardened after adversarial review, 2026-07-17).
//
// WHY THIS EXISTS: gpt-image renders take minutes; Vercel kills any request past 60s, and at
// thousands of users you can't hold a long HTTP request open per person. The browser writes a job
// to Firestore (`render_jobs/{jobId}`) with each sheet's input composite uploaded to Storage; THIS
// function calls OpenAI's image API directly per sheet, writes the raw styled image back to Storage
// and flips per-sheet status. The browser polls and does the fast deterministic composite-back.
//
// SECURITY MODEL: the job doc is an UNTRUSTED public API — any signed-in client can write one. So
// the worker is the enforcement boundary, NOT the UI/rules:
//   • KILL SWITCH   — app_config/renders.enabled must be true (console toggle stops all spend).
//   • QUOTA         — per-user daily sheet/job cap, counted transactionally (render_usage/{uid_day}).
//   • IDEMPOTENCY   — the job is claimed queued→running in a transaction; a redelivered event bails.
//   • PATH SCOPING  — inputPath is DERIVED server-side (never the client value); keys allow-listed.
//   • TERMINAL      — every job reaches a terminal status (complete/failed/error); nothing hangs.
//
// SETUP (functions/README.md): OpenAI org verified · Blaze plan · REGION matches Firestore ·
//   `firebase functions:secrets:set OPENAI_API_KEY` · create app_config/renders = { enabled: true }.

import { randomUUID } from 'crypto';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions, logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

initializeApp();
const db = getFirestore();
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

// Firestore-trigger region MUST equal the database region, or deploy is rejected.
// fieldproof-sa's Firestore database is in europe-west1 (confirmed via firebase CLI 2026-07-18).
const REGION = 'europe-west1';
const MODEL = 'gpt-image-2';
const CONCURRENCY = 3; // parallel sheets within ONE job (instance concurrency is pinned to 1 below)
const MAX_RETRIES = 2; // network / 5xx
const MAX_429_RETRIES = 5; // rate-limit gets more patience — the budget has room once sheets ≤ 5
const ALLOWED_KEYS = new Set(['all', 'water', 'zones', 'planting', 'structures']);
const MAX_SHEETS_PER_DAY = 30; // per-user spend governor — tune before wide rollout
const MAX_JOBS_PER_DAY = 6;
const PROMPT_MAX = 2000; // clamp attacker-controlled free text billed to our OpenAI org
const ATTEMPT_TIMEOUT_MS = 150_000; // per OpenAI attempt — 3 fit inside the job budget below
const JOB_DEADLINE_MS = 500_000; // < the 540s function budget, so the finally always runs
const STALE_JOB_MS = 20 * 60 * 1000;

// concurrency:1 — a long, memory-heavy job per instance; the Cloud Run default of 80 would let one
// instance accept 80 nine-minute jobs (OOM) and make maxInstances meaningless. With 1, maxInstances
// IS the global job cap; size it to the OpenAI org's images-per-minute tier.
setGlobalOptions({ region: REGION, maxInstances: 20, concurrency: 1 });

interface RenderSheet {
  key: string;
  label: string;
  prompt: string;
  inputPath: string;
  status: 'queued' | 'running' | 'done' | 'error';
  outputPath?: string;
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
const dayKey = () => new Date().toISOString().slice(0, 10); // yyyy-mm-dd

// One OpenAI image edit — the only slow, network-bound step. AbortController caps a hung socket;
// 429s honour Retry-After; 5xx/network get a couple of quick retries.
async function openaiEdit(key: string, imageB64: string, prompt: string, attempt = 0): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
  let res: Response;
  try {
    const form = new FormData();
    form.append('model', MODEL);
    form.append('prompt', prompt);
    form.append('n', '1');
    form.append('size', 'auto'); // maps are landscape — let the model match the composite's aspect
    form.append('quality', 'high');
    form.append('image[]', new Blob([Buffer.from(imageB64, 'base64')], { type: 'image/jpeg' }), 'composite.jpg');
    res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (attempt < MAX_RETRIES) {
      await sleep(1500 * (attempt + 1));
      return openaiEdit(key, imageB64, prompt, attempt + 1);
    }
    throw new Error(`network/abort: ${String(e)}`);
  }
  clearTimeout(timer);

  if (res.status === 429 && attempt < MAX_429_RETRIES) {
    const ra = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 30_000 + Math.floor(Math.random() * 15_000);
    await sleep(wait);
    return openaiEdit(key, imageB64, prompt, attempt + 1);
  }
  if (res.status >= 500 && attempt < MAX_RETRIES) {
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

// Patch one sheet in the job's `sheets` array. Transaction avoids lost updates across concurrent
// sheets. safePatch swallows its own failure so a patch error never aborts the batch.
async function patchSheet(ref: DocumentReference, key: string, patch: Partial<RenderSheet>): Promise<void> {
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data() as RenderJob | undefined;
    if (!data) return;
    const sheets = data.sheets.map((s) => (s.key === key ? { ...s, ...patch } : s));
    tx.update(ref, { sheets, updatedAt: FieldValue.serverTimestamp() });
  });
}
async function safePatch(ref: DocumentReference, key: string, patch: Partial<RenderSheet>): Promise<void> {
  try {
    await patchSheet(ref, key, patch);
  } catch (e) {
    logger.error(`patchSheet failed for ${key}`, e);
  }
}

type ClaimResult = { proceed: true; sheetCount: number } | { proceed: false; reason: string };

// Atomic gate: kill switch + idempotency claim + per-user daily quota, all in one transaction, all
// reads before writes. Returns proceed:false (and writes a terminal status) when the job must stop.
async function claimJob(ref: DocumentReference, jobId: string): Promise<ClaimResult> {
  const cfgRef = db.doc('app_config/renders');
  return db.runTransaction(async (tx) => {
    const [cfgSnap, jobSnap] = await Promise.all([tx.get(cfgRef), tx.get(ref)]);
    const job = jobSnap.data() as RenderJob | undefined;
    if (!job) return { proceed: false, reason: 'missing' };

    // Idempotency — only the invocation that finds it 'queued' proceeds.
    if (job.status !== 'queued') return { proceed: false, reason: `already ${job.status}` };

    // Kill switch — default OFF (doc absent ⇒ disabled) so the pipeline can't spend until enabled.
    if (cfgSnap.data()?.enabled !== true) {
      tx.update(ref, { status: 'error', error: 'AI rendering is temporarily turned off.', updatedAt: FieldValue.serverTimestamp() });
      return { proceed: false, reason: 'kill-switch off' };
    }

    // Per-user daily quota — the enforceable spend cap (rules can't do cross-doc counters).
    const usageRef = db.doc(`render_usage/${job.uid}_${dayKey()}`);
    const usageSnap = await tx.get(usageRef);
    const usedSheets = (usageSnap.data()?.sheets as number) ?? 0;
    const usedJobs = (usageSnap.data()?.jobs as number) ?? 0;
    const n = Array.isArray(job.sheets) ? job.sheets.length : 0;
    if (usedJobs >= MAX_JOBS_PER_DAY || usedSheets + n > MAX_SHEETS_PER_DAY) {
      tx.update(ref, {
        status: 'error',
        error: `Daily AI render limit reached (${MAX_SHEETS_PER_DAY} sheets/day). Try again tomorrow.`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { proceed: false, reason: 'quota' };
    }
    tx.set(usageRef, { sheets: usedSheets + n, jobs: usedJobs + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(ref, { status: 'running', updatedAt: FieldValue.serverTimestamp() });
    return { proceed: true, sheetCount: n };
  });
}

export const runRenderJob = onDocumentCreated(
  { document: 'render_jobs/{jobId}', secrets: [OPENAI_API_KEY], timeoutSeconds: 540, memory: '1GiB' },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const ref = snap.ref;
    const jobId = event.params.jobId as string;
    const started = Date.now();

    try {
      const job = snap.data() as RenderJob;

      const claim = await claimJob(ref, jobId);
      if (!claim.proceed) {
        logger.info(JSON.stringify({ evt: 'job_skipped', jobId, uid: job.uid, reason: claim.reason }));
        return;
      }

      const key = OPENAI_API_KEY.value();
      const bucket = getStorage().bucket();
      const deadline = started + JOB_DEADLINE_MS;

      // Reject sheets whose key isn't a known layer (path scoping + prompt clamp happen per sheet).
      for (const s of job.sheets) {
        if (!ALLOWED_KEYS.has(s.key)) await safePatch(ref, s.key, { status: 'error', error: 'unknown sheet' });
      }
      const work = job.sheets.filter((s) => ALLOWED_KEYS.has(s.key) && s.status !== 'done');

      async function worker(): Promise<void> {
        for (;;) {
          const sheet = work.shift();
          if (!sheet) return;
          if (Date.now() > deadline) {
            await safePatch(ref, sheet.key, { status: 'error', error: 'ran out of time — try again' });
            continue;
          }
          try {
            await safePatch(ref, sheet.key, { status: 'running' });
            // inputPath is DERIVED, never trusted from the client — closes the confused-deputy hole.
            const inputPath = `renders/${job.uid}/${jobId}/input-${sheet.key}.jpg`;
            const [buf] = await bucket.file(inputPath).download();
            const prompt = String(sheet.prompt ?? '').slice(0, PROMPT_MAX);
            if (!prompt) throw new Error('empty prompt');
            const outB64 = await openaiEdit(key, buf.toString('base64'), prompt);
            const outputPath = `renders/${job.uid}/${jobId}/output-${sheet.key}.jpg`;
            // firebaseStorageDownloadTokens: without it, a client getDownloadURL() on an Admin-SDK
            // upload fails and the browser can never pull the finished sheet back (job says "done"
            // but the gallery stays empty). The token makes getDownloadURL return a usable URL.
            await bucket.file(outputPath).save(Buffer.from(outB64, 'base64'), {
              contentType: 'image/jpeg',
              metadata: { metadata: { firebaseStorageDownloadTokens: randomUUID() } },
            });
            await safePatch(ref, sheet.key, { status: 'done', outputPath });
          } catch (err) {
            logger.error(`render sheet failed: ${sheet.key}`, err);
            await safePatch(ref, sheet.key, { status: 'error', error: String(err).slice(0, 300) });
          }
        }
      }

      const pool = Array.from({ length: Math.min(CONCURRENCY, Math.max(1, work.length)) }, worker);
      const settled = await Promise.allSettled(pool);
      settled.forEach((r) => {
        if (r.status === 'rejected') logger.error('worker pool rejection', r.reason);
      });

      const fresh = (await ref.get()).data() as RenderJob;
      const doneCount = fresh.sheets.filter((s) => s.status === 'done').length;
      await ref.update({
        status: doneCount === 0 ? 'failed' : 'complete',
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.info(JSON.stringify({ evt: 'job_done', jobId, uid: job.uid, done: doneCount, total: fresh.sheets.length, ms: Date.now() - started }));
    } catch (err) {
      // Guaranteed terminal state — no job may hang in 'running' after an unexpected throw.
      logger.error(`runRenderJob fatal: ${jobId}`, err);
      try {
        await ref.update({ status: 'error', error: 'render worker failed', updatedAt: FieldValue.serverTimestamp() });
      } catch (e) {
        logger.error(`could not mark ${jobId} errored`, e);
      }
    }
  },
);

// Whole-job failure backstop: an OOM/crash/timeout kill leaves no terminal write, so a job could sit
// 'running' forever. Every 10 min, mark jobs stuck 'queued'/'running' past STALE_JOB_MS as 'failed'.
// Requires the (status, updatedAt) composite index in firestore.indexes.json.
export const sweepStaleRenderJobs = onSchedule({ schedule: 'every 10 minutes', region: REGION }, async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - STALE_JOB_MS);
  let swept = 0;
  for (const status of ['queued', 'running']) {
    const q = await db
      .collection('render_jobs')
      .where('status', '==', status)
      .where('updatedAt', '<', cutoff)
      .limit(200)
      .get();
    for (const d of q.docs) {
      await d.ref.update({ status: 'failed', error: 'render timed out — please try again', updatedAt: FieldValue.serverTimestamp() });
      swept += 1;
    }
  }
  if (swept) logger.info(JSON.stringify({ evt: 'sweeper', swept }));
});
