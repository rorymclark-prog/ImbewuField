'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import RoleSwitcher from '@/components/RoleSwitcher';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';

const FacilitatorCanvas = dynamic(() => import('@/components/FacilitatorCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
      <span className="text-sm font-display">Loading design canvas…</span>
    </div>
  ),
});

export default function FacilitatorPage() {
  const [site, setSite] = useState('');

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={{ height: 52, background: 'linear-gradient(180deg, rgba(14,28,13,0.98), rgba(10,21,9,0.95))', borderBottom: '1px solid var(--border)' }}>
        <BackButton />
        <BrandLogo icon="✎" />
        <div className="w-px h-5" style={{ background: 'var(--border-bright)', opacity: 0.5 }} />
        <span className="text-xs hidden sm:block font-display" style={{ color: '#cfe0cd' }}>Community supervisor · garden designer</span>

        <input
          value={site}
          onChange={(e) => setSite(e.target.value)}
          placeholder="Garden / site name + notes (helps the AI review)…"
          className="dark-input ml-2 flex-1 max-w-md text-xs font-display rounded-lg px-2.5 py-1.5 outline-none"
          style={{ background: 'rgba(22,37,20,0.6)', border: '1px solid var(--border)', color: '#e8f0e6' }}
        />

        <div className="flex-1" />
        <SettingsButton />
        <RoleSwitcher current="facilitator" />
      </header>

      {/* Canvas */}
      <div className="flex-1 flex overflow-hidden">
        <FacilitatorCanvas siteText={site || undefined} />
      </div>
    </div>
  );
}
