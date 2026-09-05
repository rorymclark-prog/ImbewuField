'use client';

import Link from 'next/link';
import { Sprout, Users, GraduationCap, BarChart3, Building2, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { useRoleNavigation, startRolePreview } from '@/lib/use-role-navigation';
import { visibleRoleTabs } from '@/lib/role-navigation';

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
  const router = useRouter();
  const { accountRole, navigationRole, sample } = useRoleNavigation();
  const visible = visibleRoleTabs(navigationRole);
  const effectiveCurrent = ROLE_ALIASES[current] ?? current;
  return (
    <div className="flex items-center gap-1 px-1.5 py-1 rounded-full"
      style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      {ROLES.filter(r => visible.includes(r.key)).map((r) => {
        const active = r.key === effectiveCurrent;
        const isAliasMatch = active && current !== r.key;
        // Nav items: Public Sans 16/600 on desktop (handoff §0 type scale).
        const base = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-sans font-semibold text-[15px] lg:text-base transition-all whitespace-nowrap';
        const style = active
          ? { background: 'var(--badge-bg)', border: '1px solid #1F4D2B', color: '#2D6B3C' }
          : r.ready
          ? { background: 'transparent', border: '1px solid transparent', color: '#20190F' }
          : { background: 'transparent', border: '1px solid transparent', color: '#5C5040', opacity: 0.5, cursor: 'not-allowed' };
        const ariaLabel = `${t(r.labelKey)}${active ? ' (current)' : ''}`;

        if (!r.ready) {
          return (
            <span key={r.key} className={base} style={style} title="Coming soon" aria-label={`${t(r.labelKey)} (coming soon)`}>
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
            aria-label={ariaLabel}
            aria-current={active ? 'page' : undefined}
            title={isAliasMatch ? 'Design map is the Mentor toolkit' : undefined}
          >
            <r.Icon size={16} />
            <span className="hidden md:inline">{t(r.labelKey)}</span>
          </Link>
        );
      })}
      {(accountRole === 'ngo' || accountRole === 'admin') && <label className="font-sans text-sm" style={{ padding: '4px 8px', color: '#243d2d' }}>
        <span className="sr-only">View as with sample data</span>
        <select aria-label="View as with sample data" value="" onChange={e => { const target = ROLES.find(r => r.key === e.target.value); if (target && startRolePreview(target.key)) router.push(target.href); }} style={{ minHeight: 40, maxWidth: 180, background: 'white', color: '#243d2d', borderRadius: 8, padding: 6 }}>
          <option value="">{sample ? 'Previewing · view as…' : 'View as… (sample)'}</option>
          {ROLES.map(r => <option key={r.key} value={r.key}>{t(r.labelKey)}</option>)}
        </select>
      </label>}
    </div>
  );
}
