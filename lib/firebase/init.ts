'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

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

let cache: { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage } | null = null;

// Returns the Firebase handles, or null if env isn't configured yet (so the app
// degrades gracefully to its built-in sample/localStorage behaviour).
export function getFirebase() {
  if (!isBackendConfigured()) return null;
  if (cache) return cache;
  const app = getApps().length ? getApp() : initializeApp(config);
  cache = { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
  return cache;
}
