'use client';

import dynamic from 'next/dynamic';
import RoleSwitcher from '@/components/RoleSwitcher';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';

const NgoDashboard = dynamic(() => import('@/components/NgoDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ color: '#9A8268' }}>
      <span className="text-sm font-display">Loading dashboard…</span>
    </div>
  ),
});

export default function FunderPage() {
  return (
    <div className="h-screen flex flex-col" style={{ background: '#E4DCC6' }}>
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <BackButton />
        <BrandLogo icon="🏛" />
        <div className="w-px h-5" style={{ background: '#E2D8C4', opacity: 0.5 }} />
        <span className="text-xs hidden sm:block font-display" style={{ color: '#5C5040' }}>Funder · impact oversight</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono hidden md:block" style={{ background: 'rgba(47,111,158,0.12)', border: '1px solid rgba(47,111,158,0.3)', color: '#2F6F9E' }}>read-only · demo data</span>
        <div className="flex-1" />
        <SettingsButton />
        <RoleSwitcher current="funder" />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <NgoDashboard mode="funder" />
      </div>
    </div>
  );
}
