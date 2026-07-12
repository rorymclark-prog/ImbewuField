'use client';

import Link from 'next/link';
import {
  Sprout,
  Users,
  BarChart3,
  Building2,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Settings,
  Leaf,
  CalendarDays,
  ClipboardList,
  Camera,
  Menu,
  DollarSign,
  MessageCircle,
  Wheat,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import ThemePanel from '@/components/ThemePanel';
import LimaBar from '@/components/LimaBar';
import TabBar from '@/components/TabBar';
import NavDrawer from '@/components/NavDrawer';
import Onboarding from '@/components/Onboarding';
import PopiaConsent from '@/components/PopiaConsent';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { getLastSite, type LastSite } from '@/lib/last-site';

// Map app lang codes to BCP 47 locale codes for date formatting.
// Falls back to 'en-ZA' for any code not listed (covers future additions).
const LANG_TO_LOCALE: Record<string, string> = {
  en: 'en-ZA',
  af: 'af-ZA',
  zu: 'zu-ZA',
  xh: 'xh-ZA',
  st: 'st-ZA',
  nso: 'nso-ZA',
  tn: 'tn-ZA',
  ts: 'ts-ZA',
  ve: 've-ZA',
  ss: 'ss-ZA',
  nr: 'nr-ZA',
};

function getDayDate(lang: string) {
  const locale = LANG_TO_LOCALE[lang] ?? 'en-ZA';
  const now = new Date();
  const day = now.toLocaleDateString(locale, { weekday: 'long' });
  const date = now.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  return `${day} · ${date}`;
}

function LastSiteCard({ site }: { site: LastSite }) {
  const { t } = useLanguage();
  const d = site.locationData;
  const stats = [
    { label: t('homeStatRain'), value: `${d.rainfall.annual}mm/yr` },
    { label: t('homeStatTemp'), value: `${d.climate.meanTemp}°C avg` },
    { label: t('homeStatSoilPH'), value: String(d.soil.ph) },
    { label: t('homeStatASL'), value: `${d.elevation.elevation}m` },
  ];
  return (
    <Link href="/farmer" style={{ textDecoration: 'none' }}>
      <div
        className="rounded-2xl p-4"
        style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest" style={{ color: '#8C7A62', letterSpacing: '0.1em' }}>{t('homeLastSite')}</div>
            <div className="font-display font-semibold text-base mt-0.5" style={{ color: '#20190F' }}>{d.biome.name}</div>
          </div>
          <div className="flex items-center gap-1 text-xs font-display" style={{ color: '#1F4D2B' }}>
            {t('homeReopenMap')}<ChevronRight size={13} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl px-2.5 py-2 text-center" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.08)' }}>
              <div className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>{s.value}</div>
              <div className="font-mono mt-0.5" style={{ color: '#8C7A62', fontSize: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function HomeLandingInner() {
  const { t, lang } = useLanguage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [lastSite, setLastSite] = useState<LastSite | null>(null);
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? null;

  useEffect(() => { setLastSite(getLastSite()); }, []);

  const ROLES = [
    { href: '/farmer',  Icon: Sprout,        label: t('homeRoleFarmerLabel'),  desc: t('homeRoleFarmerDesc') },
    { href: '/mentor',  Icon: Users,         label: t('homeRoleMentorLabel'),  desc: t('homeRoleMentorDesc') },
    { href: '/student', Icon: GraduationCap, label: t('homeRoleStudentLabel'), desc: t('homeRoleStudentDesc') },
    { href: '/ngo',     Icon: BarChart3,     label: t('homeRoleNGOLabel'),     desc: t('homeRoleNGODesc') },
    { href: '/funder',  Icon: Building2,     label: t('homeRoleFunderLabel'),  desc: t('homeRoleFunderDesc') },
  ];

  const QUICK_ACTIONS = [
    { href: '/finances',          Icon: DollarSign,    label: t('homeQuickFinance'),     desc: t('homeQuickFinanceDesc'),     color: '#C07A1E', bg: 'rgba(192,122,30,0.10)' },
    { href: '/student',           Icon: GraduationCap, label: t('homeQuickStudy'),       desc: t('homeQuickStudyDesc'),       color: '#235E86', bg: 'rgba(35,94,134,0.10)' },
    { href: '/contact',           Icon: MessageCircle, label: t('homeQuickContact'),     desc: t('homeQuickContactDesc'),     color: '#5A7A3A', bg: 'rgba(90,122,58,0.10)' },
    { href: '/journal',           Icon: Leaf,          label: t('homeQuickJournal'),     desc: t('homeQuickJournalDesc'),     color: '#1F4D2B', bg: 'rgba(31,77,43,0.08)' },
    { href: '/facilitator/crops', Icon: CalendarDays,  label: t('homeQuickCropPlanner'), desc: t('homeQuickCropPlannerDesc'), color: '#1F4D2B', bg: 'rgba(31,77,43,0.08)' },
    { href: '/farmer?panel=Farm', Icon: Wheat,         label: t('homeQuickMyRecords'),   desc: t('homeQuickMyRecordsDesc'),   color: '#1F4D2B', bg: 'rgba(31,77,43,0.08)' },
  ];

  return (
    <div
      className="h-[100dvh] flex flex-col font-sans overflow-hidden"
      style={{ background: '#F7F2E9', color: '#20190F' }}
    >
      {/* ── Header ── */}
      <header
        className="flex-shrink-0 flex items-center gap-3 px-4"
        style={{ height: 56, borderBottom: '1px solid #E2D8C4' }}
      >
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 36, height: 36, background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}
        >
          <Menu size={18} strokeWidth={1.7} />
        </button>

        <div className="flex flex-col justify-center flex-1">
          <span className="uppercase tracking-widest font-sans" style={{ fontSize: 9.5, color: '#C07A1E', letterSpacing: '0.12em', lineHeight: 1 }}>
            {getDayDate(lang)}
          </span>
          <span className="font-display font-bold" style={{ fontSize: 20, letterSpacing: '-0.02em', color: '#20190F', lineHeight: 1.15, marginTop: 2 }}>
            {firstName ? t('homeGreeting').replace('{name}', firstName) : 'ImbewuField'}
          </span>
        </div>

        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 36, height: 36, background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}
        >
          <Settings size={16} strokeWidth={1.6} />
        </button>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto flex flex-col px-4 py-6 max-w-xl mx-auto w-full gap-6">

        {lastSite && <LastSiteCard site={lastSite} />}

        {/* ── Analyse a site — CTA card ── */}
        <Link
          href="/farmer"
          style={{
            display: 'block',
            background: '#1F4D2B',
            backgroundImage:
              'repeating-radial-gradient(ellipse at 60% 40%, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), ' +
              'repeating-radial-gradient(ellipse at 20% 80%, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 60px)',
            borderRadius: 20,
            padding: '22px 20px 20px',
            textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(31,77,43,0.35)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, flexShrink: 0 }}>
              <path d="M12 21V11" />
              <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
              <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
            </svg>
            <span className="uppercase tracking-widest font-sans" style={{ fontSize: 10, color: 'rgba(234,243,226,0.65)', letterSpacing: '0.12em' }}>
              {t('homeLimaSuggests')}
            </span>
          </div>

          <h2 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: '#F7F2E9', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 6 }}>
            {t('homeSurveyNew')}
          </h2>

          <p className="font-sans" style={{ fontSize: 14, color: 'rgba(234,243,226,0.78)', lineHeight: 1.5, marginBottom: 18 }}>
            {t('homeSurveyDesc')}
          </p>

          <span className="inline-flex items-center font-sans font-semibold" style={{ background: '#F7F2E9', color: '#1F4D2B', borderRadius: 100, padding: '8px 16px', fontSize: 13, letterSpacing: '-0.01em' }}>
            <span className="flex items-center gap-1.5">{t('homeOpenMap')}<ArrowRight size={14} /></span>
          </span>
        </Link>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl text-center transition-all hover:opacity-90"
              style={{ textDecoration: 'none', background: '#FBF6EC', border: '1px solid #E2D8C4' }}
            >
              <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: q.bg, color: q.color }}>
                <q.Icon size={20} strokeWidth={1.6} />
              </div>
              <div>
                <div className="font-display font-semibold" style={{ fontSize: 12.5, color: '#20190F', lineHeight: 1.2 }}>{q.label}</div>
                <div className="font-sans" style={{ fontSize: 10.5, color: '#8C7A62', marginTop: 1 }}>{q.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Dashboards disclosure ── */}
        <section>
          <button
            onClick={() => setRolesOpen((o) => !o)}
            className="w-full flex items-center justify-between"
            aria-expanded={rolesOpen}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 2px' }}
          >
            <span className="uppercase tracking-widest font-sans" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em' }}>
              {t('homeDashboards')}
            </span>
            <span className="flex items-center gap-1 font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>
              {rolesOpen ? t('homeDashboardsHide') : t('homeDashboardsSummary')}
              <ChevronDown size={14} strokeWidth={1.7} style={{ transform: rolesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </span>
          </button>

          {rolesOpen && (
            <div className="mt-2.5" style={{ background: '#FBF6EC', borderRadius: 16, border: '1px solid #E2D8C4', overflow: 'hidden', boxShadow: '0 1px 3px rgba(32,25,15,0.06)' }}>
              {ROLES.map((r, i) => (
                <Link
                  key={r.href}
                  href={r.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', textDecoration: 'none', borderBottom: i < ROLES.length - 1 ? '1px solid #E2D8C4' : 'none', transition: 'background 0.12s' }}
                  className="hover:bg-[rgba(32,25,15,0.03)]"
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(31,77,43,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1F4D2B' }}>
                    <r.Icon size={17} strokeWidth={1.6} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: '#20190F', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{r.label}</div>
                    <div className="font-sans truncate" style={{ fontSize: 12.5, color: '#5C5040', marginTop: 1, lineHeight: 1.4 }}>{r.desc}</div>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.6} style={{ color: '#8C7A62', flexShrink: 0 }} />
                </Link>
              ))}

              <Link
                href="/surveys"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', textDecoration: 'none', borderTop: '1px solid #E2D8C4', transition: 'background 0.12s' }}
                className="hover:bg-[rgba(32,25,15,0.03)]"
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(192,122,30,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#C07A1E' }}>
                  <ClipboardList size={17} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: '#20190F', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{t('homeSurveysLabel')}</div>
                  <div className="font-sans truncate" style={{ fontSize: 12.5, color: '#5C5040', marginTop: 1, lineHeight: 1.4 }}>{t('homeSurveysDesc')}</div>
                </div>
                <ChevronRight size={16} strokeWidth={1.6} style={{ color: '#8C7A62', flexShrink: 0 }} />
              </Link>

              <Link
                href="/vision"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', textDecoration: 'none', borderTop: '1px solid #E2D8C4', transition: 'background 0.12s' }}
                className="hover:bg-[rgba(32,25,15,0.03)]"
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(31,77,43,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1F4D2B' }}>
                  <Camera size={17} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: '#20190F', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{t('homeLimaVisionLabel')}</div>
                  <div className="font-sans truncate" style={{ fontSize: 12.5, color: '#5C5040', marginTop: 1, lineHeight: 1.4 }}>{t('homeLimaVisionDesc')}</div>
                </div>
                <ChevronRight size={16} strokeWidth={1.6} style={{ color: '#8C7A62', flexShrink: 0 }} />
              </Link>
            </div>
          )}
        </section>

        <footer className="text-center font-sans" style={{ fontSize: 11, color: '#8C7A62', opacity: 0.7, paddingBottom: 8 }}>
          {t('homeFooter')}
        </footer>
      </main>

      <LimaBar />
      <TabBar />
      <ThemePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

export default function HomeLanding() {
  return (
    <>
      <Onboarding />
      <PopiaConsent />
      <HomeLandingInner />
    </>
  );
}
