'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';

// Firebase web config — all public (security is enforced by Firestore rules + Auth,
// not by hiding these). Fill from Firebase console → Project settings → your web app.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isBackendConfigured = () => !!config.apiKey && !!config.projectId;

// ── Local Firebase emulator support (dev/test only) ─────────────────────────
// Fully opt-in: production behaviour is byte-for-byte unchanged unless this
// flag is set. Never true in a normal `vercel --prod` / production build,
// since the env var is not defined there.
const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === '1';
const EMULATOR_AUTH_HOST = 'http://127.0.0.1:9099';
const EMULATOR_FIRESTORE_HOST = '127.0.0.1';
const EMULATOR_FIRESTORE_PORT = 8080;
const EMULATOR_STORAGE_HOST = '127.0.0.1';
const EMULATOR_STORAGE_PORT = 9199;

// Guard against "already connected" throws from connectAuthEmulator /
// connectFirestoreEmulator on Next.js Fast Refresh, which re-evaluates this
// module (resetting the local `cache` var) without tearing down the
// underlying Auth/Firestore singletons registered against the Firebase app.
// A flag on globalThis survives module re-evaluation, so we only ever call
// the connect* functions once per page load.
declare global {
  // eslint-disable-next-line no-var
  var __IMBEWUFIELD_EMULATORS_CONNECTED__: boolean | undefined;
}

function connectEmulatorsOnce(auth: Auth, db: Firestore, storage: FirebaseStorage) {
  if (!USE_EMULATOR) return;
  if (globalThis.__IMBEWUFIELD_EMULATORS_CONNECTED__) return;
  globalThis.__IMBEWUFIELD_EMULATORS_CONNECTED__ = true;
  try {
    connectAuthEmulator(auth, EMULATOR_AUTH_HOST, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_FIRESTORE_HOST, EMULATOR_FIRESTORE_PORT);
    // Storage too, or emulator sessions upload render inputs to PRODUCTION storage with an
    // emulator auth token (rejected) — the render queue was untestable locally without this.
    connectStorageEmulator(storage, EMULATOR_STORAGE_HOST, EMULATOR_STORAGE_PORT);
    // eslint-disable-next-line no-console
    console.info(
      `[ImbewuField] NEXT_PUBLIC_USE_FIREBASE_EMULATOR=1 — using local emulators ` +
      `(auth: ${EMULATOR_AUTH_HOST}, firestore: ${EMULATOR_FIRESTORE_HOST}:${EMULATOR_FIRESTORE_PORT}, ` +
      `storage: ${EMULATOR_STORAGE_HOST}:${EMULATOR_STORAGE_PORT}). ` +
      `No production Firebase traffic.`
    );
  } catch (err) {
    // Already connected (e.g. a race on first render) — safe to ignore.
    console.warn('[ImbewuField] Emulator connect skipped (already connected?):', err);
  }
}

let cache: { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage } | null = null;

// Returns the Firebase handles, or null if env isn't configured yet (so the app
// degrades gracefully to its built-in sample/localStorage behaviour).
export function getFirebase() {
  if (!isBackendConfigured()) return null;
  if (cache) return cache;
  const app = getApps().length ? getApp() : initializeApp(config);
  // ignoreUndefinedProperties: optional model fields (place color/notes, etc.) are often
  // undefined; without this, setDoc/Transaction.set throws "Unsupported field value:
  // undefined" and the write silently fails (data saved locally but never synced).
  // initializeFirestore throws if the instance already exists (HMR / module re-eval) —
  // fall back to the existing one.
  //
  // PERSISTENT CACHE, because a farmer with no signal was being shown R0 as if it were a fact.
  // Firestore had no local cache of any kind, so the in-memory one was empty on every load. An
  // offline getDocs does not reject — it FULFILS with an empty snapshot — so /finances rendered
  // "R 0" income and "No sales logged yet", indistinguishable from a genuinely empty ledger, while
  // the farmer's real figures sat safe in Firestore and unreachable. The allSettled handler on that
  // page could not help: nothing had rejected.
  //
  // With a persistent cache the same read is served from disk and she sees her own numbers. It also
  // makes an offline write queue and replay, which is what a smallholding with intermittent signal
  // actually needs. Multi-tab manager because the app is a PWA and a farmer may well have it open
  // twice.
  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Thrown when the instance already exists (HMR / module re-eval), and also where persistence
    // is unavailable — private browsing, or a browser with IndexedDB disabled. Falling back to the
    // default in-memory instance keeps the app working; it just loses the offline benefit.
    db = getFirestore(app);
  }
  const auth = getAuth(app);
  const storage = getStorage(app);
  connectEmulatorsOnce(auth, db, storage);
  cache = { app, auth, db, storage };
  return cache;
}
