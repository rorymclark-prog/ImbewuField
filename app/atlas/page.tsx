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
import { APP_HEADER_STYLE } from '@/lib/app-header';

const AtlasExplorer = dynamic(() => import('@/components/atlas/AtlasExplorer'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <span className="font-display" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading the world…</span>
    </div>
  ),
});

export default function AtlasPage() {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      <header
        className="flex-shrink-0 flex items-center px-3 md:px-4 gap-2"
        style={APP_HEADER_STYLE}
      >
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--border)' }} />
        <h1 className="text-xs font-display truncate min-w-0 m-0" style={{ color: 'var(--text-secondary)' }}>Atlas · global garden explorer</h1>
        <div className="flex-1" />
        <SettingsButton />
      </header>

      <AtlasExplorer />

      <TabBar />
    </div>
  );
}
