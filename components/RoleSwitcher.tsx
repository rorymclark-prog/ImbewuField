'use client';

import Link from 'next/link';
import { PenLine } from 'lucide-react';

const ROLES = [
  { key: 'farmer', label: 'Farmer', icon: '🌱', href: '/farmer', ready: true },
  { key: 'facilitator', label: 'Supervisor', icon: 'penline', href: '/facilitator', ready: true },
  { key: 'trainer', label: 'Trainer', icon: '📚', href: '/trainer', ready: true },
  { key: 'student', label: 'Student', icon: '🎓', href: '/student', ready: true },
  { key: 'ngo', label: 'NGO', icon: '📊', href: '/ngo', ready: true },
  { key: 'funder', label: 'Funder', icon: '🏛', href: '/funder', ready: true },
];

function RoleIcon({ icon }: { icon: string }) {
  if (icon === 'penline') return <PenLine size={14} />;
  return <span style={{ fontSize: 17 }}>{icon}</span>;
}

export default function RoleSwitcher({ current }: { current: string }) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-1 rounded-full"
      style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
      {ROLES.map((r) => {
        const active = r.key === current;
        const base = 'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm font-display transition-all whitespace-nowrap';
        const style = active
          ? { background: 'var(--badge-bg)', border: '1px solid #1F4D2B', color: '#2D6B3C' }
          : r.ready
          ? { background: 'transparent', border: '1px solid transparent', color: '#20190F' }
          : { background: 'transparent', border: '1px solid transparent', color: '#5C5040', opacity: 0.5, cursor: 'not-allowed' };

        if (!r.ready) {
          return (
            <span key={r.key} className={base} style={style} title="Coming soon">
              <RoleIcon icon={r.icon} />
              <span className="hidden md:inline">{r.label}</span>
            </span>
          );
        }
        return (
          <Link key={r.key} href={r.href} className={base} style={style}>
            <RoleIcon icon={r.icon} />
            <span className="hidden md:inline">{r.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
