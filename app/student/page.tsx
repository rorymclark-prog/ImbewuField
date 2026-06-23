'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Circle, Clock, Loader2, GraduationCap, Sprout } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { myCourseProgress, setCourseProgress } from '@/lib/db/queries';
import { COURSE_MODULES, TOTAL_MODULES, CATEGORY_COLORS, type ModuleCategory } from '@/lib/course-modules';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  foundation: 'Foundation',
  water:      'Water',
  soil:       'Soil',
  plants:     'Plants',
  design:     'Design',
  business:   'Business',
};

function formatDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`.trim();
}

export default function StudentPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();

  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

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

  const doneCount = doneIds.size;
  const pct = TOTAL_MODULES === 0 ? 0 : Math.round((doneCount / TOTAL_MODULES) * 100);
  const totalMins = COURSE_MODULES.reduce((s, m) => s + (doneIds.has(m.id) ? 0 : m.durationMins), 0);

  // Arc SVG for progress ring
  const R = 44;
  const C = 2 * Math.PI * R;
  const dashOffset = C - (C * pct) / 100;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#F7F2E9' }}>
      <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Learning Portal</span>
        <div className="flex-1" />
        <SettingsButton />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 80 }}>

        {/* Progress hero */}
        <div className="rounded-2xl p-5 flex items-center gap-5" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
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
            <div className="font-sans text-sm mt-1" style={{ color: '#5C5040' }}>
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

            return (
              <div key={mod.id} className="rounded-2xl overflow-hidden"
                style={{ background: '#FBF6EC', border: `1px solid ${done ? '#1F4D2B30' : '#E2D8C4'}` }}>
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

                  {/* Content */}
                  <div className="flex-1 min-w-0">
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
                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock size={11} style={{ color: '#8C7A62' }} />
                      <span className="font-mono text-xs" style={{ color: '#8C7A62' }}>{formatDuration(mod.durationMins)}</span>
                    </div>
                  </div>

                  {/* Toggle */}
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
