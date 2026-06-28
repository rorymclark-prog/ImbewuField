'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Settings, AlertTriangle, PenLine, ChevronUp, Menu } from 'lucide-react';
import DataPanel from '@/components/DataPanel';
import TabBar from '@/components/TabBar';
import ReportView from '@/components/ReportView';
import Onboarding from '@/components/Onboarding';
import LangSwitcher from '@/components/LangSwitcher';
import RoleSwitcher from '@/components/RoleSwitcher';
import AccountButton from '@/components/AccountButton';
import BrandLogo from '@/components/BrandLogo';
import ThemePanel from '@/components/ThemePanel';
import NavDrawer from '@/components/NavDrawer';
import ProfileSheet from '@/components/ProfileSheet';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { loadPlaces } from '@/lib/saved-places';
import { listOrgPeople, getMyProfile } from '@/lib/db/queries';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import type { SavedReport } from '@/lib/saved-reports';
import type { Profile } from '@/lib/db/types';
import type { PeopleMarker } from '@/components/Map';

const VALID_PANELS = ['Overview','Ask','Water','Soil','Climate','Area','Photos','Design','AI','Places','Reports','Farm'];
import { setLastSite } from '@/lib/last-site';

const PermaMap = dynamic(() => import('@/components/Map'), { ssr: false });

export default function Home() {
  return (
    <LanguageProvider>
      <Onboarding />
      <Suspense>
        <HomeInner />
      </Suspense>
    </LanguageProvider>
  );
}

function HomeInner() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Mobile bottom-sheet state — open/closed; auto-open if deep-linked to a panel
  const [sheetOpen, setSheetOpen] = useState(() => {
    const panel = searchParams.get('panel');
    const chat = searchParams.get('chat');
    return !!(panel || chat);
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const [people, setPeople] = useState<Profile[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  const handleLocationSelect = useCallback(async (lat: number, lon: number) => {
    setSelected({ lat, lon });
    setMapCapture(null);
    setError('');
    setSheetOpen(true);

    // Check localStorage cache (keyed to 2 dp — same location, no re-fetch)
    const cacheKey = `imbewu_loc_${lat.toFixed(2)}_${lon.toFixed(2)}`;
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

  const handleOpenReport = useCallback((photoAnalysis?: string) => {
    setReportPhotoAnalysis(photoAnalysis);
    setShowReport(true);
  }, []);

  // Remember the analysed site so the global chat assistant is site-aware everywhere.
  useEffect(() => {
    if (data) setLastSite({ locationData: data, siteData, waterData });
  }, [data, siteData, waterData]);

  // Auth guard — redirect to login when backend is configured and no user is signed in
  useEffect(() => {
    if (!authLoading && !user && isBackendConfigured()) router.replace('/login');
  }, [user, authLoading, router]);

  // Close sheet on Escape key
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
      const [team, me] = await Promise.all([listOrgPeople(), getMyProfile()]);
      if (!cancelled) {
        setPeople(team);
        setMyProfile(me);
        setPeopleLoading(false);
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

  // Render nothing while auth resolves (or while redirecting to /login)
  if (isBackendConfigured() && (authLoading || !user)) return null;

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

      <div className="flex flex-col" style={{ height: '100dvh', background: '#F7F2E9' }}>

        {/* ── Header ────────────────────────────── */}
        {/* Heights/sizes scale down on wide screens — phone px must not be reused
            on desktop (handoff §0). Mobile keeps the comfortable 60px bar. */}
        <header
          className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-3 overflow-x-auto overflow-y-hidden"
          style={{
            height: 60,
            background: '#FBF6EC',
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

          {/* Design-map + role switcher are power-user navigation — desktop only.
              On a phone they cluttered the bar into tiny icons; reach them via the home hub (tap the logo). */}
          <Link href="/facilitator" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans font-bold transition-all flex-shrink-0"
            style={{ fontSize: 15, background: 'rgba(192,122,30,0.1)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E' }}>
            <PenLine size={15} /> <span>Design map</span>
          </Link>
          <div className="hidden md:flex"><RoleSwitcher current="farmer" /></div>
          <LangSwitcher />
          <AccountButton />

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
            className="flex-shrink-0 flex items-center justify-center rounded-lg transition-all"
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

          {/* Map — always full height; on desktop it shares width with panel */}
          <div className="flex-1 relative min-w-0">
            <PermaMap
              onLocationSelect={handleLocationSelect}
              selectedLocation={selected}
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
              people={peopleMarkers}
              showPeople={showPeople}
              onTogglePeople={() => setShowPeople(v => !v)}
            />
          </div>

          {/* ── Drag handle to resize the side panel ── */}
          <div
            onPointerDown={startPanelResize}
            className="hidden lg:flex items-center justify-center flex-shrink-0 group"
            title="Drag to resize the panel"
            style={{ width: 8, cursor: 'col-resize', background: '#FBF6EC', borderLeft: '1px solid #E2D8C4' }}
          >
            <div style={{ width: 3, height: 36, borderRadius: 3, background: 'rgba(92,80,64,0.25)' }} className="group-hover:bg-stone-400 transition-colors" />
          </div>

          {/* ── Desktop side panel (md+) ── */}
          <div
            className="hidden lg:flex flex-shrink-0 overflow-hidden flex-col"
            style={{ width: panelWidth, background: '#FBF6EC', borderLeft: '1px solid #E2D8C4' }}
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
              currentUserId={myProfile?.id}
              onOpenProfile={() => setProfileSheetOpen(true)}
            />
          </div>

          {/* ── Mobile: floating "Details" toggle button ── */}
          {/* Visible only below md, hidden when sheet is open or while drawing a boundary */}
          <button
            className="lg:hidden fixed right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-display font-semibold shadow-lg transition-all"
            style={{
              bottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 16px)',
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
              background: '#F7F2E9',
              borderTop: '1px solid #E2D8C4',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -4px 24px rgba(32,25,15,0.12)',
              transition: 'height 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
              willChange: 'height',
            }}
          >
            {/* Drag handle / close bar */}
            <button
              className="flex-shrink-0 flex flex-col items-center justify-center gap-1 py-3 w-full"
              style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
              onClick={() => setSheetOpen(false)}
              aria-label="Close details panel"
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
                currentUserId={myProfile?.id}
                onOpenProfile={() => setProfileSheetOpen(true)}
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
    </>
  );
}
