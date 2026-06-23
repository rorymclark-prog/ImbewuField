'use client';

import dynamic from 'next/dynamic';
import RoleSwitcher from '@/components/RoleSwitcher';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';
import TabBar from '@/components/TabBar';

const NgoDashboard = dynamic(() => import('@/components/NgoDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
      <span className="text-sm font-display">Loading dashboard...</span>
    </div>
  ),
});

export default function FunderPage() {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <BackButton />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--border-bright)', opacity: 0.5 }} />
        <span className="text-xs hidden sm:block font-display" style={{ color: '#5C5040' }}>Funder · impact oversight</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono hidden md:block" style={{ background: 'rgba(91,158,212,0.12)', border: '1px solid rgba(91,158,212,0.3)', color: 'var(--blue)' }}>read-only · demo data</span>
        <div className="flex-1" />
        <SettingsButton />
        <RoleSwitcher current="funder" />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <NgoDashboard mode="funder" />
      </div>
      <TabBar />
    </div>
  );
}
