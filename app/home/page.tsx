'use client';

import Link from 'next/link';
import SettingsButton from '@/components/SettingsButton';

const ROLES: { href: string; icon: string; label: string; desc: string; tint: string }[] = [
  { href: '/',            icon: '🌱', label: 'Farmer',              desc: 'Analyse any site — climate, soil, water, and AI permaculture reports', tint: 'var(--emerald)' },
  { href: '/facilitator', icon: '✎',  label: 'Community supervisor', desc: 'Design gardens, build a bill of quantities, share to a farmer’s phone', tint: 'var(--emerald)' },
  { href: '/ngo',         icon: '📊', label: 'NGO',                 desc: 'Programme dashboard — every garden, gardener, and M&E roll-up', tint: 'var(--gold)' },
  { href: '/funder',      icon: '🏛', label: 'Funder',              desc: 'Read-only impact oversight — funds, livelihoods, food grown', tint: 'var(--blue)' },
  { href: '/trainer',     icon: '📚', label: 'Trainer',             desc: 'Run the 9-month programme — material, schedule, progress', tint: 'var(--teal)' },
  { href: '/student',     icon: '🎓', label: 'Student',             desc: 'Learn permaculture step by step, in your language', tint: 'var(--orange)' },
];

export default function HomeLanding() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-0)' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-5 gap-3"
        style={{ height: 52, borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base"
            style={{ background: 'linear-gradient(135deg, rgba(72,168,100,0.25), rgba(72,168,100,0.08))', border: '1px solid rgba(72,168,100,0.4)' }}>
            🌿
          </div>
          <span className="font-display font-bold text-sm tracking-tight text-gradient">ImbewuField</span>
        </div>
        <div className="flex-1" />
        <SettingsButton />
      </header>

      {/* Hero + role grid */}
      <main className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-9">
            <div className="text-5xl mb-3">🌿</div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-gradient mb-2" style={{ letterSpacing: '-0.03em' }}>
              ImbewuField
            </h1>
            <p className="font-display text-sm" style={{ color: 'var(--text-muted)' }}>
              Permaculture intelligence for South African farmers · choose where to go
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLES.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="glass glass-hover rounded-2xl p-4 flex items-start gap-3.5 transition-all"
                style={{ borderLeft: `2px solid ${r.tint}`, textDecoration: 'none' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  {r.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{r.label}</div>
                  <div className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{r.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-center text-xs font-mono mt-8" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            NASA POWER · ISRIC soil · SANBI veg · Claude AI · South Africa
          </p>
        </div>
      </main>
    </div>
  );
}
