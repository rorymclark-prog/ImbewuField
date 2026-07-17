# ImbewuField Cloud Functions — background AI render worker

Runs the slow gpt-image calls off the request path so they escape Vercel's 60s limit and scale to
thousands of users. See the header of `src/index.ts` for the full flow + security model.

## What it does
`runRenderJob` triggers when the browser writes `render_jobs/{jobId}`. It **claims** the job
(idempotent), checks the **kill switch** + **per-user daily quota**, then for each sheet downloads
the input composite from a **server-derived** Storage path, calls OpenAI's image edit API directly
(gpt-image-2, with fetch timeout + Retry-After backoff), writes the result back to Storage, and
updates that sheet's status. Every job reaches a terminal status; `sweepStaleRenderJobs` (every
10 min) fails anything stuck.

## One-time setup (Rory)
1. **OpenAI org verification** — platform.openai.com → Settings → Organization → Verify. gpt-image
   models require it.
2. **Firebase Blaze plan** — Cloud Functions can't call OpenAI on the free Spark plan. Upgrade the
   `fieldproof-sa` project to Blaze.
3. **Region** — `REGION` in `src/index.ts` MUST equal this project's Firestore region (assumed
   `us-central1`; check Firebase console → Firestore). Change the constant or the deploy is rejected.
4. **Turn the pipeline ON** (the kill switch, default OFF): in Firestore, create
   `app_config/renders` = `{ enabled: true }`. Set `enabled: false` any time to instantly stop all
   render spend.

## Deploy
```bash
cd functions && npm install                      # first time only
firebase functions:secrets:set OPENAI_API_KEY    # paste the key
firebase deploy --only functions,firestore:rules,firestore:indexes,storage
```

## Tunables (`src/index.ts`)
- `MAX_SHEETS_PER_DAY` (30) / `MAX_JOBS_PER_DAY` (6) — per-user spend cap. Start low, raise with data.
- `CONCURRENCY` (3) sheets per job; `maxInstances` (20) is the global job cap → size it to your
  OpenAI images-per-minute tier so a spike can't blow the rate limit.

## Before WIDE rollout (console/config — not code)
- **GCS lifecycle rule** on the bucket: delete objects under `renders/` after 7–30 days (they're
  transient job artifacts). The client also stamps `expireAt`.
- **Firestore TTL policy** on `render_jobs.expireAt` (the client sets it) to auto-delete old jobs.
- **GCP budget alert** on the project + an **OpenAI usage limit** as hard spend backstops.
- **Firebase App Check** (enforce in functions + a rules condition) so only the real app can enqueue.
- Optionally require `email_verified` on the `render_jobs` create rule once signup verifies email.

## Notes
- Logs: `npm run logs` or Firebase console → Functions. Each job logs a structured JSON line.
- The `render_usage/{uid}_{yyyymmdd}` docs hold the daily counters (worker-written, owner-readable).
