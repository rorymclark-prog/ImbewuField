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
  LayoutGrid,
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
import { LanguageProvider } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { getLastSite, type LastSite } from '@/lib/last-site';

// The five field roles. Farmer is the default surface for everyone; the others
// are dashboards reached through the quiet "Dashboards" disclosure below — the
// home stays task-first, not role-first (per the design handoff).
const ROLES: {
  href: string;
  Icon: React.ElementType;
  label: string;
  desc: string;
}[] = [
  { href: '/farmer',  Icon: Sprout,        label: 'Farmer',  desc: 'Analyse a site — climate, soil, water, AI reports' },
  { href: '/mentor',  Icon: Users,         label: 'Mentor',  desc: 'Run the course, visit farms, sign off progress' },
  { href: '/student', Icon: GraduationCap, label: 'Student', desc: 'Learn permaculture, step by step' },
  { href: '/ngo',     Icon: BarChart3,     label: 'NGO',     desc: 'Programme dashboard & M&E roll-up' },
  { href: '/funder',  Icon: Building2,     label: 'Funder',  desc: 'Read-only impact oversight' },
];

function getDayDate() {
  const now = new Date();
  const day = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const date = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return `${day} · ${date}`;
}

function LastSiteCard({ site }: { site: LastSite }) {
  const d = site.locationData;
  const stats = [
    { label: 'Rain', value: `${d.rainfall.annual}mm/yr` },
    { label: 'Temp', value: `${d.climate.meanTemp}°C avg` },
    { label: 'Soil pH', value: String(d.soil.ph) },
    { label: 'ASL', value: `${d.elevation.elevation}m` },
  ];
  return (
    <Link href="/farmer" style={{ textDecoration: 'none' }}>
      <div
        className="rounded-2xl p-4"
        style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest" style={{ color: '#8C7A62', letterSpacing: '0.1em' }}>Last site</div>
            <div className="font-display font-semibold text-base mt-0.5" style={{ color: '#20190F' }}>{d.biome.name}</div>
          </div>
          <div className="flex items-center gap-1 text-xs font-display" style={{ color: '#1F4D2B' }}>
            Reopen map<ChevronRight size={13} />
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [lastSite, setLastSite] = useState<LastSite | null>(null);
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? null;

  useEffect(() => { setLastSite(getLastSite()); }, []);

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
        {/* Hamburger */}
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{
            width: 36, height: 36,
            background: 'rgba(32,25,15,0.06)',
            border: '1px solid #E2D8C4',
            color: '#5C5040', cursor: 'pointer',
          }}
        >
          <Menu size={18} strokeWidth={1.7} />
        </button>

        {/* Title — personalized if signed in */}
        <div className="flex flex-col justify-center flex-1">
          <span
            className="uppercase tracking-widest font-sans"
            style={{ fontSize: 9.5, color: '#C07A1E', letterSpacing: '0.12em', lineHeight: 1 }}
          >
            {getDayDate()}
          </span>
          <span
            className="font-display font-bold"
            style={{ fontSize: 20, letterSpacing: '-0.02em', color: '#20190F', lineHeight: 1.15, marginTop: 2 }}
          >
            {firstName ? `Sawubona, ${firstName}` : 'ImbewuField'}
          </span>
        </div>

        {/* Settings trigger */}
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{
            width: 36, height: 36,
            background: 'rgba(32,25,15,0.06)',
            border: '1px solid #E2D8C4',
            color: '#5C5040', cursor: 'pointer',
          }}
        >
          <Settings size={16} strokeWidth={1.6} />
        </button>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto flex flex-col px-4 py-6 max-w-xl mx-auto w-full gap-6">

        {/* ── Last analysed site — returning farmer shortcut ── */}
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
          {/* Icon + overline row */}
          <div className="flex items-center gap-2 mb-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#EAF3E2"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 20, height: 20, flexShrink: 0 }}
            >
              <path d="M12 21V11" />
              <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
              <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
            </svg>
            <span
              className="uppercase tracking-widest font-sans"
              style={{ fontSize: 10, color: 'rgba(234,243,226,0.65)', letterSpacing: '0.12em' }}
            >
              Lima suggests
            </span>
          </div>

          {/* Heading */}
          <h2
            className="font-display"
            style={{ fontSize: 26, fontWeight: 700, color: '#F7F2E9', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 6 }}
          >
            Survey a new site
          </h2>

          {/* Sub text */}
          <p
            className="font-sans"
            style={{ fontSize: 14, color: 'rgba(234,243,226,0.78)', lineHeight: 1.5, marginBottom: 18 }}
          >
            Drop a pin and I&rsquo;ll read its climate, soil and water.
          </p>

          {/* CTA button */}
          <span
            className="inline-flex items-center font-sans font-semibold"
            style={{
              background: '#F7F2E9',
              color: '#1F4D2B',
              borderRadius: 100,
              padding: '8px 16px',
              fontSize: 13,
              letterSpacing: '-0.01em',
            }}
          >
            <span className="flex items-center gap-1.5">Open the map<ArrowRight size={14} /></span>
          </span>
        </Link>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: '/finances', Icon: DollarSign,  label: 'Finance',       desc: 'Income & costs',  color: '#C07A1E', bg: 'rgba(192,122,30,0.10)' },
            { href: '/student',  Icon: GraduationCap, label: 'Study',       desc: 'Permaculture course', color: '#235E86', bg: 'rgba(35,94,134,0.10)' },
            { href: '/contact',  Icon: MessageCircle, label: 'Contact',     desc: 'Mentor · NGO',    color: '#5A7A3A', bg: 'rgba(90,122,58,0.10)' },
            { href: '/journal',  Icon: Leaf,          label: 'Journal',     desc: 'Log harvests',    color: '#1F4D2B', bg: 'rgba(31,77,43,0.08)' },
            { href: '/plan',     Icon: CalendarDays,  label: 'Crop Planner', desc: 'Plan the season', color: '#1F4D2B', bg: 'rgba(31,77,43,0.08)' },
            { href: '/farmer?panel=Farm', Icon: Wheat, label: 'My Records', desc: 'Crops & sales',  color: '#1F4D2B', bg: 'rgba(31,77,43,0.08)' },
          ].map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl text-center transition-all hover:opacity-90"
              style={{ textDecoration: 'none', background: '#FBF6EC', border: '1px solid #E2D8C4' }}
            >
              <div
                className="flex items-center justify-center rounded-xl"
                style={{ width: 44, height: 44, background: q.bg, color: q.color }}
              >
                <q.Icon size={20} strokeWidth={1.6} />
              </div>
              <div>
                <div className="font-display font-semibold" style={{ fontSize: 12.5, color: '#20190F', lineHeight: 1.2 }}>{q.label}</div>
                <div className="font-sans" style={{ fontSize: 10.5, color: '#8C7A62', marginTop: 1 }}>{q.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Dashboards — a quiet disclosure, not a role-first launcher ── */}
        <section>
          <button
            onClick={() => setRolesOpen((o) => !o)}
            className="w-full flex items-center justify-between"
            aria-expanded={rolesOpen}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 2px' }}
          >
            <span
              className="uppercase tracking-widest font-sans"
              style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em' }}
            >
              Dashboards
            </span>
            <span className="flex items-center gap-1 font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>
              {rolesOpen ? 'Hide' : 'Farmer · Mentor · NGO · Funder · Student'}
              <ChevronDown
                size={14}
                strokeWidth={1.7}
                style={{ transform: rolesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              />
            </span>
          </button>

          {rolesOpen && (
            <div
              className="mt-2.5"
              style={{
                background: '#FBF6EC',
                borderRadius: 16,
                border: '1px solid #E2D8C4',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(32,25,15,0.06)',
              }}
            >
              {ROLES.map((r, i) => (
                <Link
                  key={r.href}
                  href={r.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '13px 16px',
                    textDecoration: 'none',
                    borderBottom: i < ROLES.length - 1 ? '1px solid #E2D8C4' : 'none',
                    transition: 'background 0.12s',
                  }}
                  className="hover:bg-[rgba(32,25,15,0.03)]"
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'rgba(31,77,43,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: '#1F4D2B',
                    }}
                  >
                    <r.Icon size={17} strokeWidth={1.6} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: '#20190F', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                      {r.label}
                    </div>
                    <div className="font-sans truncate" style={{ fontSize: 12.5, color: '#5C5040', marginTop: 1, lineHeight: 1.4 }}>
                      {r.desc}
                    </div>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.6} style={{ color: '#8C7A62', flexShrink: 0 }} />
                </Link>
              ))}

              {/* Surveys — NGOs build, everyone can answer */}
              <Link
                href="/surveys"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', textDecoration: 'none', borderTop: '1px solid #E2D8C4', transition: 'background 0.12s' }}
                className="hover:bg-[rgba(32,25,15,0.03)]"
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(192,122,30,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#C07A1E' }}>
                  <ClipboardList size={17} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: '#20190F', letterSpacing: '-0.01em', lineHeight: 1.2 }}>Surveys</div>
                  <div className="font-sans truncate" style={{ fontSize: 12.5, color: '#5C5040', marginTop: 1, lineHeight: 1.4 }}>Answer field surveys · NGOs build &amp; send</div>
                </div>
                <ChevronRight size={16} strokeWidth={1.6} style={{ color: '#8C7A62', flexShrink: 0 }} />
              </Link>

              {/* Lima Vision — photograph a bed/harvest, get a read */}
              <Link
                href="/vision"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', textDecoration: 'none', borderTop: '1px solid #E2D8C4', transition: 'background 0.12s' }}
                className="hover:bg-[rgba(32,25,15,0.03)]"
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(31,77,43,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1F4D2B' }}>
                  <Camera size={17} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: '#20190F', letterSpacing: '-0.01em', lineHeight: 1.2 }}>Lima Vision</div>
                  <div className="font-sans truncate" style={{ fontSize: 12.5, color: '#5C5040', marginTop: 1, lineHeight: 1.4 }}>Photograph a bed or harvest — Lima reads it</div>
                </div>
                <ChevronRight size={16} strokeWidth={1.6} style={{ color: '#8C7A62', flexShrink: 0 }} />
              </Link>
            </div>
          )}
        </section>

        {/* ── Footer ── */}
        <footer className="text-center font-sans" style={{ fontSize: 11, color: '#8C7A62', opacity: 0.7, paddingBottom: 8 }}>
          ImbewuField · grown with you
        </footer>
      </main>

      {/* ── Persistent Lima ask-bar ── */}
      <LimaBar />

      {/* ── Bottom tab bar ── */}
      <TabBar />

      {/* Settings panel */}
      <ThemePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Navigation drawer */}
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

export default function HomeLanding() {
  return (
    <LanguageProvider>
      <Onboarding />
      <PopiaConsent />
      <HomeLandingInner />
    </LanguageProvider>
  );
}
