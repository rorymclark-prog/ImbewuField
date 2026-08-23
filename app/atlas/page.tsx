'use client';

// Atlas — global garden explorer. Route shell only: header + TabBar in the
// app's standard sub-page chrome (see app/plan/page.tsx), with the map/panel
// in components/atlas/AtlasExplorer, dynamically imported without SSR the
// same way app/farmer does for components/Map (mapbox-gl needs window).

import dynamic from 'next/dynamic';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import MenuButton from '@/components/MenuButton';

const AtlasExplorer = dynamic(() => import('@/components/atlas/AtlasExplorer'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <span className="font-display" style={{ fontSize: 14, color: '#5C5040' }}>Loading the world…</span>
    </div>
  ),
});

export default function AtlasPage() {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      <header
        className="flex-shrink-0 flex items-center px-3 md:px-4 gap-2"
        style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}
      >
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>Atlas · global garden explorer</span>
        <div className="flex-1" />
        <SettingsButton />
      </header>

      <AtlasExplorer />

      <TabBar />
    </div>
  );
}
