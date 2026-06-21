# ImbewuField — Firebase Setup & Seed

## Prerequisites

The app uses Firebase (Firestore + Auth + Storage). Until the env vars below are set, the app runs in offline/demo mode (no crash, no blank screens — it degrades gracefully).

---

## Step 1 — Get a service account

1. Go to the [Firebase console](https://console.firebase.google.com) and open your project.
2. Click the gear icon → **Project settings** → **Service accounts** tab.
3. Click **Generate new private key** → **Generate key**.
4. Save the downloaded JSON file as `serviceAccount.json` in the project root.

`serviceAccount.json` is gitignored — never commit it.

---

## Step 2 — Set environment variables

Create `.env.local` in the project root with the six Firebase config values (copy them from **Project settings → General → Your apps → Web app → SDK snippet → Config**):

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## Step 3 — Run the seed

```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id npm run seed
```

Or, if `serviceAccount.json` is in place and you have the env var set in `.env.local`, just:

```bash
npm run seed
```

The script will:
- Create 1 organization and 1 programme (Presidential Fund + IDC, R48.6m).
- Write 12 gardens matching the NGO/Funder dashboard sample data.
- For each garden, generate 3–4 farmer profiles with production logs, sales logs, and course progress (using the same deterministic RNG as the front-end, so numbers match exactly).

Collections written: `organizations`, `programmes`, `gardens`, `gardens/{id}/members`, `profiles`, `production_logs`, `sales_logs`, `course_progress`.

The seed is safe to run multiple times — it appends fresh documents each run (fresh IDs via `randomUUID`/Firestore auto-IDs). To start clean, delete the collections in the Firebase console first.

---

## Step 4 — Deploy security rules

### Option A — Firebase console (no CLI needed)

1. **Firestore rules:** Firebase console → Firestore Database → Rules tab → paste the contents of `firestore.rules` → Publish.
2. **Storage rules:** Firebase console → Storage → Rules tab → paste the contents of `storage.rules` → Publish.

### Option B — Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules,storage
```

---

## Environment variable reference

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Project settings → General → SDK config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Project settings → General → SDK config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project settings → General → SDK config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Project settings → General → SDK config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Project settings → General → SDK config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Project settings → General → SDK config |

`GOOGLE_APPLICATION_CREDENTIALS` (seed script only) — path to the service account JSON. Defaults to `./serviceAccount.json`.
