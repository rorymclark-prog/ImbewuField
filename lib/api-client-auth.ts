'use client';

import { getFirebase } from '@/lib/firebase/init';

/** Add the current Firebase ID token to a paid API call when a user is signed in. */
export async function paidApiHeaders(): Promise<Record<string, string>> {
  const user = getFirebase()?.auth.currentUser;
  if (!user) return {};
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}
