'use client';

import Link from 'next/link';
import {
  Sprout,
  PenLine,
  BarChart3,
  Building2,
  BookOpen,
  GraduationCap,
  ChevronRight,
  Settings,
  Leaf,
  CalendarDays,
  Map,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import ThemePanel from '@/components/ThemePanel';
import LimaBar from '@/components/LimaBar';
import TabBar from '@/components/TabBar';
import Onboarding from '@/components/Onboarding';
import { LanguageProvider } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

const ROLES: {
  href: string;
  Icon: React.ElementType;
  label: string;
  desc: string;
}[] = [
  { href: '/farmer',      Icon: Sprout,        label: 'Farmer',      desc: 'Analyse a site — climate, soil, water, AI reports' },
  { href: '/facilitator', Icon: PenLine,        label: 'Supervisor',  desc: 'Design gardens & bills of quantities' },
  { href: '/ngo',         Icon: BarChart3,      label: 'NGO',         desc: 'Programme dashboard & M&E roll-up' },
  { href: '/funder',      Icon: Building2,      label: 'Funder',      desc: 'Read-only impact oversight' },
  { href: '/trainer',     Icon: BookOpen,       label: 'Trainer',     desc: 'Run the 9-month programme' },
  { href: '/student',     Icon: GraduationCap,  label: 'Student',     desc: 'Learn permaculture, step by step' },
  { href: '/calendar',   Icon: CalendarDays,   label: 'Calendar',    desc: 'Seasonal planting guide' },
  { href: '/finances',   Icon: TrendingUp,     label: 'Finances',    desc: 'Track crop sales & income' },
];

function getDayDate() {
  const now = new Date();
  const day = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const date = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return `${day} · ${date}`;
}

function HomeLandingInner() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] ?? null;

  return (
    <div
      className="h-[100dvh] flex flex-col font-sans overflow-hidden"
      style={{ background: '#F7F2E9', color: '#20190F' }}
    >
      {/* ── Header ── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-5"
        style={{ height: 56, borderBottom: '1px solid #E2D8C4' }}
      >
        <div className="flex flex-col justify-center">
          {/* Overline: day + date */}
          <span
            className="uppercase tracking-widest font-sans"
            style={{ fontSize: 10, color: '#C07A1E', letterSpacing: '0.12em', lineHeight: 1 }}
          >
            {getDayDate()}
          </span>
          {/* Title — personalized if signed in */}
          <span
            className="font-display font-bold"
            style={{ fontSize: 22, letterSpacing: '-0.02em', color: '#20190F', lineHeight: 1.15, marginTop: 2 }}
          >
            {firstName ? `Sawubona, ${firstName}` : 'ImbewuField'}
          </span>
        </div>

        {/* Settings trigger */}
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{
            width: 36,
            height: 36,
            background: 'rgba(32,25,15,0.06)',
            border: '1px solid #E2D8C4',
            color: '#5C5040',
            cursor: 'pointer',
          }}
        >
          <Settings size={16} strokeWidth={1.6} />
        </button>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto flex flex-col px-4 py-6 max-w-xl mx-auto w-full gap-6">

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
            Open the map&nbsp;&rarr;
          </span>
        </Link>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: '/journal', Icon: Leaf,         label: 'Field Journal', desc: 'Log harvests' },
            { href: '/plan',    Icon: CalendarDays,  label: 'Crop Planner', desc: 'Plan the season' },
            { href: '/farmer',  Icon: Map,           label: 'Map',          desc: 'Analyse a site' },
          ].map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl text-center transition-all hover:opacity-90"
              style={{ textDecoration: 'none', background: '#FBF6EC', border: '1px solid #E2D8C4' }}
            >
              <div
                className="flex items-center justify-center rounded-xl"
                style={{ width: 44, height: 44, background: 'rgba(31,77,43,0.08)', color: '#1F4D2B' }}
              >
                <q.Icon size={20} strokeWidth={1.6} />
              </div>
              <div>
                <div className="font-display font-semibold" style={{ fontSize: 13, color: '#20190F', lineHeight: 1.2 }}>{q.label}</div>
                <div className="font-sans" style={{ fontSize: 11, color: '#8C7A62', marginTop: 1 }}>{q.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Roles section ── */}
        <section>
          {/* Section overline */}
          <span
            className="uppercase tracking-widest font-sans"
            style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', display: 'block', marginBottom: 10 }}
          >
            Go to
          </span>

          {/* Ledger rows */}
          <div
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
                {/* Role icon */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(31,77,43,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: '#1F4D2B',
                  }}
                >
                  <r.Icon size={17} strokeWidth={1.6} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div
                    className="font-display"
                    style={{ fontSize: 16, fontWeight: 600, color: '#20190F', letterSpacing: '-0.01em', lineHeight: 1.2 }}
                  >
                    {r.label}
                  </div>
                  <div
                    className="font-sans truncate"
                    style={{ fontSize: 12.5, color: '#5C5040', marginTop: 1, lineHeight: 1.4 }}
                  >
                    {r.desc}
                  </div>
                </div>

                {/* Chevron */}
                <ChevronRight size={16} strokeWidth={1.6} style={{ color: '#8C7A62', flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="text-center font-sans" style={{ fontSize: 11, color: '#8C7A62', opacity: 0.7, paddingBottom: 8 }}>
          NASA POWER · ISRIC soil · SANBI veg · Claude AI
        </footer>
      </main>

      {/* ── Persistent Lima ask-bar ── */}
      <LimaBar />

      {/* ── Bottom tab bar ── */}
      <TabBar />

      {/* Settings panel */}
      <ThemePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function HomeLanding() {
  return (
    <LanguageProvider>
      <Onboarding />
      <HomeLandingInner />
    </LanguageProvider>
  );
}
