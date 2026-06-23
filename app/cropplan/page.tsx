'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Droplets, Layers, Sprout, Scissors, Leaf, Camera, ClipboardList,
  ChevronLeft, ChevronRight, Sun, CloudRain, Snowflake,
} from 'lucide-react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';

// ─── Types & data ────────────────────────────────────────────────────────────

type View = 'day' | 'week' | 'month' | 'season';
type JobType = 'water' | 'mulch' | 'feed' | 'weed' | 'harvest' | 'photo' | 'plan';
interface Job { type: JobType; title: string; sub: string }
interface Bed { letter: string; crop: string }

const JOB_META: Record<JobType, { Icon: typeof Droplets; color: string; short: string }> = {
  water:   { Icon: Droplets,      color: '#235E86', short: 'Water' },
  mulch:   { Icon: Layers,        color: '#2E6B3A', short: 'Mulch' },
  feed:    { Icon: Sprout,        color: '#1F4D2B', short: 'Feed' },
  weed:    { Icon: Scissors,      color: '#5C4F3C', short: 'Weed' },
  harvest: { Icon: Leaf,          color: '#C07A1E', short: 'Harvest' },
  photo:   { Icon: Camera,        color: '#C07A1E', short: 'Photo' },
  plan:    { Icon: ClipboardList, color: '#1F4D2B', short: 'Plan' },
};

const DEFAULT_BEDS: Bed[] = [
  { letter: 'A', crop: 'Spinach' }, { letter: 'B', crop: 'Tomatoes' },
  { letter: 'C', crop: 'Maize' },   { letter: 'D', crop: 'Beans' },
];

function loadBeds(): Bed[] {
  if (typeof window === 'undefined') return DEFAULT_BEDS;
  try {
    const s = JSON.parse(localStorage.getItem('imbewu_garden_survey') || 'null');
    if (s?.bedCrops?.length) return s.bedCrops.map((c: string, i: number) => ({ letter: String.fromCharCode(65 + i), crop: c }));
  } catch { /* ignore */ }
  try {
    const p = JSON.parse(localStorage.getItem('imbewu_planner_crops') || 'null');
    if (Array.isArray(p) && p.length) return p.slice(0, 6).map((c: string, i: number) => ({ letter: String.fromCharCode(65 + i), crop: c }));
  } catch { /* ignore */ }
  return DEFAULT_BEDS;
}

// Deterministic weekly job rota, parameterised by the farmer's beds.
function jobsForDate(d: Date, beds: Bed[]): Job[] {
  const A = beds[0], B = beds[1], C = beds[2] ?? beds[0], D = beds[3] ?? beds[1];
  const leafy = beds.find((b) => /spinach|chard|lettuce|kale|cabbage|beans/i.test(b.crop)) ?? A;
  const lc = (s: string) => s.toLowerCase();
  const j = (type: JobType, title: string, sub: string): Job => ({ type, title, sub });
  switch (d.getDay()) {
    case 1: return [j('water', `Water beds ${A.letter} & ${B.letter}`, 'Morning · deep')];
    case 2: return [j('water', `Water beds ${A.letter} & ${B.letter}`, 'Morning · deep'), j('mulch', `Mulch ${lc(leafy.crop)}`, 'Straw, 5cm'), j('photo', `Photo bed ${C.letter}`, 'Pest check')];
    case 3: return [j('feed', 'Feed all beds', 'Compost tea'), j('water', `Water beds ${C.letter} & ${D.letter}`, 'Morning')];
    case 4: return [j('weed', 'Weed all beds', 'Pull before they seed'), j('water', `Water beds ${A.letter} & ${B.letter}`, 'Morning')];
    case 5: return [j('water', `Water beds ${C.letter} & ${D.letter}`, 'Morning · deep'), j('harvest', `Harvest ${lc(leafy.crop)}`, 'Pick outer leaves')];
    case 6: return [j('harvest', `Harvest ${lc(A.crop)}`, 'Early, before the heat'), j('photo', 'Photo all beds', 'Lima checks growth')];
    default: return [j('plan', 'Review the week', 'Log harvests in the journal'), j('plan', 'Plan next week', 'With Lima')];
  }
}

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
  8: 'Spring — transplant tomatoes, sow beans & maize; harvest garlic.',
  9: 'Spring planting peak — get everything in before the heat.',
  10: 'Late spring — final tomato sowings; mulch for summer.',
  11: 'Early summer — first tomatoes; water daily, tie up trusses.',
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CropPlanPage() {
  const [view, setView] = useState<View>('day');
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [today, setToday] = useState<Date>(() => new Date());
  const [beds, setBeds] = useState<Bed[]>(DEFAULT_BEDS);

  useEffect(() => { setBeds(loadBeds()); setToday(new Date()); }, []);

  const dayJobs = useMemo(() => jobsForDate(cursor, beds), [cursor, beds]);
  const weekStart = useMemo(() => mondayOf(cursor), [cursor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Month matrix (Monday-first weeks)
  const monthMatrix = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = mondayOf(first);
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const row = Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i));
      weeks.push(row);
      if (row[6].getMonth() !== cursor.getMonth() && w >= 4) break;
    }
    return weeks;
  }, [cursor]);

  const season = saSeason(cursor.getMonth());

  function step(dir: number) {
    if (view === 'day') setCursor((c) => addDays(c, dir));
    else if (view === 'week') setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));
  }

  const isToday = sameDay(cursor, today);
  const dayLabel = isToday ? 'Today' : DOW[(cursor.getDay() + 6) % 7];

  const TABS: { v: View; label: string }[] = [
    { v: 'day', label: 'Day' }, { v: 'week', label: 'Week' },
    { v: 'month', label: 'Month' }, { v: 'season', label: 'Season' },
  ];

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#F7F2E9' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 56, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <BackButton fallback="/plan" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Crop Plan</span>
        <div className="flex-1" />
        <SettingsButton />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full px-4 py-5" style={{ maxWidth: view === 'week' || view === 'month' ? 880 : 560 }}>

          {/* Title row */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="font-sans uppercase tracking-widest" style={{ fontSize: 11, color: '#C07A1E', letterSpacing: '0.12em' }}>Crop plan</div>
              <h1 className="font-display font-bold" style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', color: '#20190F', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {view === 'day' && `${DOW[(cursor.getDay() + 6) % 7]} · ${fmtDM(cursor)}`}
                {view === 'week' && `Week of ${fmtDM(weekStart)}`}
                {view === 'month' && `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`}
                {view === 'season' && `${season.name} ${cursor.getFullYear()}`}
              </h1>
            </div>
            {view !== 'season' && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => step(-1)} aria-label="Previous" className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                <button onClick={() => step(1)} aria-label="Next" className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}><ChevronRight size={16} /></button>
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
                {dayLabel} — {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                {dayJobs.map((job, i) => {
                  const m = JOB_META[job.type];
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: i < dayJobs.length - 1 ? '1px solid #E2D8C4' : 'none' }}>
                      <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 38, height: 38, background: m.color + '18' }}>
                        <m.Icon size={18} style={{ color: m.color }} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-semibold" style={{ fontSize: 'clamp(15px, 1.2vw, 16px)', color: '#20190F' }}>{job.title}</div>
                        <div className="font-sans" style={{ fontSize: 13, color: '#8C7A62' }}>{job.sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── WEEK ── */}
          {view === 'week' && (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {weekDays.map((d) => {
                const jobs = jobsForDate(d, beds);
                const td = sameDay(d, today);
                return (
                  <div key={d.toISOString()} className="rounded-2xl p-3" style={{ background: '#FBF6EC', border: `1px solid ${td ? '#1F4D2B' : '#E2D8C4'}` }}>
                    <div className="flex md:flex-col md:items-start items-center gap-2 mb-2">
                      <span className="font-sans font-semibold" style={{ fontSize: 13, color: td ? '#1F4D2B' : '#5C5040' }}>{DOW[(d.getDay() + 6) % 7]}</span>
                      <span className="font-display" style={{ fontSize: 13, color: '#8C7A62' }}>{d.getDate()}</span>
                    </div>
                    <div className="flex md:flex-col flex-wrap gap-1.5">
                      {jobs.map((job, i) => {
                        const m = JOB_META[job.type];
                        return (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-sans font-medium" style={{ fontSize: 12, background: m.color + '15', color: m.color }}>
                            <m.Icon size={11} strokeWidth={2} />{m.short}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── MONTH ── */}
          {view === 'month' && (
            <div className="rounded-2xl p-3 md:p-4" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DOW.map((d) => <div key={d} className="text-center font-sans" style={{ fontSize: 11, color: '#8C7A62' }}>{d}</div>)}
              </div>
              <div className="space-y-1">
                {monthMatrix.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((d) => {
                      const inMonth = d.getMonth() === cursor.getMonth();
                      const td = sameDay(d, today);
                      const jobs = jobsForDate(d, beds);
                      const types = Array.from(new Set(jobs.map((j) => j.type))).slice(0, 3);
                      return (
                        <button key={d.toISOString()} onClick={() => { setCursor(new Date(d)); setView('day'); }}
                          className="rounded-lg flex flex-col items-center justify-start py-1.5"
                          style={{ aspectRatio: '1', background: td ? '#1F4D2B' : inMonth ? 'rgba(226,216,196,0.3)' : 'transparent', border: td ? 'none' : '1px solid transparent', opacity: inMonth ? 1 : 0.35, cursor: 'pointer' }}>
                          <span className="font-display" style={{ fontSize: 13, fontWeight: td ? 700 : 500, color: td ? '#EAF3E2' : '#20190F' }}>{d.getDate()}</span>
                          {inMonth && (
                            <span className="flex gap-0.5 mt-1">
                              {types.map((t, i) => <span key={i} className="rounded-full" style={{ width: 4, height: 4, background: td ? '#EAF3E2' : JOB_META[t].color }} />)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2.5 mt-3 pt-3" style={{ borderTop: '1px solid #E2D8C4' }}>
                {(['water', 'mulch', 'feed', 'harvest'] as JobType[]).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 font-sans" style={{ fontSize: 11, color: '#5C5040' }}>
                    <span className="rounded-full" style={{ width: 6, height: 6, background: JOB_META[t].color }} />{JOB_META[t].short}
                  </span>
                ))}
              </div>
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
                <div key={m} className="rounded-2xl px-4 py-3.5" style={{ background: '#FBF6EC', border: `1px solid ${m === today.getMonth() ? '#1F4D2B40' : '#E2D8C4'}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>{MONTHS[m]}</span>
                    {m === today.getMonth() && <span className="font-sans px-2 py-0.5 rounded-full" style={{ fontSize: 11, background: 'rgba(31,77,43,0.1)', color: '#1F4D2B' }}>Now</span>}
                  </div>
                  <p className="font-sans" style={{ fontSize: 'clamp(14px, 1.1vw, 15px)', color: '#5C5040', lineHeight: 1.5 }}>{MONTH_FOCUS[m]}</p>
                </div>
              ))}
            </div>
          )}

          {/* Footer link */}
          <Link href="/plan" className="flex items-center justify-center gap-1.5 mt-6 py-3 rounded-xl font-display font-semibold" style={{ fontSize: 14, background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#1F4D2B', textDecoration: 'none' }}>
            Manage crops &amp; beds<ChevronRight size={15} />
          </Link>
        </div>
      </div>

      <TabBar />
    </div>
  );
}
