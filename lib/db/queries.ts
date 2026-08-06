'use client';

// ImbewuField data-access layer (Firestore). Every screen talks to the DB through
// these functions. Same signatures regardless of backend, so the UI never changes.
// Returns empty/null when the backend isn't configured → UI falls back to samples.

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  addDoc, query, where, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase/init';
import {
  isSampleMode,
  getSandboxProfile, setSandboxProfile,
  getSandboxProduction, addSandboxProduction, deleteSandboxProduction,
  getSandboxSales, addSandboxSale, updateSandboxSale, deleteSandboxSale,
  getSandboxExpenses, addSandboxExpense, updateSandboxExpense, deleteSandboxExpense,
} from '@/lib/sample-mode';
import type {
  Profile, Garden, GardenMember, ProductionLog, SalesLog, ExpenseLog, Design, Report,
  CourseProgress, GardenerProfile, MentorVisit,
  Survey, SurveyQuestion, SurveyResponse,
} from './types';
import type { CourseEnrollment } from '@/lib/course-enrollment';
import { DEFAULT_TRACK, enrollmentDocId, newEnrollment } from '@/lib/course-enrollment';
import type { CourseAssignment } from '@/lib/course-assignments';
import { assignmentDocId } from '@/lib/course-assignments';
import type { CourseSubmission } from '@/lib/course-gating';
import { courseSubmissionDocId } from '@/lib/course-gating';
import type { SavedInvoice } from '@/lib/invoices';
import { invoiceSaleDocumentId, invoiceSalesForPaidInvoice } from '@/lib/invoice-sales';

// Every function below is a real Firestore/Storage writer or a reader that could
// surface the real signed-in user's data. Each checks isSampleMode() FIRST and
// either serves the in-memory sandbox (lib/sample-mode.ts) or no-ops/returns
// empty — a demo session (routed into these same real /farmer, /finances and
// /design screens) can never reach real storage, and never leaks a real
// signed-in user's real records onto the demo screen either.

const fb = () => getFirebase();
const uid = () => fb()?.auth.currentUser?.uid ?? null;
const rows = <T,>(snap: { docs: { id: string; data: () => unknown }[] }) =>
  snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as unknown as T[];

// ---- profile / auth ----
export async function getMyProfile(): Promise<Profile | null> {
  if (isSampleMode()) return getSandboxProfile();
  const f = fb(); const u = uid(); if (!f || !u) return null;
  const s = await getDoc(doc(f.db, 'profiles', u));
  return s.exists() ? ({ id: s.id, ...s.data() } as unknown as Profile) : null;
}
export async function updateMyProfile(patch: Partial<Profile>): Promise<void> {
  if (isSampleMode()) { setSandboxProfile(patch); return; }
  const f = fb(); const u = uid(); if (!f || !u) return;
  await setDoc(doc(f.db, 'profiles', u), patch, { merge: true });
}

// ---- people directory (org-scoped) ----
export async function listOrgPeople(): Promise<Profile[]> {
  if (isSampleMode()) return []; // never query/expose the real signed-in user's real org directory during a demo
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const me = await getMyProfile();
  const myOrgId = me?.org_id;
  if (!myOrgId) return [];
  const s = await getDocs(query(collection(f.db, 'profiles'), where('org_id', '==', myOrgId)));
  return rows<Profile>(s).filter((p) => p.id !== u);
}
export async function uploadProfilePhoto(file: File): Promise<string> {
  // Demo photo picks are local-only previews — never a real Storage upload
  // or a real profile write.
  if (isSampleMode()) return URL.createObjectURL(file);
  const f = fb(); const u = uid(); if (!f || !u) throw new Error('Not authenticated');
  const path = `profile_photos/${u}/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
  const r = storageRef(f.storage, path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);
  await setDoc(doc(f.db, 'profiles', u), { photo_url: url }, { merge: true });
  return url;
}

// ---- gardens (oversight) ----
export async function listGardens(): Promise<Garden[]> {
  if (isSampleMode()) return [];
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
  if (isSampleMode()) return [];
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
  if (isSampleMode()) return null;
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
  if (isSampleMode()) { addSandboxProduction(row); return; }
  const f = fb(); const u = uid(); if (!f || !u) return;
  const me = await getMyProfile();
  await addDoc(collection(f.db, 'production_logs'), { ...row, profile_id: u, org_id: me?.org_id ?? null, created_at: serverTimestamp() });
}
export async function addSale(row: Partial<SalesLog>): Promise<void> {
  if (isSampleMode()) { addSandboxSale(row); return; }
  const f = fb(); const u = uid(); if (!f || !u) return;
  const me = await getMyProfile();
  await addDoc(collection(f.db, 'sales_logs'), { ...row, profile_id: u, org_id: me?.org_id ?? null, created_at: serverTimestamp() });
}

/** Keep the crop-sale book in lockstep with one invoice's paid state. */
export async function syncInvoiceSales(invoice: SavedInvoice): Promise<void> {
  const drafts = invoiceSalesForPaidInvoice(invoice);
  if (isSampleMode()) {
    getSandboxSales()
      .filter((sale) => sale.invoice_id === invoice.id)
      .forEach((sale) => deleteSandboxSale(sale.id));
    drafts.forEach((draft) => addSandboxSale({
      ...draft,
      id: invoiceSaleDocumentId('demo', invoice.id, draft.invoice_line ?? 0),
    }));
    return;
  }
  const f = fb(); const u = uid();
  if (!f || !u) throw new Error('Sign in before marking an invoice paid');
  const existing = await getDocs(query(
    collection(f.db, 'sales_logs'),
    where('profile_id', '==', u),
    where('invoice_id', '==', invoice.id),
  ));
  const me = await getMyProfile();
  const batch = writeBatch(f.db);
  const desiredIds = new Set(drafts.map((draft) => (
    invoiceSaleDocumentId(u, invoice.id, draft.invoice_line ?? 0)
  )));
  existing.docs.forEach((row) => {
    if (!desiredIds.has(row.id)) batch.delete(row.ref);
  });
  drafts.forEach((draft) => {
    const id = invoiceSaleDocumentId(u, invoice.id, draft.invoice_line ?? 0);
    batch.set(doc(f.db, 'sales_logs', id), {
      ...draft,
      profile_id: u,
      org_id: me?.org_id ?? null,
      garden_id: null,
      created_at: serverTimestamp(),
    });
  });
  await batch.commit();
}
export async function updateSale(id: string, patch: Partial<SalesLog>): Promise<void> {
  if (isSampleMode()) { updateSandboxSale(id, patch); return; }
  const f = fb(); if (!f) return;
  await updateDoc(doc(f.db, 'sales_logs', id), { ...patch });
}
export async function myProduction(): Promise<ProductionLog[]> {
  if (isSampleMode()) return getSandboxProduction();
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'production_logs'), where('profile_id', '==', u), orderBy('created_at', 'desc')));
  return rows<ProductionLog>(s);
}

// ---- designs (incl. supervisor → farmer share) ----
// Cloud design save/share isn't sandboxed (no demo evaluator needs their
// scribbles to persist or actually reach a real farmer) — sample mode just
// no-ops every writer here and fakes a harmless success so the UI doesn't
// show an error, while every real Firestore write is skipped entirely.
export async function saveDesign(d: Partial<Design>): Promise<string | null> {
  if (isSampleMode()) return `demo-design-${Date.now()}`;
  const f = fb(); const u = uid(); if (!f || !u) return null;
  const r = await addDoc(collection(f.db, 'designs'), { ...d, owner_id: u, created_at: serverTimestamp(), updated_at: serverTimestamp() });
  return r.id;
}
export async function updateDesign(id: string, patch: Partial<Design>): Promise<boolean> {
  if (isSampleMode()) return true;
  const f = fb(); if (!f) return false;
  try {
    await updateDoc(doc(f.db, 'designs', id), { ...patch, updated_at: serverTimestamp() });
    return true;
  } catch {
    return false;
  }
}
export async function myDesigns(): Promise<Design[]> {
  if (isSampleMode()) return []; // never list the real signed-in facilitator's real cloud designs during a demo
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'designs'), where('owner_id', '==', u)));
  return rows<Design>(s).sort((a, b) => {
    const t = (d: Design) => (d as { updated_at?: { toMillis?: () => number }; created_at?: { toMillis?: () => number } });
    const ta = t(a).updated_at?.toMillis?.() ?? t(a).created_at?.toMillis?.() ?? 0;
    const tb = t(b).updated_at?.toMillis?.() ?? t(b).created_at?.toMillis?.() ?? 0;
    return tb - ta;
  });
}
export async function deleteDesign(id: string): Promise<boolean> {
  if (isSampleMode()) return true;
  const f = fb(); if (!f) return false;
  try {
    await deleteDoc(doc(f.db, 'designs', id));
    return true;
  } catch {
    return false;
  }
}
export async function shareDesign(designId: string, farmerProfileId: string): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); if (!f) return;
  await updateDoc(doc(f.db, 'designs', designId), { shared_with: farmerProfileId });
}
export async function designsSharedWithMe(): Promise<Design[]> {
  if (isSampleMode()) return []; // never surface the real signed-in user's real shared designs during a demo
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'designs'), where('shared_with', '==', u)));
  return rows<Design>(s);
}

// ---- reports ----
export async function saveReport(r: Partial<Report>): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  await addDoc(collection(f.db, 'reports'), { ...r, owner_id: u, created_at: serverTimestamp() });
}

// Saved-places DB helpers removed 2026-07: they wrote to a Firestore
// 'saved_places' collection that nothing ever read — the live map persists
// saved places in localStorage ('permamap_saved_places' via lib/saved-places.ts).
// The orphaned writers had misled the emulator seed into a dead path.

// ---- photo upload ----
export async function uploadPhoto(file: File, folder = 'produce'): Promise<string | null> {
  // Demo photo picks are local-only previews — never a real Storage upload.
  if (isSampleMode()) return URL.createObjectURL(file);
  const f = fb(); const u = uid(); if (!f || !u) return null;
  const path = `photos/${folder}/${u}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
  const r = storageRef(f.storage, path);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

// ---- sales ----
export async function mySales(): Promise<SalesLog[]> {
  if (isSampleMode()) return getSandboxSales();
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'sales_logs'), where('profile_id', '==', u), orderBy('created_at', 'desc')));
  return rows<SalesLog>(s);
}

// ---- expenses (costs) ----
export async function addExpense(row: Partial<ExpenseLog>): Promise<void> {
  if (isSampleMode()) { addSandboxExpense(row); return; }
  const f = fb(); const u = uid(); if (!f || !u) return;
  const me = await getMyProfile();
  await addDoc(collection(f.db, 'expense_logs'), { ...row, profile_id: u, org_id: me?.org_id ?? null, created_at: serverTimestamp() });
}
export async function updateExpense(id: string, patch: Partial<ExpenseLog>): Promise<void> {
  if (isSampleMode()) { updateSandboxExpense(id, patch); return; }
  const f = fb(); if (!f) return;
  await updateDoc(doc(f.db, 'expense_logs', id), { ...patch });
}
export async function myExpenses(): Promise<ExpenseLog[]> {
  if (isSampleMode()) return getSandboxExpenses();
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'expense_logs'), where('profile_id', '==', u), orderBy('created_at', 'desc')));
  return rows<ExpenseLog>(s);
}

// ---- delete records ----
export async function deleteProduction(id: string): Promise<void> {
  if (isSampleMode()) { deleteSandboxProduction(id); return; }
  const f = fb(); if (!f) return;
  await deleteDoc(doc(f.db, 'production_logs', id));
}
export async function deleteSale(id: string): Promise<void> {
  if (isSampleMode()) { deleteSandboxSale(id); return; }
  const f = fb(); if (!f) return;
  await deleteDoc(doc(f.db, 'sales_logs', id));
}
export async function deleteExpense(id: string): Promise<void> {
  if (isSampleMode()) { deleteSandboxExpense(id); return; }
  const f = fb(); if (!f) return;
  await deleteDoc(doc(f.db, 'expense_logs', id));
}

// ---- course progress ----
export async function myCourseProgress(): Promise<CourseProgress[]> {
  if (isSampleMode()) return [];
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'course_progress'), where('profile_id', '==', u)));
  return rows<CourseProgress>(s);
}
export async function getCourseProgress(profileId: string): Promise<CourseProgress[]> {
  if (isSampleMode()) return [];
  const f = fb(); if (!f) return [];
  const s = await getDocs(query(collection(f.db, 'course_progress'), where('profile_id', '==', profileId)));
  return rows<CourseProgress>(s);
}
export async function setCourseProgress(module: string, done: boolean): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  // Deterministic doc ID enables upsert without extra reads
  await setDoc(doc(f.db, 'course_progress', `${u}_${module}`), {
    profile_id: u, module, done, updated_at: serverTimestamp(),
  });
}

// ---- mentor visits (farm visits + course sign-off) ----
export async function logMentorVisit(v: { trainee_id: string; garden_id?: string | null; notes: string; visited_at: string }): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  await addDoc(collection(f.db, 'mentor_visits'), { ...v, mentor_id: u, created_at: serverTimestamp() });
}
export async function myMentorVisits(traineeId: string): Promise<MentorVisit[]> {
  if (isSampleMode()) return [];
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(
    collection(f.db, 'mentor_visits'),
    where('mentor_id', '==', u),
    where('trainee_id', '==', traineeId),
    orderBy('created_at', 'desc'),
  ));
  return rows<MentorVisit>(s);
}

// ---- surveys (NGO asks, farmers answer) ----
export async function createSurvey(s: { org_name: string; title: string; questions: SurveyQuestion[] }): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  const me = await getMyProfile();
  await addDoc(collection(f.db, 'surveys'), { ...s, org_id: me?.org_id ?? null, created_by: u, created_at: serverTimestamp() });
}
export async function listSurveys(): Promise<Survey[]> {
  if (isSampleMode()) return [];
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const me = await getMyProfile();
  if (!me?.org_id) return [];
  const s = await getDocs(query(collection(f.db, 'surveys'), where('org_id', '==', me.org_id)));
  return rows<Survey>(s).sort((a, b) => {
    const ta = (a as { created_at?: { toMillis?: () => number } }).created_at?.toMillis?.() ?? 0;
    const tb = (b as { created_at?: { toMillis?: () => number } }).created_at?.toMillis?.() ?? 0;
    return tb - ta;
  });
}
export async function addSurveyResponse(survey_id: string, answers: Record<string, string>): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  await addDoc(collection(f.db, 'survey_responses'), { survey_id, answers, profile_id: u, created_at: serverTimestamp() });
}
export async function listSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
  if (isSampleMode()) return [];
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'survey_responses'), where('survey_id', '==', surveyId)));
  return rows<SurveyResponse>(s);
}
export async function myRespondedSurveyIds(): Promise<string[]> {
  if (isSampleMode()) return [];
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'survey_responses'), where('profile_id', '==', u)));
  return rows<SurveyResponse>(s).map((r) => r.survey_id);
}

// ---- farmer / trainee directory ----
export async function listFarmers(): Promise<Profile[]> {
  if (isSampleMode()) return []; // never expose the real signed-in NGO/mentor's real farmer directory during a demo
  const f = fb(); if (!f) return [];
  const me = await getMyProfile();
  const myOrgId = me?.org_id;
  if (!myOrgId) return [];
  const s = await getDocs(query(collection(f.db, 'profiles'), where('role', '==', 'farmer'), where('org_id', '==', myOrgId)));
  return rows<Profile>(s);
}
export async function listTrainees(): Promise<Profile[]> {
  if (isSampleMode()) return [];
  const f = fb(); if (!f) return [];
  // Returns farmers + students — the people a trainer works with
  const me = await getMyProfile();
  const myOrgId = me?.org_id;
  if (!myOrgId) return [];
  const [farmers, students] = await Promise.all([
    getDocs(query(collection(f.db, 'profiles'), where('role', '==', 'farmer'), where('org_id', '==', myOrgId))),
    getDocs(query(collection(f.db, 'profiles'), where('role', '==', 'student'), where('org_id', '==', myOrgId))),
  ]);
  return [...rows<Profile>(farmers), ...rows<Profile>(students)];
}

// ---- course enrollment + assignments ----
// Domain logic and types live in lib/course-enrollment.ts and lib/course-assignments.ts
// (both pure and unit-tested); this section is only the Firestore edge, matching the
// pattern used by every other collection above. Sample mode never touches either
// collection: a demo session must not enrol, assign to, or read a real learner.

export async function myEnrollment(track: string = DEFAULT_TRACK): Promise<CourseEnrollment | null> {
  if (isSampleMode()) return null;
  const f = fb(); const u = uid(); if (!f || !u) return null;
  const s = await getDoc(doc(f.db, 'course_enrollments', enrollmentDocId(u, track)));
  return s.exists() ? ({ id: s.id, ...s.data() } as unknown as CourseEnrollment) : null;
}

/** Every enrollment in the caller's org. Rules require the org_id filter — a bare query
 *  is denied, not silently empty (same constraint as listGardens). */
export async function listOrgEnrollments(): Promise<CourseEnrollment[]> {
  if (isSampleMode()) return [];
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const me = await getMyProfile();
  if (!me?.org_id) return [];
  const s = await getDocs(query(collection(f.db, 'course_enrollments'), where('org_id', '==', me.org_id)));
  return rows<CourseEnrollment>(s);
}

/** Enrol a learner. Upsert on a deterministic id, so pressing Enrol twice is harmless.
 *  `enrolled_by`/`org_id` are stamped from the caller, never accepted from the UI. */
export async function enrolLearner(profileId: string, opts?: { cohort?: string | null; track?: string }): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  const me = await getMyProfile();
  const track = opts?.track ?? DEFAULT_TRACK;
  const row = newEnrollment({
    profile_id: profileId,
    enrolled_by: u,
    org_id: me?.org_id ?? null,
    cohort: opts?.cohort ?? null,
    track,
    enrolled_at: new Date().toISOString(),
  });
  const { id: _id, ...data } = row;
  await setDoc(doc(f.db, 'course_enrollments', row.id), { ...data, updated_at: serverTimestamp() }, { merge: true });
}

/** Only 'paused' and 'withdrawn' are stored — the other statuses are derived from progress
 *  by effectiveStatus(), so writing them here would let the stored value drift. */
export async function setEnrollmentStatus(
  profileId: string,
  status: 'paused' | 'withdrawn' | 'active',
  track: string = DEFAULT_TRACK,
): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  await setDoc(
    doc(f.db, 'course_enrollments', enrollmentDocId(profileId, track)),
    { status, updated_at: serverTimestamp() },
    { merge: true },
  );
}

export async function myAssignments(): Promise<CourseAssignment[]> {
  if (isSampleMode()) return [];
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'course_assignments'), where('profile_id', '==', u)));
  return rows<CourseAssignment>(s);
}

export async function getAssignments(profileId: string): Promise<CourseAssignment[]> {
  if (isSampleMode()) return [];
  const f = fb(); if (!f) return [];
  const s = await getDocs(query(collection(f.db, 'course_assignments'), where('profile_id', '==', profileId)));
  return rows<CourseAssignment>(s);
}

/** Assign (or re-assign, which just moves the due date) one module to one learner. */
export async function assignModule(input: {
  profile_id: string; module: string; due_at?: string | null; note?: string | null;
}): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  const me = await getMyProfile();
  await setDoc(doc(f.db, 'course_assignments', assignmentDocId(input.profile_id, input.module)), {
    profile_id: input.profile_id,
    module: input.module,
    assigned_by: u,
    org_id: me?.org_id ?? null,
    due_at: input.due_at ?? null,
    note: input.note ?? null,
    assigned_at: new Date().toISOString(),
    updated_at: serverTimestamp(),
  });
}

export async function unassignModule(profileId: string, module: string): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); if (!f) return;
  await deleteDoc(doc(f.db, 'course_assignments', assignmentDocId(profileId, module)));
}

// ---- course submissions (assignment evidence: photo + self-check, optional voice) ----
// Firestore/Storage edge only — shape and doc id live in lib/course-gating.ts alongside the
// gating logic that reads them (CourseSubmission, courseSubmissionDocId), same split as
// course_enrollments/course_assignments above. Sample mode never touches this collection or
// Storage folder: a demo session must not write real submission evidence.

export async function myCourseSubmissions(): Promise<CourseSubmission[]> {
  if (isSampleMode()) return [];
  const f = fb(); const u = uid(); if (!f || !u) return [];
  const s = await getDocs(query(collection(f.db, 'course_submissions'), where('profile_id', '==', u)));
  return rows<CourseSubmission>(s);
}

/** For a mentor/staff view of one learner's evidence — read parity with getCourseProgress. */
export async function getCourseSubmissions(profileId: string): Promise<CourseSubmission[]> {
  if (isSampleMode()) return [];
  const f = fb(); if (!f) return [];
  const s = await getDocs(query(collection(f.db, 'course_submissions'), where('profile_id', '==', profileId)));
  return rows<CourseSubmission>(s);
}

/**
 * Uploads ONE evidence file to a fixed path — course_submissions/{uid}/{module}/photo.jpg or
 * .../voice.m4a. Resubmitting a module overwrites the previous file rather than accumulating one
 * per attempt. Returns the STORAGE PATH, not a download URL — see the comment on
 * CourseSubmission.photo_path in lib/course-gating.ts for why that matters here specifically.
 */
export async function uploadCourseSubmissionFile(module: string, file: File, kind: 'photo' | 'voice'): Promise<string | null> {
  if (isSampleMode()) return null; // demo submissions never touch real storage
  const f = fb(); const u = uid(); if (!f || !u) return null;
  const path = `course_submissions/${u}/${module}/${kind === 'photo' ? 'photo.jpg' : 'voice.m4a'}`;
  const r = storageRef(f.storage, path);
  await uploadBytes(r, file);
  return path;
}

/** Submit (or resubmit) one module's evidence. Deterministic doc id upserts, same pattern as
 *  setCourseProgress/assignModule. This is the ONLY write course_submissions needs — submitting
 *  unlocks the next module immediately (see lib/course-gating.ts), there is no separate
 *  mentor-approval step, so a farmer is never blocked on an offline mentor. */
export async function submitCourseModule(input: {
  module: string; self_check: string[]; photo_path: string | null; voice_path: string | null;
}): Promise<void> {
  if (isSampleMode()) return;
  const f = fb(); const u = uid(); if (!f || !u) return;
  await setDoc(doc(f.db, 'course_submissions', courseSubmissionDocId(u, input.module)), {
    profile_id: u,
    module: input.module,
    submitted_at: new Date().toISOString(),
    self_check: input.self_check,
    photo_path: input.photo_path,
    voice_path: input.voice_path,
    updated_at: serverTimestamp(),
  });
}
