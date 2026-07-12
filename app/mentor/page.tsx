'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, CheckCircle, ChevronDown, ChevronUp, BookOpen, Send, Loader2, GraduationCap, Inbox, Home } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { listTrainees, getCourseProgress, logMentorVisit } from '@/lib/db/queries';
import { COURSE_MODULES, TOTAL_MODULES, CATEGORY_COLORS } from '@/lib/course-modules';
import type { Profile, CourseProgress } from '@/lib/db/types';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import ContactInbox from '@/components/ContactInbox';

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

function TraineeCard({ trainee, doneIds, isLive }: {
  trainee: Profile; doneIds: Set<string>; isLive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [logging, setLogging] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

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
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div className="flex-shrink-0 flex items-center justify-center rounded-full font-display font-bold"
          style={{ width: 40, height: 40, fontSize: 15, background: 'linear-gradient(135deg,#1F4D2B,#2D6B3C)', color: '#EAF3E2' }}>
          {initials(trainee.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-display font-semibold truncate" style={{ color: '#20190F' }}>
            {trainee.full_name ?? 'Unnamed'}
          </div>
          <ProgressBar value={doneIds.size} max={TOTAL_MODULES} />
        </div>
        {open ? <ChevronUp size={15} style={{ color: '#8C7A62' }} /> : <ChevronDown size={15} style={{ color: '#8C7A62' }} />}
      </button>

      {open && (
        <div className="px-4 pb-4" style={{ borderTop: '1px solid #E2D8C4' }}>
          <div className="text-xs font-sans uppercase tracking-wider pt-3 pb-1" style={{ color: '#8C7A62' }}>Module sign-off</div>
          {COURSE_MODULES.map((mod) => {
            const done = doneIds.has(mod.id);
            return (
              <div key={mod.id} className="flex items-center gap-2.5 py-1.5" style={{ borderBottom: '1px solid rgba(226,216,196,0.5)' }}>
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
                  style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
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

const MENTOR_ALLOWED_ROLES = new Set(['mentor', 'ngo', 'funder', 'admin']);

export default function MentorPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();

  const [view, setView] = useState<'trainees' | 'messages'>('trainees');
  const [msgUnread, setMsgUnread] = useState(0);
  const [trainees, setTrainees] = useState<Profile[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, CourseProgress[]>>({});
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && !user && isLive) router.replace('/login');
  }, [user, loading, router, isLive]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      if (isLive) {
        const list = await listTrainees();
        setTrainees(list);
        const map: Record<string, CourseProgress[]> = {};
        await Promise.all(list.map(async (t) => { map[t.id] = await getCourseProgress(t.id).catch(() => []); }));
        setProgressMap(map);
      } else {
        setTrainees(SAMPLE);
      }
    } catch {
      // listTrainees itself failed — leave trainees empty, spinner clears via finally
    } finally {
      setFetching(false);
    }
  }, [isLive]);

  useEffect(() => { load(); }, [load]);

  if (!loading && user && isLive && role && !MENTOR_ALLOWED_ROLES.has(role)) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#F7F2E9' }}>
        <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
          <BrandLogo />
          <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
          <span className="text-xs font-display" style={{ color: '#5C5040' }}>Mentor</span>
          <div className="flex-1" />
          <SettingsButton />
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="rounded-2xl px-6 py-8 text-center max-w-xs" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
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

  const totalFull = trainees.filter((t) => doneIdsFor(t.id).size === TOTAL_MODULES).length;
  const totalPartial = trainees.filter((t) => { const s = doneIdsFor(t.id).size; return s > 0 && s < TOTAL_MODULES; }).length;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#F7F2E9' }}>
      <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Mentor</span>
        <div className="flex-1" />
        <SettingsButton />
      </header>

      {/* Tab strip */}
      <div className="flex-shrink-0 flex" style={{ background: '#FBF6EC', borderBottom: '1px solid #E2D8C4', paddingLeft: 16, paddingRight: 16, gap: 0 }}>
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
            { label: 'Learners',      value: trainees.length, color: '#235E86' },
            { label: 'Graduated',     value: totalFull,        color: '#1F4D2B' },
            { label: 'In progress',   value: totalPartial,     color: '#C07A1E' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-3 text-center" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
              <div className="font-display font-bold text-2xl leading-tight" style={{ color }}>{value}</div>
              <div className="text-xs font-mono mt-0.5" style={{ color: '#8C7A62' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Curriculum chip cloud */}
        <div className="rounded-2xl px-4 py-3.5" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
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

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8C7A62' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search learners..."
            className="w-full font-sans rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F' }} />
        </div>

        {/* List */}
        {fetching ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin" style={{ color: '#1F4D2B' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
            <Users size={28} style={{ color: '#8C7A62', margin: '0 auto 8px' }} />
            <p className="text-sm font-display" style={{ color: '#5C5040' }}>
              {search ? 'No learners match that search.' : 'Learners will appear here once they enrol.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <TraineeCard key={t.id} trainee={t} doneIds={doneIdsFor(t.id)} isLive={isLive} />
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
