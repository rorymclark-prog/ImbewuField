'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Sprout, Map, ClipboardList, FileText, MapPin, TrendingUp, Users } from 'lucide-react';
import RoleSwitcher from '@/components/RoleSwitcher';
import DashboardTabs from '@/components/DashboardTabs';
import { SampleFunderGate } from '@/components/SampleProgramme';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { canAccessRolePage } from '@/lib/role-access';
import type { UserRole } from '@/lib/db/types';
import { useLanguage } from '@/lib/i18n-context';
import { useAppLevel } from '@/lib/app-level';
import { inlineText } from '@/lib/xh-inline';
const tr = (lang: string, en: string, zu: string) => inlineText(lang, en, zu);

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
      <AppHeader
        title={tr(lang, 'Funder', 'Umxhasi')}
        backFallback="/"
        right={<>
          {/* Was an unconditional "demo data". NgoDashboard reads REAL Firestore via listGardens()
              and only falls back to its sample gardens when there is no backend configured, so the
              label now tracks that same condition — no backend, or sample mode. A permanent "demo" badge on real programme
              figures teaches a funder to discount them. */}
          {/* Scoped to the gardens view: the cohort view labels its own sample state from what the
              portfolio read actually returned (`portfolio.isDemo`), which is the more exact test —
              a configured backend with no signed-in caller is still sample data. Two badges saying
              it at once, from two different tests, is how they end up disagreeing. */}
          {(!isLive || sample) && view === 'gardens' && (
            <span className="text-xs px-2 py-0.5 rounded-full font-sans hidden md:block" style={{ background: 'rgba(47,111,158,0.12)', border: '1px solid rgba(47,111,158,0.3)', color: 'var(--blue)' }}>{tr(lang, 'demonstration records', 'amarekhodi esibonelo')}</span>
          )}
          <Link
              href="/network"
              aria-label={tr(lang, 'Portfolio map', 'Imephu yohlelo')}
              className="hidden sm:inline-flex lg:hidden items-center gap-1.5 px-3 text-sm font-sans font-semibold whitespace-nowrap rounded-full"
              style={{ minHeight: 44, color: 'var(--text-primary)', border: '1px solid var(--border)', textDecoration: 'none' }}
            >
              <Map size={16} aria-hidden="true" />
              <span data-header-label>{tr(lang, 'Portfolio map', 'Imephu yohlelo')}</span>
            </Link>
          <LessonLink id="funder:overview" label={tr(lang, 'Learn', 'Funda')} />
          <RoleSwitcher current="funder" />
        </>}
      />

      <DashboardTabs>
        {(simple ? [
          { key: 'cohort', label: tr(lang, 'Cohort', 'Iqembu'), icon: Users },
          { key: 'evidence', label: tr(lang, 'Progress & milestones', 'Inqubekelaphambili nezinyathelo ezibalulekile'), icon: TrendingUp },
          { key: 'reports', label: tr(lang, 'Reports', 'Imibiko'), icon: FileText },
        ] as const : [
          { key: 'evidence', label: tr(lang, 'Progress & milestones', 'Inqubekelaphambili nezinyathelo ezibalulekile'), icon: TrendingUp },
          { key: 'reports', label: tr(lang, 'Reports', 'Imibiko'), icon: FileText },
          { key: 'cohort', label: tr(lang, 'Cohort', 'Iqembu'), icon: Users },
          { key: 'gardens', label: tr(lang, 'Gardens', 'Izingadi'), icon: Sprout },
          { key: 'area', label: tr(lang, 'Production area', 'Indawo yokukhiqiza'), icon: MapPin },
          { key: 'assessments', label: tr(lang, 'Assessments', 'Ukuhlola'), icon: ClipboardList },
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
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </DashboardTabs>

      {lang === 'zu' && <p className="px-4 pt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>Imibiko, ubufakazi obunemithombo, neminye imininingwane yohlelo kusaboniswa ngesiNgisi.</p>}
      {lang === 'xh' && <p className="px-4 pt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{inlineText(lang, 'Reports, sourced evidence and other programme details are still shown in English.')}</p>}

      <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">
        <SampleFunderGate key={view}>{view === 'evidence' ? <ProgrammeEvidence funder /> : view === 'reports' ? <ProgrammeReports funder onOpenProgress={() => setView('evidence')} onOpenCohort={() => setView('cohort')} /> : view === 'cohort' ? (
          // code-13: the only heading on this page used to be the 13px header chip in AppHeader
          // (a <span>, not a heading) — a real, properly-sized h1 on the default tab.
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <h1 className="t-h1 font-display px-3 md:px-5 pt-3" style={{ color: 'var(--text-primary)' }}>
              {tr(lang, 'Funder dashboard', 'Ibhodi labaxhasi')}
            </h1>
            <CohortDashboard mode="funder" />
          </div>
        ) : view === 'area' ? <ProductionAreas publishedOnly /> : view === 'assessments' ? <FunderAssessments /> : <NgoDashboard mode="funder" />}</SampleFunderGate>
      </div>
      <TabBar hideAtDesktop />
    </div>
  );
}
