'use client';

// desk-06/desk-07: every one of these pages used to assemble its own 52px top bar from
// MenuButton/BackButton/BrandLogo/SettingsButton, each with a slightly different right-hand
// cluster, and at 1280px the only navigation on the page was the phone bottom tab bar stretched
// edge to edge. This is the one header the pages this track owns (reports, ngo, funder, mentor,
// assessments, surveys) share — brand, title, Back, an optional slot for page-specific extras
// (Learn, RoleSwitcher, a demo badge…), Settings, and — at lg+ — the same four destinations
// TabBar shows on phone, as plain 16px/600 text links, so the primary nav never just stretches
// or disappears between routes. Pair it with <TabBar hideAtDesktop /> so the two don't double up.
//
// Other tracks' pages (home, records, contact, manual, exchange, …) adopt this in a later wave —
// not edited here.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import { tabsForRole } from '@/components/TabBar';
import { useRoleNavigation } from '@/lib/use-role-navigation';
import { useLanguage } from '@/lib/i18n';
import { APP_HEADER_STYLE } from '@/lib/app-header';

export default function AppHeader({
  title,
  backFallback = '/home',
  right,
  desktopNav = true,
}: {
  title: string;
  backFallback?: string;
  /** Page-specific controls between the title and Settings — Learn, RoleSwitcher, a badge. */
  right?: ReactNode;
  desktopNav?: boolean;
}) {
  const { t } = useLanguage();
  const { navigationRole } = useRoleNavigation();
  const pathname = usePathname();
  const tabs = tabsForRole(navigationRole);

  function isActive(href: string) {
    const base = href.split('?')[0];
    return pathname === base || (base !== '/' && pathname.startsWith(base));
  }

  return (
    <header
      className="flex-shrink-0 flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-3"
      style={APP_HEADER_STYLE}
    >
      <MenuButton />
      <BackButton fallback={backFallback} />
      <BrandLogo />
      <div className="w-px h-5" style={{ background: 'var(--border)' }} />
      <span
        className="text-xs font-display truncate min-w-0 lg:shrink-0 lg:overflow-visible whitespace-nowrap"
        style={{ color: 'var(--text-secondary)' }}
      >
        {title}
      </span>
      {desktopNav && (
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-5 ml-2 min-w-0 overflow-hidden whitespace-nowrap">
          {tabs.map(({ href, key }) => (
            <Link
              key={href}
              href={href}
              className="rounded-sm focus-visible:outline-none focus-visible:ring-2"
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: isActive(href) ? 'var(--color-forest-800)' : 'var(--text-secondary)',
                textDecoration: 'none',
                // CSS var, not a hex, so the ring stays visible against every theme.
                '--tw-ring-color': 'var(--gold)',
              } as CSSProperties}
            >
              {t(key)}
            </Link>
          ))}
        </nav>
      )}
      <div className="flex-1" />
      {right}
      <SettingsButton />
    </header>
  );
}
