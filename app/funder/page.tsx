'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BarChart3, Sprout } from 'lucide-react';
import RoleSwitcher from '@/components/RoleSwitcher';
import DashboardTabs from '@/components/DashboardTabs';
import { SampleFunderGate } from '@/components/SampleProgramme';
import Link from 'next/link';
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
import { useLanguage } from '@/lib/i18n-context';
import { APP_HEADER_STYLE } from '@/lib/app-header';
import { useAppLevel } from '@/lib/app-level';
const tr = (lang: string, en: string, zu: string) => lang === 'zu' ? zu : en;

// Simple / All tools (Settings → "How much to show", lib/app-level.ts). All tools is this tab
// strip exactly as it has always been. Simple defaults to Cohort and Progress & milestones —
// Gardens (the raw operational site list), Production area and Assessments (raw M&E data) move
// to All tools, alongside the underlying reports a Simple funder still gets through Reports.
type FunderView = 'cohort' | 'gardens' | 'assessments' | 'area' | 'reports' | 'evidence';
const FUNDER_SIMPLE_VIEWS = new Set<FunderView>(['cohort', 'evidence', 'reports']);
const FUNDER_ALL_VIEWS = new Set<FunderView>(['evidence', 'reports', 'cohort', 'gardens', 'area', 'assessments']);

function DashboardLoading({ cohort = false }: { cohort?: boolean }) {
  const { lang } = useLanguage();
  return <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
    <span className="text-sm font-display">{tr(lang, cohort ? 'Loading the cohort…' : 'Loading dashboard…', cohort ? 'Kusalayishwa iqembu…' : 'Kusalayishwa ideshibhodi…')}</span>
  </div>;
}

const NgoDashboard = dynamic(() => import('@/components/NgoDashboard'), {
  ssr: false,
  loading: () => <DashboardLoading />,
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
  loading: () => <DashboardLoading cohort />,
});

const FUNDER_ALLOWED_ROLES = new Set<UserRole>(['funder', 'admin']);
const ProgrammeEvidence = dynamic(() => import('@/components/ProgrammeEvidence'), { ssr: false });
const ProgrammeReports = dynamic(() => import('@/components/ProgrammeReports'), { ssr: false });
const ProductionAreas = dynamic(() => import('@/components/ProductionAreas'), { ssr: false });
const FunderAssessments = dynamic(() => import('@/components/funder/FunderAssessments'), { ssr: false });

export default function FunderPage() {
  const { lang } = useLanguage();
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();
  // useState+useEffect, not a direct isSampleMode() read in render: sessionStorage is
  // client-only, so a render-time read would disagree with the server-rendered HTML.
  const [sample, setSample] = useState(false);
  useEffect(() => { setSample(isSampleMode()); }, []);
  const [view, setView] = useState<FunderView>('cohort');
  const simple = useAppLevel() === 'simple';

  useEffect(() => {
    // Sample mode has no user by design; bouncing it to /login would make the
    // funder/NGO demo unreachable on production, where a backend is always configured.
    if (!loading && !user && isLive && !isSampleMode()) router.replace('/login');
  }, [user, loading, router, isLive]);

  // A tab hidden by the level just switched to is no longer reachable — land back on Cohort
  // rather than leaving the view stuck on a tab strip that no longer shows it as selected.
  useEffect(() => {
    const allowed = simple ? FUNDER_SIMPLE_VIEWS : FUNDER_ALL_VIEWS;
    setView((current) => (allowed.has(current) ? current : 'cohort'));
  }, [simple]);

  if (!loading && user && isLive && !sample && !canAccessRolePage(role, FUNDER_ALLOWED_ROLES)) {
    return (
      <div className="flex h-screen items-center justify-center px-4" style={{ background: 'var(--bg-0)' }}>
        <div className="rounded-2xl px-6 py-8 text-center max-w-xs" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-display font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{tr(lang, 'This is the Funder area', 'Le yindawo yabaxhasi')}</p>
          <p className="text-xs font-sans leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{tr(lang, 'This dashboard is for funders and administrators.', 'Le deshibhodi ingeyabaxhasi nabaphathi.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-0)' }}>
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4 overflow-x-auto"
        style={APP_HEADER_STYLE}>
        <MenuButton />
        <BackButton />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--border)', opacity: 0.5 }} />
        <h1 className="text-xs font-display m-0 sr-only sm:not-sr-only sm:block" style={{ color: 'var(--text-secondary)' }}>{tr(lang, 'Funder · impact oversight', 'Umxhasi · ukubheka umthelela')}</h1>
        {/* Was an unconditional "demo data". NgoDashboard reads REAL Firestore via listGardens()
            and only falls back to its sample gardens when there is no backend configured, so the
            label now tracks that same condition — no backend, or sample mode. A permanent "demo" badge on real programme
            figures teaches a funder to discount them. */}
        {/* Scoped to the gardens view: the cohort view labels its own sample state from what the
            portfolio read actually returned (`portfolio.isDemo`), which is the more exact test —
            a configured backend with no signed-in caller is still sample data. Two badges saying
            it at once, from two different tests, is how they end up disagreeing. */}
        {(!isLive || sample) && view === 'gardens' && (
          <span className="text-xs px-2 py-0.5 rounded-full font-mono hidden md:block" style={{ background: 'rgba(47,111,158,0.12)', border: '1px solid rgba(47,111,158,0.3)', color: 'var(--blue)' }}>{tr(lang, 'demonstration records', 'amarekhodi esibonelo')}</span>
        )}
        <div className="flex-1" />
        <Link
          href="/network"
          className="text-xs font-display hidden sm:block"
          style={{ color: 'var(--blue)', textDecoration: 'none', marginRight: 4 }}
        >
          {tr(lang, 'Portfolio map →', 'Imephu yohlelo →')}
        </Link>
        <LessonLink id="funder:overview" label={tr(lang, 'Learn', 'Funda')} />
        <Link href="/tour" className="shrink-0 text-sm font-semibold">{tr(lang, 'Take a tour', 'Buka uhambo')}</Link>
        <SettingsButton />
        <RoleSwitcher current="funder" />
      </header>

      <DashboardTabs>
        {(simple ? [
          { key: 'cohort', label: tr(lang, 'Cohort', 'Iqembu'), icon: BarChart3 },
          { key: 'evidence', label: tr(lang, 'Progress & milestones', 'Inqubekelaphambili nezinyathelo ezibalulekile'), icon: BarChart3 },
          { key: 'reports', label: tr(lang, 'Reports', 'Imibiko'), icon: BarChart3 },
        ] as const : [
          { key: 'evidence', label: tr(lang, 'Progress & milestones', 'Inqubekelaphambili nezinyathelo ezibalulekile'), icon: BarChart3 },
          { key: 'reports', label: tr(lang, 'Reports', 'Imibiko'), icon: BarChart3 },
          { key: 'cohort', label: tr(lang, 'Cohort', 'Iqembu'), icon: BarChart3 },
          { key: 'gardens', label: tr(lang, 'Gardens', 'Izingadi'), icon: Sprout },
          { key: 'area', label: tr(lang, 'Production area', 'Indawo yokukhiqiza'), icon: Sprout },
          { key: 'assessments', label: tr(lang, 'Assessments', 'Ukuhlola'), icon: BarChart3 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-label={label}
            aria-pressed={view === key}
            className="flex shrink-0 whitespace-nowrap items-center gap-1.5 py-2.5 px-3 font-sans text-sm font-semibold"
            onFocus={e => e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
            style={{
              background: 'transparent',
              minHeight: 44,
              border: 'none',
              cursor: 'pointer',
              color: view === key ? 'var(--color-forest-800)' : 'var(--text-secondary)',
              borderBottom: view === key ? '2px solid var(--color-forest-800)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </DashboardTabs>

      {lang === 'zu' && <p className="px-4 pt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>Imibiko, ubufakazi obunemithombo, neminye imininingwane yohlelo kusaboniswa ngesiNgisi.</p>}

      <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">
        <SampleFunderGate key={view}>{view === 'evidence' ? <ProgrammeEvidence funder /> : view === 'reports' ? <ProgrammeReports funder /> : view === 'cohort' ? <CohortDashboard mode="funder" /> : view === 'area' ? <ProductionAreas publishedOnly /> : view === 'assessments' ? <FunderAssessments /> : <NgoDashboard mode="funder" />}</SampleFunderGate>
      </div>
    </div>
  );
}
