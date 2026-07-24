'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Circle, Clock, Loader2, GraduationCap, Sprout, ChevronDown, ChevronUp, BookOpen, Home, Lightbulb } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { myCourseProgress, setCourseProgress } from '@/lib/db/queries';
import { COURSE_MODULES, TOTAL_MODULES, CATEGORY_COLORS, type ModuleCategory, type Lesson } from '@/lib/course-modules';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  foundation: 'Foundation',
  water:      'Water',
  soil:       'Soil',
  plants:     'Plants',
  design:     'Design',
  business:   'Business',
  seeds:      'Seeds',
};

function formatDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`.trim();
}

// ── Quiz question ────────────────────────────────────────────────────────────

function QuizQuestion({ q, options, correct, rationale }: { q: string; options: string[]; correct: number; rationale?: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const revealed = selected !== null;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(32,25,15,0.04)', border: '1px solid rgba(32,25,15,0.08)' }}>
      <p className="font-sans text-sm font-semibold leading-snug" style={{ color: '#20190F' }}>{q}</p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === correct;

          let bg = 'rgba(32,25,15,0.04)';
          let border = '1px solid rgba(32,25,15,0.10)';
          let textColor = '#5C5040';

          if (revealed) {
            if (isCorrect) {
              bg = 'rgba(31,77,43,0.10)';
              border = '1px solid rgba(31,77,43,0.35)';
              textColor = '#1F4D2B';
            } else if (isSelected) {
              bg = 'rgba(180,30,30,0.08)';
              border = '1px solid rgba(180,30,30,0.30)';
              textColor = '#8B2020';
            }
          }

          return (
            <button
              key={i}
              onClick={() => { if (!revealed) setSelected(i); }}
              disabled={revealed}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-sans leading-snug transition-all"
              style={{ background: bg, border, color: textColor, cursor: revealed ? 'default' : 'pointer' }}
            >
              <span className="font-mono text-xs mr-2" style={{ opacity: 0.5 }}>{String.fromCharCode(65 + i)}.</span>
              {opt}
              {revealed && isCorrect && (
                <span className="ml-2 text-xs font-semibold" style={{ color: '#1F4D2B' }}>Correct</span>
              )}
              {revealed && isSelected && !isCorrect && (
                <span className="ml-2 text-xs font-semibold" style={{ color: '#8B2020' }}>
                  Incorrect — see {String.fromCharCode(65 + correct)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {revealed && rationale && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.22)' }}>
          <Lightbulb size={13} style={{ color: '#C07A1E', flexShrink: 0, marginTop: 2 }} />
          <p className="font-sans text-xs leading-relaxed" style={{ color: '#5C5040' }}>{rationale}</p>
        </div>
      )}
    </div>
  );
}

// ── Lesson accordion panel ───────────────────────────────────────────────────

function LessonPanel({ lesson, color }: { lesson: Lesson; color: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${color}22` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: open ? `${color}0F` : 'transparent' }}
      >
        <BookOpen size={14} style={{ color, flexShrink: 0 }} />
        <span className="flex-1 font-sans text-sm font-semibold leading-snug" style={{ color: '#20190F' }}>
          {lesson.title}
        </span>
        {open
          ? <ChevronUp size={14} style={{ color: '#8C7A62', flexShrink: 0 }} />
          : <ChevronDown size={14} style={{ color: '#8C7A62', flexShrink: 0 }} />}
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-5" style={{ borderTop: `1px solid ${color}18` }}>
          {/* Body */}
          <div className="space-y-3 pt-4">
            {lesson.body.split('\n\n').map((para, i) => (
              <p key={i} className="font-sans text-sm leading-relaxed" style={{ color: '#3A3020' }}>
                {para}
              </p>
            ))}
          </div>

          {/* Key points */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: `${color}0C`, border: `1px solid ${color}20` }}>
            <p className="font-display font-semibold text-xs uppercase tracking-wide" style={{ color }}>Key Points</p>
            <ul className="space-y-1.5">
              {lesson.keyPoints.map((kp, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 flex-shrink-0 rounded-full" style={{ width: 5, height: 5, background: color }} />
                  <span className="font-sans text-sm leading-snug" style={{ color: '#3A3020' }}>{kp}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quiz */}
          <div className="space-y-3">
            <p className="font-display font-semibold text-xs uppercase tracking-wide" style={{ color: '#8C7A62' }}>
              Check your understanding
            </p>
            {lesson.quiz.map((q, i) => (
              <QuizQuestion key={i} q={q.q} options={q.options} correct={q.correct} rationale={q.rationale} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const STUDENT_ALLOWED_ROLES = new Set(['student', 'farmer', 'ngo', 'funder', 'admin']);

export default function StudentPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();

  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user && isLive) router.replace('/login');
  }, [user, loading, router, isLive]);

  const load = useCallback(async () => {
    setFetching(true);
    if (isLive && user) {
      const rows = await myCourseProgress();
      setDoneIds(new Set(rows.filter((r) => r.done).map((r) => r.module)));
    }
    setFetching(false);
  }, [isLive, user]);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  async function toggle(moduleId: string) {
    const willBeDone = !doneIds.has(moduleId);
    // Optimistic update
    setDoneIds((prev) => {
      const next = new Set(prev);
      willBeDone ? next.add(moduleId) : next.delete(moduleId);
      return next;
    });
    if (isLive) {
      setToggling(moduleId);
      await setCourseProgress(moduleId, willBeDone);
      setToggling(null);
    }
  }

  function toggleExpand(moduleId: string) {
    setExpandedModuleId((prev) => (prev === moduleId ? null : moduleId));
  }

  // Gate: do not render protected content while auth is resolving or user is absent
  if (isLive && (loading || !user)) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
        <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
          <BrandLogo />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin" style={{ color: '#1F4D2B' }} />
        </main>
      </div>
    );
  }

  if (!loading && user && isLive && role && !STUDENT_ALLOWED_ROLES.has(role)) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
        <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
          <BrandLogo />
          <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
          <span className="text-xs font-display" style={{ color: '#5C5040' }}>Learning Portal</span>
          <div className="flex-1" />
          <SettingsButton />
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="rounded-2xl px-6 py-8 text-center max-w-xs" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <div className="mx-auto mb-3 flex items-center justify-center rounded-full" style={{ width: 48, height: 48, background: 'rgba(31,77,43,0.08)' }}>
              <GraduationCap size={22} style={{ color: '#1F4D2B' }} />
            </div>
            <p className="text-sm font-display font-semibold mb-1" style={{ color: '#20190F' }}>This is the Learning Portal</p>
            <p className="text-xs font-sans leading-relaxed mb-5" style={{ color: '#8C7A62' }}>
              It&apos;s set up for students — not your role. Head back to your own home to keep going.
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

  const doneCount = doneIds.size;
  const pct = TOTAL_MODULES === 0 ? 0 : Math.round((doneCount / TOTAL_MODULES) * 100);
  const totalMins = COURSE_MODULES.reduce((s, m) => s + (doneIds.has(m.id) ? 0 : m.durationMins), 0);

  // Arc SVG for progress ring
  const R = 44;
  const C = 2 * Math.PI * R;
  const dashOffset = C - (C * pct) / 100;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Learning Portal</span>
        <div className="flex-1" />
        <LessonLink id="student:overview" label="Learn" />
        <SettingsButton />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 80 }}>

        {/* Progress hero */}
        <div className="rounded-2xl p-5 flex items-center gap-5" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
          {/* Ring */}
          <div className="flex-shrink-0 relative" style={{ width: 100, height: 100 }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(32,25,15,0.10)" strokeWidth="8" />
              <circle cx="50" cy="50" r={R} fill="none"
                stroke={pct === 100 ? '#1F4D2B' : '#C07A1E'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={fetching ? C : dashOffset}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {fetching ? (
                <Loader2 size={20} className="animate-spin" style={{ color: '#1F4D2B' }} />
              ) : (
                <>
                  <span className="font-display font-bold text-xl leading-none" style={{ color: '#20190F' }}>{pct}%</span>
                  <span className="text-xs font-mono mt-0.5" style={{ color: '#8C7A62' }}>done</span>
                </>
              )}
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-base leading-tight" style={{ color: '#20190F' }}>
              {pct === 100 ? 'Course complete!' : doneCount === 0 ? 'Ready to start' : 'Keep going'}
            </div>
            <div className="font-sans text-xs mt-1" style={{ color: '#5C5040' }}>
              {doneCount} of {TOTAL_MODULES} modules complete
            </div>
            {pct < 100 && totalMins > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <Clock size={12} style={{ color: '#8C7A62' }} />
                <span className="font-sans text-xs" style={{ color: '#8C7A62' }}>
                  ~{formatDuration(totalMins)} remaining
                </span>
              </div>
            )}
            {pct === 100 && (
              <div className="flex items-center gap-1.5 mt-2">
                <GraduationCap size={13} style={{ color: '#1F4D2B' }} />
                <span className="font-sans text-xs font-semibold" style={{ color: '#1F4D2B' }}>
                  Permaculture practitioner
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Module list */}
        <div className="space-y-2.5">
          {COURSE_MODULES.map((mod, idx) => {
            const done = doneIds.has(mod.id);
            const isToggling = toggling === mod.id;
            const color = CATEGORY_COLORS[mod.category];
            const isExpanded = expandedModuleId === mod.id;

            return (
              <div key={mod.id} className="rounded-2xl overflow-hidden"
                style={{ background: '#FFFEFA', border: `1px solid ${done ? '#1F4D2B30' : '#E2D8C4'}` }}>

                {/* Module header row */}
                <div className="flex items-start gap-3 px-4 py-3.5">
                  {/* Number / check */}
                  <div className="flex-shrink-0 flex items-center justify-center rounded-full mt-0.5"
                    style={{
                      width: 32, height: 32,
                      background: done ? '#1F4D2B' : 'rgba(32,25,15,0.06)',
                      border: `1.5px solid ${done ? '#1F4D2B' : '#E2D8C4'}`,
                      transition: 'background 0.2s, border-color 0.2s',
                    }}>
                    {done
                      ? <CheckCircle size={16} style={{ color: '#EAF3E2' }} />
                      : <span className="font-mono text-xs font-bold" style={{ color: '#8C7A62' }}>{idx + 1}</span>}
                  </div>

                  {/* Content — tap to expand lessons */}
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => toggleExpand(mod.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="font-display font-semibold text-sm leading-tight"
                        style={{ color: done ? '#5C5040' : '#20190F', textDecoration: done ? 'line-through' : 'none' }}>
                        {mod.title}
                      </span>
                      <span className="text-xs font-sans px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: color + '18', color, border: `1px solid ${color}30` }}>
                        {CATEGORY_LABELS[mod.category]}
                      </span>
                    </div>
                    <p className="font-sans text-xs mt-1 leading-relaxed" style={{ color: '#5C5040' }}>
                      {mod.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} style={{ color: '#8C7A62' }} />
                        <span className="font-mono text-xs" style={{ color: '#8C7A62' }}>{formatDuration(mod.durationMins)}</span>
                      </div>
                      {mod.lessons && mod.lessons.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="font-sans text-xs" style={{ color: '#8C7A62' }}>
                            {mod.lessons.length} {mod.lessons.length === 1 ? 'lesson' : 'lessons'}
                          </span>
                          {isExpanded
                            ? <ChevronUp size={11} style={{ color: '#8C7A62' }} />
                            : <ChevronDown size={11} style={{ color: '#8C7A62' }} />}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Mark done toggle */}
                  <button
                    onClick={() => toggle(mod.id)}
                    disabled={isToggling}
                    aria-label={done ? 'Mark as not done' : 'Mark as complete'}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-semibold mt-0.5 transition-all"
                    style={{
                      background: done ? 'rgba(31,77,43,0.08)' : '#1F4D2B',
                      border: done ? '1px solid rgba(31,77,43,0.2)' : 'none',
                      color: done ? '#1F4D2B' : '#EAF3E2',
                      cursor: isToggling ? 'wait' : 'pointer',
                      opacity: isToggling ? 0.6 : 1,
                    }}
                  >
                    {isToggling
                      ? <Loader2 size={12} className="animate-spin" />
                      : done
                        ? <><CheckCircle size={12} />Done</>
                        : <><Circle size={12} />Mark done</>}
                  </button>
                </div>

                {/* Lessons panel */}
                {isExpanded && mod.lessons && mod.lessons.length > 0 && (
                  <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid #E2D8C4' }}>
                    <p className="font-display text-xs font-semibold uppercase tracking-wide pt-3 pb-1" style={{ color: '#8C7A62' }}>
                      Lessons
                    </p>
                    {mod.lessons.map((lesson) => (
                      <LessonPanel key={lesson.id} lesson={lesson} color={color} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Completion banner */}
        {pct === 100 && (
          <div className="rounded-2xl px-5 py-5 text-center space-y-2"
            style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.2)' }}>
            <Sprout size={28} style={{ color: '#1F4D2B', margin: '0 auto' }} />
            <div className="font-display font-bold text-base" style={{ color: '#1F4D2B' }}>
              Course complete!
            </div>
            <p className="font-sans text-sm" style={{ color: '#5C5040' }}>
              You have completed the full ImbewuField permaculture curriculum. Your trainer will be notified.
            </p>
          </div>
        )}

        {!isLive && (
          <p className="text-center text-xs font-mono" style={{ color: '#8C7A62' }}>
            Progress will save to Firebase once the backend is connected
          </p>
        )}
      </main>
      <TabBar />
    </div>
  );
}
