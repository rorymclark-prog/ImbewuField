'use client';

// ImbewuField data-access layer (Firestore). Every screen talks to the DB through
// these functions. Same signatures regardless of backend, so the UI never changes.
// Returns empty/null when the backend isn't configured → UI falls back to samples.

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  addDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase/init';
import type {
  Profile, Garden, GardenMember, ProductionLog, SalesLog, Design, Report,
  SavedPlaceRow, CourseProgress, GardenerProfile,
} from './types';

const fb = () => getFirebase();
const uid = () => fb()?.auth.currentUser?.uid ?? null;
const rows = <T,>(snap: { docs: { id: string; data: () => unknown }[] }) =>
  snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as unknown as T[];

// ---- profile / auth ----
export async function getMyProfile(): Promise<Profile | null> {
  const f = fb(); const u = uid(); if (!f || !u) return null;
  const s = await getDoc(doc(f.db, 'profiles', u));
  return s.exists() ? ({ id: s.id, ...s.data() } as unknown as Profile) : null;
}
export async function updateMyProfile(patch: Partial<Profile>): Promise<void> {
  const f = fb(); const u = uid(); if (!f || !u) return;
  await setDoc(doc(f.db, 'profiles', u), patch, { merge: true });
}

// ---- gardens (oversight) ----
export async function listGardens(): Promise<Garden[]> {
  const f = fb(); const u = uid(); if (!f || !u) return [];
  // Firestore rules are NOT filters: the gardens read rule requires
  // org_id == myOrg, so the QUERY must be constrained by org_id or it's denied.
  // Fetch the caller's org first, then scope the query (sort client-side to
  // avoid needing a composite index).
  const me = await getMyProfile();
  const base = collection(f.db, 'gardens');
  const q = me?.org_id ? query(base, where('org_id', '==', me.org_id)) : query(base);
  const list = rows<Garden>(await getDocs(q));
  return list.sort((a, b) =>
    ((a as { name?: string }).name ?? '').localeCompare((b as { name?: string }).name ?? ''));
}
export async function listGardeners(gardenId: string): Promise<{ member: GardenMember; profile: Profile }[]> {
  const f = fb(); if (!f) return [];
  const memberSnap = await getDocs(collection(f.db, 'gardens', gardenId, 'members'));
  const members = rows<GardenMember>(memberSnap);
  const out = await Promise.all(members.map(async (m) => {
    const p = await getDoc(doc(f.db, 'profiles', m.profile_id));
    return { member: m, profile: ({ id: p.id, ...p.data() } as unknown as Profile) };
  }));
  return out;
}
export async function getGardenerProfile(profileId: string): Promise<GardenerProfile | null> {
  const f = fb(); if (!f) return null;
  const pSnap = await getDoc(doc(f.db, 'profiles', profileId));
  if (!pSnap.exists()) return null;
  // NB: the member doc (plot/size) is already known to callers from listGardeners,
  // so we don't re-fetch it here — a collectionGroup('members') query would need a
  // dedicated COLLECTION_GROUP index. Caller merges member fields it already holds.
  const [prodSnap, salesSnap, courseSnap] = await Promise.all([
    getDocs(query(collection(f.db, 'production_logs'), where('profile_id', '==', profileId))),
    getDocs(query(collection(f.db, 'sales_logs'), where('profile_id', '==', profileId))),
    getDocs(query(collection(f.db, 'course_progress'), where('profile_id', '==', profileId))),
  ]);
  return {
    profile: { id: pSnap.id, ...pSnap.data() } as unknown as Profile,
    member: undefined,
    production: rows<ProductionLog>(prodSnap),
    sales: rows<SalesLog>(salesSnap),
    courses: rows<CourseProgress>(courseSnap),
  };
}

// ---- production / sales ----
export async function addProduction(row: Partial<ProductionLog>): Promise<void> {
  const f = fb(); const u = uid(); if (!f || !u) return;
  await addDoc(collection(f.db, 'production_logs'), { ...row, profile_id: u, created_at: serverTimestamp() });
}
export async function addSale(row: Partial<SalesLog>): Promise<void> {
  const f = fb(); const u = uid(); if (!f || !u) return;
  await addDoc(collection(f.db, 'sales_logs'), { ...row, profile_id: u, created_at: serverTimestamp() });
}
export async function myProduction(): Promise<ProductionLog[]> {
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'production_logs'), where('profile_id', '==', u)));
  return rows<ProductionLog>(s);
}

// ---- designs (incl. supervisor → farmer share) ----
export async function saveDesign(d: Partial<Design>): Promise<string | null> {
  const f = fb(); const u = uid(); if (!f || !u) return null;
  const r = await addDoc(collection(f.db, 'designs'), { ...d, owner_id: u, created_at: serverTimestamp() });
  return r.id;
}
export async function shareDesign(designId: string, farmerProfileId: string): Promise<void> {
  const f = fb(); if (!f) return;
  await updateDoc(doc(f.db, 'designs', designId), { shared_with: farmerProfileId });
}
export async function designsSharedWithMe(): Promise<Design[]> {
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'designs'), where('shared_with', '==', u)));
  return rows<Design>(s);
}

// ---- reports ----
export async function saveReport(r: Partial<Report>): Promise<void> {
  const f = fb(); const u = uid(); if (!f || !u) return;
  await addDoc(collection(f.db, 'reports'), { ...r, owner_id: u, created_at: serverTimestamp() });
}

// ---- saved places ----
export async function listSavedPlaces(): Promise<SavedPlaceRow[]> {
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'saved_places'), where('profile_id', '==', u)));
  return rows<SavedPlaceRow>(s);
}
export async function addSavedPlace(p: Partial<SavedPlaceRow>): Promise<void> {
  const f = fb(); const u = uid(); if (!f || !u) return;
  await addDoc(collection(f.db, 'saved_places'), { ...p, profile_id: u, created_at: serverTimestamp() });
}
export async function deleteSavedPlace(id: string): Promise<void> {
  const f = fb(); if (!f) return;
  await deleteDoc(doc(f.db, 'saved_places', id));
}

// ---- photo upload ----
export async function uploadPhoto(file: File, folder = 'produce'): Promise<string | null> {
  const f = fb(); const u = uid(); if (!f || !u) return null;
  const path = `photos/${folder}/${u}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
  const r = storageRef(f.storage, path);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

// ---- farmer directory (supervisor use) ----
export async function listFarmers(): Promise<Profile[]> {
  const f = fb(); if (!f) return [];
  const s = await getDocs(query(collection(f.db, 'profiles'), where('role', '==', 'farmer')));
  return rows<Profile>(s);
}
