'use client';

// Data-access layer for the community layer (opt-in profiles, trade board,
// 1:1 messaging). Mirrors the conventions in lib/db/queries.ts: thin functions,
// Firestore-first, graceful no-op when the backend or the community kill
// switch is off. Every exported function short-circuits on communityEnabled().

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  addDoc, query, where, orderBy, serverTimestamp, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { communityEnabled } from '@/lib/community/flag';
import type {
  CommunityProfile, BoardPost, BoardCategory, BoardKind,
  MessageThread, ThreadMessage, CommunityReportTargetType,
} from './types';

// SAMPLE-MODE GATE (safety layer 2, lib/sample-mode.ts): null = "backend off" to every
// function here, so a sample-farm visitor can't post/message/report as themselves from
// inside the demo — community is real-identity space, the sample is not.
const fb = () => (isSampleMode() ? null : getFirebase());
const uid = () => fb()?.auth.currentUser?.uid ?? null;
const rows = <T,>(snap: { docs: { id: string; data: () => unknown }[] }) =>
  snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as unknown as T[];

// Rounds to 2 decimal degrees (~1.1km) — deliberately coarse and stable rather
// than re-randomised per view. Call this client-side before any write; a
// precise homestead coordinate must never reach this feature at all.
export function jitterToNeighbourhood(lat: number, lon: number): { lat: number; lon: number } {
  const round = (n: number) => Math.round(n * 100) / 100;
  return { lat: round(lat), lon: round(lon) };
}

// ---- community profile ----
export async function getCommunityProfile(targetUid: string): Promise<CommunityProfile | null> {
  if (!communityEnabled()) return null;
  const f = fb(); if (!f) return null;
  const s = await getDoc(doc(f.db, 'community_profiles', targetUid));
  return s.exists() ? ({ uid: s.id, ...s.data() } as unknown as CommunityProfile) : null;
}

export async function getMyCommunityProfile(): Promise<CommunityProfile | null> {
  const u = uid(); if (!u) return null;
  return getCommunityProfile(u);
}

export async function upsertCommunityProfile(patch: Partial<CommunityProfile>): Promise<void> {
  if (!communityEnabled()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  await setDoc(doc(f.db, 'community_profiles', u), { ...patch, uid: u, updated_at: serverTimestamp() }, { merge: true });
}

export async function deleteCommunityProfile(): Promise<void> {
  if (!communityEnabled()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  await deleteDoc(doc(f.db, 'community_profiles', u));
}

// Client-side filter over opted-in + map-visible docs — fine at pilot scale.
// A geohash-bounded query is a sensible later optimisation, not needed for v1.
export async function listNearbyCommunityProfiles(): Promise<CommunityProfile[]> {
  if (!communityEnabled()) return [];
  const f = fb(); const u = uid(); if (!f) return [];
  const s = await getDocs(query(collection(f.db, 'community_profiles'), where('show_on_map', '==', true)));
  return rows<CommunityProfile>(s).filter((p) => p.uid !== u);
}

// ---- trade board ----
export async function listBoardPosts(): Promise<BoardPost[]> {
  if (!communityEnabled()) return [];
  const f = fb(); if (!f) return [];
  const s = await getDocs(query(
    collection(f.db, 'board_posts'), where('status', '==', 'active'), orderBy('created_at', 'desc'),
  ));
  return rows<BoardPost>(s);
}

export async function createBoardPost(row: {
  category: BoardCategory; kind: BoardKind; description: string;
  photo_url?: string | null; area_text: string; coarse_lat?: number | null; coarse_lon?: number | null;
}): Promise<void> {
  if (!communityEnabled()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  const me = await getMyCommunityProfile();
  await addDoc(collection(f.db, 'board_posts'), {
    ...row, owner_id: u, owner_name: me?.display_name ?? 'A farmer', status: 'active', created_at: serverTimestamp(),
  });
}

export async function closeBoardPost(id: string): Promise<void> {
  if (!communityEnabled()) return;
  const f = fb(); if (!f) return;
  await updateDoc(doc(f.db, 'board_posts', id), { status: 'closed' });
}

export async function deleteBoardPost(id: string): Promise<void> {
  if (!communityEnabled()) return;
  const f = fb(); if (!f) return;
  await deleteDoc(doc(f.db, 'board_posts', id));
}

// ---- 1:1 messaging ----
// Lookup by array-contains + client filter, not a deterministic sortedA_B id —
// avoids assuming anything about Firebase UID character sets.
export async function getOrCreateThread(otherUid: string, otherName: string): Promise<string | null> {
  if (!communityEnabled()) return null;
  const f = fb(); const u = uid(); if (!f || !u || u === otherUid) return null;
  const s = await getDocs(query(collection(f.db, 'message_threads'), where('participants', 'array-contains', u)));
  const existing = rows<MessageThread>(s).find((t) => t.participants.includes(otherUid));
  if (existing) return existing.id;
  const me = await getMyCommunityProfile();
  const r = await addDoc(collection(f.db, 'message_threads'), {
    participants: [u, otherUid],
    participant_names: { [u]: me?.display_name ?? 'You', [otherUid]: otherName },
    last_message: '', last_message_at: serverTimestamp(), created_at: serverTimestamp(),
  });
  return r.id;
}

export async function listMyThreads(): Promise<MessageThread[]> {
  if (!communityEnabled()) return [];
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'message_threads'), where('participants', 'array-contains', u)));
  return rows<MessageThread>(s).sort((a, b) => {
    const t = (x: MessageThread) => (x as { last_message_at?: { toMillis?: () => number } }).last_message_at?.toMillis?.() ?? 0;
    return t(b) - t(a);
  });
}

export async function getThread(threadId: string): Promise<MessageThread | null> {
  if (!communityEnabled()) return null;
  const f = fb(); if (!f) return null;
  const s = await getDoc(doc(f.db, 'message_threads', threadId));
  return s.exists() ? ({ id: s.id, ...s.data() } as unknown as MessageThread) : null;
}

export function subscribeMessages(threadId: string, cb: (msgs: ThreadMessage[]) => void): Unsubscribe | null {
  if (!communityEnabled()) return null;
  const f = fb(); if (!f) return null;
  const q = query(collection(f.db, 'message_threads', threadId, 'messages'), orderBy('created_at', 'asc'));
  return onSnapshot(q, (snap) => cb(rows<ThreadMessage>(snap)));
}

export async function sendMessage(threadId: string, body: string): Promise<void> {
  if (!communityEnabled()) return;
  const f = fb(); const u = uid(); if (!f || !u || !body.trim()) return;
  await addDoc(collection(f.db, 'message_threads', threadId, 'messages'), {
    sender_id: u, body: body.trim(), created_at: serverTimestamp(),
  });
  await updateDoc(doc(f.db, 'message_threads', threadId), {
    last_message: body.trim(), last_message_at: serverTimestamp(),
  });
}

// ---- report/block (v1: create-only, admin-readable) ----
export async function reportContent(
  target_type: CommunityReportTargetType, target_id: string, target_owner_id: string, reason: string,
): Promise<void> {
  if (!communityEnabled()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  await addDoc(collection(f.db, 'community_reports'), {
    reporter_id: u, target_type, target_id, target_owner_id, reason, created_at: serverTimestamp(),
  });
}
