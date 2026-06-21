'use client';

import dynamic from 'next/dynamic';
import RoleSwitcher from '@/components/RoleSwitcher';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';

const NgoDashboard = dynamic(() => import('@/components/NgoDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
      <span className="text-sm font-display">Loading dashboard…</span>
    </div>
  ),
});

export default function NgoPage() {
  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-0)' }}>
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={{ height: 52, background: 'linear-gradient(180deg, rgba(14,28,13,0.98), rgba(10,21,9,0.95))', borderBottom: '1px solid var(--border)' }}>
        <BackButton />
        <BrandLogo icon="📊" />
        <div className="w-px h-5" style={{ background: 'var(--border-bright)', opacity: 0.5 }} />
        <span className="text-xs hidden sm:block font-display" style={{ color: 'var(--text-muted)' }}>NGO · programme overview</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono hidden md:block" style={{ background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.3)', color: 'var(--gold)' }}>demo data</span>
        <div className="flex-1" />
        <SettingsButton />
        <RoleSwitcher current="ngo" />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <NgoDashboard />
      </div>
    </div>
  );
}
