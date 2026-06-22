'use client';

import Link from 'next/link';

const ROLES = [
  { key: 'farmer', label: 'Farmer', icon: '🌱', href: '/farmer', ready: true },
  { key: 'facilitator', label: 'Supervisor', icon: '✎', href: '/facilitator', ready: true },
  { key: 'trainer', label: 'Trainer', icon: '📚', href: '/trainer', ready: true },
  { key: 'student', label: 'Student', icon: '🎓', href: '/student', ready: true },
  { key: 'ngo', label: 'NGO', icon: '📊', href: '/ngo', ready: true },
  { key: 'funder', label: 'Funder', icon: '🏛', href: '/funder', ready: true },
];

export default function RoleSwitcher({ current }: { current: string }) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-1 rounded-full"
      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
      {ROLES.map((r) => {
        const active = r.key === current;
        const base = 'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm font-display transition-all whitespace-nowrap';
        const style = active
          ? { background: 'var(--badge-bg)', border: '1px solid var(--emerald)', color: 'var(--emerald-bright)' }
          : r.ready
          ? { background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)' }
          : { background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)', opacity: 0.5, cursor: 'not-allowed' };

        if (!r.ready) {
          return (
            <span key={r.key} className={base} style={style} title="Coming soon">
              <span style={{ fontSize: 17 }}>{r.icon}</span>
              <span className="hidden md:inline">{r.label}</span>
            </span>
          );
        }
        return (
          <Link key={r.key} href={r.href} className={base} style={style}>
            <span style={{ fontSize: 17 }}>{r.icon}</span>
            <span className="hidden md:inline">{r.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
