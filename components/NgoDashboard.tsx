'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactMapGL, { Marker, type MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, MapPin, User, Camera, BookOpen, Check, Map as MapIcon, FileText, ArrowLeft } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { listGardens, listGardeners, getGardenerProfile } from '@/lib/db/queries';
import { getFirebase } from '@/lib/firebase/init';
import { COURSE_MODULES } from '@/lib/course-modules';
import type { Garden as DbGarden, GardenMember, Profile, GardenerProfile as DbGardenerProfile, ProductionLog, SalesLog, CourseProgress } from '@/lib/db/types';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type Status = 'thriving' | 'establishing' | 'support';
const STATUS: Record<Status, { label: string; color: string }> = {
  thriving: { label: 'Thriving', color: '#1F4D2B' },
  establishing: { label: 'Establishing', color: '#9E5C08' },
  support: { label: 'Needs support', color: '#C0531E' },
};

interface Garden { id: string; name: string; town: string; lat: number; lon: number; farmers: number; status: Status; produceKg: number; training: number; facilitator: string }

// ── fallback sample data (kept as-is for demo mode) ──
const SAMPLE_GARDENS: Garden[] = [
  { id: 'g1', name: 'Siyazama Community Garden', town: 'Soweto, GP', lat: -26.267, lon: 27.858, farmers: 28, status: 'thriving', produceKg: 1240, training: 92, facilitator: 'Nomsa M.' },
  { id: 'g2', name: 'Umlazi Food Garden', town: 'Umlazi, KZN', lat: -29.966, lon: 30.889, farmers: 19, status: 'thriving', produceKg: 980, training: 84, facilitator: 'Sipho D.' },
  { id: 'g3', name: 'Mthatha Permaculture Hub', town: 'Mthatha, EC', lat: -31.589, lon: 28.783, farmers: 22, status: 'establishing', produceKg: 410, training: 61, facilitator: 'Thandi N.' },
  { id: 'g4', name: 'Gugulethu Greens', town: 'Gugulethu, WC', lat: -33.98, lon: 18.571, farmers: 16, status: 'thriving', produceKg: 1130, training: 88, facilitator: 'Aviwe K.' },
  { id: 'g5', name: 'Tzaneen Agroecology Plot', town: 'Tzaneen, LP', lat: -23.833, lon: 30.163, farmers: 31, status: 'thriving', produceKg: 1560, training: 79, facilitator: 'Rofhiwa M.' },
  { id: 'g6', name: 'Botshabelo Plots', town: 'Botshabelo, FS', lat: -29.27, lon: 26.74, farmers: 14, status: 'support', produceKg: 180, training: 38, facilitator: 'Lerato S.' },
  { id: 'g7', name: 'Kuyasa Kitchen Garden', town: 'Khayelitsha, WC', lat: -34.043, lon: 18.681, farmers: 20, status: 'establishing', produceKg: 520, training: 66, facilitator: 'Aviwe K.' },
  { id: 'g8', name: 'Giyani Indigenous Garden', town: 'Giyani, LP', lat: -23.302, lon: 30.718, farmers: 25, status: 'thriving', produceKg: 1020, training: 81, facilitator: 'Rofhiwa M.' },
  { id: 'g9', name: 'Mdantsane Veg Co-op', town: 'Mdantsane, EC', lat: -32.94, lon: 27.78, farmers: 18, status: 'establishing', produceKg: 470, training: 58, facilitator: 'Thandi N.' },
  { id: 'g10', name: 'Galeshewe Food Forest', town: 'Kimberley, NC', lat: -28.715, lon: 24.733, farmers: 12, status: 'support', produceKg: 140, training: 32, facilitator: 'Lerato S.' },
  { id: 'g11', name: 'Bushbuckridge Garden', town: 'Bushbuckridge, MP', lat: -24.83, lon: 31.08, farmers: 27, status: 'thriving', produceKg: 1310, training: 86, facilitator: 'Sipho D.' },
  { id: 'g12', name: 'Rustenburg Roots', town: 'Rustenburg, NW', lat: -25.667, lon: 27.242, farmers: 17, status: 'establishing', produceKg: 600, training: 64, facilitator: 'Nomsa M.' },
];
const TOTALS = { gardens: 142, farmers: 3012, produceT: 38.6, training: 78, deployed: 'R48.6m' };

const NAMES = ['Thabo Mahlangu', 'Nosipho Khumalo', 'Jabu Dlamini', 'Maria Sithole', 'Andile Ngubane', 'Grace Mokoena', 'Sibusiso Ndlovu', 'Lerato Phiri', 'Bongani Zulu', 'Precious Mbeki'];
const CROPS = [
  { n: 'Spinach', e: '🥬', c: '#3F7A3C' }, { n: 'Tomatoes', e: '🍅', c: '#B83C2E' }, { n: 'Cabbage', e: '🥬', c: '#6BA84F' },
  { n: 'Carrots', e: '🥕', c: '#C97A2C' }, { n: 'Onions', e: '🧅', c: '#C2A05A' }, { n: 'Maize', e: '🌽', c: '#D9B23A' },
  { n: 'Beans', e: '🫘', c: '#7A5230' }, { n: 'Pumpkin', e: '🎃', c: '#CC7A28' }, { n: 'Sweet potato', e: '🍠', c: '#A85E3C' }, { n: 'Green pepper', e: '🫑', c: '#3F8B3C' },
];
const MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun'];
const BUYERS = ['Local market', 'Spaza shop', 'School feeding', 'Bakkie trader', 'Neighbours'];
function seeded(seed: string) {
  let s = 2166136261;
  for (const ch of seed) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const rint = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));

interface ProdRow { date: string; crop: typeof CROPS[number]; kg: number; photoUrl?: string | null }
interface SaleRow { date: string; crop: typeof CROPS[number]; kg: number; rand: number; buyer: string }
interface Gardener {
  id: string; profileId: string; name: string; plot: string; idNumber: string; sizeM2: number; lat: number; lon: number;
  trainingPct: number; courses: { name: string; done: boolean }[]; production: ProdRow[]; sales: SaleRow[];
}

function gardenersFor(garden: Garden): Gardener[] {
  const r = seeded(garden.id);
  const n = rint(r, 3, 4);
  return Array.from({ length: n }).map((_, i) => {
    const trainingPct = Math.max(20, Math.min(100, garden.training + rint(r, -14, 14)));
    const doneCount = Math.round((trainingPct / 100) * COURSE_MODULES.length);
    return {
      id: `${garden.id}-${i}`,
      profileId: `${garden.id}-${i}`,
      name: NAMES[(i * 3 + garden.id.length * 2) % NAMES.length],
      plot: `Plot ${i + 1}`,
      idNumber: `${rint(r, 70, 99)}${rint(r, 10, 12)}${rint(r, 10, 28)}••••${pick(r, ['08', '18', '19'])}${rint(r, 0, 9)}`,
      sizeM2: rint(r, 80, 620),
      lat: garden.lat + (r() - 0.5) * 0.012,
      lon: garden.lon + (r() - 0.5) * 0.012,
      trainingPct,
      courses: COURSE_MODULES.map((module, idx) => ({ name: module.title, done: idx < doneCount })),
      production: Array.from({ length: rint(r, 4, 6) }).map(() => ({ date: `${rint(r, 2, 27)} ${pick(r, MONTHS)}`, crop: pick(r, CROPS), kg: rint(r, 4, 38) })),
      sales: Array.from({ length: rint(r, 2, 4) }).map(() => { const kg = rint(r, 3, 22); return { date: `${rint(r, 2, 27)} ${pick(r, MONTHS)}`, crop: pick(r, CROPS), kg, rand: kg * rint(r, 11, 19), buyer: pick(r, BUYERS) }; }),
    };
  });
}

// ── helpers to map live DB types onto the UI shape ──

function cropForName(name: string): typeof CROPS[number] {
  const found = CROPS.find((c) => name.toLowerCase().includes(c.n.toLowerCase()));
  return found ?? CROPS[0];
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
  } catch { return iso.slice(0, 10); }
}

function mapDbGarden(g: DbGarden): Garden {
  return {
    id: g.id,
    name: g.name,
    town: g.town ?? '',
    lat: g.lat ?? -29,
    lon: g.lon ?? 25,
    farmers: (g as { farmers_count?: number }).farmers_count ?? 0,
    status: (g.status as Status) ?? 'establishing',
    produceKg: (g as { produce_kg?: number }).produce_kg ?? 0,
    training: (g as { training_pct?: number }).training_pct ?? 0,
    facilitator: '',
  };
}

function mapDbGardener(
  profile: Profile,
  member: GardenMember,
  garden: Garden,
): Gardener {
  return {
    id: member.id,
    profileId: profile.id,
    name: profile.full_name ?? 'Unknown',
    plot: member.plot ?? 'Plot',
    idNumber: profile.id_number ?? '••••••••',
    sizeM2: member.size_m2 ?? 0,
    lat: member.lat ?? garden.lat,
    lon: member.lon ?? garden.lon,
    trainingPct: 0,
    courses: [],
    production: [],
    sales: [],
  };
}

function mapDbGardenerFull(gp: DbGardenerProfile, garden: Garden, base: Gardener): Gardener {
  const { profile, production, sales, courses } = gp;

  const doneCount = courses.filter((c) => c.done).length;
  const trainingPct = COURSE_MODULES.length > 0 ? Math.round((doneCount / COURSE_MODULES.length) * 100) : 0;

  const courseMap = new Map<string, boolean>();
  courses.forEach((c: CourseProgress) => courseMap.set(c.module, c.done));
  const mappedCourses = COURSE_MODULES.map((module) => ({ name: module.title, done: courseMap.get(module.id) ?? false }));

  const mappedProd: ProdRow[] = production.map((p: ProductionLog) => ({
    date: fmtDate(p.logged_at),
    crop: cropForName(p.crop),
    kg: p.kg,
    photoUrl: p.photo_url,
  }));

  const mappedSales: SaleRow[] = sales.map((s: SalesLog) => ({
    date: fmtDate(s.sold_at),
    crop: cropForName(s.crop),
    kg: s.kg,
    rand: s.amount,
    buyer: s.buyer ?? 'Unknown',
  }));

  // Member fields (plot/size/coords/id) come from `base` — the gardener the caller
  // already loaded via listGardeners; gp carries the production/sales/courses.
  return {
    id: base.id,
    profileId: profile.id,
    name: profile.full_name ?? base.name,
    plot: base.plot,
    idNumber: profile.id_number ?? base.idNumber,
    sizeM2: base.sizeM2,
    lat: base.lat,
    lon: base.lon,
    trainingPct,
    courses: mappedCourses,
    production: mappedProd,
    sales: mappedSales,
  };
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl p-3 flex-1" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#9A8268' }}>{label}</div>
      <div className="font-display font-bold text-2xl mt-0.5" style={{ color }}>{value}</div>
      <div className="text-xs font-mono mt-0.5" style={{ color: '#9A8268' }}>{sub}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="animate-spin" size={20} style={{ color: '#1F4D2B' }} />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
      <div className="rounded-full flex-shrink-0" style={{ width: 26, height: 26, background: '#EDE7DB' }} />
      <div className="flex-1 space-y-1">
        <div className="rounded" style={{ height: 10, width: '60%', background: '#EDE7DB' }} />
        <div className="rounded" style={{ height: 8, width: '40%', background: '#EDE7DB' }} />
      </div>
    </div>
  );
}

function initials(name: string) { return name.split(' ').map((p) => p[0]).join('').slice(0, 2); }

export default function NgoDashboard({ mode = 'ngo' }: { mode?: 'ngo' | 'funder' }) {
  const [garden, setGarden] = useState<Garden | null>(null);
  const [gardener, setGardener] = useState<Gardener | null>(null);
  const mapRef = useRef<MapRef>(null);

  // Live data state
  const [liveGardens, setLiveGardens] = useState<Garden[] | null>(null); // null = loading, [] = confirmed empty
  const [isDemo, setIsDemo] = useState(false);
  const [gardensLoadError, setGardensLoadError] = useState(false);
  const [gardensLoading, setGardensLoading] = useState(true);

  // Per-garden gardeners (live)
  const [liveGardeners, setLiveGardeners] = useState<Gardener[] | null>(null);
  const [gardenersLoading, setGardenersLoading] = useState(false);
  const [gardenersProfileIds, setGardenersProfileIds] = useState<Map<string, string>>(new Map()); // gardenerId → profileId

  // Per-gardener full profile (live)
  const [gardenerLoading, setGardenerLoading] = useState(false);
  const [gardenerError, setGardenerError] = useState(false);

  // Wait for Firebase auth to rehydrate before querying — otherwise the first
  // fetch races ahead of currentUser and the rules deny it (→ false demo mode).
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const fb = getFirebase();
    if (!fb) { setAuthReady(true); return; } // no backend → straight to sample mode
    const unsub = onAuthStateChanged(fb.auth, () => setAuthReady(true));
    return () => unsub();
  }, []);

  // ── Fetch gardens once auth is ready ──
  useEffect(() => {
    if (!authReady) return;
    const fb = getFirebase();
    if (!fb) {
      setIsDemo(true);
      setLiveGardens(null);
      setGardensLoadError(false);
      setGardensLoading(false);
      return;
    }
    let cancelled = false;
    setGardensLoading(true);
    setIsDemo(false);
    setGardensLoadError(false);
    listGardens()
      .then((rows) => {
        if (cancelled) return;
        setLiveGardens(rows.map(mapDbGarden));
      })
      .catch(() => {
        if (!cancelled) {
          setIsDemo(false);
          setLiveGardens([]);
          setGardensLoadError(true);
        }
      })
      .finally(() => { if (!cancelled) setGardensLoading(false); });
    return () => { cancelled = true; };
  }, [authReady]);

  // Which gardens to display
  const gardens = useMemo<Garden[]>(() => {
    if (isDemo) return SAMPLE_GARDENS;
    return liveGardens ?? [];
  }, [isDemo, liveGardens]);

  const dashboardTotals = useMemo(() => {
    if (isDemo) return TOTALS;
    const farmers = gardens.reduce((sum, g) => sum + g.farmers, 0);
    const produceKg = gardens.reduce((sum, g) => sum + g.produceKg, 0);
    const training = gardens.length > 0
      ? Math.round(gardens.reduce((sum, g) => sum + g.training, 0) / gardens.length)
      : 0;
    return { gardens: gardens.length, farmers, produceT: produceKg / 1000, training, deployed: null };
  }, [gardens, isDemo]);

  // ── Fetch gardeners when a garden is selected ──
  useEffect(() => {
    if (!garden) { setLiveGardeners(null); return; }
    if (isDemo) return; // use sample generator

    let cancelled = false;
    setGardenersLoading(true);
    setLiveGardeners(null);
    listGardeners(garden.id)
      .then((rows) => {
        if (cancelled) return;
        const idMap = new Map<string, string>();
        const mapped = rows.map(({ member, profile }) => {
          const g = mapDbGardener(profile, member, garden);
          idMap.set(g.id, profile.id);
          return g;
        });
        setLiveGardeners(mapped);
        setGardenersProfileIds(idMap);
      })
      .catch(() => { if (!cancelled) setLiveGardeners([]); })
      .finally(() => { if (!cancelled) setGardenersLoading(false); });
    return () => { cancelled = true; };
  }, [garden, isDemo]);

  // Sample gardeners (for demo mode)
  const sampleGardeners = useMemo(() => (garden ? gardenersFor(garden) : []), [garden]);

  const gardeners = useMemo<Gardener[]>(() => {
    if (isDemo) return sampleGardeners;
    return liveGardeners ?? [];
  }, [isDemo, liveGardeners, sampleGardeners]);

  // ── Open a gardener: fetch full profile for live mode ──
  const openGardener = useCallback(async (gr: Gardener) => {
    mapRef.current?.flyTo({ center: [gr.lon, gr.lat], zoom: 15, duration: 1500 });

    if (isDemo) {
      setGardener(gr);
      return;
    }

    const profileId = gardenersProfileIds.get(gr.id) ?? gr.profileId;
    setGardenerLoading(true);
    setGardenerError(false);
    setGardener(gr); // show skeleton immediately

    try {
      const gp = await getGardenerProfile(profileId);
      if (gp && garden) {
        const full = mapDbGardenerFull(gp, garden, gr);
        setGardener(full);
      }
    } catch {
      // The skeleton shape already set (from mapDbGardener) reads as a real, verified zero —
      // "Produced 0kg", "0% training" — for a real farmer a facilitator may be about to make a
      // support decision on. gardenerError stops that render and asks instead of asserting it.
      setGardenerError(true);
    } finally {
      setGardenerLoading(false);
    }
  }, [isDemo, gardenersProfileIds, garden]);

  const selectGarden = useCallback((g: Garden) => {
    setGarden(g);
    setGardener(null);
    setLiveGardeners(null);
  }, []);

  const totals = gardener && (() => {
    const produced = gardener.production.reduce((s, p) => s + p.kg, 0);
    const soldKg = gardener.sales.reduce((s, p) => s + p.kg, 0);
    const soldR = gardener.sales.reduce((s, p) => s + p.rand, 0);
    // A negative difference means some picking was not logged (or a sale was
    // from an earlier harvest), so zero would be a made-up kept amount.
    const kept = soldKg <= produced ? produced - soldKg : null;
    // Sales are measured money. Kept food is measured weight, not a rand value:
    // one blanket price hid an assumption inside what looked like earnings.
    return { produced, soldKg, soldR, kept };
  })();

  const photoCrops = gardener ? Array.from(new Map(gardener.production.map((p) => [p.crop.n, { crop: p.crop, photoUrl: p.photoUrl }])).values()).slice(0, 5) : [];

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* Stat row — 2×2 grid on mobile (fits 375px), 4-across flex row on desktop */}
      <div className="flex-shrink-0 grid grid-cols-2 gap-2 px-3 py-3 md:flex md:gap-3 md:px-4" style={{ borderBottom: '1px solid #E2D8C4' }}>
        {mode === 'funder' ? (
          <>
            {isDemo && <Stat label="Funds deployed" value={TOTALS.deployed} sub="presidential fund + IDC" color="#9E5C08" />}
            <Stat label="Gardens" value={dashboardTotals.gardens.toString()} sub={isDemo ? '9 provinces' : 'in your organisation'} color="#1F4D2B" />
            <Stat label="Livelihoods" value={dashboardTotals.farmers.toLocaleString()} sub="farmers supported" color="#20190F" />
            <Stat label="Food grown" value={`${dashboardTotals.produceT} t`} sub="this season" color="#2F6F9E" />
          </>
        ) : (
          <>
            <Stat label="Active gardens" value={dashboardTotals.gardens.toString()} sub={isDemo ? 'across 9 provinces' : 'in your organisation'} color="#1F4D2B" />
            <Stat label="Farmers" value={dashboardTotals.farmers.toLocaleString()} sub="enrolled this cycle" color="#20190F" />
            <Stat label="Produce, season" value={`${dashboardTotals.produceT} t`} sub="logged by supervisors" color="#2F6F9E" />
            <Stat label="Training done" value={`${dashboardTotals.training}%`} sub="across active gardens" color="#9E5C08" />
          </>
        )}
      </div>

      {/*
        Main body: 3-column layout on desktop, stacked on mobile.
        LEFT  — gardens list sidebar (~380px, always visible)
        CENTRE — map (flex-1, fills all remaining width)
        RIGHT  — detail panel (380px, only rendered when garden/gardener selected)

        On mobile (<768px) the columns stack: list on top, map below, detail below that.
      */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden" style={{ minHeight: 0 }}>

        {/* LEFT — gardens list. Full-width on mobile; hidden on mobile once a garden is
            selected (the detail panel takes over). Fixed 380px sidebar on desktop. */}
        <div
          className={`${garden ? 'hidden md:block' : 'block'} w-full md:w-[380px] md:flex-shrink-0 overflow-y-auto`}
          style={{
            background: '#F5F0E8',
            borderRight: '1px solid #E2D8C4',
          }}
        >
          {/* ── LEVEL 1 — gardens list ── */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#9A8268' }}>
                {mode === 'funder' ? 'Funded gardens' : 'Gardens'}
              </div>
              {isDemo && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(158,92,8,0.12)', color: '#9E5C08', border: '1px solid rgba(158,92,8,0.3)' }}>demo sample</span>
              )}
            </div>
            {gardensLoading ? (
              <div className="space-y-1">
                <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
              </div>
            ) : gardensLoadError ? (
              <div className="rounded-lg px-3 py-4 text-xs font-sans leading-relaxed" style={{ background: '#FFFEFA', border: '1px solid #D8B7A8', color: '#8C4938' }}>
                We could not load the gardens for this organisation. Check your account access and try again.
              </div>
            ) : gardens.length === 0 ? (
              <div className="rounded-lg px-3 py-4 text-xs font-sans leading-relaxed" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#8C7A62' }}>
                No gardens have been added yet.
              </div>
            ) : (
              <div className="space-y-1">
                {gardens.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => selectGarden(g)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                    style={{
                      background: garden?.id === g.id ? 'rgba(31,77,43,0.12)' : '#F5F0E8',
                      border: garden?.id === g.id ? '1px solid rgba(31,77,43,0.4)' : '1px solid #E2D8C4',
                    }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS[g.status].color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-display font-medium truncate" style={{ color: '#20190F' }}>{g.name}</div>
                      <div className="text-xs font-mono" style={{ color: '#9A8268' }}>{g.town} · {g.farmers || '—'} farmers</div>
                    </div>
                    <span className="text-xs font-mono flex-shrink-0" style={{ color: '#2F6F9E' }}>{g.produceKg > 0 ? `${g.produceKg}kg` : '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTRE — map. Fixed-height band on mobile, hidden once a garden is selected;
            fills remaining width on desktop. */}
        <div className={`${garden ? 'hidden md:block' : 'block'} relative h-[42vh] md:h-auto md:flex-1`} style={{ minWidth: 0 }}>
          <div className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-lg pointer-events-none" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <span className="text-xs font-mono flex items-center gap-1" style={{ color: '#9A8268' }}>
              {gardener
                ? <><MapPin size={12} style={{ color: '#9A8268' }} /> {`${gardener.name} · ${gardener.lat.toFixed(4)}, ${gardener.lon.toFixed(4)}`}</>
                : isDemo
                  ? `Showing ${gardens.length} of ${TOTALS.gardens} gardens · demo`
                  : gardensLoadError
                    ? 'Gardens unavailable'
                    : `Showing ${gardens.length} gardens`}
            </span>
          </div>
          <ReactMapGL ref={mapRef} mapboxAccessToken={TOKEN} initialViewState={{ longitude: 25, latitude: -29, zoom: 4.4 }} mapStyle="mapbox://styles/mapbox/dark-v11" style={{ width: '100%', height: '100%' }}>
            {gardens.map((g) => (
              <Marker key={g.id} longitude={g.lon} latitude={g.lat} anchor="center">
                <button onClick={() => selectGarden(g)} className="rounded-full transition-all"
                  style={{ width: garden?.id === g.id ? 18 : 13, height: garden?.id === g.id ? 18 : 13, background: STATUS[g.status].color, border: '2px solid #fff', boxShadow: garden?.id === g.id ? `0 0 0 4px ${STATUS[g.status].color}55` : '0 1px 4px rgba(31,25,15,0.12)', cursor: 'pointer' }} title={g.name} />
              </Marker>
            ))}
            {gardener && (
              <Marker longitude={gardener.lon} latitude={gardener.lat} anchor="center">
                <div className="rounded-full flex items-center justify-center" style={{ width: 26, height: 26, background: '#1F4D2B', border: '3px solid #fff', boxShadow: '0 0 0 6px rgba(31,77,43,0.35)' }}><User size={13} color="#fff" /></div>
              </Marker>
            )}
          </ReactMapGL>
          <div className="absolute bottom-3 left-3 z-10 flex gap-3 px-3 py-1.5 rounded-lg" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            {(Object.keys(STATUS) as Status[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS[s].color }} />
                <span className="text-xs font-mono" style={{ color: '#9A8268' }}>{STATUS[s].label}</span>
              </div>
            ))}
          </div>
          {/* "Select a garden" placeholder — shown only when no garden is selected */}
          {!garden && (
            <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none z-10">
              <div className="px-4 py-2 rounded-xl text-xs font-mono" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#9A8268' }}>
                Select a garden from the list to drill in
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — detail panel, rendered only when a garden or gardener is selected */}
        {garden && (
          <div
            className="w-full md:w-[380px] md:flex-shrink-0 overflow-y-auto"
            style={{ background: '#F5F0E8', borderLeft: '1px solid #E2D8C4' }}
          >
            {gardener && totals ? (
              /* ── LEVEL 3 — gardener profile ── */
              <div className="p-4 space-y-3">
                <button onClick={() => setGardener(null)} className="text-xs font-mono flex items-center gap-1" style={{ color: '#9A8268' }}><ArrowLeft size={14} /> {garden.name}</button>

                {/* Identity */}
                <div className="flex items-center gap-3">
                  <div className="rounded-full flex items-center justify-center flex-shrink-0 relative" style={{ width: 48, height: 48, background: 'rgba(31,77,43,0.18)', border: '1px solid rgba(31,77,43,0.4)', color: '#1F4D2B', fontWeight: 600 }}>
                    {initials(gardener.name)}
                    <span className="absolute -bottom-1 -right-1"><Camera size={10} style={{ color: '#1F4D2B' }} /></span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-base truncate" style={{ color: '#20190F' }}>{gardener.name}</div>
                    <div className="text-xs font-mono" style={{ color: '#9A8268' }}>ID {gardener.idNumber}</div>
                    <div className="text-xs font-mono" style={{ color: '#9A8268' }}>{gardener.plot} · {gardener.sizeM2} m² · {garden.town}</div>
                  </div>
                </div>
                <button onClick={() => mapRef.current?.flyTo({ center: [gardener.lon, gardener.lat], zoom: 16, duration: 1200 })}
                  className="w-full py-1.5 rounded-lg text-xs font-display transition-all flex items-center justify-center gap-1.5" style={{ background: 'rgba(47,111,158,0.14)', border: '1px solid rgba(47,111,158,0.4)', color: '#2F6F9E' }}>
                  <MapPin size={14} /> Find this garden on the map
                </button>

                {gardenerLoading ? (
                  <Spinner />
                ) : gardenerError ? (
                  <div className="rounded-lg px-3 py-4 text-xs font-sans leading-relaxed" style={{ background: '#FFFEFA', border: '1px solid #D8B7A8', color: '#8C4938' }}>
                    We could not load {gardener.name}&apos;s production, sales and training data. Check your account access and try again.
                    <button
                      onClick={() => { void openGardener(gardener); }}
                      className="block mt-2 text-xs font-display font-semibold underline"
                      style={{ color: '#1F4D2B', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Value summary */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded-lg" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4' }}><div className="text-xs font-mono" style={{ color: '#9A8268' }}>Produced</div><div className="text-base font-display font-semibold" style={{ color: '#1F4D2B' }}>{totals.produced}<span className="text-xs"> kg</span></div></div>
                      <div className="p-2 rounded-lg" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4' }}><div className="text-xs font-mono" style={{ color: '#9A8268' }}>Sold</div><div className="text-base font-display font-semibold" style={{ color: '#20190F' }}>{totals.soldKg}<span className="text-xs"> kg</span></div></div>
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.25)' }}><div className="text-xs font-mono" style={{ color: '#9A8268' }}>Sales received</div><div className="text-base font-display font-semibold" style={{ color: '#9E5C08' }}>R{totals.soldR.toLocaleString()}</div></div>
                    </div>
                    <p className="text-xs font-sans mt-2" style={{ color: '#5C5040' }}>
                      {totals.kept === null
                        ? 'Food kept: not known — more was sold than harvested was logged'
                        : `Food kept: ${totals.kept} kg`}
                    </p>

                    {/* Courses */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#9A8268' }}>Courses & training</div>
                        <span className="text-xs font-mono" style={{ color: '#1F4D2B' }}>{gardener.trainingPct}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {gardener.courses.map((c) => (
                          <div key={c.name} className="flex items-center gap-1.5 text-xs font-display px-2 py-1 rounded-lg" style={{ background: '#F5F0E8' }}>
                            <span className="flex-shrink-0" style={{ color: c.done ? '#1F4D2B' : '#9A8268' }}>{c.done ? <Check size={10} /> : '○'}</span>
                            <span className="truncate" style={{ color: c.done ? '#5C5040' : '#9A8268' }}>{c.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Garden design + report */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg overflow-hidden" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4' }}>
                        <div className="flex items-center justify-center" style={{ height: 54, background: 'rgba(47,111,158,0.12)' }}><MapIcon size={22} style={{ color: '#2F6F9E' }} /></div>
                        <div className="px-2 py-1.5"><div className="text-xs font-display font-medium" style={{ color: '#20190F' }}>Garden design</div><div className="text-xs font-mono" style={{ color: '#2F6F9E' }}>view</div></div>
                      </div>
                      <div className="rounded-lg overflow-hidden" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4' }}>
                        <div className="flex items-center justify-center" style={{ height: 54, background: 'rgba(158,92,8,0.12)' }}><FileText size={22} style={{ color: '#9E5C08' }} /></div>
                        <div className="px-2 py-1.5"><div className="text-xs font-display font-medium" style={{ color: '#20190F' }}>Garden report</div><div className="text-xs font-mono" style={{ color: '#9E5C08' }}>view</div></div>
                      </div>
                    </div>

                    {/* Produce photos */}
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#9A8268' }}>Produce photos</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {photoCrops.map(({ crop: c, photoUrl }, i) => (
                          photoUrl ? (
                            <div key={i} className="rounded-lg overflow-hidden" style={{ width: 54, height: 54, border: `1px solid ${c.c}` }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={photoUrl} alt={c.n} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div key={i} className="rounded-lg flex flex-col items-center justify-center" style={{ width: 54, height: 54, background: `${c.c}33`, border: `1px solid ${c.c}` }}><span style={{ fontSize: 20 }}>{c.e}</span><span className="font-mono" style={{ fontSize: 8, color: '#9A8268' }}>{c.n}</span></div>
                          )
                        ))}
                      </div>
                    </div>

                    {/* Books — production */}
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: '#9A8268' }}><BookOpen size={13} /> Books — production</div>
                      <div className="space-y-1">
                        {gardener.production.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-display px-2 py-1 rounded-lg" style={{ background: '#F5F0E8' }}><span style={{ fontSize: 13 }}>{p.crop.e}</span><span className="flex-1" style={{ color: '#5C5040' }}>{p.crop.n}</span><span className="font-mono" style={{ color: '#9A8268' }}>{p.date}</span><span className="font-mono font-semibold" style={{ color: '#1F4D2B' }}>{p.kg}kg</span></div>
                        ))}
                      </div>
                    </div>

                    {/* Books — sales */}
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: '#9A8268' }}><BookOpen size={13} /> Books — sales</div>
                      <div className="space-y-1">
                        {gardener.sales.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-display px-2 py-1 rounded-lg" style={{ background: '#F5F0E8' }}><span style={{ fontSize: 13 }}>{p.crop.e}</span><span className="flex-1 truncate" style={{ color: '#5C5040' }}>{p.kg}kg → {p.buyer}</span><span className="font-mono font-semibold" style={{ color: '#2F6F9E' }}>R{p.rand}</span></div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* ── LEVEL 2 — garden + gardeners ── */
              <div className="p-4 space-y-3">
                <button onClick={() => setGarden(null)} className="text-xs font-mono flex items-center gap-1" style={{ color: '#9A8268' }}><ArrowLeft size={14} /> all gardens</button>
                <div>
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS[garden.status].color }} /><span className="font-display font-bold text-base" style={{ color: '#20190F' }}>{garden.name}</span></div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#9A8268' }}>{garden.town}{garden.facilitator ? ` · supervisor ${garden.facilitator}` : ''}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[['Farmers', garden.farmers || gardeners.length, '#20190F'], ['Produce', `${garden.produceKg || gardeners.reduce((s, g) => s + g.production.reduce((a, p) => a + p.kg, 0), 0)}kg`, '#2F6F9E'], ['Training', garden.training ? `${garden.training}%` : '—', '#9E5C08']].map(([l, v, c]) => (
                    <div key={l as string} className="p-2 rounded-lg" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4' }}><div className="text-xs font-mono" style={{ color: '#9A8268' }}>{l}</div><div className="text-sm font-display font-semibold" style={{ color: c as string }}>{v}</div></div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#9A8268' }}>Gardeners — tap for full record</div>
                  {gardenersLoading ? (
                    <div className="space-y-1">
                      <SkeletonRow /><SkeletonRow /><SkeletonRow />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {gardeners.map((gr) => {
                        const prod = gr.production.reduce((s, p) => s + p.kg, 0);
                        return (
                          <button key={gr.id} onClick={() => openGardener(gr)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
                            <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, background: 'rgba(31,77,43,0.18)', color: '#1F4D2B', fontSize: 10, fontWeight: 600 }}>{initials(gr.name)}</div>
                            <div className="flex-1 min-w-0"><div className="text-xs font-display font-medium truncate" style={{ color: '#20190F' }}>{gr.name}</div><div className="text-xs font-mono" style={{ color: '#9A8268' }}>{gr.plot} · {gr.sizeM2}m²</div></div>
                            <span className="text-xs font-mono flex-shrink-0" style={{ color: '#1F4D2B' }}>{prod > 0 ? `${prod}kg` : '—'}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="rounded-lg p-2.5" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.2)' }}>
                  <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#9A8268' }}>Funder report</div>
                  <p className="text-xs font-display leading-relaxed" style={{ color: '#5C5040' }}>Every gardener&apos;s record — ID, training, production, sales and design — rolls up automatically into the programme&apos;s M&amp;E report.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
