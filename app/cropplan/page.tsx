'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Layers, Sprout, Scissors, Leaf, ClipboardList,
  ChevronLeft, ChevronRight, Sun, CloudRain, Snowflake, Sparkles,
  CheckCircle2, Circle,
} from 'lucide-react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import { loadCropPlan } from '@/lib/crop-plan';
import {
  TASK_BOARD_CHANGED_EVENTS, loadCropBoardTasksForMonth,
  loadCompletedTaskIds, setCompletedTaskState, type BoardTask,
} from '@/lib/task-board';

// ─── Types & data ────────────────────────────────────────────────────────────
//
// This screen used to run its own invented weekly rota (Mon water beds A&B,
// Tue mulch, Wed compost tea, Thu weed everything, Sat photo) derived from
// nothing but the day of the week — the exact class of fabricated dated job
// docs/CROP-PLAN-TRUTH-AUDIT-2026-08-06.md records as removed from the real
// planner. Every job shown here now comes from loadCropBoardTasksForMonth
// (lib/task-board.ts), the same sourced-task pipeline the home screen's task
// card and /facilitator/crops already use — nothing is generated locally.
// Crop-plan months carry no year, so "due this month" is the finest anchor
// the real data supports: day and week views show that month's real tasks
// rather than pinning them to invented weekdays.

type View = 'day' | 'week' | 'month' | 'season';

const ACTION_META: Record<NonNullable<BoardTask['action']>, { Icon: typeof Sprout; color: string; short: string }> = {
  prep:               { Icon: ClipboardList, color: '#5C4F3C', short: 'Prep' },
  sow:                { Icon: Sprout,        color: '#1F4D2B', short: 'Sow' },
  transplant:         { Icon: Leaf,          color: '#2E6B3A', short: 'Transplant' },
  mulch:              { Icon: Layers,        color: '#2E6B3A', short: 'Mulch' },
  harvest:            { Icon: Leaf,          color: '#C07A1E', short: 'Harvest' },
  'terminate-cover':  { Icon: Scissors,      color: '#5C4F3C', short: 'Cut down' },
  'weed-early':       { Icon: Scissors,      color: '#5C4F3C', short: 'Weed' },
  'weed-mid':         { Icon: Scissors,      color: '#5C4F3C', short: 'Weed' },
};
const FALLBACK_META = { Icon: ClipboardList, color: '#5C4F3C', short: 'Task' };
function actionMeta(task: BoardTask) { return (task.action && ACTION_META[task.action]) || FALLBACK_META; }

// ─── Date helpers ────────────────────────────────────────────────────────────

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function fmtDM(d: Date) { return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; }

// SA southern-hemisphere season
function saSeason(month: number): { name: string; Icon: typeof Sun; months: number[] } {
  if (month >= 8 && month <= 10) return { name: 'Spring', Icon: Sprout, months: [8, 9, 10] };
  if (month === 11 || month <= 1) return { name: 'Summer', Icon: Sun, months: [11, 0, 1] };
  if (month >= 2 && month <= 4) return { name: 'Autumn', Icon: CloudRain, months: [2, 3, 4] };
  return { name: 'Winter', Icon: Snowflake, months: [5, 6, 7] };
}
const MONTH_FOCUS: Record<number, string> = {
  0: 'Peak summer harvest — water deeply, mulch, watch for pests daily.',
  1: 'Late summer — cure pumpkins & sweet potato, clear spent beds.',
  2: 'Early autumn — sow spinach, carrots, garlic; add compost.',
  3: 'Autumn planting — garlic and leafy greens go in now.',
  4: 'Mid-autumn — succession-sow spinach; improve soil for winter.',
  5: 'Winter — protect seedlings from frost; harvest greens & roots.',
  6: 'Deep winter — source spring seed; start tomatoes indoors.',
  7: 'Late winter — start warm-season seedlings; prep spring beds.',
  // Maize's own catalog entry (lib/crop-catalog.ts) puts every rainfall
  // pattern's sowing window at Oct-Dec, none of them September — the same
  // false-early claim the calendar page's history warns about. It moved to
  // October below, where the catalog actually agrees.
  8: 'Spring — transplant tomatoes, sow beans; harvest garlic.',
  9: 'Spring planting peak — sow maize; get everything in before the heat.',
  10: 'Late spring — final tomato sowings; mulch for summer.',
  11: 'Early summer — first tomatoes; water daily, tie up trusses.',
};

// ─── Task list (shared by day / week / month) ───────────────────────────────

function TaskList({ tasks, onToggle, emptyMessage }: {
  tasks: BoardTask[]; onToggle: (id: string) => void; emptyMessage: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl px-4 py-6 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
        <p className="font-sans" style={{ fontSize: 14, color: '#8C7A62', lineHeight: 1.5 }}>{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      {tasks.map((task, i) => {
        const m = actionMeta(task);
        return (
          <div key={task.id} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: i < tasks.length - 1 ? '1px solid #E2D8C4' : 'none' }}>
            <button
              onClick={() => onToggle(task.id)}
              aria-label={task.completed ? 'Mark not done' : 'Mark done'}
              className="flex-shrink-0"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: '#1F4D2B' }}
            >
              {task.completed ? <CheckCircle2 size={20} strokeWidth={1.8} /> : <Circle size={20} strokeWidth={1.8} />}
            </button>
            <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 38, height: 38, background: m.color + '18' }}>
              <m.Icon size={18} style={{ color: m.color }} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-display font-semibold"
                style={{ fontSize: 'clamp(15px, 1.2vw, 16px)', color: '#20190F', textDecoration: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.55 : 1 }}
              >
                {task.title}
              </div>
              <div className="font-sans truncate" style={{ fontSize: 13, color: '#8C7A62' }}>{task.subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CropPlanPage() {
  const [view, setView] = useState<View>('day');
  const [cursor, setCursor] = useState<Date | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [hasPlan, setHasPlan] = useState(false);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    setCompletedIds(loadCompletedTaskIds());
    setHasPlan(loadCropPlan().plantings.length > 0);
  }, []);

  useEffect(() => {
    refresh();
    const now = new Date(); setCursor(now); setToday(now); setMounted(true);
    TASK_BOARD_CHANGED_EVENTS.forEach((ev) => window.addEventListener(ev, refresh));
    return () => TASK_BOARD_CHANGED_EVENTS.forEach((ev) => window.removeEventListener(ev, refresh));
  }, [refresh]);

  function toggleTask(id: string) {
    const before = loadCompletedTaskIds();
    setCompletedIds(setCompletedTaskState(id, !before.has(id)));
  }

  const safeCursor = cursor ?? new Date(0);
  const safeToday = today ?? new Date(0);

  const cursorMonth = safeCursor.getMonth() + 1;
  const weekStart = useMemo(() => mondayOf(safeCursor), [safeCursor]);
  const weekMonth = weekStart.getMonth() + 1;
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Real, sourced tasks — never invented. Day and month share the same
  // calendar-month bucket; week anchors on the Monday of the viewed week
  // (a "sensible anchor" per the audit fix, since crop-plan tasks carry no
  // day-of-week, only a due month).
  const monthTasks = useMemo(() => (mounted ? loadCropBoardTasksForMonth(cursorMonth, completedIds) : []), [mounted, cursorMonth, completedIds]);
  const weekTasks = useMemo(
    () => (mounted ? (weekMonth === cursorMonth ? monthTasks : loadCropBoardTasksForMonth(weekMonth, completedIds)) : []),
    [mounted, weekMonth, cursorMonth, monthTasks, completedIds],
  );

  const season = saSeason(safeCursor.getMonth());

  function step(dir: number) {
    if (view === 'day') setCursor((c) => addDays(c ?? new Date(), dir));
    else if (view === 'week') setCursor((c) => addDays(c ?? new Date(), dir * 7));
    else setCursor((c) => { const d = c ?? new Date(); return new Date(d.getFullYear(), d.getMonth() + dir, 1); });
  }

  const isToday = mounted && sameDay(safeCursor, safeToday);
  const dayLabel = isToday ? 'Today' : DOW[(safeCursor.getDay() + 6) % 7];

  const TABS: { v: View; label: string }[] = [
    { v: 'day', label: 'Day' }, { v: 'week', label: 'Week' },
    { v: 'month', label: 'Month' }, { v: 'season', label: 'Season' },
  ];

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 56, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <BackButton fallback="/plan" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Task Planner</span>
        <div className="flex-1" />
        <LessonLink id="crops:planner" label="Learn" />
        <SettingsButton />
      </header>

      {/* No-plan notice — pinned outside the scroll area so it can't be scrolled past.
          Fires unconditionally whenever there is no real crop plan to source jobs from
          (lib/crop-plan.ts, imbewu_crop_plan_v1) — a farmer who has only filled in a
          garden survey, or nothing at all, used to get the invented weekday rota with
          no warning; now they see nothing invented and this notice instead. */}
      {mounted && !hasPlan && (
        <div
          className="flex-shrink-0 flex items-center justify-center gap-3 px-4 py-2 flex-wrap text-center"
          style={{ background: '#C07A1E', borderBottom: '1px solid rgba(32,25,15,0.15)' }}
        >
          <span className="flex items-center gap-1.5 font-display font-semibold" style={{ fontSize: 13, color: '#fff' }}>
            <Sparkles size={14} />
            No crop plan yet — jobs will show here once you plan your crops.
          </span>
          <Link
            href="/facilitator/crops"
            className="flex items-center gap-1 px-3 py-1 rounded-full font-sans font-semibold"
            style={{ fontSize: 12, background: '#fff', color: '#C07A1E', textDecoration: 'none' }}
          >
            Plan my crops
          </Link>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full px-4 py-5" style={{ maxWidth: view === 'week' || view === 'month' ? 880 : 560 }}>

          {/* New: flagship bed-timeline crop planner on the design map */}
          <Link href="/facilitator/crops"
            className="block px-4 py-2.5 rounded-xl text-sm font-display font-semibold text-center transition-all mb-4"
            style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#1F4D2B', textDecoration: 'none' }}>
            🌱 New: plan crops bed-by-bed on your design map →
          </Link>

          {/* Title row */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="font-sans uppercase tracking-widest" style={{ fontSize: 11, color: '#C07A1E', letterSpacing: '0.12em' }}>Task planner</div>
              <h1 className="font-display font-bold" style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', color: '#20190F', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {mounted && view === 'day' && `${DOW[(safeCursor.getDay() + 6) % 7]} · ${fmtDM(safeCursor)}`}
                {mounted && view === 'week' && `Week of ${fmtDM(weekStart)}`}
                {mounted && view === 'month' && `${MONTHS[safeCursor.getMonth()]} ${safeCursor.getFullYear()}`}
                {mounted && view === 'season' && `${season.name} ${safeCursor.getFullYear()}`}
              </h1>
            </div>
            {view !== 'season' && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => step(-1)} aria-label="Previous" className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                <button onClick={() => step(1)} aria-label="Next" className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}><ChevronRight size={16} /></button>
              </div>
            )}
          </div>

          {/* Zoom tabs */}
          <div className="flex rounded-xl p-0.5 gap-0.5 mt-3 mb-5" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
            {TABS.map((t) => {
              const on = view === t.v;
              return (
                <button key={t.v} onClick={() => setView(t.v)}
                  className="flex-1 py-1.5 rounded-lg font-sans font-semibold transition-all"
                  style={on ? { background: '#1F4D2B', color: '#F7F2E9', fontSize: 14 } : { color: '#5C5040', fontSize: 14, border: '1px solid transparent', background: 'transparent', cursor: 'pointer' }}>
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ── DAY ── */}
          {view === 'day' && (
            <div>
              <div className="font-sans uppercase tracking-widest mb-3" style={{ fontSize: 11, color: '#8C7A62', letterSpacing: '0.12em' }}>
                {dayLabel} — {monthTasks.length} {monthTasks.length === 1 ? 'job' : 'jobs'} due this month
              </div>
              <TaskList
                tasks={monthTasks}
                onToggle={toggleTask}
                emptyMessage="Nothing due from your crop plan for this day — check the month view."
              />
            </div>
          )}

          {/* ── WEEK ── */}
          {view === 'week' && (
            <div>
              <div className="font-sans uppercase tracking-widest mb-3" style={{ fontSize: 11, color: '#8C7A62', letterSpacing: '0.12em' }}>
                {weekTasks.length} {weekTasks.length === 1 ? 'job' : 'jobs'} due this month
              </div>
              <TaskList
                tasks={weekTasks}
                onToggle={toggleTask}
                emptyMessage="Nothing due from your crop plan for this week — check the month view."
              />
              <div className="grid grid-cols-7 gap-1 mt-4">
                {weekDays.map((d) => {
                  const td = mounted && sameDay(d, safeToday);
                  return (
                    <div key={d.toISOString()} className="rounded-xl py-2 text-center" style={{ background: td ? '#1F4D2B' : '#FFFEFA', border: `1px solid ${td ? '#1F4D2B' : '#E2D8C4'}` }}>
                      <div className="font-sans font-semibold" style={{ fontSize: 11, color: td ? '#EAF3E2' : '#5C5040' }}>{DOW[(d.getDay() + 6) % 7]}</div>
                      <div className="font-display" style={{ fontSize: 12, color: td ? '#EAF3E2' : '#8C7A62' }}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── MONTH ── */}
          {view === 'month' && (
            <div>
              <div className="rounded-2xl p-3 md:p-4 mb-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DOW.map((d) => <div key={d} className="text-center font-sans" style={{ fontSize: 11, color: '#8C7A62' }}>{d}</div>)}
                </div>
                <div className="space-y-1">
                  {(() => {
                    const first = new Date(safeCursor.getFullYear(), safeCursor.getMonth(), 1);
                    const start = mondayOf(first);
                    const weeks: Date[][] = [];
                    for (let w = 0; w < 6; w++) {
                      const row = Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i));
                      weeks.push(row);
                      if (row[6].getMonth() !== safeCursor.getMonth() && w >= 4) break;
                    }
                    return weeks;
                  })().map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1">
                      {week.map((d) => {
                        const inMonth = d.getMonth() === safeCursor.getMonth();
                        const td = mounted && sameDay(d, safeToday);
                        return (
                          <button key={d.toISOString()} onClick={() => { setCursor(new Date(d)); setView('day'); }}
                            className="rounded-lg flex flex-col items-center justify-center py-1.5"
                            style={{ aspectRatio: '1', background: td ? '#1F4D2B' : inMonth ? 'rgba(226,216,196,0.3)' : 'transparent', border: td ? 'none' : '1px solid transparent', opacity: inMonth ? 1 : 0.35, cursor: 'pointer' }}>
                            <span className="font-display" style={{ fontSize: 13, fontWeight: td ? 700 : 500, color: td ? '#EAF3E2' : '#20190F' }}>{d.getDate()}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="font-sans uppercase tracking-widest mb-3" style={{ fontSize: 11, color: '#8C7A62', letterSpacing: '0.12em' }}>
                {monthTasks.length} {monthTasks.length === 1 ? 'job' : 'jobs'} due this month
              </div>
              <TaskList
                tasks={monthTasks}
                onToggle={toggleTask}
                emptyMessage="Nothing due from your crop plan for this month."
              />
            </div>
          )}

          {/* ── SEASON ── */}
          {view === 'season' && (
            <div className="space-y-4">
              <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: '#1F4D2B', boxShadow: '0 4px 16px rgba(31,77,43,0.28)' }}>
                <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 48, height: 48, background: 'rgba(234,243,226,0.15)' }}>
                  <season.Icon size={22} style={{ color: '#EAF3E2' }} strokeWidth={1.6} />
                </div>
                <div>
                  <div className="font-sans uppercase tracking-widest" style={{ fontSize: 11, color: 'rgba(234,243,226,0.55)', letterSpacing: '0.1em' }}>This season</div>
                  <div className="font-display font-bold" style={{ fontSize: 'clamp(20px, 2.2vw, 26px)', color: '#F7F2E9', lineHeight: 1.1 }}>{season.name} in South Africa</div>
                </div>
              </div>
              {season.months.map((m) => (
                <div key={m} className="rounded-2xl px-4 py-3.5" style={{ background: '#FFFEFA', border: `1px solid ${mounted && m === safeToday.getMonth() ? '#1F4D2B40' : '#E2D8C4'}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>{MONTHS[m]}</span>
                    {mounted && m === safeToday.getMonth() && <span className="font-sans px-2 py-0.5 rounded-full" style={{ fontSize: 11, background: 'rgba(31,77,43,0.1)', color: '#1F4D2B' }}>Now</span>}
                  </div>
                  <p className="font-sans" style={{ fontSize: 'clamp(14px, 1.1vw, 15px)', color: '#5C5040', lineHeight: 1.5 }}>{MONTH_FOCUS[m]}</p>
                </div>
              ))}
            </div>
          )}

          {/* Footer link */}
          <Link href="/plan" className="flex items-center justify-center gap-1.5 mt-6 py-3 rounded-xl font-display font-semibold" style={{ fontSize: 14, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#1F4D2B', textDecoration: 'none' }}>
            Manage crops &amp; beds<ChevronRight size={15} />
          </Link>
        </div>
      </div>

      <TabBar />
    </div>
  );
}
