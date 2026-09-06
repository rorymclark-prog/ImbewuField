'use client';

import { Fragment, useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { startRolePreview } from '@/lib/use-role-navigation';
import SampleLimaConversation from './SampleLimaConversation';
import ReportComposer from './ReportComposer';
import { sampleSitePhotos } from '@/lib/sample-gardens';
import SampleGardenVisual from './SampleGardenVisual';
import { SAMPLE_GARDENS, SAMPLE_PARTICIPANTS } from '@/lib/sample-gardens';
import { samplePortrait, sampleProducePhoto } from '@/lib/sample-media';
import reportStyles from './MelDashboard.module.css';
import ReactMapGL, { Marker, type MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, MapPin, User, Camera, BookOpen, Check, Map as MapIcon, FileText, ArrowLeft } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { listGardens, listGardeners, getGardenerProfile } from '@/lib/db/queries';
import { getFirebase } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { COURSE_MODULES } from '@/lib/course-modules';
import { getCropArt } from '@/lib/crop-art';
import { buildCropAliasIndex, cropIdentityOf } from '@/lib/crop-identity';
import { cropByKey } from '@/lib/crop-catalog';
import type { Garden as DbGarden, GardenMember, Profile, GardenerProfile as DbGardenerProfile, ProductionLog, SalesLog, CourseProgress } from '@/lib/db/types';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type Status = 'thriving' | 'establishing' | 'support';
const STATUS: Record<Status, { label: string; color: string }> = {
  thriving: { label: 'Thriving', color: '#1F4D2B' },
  establishing: { label: 'Establishing', color: '#9E5C08' },
  support: { label: 'Needs support', color: '#C0531E' },
};

interface Garden { id: string; name: string; town: string; lat: number; lon: number; farmers: number; status: Status; produceKg: number; training: number; facilitator: string; kind?: string; areaM2?: number; language?: string }

// ── fallback sample data (kept as-is for demo mode) ──
// Headlines are derived from the displayed garden register, including in samples.

// `k` maps each demo crop name to its lib/crop-catalog.ts key so it can pick up
// real art from lib/crop-art.ts — this list is synthetic seeded demo data, not
// read from the catalog, so the mapping is by closest match (e.g. "Spinach"
// here means the same thing the catalog calls "Swiss chard (spinach)").
const CROPS = [
  { n: 'Spinach', e: '🥬', c: '#3F7A3C', k: 'swiss-chard' }, { n: 'Tomatoes', e: '🍅', c: '#B83C2E', k: 'tomatoes' }, { n: 'Cabbage', e: '🥬', c: '#6BA84F', k: 'cabbage' },
  { n: 'Carrots', e: '🥕', c: '#C97A2C', k: 'carrots' }, { n: 'Onions', e: '🧅', c: '#C2A05A', k: 'onions' }, { n: 'Maize', e: '🌽', c: '#D9B23A', k: 'maize' },
  { n: 'Beans', e: '🫘', c: '#7A5230', k: 'dry-beans' }, { n: 'Pumpkin', e: '🎃', c: '#CC7A28', k: 'pumpkin' }, { n: 'Sweet potato', e: '🍠', c: '#A85E3C', k: 'sweet-potato' }, { n: 'Green pepper', e: '🫑', c: '#3F8B3C', k: 'peppers' },
];

/** Renders a demo crop's real art when lib/crop-art.ts has it, its emoji otherwise. */
function CropIcon({ crop, size }: { crop: typeof CROPS[number]; size: number }) {
  const art = getCropArt(crop.k);
  return art ? (
    <img className="produce-art" src={art} alt="" aria-hidden style={{ width: size, height: size, objectFit: 'contain' }} />
  ) : (
    <span style={{ fontSize: Math.max(32, size), flexShrink: 0 }}>{crop.e}</span>
  );
}
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
  const names = SAMPLE_PARTICIPANTS[garden.language ?? 'isiZulu'] ?? SAMPLE_PARTICIPANTS.isiZulu;
  return Array.from({ length: n }).map((_, i) => {
    const trainingPct = Math.max(20, Math.min(100, garden.training + rint(r, -14, 14)));
    const doneCount = Math.round((trainingPct / 100) * COURSE_MODULES.length);
    return {
      id: `${garden.id}-${i}`,
      profileId: `${garden.id}-${i}`,
      name: names[i % names.length],
      plot: `Plot ${i + 1}`,
      idNumber: `${rint(r, 70, 99)}${rint(r, 10, 12)}${rint(r, 10, 28)}••••${pick(r, ['08', '18', '19'])}${rint(r, 0, 9)}`,
      sizeM2: Math.floor((garden.areaM2 ?? 2000) / (n + 1)),
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

/**
 * A real gardener's written crop name, resolved for display on the NGO/funder panel.
 *
 * WHAT THIS USED TO DO, AND WHY IT WAS WORSE THAN A MISSING ICON:
 *   const found = CROPS.find((c) => name.toLowerCase().includes(c.n.toLowerCase()));
 *   return found ?? CROPS[0];
 * CROPS is the ten-item DEMO array at the top of this file, there to give fake gardeners
 * plausible rows. Nothing in it is a substring of "Avocado", so `found` was undefined and every
 * unrecognised crop fell to CROPS[0] — Spinach, drawn with swiss-chard artwork. A funder or
 * programme officer opening a real gardener saw her avocado harvest reported as spinach. Not a
 * missing icon: a different crop, named and illustrated, in the screen people fund her from.
 *
 * The name now comes from the real catalogues via lib/crop-identity.ts, so it agrees with every
 * other screen, and a crop NEITHER catalogue knows keeps the words she wrote (rule d). Artwork is
 * keyed on the resolved catalogue key — CROP_ART is keyed by CropDef.key — so a crop with no
 * drawing falls back to its own emoji, and a perennial (namespaced `perennial:`) has neither and
 * gets a neutral marker. Showing nothing is honest; showing another crop is not.
 */
const NEUTRAL_PRODUCE_TINT = '#8C7A62';
/* Built once: the alias index walks the whole annual catalogue, and this runs per logged row. */
const ngoAliasIndex = buildCropAliasIndex();

function cropForName(name: string): typeof CROPS[number] {
  const identity = cropIdentityOf(name, ngoAliasIndex);
  const catalogued = identity.key ? cropByKey(identity.key) : null;
  const demo = identity.key ? CROPS.find((c) => c.k === identity.key) : undefined;
  return {
    n: identity.label,
    e: catalogued?.icon ?? '\u{1F33F}',
    c: demo?.c ?? NEUTRAL_PRODUCE_TINT,
    k: identity.key ?? '',
  };
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
  const router = useRouter();
  const [sampleView, setSampleView] = useState<'design' | 'aerial' | null>(null);
  const [areaFilter, setAreaFilter] = useState('All areas');
  const [showSampleLima, setShowSampleLima] = useState(false);
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
    // No backend, or sample mode: auth is irrelevant to the demo — don't wait on it.
    if (!fb || isSampleMode()) { setAuthReady(true); return; }
    const unsub = onAuthStateChanged(fb.auth, () => setAuthReady(true));
    return () => unsub();
  }, []);

  // ── Fetch gardens once auth is ready ──
  useEffect(() => {
    if (!authReady) return;
    const fb = getFirebase();
    // Sample mode must land HERE, not fall through: listGardens() answers [] in the
    // sandbox (an org-scoped Firestore query has no meaning there), so falling through
    // renders "no gardens yet" on the exact view the /partners page sends funders to
    // try. The sample gardens live in this component, not the query layer.
    if (!fb || isSampleMode()) {
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
    setSampleView(null);
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

  /* Deduped on the resolved catalogue key, not the displayed name. While every unmatched crop was
     renamed "Spinach" this line collapsed all of them into ONE tile and threw the rest of the
     gardener's photos away before the slice ever ran. A crop the catalogues do not know has an
     empty key, so those keep deduping on the words she wrote. */
  const photoCrops = gardener ? Array.from(new Map(gardener.production.map((p) => [p.crop.k || p.crop.n, { crop: p.crop, photoUrl: p.photoUrl }])).values()).slice(0, 5) : [];

  const areaNames = [...new Set(gardens.map(g=>g.town || 'Area not recorded'))].sort();
  const areaGardens = gardens.filter(g=>areaFilter === 'All areas' || (g.town || 'Area not recorded') === areaFilter).sort((a,b)=>a.town.localeCompare(b.town));
  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* Stat row — 2×2 grid on mobile (fits 375px), 4-across flex row on desktop */}
      <div className="flex-shrink-0 grid grid-cols-2 gap-2 px-3 py-3 md:flex md:gap-3 md:px-4" style={{ borderBottom: '1px solid #E2D8C4' }}>
        {mode === 'funder' ? (
          <>

            <Stat label="Gardens" value={dashboardTotals.gardens.toString()} sub={isDemo ? 'in this sample register' : 'in your organisation'} color="#1F4D2B" />
            <Stat label="Farmers" value={dashboardTotals.farmers.toLocaleString()} sub="farmers supported" color="#20190F" />
            <Stat label="Food grown" value={`${dashboardTotals.produceT} t`} sub="this season" color="#2F6F9E" />
          </>
        ) : (
          <>
            <Stat label="Active gardens" value={dashboardTotals.gardens.toString()} sub={isDemo ? 'in this sample register' : 'in your organisation'} color="#1F4D2B" />
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
            <label className="block text-sm mb-3" style={{color:'#36553d'}}>Area / village<select value={areaFilter} onChange={e=>{setAreaFilter(e.target.value); const first=gardens.find(g=>e.target.value==='All areas'||(g.town||'Area not recorded')===e.target.value); if(first)selectGarden(first);}} className="block w-full rounded-lg p-2 mt-1" style={{minHeight:44,background:'#fff',border:'1px solid #c6cfbf'}}><option>All areas</option>{areaNames.map(a=><option key={a}>{a}</option>)}</select></label>
            {isDemo && <button type="button" className="text-sm underline mb-3" onClick={()=>setShowSampleLima(v=>!v)}>{showSampleLima?'Close Lima example':'Try Lima for this role'}</button>}
            {showSampleLima && isDemo && <SampleLimaConversation role={mode==='funder'?'funder':'ngo'}/>}
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
                {areaGardens.map((g,index) => (
                  <Fragment key={g.id}>{(index===0 || areaGardens[index-1].town!==g.town) && <h3 className="text-sm font-semibold pt-4 pb-2" style={{color:'#36553d'}}>{g.town || 'Area not recorded'} · {areaGardens.filter(x=>x.town===g.town).length} gardens</h3>}<button
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
                      <div className="text-xs font-mono" style={{ color: '#9A8268' }}>{g.town} · {g.farmers || '—'} farmers</div>{g.kind && <div className="text-xs mt-1" style={{ color: '#36553d' }}>{g.kind} · {Math.round(g.areaM2 ?? 0).toLocaleString()} m²{g.areaM2 === 4046.8564224 ? ' · 1 acre' : ''}</div>}
                    </div>
                    <span className="text-xs font-mono flex-shrink-0" style={{ color: '#2F6F9E' }}>{g.produceKg > 0 ? `${g.produceKg}kg` : '—'}</span>
                  </button></Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTRE — map. Fixed-height band on mobile, hidden once a garden is selected;
            fills remaining width on desktop. */}
        <div className={`${garden ? 'hidden md:block' : 'block'} relative h-[42vh] md:h-auto md:flex-1`} style={{ minWidth: 0 }}>
          {!isDemo && <div className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-lg pointer-events-none" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <span className="text-xs font-mono flex items-center gap-1" style={{ color: '#9A8268' }}>
              {gardener
                ? <><MapPin size={12} style={{ color: '#9A8268' }} /> {isDemo ? `${gardener.name} · fictional example` : `${gardener.name} · ${gardener.lat.toFixed(4)}, ${gardener.lon.toFixed(4)}`}</>
                : isDemo
                  ? `Showing ${gardens.length} fictional sample gardens`
                  : gardensLoadError
                    ? 'Gardens unavailable'
                    : `Showing ${gardens.length} gardens`}
            </span>
          </div>}
          {isDemo ? <SampleGardenVisual key={garden?.id ?? 'overview'} kind={garden?.kind} variant={garden?.id} name={garden?.name ?? 'Example garden landscape'} initial="design" /> : <ReactMapGL ref={mapRef} mapboxAccessToken={TOKEN} initialViewState={{ longitude: 25, latitude: -29, zoom: 4.4 }} mapStyle="mapbox://styles/mapbox/dark-v11" style={{ width: '100%', height: '100%' }}>
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
          </ReactMapGL>}
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
                    {isDemo ? <img data-photo-preview src={samplePortrait(gardener.name)} alt="Fictional profile portrait" className="w-full h-full object-cover rounded-full" /> : initials(gardener.name)}
                    <span className="absolute -bottom-1 -right-1"><Camera size={10} style={{ color: '#1F4D2B' }} /></span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-base truncate" style={{ color: '#20190F' }}>{gardener.name}</div>
                    {/* A funder is not the farmer's employer or their NGO — a South African ID
                        number is not theirs to see. NGO programme staff (who register farmers
                        for grants) keep it; funders get everything else on this card. */}
                    {mode !== 'funder' && (
                      <div className="text-xs font-mono" style={{ color: '#9A8268' }}>ID {gardener.idNumber}</div>
                    )}
                    <div className="text-xs font-mono" style={{ color: '#9A8268' }}>{gardener.plot} · {gardener.sizeM2} m² · {garden.town}</div>
                  </div>
                </div>
                <button onClick={() => { if (isDemo) setSampleView('aerial'); else mapRef.current?.flyTo({ center: [gardener.lon, gardener.lat], zoom: 16, duration: 1200 }); }}
                  className="w-full py-1.5 rounded-lg text-xs font-display transition-all flex items-center justify-center gap-1.5" style={{ background: 'rgba(47,111,158,0.14)', border: '1px solid rgba(47,111,158,0.4)', color: '#2F6F9E' }}>
                  <MapPin size={14} /> {isDemo ? 'Open example location' : 'Find this garden on the map'}
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
                        ? 'Harvest not matched to sales: unknown — sales exceed recorded harvest'
                        : `Harvest not matched to sales: ${totals.kept} kg`}
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

                    {isDemo && <><button type="button" className="w-full rounded-xl p-3 text-sm font-semibold" style={{ background: '#e9f1e9', color: '#214d35' }} onClick={() => setSampleView('design')}>Open example garden design →</button>{sampleView && <div><button type="button" className="text-sm underline py-2" onClick={() => setSampleView(null)}>Close example</button><SampleGardenVisual kind={garden.kind} variant={garden.id} key={`${garden.id}-${sampleView}`} name={garden.name} initial={sampleView} /></div>}<button type="button" className="text-xs underline py-2" onClick={() => { if (startRolePreview('farmer')) router.push('/farmer'); }}>Explore the separate Ubhejane design workspace →</button></>}
                    {!isDemo && <p className="text-xs" style={{ color: '#506158' }}>This register does not include the farmer’s private design.</p>}
                    <details className={reportStyles.root} style={{ padding: 12, borderRadius: 12 }}><summary>Preview & download this garden record</summary>
                      <ReportComposer title="Garden production record" sample={isDemo} photos={isDemo ? sampleSitePhotos(garden.id) : []} photosByDefault={isDemo} sections={[
                        { title: 'Garden record', lines: [garden.name, `${gardener.name} · ${gardener.plot}`, `Plot size recorded: ${gardener.sizeM2} m². This is not a verified active production area.`] },
                        { title: 'Production entries', lines: gardener.production.map(p => `${p.date}: ${p.crop.n}, ${p.kg} kg`) },
                        { title: 'Sales entries', lines: gardener.sales.map(p => `${p.date}: ${p.crop.n}, ${p.kg} kg; R${p.rand}`) },
                        { title: 'Coverage', lines: ['Includes only the production and sales entries shown in this garden record. Costs are not included, so this is not a profitability report.'] },
                      ]} />
                    </details>

                    {/* Produce photos */}
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#9A8268' }}>Produce photos</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {photoCrops.map(({ crop: c, photoUrl: recordedPhoto }, i) => { const photoUrl = isDemo ? sampleProducePhoto(c.n) : recordedPhoto; return (
                          photoUrl ? (
                            <div key={i} className="rounded-lg overflow-hidden" style={{ width: 120, height: 120, border: `1px solid ${c.c}` }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img data-photo-preview src={photoUrl} alt={isDemo ? `Sample ${c.n} photo` : c.n} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div key={i} className="rounded-lg flex flex-col items-center justify-center" style={{ width: 80, height: 88, background: `${c.c}33`, border: `1px solid ${c.c}` }}><CropIcon crop={c} size={44} /><span className="font-mono text-center leading-none break-words px-0.5" style={{ fontSize: 12, color: '#9A8268' }}>{c.n}</span></div>
                          )
                        ); })}
                      </div>
                      {isDemo && <p className="text-xs mt-2" style={{ color: '#506158' }}>AI-generated sample produce photos; illustrations identify the other crops.</p>}
                    </div>

                    {/* Books — production */}
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: '#9A8268' }}><BookOpen size={13} /> Books — production</div>
                      <div className="space-y-1">
                        {gardener.production.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-display px-2 py-1 rounded-lg" style={{ background: '#F5F0E8' }}><CropIcon crop={p.crop} size={36} /><span className="flex-1" style={{ color: '#5C5040' }}>{p.crop.n}</span><span className="font-mono" style={{ color: '#9A8268' }}>{p.date}</span><span className="font-mono font-semibold" style={{ color: '#1F4D2B' }}>{p.kg}kg</span></div>
                        ))}
                      </div>
                    </div>

                    {/* Books — sales */}
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: '#9A8268' }}><BookOpen size={13} /> Books — sales</div>
                      <div className="space-y-1">
                        {gardener.sales.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-display px-2 py-1 rounded-lg" style={{ background: '#F5F0E8' }}><CropIcon crop={p.crop} size={36} /><span className="flex-1 truncate" style={{ color: '#5C5040' }}>{p.kg}kg → {p.buyer}</span><span className="font-mono font-semibold" style={{ color: '#2F6F9E' }}>R{p.rand}</span></div>
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
                  <div className="text-xs font-mono mt-0.5" style={{ color: '#9A8268' }}>{garden.town}{garden.facilitator ? ` · supervisor ${garden.facilitator}` : ''}</div>{garden.kind && <p className="text-sm mt-2" style={{ color: '#36553d' }}>{garden.kind} · {Math.round(garden.areaM2 ?? 0).toLocaleString()} m²{garden.areaM2 === 4046.8564224 ? ' · 1 acre' : ''} · fictional site area</p>}{isDemo && garden.language && <p className="text-sm mt-1" style={{ color: '#36553d' }}>Example group language: {garden.language}</p>}
                </div>
                {isDemo && <SampleGardenVisual key={garden.id} kind={garden.kind} variant={garden.id} name={garden.name} />}
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
                            <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, background: 'rgba(31,77,43,0.18)', color: '#1F4D2B', fontSize: 12, fontWeight: 600 }}>{isDemo ? <img data-photo-preview src={samplePortrait(gr.name)} alt="" className="w-full h-full object-cover rounded-full" /> : initials(gr.name)}</div>
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
                  <p className="text-xs font-display leading-relaxed" style={{ color: '#5C5040' }}>Use Reports for the shared portfolio. Farmer consent, organisation sharing and funder access determine which records are included; private identity details are excluded.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
