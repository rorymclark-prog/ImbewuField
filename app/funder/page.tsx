'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BarChart3, Loader2, Sprout } from 'lucide-react';
import RoleSwitcher from '@/components/RoleSwitcher';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { canAccessRolePage } from '@/lib/role-access';
import type { UserRole } from '@/lib/db/types';

const NgoDashboard = dynamic(() => import('@/components/NgoDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
      <span className="text-sm font-display">Loading dashboard…</span>
    </div>
  ),
});

/*
 * THE DEFAULT VIEW IS THE COHORT, NOT THE GARDEN LIST.
 *
 * NgoDashboard reads the `gardens` collection — the programme's own structure — and is the right
 * screen for a programme manager arranging sites and gardeners. It is not what a funder opens
 * with: it answers "what have we set up", not "what did the money buy". The cohort view answers
 * the second question from the authorised, consent-projected portfolio read.
 *
 * The garden list stays one tap away rather than being removed. It is the only screen that lists
 * gardeners per garden, and an NGO administrator uses it daily.
 */
const CohortDashboard = dynamic(() => import('@/components/funder/CohortDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
      <span className="text-sm font-display">Loading the cohort…</span>
    </div>
  ),
});

const FUNDER_ALLOWED_ROLES = new Set<UserRole>(['funder', 'admin']);

const FUNDER_VIEWS = [
  { key: 'cohort', label: 'Cohort', icon: BarChart3 },
  { key: 'gardens', label: 'Gardens', icon: Sprout },
] as const;

export default function FunderPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();
  // useState+useEffect, not a direct isSampleMode() read in render: sessionStorage is
  // client-only, so a render-time read would disagree with the server-rendered HTML.
  const [sample, setSample] = useState(false);
  useEffect(() => { setSample(isSampleMode()); }, []);
  const [view, setView] = useState<'cohort' | 'gardens'>('cohort');

  useEffect(() => {
    // Sample mode has no user by design; bouncing it to /login would make the
    // funder/NGO demo unreachable on production, where a backend is always configured.
    if (!loading && !user && isLive && !isSampleMode()) router.replace('/login');
  }, [user, loading, router, isLive]);

  if (!loading && user && isLive && !canAccessRolePage(role, FUNDER_ALLOWED_ROLES)) {
    return (
      <div className="flex h-screen items-center justify-center px-4" style={{ background: 'var(--bg-0)' }}>
        <div className="rounded-2xl px-6 py-8 text-center max-w-xs" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
          <p className="text-sm font-display font-semibold mb-1" style={{ color: '#20190F' }}>This is the Funder area</p>
          <p className="text-xs font-sans leading-relaxed" style={{ color: '#8C7A62' }}>This dashboard is for funders and administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <MenuButton />
        <BackButton />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--border-bright)', opacity: 0.5 }} />
        <span className="text-xs hidden sm:block font-display" style={{ color: '#5C5040' }}>Funder · impact oversight</span>
        {/* Was an unconditional "demo data". NgoDashboard reads REAL Firestore via listGardens()
            and only falls back to its sample gardens when there is no backend configured, so the
            label now tracks that same condition — no backend, or sample mode. A permanent "demo" badge on real programme
            figures teaches a funder to discount them. */}
        {/* Scoped to the gardens view: the cohort view labels its own sample state from what the
            portfolio read actually returned (`portfolio.isDemo`), which is the more exact test —
            a configured backend with no signed-in caller is still sample data. Two badges saying
            it at once, from two different tests, is how they end up disagreeing. */}
        {(!isLive || sample) && view === 'gardens' && (
          <span className="text-xs px-2 py-0.5 rounded-full font-mono hidden md:block" style={{ background: 'rgba(158,92,8,0.12)', border: '1px solid rgba(158,92,8,0.3)', color: '#9E5C08' }}>sample data</span>
        )}
        <div className="flex-1" />
        <a
          href="/network"
          className="text-xs font-display hidden sm:block"
          style={{ color: '#1F4D2B', textDecoration: 'none', marginRight: 4 }}
        >
          Portfolio map →
        </a>
        <LessonLink id="funder:overview" label="Learn" />
        <SettingsButton />
        <RoleSwitcher current="funder" />
      </header>

      {/* Tab strip — same idiom as /ngo, so the two staff areas are navigated the same way. */}
      <div
        className="flex-shrink-0 flex"
        style={{ background: '#FFFEFA', borderBottom: '1px solid #E2D8C4', paddingLeft: 16, paddingRight: 16 }}
      >
        {FUNDER_VIEWS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className="flex items-center gap-1.5 py-2.5 px-3 font-display text-xs font-semibold transition-colors duration-150"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: view === key ? '#1F4D2B' : '#8C7A62',
              borderBottom: view === key ? '2px solid #1F4D2B' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {view === 'cohort' ? <CohortDashboard mode="funder" /> : <NgoDashboard mode="funder" />}
      </div>
    </div>
  );
}
