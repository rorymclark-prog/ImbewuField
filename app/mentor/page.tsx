'use client';

import { samplePortrait } from '@/lib/sample-media';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, CheckCircle, ChevronDown, ChevronUp, BookOpen, Loader2, GraduationCap, Inbox, Home, UserPlus, X, CalendarClock, AlertTriangle, PauseCircle, PlayCircle } from 'lucide-react';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { useLanguage } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth';
import { useSampleRole } from '@/lib/use-role-navigation';
import { getFirebase, isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { canAccessRolePage } from '@/lib/role-access';
import {
  listTrainees, getCourseProgressForProfiles,
  listOrgEnrollments, enrolLearner, setEnrollmentStatus,
  getAssignmentsForProfiles, assignModule, unassignModule,
} from '@/lib/db/queries';
import { COURSE_MODULES, TOTAL_MODULES, CATEGORY_COLORS } from '@/lib/course-modules';
import type { Profile, CourseProgress, UserRole } from '@/lib/db/types';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import { sampleRead, sampleWrite } from '@/lib/sample-operations';
import { freshFieldWorkspace } from '@/lib/field-teams';
import ProgrammeEvidence from '@/components/ProgrammeEvidence';
import FieldTeams from '@/components/FieldTeams';
import ProfileAvatar from '@/components/ProfileAvatar';
import RoleSwitcher from '@/components/RoleSwitcher';
import DashboardTabs from '@/components/DashboardTabs';
import ContactInbox from '@/components/ContactInbox';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';
import {
  DEFAULT_TRACK, STATUS_LABEL, effectiveStatus, enrollmentDocId, summariseCohort,
  type CourseEnrollment, type EnrollmentStatus,
} from '@/lib/course-enrollment';
import {
  assignmentDocId, assignmentState, daysBetween, formatDue, toDateKey,
  type CourseAssignment,
} from '@/lib/course-assignments';

const tr = (lang: string, en: string, zu: string) => lang === 'zu' ? zu : en;
const MENTOR_STATUS_ZU: Record<EnrollmentStatus, string> = {
  invited: 'Umenyiwe', active: 'Usayaqhubeka', paused: 'Kumisiwe', completed: 'Kuqediwe', withdrawn: 'Uhoxile',
};

function localizedDueDate(dueAt: string | null, today: string, lang: string): string | null {
  if (lang !== 'zu') return formatDue(dueAt, today);
  if (!dueAt) return null;
  const days = daysBetween(today, dueAt);
  if (days === null) return null;
  if (days === 0) return 'Namuhla';
  if (days === 1) return 'Kusasa';
  if (days === -1) return 'Sekudlule usuku olu-1';
  if (days < 0) return `Sekudlule izinsuku ezingu-${Math.abs(days)}`;
  if (days <= 7) return `Kusele izinsuku ezingu-${days}`;
  return new Date(`${dueAt}T00:00:00`).toLocaleDateString('zu-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const SAMPLE: Profile[] = [
  { id: 's1', full_name: 'Nomvula Dlamini',  role: 'farmer',  org_id: null, language: 'zu', id_number: null, phone: null, photo_url: null, created_at: '' },
  { id: 's2', full_name: 'Sipho Nkosi',       role: 'student', org_id: null, language: 'zu', id_number: null, phone: null, photo_url: null, created_at: '' },
  { id: 's3', full_name: 'Thandi Mokoena',    role: 'farmer',  org_id: null, language: 'st', id_number: null, phone: null, photo_url: null, created_at: '' },
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
  invited:   { fg: '#755942', bg: 'rgba(140,122,98,0.12)' },
  active:    { fg: '#805416', bg: 'rgba(192,122,30,0.12)' },
  paused:    { fg: '#235E86', bg: 'rgba(35,94,134,0.12)' },
  completed: { fg: '#1F4D2B', bg: 'rgba(31,77,43,0.12)' },
  withdrawn: { fg: '#755942', bg: 'rgba(140,122,98,0.12)' },
};

function initials(name: string | null) {
  return (name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : (value / max) * 100;
  const col = pct >= 100 ? '#1F4D2B' : pct >= 50 ? '#805416' : '#235E86';
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(32,25,15,0.10)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 999, transition: 'width 0.4s' }} />
      </div>
      <span className="text-xs font-mono flex-shrink-0" style={{ color: '#755942' }}>{value}/{max}</span>
    </div>
  );
}

interface TraineeCardProps {
  lang: string;
  trainee: Profile;
  doneIds: Set<string>;
  onVisit?: (profileId:string)=>void;
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
  trainee, doneIds, onVisit, enrollment, assignments, today, busy, lang,
  onEnrol, onSetStatus, onAssign, onUnassign,
}: TraineeCardProps) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <ProfileAvatar id={trainee.id} name={trainee.full_name || tr(lang, 'Unnamed', 'Akanagama')} photoUrl={trainee.photo_url} sample={isSampleMode()} size={44}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-display font-semibold truncate" style={{ color: '#20190F' }}>
              {trainee.full_name ?? tr(lang, 'Unnamed', 'Akanagama')}
            </span>
            {status ? (
              <span className="text-xs font-sans px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: STATUS_TONE[status].bg, color: STATUS_TONE[status].fg }}>
                {lang === 'zu' ? MENTOR_STATUS_ZU[status] : STATUS_LABEL[status]}
              </span>
            ) : (
              <span className="text-xs font-sans px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(32,25,15,0.06)', color: '#755942' }}>
                {tr(lang, 'Not enrolled', 'Akabhaliswanga')}
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
        {open ? <ChevronUp size={15} style={{ color: '#755942' }} /> : <ChevronDown size={15} style={{ color: '#755942' }} />}
      </button>

      {open && (
        <div className="px-4 pb-4" style={{ borderTop: '1px solid #E2D8C4' }}>

          {/* Enrolment */}
          {!enrollment ? (
            <div className="pt-3">
              <p className="text-xs font-sans leading-relaxed mb-2" style={{ color: '#5C5040' }}>
                {tr(lang, 'Not on the course yet. Enrolling lets you set modules and due dates for them.', 'Akakabhaliswa esifundweni. Ukumbhalisa kukuvumela ukuba umnike amamojula nezinsuku zokuwaqeda.')}
              </p>
              <button onClick={() => onEnrol(trainee.id)} disabled={busy}
                className="flex items-center gap-2 text-xs font-display font-semibold px-3 py-2 rounded-xl"
                style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                {tr(lang, 'Enrol on the course', 'Mbhalise esifundweni')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-3 flex-wrap">
              <span className="text-xs font-sans" style={{ color: '#755942' }}>
                {enrollment.cohort ? `${enrollment.cohort} · ` : ''}{tr(lang, 'enrolled', 'wabhaliswa')} {lang === 'zu' ? new Date(enrollment.enrolled_at).toLocaleDateString('zu-ZA') : new Date(enrollment.enrolled_at).toLocaleDateString()}
              </span>
              <div className="flex-1" />
              <button
                onClick={() => onSetStatus(trainee.id, enrollment.status === 'paused' ? 'active' : 'paused')}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs font-display font-semibold px-2.5 py-1.5 rounded-xl"
                style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: busy ? 'wait' : 'pointer' }}>
                {enrollment.status === 'paused' ? <PlayCircle size={12} /> : <PauseCircle size={12} />}
                {enrollment.status === 'paused' ? tr(lang, 'Resume', 'Qhubeka') : tr(lang, 'Pause', 'Misa')}
              </button>
            </div>
          )}

          <div className="text-xs font-sans uppercase tracking-wider pt-3 pb-1" style={{ color: '#755942' }}>
            {enrollment ? tr(lang, 'Modules — tick is theirs, due date is yours', 'Amamojula — umfundi uyazimaka, wena ubeka usuku lokuqeda') : tr(lang, 'Module sign-off', 'Ukuqinisekisa imojula')}
          </div>

          {COURSE_MODULES.map((mod) => {
            const done = doneIds.has(mod.id);
            const assignment = assignmentByModule.get(mod.id);
            const state = assignment && today ? assignmentState(assignment, doneIds, today) : null;
            const dueText = assignment && today ? localizedDueDate(assignment.due_at, today, lang) : null;
            return (
              <div key={mod.id} className="py-1.5" style={{ borderBottom: '1px solid rgba(226,216,196,0.5)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex-shrink-0 flex items-center justify-center rounded-full"
                    style={{ width: 20, height: 20, background: done ? '#1F4D2B' : 'rgba(32,25,15,0.06)', border: `1px solid ${done ? '#1F4D2B' : '#E2D8C4'}` }}>
                    {done && <CheckCircle size={12} style={{ color: '#EAF3E2' }} />}
                  </div>
                  <span className="flex-1 text-xs font-display truncate" style={{ color: done ? '#755942' : '#20190F', textDecoration: done ? 'line-through' : 'none' }}>
                    {mod.title}
                  </span>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: CATEGORY_COLORS[mod.category] + '15', color: CATEGORY_COLORS[mod.category] }}>
                    {mod.durationMins}m
                  </span>
                  {enrollment && (assignment ? (
                    <button onClick={() => onUnassign(trainee.id, mod.id)} disabled={busy}
                      aria-label={tr(lang, `Remove the ${mod.title} assignment`, `Susa isabelo se-${mod.title}`)}
                      className="flex-shrink-0 flex items-center justify-center rounded-lg"
                      style={{ width: 26, height: 26, background: 'transparent', border: '1px solid #E2D8C4', color: '#755942', cursor: busy ? 'wait' : 'pointer' }}>
                      <X size={12} />
                    </button>
                  ) : (
                    <button onClick={() => onAssign(trainee.id, mod.id, null)} disabled={busy}
                      className="flex-shrink-0 text-xs font-display font-semibold px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.2)', color: '#1F4D2B', cursor: busy ? 'wait' : 'pointer' }}>
                      {tr(lang, 'Assign', 'Yabela')}
                    </button>
                  ))}
                </div>

                {enrollment && assignment && (
                  <div className="flex items-center gap-2 pl-7 pt-1.5 flex-wrap">
                    <label className="text-xs font-sans" style={{ color: '#755942' }} htmlFor={`due-${trainee.id}-${mod.id}`}>
                      {tr(lang, 'Due', 'Usuku lokuqeda')}
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
                        style={{ color: state === 'overdue' ? '#B03A2E' : state === 'due-soon' ? '#805416' : '#755942' }}>
                        {state === 'overdue' ? <AlertTriangle size={10} /> : <CalendarClock size={10} />}
                        {dueText}
                      </span>
                    )}
                    {state === 'done' && (
                      <span className="text-xs font-sans" style={{ color: '#1F4D2B' }}>{tr(lang, 'Finished', 'Kuqediwe')}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {trainee.phone && (
            <div className="mt-3 text-xs font-sans" style={{ color: '#5C5040' }}>{trainee.phone}</div>
          )}

          {onVisit&&<button onClick={()=>onVisit(trainee.id)} className="mt-3 flex items-center gap-2 text-sm font-display font-semibold px-3 py-3 rounded-xl" style={{background:'#e9f1e9',color:'#1F4D2B',minHeight:44}}><BookOpen size={15}/>{tr(lang, 'Record field visit', 'Rekhoda ukuvakashela epulazini')}</button>}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const MENTOR_ALLOWED_ROLES = new Set<UserRole>(['mentor', 'ngo', 'admin']);

export default function MentorPage() {
  const { lang } = useLanguage();
  const { user, profile, role, loading } = useAuth();
  const router = useRouter();
  const sampleRole = useSampleRole();
  const isLive = isBackendConfigured() && !sampleRole;
  const [sample, setSample] = useState(false);
  useEffect(() => { setSample(isSampleMode()); }, []);

  const [view, setView] = useState<'field' | 'trainees' | 'messages' | 'evidence'>('field');
  const [visitPerson,setVisitPerson]=useState('');
  const loadVersion=useRef(0);
  const accountScope=useRef('');
  accountScope.current=[user?.uid??'',profile?.org_id??'',role??'',isLive?'live':'tour'].join('|');
  const [loadError,setLoadError]=useState(false);
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
    // Sample mode has no user by design; bouncing it to /login would make the
    // mentor demo unreachable on production, where a backend is always configured.
    if (!loading && !user && isLive && !isSampleMode()) router.replace('/login');
  }, [user, loading, router, isLive]);

  const load = useCallback(async () => {
    const version=++loadVersion.current,actor=user?.uid,scope=accountScope.current;
    const active=()=>scope===accountScope.current && version===loadVersion.current && (!isLive || !!actor && getFirebase()?.auth.currentUser?.uid===actor);
    if(isLive && (!actor || !canAccessRolePage(role,MENTOR_ALLOWED_ROLES)))return;
    setFetching(true);setLoadError(false);
    try {
      if (isLive) {
        const [list, enrollments] = await Promise.all([
          listTrainees(),
          listOrgEnrollments(),
        ]);
        let assignedList = list;
        if (role === 'mentor') {
          const response = await fetch('/api/field-teams', { headers: await paidApiHeaders() });
          const workspace = await response.json();
          if (!response.ok) throw Error(workspace.error);
          const ids = new Set<string>(workspace.teams.flatMap((t: { farmerIds: string[] }) => t.farmerIds));
          assignedList = list.filter(p => ids.has(p.id));
        }

        // Batch course reads. A failed query must stay unavailable, not become zero progress.
        const ids = assignedList.map((t) => t.id);
        const [progress, assigns] = await Promise.all([
          getCourseProgressForProfiles(ids),
          getAssignmentsForProfiles(ids),
        ]);
        if(!active())return;
        setTrainees(assignedList);
        setEnrollBy(Object.fromEntries(enrollments.map((e) => [e.profile_id, e])));
        setProgressMap(progress);
        setAssignBy(assigns);
      } else {
        const ids = isSampleMode() ? sampleRead('field-teams', freshFieldWorkspace).teams.find(t => t.mentorId === 'sample-mentor')?.farmerIds ?? [] : SAMPLE.map(p => p.id);
        const samplePeople = isSampleMode() ? sampleRead('field-teams', freshFieldWorkspace).people : [];
        setTrainees(isSampleMode() ? samplePeople.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, full_name: p.name, role: p.role, org_id: null, language: 'en', id_number: null, phone: null, photo_url: samplePortrait(p.id), created_at: '' })) : SAMPLE.filter(p => ids.includes(p.id)));
        setEnrollBy(isSampleMode() ? sampleRead('mentor-enrollments', () => Object.fromEntries(SAMPLE_ENROLLMENTS.map((e) => [e.profile_id, e]))) : Object.fromEntries(SAMPLE_ENROLLMENTS.map((e) => [e.profile_id, e])));
        setAssignBy(isSampleMode() ? sampleRead('mentor-assignments', () => SAMPLE_ASSIGNMENTS) : SAMPLE_ASSIGNMENTS);
      }
    } catch (err) {
      // Leave trainees empty (the spinner clears via finally), but do NOT swallow the reason.
      // A silent catch here is how a rules denial looked exactly like "this mentor has no
      // learners yet" — indistinguishable in the UI and invisible in the console.
      console.error('[mentor] could not load the cohort:', err);
      if(active()){setLoadError(true);setTrainees([]);setEnrollBy({});setAssignBy({});setProgressMap({});}
    } finally {
      if(active())setFetching(false);
    }
  }, [isLive, user, profile?.org_id, role]);

  // Wait for auth to resolve before loading. Every query in load() is org-scoped, and the
  // org comes from the caller's own profile — run it while `currentUser` is still null and
  // each one returns an empty list with no error, which renders as "this mentor has no
  // learners" and never retries. Mirrors the guard the student page already had.
  useEffect(() => {setTrainees([]);setEnrollBy({});setAssignBy({});setProgressMap({});setSyncError(false);setBusyId(null);if (!loading) void load();return()=>{loadVersion.current++;};}, [loading, load]);

  // Every mutation below updates local state first so the control responds immediately on a
  // slow rural connection, then writes. On a failed write we re-read from the server rather
  // than leaving an optimistic value on screen that never actually saved.
  const afterWrite = useCallback(async (write: () => Promise<void>) => {
    const scope=accountScope.current;
    setSyncError(false);
    try {
      await write();
    } catch {
      if(scope!==accountScope.current)return;
      setSyncError(true);
      await load();
    }
  }, [load]);

  useEffect(() => { if (isSampleMode() && trainees.length) { sampleWrite('mentor-enrollments', enrollBy); sampleWrite('mentor-assignments', assignBy); } }, [enrollBy, assignBy, trainees]);

  const handleEnrol = useCallback(async (profileId: string) => {
    const scope=accountScope.current;
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
    if(scope===accountScope.current)setBusyId(null);
  }, [isLive, user, afterWrite]);

  const handleSetStatus = useCallback(async (profileId: string, status: 'paused' | 'active') => {
    const scope=accountScope.current;
    setBusyId(profileId);
    setEnrollBy((prev) => {
      const cur = prev[profileId];
      return cur ? { ...prev, [profileId]: { ...cur, status } } : prev;
    });
    if (isLive) await afterWrite(() => setEnrollmentStatus(profileId, status));
    if(scope===accountScope.current)setBusyId(null);
  }, [isLive, afterWrite]);

  const handleAssign = useCallback(async (profileId: string, module: string, due: string | null) => {
    const scope=accountScope.current;
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
    if(scope===accountScope.current)setBusyId(null);
  }, [isLive, user, afterWrite]);

  const handleUnassign = useCallback(async (profileId: string, module: string) => {
    const scope=accountScope.current;
    setBusyId(profileId);
    setAssignBy((prev) => ({ ...prev, [profileId]: (prev[profileId] ?? []).filter((a) => a.module !== module) }));
    if (isLive) await afterWrite(() => unassignModule(profileId, module));
    if(scope===accountScope.current)setBusyId(null);
  }, [isLive, afterWrite]);

  if (!loading && user && isLive && !sample && !canAccessRolePage(role, MENTOR_ALLOWED_ROLES)) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
        <header className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
          <MenuButton />
          <BackButton />
          <BrandLogo />
          <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
          <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>{tr(lang, 'Mentor', 'Umeluleki')}</span>
          <div className="flex-1" />
          <SettingsButton />
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="rounded-2xl px-6 py-8 text-center max-w-xs" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <div className="mx-auto mb-3 flex items-center justify-center rounded-full" style={{ width: 48, height: 48, background: 'rgba(31,77,43,0.08)' }}>
              <Users size={22} style={{ color: '#1F4D2B' }} />
            </div>
            <p className="text-sm font-display font-semibold mb-1" style={{ color: '#20190F' }}>{tr(lang, 'This is the Mentor area', 'Le ndawo eyabeluleki')}</p>
            <p className="text-xs font-sans leading-relaxed mb-5" style={{ color: '#755942' }}>
              {role==='funder' ? tr(lang, 'Open your funder workspace for the organisation’s published reports and evidence.', 'Vula indawo yabaxhasi ukuze ubone imibiko nobufakazi obushicilelwe benhlangano.') : tr(lang, 'Your organisation can link mentor access to your account.', 'Inhlangano yakho ingaxhumanisa i-akhawunti yakho nokufinyelela komeluleki.')}
            </p>
            <button
              onClick={() => router.push(role==='funder'?'/funder':'/home')}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-sans font-semibold text-sm transition-all"
              style={{ background: '#1F4D2B', color: '#F7F2E9' }}
            >
              <Home size={15} />
              {role==='funder' ? tr(lang, 'Open funder workspace', 'Vula indawo yabaxhasi') : tr(lang, 'Back to my home', 'Buyela ekhasini lami lasekhaya')}
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
      <header className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <MenuButton />
          <BackButton />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>{tr(lang, 'Mentor', 'Umeluleki')}</span>
        <div className="flex-1" />
        <LessonLink id="mentor:overview" label={tr(lang, 'Learn', 'Funda')} />
        <RoleSwitcher current="mentor" />
        <SettingsButton />
      </header>

      {/* Tab strip */}
      <DashboardTabs>
        {([
          { key: 'field', label: tr(lang, 'Fieldwork', 'Umsebenzi wasensimini'), icon: Users, badge: 0 },
          { key: 'evidence', label: tr(lang, 'Training', 'Ukuqeqeshwa'), icon: BookOpen, badge: 0 },
          { key: 'trainees', label: tr(lang, 'Learning', 'Ukufunda'), icon: Users,  badge: 0 },
          { key: 'messages', label: tr(lang, 'Messages', 'Imiyalezo'), icon: Inbox, badge: msgUnread },
        ] as const).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => { setView(key); setVisitPerson(''); if (key === 'trainees') void load(); }}
            className="flex items-center gap-1.5 py-2.5 px-3 font-display text-xs font-semibold relative"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: view === key ? '#1F4D2B' : '#5C5040',
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
      </DashboardTabs>

      {lang === 'zu' && <p className="px-4 pt-2 text-xs" style={{ color: '#755942' }}>Imininingwane yokuqeqeshwa, imibiko nokuhlolwa isaboniswa ngesiNgisi okwamanje.</p>}

      <main className="workspace-main flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 80 }}>

        {view === 'evidence' ? <ProgrammeEvidence mentor initialTab="training" /> : view === 'field' ? <FieldTeams organisation={isLive&&['ngo','admin'].includes(role??'')} initialFarmerId={visitPerson} onStartTraining={()=>setView('evidence')}/> : view === 'messages' ? (
          <ContactInbox recipient="mentor" onUnreadCount={setMsgUnread} />
        ) : (<>

        <div><h1 className="text-2xl font-display font-semibold" style={{color:'#1F4D2B'}}>{tr(lang, 'Participant learning', 'Ukufunda kwabahlanganyeli')}</h1><p className="text-sm mt-2" style={{color:'#5C5040'}}>{tr(lang, 'Assign the next useful module and follow up in the garden. Course progress, training attendance and observed practical skills are recorded separately.', 'Yabela imojula elandelayo ewusizo bese ulandelela engadini. Inqubekelaphambili yesifundo, ukuba khona ekuqeqeshweni namakhono abonwe esebenza kubhalwa ngokwehlukana.')}</p></div>
        {loadError&&<div role="alert" className="rounded-xl p-4" style={{background:'#fff0ed',color:'#8c2e1f'}}><p>{tr(lang, 'Learning records could not be loaded. Progress is unavailable until the connection succeeds.', 'Amarekhodi okufunda awakwazanga ukulayishwa. Inqubekelaphambili ayitholakali kuze kuxhumeke inethiwekhi.')}</p><button onClick={()=>void load()} className="mt-2 px-3 py-3 rounded-lg" style={{background:'white'}}>{tr(lang, 'Retry learning records', 'Phinda ulayishe amarekhodi okufunda')}</button></div>}
        {!loadError&&!fetching&&<>
        {/* Cohort at a glance */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: tr(lang, 'Enrolled', 'Ababhalisile'),    value: cohort.enrolled,   color: '#235E86' },
            { label: tr(lang, 'In progress', 'Kuyaqhubeka'), value: cohort.inProgress, color: '#805416' },
            { label: tr(lang, 'Complete', 'Kuqediwe'),    value: cohort.completed,  color: '#1F4D2B' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-3 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
              <div className="font-display font-bold text-2xl leading-tight" style={{ color }}>{value}</div>
              <div className="text-xs font-mono mt-0.5" style={{ color: '#755942' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Keep the large curriculum list available without burying participants. */}
        <details className="rounded-2xl px-4 py-3.5" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
          <summary className="flex items-center gap-2 mb-2.5 cursor-pointer" style={{minHeight:44}}>
            <GraduationCap size={14} style={{ color: '#1F4D2B' }} />
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#755942' }}>
              {tr(lang, 'View curriculum', 'Buka ikharikhulamu')} · {TOTAL_MODULES} {tr(lang, 'modules', 'amamojula')}
            </span>
          </summary>
          <div className="flex flex-wrap gap-1.5">
            {COURSE_MODULES.map((m) => (
              <span key={m.id} className="text-xs font-sans px-2 py-0.5 rounded-full"
                style={{ background: CATEGORY_COLORS[m.category] + '15', color: CATEGORY_COLORS[m.category], border: `1px solid ${CATEGORY_COLORS[m.category]}30` }}>
                {m.title}
              </span>
            ))}
          </div>
        </details>

        {syncError && (
          <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(176,58,46,0.08)', border: '1px solid rgba(176,58,46,0.28)' }}>
            <p className="text-xs font-sans leading-relaxed" style={{ color: '#B03A2E' }}>
              {tr(lang, 'That change was not confirmed. Check the reloaded learning records before trying again.', 'Lolo shintsho aluqinisekiswanga. Hlola amarekhodi okufunda aphinde alayishwa ngaphambi kokuzama futhi.')}
            </p>
          </div>
        )}

        </>}
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#755942' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            aria-label={tr(lang, 'Search participants', 'Sesha abahlanganyeli')} placeholder={tr(lang, 'Search participants...', 'Sesha abahlanganyeli...')}
            className="w-full font-sans rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#20190F' }} />
        </div>

        {/* List */}
        {fetching ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin" style={{ color: '#1F4D2B' }} />
          </div>
        ) : loadError ? null : filtered.length === 0 ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <Users size={28} style={{ color: '#755942', margin: '0 auto 8px' }} />
            <p className="text-sm font-display" style={{ color: '#5C5040' }}>
              {search ? tr(lang, 'No learners match that search.', 'Akukho bafundi abahambisana nalokho oseshile.') : tr(lang, 'Learners will appear here once they enrol.', 'Abafundi bazovela lapha uma sebebhalisile.')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <TraineeCard
                key={t.id}
                trainee={t}
                lang={lang}
                doneIds={doneIdsFor(t.id)}
                onVisit={!isLive||role==='mentor'?id=>{setVisitPerson(id);setView('field');}:undefined}
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

        {!isLive && !sample && (
          <p className="text-center text-xs font-mono" style={{ color: '#755942' }}>
            {tr(lang, 'Tour records · Sign in to open your own learners', 'Amarekhodi okuvakasha · Ngena ngemvume ukuze ubone abafundi bakho')}
          </p>
        )}
        </>)}
      </main>
      <TabBar />
    </div>
  );
}
