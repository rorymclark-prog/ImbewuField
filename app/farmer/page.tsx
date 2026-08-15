'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Settings, AlertTriangle, ChevronUp, Menu, Plus } from 'lucide-react';
import AddSheet from '@/components/AddSheet';
import { MAP_ELEMENT_FOR, type AddAction } from '@/lib/add-actions';
import { CRASH_LOOP_SETTLE_MS, FARMER_LOAD_KEY, exitPageCrashGuard, markPageSettled, pageCrashGuard } from '@/lib/crash-loop';
import { FARMER_PULSE_COOKIE, clearPulseCookie } from '@/lib/server-rescue';
import DataPanel from '@/components/DataPanel';
import TabBar from '@/components/TabBar';
import LangSwitcher from '@/components/LangSwitcher';
import RoleSwitcher from '@/components/RoleSwitcher';
import AccountButton from '@/components/AccountButton';
import BrandLogo from '@/components/BrandLogo';
import ThemePanel from '@/components/ThemePanel';
import NavDrawer from '@/components/NavDrawer';
import ProfileSheet from '@/components/ProfileSheet';
import LessonLink from '@/components/design/LessonLink';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { DEMO_SITE } from '@/lib/demo-farm';
import { loadPlaces, resolveMainSite } from '@/lib/saved-places';
import { listOrgPeople, getMyProfile } from '@/lib/db/queries';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import type { SavedReport } from '@/lib/saved-reports';
import type { Profile } from '@/lib/db/types';
import type { PeopleMarker } from '@/components/Map';

const VALID_PANELS = ['Overview','Ask','Water','Soil','Climate','Area','Photos','Design','AI','Places','Reports','Farm','People','Nature'];
import { setLastSite } from '@/lib/last-site';
import { announceOverlay } from '@/lib/overlay-signal';
import { useSheetDismiss } from '@/lib/sheet-dismiss';

const PermaMap = dynamic(() => import('@/components/Map'), { ssr: false });
// The report is a big, PDF-generating view most farmers never open in a given
// visit (they came to check the weather, log a sale, water the garden). Loading
// it eagerly cost every one of them its JS on every page load; loading it only
// when "Reports" is actually tapped, same as the map above, gives that back.
const ReportView = dynamic(() => import('@/components/ReportView'), { ssr: false });

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [selected, setSelected] = useState<{ lat: number; lon: number } | null>(null);
  const [data, setData] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapCapture, setMapCapture] = useState<string | null>(null);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [waterData, setWaterData] = useState<WaterData | null>(null);
  // Allow deep-link into a specific tab via ?panel=<tabname>
  const [forcedTab, setForcedTab] = useState<string | null>(() => {
    const panel = searchParams.get('panel');
    if (!panel) return searchParams.get('chat') === '1' ? 'Ask' : null;
    if (VALID_PANELS.includes(panel)) return panel;
    if (panel === 'saved') return 'Places';
    if (panel === 'chat') return 'Ask';
    return null;
  });
  const [jumpTo, setJumpTo] = useState<{ lat: number; lon: number } | null>(null);
  const [activePlaceName, setActivePlaceName] = useState<string | null>(null);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  // LimaBar can deep-link a typed question (?q=) or a photo intent (?photo=1) straight
  // into the chat tab — consumed once so re-renders don't keep re-submitting it.
  const [initialChatQuery, setInitialChatQuery] = useState<string | null>(() => searchParams.get('q'));
  const [initialChatPhoto, setInitialChatPhoto] = useState<boolean>(() => searchParams.get('photo') === '1');

  const handlePlaceSelect = useCallback((info: { name: string; id: string } | null) => {
    setActivePlaceName(info?.name ?? null);
    setActivePlaceId(info?.id ?? null);
  }, []);
  const [showReport, setShowReport] = useState(false);
  const [reportPhotoAnalysis, setReportPhotoAnalysis] = useState<string | undefined>();
  const [savedReportView, setSavedReportView] = useState<SavedReport | null>(null);

  const handleViewReport = useCallback((r: SavedReport) => {
    setSavedReportView(r);
    setShowReport(true);
  }, []);

  // CRASH GUARD — the same escape hatch the design page has (lib/crash-loop.ts), because on
  // 13 August this page earned it: "It's happening everywhere!", with /farmer?panel=Reports on
  // iOS Safari's "A problem repeatedly occurred" screen. This page mounts Mapbox GL with
  // satellite tiles on every load; on a phone short of memory that dies, and with no counter it
  // died identically on every retry. When the streak hits the threshold the MAP stays unmounted —
  // a placeholder offers it back on tap — while every panel keeps working, which is exactly what
  // a farmer locked out of their reports by the map behind them needs.
  const mapGuard = useMemo(() => pageCrashGuard(FARMER_LOAD_KEY, FARMER_PULSE_COOKIE), []);
  const [mapHeld, setMapHeld] = useState(false);
  useEffect(() => { setMapHeld(mapGuard.active); }, [mapGuard.active]);
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    // Settle only once the heavy thing has actually happened — the map came up — or when this is
    // a light load and no map will mount at all. A fixed timer from mount is how the design
    // page's guard was beaten on 4G; see CRASH_LOOP_SETTLE_MS.
    if (!mapReady && !mapGuard.active) return;
    const settled = window.setTimeout(() => {
      markPageSettled(window.localStorage, mapGuard.key);
      clearPulseCookie(FARMER_PULSE_COOKIE); // tell the server too — see lib/server-rescue.ts
    }, CRASH_LOOP_SETTLE_MS);
    return () => window.clearTimeout(settled);
  }, [mapReady, mapGuard.active, mapGuard.key]);

  // Mobile bottom-sheet state — open/closed; auto-open if deep-linked to a panel
  const [sheetOpen, setSheetOpen] = useState(() => {
    const panel = searchParams.get('panel');
    const chat = searchParams.get('chat');
    return !!(panel || chat);
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The bar at the top of the details sheet closed on TAP only. On a phone that bar promises
  // "pull me down", so it now does — see lib/sheet-dismiss.ts. Rory: "I want to be able to drag
  // any of those top closing buttons in the modals and it closes."
  const sheetDrag = useSheetDismiss(() => setSheetOpen(false), sheetOpen);
  const [navOpen, setNavOpen] = useState(false);
  // Draggable width of the desktop side panel — persisted, clamped 320–760px.
  const [panelWidth, setPanelWidth] = useState(390);
  useEffect(() => {
    const saved = parseInt(localStorage.getItem('imbewu_panel_width') || '', 10);
    if (Number.isFinite(saved) && saved >= 320 && saved <= 760) setPanelWidth(saved);
  }, []);
  const startPanelResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const w = Math.min(Math.max(window.innerWidth - ev.clientX, 320), 760);
      setPanelWidth(w);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
      setPanelWidth((w) => { try { localStorage.setItem('imbewu_panel_width', String(w)); } catch {} return w; });
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);
  const [drawing, setDrawing] = useState(false); // boundary/water draw active → hide the Results FAB
  const [addOpen, setAddOpen] = useState(false); // shared "+ Add" catalog sheet (spec §2.3)
  const [people, setPeople] = useState<Profile[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [buildInfo, setBuildInfo] = useState<{ branch?: string | null; sha?: string | null; repoRoot?: string | null; source?: string } | null>(null);
  // Design-on-map overlay: the map now owns its own "My design" toggle (a labels-pill chip
  // inside components/Map.tsx, ON by default when a design exists), so the old page-level
  // showDesign/designPresent pair and the floating "Show design" button are gone.
  // Deep-link flag for ?openSurvey=1 — threaded to DataPanel to open the real site survey.
  const [openSurvey, setOpenSurvey] = useState(false);

  // Guided pin mode: on for "?guided=1" (from the home welcome / start-new-site) OR for a
  // farmer who has no saved places yet. Client-only (default false) so SSR paints no bar.
  const [guidedMode, setGuidedMode] = useState(false);
  useEffect(() => {
    setGuidedMode(searchParams.get('guided') === '1' || loadPlaces().length === 0);
  }, [searchKey]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/build-info', { cache: 'no-store' })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setBuildInfo(data);
      })
      .catch(() => {
        if (!cancelled) setBuildInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const panel = searchParams.get('panel');
    const chat = searchParams.get('chat');
    const q = searchParams.get('q');
    const photo = searchParams.get('photo');

    if (!panel) {
      setForcedTab(chat === '1' ? 'Ask' : null);
    } else if (VALID_PANELS.includes(panel)) {
      setForcedTab(panel);
    } else if (panel === 'saved') {
      setForcedTab('Places');
    } else if (panel === 'chat') {
      setForcedTab('Ask');
    } else {
      setForcedTab(null);
    }

    setInitialChatQuery(q);
    setInitialChatPhoto(photo === '1');
    setSheetOpen(!!(panel || chat));
  }, [searchKey]);

  const handleLocationSelect = useCallback(async (lat: number, lon: number) => {
    setSelected({ lat, lon });
    setMapCapture(null);
    setReportPhotoAnalysis(undefined);
    setError('');
    setSheetOpen(true);

    // Check localStorage cache. MUST key at 5 dp (~1.1 m) to match designSiteIdFromLocation —
    // 2 dp (~1.1 km) made two different nearby sites collide on the same key, so the second
    // site loaded the first site's cached data (incl. its lat/lon) → satellite of the WRONG place.
    // v2: bump when the location-data shape gains a field (e.g. BRU zones) so already-analysed
    // sites refetch instead of serving a stale pre-field cache. Keep in sync with app/design/page.tsx.
    //
    // v4 (12 Aug): the biome now comes from SANBI's national vegetation map rather than a lat/lon
    // heuristic, and the response carries `biomeSource`. Shipping that without bumping this did
    // nothing at all for anyone who had already analysed their site: Ubhejane kept reading "Indian
    // Ocean Coastal Belt" off a cache written before the fix. Rory: "On the main app it still says
    // this." The rule above is the rule; a changed ANSWER counts as much as a new field, because a
    // farmer cannot tell the two apart and neither can this cache.
    const cacheKey = `imbewu_loc_v4_${lat.toFixed(5)}_${lon.toFixed(5)}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached));
        return;
      }
    } catch { /* ignore parse errors */ }

    setLoading(true);
    try {
      const res = await fetch(`/api/location-data?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
      try { localStorage.setItem(cacheKey, JSON.stringify(json)); } catch { /* quota exceeded */ }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleJumpTo = useCallback((lat: number, lon: number) => {
    setJumpTo({ lat, lon });
    handleLocationSelect(lat, lon);
  }, [handleLocationSelect]);

  // Deep link: /farmer?site=<placeId> (from the home "Continue" card). Load that saved
  // site's report immediately (correct regardless of map state), then fly the camera once
  // the dynamically-imported Map has had a beat to mount. One-shot per navigation.
  const siteParamHandled = useRef(false);
  useEffect(() => {
    if (siteParamHandled.current) return;
    const siteId = searchParams.get('site');
    if (!siteId) return;
    siteParamHandled.current = true;
    const p = loadPlaces().find((pl) => pl.id === siteId);
    if (!p) return;
    handlePlaceSelect({ name: p.name, id: p.id });
    handleLocationSelect(p.lat, p.lon);
    const t = setTimeout(() => setJumpTo({ lat: p.lat, lon: p.lon }), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  const handleOpenReport = useCallback((photoAnalysis?: string) => {
    setReportPhotoAnalysis(photoAnalysis);
    setShowReport(true);
  }, []);

  // ── "+ Add" catalog (spec §2.3) ──
  // The tools-panel row and any other door dispatch 'imbewu-open-add'; we host the sheet.
  useEffect(() => {
    const open = () => setAddOpen(true);
    window.addEventListener('imbewu-open-add', open);
    return () => window.removeEventListener('imbewu-open-add', open);
  }, []);

  // The map executes what it owns (boundary / water body via 'imbewu-arm-draw';
  // tree / tank / tap via 'imbewu-arm-element'); everything else hands off to the Studio
  // pre-armed with ?add=<id>. Always close the sheet first — draw modes need it gone.
  const handleAddPick = useCallback((action: AddAction) => {
    setAddOpen(false);
    const id = action.id;
    if (id === 'boundary') {
      window.dispatchEvent(new CustomEvent('imbewu-arm-draw', { detail: 'site' }));
    } else if (id === 'water_body') {
      window.dispatchEvent(new CustomEvent('imbewu-arm-draw', { detail: 'water' }));
    } else if (MAP_ELEMENT_FOR[id]) {
      window.dispatchEvent(new CustomEvent('imbewu-arm-element', { detail: MAP_ELEMENT_FOR[id] }));
    } else {
      router.push(selected
        ? `/design?lat=${selected.lat.toFixed(5)}&lon=${selected.lon.toFixed(5)}&add=${id}`
        : `/design?add=${id}`);
    }
  }, [selected, router]);

  // Studio → map handoff: /farmer?arm=site|water (boundary/water rows tapped in the Studio)
  // arm the reticle here. One-shot (mirrors the ?site= pattern above); 800 ms lets the
  // dynamically-imported Map mount before we fire the event.
  const armParamHandled = useRef(false);
  useEffect(() => {
    if (armParamHandled.current) return;
    const arm = searchParams.get('arm');
    if (arm !== 'site' && arm !== 'water') return;
    armParamHandled.current = true;
    const timer = setTimeout(() => window.dispatchEvent(new CustomEvent('imbewu-arm-draw', { detail: arm })), 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  // Deep link: /farmer?openSurvey=1 (home "Your farm plan" → "Do the site survey"). The
  // REAL SiteSurveySheet only opens from inside DataPanel, so we raise a prop flag it
  // consumes. That sheet is gated on an active place, so if nothing is pinned yet we first
  // load the farmer's main site (same machinery as ?site=), then flag the open. One-shot.
  const openSurveyHandled = useRef(false);
  useEffect(() => {
    if (openSurveyHandled.current) return;
    if (searchParams.get('openSurvey') !== '1') return;
    openSurveyHandled.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!selected) {
      const main = resolveMainSite(loadPlaces());
      if (main) {
        handlePlaceSelect({ name: main.name, id: main.id });
        handleLocationSelect(main.lat, main.lon);
        timer = setTimeout(() => setJumpTo({ lat: main.lat, lon: main.lon }), 800);
      }
    }
    setOpenSurvey(true);
    return () => { if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  // Remember the analysed site so the global chat assistant is site-aware everywhere.
  // Skipped in sample mode — the demo site must never overwrite the real farmer's
  // actual last-visited site once they exit sample mode.
  useEffect(() => {
    if (data && !isSampleMode()) setLastSite({ locationData: data, siteData, waterData });
  }, [data, siteData, waterData]);

  // Auth guard — redirect to login when backend is configured and no user is signed in.
  // Thread the current path + query through ?from= so login can send the farmer back
  // to the exact map/panel they were trying to reach instead of dropping them at /home.
  // Sample mode bypasses this entirely — an NGO evaluator isn't signed in.
  useEffect(() => {
    if (!authLoading && !user && isBackendConfigured() && !isSampleMode()) {
      const qs = searchParams.toString();
      const currentPathAndQuery = qs ? `${pathname}?${qs}` : pathname;
      router.replace(`/login?from=${encodeURIComponent(currentPathAndQuery)}`);
    }
  }, [user, authLoading, router, pathname, searchParams]);

  // Sample mode: auto-load the real Ubhejane Creche site so the evaluator lands
  // straight on a populated map instead of an empty "tap to survey" state.
  //
  // The camera move is NOT optional. Selecting the site loads its data but
  // leaves the map wherever it was — zoom 5.2, the whole of South Africa — so
  // the flagship screen opened on Botswana and Lesotho with the farm an
  // invisible speck. Same setJumpTo-after-a-beat pattern the saved-place and
  // main-site paths above use; the delay lets the map finish mounting before
  // it is told to fly.
  useEffect(() => {
    if (isSampleMode() && !selected) {
      handleLocationSelect(DEMO_SITE.lat, DEMO_SITE.lon);
      const t = setTimeout(() => setJumpTo({ lat: DEMO_SITE.lat, lon: DEMO_SITE.lon }), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close sheet on Escape key

  // Tell the global chrome (Lima's launcher, mounted in the root layout at z-60) that a sheet is
  // covering the screen, so it stops floating on top of the rows a farmer is trying to press.
  // See lib/overlay-signal.ts — same idea as the map's existing `imbewu-drawing` broadcast.
  useEffect(() => {
    announceOverlay(sheetOpen || addOpen);
    return () => announceOverlay(false);
  }, [sheetOpen, addOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // When boundary/water drawing starts, collapse the bottom sheet so the crosshair and
  // the lower part of the map aren't hidden behind the 70vh panel.
  useEffect(() => { if (drawing) setSheetOpen(false); }, [drawing]);

  // Load org team members when authenticated
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPeopleLoading(true);
      setPeopleError(false);
      try {
        const [team, me] = await Promise.all([listOrgPeople(), getMyProfile()]);
        if (!cancelled) {
          setPeople(team);
          setMyProfile(me);
        }
      } catch {
        if (!cancelled) {
          setPeople([]);
          setMyProfile(null);
          setPeopleError(true);
        }
      } finally {
        if (!cancelled) setPeopleLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const peopleMarkers: PeopleMarker[] = people
    .filter(p => p.showOnMap && p.mapLat != null && p.mapLon != null)
    .map(p => ({
      id: p.id,
      lat: p.mapLat!,
      lon: p.mapLon!,
      name: p.full_name ?? 'Unknown',
      role: p.role,
      photoUrl: p.photo_url,
    }));

  // Render nothing while auth resolves (or while redirecting to /login) —
  // except in sample mode, where there's no real user to wait for.
  if (isBackendConfigured() && (authLoading || !user) && !isSampleMode()) return null;

  return (
    <>
      <ThemePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />

      {showReport && (data || savedReportView) && (
        <ReportView
          locationData={data ?? savedReportView!.location}
          photoAnalysis={reportPhotoAnalysis}
          siteData={siteData ?? undefined}
          waterData={waterData ?? undefined}
          savedPlaces={loadPlaces()}
          mapCapture={mapCapture}
          appLang={lang}
          activePlaceId={activePlaceId ?? undefined}
          savedReport={savedReportView ?? undefined}
          onClose={() => { setShowReport(false); setSavedReportView(null); }}
        />
      )}

      <div className="flex flex-col" style={{ height: '100dvh', background: '#E4DCC6' }}>

        {/* ── Header ────────────────────────────── */}
        {/* Heights/sizes scale down on wide screens — phone px must not be reused
            on desktop (handoff §0). Mobile keeps the comfortable 60px bar. */}
        <header
          className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-3 overflow-hidden"
          style={{
            height: 60,
            background: '#FFFEFA',
            borderBottom: '1px solid #E2D8C4',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Hamburger — visible on all screens */}
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              width: 38, height: 38,
              background: 'rgba(32,25,15,0.06)',
              border: '1px solid #E2D8C4',
              color: '#5C5040', cursor: 'pointer',
            }}
          >
            <Menu size={18} strokeWidth={1.7} />
          </button>

          <BrandLogo />

          <div className="w-px h-5 flex-shrink-0 hidden md:block" style={{ background: '#E2D8C4', opacity: 0.5 }} />
          <span className="hidden md:block font-sans" style={{ fontSize: 13, color: '#94876F' }}>{t('tagline')}</span>
          <div className="flex-1" />

          <span className="flex-shrink-0"><LessonLink id="map:overview" label="Learn" /></span>

          {/* ONE design door — Design Studio (canonical /design surface; Zones + the AI suggest
              live here). Now visible ON MOBILE too: farmers on phones could not find the zones
              because this was desktop-only. The older Konva canvas at /facilitator (still hosts
              the AI producer) stays reachable via the burger menu; role switcher stays desktop-only. */}
          <Link
            href={selected ? `/design?lat=${selected.lat.toFixed(5)}&lon=${selected.lon.toFixed(5)}` : '/design'}
            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full font-sans font-bold transition-all flex-shrink-0"
            style={{ fontSize: 15, background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B' }}
          >
            <span aria-hidden>🎨</span> <span>Design Studio</span>
          </Link>
          {buildInfo?.sha && (
            <div
              title={`Build source: ${buildInfo.source ?? 'unknown'}${buildInfo.branch ? ` · branch ${buildInfo.branch}` : ''}${buildInfo.repoRoot ? ` · ${buildInfo.repoRoot}` : ''}`}
              className="hidden md:flex items-center flex-shrink-0 rounded-full border px-2.5 py-1 font-sans"
              style={{
                minHeight: 30,
                borderColor: 'rgba(31,77,43,0.2)',
                background: 'rgba(31,77,43,0.04)',
                color: '#1F4D2B',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.2,
                whiteSpace: 'nowrap',
              }}
            >
              Build {buildInfo.sha}
            </div>
          )}
          <div className="hidden md:flex"><RoleSwitcher current="farmer" /></div>
          <div className="hidden md:block"><LangSwitcher /></div>
          <div className="hidden md:block"><AccountButton /></div>

          {error && (
            <span className="text-xs px-3 py-1 rounded-full font-sans flex-shrink-0 flex items-center"
                  style={{ background: 'rgba(212,110,66,0.12)', border: '1px solid rgba(212,110,66,0.35)', color: 'var(--orange)' }}>
              <AlertTriangle size={13} className="inline mr-1" /> {error}
            </span>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Appearance settings"
            title="Appearance"
            className="hidden md:flex flex-shrink-0 items-center justify-center rounded-lg transition-all"
            style={{
              width: 40, height: 40,
              background: 'rgba(226,216,196,0.35)',
              border: '1px solid #E2D8C4',
              color: '#5C5040',
              cursor: 'pointer',
            }}
          >
            <Settings size={18} />
          </button>
        </header>

        {/* ── Main ──────────────────────────────── */}
        {/*
          Wide / landscape (lg+, ≥1024 incl. landscape iPad): side-by-side — map
            flex-1 + a persistent 390px panel column.
          Phone & portrait tablet (<1024): map fills the width; DataPanel is a
            bottom-sheet overlay reached via the "Details" button.
          (A single 768px split used to drop portrait iPads into a cramped side
           panel — handoff frame 26 "priority #2".)
        */}
        <div className="flex-1 flex overflow-hidden relative">

          {/* Map — always full height; on desktop it shares width with panel.
              Behind the crash guard: after repeated memory kills the map is the thing this page
              can do without, so a looping load holds it back behind a tap instead of mounting it
              into the same death. Rendered only after mount (mapHeld starts false), so the server
              and the first client paint agree. */}
          <div className="flex-1 relative min-w-0">
            {mapHeld ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-8 text-center"
                style={{ background: '#E9E4D3' }}>
                <AlertTriangle size={22} style={{ color: '#C07A1E' }} />
                <div className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>
                  {t('mapHeldTitle')}
                </div>
                <div className="font-sans" style={{ fontSize: 13, color: '#5C5040', maxWidth: 420 }}>
                  {t('mapHeldBody')}
                </div>
                <button
                  onClick={() => exitPageCrashGuard(mapGuard.key)}
                  className="mt-1 px-4 py-2.5 rounded-full font-display font-semibold active:scale-95 transition-all"
                  style={{ background: 'linear-gradient(135deg, #1F4D2B, #2D6B3C)', color: '#fff', fontSize: 14, border: 'none', cursor: 'pointer' }}>
                  {t('mapHeldLoad')}
                </button>
              </div>
            ) : (
            <PermaMap
              onLocationSelect={handleLocationSelect}
              onMapReady={() => setMapReady(true)}
              selectedLocation={selected}
              guided={guidedMode && !selected}
              loading={loading}
              onMapCapture={setMapCapture}
              onSiteDrawn={setSiteData}
              onWaterDrawn={setWaterData}
              onCaptureClick={() => setForcedTab('Photos')}
              jumpTo={jumpTo}
              onJumpComplete={() => setJumpTo(null)}
              onDrawingChange={setDrawing}
              locationData={data}
              onPlaceSelect={handlePlaceSelect}
              activePlaceId={activePlaceId}
              people={peopleMarkers}
              showPeople={showPeople}
              onTogglePeople={() => setShowPeople(v => !v)}
            />
            )}

            {/* ── Desktop "+ Add" pill ── */}
            {/* On lg+ there is no TabBar overlap, so anchor the Add door to the map
                container, bottom-left (mirrors the mobile pill). Hidden while drawing. */}
            <button
              onClick={() => setAddOpen(true)}
              className="hidden lg:flex absolute left-4 bottom-14 z-20 items-center gap-2 px-4 py-2.5 rounded-full font-display font-semibold transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #1F4D2B, #2D6B3C)',
                border: '1px solid rgba(31,77,43,0.6)',
                color: '#fff', fontSize: 14,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                opacity: drawing ? 0 : 1,
                pointerEvents: drawing ? 'none' : 'auto',
              }}
              aria-label={t('addButton')}
            >
              <Plus size={16} /> {t('addButton')}
            </button>
          </div>

          {/* ── Drag handle to resize the side panel ── */}
          <div
            onPointerDown={startPanelResize}
            className="hidden lg:flex items-center justify-center flex-shrink-0 group"
            title="Drag to resize the panel"
            style={{ width: 8, cursor: 'col-resize', background: '#FFFEFA', borderLeft: '1px solid #E2D8C4' }}
          >
            <div style={{ width: 3, height: 36, borderRadius: 3, background: 'rgba(92,80,64,0.25)' }} className="group-hover:bg-stone-400 transition-colors" />
          </div>

          {/* ── Desktop side panel (md+) ── */}
          <div
            className="hidden lg:flex flex-shrink-0 overflow-hidden flex-col"
            style={{ width: panelWidth, background: '#FFFEFA', borderLeft: '1px solid #E2D8C4' }}
          >
            <DataPanel
              data={data}
              loading={loading}
              coords={selected}
              mapCapture={mapCapture}
              siteData={siteData}
              waterData={waterData}
              forcedTab={forcedTab}
              onTabChange={() => setForcedTab(null)}
              onOpenReport={handleOpenReport}
              onViewReport={handleViewReport}
              onJumpTo={handleJumpTo}
              appLang={lang}
              activePlaceId={activePlaceId ?? undefined}
              placeName={activePlaceName}
              people={people}
              peopleLoading={peopleLoading}
              peopleError={peopleError}
              currentUserId={myProfile?.id}
              onOpenProfile={() => setProfileSheetOpen(true)}
              initialChatQuery={initialChatQuery}
              initialChatPhoto={initialChatPhoto}
              onChatDeepLinkConsumed={() => { setInitialChatQuery(null); setInitialChatPhoto(false); }}
              openSurvey={openSurvey}
              onSurveyOpened={() => setOpenSurvey(false)}
            />
          </div>

          {/* ── Mobile: floating "+ Add" pill (bottom-LEFT, mirrors Details) ── */}
          {/* The headline discoverability door. Hidden when the sheet is open, while
              drawing, or while the Add sheet itself is up. LimaBar is not mounted on
              /farmer, so bottom-left is free. */}
          <button
            className="lg:hidden fixed left-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-display font-semibold shadow-lg transition-all"
            style={{
              bottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 36px)',
              background: 'linear-gradient(135deg, #1F4D2B, #2D6B3C)',
              border: '1px solid rgba(31,77,43,0.6)',
              color: '#fff',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(10px)',
              opacity: sheetOpen || drawing || addOpen ? 0 : 1,
              pointerEvents: sheetOpen || drawing || addOpen ? 'none' : 'auto',
            }}
            onClick={() => setAddOpen(true)}
            aria-label={t('addButton')}
          >
            <Plus size={16} />
            {t('addButton')}
          </button>

          {/* ── Mobile: floating "Details" toggle button ── */}
          {/* Visible only below md, hidden when sheet is open or while drawing a boundary */}
          <button
            className="lg:hidden fixed right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-display font-semibold shadow-lg transition-all"
            style={{
              bottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 36px)',
              background: sheetOpen
                ? 'rgba(31,77,43,0.9)'
                : 'linear-gradient(135deg, #1F4D2B, #2D6B3C)',
              border: '1px solid rgba(31,77,43,0.6)',
              color: '#fff',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(10px)',
              // hide when sheet open (drag-handle closes) or while the draw action bar is up
              opacity: sheetOpen || drawing ? 0 : 1,
              pointerEvents: sheetOpen || drawing ? 'none' : 'auto',
              transform: sheetOpen ? 'translateY(8px)' : 'translateY(0)',
            }}
            onClick={() => setSheetOpen(true)}
            aria-label="Open details panel"
          >
            <ChevronUp size={16} />
            {(data || loading) ? 'Results' : 'Details'}
            {loading && <span className="animate-spin inline-block text-xs">...</span>}
          </button>

          {/* ── Mobile: bottom sheet overlay ── */}
          {/* Scrim — tap to close */}
          {sheetOpen && (
            <div
              className="lg:hidden fixed inset-0 z-20"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
              onClick={() => setSheetOpen(false)}
              aria-hidden="true"
            />
          )}

          <div
            className="lg:hidden fixed left-0 right-0 z-30 flex flex-col overflow-hidden"
            style={{
              bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
              height: sheetOpen ? '85dvh' : 0,
              maxHeight: '90dvh',
              background: '#E4DCC6',
              borderTop: '1px solid #E2D8C4',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -4px 24px rgba(32,25,15,0.12)',
              // While a finger is on the grabber the sheet tracks it with no transition, so it
              // feels attached rather than laggy; on release the transition comes back and it
              // either springs home or finishes closing.
              transform: sheetDrag.dragY ? `translateY(${sheetDrag.dragY}px)` : undefined,
              transition: sheetDrag.dragging
                ? 'none'
                : 'height 0.32s cubic-bezier(0.32, 0.72, 0, 1), transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
              willChange: 'height, transform',
            }}
          >
            {/* Drag handle / close bar */}
            <button
              {...sheetDrag.handlers}
              className="flex-shrink-0 flex flex-col items-center justify-center gap-1 py-3 w-full"
              // touch-action:none so the browser hands us the vertical gesture instead of
              // treating it as a page scroll — without it the drag never reaches React.
              style={{ cursor: 'grab', background: 'transparent', border: 'none', touchAction: 'none' }}
              data-sheet-grabber=""
              aria-label="Close details panel — drag down or tap"
            >
              <div
                className="rounded-full"
                style={{ width: 40, height: 4, background: '#E2D8C4', opacity: 0.7 }}
              />
              <span className="text-xs font-mono" style={{ color: '#8C7A62', opacity: 0.6, letterSpacing: '0.05em' }}>
                tap to close
              </span>
            </button>

            {/* Panel content — scrolls inside the sheet */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <DataPanel
                data={data}
                loading={loading}
                coords={selected}
                mapCapture={mapCapture}
                siteData={siteData}
                waterData={waterData}
                forcedTab={forcedTab}
                onTabChange={() => setForcedTab(null)}
                onOpenReport={handleOpenReport}
                onViewReport={handleViewReport}
                onJumpTo={handleJumpTo}
                appLang={lang}
                activePlaceId={activePlaceId ?? undefined}
                placeName={activePlaceName}
                people={people}
                peopleLoading={peopleLoading}
                peopleError={peopleError}
                currentUserId={myProfile?.id}
                onOpenProfile={() => setProfileSheetOpen(true)}
                initialChatQuery={initialChatQuery}
                initialChatPhoto={initialChatPhoto}
                onChatDeepLinkConsumed={() => { setInitialChatQuery(null); setInitialChatPhoto(false); }}
                openSurvey={openSurvey}
                onSurveyOpened={() => setOpenSurvey(false)}
              />
            </div>
          </div>
        </div>

        <TabBar />
      </div>

      <ProfileSheet
        open={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
        profile={myProfile}
        mapCenter={selected ? { lat: selected.lat, lon: selected.lon } : undefined}
        onSaved={(updated) => setMyProfile(updated)}
      />

      <AddSheet
        open={addOpen}
        surface="map"
        onClose={() => setAddOpen(false)}
        onPick={handleAddPick}
      />
    </>
  );
}
