'use client';

import dynamic from 'next/dynamic';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RoleSwitcher from '@/components/RoleSwitcher';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';

const FacilitatorCanvas = dynamic(() => import('@/components/FacilitatorCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ color: '#9A8268' }}>
      <span className="text-sm font-display">Loading design canvas…</span>
    </div>
  ),
});

function FacilitatorPageInner() {
  const [site, setSite] = useState('');

  // Auto-pick site from URL (?lat=&lon=&name=) — e.g. a "Design this" link from the
  // main map. Number(null) === 0 — a missing param must NOT masquerade as latitude
  // 0 / longitude 0 — so a missing/blank param is treated as "no site", not (0, 0).
  const params = useSearchParams();
  const latRaw = params.get('lat');
  const lonRaw = params.get('lon');
  const lat = latRaw === null || latRaw === '' ? NaN : Number(latRaw);
  const lon = lonRaw === null || lonRaw === '' ? NaN : Number(lonRaw);
  const initialSite = Number.isFinite(lat) && Number.isFinite(lon)
    ? { lat, lon, name: params.get('name') || 'Imported site' }
    : undefined;

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#F7F2E9' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <BackButton />
        <BrandLogo icon="✎" />
        <div className="w-px h-5" style={{ background: '#E2D8C4', opacity: 0.5 }} />
        <span className="text-xs hidden sm:block font-display" style={{ color: '#5C5040' }}>Community supervisor · garden designer</span>

        <input
          value={site}
          onChange={(e) => setSite(e.target.value)}
          placeholder="Garden / site name + notes (helps the AI review)…"
          className="dark-input ml-2 flex-1 max-w-md text-xs font-display rounded-lg px-2.5 py-1.5 outline-none"
          style={{ background: 'rgba(22,37,20,0.6)', border: '1px solid #E2D8C4', color: '#e8f0e6' }}
        />

        <div className="flex-1" />
        <SettingsButton />
        <RoleSwitcher current="facilitator" />
      </header>

      {/* Canvas */}
      <div className="flex-1 flex overflow-hidden">
        <FacilitatorCanvas siteText={site || undefined} initialSite={initialSite} />
      </div>
    </div>
  );
}

export default function FacilitatorPage() {
  return (
    <Suspense fallback={<div style={{ height: '100dvh', background: '#F7F2E9' }} />}>
      <FacilitatorPageInner />
    </Suspense>
  );
}
