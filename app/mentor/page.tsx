'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, CheckCircle, ChevronDown, ChevronUp, BookOpen, Send, Loader2, GraduationCap, Inbox, Home, UserPlus, X, CalendarClock, AlertTriangle, PauseCircle, PlayCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { canAccessRolePage } from '@/lib/role-access';
import {
  listTrainees, getCourseProgress, logMentorVisit,
  listOrgEnrollments, enrolLearner, setEnrollmentStatus,
  getAssignments, assignModule, unassignModule,
} from '@/lib/db/queries';
import { COURSE_MODULES, TOTAL_MODULES, CATEGORY_COLORS } from '@/lib/course-modules';
import type { Profile, CourseProgress, UserRole } from '@/lib/db/types';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import ContactInbox from '@/components/ContactInbox';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';
import {
  DEFAULT_TRACK, STATUS_LABEL, effectiveStatus, enrollmentDocId, summariseCohort,
  type CourseEnrollment, type EnrollmentStatus,
} from '@/lib/course-enrollment';
import {
  assignmentDocId, assignmentState, formatDue, toDateKey,
  type CourseAssignment,
} from '@/lib/course-assignments';

// ─── Sample data ─────────────────────────────────────────────────────────────

const SAMPLE: Profile[] = [
  { id: 's1', full_name: 'Nomvula Dlamini',  role: 'farmer',  org_id: null, language: 'zu', id_number: null, phone: '+27 71 234 5678', photo_url: null, created_at: '' },
  { id: 's2', full_name: 'Sipho Nkosi',       role: 'student', org_id: null, language: 'zu', id_number: null, phone: '+27 82 345 6789', photo_url: null, created_at: '' },
  { id: 's3', full_name: 'Thandi Mokoena',    role: 'farmer',  org_id: null, language: 'st', id_number: null, phone: '+27 63 456 7890', photo_url: null, created_at: '' },
  { id: 's4', full_name: 'Bongani Zulu',      role: 'student', org_id: null, language: 'zu', id_number: null, phone: null,             photo_url: null, created_at: '' },
];
const SAMPLE_DONE: Record<string, string[]> = {
  s1: COURSE_MODULES.slice(0, 6).map((m) => m.id),
  s2: COURSE_MODULES.slice(0, 3).map((m) => m.id),
  s3: COURSE_MODULES.map((m) => m.id),
  s4: COURSE_MODULES.slice(0, 1).map((m) => m.id),
};

const SAMPLE_ENROLLMENTS: CourseEnrollment[] = ['s1', 's2', 's3'].map((id) => ({
  id: enrollmentDocId(id),
  profile_id: id,
  track: DEFAULT_TRACK,
  cohort: 'Ubhejane 2026',
  status: 'invited',
  enrolled_by: 'sample-mentor',
  org_id: null,
  enrolled_at: '2026-03-02T08:00:00.000Z',
}));

const SAMPLE_ASSIGNMENTS: Record<string, CourseAssignment[]> = {
  s2: [
    { id: assignmentDocId('s2', COURSE_MODULES[3]?.id ?? 'm4'), profile_id: 's2', module: COURSE_MODULES[3]?.id ?? 'm4', assigned_by: 'sample-mentor', org_id: null, due_at: '2026-07-31', note: 'Before the next farm visit.', assigned_at: '2026-07-10T08:00:00.000Z' },
  ],
};

const STATUS_TONE: Record<EnrollmentStatus, { fg: string; bg: string }> = {
  invited:   { fg: '#8C7A62', bg: 'rgba(140,122,98,0.12)' },
  active:    { fg: '#C07A1E', bg: 'rgba(192,122,30,0.12)' },
  paused:    { fg: '#235E86', bg: 'rgba(35,94,134,0.12)' },
  completed: { fg: '#1F4D2B', bg: 'rgba(31,77,43,0.12)' },
  withdrawn: { fg: '#8C7A62', bg: 'rgba(140,122,98,0.12)' },
};

function initials(name: string | null) {
  return (name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : (value / max) * 100;
  const col = pct >= 100 ? '#1F4D2B' : pct >= 50 ? '#C07A1E' : '#235E86';
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(32,25,15,0.10)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 999, transition: 'width 0.4s' }} />
      </div>
      <span className="text-xs font-mono flex-shrink-0" style={{ color: '#8C7A62' }}>{value}/{max}</span>
    </div>
  );
}

interface TraineeCardProps {
  trainee: Profile;
  doneIds: Set<string>;
  isLive: boolean;
  enrollment: CourseEnrollment | null;
  assignments: CourseAssignment[];
  /** 'YYYY-MM-DD', or null before the client has resolved today's date. */
  today: string | null;
  busy: boolean;
  onEnrol: (profileId: string) => void;
  onSetStatus: (profileId: string, status: 'paused' | 'active') => void;
  onAssign: (profileId: string, module: string, due: string | null) => void;
  onUnassign: (profileId: string, module: string) => void;
}

function TraineeCard({
  trainee, doneIds, isLive, enrollment, assignments, today, busy,
  onEnrol, onSetStatus, onAssign, onUnassign,
}: TraineeCardProps) {
  const [open, setOpen] = useState(false);
  const [logging, setLogging] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const assignmentByModule = new Map(assignments.map((a) => [a.module, a] as const));
  // Stored status is only ever 'paused'/'withdrawn' by hand; everything else is derived from
  // what the learner has actually ticked, so the badge can never drift from the progress bar.
  const status: EnrollmentStatus | null = enrollment
    ? effectiveStatus(
        enrollment,
        [...doneIds].map((module) => ({ id: `${trainee.id}_${module}`, profile_id: trainee.id, module, done: true, updated_at: '' })),
        COURSE_MODULES.map((m) => m.id),
      )
    : null;

  async function handleLog() {
    if (!notes.trim()) return;
    setSaving(true);
    setSaveError(false);
    try {
      if (isLive) await logMentorVisit({ trainee_id: trainee.id, notes: notes.trim(), visited_at: new Date().toISOString() });
      setSaved(true);
      setNotes('');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { setSaved(false); setLogging(false); }, 2000);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div className="flex-shrink-0 flex items-center justify-center rounded-full font-display font-bold"
          style={{ width: 40, height: 40, fontSize: 15, background: 'linear-gradient(135deg,#1F4D2B,#2D6B3C)', color: '#EAF3E2' }}>
          {initials(trainee.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-display font-semibold truncate" style={{ color: '#20190F' }}>
              {trainee.full_name ?? 'Unnamed'}
            </span>
            {status ? (
              <span className="text-xs font-sans px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: STATUS_TONE[status].bg, color: STATUS_TONE[status].fg }}>
                {STATUS_LABEL[status]}
              </span>
            ) : (
              <span className="text-xs font-sans px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(32,25,15,0.06)', color: '#8C7A62' }}>
                Not enrolled
              </span>
            )}
          </div>
          {/* Counted against the current curriculum, not the raw rows: a learner with a stale
              course_progress row for a module since removed or renamed must not show a mentor
              "11/10" — the exact drift enrollmentProgress in lib/course-enrollment.ts already
              guards against for the status badge above; this bar was reading doneIds.size
              directly and skipping that guard. */}
          <ProgressBar value={COURSE_MODULES.filter((m) => doneIds.has(m.id)).length} max={TOTAL_MODULES} />
        </div>
        {open ? <ChevronUp size={15} style={{ color: '#8C7A62' }} /> : <ChevronDown size={15} style={{ color: '#8C7A62' }} />}
      </button>

      {open && (
        <div className="px-4 pb-4" style={{ borderTop: '1px solid #E2D8C4' }}>

          {/* Enrolment */}
          {!enrollment ? (
            <div className="pt-3">
              <p className="text-xs font-sans leading-relaxed mb-2" style={{ color: '#5C5040' }}>
                Not on the course yet. Enrolling lets you set modules and due dates for them.
              </p>
              <button onClick={() => onEnrol(trainee.id)} disabled={busy}
                className="flex items-center gap-2 text-xs font-display font-semibold px-3 py-2 rounded-xl"
                style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                Enrol on the course
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-3 flex-wrap">
              <span className="text-xs font-sans" style={{ color: '#8C7A62' }}>
                {enrollment.cohort ? `${enrollment.cohort} · ` : ''}enrolled {new Date(enrollment.enrolled_at).toLocaleDateString()}
              </span>
              <div className="flex-1" />
              <button
                onClick={() => onSetStatus(trainee.id, enrollment.status === 'paused' ? 'active' : 'paused')}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs font-display font-semibold px-2.5 py-1.5 rounded-xl"
                style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: busy ? 'wait' : 'pointer' }}>
                {enrollment.status === 'paused' ? <PlayCircle size={12} /> : <PauseCircle size={12} />}
                {enrollment.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
            </div>
          )}

          <div className="text-xs font-sans uppercase tracking-wider pt-3 pb-1" style={{ color: '#8C7A62' }}>
            {enrollment ? 'Modules — tick is theirs, due date is yours' : 'Module sign-off'}
          </div>

          {COURSE_MODULES.map((mod) => {
            const done = doneIds.has(mod.id);
            const assignment = assignmentByModule.get(mod.id);
            const state = assignment && today ? assignmentState(assignment, doneIds, today) : null;
            const dueText = assignment && today ? formatDue(assignment.due_at, today) : null;
            return (
              <div key={mod.id} className="py-1.5" style={{ borderBottom: '1px solid rgba(226,216,196,0.5)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex-shrink-0 flex items-center justify-center rounded-full"
                    style={{ width: 20, height: 20, background: done ? '#1F4D2B' : 'rgba(32,25,15,0.06)', border: `1px solid ${done ? '#1F4D2B' : '#E2D8C4'}` }}>
                    {done && <CheckCircle size={12} style={{ color: '#EAF3E2' }} />}
                  </div>
                  <span className="flex-1 text-xs font-display truncate" style={{ color: done ? '#8C7A62' : '#20190F', textDecoration: done ? 'line-through' : 'none' }}>
                    {mod.title}
                  </span>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: CATEGORY_COLORS[mod.category] + '15', color: CATEGORY_COLORS[mod.category] }}>
                    {mod.durationMins}m
                  </span>
                  {enrollment && (assignment ? (
                    <button onClick={() => onUnassign(trainee.id, mod.id)} disabled={busy}
                      aria-label={`Remove the ${mod.title} assignment`}
                      className="flex-shrink-0 flex items-center justify-center rounded-lg"
                      style={{ width: 26, height: 26, background: 'transparent', border: '1px solid #E2D8C4', color: '#8C7A62', cursor: busy ? 'wait' : 'pointer' }}>
                      <X size={12} />
                    </button>
                  ) : (
                    <button onClick={() => onAssign(trainee.id, mod.id, null)} disabled={busy}
                      className="flex-shrink-0 text-xs font-display font-semibold px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.2)', color: '#1F4D2B', cursor: busy ? 'wait' : 'pointer' }}>
                      Assign
                    </button>
                  ))}
                </div>

                {enrollment && assignment && (
                  <div className="flex items-center gap-2 pl-7 pt-1.5 flex-wrap">
                    <label className="text-xs font-sans" style={{ color: '#8C7A62' }} htmlFor={`due-${trainee.id}-${mod.id}`}>
                      Due
                    </label>
                    <input
                      id={`due-${trainee.id}-${mod.id}`}
                      type="date"
                      value={assignment.due_at ?? ''}
                      onChange={(e) => onAssign(trainee.id, mod.id, e.target.value || null)}
                      className="text-xs font-sans rounded-lg px-2 py-1 outline-none"
                      style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }}
                    />
                    {state && state !== 'done' && dueText && (
                      <span className="flex items-center gap-1 text-xs font-sans"
                        style={{ color: state === 'overdue' ? '#B03A2E' : state === 'due-soon' ? '#C07A1E' : '#8C7A62' }}>
                        {state === 'overdue' ? <AlertTriangle size={10} /> : <CalendarClock size={10} />}
                        {dueText}
                      </span>
                    )}
                    {state === 'done' && (
                      <span className="text-xs font-sans" style={{ color: '#1F4D2B' }}>Finished</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {trainee.phone && (
            <div className="mt-3 text-xs font-sans" style={{ color: '#5C5040' }}>{trainee.phone}</div>
          )}

          {!logging ? (
            <button onClick={() => setLogging(true)}
              className="mt-3 flex items-center gap-2 text-xs font-display font-semibold px-3 py-2 rounded-xl"
              style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.2)', color: '#1F4D2B', cursor: 'pointer' }}>
              <BookOpen size={13} />Log field visit
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="What was covered on this visit?"
                rows={3} className="w-full text-sm font-sans outline-none rounded-xl px-3 py-2.5 resize-none"
                style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
              <div className="flex gap-2">
                <button onClick={handleLog} disabled={saving || !notes.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-display font-semibold"
                  style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: (!notes.trim() || saving) ? 0.6 : 1 }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  {saved ? 'Saved!' : saving ? 'Saving...' : 'Save visit'}
                </button>
                <button onClick={() => { setLogging(false); setNotes(''); setSaveError(false); }}
                  className="px-3 py-2 rounded-xl text-xs font-display"
                  style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
              {saveError && (
                <p className="text-xs font-sans mt-1" style={{ color: '#B03A2E' }}>
                  Could not save — please check your connection and try again.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const MENTOR_ALLOWED_ROLES = new Set<UserRole>(['mentor', 'ngo', 'funder', 'admin']);

export default function MentorPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();

  const [view, setView] = useState<'trainees' | 'messages'>('trainees');
  const [msgUnread, setMsgUnread] = useState(0);
  const [trainees, setTrainees] = useState<Profile[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, CourseProgress[]>>({});
  const [enrollBy, setEnrollBy] = useState<Record<string, CourseEnrollment>>({});
  const [assignBy, setAssignBy] = useState<Record<string, CourseAssignment[]>>({});
  const [fetching, setFetching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [search, setSearch] = useState('');
  // Resolved after mount so server and client can't disagree about what "today" is.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => { setToday(toDateKey(new Date())); }, []);

  useEffect(() => {
    if (!loading && !user && isLive) router.replace('/login');
  }, [user, loading, router, isLive]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      if (isLive) {
        const [list, enrollments] = await Promise.all([
          listTrainees(),
          listOrgEnrollments().catch(() => [] as CourseEnrollment[]),
        ]);
        setTrainees(list);
        setEnrollBy(Object.fromEntries(enrollments.map((e) => [e.profile_id, e])));
        const progress: Record<string, CourseProgress[]> = {};
        const assigns: Record<string, CourseAssignment[]> = {};
        await Promise.all(list.map(async (t) => {
          const [p, a] = await Promise.all([
            getCourseProgress(t.id).catch(() => [] as CourseProgress[]),
            getAssignments(t.id).catch(() => [] as CourseAssignment[]),
          ]);
          progress[t.id] = p;
          assigns[t.id] = a;
        }));
        setProgressMap(progress);
        setAssignBy(assigns);
      } else {
        setTrainees(SAMPLE);
        setEnrollBy(Object.fromEntries(SAMPLE_ENROLLMENTS.map((e) => [e.profile_id, e])));
        setAssignBy(SAMPLE_ASSIGNMENTS);
      }
    } catch (err) {
      // Leave trainees empty (the spinner clears via finally), but do NOT swallow the reason.
      // A silent catch here is how a rules denial looked exactly like "this mentor has no
      // learners yet" — indistinguishable in the UI and invisible in the console.
      console.error('[mentor] could not load the cohort:', err);
      setSyncError(true);
    } finally {
      setFetching(false);
    }
  }, [isLive, user]);

  // Wait for auth to resolve before loading. Every query in load() is org-scoped, and the
  // org comes from the caller's own profile — run it while `currentUser` is still null and
  // each one returns an empty list with no error, which renders as "this mentor has no
  // learners" and never retries. Mirrors the guard the student page already had.
  useEffect(() => { if (!loading) load(); }, [loading, load]);

  // Every mutation below updates local state first so the control responds immediately on a
  // slow rural connection, then writes. On a failed write we re-read from the server rather
  // than leaving an optimistic value on screen that never actually saved.
  const afterWrite = useCallback(async (write: () => Promise<void>) => {
    setSyncError(false);
    try {
      await write();
    } catch {
      setSyncError(true);
      await load();
    }
  }, [load]);

  const handleEnrol = useCallback(async (profileId: string) => {
    setBusyId(profileId);
    const optimistic: CourseEnrollment = {
      id: enrollmentDocId(profileId),
      profile_id: profileId,
      track: DEFAULT_TRACK,
      cohort: null,
      status: 'invited',
      enrolled_by: user?.uid ?? 'me',
      org_id: null,
      enrolled_at: new Date().toISOString(),
    };
    setEnrollBy((prev) => ({ ...prev, [profileId]: optimistic }));
    if (isLive) await afterWrite(() => enrolLearner(profileId));
    setBusyId(null);
  }, [isLive, user, afterWrite]);

  const handleSetStatus = useCallback(async (profileId: string, status: 'paused' | 'active') => {
    setBusyId(profileId);
    setEnrollBy((prev) => {
      const cur = prev[profileId];
      return cur ? { ...prev, [profileId]: { ...cur, status } } : prev;
    });
    if (isLive) await afterWrite(() => setEnrollmentStatus(profileId, status));
    setBusyId(null);
  }, [isLive, afterWrite]);

  const handleAssign = useCallback(async (profileId: string, module: string, due: string | null) => {
    setBusyId(profileId);
    setAssignBy((prev) => {
      const list = prev[profileId] ?? [];
      const existing = list.find((a) => a.module === module);
      const next: CourseAssignment = existing
        ? { ...existing, due_at: due }
        : {
            id: assignmentDocId(profileId, module),
            profile_id: profileId,
            module,
            assigned_by: user?.uid ?? 'me',
            org_id: null,
            due_at: due,
            note: null,
            assigned_at: new Date().toISOString(),
          };
      return { ...prev, [profileId]: [...list.filter((a) => a.module !== module), next] };
    });
    if (isLive) await afterWrite(() => assignModule({ profile_id: profileId, module, due_at: due }));
    setBusyId(null);
  }, [isLive, user, afterWrite]);

  const handleUnassign = useCallback(async (profileId: string, module: string) => {
    setBusyId(profileId);
    setAssignBy((prev) => ({ ...prev, [profileId]: (prev[profileId] ?? []).filter((a) => a.module !== module) }));
    if (isLive) await afterWrite(() => unassignModule(profileId, module));
    setBusyId(null);
  }, [isLive, afterWrite]);

  if (!loading && user && isLive && !canAccessRolePage(role, MENTOR_ALLOWED_ROLES)) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
        <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
          <MenuButton />
          <BrandLogo />
          <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
          <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>Mentor</span>
          <div className="flex-1" />
          <SettingsButton />
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="rounded-2xl px-6 py-8 text-center max-w-xs" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <div className="mx-auto mb-3 flex items-center justify-center rounded-full" style={{ width: 48, height: 48, background: 'rgba(31,77,43,0.08)' }}>
              <Users size={22} style={{ color: '#1F4D2B' }} />
            </div>
            <p className="text-sm font-display font-semibold mb-1" style={{ color: '#20190F' }}>This is the Mentor area</p>
            <p className="text-xs font-sans leading-relaxed mb-5" style={{ color: '#8C7A62' }}>
              It&apos;s set up for mentors, NGOs and funders — not your role. Head back to your own home to keep going.
            </p>
            <button
              onClick={() => router.push('/home')}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-sans font-semibold text-sm transition-all"
              style={{ background: '#1F4D2B', color: '#F7F2E9' }}
            >
              <Home size={15} />
              Back to my home
            </button>
          </div>
        </main>
        <TabBar />
      </div>
    );
  }

  const filtered = trainees.filter((t) => !search || (t.full_name ?? '').toLowerCase().includes(search.toLowerCase()));

  function doneIdsFor(id: string): Set<string> {
    if (!isLive) return new Set(SAMPLE_DONE[id] ?? []);
    return new Set((progressMap[id] ?? []).filter((p) => p.done).map((p) => p.module));
  }

  // Cohort figures describe the people actually ON the course. The list below stays the full
  // org directory, so someone not yet enrolled is still reachable — they just don't count here.
  const moduleIds = COURSE_MODULES.map((m) => m.id);
  const cohort = summariseCohort(
    Object.values(enrollBy).filter((e) => trainees.some((t) => t.id === e.profile_id)),
    Object.fromEntries(trainees.map((t) => [
      t.id,
      [...doneIdsFor(t.id)].map((module) => ({ id: `${t.id}_${module}`, profile_id: t.id, module, done: true, updated_at: '' })),
    ])),
    moduleIds,
  );

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <MenuButton />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>Mentor</span>
        <div className="flex-1" />
        <LessonLink id="mentor:overview" label="Learn" />
        <SettingsButton />
      </header>

      {/* Tab strip */}
      <div className="flex-shrink-0 flex" style={{ background: '#FFFEFA', borderBottom: '1px solid #E2D8C4', paddingLeft: 16, paddingRight: 16, gap: 0 }}>
        {([
          { key: 'trainees', label: 'Trainees', icon: Users,  badge: 0 },
          { key: 'messages', label: 'Messages', icon: Inbox, badge: msgUnread },
        ] as const).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className="flex items-center gap-1.5 py-2.5 px-3 font-display text-xs font-semibold relative"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: view === key ? '#1F4D2B' : '#8C7A62',
              borderBottom: view === key ? '2px solid #1F4D2B' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            <Icon size={13} />
            {label}
            {badge != null && badge > 0 && (
              <span className="flex items-center justify-center rounded-full font-mono"
                style={{ minWidth: 16, height: 16, fontSize: 9, padding: '0 4px', background: '#1F4D2B', color: '#F7F2E9' }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 80 }}>

        {view === 'messages' ? (
          <ContactInbox recipient="mentor" onUnreadCount={setMsgUnread} />
        ) : (<>

        {/* Cohort at a glance */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Enrolled',    value: cohort.enrolled,   color: '#235E86' },
            { label: 'In progress', value: cohort.inProgress, color: '#C07A1E' },
            { label: 'Complete',    value: cohort.completed,  color: '#1F4D2B' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-3 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
              <div className="font-display font-bold text-2xl leading-tight" style={{ color }}>{value}</div>
              <div className="text-xs font-mono mt-0.5" style={{ color: '#8C7A62' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Curriculum chip cloud */}
        <div className="rounded-2xl px-4 py-3.5" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
          <div className="flex items-center gap-2 mb-2.5">
            <GraduationCap size={14} style={{ color: '#1F4D2B' }} />
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#8C7A62' }}>
              Curriculum · {TOTAL_MODULES} modules
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COURSE_MODULES.map((m) => (
              <span key={m.id} className="text-xs font-sans px-2 py-0.5 rounded-full"
                style={{ background: CATEGORY_COLORS[m.category] + '15', color: CATEGORY_COLORS[m.category], border: `1px solid ${CATEGORY_COLORS[m.category]}30` }}>
                {m.title}
              </span>
            ))}
          </div>
        </div>

        {syncError && (
          <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(176,58,46,0.08)', border: '1px solid rgba(176,58,46,0.28)' }}>
            <p className="text-xs font-sans leading-relaxed" style={{ color: '#B03A2E' }}>
              That change did not save. The list has been reloaded from the server, so what you
              see now is what is actually stored — please try again.
            </p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8C7A62' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search learners..."
            className="w-full font-sans rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#20190F' }} />
        </div>

        {/* List */}
        {fetching ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin" style={{ color: '#1F4D2B' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <Users size={28} style={{ color: '#8C7A62', margin: '0 auto 8px' }} />
            <p className="text-sm font-display" style={{ color: '#5C5040' }}>
              {search ? 'No learners match that search.' : 'Learners will appear here once they enrol.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <TraineeCard
                key={t.id}
                trainee={t}
                doneIds={doneIdsFor(t.id)}
                isLive={isLive}
                enrollment={enrollBy[t.id] ?? null}
                assignments={assignBy[t.id] ?? []}
                today={today}
                busy={busyId === t.id}
                onEnrol={handleEnrol}
                onSetStatus={handleSetStatus}
                onAssign={handleAssign}
                onUnassign={handleUnassign}
              />
            ))}
          </div>
        )}

        {!isLive && (
          <p className="text-center text-xs font-mono" style={{ color: '#8C7A62' }}>
            Sample data — connect Firebase to see live learners
          </p>
        )}
        </>)}
      </main>
      <TabBar />
    </div>
  );
}
