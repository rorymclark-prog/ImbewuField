'use client';

// Atlas — global garden explorer. Route shell only: header + TabBar in the
// app's standard sub-page chrome (see app/plan/page.tsx), with the map/panel
// in components/atlas/AtlasExplorer, dynamically imported without SSR the
// same way app/farmer does for components/Map (mapbox-gl needs window).

import dynamic from 'next/dynamic';
import AppHeader from '@/components/layout/AppHeader';
import TabBar from '@/components/TabBar';
import LanguageDraftNote from '@/components/LanguageDraftNote';
import { useLanguage } from '@/lib/i18n';

const AtlasExplorer = dynamic(() => import('@/components/atlas/AtlasExplorer'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <span className="font-display" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading the world…</span>
    </div>
  ),
});

export default function AtlasPage() {
  const {lang}=useLanguage();
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      <AppHeader title="Atlas" />
      {/* nav-17: AppHeader's title is a <span>, not a heading — keep a real (if visually
          hidden) h1 now that the old header's own h1 is gone; the map fills the screen and
          has no room for a visible heading above it. */}
      <h1 className="sr-only">Atlas · global garden explorer</h1>

      {['zu','st','ts','ve'].includes(lang)&&<div className="px-3 py-2"><LanguageDraftNote lang={lang} scope="atlas" /></div>}
      <AtlasExplorer />

      <TabBar hideAtDesktop />
    </div>
  );
}
