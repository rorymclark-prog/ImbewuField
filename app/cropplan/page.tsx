'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Layers, Sprout, Scissors, Leaf, ClipboardList,
  ChevronLeft, ChevronRight, Sun, CloudRain, Snowflake, Sparkles,
  CheckCircle2, Circle, AlertCircle,
} from 'lucide-react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';
import {
  TASK_BOARD_CHANGED_EVENTS, loadCropBoardYear,
  loadCompletedTaskIds, setCompletedTaskState,
  type BoardTask, type CropBoardYear,
} from '@/lib/task-board';

// ─── Types & data ────────────────────────────────────────────────────────────
//
// This screen used to run its own invented weekly rota (Mon water beds A&B,
// Tue mulch, Wed compost tea, Thu weed everything, Sat photo) derived from
// nothing but the day of the week — an invented dated job, the class of
// fabrication docs/CROP-PLAN-TRUTH-AUDIT-2026-08-06.md worked through
// elsewhere in the crop-plan surfaces (it does not cover this screen; the
// citation is to the pattern, not to a finding about /cropplan). Every job
// shown here now comes from loadCropBoardYear (lib/task-board.ts), the same
// sourced-task pipeline the home screen's task card and /facilitator/crops
// already use — nothing is generated locally.
//
// GRANULARITY: crop-plan tasks carry a MONTH and no day (lib/crop-plan.ts), so
// this screen offers month and season only. It used to have Day and Week tabs;
// both were left over from the weekday rota and, once the rota went, they could
// only ever show the whole month's list under a day or week heading. They are
// deliberately gone rather than dressed up — the planner shows exactly the
// precision the data has.

type View = 'month' | 'season';

// Every action lib/crop-plan.ts's CropTask can carry, so the map stays
// exhaustive over the union. tasksForPlan currently emits prep, sow,
// transplant, harvest and terminate-cover; it deliberately emits no mulch or
// weeding task (those are field observations, not dated work), so those three
// rows are here for type completeness and cannot render today.
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

// ─── Month helpers ───────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** 1-12, wrapping. Same rule as lib/crop-plan.ts's wrapMonth. */
function wrapMonth(m: number): number { return ((m - 1) % 12 + 12) % 12 + 1; }
/** Months from `from` (1-12) forward to the next occurrence of `to` (1-12). */
function monthsUntil(to: number, from: number): number { return ((to - from) % 12 + 12) % 12; }

// SA southern-hemisphere season, keyed on a 1-12 month.
function saSeason(month: number): { name: string; Icon: typeof Sun; months: number[] } {
  if (month >= 9 && month <= 11) return { name: 'Spring', Icon: Sprout, months: [9, 10, 11] };
  if (month === 12 || month <= 2) return { name: 'Summer', Icon: Sun, months: [12, 1, 2] };
  if (month >= 3 && month <= 5) return { name: 'Autumn', Icon: CloudRain, months: [3, 4, 5] };
  return { name: 'Winter', Icon: Snowflake, months: [6, 7, 8] };
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

// ─── Task list ───────────────────────────────────────────────────────────────

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
  const [view, setView] = useState<View>('month');
  const [cursorMonth, setCursorMonth] = useState(1);
  const [todayMonth, setTodayMonth] = useState(1);
  const [year, setYear] = useState<CropBoardYear | null>(null);
  const [mounted, setMounted] = useState(false);

  // One reload path for BOTH the completion set and the sourced tasks, so the
  // list can never go stale against the crop plan. An earlier version memoised
  // the month's tasks on [mounted, cursorMonth, completedIds] and so depended
  // on loadCompletedTaskIds happening to return a fresh Set each call — a plan
  // edit would silently stop refreshing the planner the day that changed.
  const refresh = useCallback(() => {
    setYear(loadCropBoardYear(loadCompletedTaskIds()));
  }, []);

  useEffect(() => {
    const now = new Date();
    setCursorMonth(now.getMonth() + 1);
    setTodayMonth(now.getMonth() + 1);
    refresh();
    setMounted(true);
    TASK_BOARD_CHANGED_EVENTS.forEach((ev) => window.addEventListener(ev, refresh));
    return () => TASK_BOARD_CHANGED_EVENTS.forEach((ev) => window.removeEventListener(ev, refresh));
  }, [refresh]);

  function toggleTask(id: string) {
    setCompletedTaskState(id, !loadCompletedTaskIds().has(id));
    refresh();
  }

  const monthTasks = year?.byMonth.get(cursorMonth) ?? [];
  const countFor = (month: number) => year?.byMonth.get(month)?.length ?? 0;
  const savedPlantings = year?.savedPlantings ?? 0;
  const totalTasks = year?.total ?? 0;
  // A saved plan that produces no job in any of the twelve months. Kept
  // distinct from "no plan yet" so neither notice can claim the wrong thing.
  const planYieldsNothing = mounted && savedPlantings > 0 && totalTasks === 0;
  const season = saSeason(cursorMonth);
  const monthName = MONTHS[cursorMonth - 1];
  const away = monthsUntil(cursorMonth, todayMonth);

  function stepMonth(dir: number) { setCursorMonth((m) => wrapMonth(m + dir)); }

  const TABS: { v: View; label: string }[] = [
    { v: 'month', label: 'Month' }, { v: 'season', label: 'Season' },
  ];

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 56, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <MenuButton />
        <BackButton fallback="/plan" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Task Planner</span>
        <div className="flex-1" />
        <LessonLink id="crops:planner" label="Learn" />
        <SettingsButton />
      </header>

      {/* No-plan notice — pinned outside the scroll area so it can't be scrolled past.
          Gated on the SAME source the jobs come from (lib/task-board.ts's
          loadCropBoardYear, which reads imbewu_crop_plan_v1): savedPlantings is the
          stored plan's own planting count, so this fires exactly when there is no
          plan to source jobs from. A farmer who has only filled in a garden survey,
          or nothing at all, used to get the invented weekday rota with no warning. */}
      {mounted && savedPlantings === 0 && (
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
        <div className="mx-auto w-full px-4 py-5" style={{ maxWidth: 640 }}>

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
                {mounted && view === 'month' && monthName}
                {mounted && view === 'season' && season.name}
              </h1>
            </div>
            {view === 'month' && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => stepMonth(-1)} aria-label="Previous month" className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                <button onClick={() => stepMonth(1)} aria-label="Next month" className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}><ChevronRight size={16} /></button>
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

          {/* A saved plan that produces no job in any month — say why rather than
              leaving twelve empty months with no explanation. Every clause here has
              to hold for every route into this state: a planting whose bed was
              deleted, a crop with no verified timings, and an already-growing crop
              whose picking months have all passed. */}
          {planYieldsNothing && (
            <div className="rounded-2xl px-4 py-4 mb-5 flex gap-3" style={{ background: '#FFFEFA', border: '1px solid #C07A1E' }}>
              <AlertCircle size={18} style={{ color: '#C07A1E', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="font-display font-semibold mb-1" style={{ fontSize: 15, color: '#20190F' }}>
                  Your crop plan is not producing any jobs
                </div>
                <p className="font-sans" style={{ fontSize: 13.5, color: '#5C5040', lineHeight: 1.5 }}>
                  It has {savedPlantings} {savedPlantings === 1 ? 'planting' : 'plantings'} saved, but nothing in it
                  lands in any month. That happens when a planting sits on a bed that has been deleted, when its crop
                  has no verified timings in the app, or when it is an existing crop whose picking months have already
                  passed. Open the crop plan to check it.
                </p>
                <Link href="/facilitator/crops" className="inline-flex items-center gap-1 mt-2 font-sans font-semibold" style={{ fontSize: 13, color: '#1F4D2B' }}>
                  Open crop plan<ChevronRight size={14} />
                </Link>
              </div>
            </div>
          )}

          {/* ── MONTH ── */}
          {view === 'month' && (
            <div>
              {/* Twelve-month strip: the plan's own annual cycle, with each month's
                  real job count. Replaces the old day-grid calendar, which showed no
                  task information at all and implied a day precision the crop plan
                  does not have. */}
              <div className="grid grid-cols-6 gap-1 mb-4">
                {MONTHS_SHORT.map((label, i) => {
                  const m = i + 1;
                  const on = m === cursorMonth;
                  const isNow = mounted && m === todayMonth;
                  const n = countFor(m);
                  return (
                    <button key={label} onClick={() => setCursorMonth(m)}
                      aria-label={`${MONTHS[i]} — ${n} ${n === 1 ? 'job' : 'jobs'}`}
                      aria-current={on ? 'true' : undefined}
                      className="rounded-lg py-1.5 flex flex-col items-center justify-center"
                      style={{
                        background: on ? '#1F4D2B' : '#FFFEFA',
                        border: `1px solid ${on ? '#1F4D2B' : isNow ? '#1F4D2B' : '#E2D8C4'}`,
                        cursor: 'pointer',
                      }}>
                      <span className="font-sans font-semibold" style={{ fontSize: 11, color: on ? '#EAF3E2' : '#5C5040' }}>{label}</span>
                      <span className="font-display" style={{ fontSize: 12, color: on ? '#EAF3E2' : n > 0 ? '#1F4D2B' : '#C6BBA4' }}>{n}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="font-sans uppercase tracking-widest" style={{ fontSize: 11, color: '#8C7A62', letterSpacing: '0.12em' }}>
                  {monthTasks.length} {monthTasks.length === 1 ? 'job' : 'jobs'} in {monthName}
                </span>
                {/* Describes the MONTH you are browsing, never the jobs in it — a job
                    carries its own "Due in N months" line, and a picking that lands in
                    next year's August still belongs in the August bucket. "This month"
                    here would read as a claim about the jobs. */}
                {mounted && (
                  <span className="font-sans px-2 py-0.5 rounded-full" style={{ fontSize: 11, background: away === 0 ? 'rgba(31,77,43,0.1)' : 'rgba(226,216,196,0.6)', color: away === 0 ? '#1F4D2B' : '#5C5040' }}>
                    {away === 0 ? 'Current month' : away === 1 ? '1 month ahead' : `${away} months ahead`}
                  </span>
                )}
              </div>
              <TaskList
                tasks={monthTasks}
                onToggle={toggleTask}
                emptyMessage={`Nothing due from your crop plan in ${monthName}.`}
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
                  <div className="font-sans uppercase tracking-widest" style={{ fontSize: 11, color: 'rgba(234,243,226,0.55)', letterSpacing: '0.1em' }}>
                    {mounted && season.months.includes(todayMonth) ? 'This season' : 'Season'}
                  </div>
                  <div className="font-display font-bold" style={{ fontSize: 'clamp(20px, 2.2vw, 26px)', color: '#F7F2E9', lineHeight: 1.1 }}>{season.name} in South Africa</div>
                </div>
              </div>
              {season.months.map((m) => {
                const n = countFor(m);
                return (
                  <button key={m} onClick={() => { setCursorMonth(m); setView('month'); }}
                    className="w-full text-left rounded-2xl px-4 py-3.5"
                    style={{ background: '#FFFEFA', border: `1px solid ${mounted && m === todayMonth ? '#1F4D2B40' : '#E2D8C4'}`, cursor: 'pointer' }}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>{MONTHS[m - 1]}</span>
                      {mounted && m === todayMonth && <span className="font-sans px-2 py-0.5 rounded-full" style={{ fontSize: 11, background: 'rgba(31,77,43,0.1)', color: '#1F4D2B' }}>Now</span>}
                      <span className="font-sans px-2 py-0.5 rounded-full" style={{ fontSize: 11, background: 'rgba(226,216,196,0.6)', color: '#5C5040' }}>
                        {n} {n === 1 ? 'job' : 'jobs'} from your plan
                      </span>
                    </div>
                    {/* Generic seasonal guidance, not derived from this farmer's beds —
                        deliberately separate from the sourced job counts above. */}
                    <p className="font-sans" style={{ fontSize: 'clamp(14px, 1.1vw, 15px)', color: '#5C5040', lineHeight: 1.5 }}>{MONTH_FOCUS[m - 1]}</p>
                  </button>
                );
              })}
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
