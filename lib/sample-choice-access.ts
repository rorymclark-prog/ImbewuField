'use client';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/init';
import type { UserRole } from '@/lib/db/types';

/** Read only the signed-in account's role. The demo profile is not an access authority. */
export async function readSampleChooserAccountRole(expectedUid: string): Promise<UserRole | null> {
  const firebase = getFirebase();
  if (!firebase || firebase.auth.currentUser?.uid !== expectedUid) return null;
  const snapshot = await getDoc(doc(firebase.db, 'profiles', expectedUid));
  if (firebase.auth.currentUser?.uid !== expectedUid) return null;
  const role = snapshot.data()?.role;
  return ['admin', 'ngo', 'funder', 'mentor', 'farmer', 'student'].includes(role) ? role : null;
}
