'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { Settings, AlertTriangle, PenLine, ChevronUp } from 'lucide-react';
import DataPanel from '@/components/DataPanel';
import ReportView from '@/components/ReportView';
import Onboarding from '@/components/Onboarding';
import LangSwitcher from '@/components/LangSwitcher';
import RoleSwitcher from '@/components/RoleSwitcher';
import AccountButton from '@/components/AccountButton';
import BrandLogo from '@/components/BrandLogo';
import ThemePanel from '@/components/ThemePanel';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import type { SavedReport } from '@/lib/saved-reports';
import { setLastSite } from '@/lib/last-site';

const PermaMap = dynamic(() => import('@/components/Map'), { ssr: false });

export default function Home() {
  return (
    <LanguageProvider>
      <Onboarding />
      <HomeInner />
    </LanguageProvider>
  );
}

function HomeInner() {
  const { t, lang } = useLanguage();
  const [selected, setSelected] = useState<{ lat: number; lon: number } | null>(null);
  const [data, setData] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapCapture, setMapCapture] = useState<string | null>(null);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [waterData, setWaterData] = useState<WaterData | null>(null);
  const [forcedTab, setForcedTab] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<{ lat: number; lon: number } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportPhotoAnalysis, setReportPhotoAnalysis] = useState<string | undefined>();
  const [savedReportView, setSavedReportView] = useState<SavedReport | null>(null);

  const handleViewReport = useCallback((r: SavedReport) => {
    setSavedReportView(r);
    setShowReport(true);
  }, []);

  // Mobile bottom-sheet state — open/closed
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawing, setDrawing] = useState(false); // boundary/water draw active → hide the Results FAB

  const handleLocationSelect = useCallback(async (lat: number, lon: number) => {
    setSelected({ lat, lon });
    setMapCapture(null);
    setLoading(true);
    setError('');
    // Auto-open sheet on mobile when a location is tapped
    setSheetOpen(true);
    try {
      const res = await fetch(`/api/location-data?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
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

  // Close sheet on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // When boundary/water drawing starts, collapse the bottom sheet so the crosshair and
  // the lower part of the map aren't hidden behind the 70vh panel.
  useEffect(() => { if (drawing) setSheetOpen(false); }, [drawing]);

  return (
    <>
      <ThemePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {showReport && (data || savedReportView) && (
        <ReportView
          locationData={data ?? savedReportView!.location}
          photoAnalysis={reportPhotoAnalysis}
          siteData={siteData ?? undefined}
          waterData={waterData ?? undefined}
          mapCapture={mapCapture}
          appLang={lang}
          savedReport={savedReportView ?? undefined}
          onClose={() => { setShowReport(false); setSavedReportView(null); }}
        />
      )}

      <div className="flex flex-col" style={{ height: '100dvh', background: '#F7F2E9' }}>

        {/* ── Header ────────────────────────────── */}
        <header
          className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto overflow-y-hidden"
          style={{
            height: 74,
            background: '#FBF6EC',
            borderBottom: '1px solid #E2D8C4',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <BrandLogo />

          <div className="w-px h-5 flex-shrink-0 hidden md:block" style={{ background: '#E2D8C4', opacity: 0.5 }} />
          <span className="text-xs hidden sm:block font-display" style={{ color: '#5C5040' }}>{t('tagline')}</span>
          <div className="flex-1" />

          {/* Design-map + role switcher are power-user navigation — desktop only.
              On a phone they cluttered the bar into tiny icons; reach them via the home hub (tap the logo). */}
          <Link href="/facilitator" className="hidden md:flex items-center gap-1 px-3 py-2 rounded-full text-sm font-display transition-all flex-shrink-0"
            style={{ background: 'rgba(226,216,196,0.4)', border: '1px solid #E2D8C4', color: '#C07A1E' }}>
            <PenLine size={14} /> <span>Design map</span>
          </Link>
          <div className="hidden md:flex"><RoleSwitcher current="farmer" /></div>
          <LangSwitcher />
          <AccountButton />

          <div className="hidden md:flex items-center gap-2">
            {[
              { dot: 'var(--emerald)', label: 'NASA POWER' },
              { dot: 'var(--teal)', label: 'ISRIC Soil' },
              { dot: 'var(--blue)', label: 'OpenTopo' },
              { dot: 'var(--gold)', label: 'Claude AI' },
            ].map(({ dot, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                   style={{ background: 'rgba(226,216,196,0.35)', border: '1px solid #E2D8C4', color: '#5C5040', fontFamily: 'var(--font-mono)' }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
                {label}
              </div>
            ))}
          </div>

          {error && (
            <span className="text-xs px-3 py-1 rounded-full font-mono flex-shrink-0 flex items-center"
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
              width: 54, height: 54,
              background: 'rgba(226,216,196,0.35)',
              border: '1px solid #E2D8C4',
              color: '#5C5040',
              cursor: 'pointer',
            }}
          >
            <Settings size={20} />
          </button>
        </header>

        {/* ── Main ──────────────────────────────── */}
        {/*
          Desktop (md+): side-by-side — map flex-1, panel 390px fixed-width column.
          Mobile (<md):  map fills full width; DataPanel is a bottom sheet overlay.
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
            />
          </div>

          {/* ── Desktop side panel (md+) ── */}
          <div
            className="hidden md:flex flex-shrink-0 overflow-hidden flex-col"
            style={{ width: 390, background: '#FBF6EC', borderLeft: '1px solid #E2D8C4' }}
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
            />
          </div>

          {/* ── Mobile: floating "Details" toggle button ── */}
          {/* Visible only below md, hidden when sheet is open or while drawing a boundary */}
          <button
            className="md:hidden fixed bottom-5 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-display font-semibold shadow-lg transition-all"
            style={{
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
              className="md:hidden fixed inset-0 z-20"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
              onClick={() => setSheetOpen(false)}
              aria-hidden="true"
            />
          )}

          <div
            className="md:hidden fixed left-0 right-0 bottom-0 z-30 flex flex-col overflow-hidden"
            style={{
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
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
