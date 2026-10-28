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

`aiMapAccess` verifies the caller's Firebase token and current Auth record. Settings uses this
service for the personal switch, platform master controls and organisation delegation. Its
decision is shared with the worker: personal opt-in, the platform switch and the tenant grant
must all permit a new render. Existing saved images remain retrievable after access is revoked.

The `aiMapMaster: true` custom Auth claim is a platform-owner grant issued with the Admin SDK;
an ordinary admin role, a role preview or a writable profile cannot issue it. The owner's
Settings can suspend any organisation. Approved organisation people managers may assign role
or individual access within their own organisation, but cannot override that suspension.
The organisation switch is a manual service entitlement; it does not claim to verify invoices.

The `ai_map_accounts`, `ai_map_organizations`, `ai_map_members` and `ai_map_audit` collections
have no client write rule. Only the authenticated service writes them. A person starts with AI
off and must opt in after access is granted. Revocation is checked again before each sheet;
requests already sent to a provider may finish.

## One-time setup (Rory)
1. **OpenAI org verification** — platform.openai.com → Settings → Organization → Verify. gpt-image
   models require it.
2. **Firebase Blaze plan** — Cloud Functions can't call OpenAI on the free Spark plan. Upgrade the
   `fieldproof-sa` project to Blaze.
3. **Region** — already set: `REGION` in `src/index.ts` is `europe-west1`, matching this project's
   Firestore database (confirmed via CLI). No action needed unless the DB is ever moved.
4. **Turn the pipeline ON** only after deploying the access service and worker: the Vercel
   environment needs `NEXT_PUBLIC_AI_RENDER_ENABLED=true`, then a web redeploy. The master
   Settings switch controls `app_config/renders.enabled` live, without another redeploy.
   Organisation access and personal switches remain independent and default off.

## Deploy
```bash
cd functions && npm install                      # first time only
firebase functions:secrets:set OPENAI_API_KEY    # paste the key
firebase deploy --only functions:aiMapAccess,functions:runRenderJob
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

The OpenAI glossy-map worker uses `gpt-image-2.5-sunburst` (the shared model in
`lib/ai-render/model.ts`). The worker records the actual model on each job so saved
maps keep their original attribution after upgrades. The existing low/medium/high
quality choices and spend caps remain in force; xhigh/max are not enabled.
Model reference: https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
