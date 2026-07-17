# ImbewuField Cloud Functions — background AI render worker

Runs the slow gpt-image calls off the request path so they escape Vercel's 60s limit and scale to
thousands of users. See the header of `src/index.ts` for the full flow.

## What it does
`runRenderJob` triggers when the browser writes `render_jobs/{jobId}` in Firestore. For each sheet
it downloads the input composite from Storage, calls OpenAI's image edit API directly (gpt-image-2),
writes the raw styled image back to Storage, and updates that sheet's status. The browser streams
progress and does the fast composite-back itself.

## One-time setup (Rory)
1. **OpenAI org verification** — verify the org at platform.openai.com → Settings → Organization.
   gpt-image models require it.
2. **Firebase Blaze plan** — Cloud Functions can't make outbound calls (to OpenAI) on the free
   Spark plan. Upgrade the `fieldproof-sa` project to Blaze (pay-as-you-go).
3. **Region** — `REGION` in `src/index.ts` MUST equal this project's Firestore database region
   (default assumed `us-central1`). Check it in the Firebase console → Firestore; change the
   constant if it differs, or the trigger deploy is rejected.

## Deploy
```bash
cd functions && npm install          # first time only
firebase functions:secrets:set OPENAI_API_KEY    # paste the key when prompted
firebase deploy --only functions,firestore:rules,storage
```

## Notes
- `CONCURRENCY` (3) and `MAX_RETRIES` (2) in `src/index.ts` tune parallelism / rate-limit backoff.
- Cost: gpt-image-2 is ~cents per image. Add a per-user daily quota (Stage 2) before wide rollout.
- Logs: `npm run logs` or Firebase console → Functions → Logs.
