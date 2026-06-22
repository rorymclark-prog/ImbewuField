'use client';

import Link from 'next/link';
import SettingsButton from '@/components/SettingsButton';

const ROLES: { href: string; icon: string; label: string; desc: string; tint: string }[] = [
  { href: '/farmer',      icon: '🌱', label: 'Farmer',         desc: 'Analyse a site — climate, soil, water, AI reports', tint: 'var(--emerald)' },
  { href: '/facilitator', icon: '✎',  label: 'Supervisor',    desc: 'Design gardens & bills of quantities', tint: 'var(--emerald)' },
  { href: '/ngo',         icon: '📊', label: 'NGO',           desc: 'Programme dashboard & M&E roll-up', tint: 'var(--gold)' },
  { href: '/funder',      icon: '🏛', label: 'Funder',        desc: 'Read-only impact oversight', tint: 'var(--blue)' },
  { href: '/trainer',     icon: '📚', label: 'Trainer',       desc: 'Run the 9-month programme', tint: 'var(--teal)' },
  { href: '/student',     icon: '🎓', label: 'Student',       desc: 'Learn permaculture, step by step', tint: 'var(--orange)' },
];

export default function HomeLanding() {
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: 'var(--bg-0)' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-5 gap-3"
        style={{ height: 56, borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ fontSize: 20, background: 'linear-gradient(135deg, rgba(72,168,100,0.25), rgba(72,168,100,0.08))', border: '1px solid rgba(72,168,100,0.4)' }}>
            🌿
          </div>
          <span className="font-display font-bold tracking-tight text-gradient" style={{ fontSize: 18 }}>ImbewuField</span>
        </div>
        <div className="flex-1" />
        <SettingsButton />
      </header>

      {/* Hero + role grid — sized to fit one screen, no scrolling */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-4">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-5">
            <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 6 }}>🌿</div>
            <h1 className="font-display font-bold text-gradient" style={{ fontSize: 30, letterSpacing: '-0.03em', marginBottom: 4 }}>
              ImbewuField
            </h1>
            <p className="font-display" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Choose where to go
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {ROLES.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="glass glass-hover rounded-2xl flex items-start gap-2.5 transition-all"
                style={{ borderLeft: `3px solid ${r.tint}`, textDecoration: 'none', padding: 12 }}
              >
                <div className="rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ width: 38, height: 38, fontSize: 19, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  {r.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-display font-semibold" style={{ fontSize: 16, color: 'var(--text-primary)' }}>{r.label}</div>
                  <div className="leading-snug" style={{ fontSize: 12.5, marginTop: 2, color: 'var(--text-muted)' }}>{r.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-center font-mono" style={{ fontSize: 11.5, marginTop: 16, color: 'var(--text-muted)', opacity: 0.7 }}>
            NASA POWER · ISRIC soil · SANBI veg · Claude AI
          </p>
        </div>
      </main>
    </div>
  );
}
