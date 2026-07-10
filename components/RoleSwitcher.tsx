'use client';

import Link from 'next/link';
import { Sprout, Users, GraduationCap, BarChart3, Building2, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

const ROLES: { key: string; labelKey: string; Icon: LucideIcon; href: string; ready: boolean }[] = [
  { key: 'farmer',  labelKey: 'homeRoleFarmerLabel',  Icon: Sprout,        href: '/farmer',  ready: true },
  { key: 'mentor',  labelKey: 'homeRoleMentorLabel',  Icon: Users,         href: '/mentor',  ready: true },
  { key: 'student', labelKey: 'homeRoleStudentLabel', Icon: GraduationCap, href: '/student', ready: true },
  { key: 'ngo',     labelKey: 'homeRoleNGOLabel',     Icon: BarChart3,     href: '/ngo',     ready: true },
  { key: 'funder',  labelKey: 'homeRoleFunderLabel',  Icon: Building2,     href: '/funder',  ready: true },
];

// 'facilitator' (the Design Studio's power-user tool, app/facilitator/page.tsx) has
// no dedicated role tab of its own — it's the mentor-side tool, so it highlights Mentor.
const ROLE_ALIASES: Record<string, string> = { facilitator: 'mentor' };

export default function RoleSwitcher({ current }: { current: string }) {
  const { t } = useLanguage();
  const effectiveCurrent = ROLE_ALIASES[current] ?? current;
  return (
    <div className="flex items-center gap-1 px-1.5 py-1 rounded-full"
      style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
      {ROLES.map((r) => {
        const active = r.key === effectiveCurrent;
        const isAliasMatch = active && current !== r.key;
        // Nav items: Public Sans 16/600 on desktop (handoff §0 type scale).
        const base = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-sans font-semibold text-[15px] lg:text-base transition-all whitespace-nowrap';
        const style = active
          ? { background: 'var(--badge-bg)', border: '1px solid #1F4D2B', color: '#2D6B3C' }
          : r.ready
          ? { background: 'transparent', border: '1px solid transparent', color: '#20190F' }
          : { background: 'transparent', border: '1px solid transparent', color: '#5C5040', opacity: 0.5, cursor: 'not-allowed' };

        if (!r.ready) {
          return (
            <span key={r.key} className={base} style={style} title="Coming soon">
              <r.Icon size={16} />
              <span className="hidden md:inline">{t(r.labelKey)}</span>
            </span>
          );
        }
        return (
          <Link
            key={r.key}
            href={r.href}
            className={base}
            style={style}
            title={isAliasMatch ? 'Design map is the Mentor toolkit' : undefined}
          >
            <r.Icon size={16} />
            <span className="hidden md:inline">{t(r.labelKey)}</span>
          </Link>
        );
      })}
    </div>
  );
}
