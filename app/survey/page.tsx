'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import {
  ChevronRight, ChevronLeft, Check, Droplets, Sun, CloudSun, CloudFog,
  Mountain, Minus, Plus, Printer, Sprout, Zap, Waves, Fence, Recycle, MapPin,
} from 'lucide-react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import { getLastSite } from '@/lib/last-site';
import { loadPlaces, type SavedPlace } from '@/lib/saved-places';
import LessonLink from '@/components/design/LessonLink';
import { activeAccountLocalStorageKey } from '@/lib/account-local-storage';

const BASE_SURVEY_KEY = 'imbewu_garden_survey';
function surveyKey(placeId: string | null) {
  return placeId ? `${BASE_SURVEY_KEY}_${placeId}` : `${BASE_SURVEY_KEY}_default`;
}
const PLANNER_KEY = 'imbewu_planner_crops';
const BED_M2 = 9.6; // 1.2 m × 8 m standard bed

type Sun = 'full' | 'partial' | 'shade';
type Slope = 'flat' | 'gentle' | 'steep';
type Goal = 'feed' | 'income' | 'soil';

const SUN_OPTS: { v: Sun; label: string; Icon: typeof Sun }[] = [
  { v: 'full', label: 'Full sun', Icon: Sun },
  { v: 'partial', label: 'Partial shade', Icon: CloudSun },
  { v: 'shade', label: 'Mostly shade', Icon: CloudFog },
];
const SLOPE_OPTS: { v: Slope; label: string }[] = [
  { v: 'flat', label: 'Flat' },
  { v: 'gentle', label: 'Gentle slope' },
  { v: 'steep', label: 'Steep' },
];
const RESOURCES: { v: string; label: string; Icon: typeof Zap }[] = [
  { v: 'rain-tanks', label: 'Rain tanks', Icon: Droplets },
  { v: 'borehole', label: 'Borehole', Icon: Waves },
  { v: 'municipal', label: 'Municipal water', Icon: Droplets },
  { v: 'electricity', label: 'Electricity', Icon: Zap },
  { v: 'fencing', label: 'Fencing', Icon: Fence },
  { v: 'compost', label: 'Compost area', Icon: Recycle },
];
const GOALS: { v: Goal; label: string; desc: string }[] = [
  { v: 'feed', label: 'Feed my family', desc: 'A steady spread of vegetables through the year' },
  { v: 'income', label: 'Earn an income', desc: 'Lima leans to market crops you can sell' },
  { v: 'soil', label: 'Rebuild the soil', desc: 'Cover crops and legumes to restore the land' },
];

// Season-appropriate crops to assign to beds (SA southern hemisphere).
function seasonCrops(month: number): string[] {
  if (month >= 8 && month <= 10) return ['Tomatoes', 'Beans', 'Spinach', 'Maize', 'Peppers', 'Sweet potato']; // Spring
  if (month === 11 || month <= 1) return ['Maize', 'Beans', 'Pumpkin', 'Sweet potato', 'Tomatoes', 'Peppers']; // Summer
  if (month >= 2 && month <= 4) return ['Spinach', 'Carrots', 'Garlic', 'Swiss chard', 'Beetroot', 'Peas']; // Autumn
  return ['Spinach', 'Swiss chard', 'Carrots', 'Peas', 'Broccoli', 'Beetroot']; // Winter
}

function bedLetter(i: number) { return String.fromCharCode(65 + i); }

const WEEK_PLAN = [
  { wk: 1, title: 'Mark & clear', tasks: ['Peg out the beds (1.2 m × 8 m)', 'Clear weeds and old roots', 'Dig in mature compost'] },
  { wk: 2, title: 'Water & mulch', tasks: ['Set up water near the beds', 'Mulch thickly to hold moisture', 'Rake beds level and fine'] },
  { wk: 3, title: 'Plant', tasks: ['Sow / transplant your first beds', 'Water gently morning & evening', 'Label each bed'] },
  { wk: 4, title: 'Tend', tasks: ['Water deeply, weed weekly', 'Watch for pests on new leaves', 'Fill any gaps with reseeds'] },
  { wk: 5, title: 'Feed & thin', tasks: ['Thin seedlings to spacing', 'Side-dress with compost tea', 'Stake climbers if needed'] },
  { wk: 6, title: 'First harvest', tasks: ['Pick leafy greens as they size up', 'Log harvests in the journal', 'Plan the next succession sow'] },
];

export default function SurveyPage() {
  return <Suspense><SurveyInner /></Suspense>;
}

function SurveyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPlaceId = searchParams.get('placeId');
  const month = new Date().getMonth();

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(urlPlaceId);
  const [savedPins, setSavedPins] = useState<SavedPlace[]>([]);
  useEffect(() => { setSavedPins(loadPlaces()); }, []);
  const selectedPlace = savedPins.find(p => p.id === selectedPlaceId) ?? null;

  const [step, setStep] = useState(0);          // 0..4 wizard, 5 = result
  const [sun, setSun] = useState<Sun | null>(null);
  const [slope, setSlope] = useState<Slope | null>(null);
  const [resources, setResources] = useState<string[]>([]);
  const [tanks, setTanks] = useState(2);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [beds, setBeds] = useState(4);
  const [week, setWeek] = useState(1);
  const [saved, setSaved] = useState(false);

  // Known from the map analysis (fall back to sample if no site analysed yet).
  const known = useMemo(() => {
    const ls = getLastSite();
    const ha = ls?.siteData?.areaHa ?? 0.42;
    const annual = ls?.locationData?.rainfall?.annual ?? 480;
    const rainL = Math.round(180 * annual); // ~180 m² catchment × annual mm = litres
    return { ha, rainL, hasSite: !!ls };
  }, []);

  // Suggested bed count scales modestly with land size (starter garden).
  useEffect(() => {
    setBeds(Math.max(2, Math.min(12, Math.round(known.ha * 10))));
  }, [known.ha]);

  const crops = useMemo(() => {
    let pool: string[] = [];
    try {
      const raw = localStorage.getItem(activeAccountLocalStorageKey(PLANNER_KEY));
      if (raw) pool = JSON.parse(raw) as string[];
    } catch { /* ignore */ }
    if (!pool.length) pool = seasonCrops(month);
    return pool;
  }, [month]);

  const bedCrops = Array.from({ length: beds }, (_, i) => crops[i % crops.length]);

  function toggleResource(v: string) {
    setResources((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  function save() {
    const data = { ha: known.ha, rainL: known.rainL, sun, slope, resources, tanks, goal, beds, bedCrops, placeId: selectedPlaceId, savedAt: new Date().toISOString() };
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(
        activeAccountLocalStorageKey(surveyKey(selectedPlaceId)),
        serialized,
      );
      // Crop Plan historically reads the singular key as "the latest survey".
      // Keep that cross-page contract while the per-place row remains the
      // authoritative copy for returning to a specific farm.
      localStorage.setItem(
        activeAccountLocalStorageKey(BASE_SURVEY_KEY),
        serialized,
      );
    } catch { /* ignore */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  const TOTAL = 5;
  const canNext =
    step === 0 ? true :
    step === 1 ? !!sun && !!slope :
    step === 2 ? true :
    step === 3 ? !!goal :
    true;

  const sunLabel = SUN_OPTS.find((s) => s.v === sun)?.label.toLowerCase() ?? 'full sun';
  const tanksPhrase = resources.includes('rain-tanks') ? `${tanks} tank${tanks > 1 ? 's' : ''}` : 'no tanks yet';

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      {/* Header */}
      <header className="no-print flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Garden Survey{selectedPlace ? ` · ${selectedPlace.name}` : ''}</span>
        <div className="flex-1" />
        <LessonLink id="survey:garden" label="Learn" />
        {step === 5 && (
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold"
            style={{ background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E', cursor: 'pointer' }}>
            <Printer size={13} />Print
          </button>
        )}
        <SettingsButton />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-5">

          {/* Progress (wizard steps only) */}
          {step < TOTAL && (
            <div className="no-print mb-5">
              <div className="flex gap-1.5 mb-2">
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-full" style={{ height: 4, background: i <= step ? '#1F4D2B' : 'rgba(32,25,15,0.10)' }} />
                ))}
              </div>
              <div className="text-xs font-sans uppercase tracking-widest" style={{ color: '#C07A1E', letterSpacing: '0.1em' }}>
                Your garden · {step + 1} of {TOTAL}
              </div>
            </div>
          )}

          {/* ── Step 0 · Known from the map ── */}
          {step === 0 && (
            <div className="space-y-4">
              {/* Which parcel is this survey for? */}
              {savedPins.length > 0 && (
                <div className="rounded-2xl p-3" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                  <div className="text-xs font-sans uppercase tracking-widest mb-2" style={{ color: '#8C7A62', letterSpacing: '0.1em' }}>Survey for</div>
                  <div className="flex flex-wrap gap-2">
                    {savedPins.map(p => (
                      <button key={p.id}
                        onClick={() => setSelectedPlaceId(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-display font-semibold text-sm transition-all"
                        style={{
                          background: selectedPlaceId === p.id ? '#1F4D2B' : 'rgba(31,77,43,0.07)',
                          color: selectedPlaceId === p.id ? '#fff' : '#1F4D2B',
                          border: `1.5px solid ${selectedPlaceId === p.id ? '#9BE66B' : 'rgba(31,77,43,0.2)'}`,
                          cursor: 'pointer',
                        }}>
                        <MapPin size={12} />
                        {p.name}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedPlaceId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-sm transition-all"
                      style={{
                        background: selectedPlaceId === null ? '#1F4D2B' : 'rgba(31,77,43,0.07)',
                        color: selectedPlaceId === null ? '#fff' : '#5C5040',
                        border: `1.5px solid ${selectedPlaceId === null ? '#9BE66B' : '#E2D8C4'}`,
                        cursor: 'pointer',
                      }}>
                      No parcel yet
                    </button>
                  </div>
                </div>
              )}
              <h1 className="font-display font-bold text-2xl" style={{ color: '#20190F', letterSpacing: '-0.02em' }}>Your land</h1>
              <p className="font-sans text-sm" style={{ color: '#5C5040' }}>
                Size and water come straight from your map analysis. The next steps only ask what the map can&rsquo;t see.
              </p>
              <div className="rounded-2xl p-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Check size={14} style={{ color: '#1F4D2B' }} />
                  <span className="text-xs font-sans uppercase tracking-widest" style={{ color: '#8C7A62', letterSpacing: '0.1em' }}>Already known from the map</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(31,77,43,0.06)' }}>
                    <div className="text-xs font-sans" style={{ color: '#8C7A62' }}>Land size</div>
                    <div className="font-display font-bold text-lg" style={{ color: '#20190F' }}>{known.ha} ha</div>
                  </div>
                  <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(35,94,134,0.07)' }}>
                    <div className="text-xs font-sans" style={{ color: '#8C7A62' }}>Rain caught / yr</div>
                    <div className="font-display font-bold text-lg" style={{ color: '#235E86' }}>{known.rainL.toLocaleString('en-ZA')} L</div>
                  </div>
                </div>
                <Link href="/farmer" className="flex items-center gap-1.5 mt-3 text-xs font-display font-semibold" style={{ color: '#1F4D2B', textDecoration: 'none' }}>
                  View water harvesting<ChevronRight size={13} />
                </Link>
              </div>
              {!known.hasSite && (
                <p className="text-xs font-sans flex items-center gap-1.5" style={{ color: '#8C7A62' }}>
                  <MapPin size={12} />Showing a sample plot — analyse a site on the map for your real numbers.
                </p>
              )}
            </div>
          )}

          {/* ── Step 1 · Sun & slope ── */}
          {step === 1 && (
            <div className="space-y-5">
              <h1 className="font-display font-bold text-2xl" style={{ color: '#20190F', letterSpacing: '-0.02em' }}>Sun &amp; slope</h1>
              <div>
                <div className="text-xs font-sans uppercase tracking-widest mb-2" style={{ color: '#8C7A62', letterSpacing: '0.1em' }}>How much sun does it get?</div>
                <div className="grid grid-cols-3 gap-2">
                  {SUN_OPTS.map(({ v, label, Icon }) => {
                    const on = sun === v;
                    return (
                      <button key={v} onClick={() => setSun(v)}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                        style={{ background: on ? '#1F4D2B' : '#FFFEFA', border: `1px solid ${on ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer' }}>
                        <Icon size={20} style={{ color: on ? '#EAF3E2' : '#1F4D2B' }} strokeWidth={1.6} />
                        <span className="font-display text-xs text-center" style={{ color: on ? '#EAF3E2' : '#20190F' }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs font-sans uppercase tracking-widest mb-2" style={{ color: '#8C7A62', letterSpacing: '0.1em' }}>What&rsquo;s the slope?</div>
                <div className="grid grid-cols-3 gap-2">
                  {SLOPE_OPTS.map(({ v, label }) => {
                    const on = slope === v;
                    return (
                      <button key={v} onClick={() => setSlope(v)}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                        style={{ background: on ? '#1F4D2B' : '#FFFEFA', border: `1px solid ${on ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer' }}>
                        <Mountain size={20} style={{ color: on ? '#EAF3E2' : '#1F4D2B', opacity: v === 'flat' ? 0.5 : v === 'gentle' ? 0.8 : 1 }} strokeWidth={1.6} />
                        <span className="font-display text-xs text-center" style={{ color: on ? '#EAF3E2' : '#20190F' }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2 · Resources ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h1 className="font-display font-bold text-2xl" style={{ color: '#20190F', letterSpacing: '-0.02em' }}>Resources on site</h1>
              <p className="font-sans text-sm" style={{ color: '#5C5040' }}>What&rsquo;s on the land? Tap all that apply.</p>
              <div className="flex flex-wrap gap-2">
                {RESOURCES.map(({ v, label, Icon }) => {
                  const on = resources.includes(v);
                  return (
                    <button key={v} onClick={() => toggleResource(v)}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-full transition-all"
                      style={{ background: on ? '#1F4D2B' : '#FFFEFA', border: `1px solid ${on ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer' }}>
                      <Icon size={15} style={{ color: on ? '#EAF3E2' : '#1F4D2B' }} strokeWidth={1.7} />
                      <span className="font-display text-sm" style={{ color: on ? '#EAF3E2' : '#20190F' }}>{label}</span>
                      {on && <Check size={13} style={{ color: '#EAF3E2' }} />}
                    </button>
                  );
                })}
              </div>
              {resources.includes('rain-tanks') && (
                <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                  <span className="font-display text-sm" style={{ color: '#20190F' }}>How many rain tanks?</span>
                  <div className="flex items-center gap-2 rounded-full px-1 py-1" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.12)' }}>
                    <button onClick={() => setTanks((t) => Math.max(1, t - 1))} className="flex items-center justify-center rounded-full" style={{ width: 26, height: 26, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#1F4D2B', cursor: 'pointer' }}><Minus size={13} /></button>
                    <span className="font-display font-semibold text-sm tabular-nums" style={{ color: '#20190F', minWidth: 20, textAlign: 'center' }}>{tanks}</span>
                    <button onClick={() => setTanks((t) => Math.min(20, t + 1))} className="flex items-center justify-center rounded-full" style={{ width: 26, height: 26, background: '#1F4D2B', border: 'none', color: '#EAF3E2', cursor: 'pointer' }}><Plus size={13} /></button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3 · Goal ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h1 className="font-display font-bold text-2xl" style={{ color: '#20190F', letterSpacing: '-0.02em' }}>What do you most want from your land?</h1>
              <div className="space-y-2.5">
                {GOALS.map(({ v, label, desc }) => {
                  const on = goal === v;
                  return (
                    <button key={v} onClick={() => setGoal(v)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
                      style={{ background: on ? '#1F4D2B' : '#FFFEFA', border: `1px solid ${on ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer' }}>
                      <div className="flex-1">
                        <div className="font-display font-semibold text-sm" style={{ color: on ? '#EAF3E2' : '#20190F' }}>{label}</div>
                        <div className="font-sans text-xs mt-0.5" style={{ color: on ? 'rgba(234,243,226,0.7)' : '#8C7A62' }}>{desc}</div>
                      </div>
                      <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 22, height: 22, background: on ? '#EAF3E2' : 'transparent', border: `1.5px solid ${on ? '#EAF3E2' : '#C9BBA1'}` }}>
                        {on && <Check size={13} style={{ color: '#1F4D2B' }} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 4 · Confirm beds ── */}
          {step === 4 && (
            <div className="space-y-4">
              <h1 className="font-display font-bold text-2xl" style={{ color: '#20190F', letterSpacing: '-0.02em' }}>Confirm your beds</h1>
              <div className="rounded-xl px-4 py-3 flex gap-3 items-start" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.12)' }}>
                <Sprout size={16} style={{ color: '#1F4D2B', flexShrink: 0, marginTop: 1 }} />
                <p className="text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                  Lima: From {known.ha} ha · {sunLabel} · {tanksPhrase}, I suggest <strong>{beds} beds</strong> at 1.2 m × 8 m. Adjust the count, then save your plan.
                </p>
              </div>

              {/* Bed count stepper */}
              <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                <div>
                  <div className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>{beds} beds</div>
                  <div className="font-sans text-xs" style={{ color: '#8C7A62' }}>{(beds * BED_M2).toFixed(1)} m² total growing space</div>
                </div>
                <div className="flex items-center gap-2 rounded-full px-1 py-1" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.12)' }}>
                  <button onClick={() => setBeds((b) => Math.max(1, b - 1))} className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#1F4D2B', cursor: 'pointer' }}><Minus size={14} /></button>
                  <span className="font-display font-semibold text-sm tabular-nums" style={{ color: '#20190F', minWidth: 22, textAlign: 'center' }}>{beds}</span>
                  <button onClick={() => setBeds((b) => Math.min(20, b + 1))} className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: '#1F4D2B', border: 'none', color: '#EAF3E2', cursor: 'pointer' }}><Plus size={14} /></button>
                </div>
              </div>

              {/* Bed grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {bedCrops.map((crop, i) => (
                  <div key={i} className="rounded-2xl px-3.5 py-3" style={{ background: '#1F4D2B' }}>
                    <div className="text-xs font-sans uppercase tracking-wider" style={{ color: 'rgba(234,243,226,0.6)', letterSpacing: '0.06em' }}>Bed {bedLetter(i)} · {BED_M2} m²</div>
                    <div className="font-display font-semibold text-base mt-0.5" style={{ color: '#F7F2E9' }}>{crop}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 5 · Result (printable) ── */}
          {step === 5 && (
            <div id="plan-doc" className="space-y-5">
              <div>
                <div className="text-xs font-sans uppercase tracking-widest" style={{ color: '#C07A1E', letterSpacing: '0.1em' }}>Garden plan</div>
                <h1 className="font-display font-bold text-2xl mt-0.5" style={{ color: '#20190F', letterSpacing: '-0.02em' }}>{beds} beds · {(beds * BED_M2).toFixed(1)} m²</h1>
                <p className="font-sans text-sm mt-1" style={{ color: '#5C5040' }}>
                  {known.ha} ha · {sunLabel} · {tanksPhrase}{goal ? ` · goal: ${GOALS.find((g) => g.v === goal)?.label.toLowerCase()}` : ''}
                </p>
              </div>

              {/* Beds */}
              <div className="grid grid-cols-2 gap-2.5">
                {bedCrops.map((crop, i) => (
                  <div key={i} className="rounded-2xl px-3.5 py-3" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                    <div className="text-xs font-sans uppercase tracking-wider" style={{ color: '#8C7A62', letterSpacing: '0.06em' }}>Bed {bedLetter(i)} · {BED_M2} m²</div>
                    <div className="font-display font-semibold text-base mt-0.5" style={{ color: '#20190F' }}>{crop}</div>
                  </div>
                ))}
              </div>

              {/* Week-by-week plan — slide the weeks */}
              <div>
                <div className="text-xs font-sans uppercase tracking-widest mb-2" style={{ color: '#8C7A62', letterSpacing: '0.1em' }}>First six weeks</div>
                <div className="no-print flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {WEEK_PLAN.map((w) => {
                    const on = week === w.wk;
                    return (
                      <button key={w.wk} onClick={() => setWeek(w.wk)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-full font-display text-xs font-semibold transition-all"
                        style={{ background: on ? '#1F4D2B' : '#FFFEFA', border: `1px solid ${on ? '#1F4D2B' : '#E2D8C4'}`, color: on ? '#EAF3E2' : '#5C5040', cursor: 'pointer' }}>
                        Week {w.wk}
                      </button>
                    );
                  })}
                </div>
                {/* Screen: selected week. Print: all weeks. */}
                {WEEK_PLAN.filter((w) => w.wk === week).map((w) => (
                  <div key={w.wk} className="no-print rounded-2xl px-4 py-3.5 mt-2" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                    <div className="font-display font-semibold text-sm mb-2" style={{ color: '#1F4D2B' }}>Week {w.wk} · {w.title}</div>
                    {w.tasks.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 py-1">
                        <div className="rounded-full flex-shrink-0 mt-1.5" style={{ width: 5, height: 5, background: '#C07A1E' }} />
                        <span className="font-sans text-sm" style={{ color: '#20190F' }}>{t}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {/* Print-only: every week stacked */}
                <div className="print-only space-y-2 mt-2">
                  {WEEK_PLAN.map((w) => (
                    <div key={w.wk} className="rounded-2xl px-4 py-3" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                      <div className="font-display font-semibold text-sm mb-1" style={{ color: '#1F4D2B' }}>Week {w.wk} · {w.title}</div>
                      {w.tasks.map((t, i) => <div key={i} className="font-sans text-sm" style={{ color: '#20190F' }}>· {t}</div>)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="no-print space-y-2.5">
                <button onClick={save}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-semibold"
                  style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer' }}>
                  <Check size={15} />{saved ? 'Saved!' : 'Save this plan'}
                </button>
                <Link href="/plan"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-semibold"
                  style={{ background: '#FFFEFA', color: '#1F4D2B', border: '1px solid #E2D8C4', textDecoration: 'none' }}>
                  Open the Crop Planner<ChevronRight size={15} />
                </Link>
              </div>

              <div className="print-only text-center text-xs font-sans" style={{ color: '#8C7A62' }}>
                Generated by ImbewuField · fieldproof.vercel.app
              </div>
            </div>
          )}

          {/* ── Nav buttons ── */}
          <div className="no-print flex gap-2 mt-6">
            {step > 0 && step <= 5 && (
              <button onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-display font-semibold"
                style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                <ChevronLeft size={15} />Back
              </button>
            )}
            {step < 4 && (
              <button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-display font-semibold"
                style={{ background: canNext ? '#1F4D2B' : 'rgba(226,216,196,0.6)', color: canNext ? '#F7F2E9' : '#8C7A62', border: 'none', cursor: canNext ? 'pointer' : 'not-allowed' }}>
                Continue<ChevronRight size={15} />
              </button>
            )}
            {step === 4 && (
              <button onClick={() => { setStep(5); window.scrollTo(0, 0); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-display font-semibold"
                style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer' }}>
                See my plan<ChevronRight size={15} />
              </button>
            )}
            {step === 5 && (
              <button onClick={() => router.push('/home')}
                className="flex-1 flex items-center justify-center py-3 rounded-xl text-sm font-display font-semibold"
                style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="no-print"><TabBar /></div>

      <style jsx global>{`
        .print-only { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 18mm 16mm; }
          *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-shadow: none !important; }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .fixed, [style*="position: fixed"], [style*="position:fixed"] { position: static !important; height: auto !important; overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
