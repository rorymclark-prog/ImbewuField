'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import RoleSwitcher from '@/components/RoleSwitcher';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { canAccessRolePage } from '@/lib/role-access';
import type { UserRole } from '@/lib/db/types';

const NgoDashboard = dynamic(() => import('@/components/NgoDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ color: '#9A8268' }}>
      <span className="text-sm font-display">Loading dashboard…</span>
    </div>
  ),
});

const FUNDER_ALLOWED_ROLES = new Set<UserRole>(['funder', 'admin']);

export default function FunderPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();

  useEffect(() => {
    if (!loading && !user && isLive) router.replace('/login');
  }, [user, loading, router, isLive]);

  if (!loading && user && isLive && !canAccessRolePage(role, FUNDER_ALLOWED_ROLES)) {
    return (
      <div className="flex h-screen items-center justify-center px-4" style={{ background: '#E4DCC6' }}>
        <div className="rounded-2xl px-6 py-8 text-center max-w-xs" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
          <p className="text-sm font-display font-semibold mb-1" style={{ color: '#20190F' }}>This is the Funder area</p>
          <p className="text-xs font-sans leading-relaxed" style={{ color: '#8C7A62' }}>This dashboard is for funders and administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: '#E4DCC6' }}>
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <MenuButton />
        <BackButton />
        <BrandLogo icon="🏛" />
        <div className="w-px h-5" style={{ background: '#E2D8C4', opacity: 0.5 }} />
        <span className="text-xs hidden sm:block font-display" style={{ color: '#5C5040' }}>Funder · impact oversight</span>
        {/* Was an unconditional "demo data". NgoDashboard reads REAL Firestore via listGardens()
            and only falls back to its sample gardens when there is no backend configured, so the
            label now tracks that same condition. A permanent "demo" badge on real programme
            figures teaches a funder to discount them. */}
        {!isLive && (
          <span className="text-xs px-2 py-0.5 rounded-full font-mono hidden md:block" style={{ background: 'rgba(47,111,158,0.12)', border: '1px solid rgba(47,111,158,0.3)', color: '#2F6F9E' }}>sample data</span>
        )}
        <div className="flex-1" />
        <a
          href="/network"
          className="text-xs font-display hidden sm:block"
          style={{ color: '#2F6F9E', textDecoration: 'none', marginRight: 4 }}
        >
          Portfolio map →
        </a>
        <LessonLink id="funder:overview" label="Learn" />
        <SettingsButton />
        <RoleSwitcher current="funder" />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <NgoDashboard mode="funder" />
      </div>
    </div>
  );
}
