'use client';

// The four TabBar destinations as plain 16px/600 text links, shown only at lg+ — the same nav
// AppHeader draws (its copy is pinned by tests/app-header-desktop-nav.test.ts). Pages that still
// assemble their own header (farmer, farmer Home, records, invoice) drop this in beside the title
// so <TabBar hideAtDesktop /> never leaves a laptop with no primary nav but the burger.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { tabsForRole } from '@/components/TabBar';
import { useRoleNavigation } from '@/lib/use-role-navigation';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';

export default function DesktopPrimaryNav() {
  const { t, lang } = useLanguage();
  const { navigationRole } = useRoleNavigation();
  const pathname = usePathname();
  const tabs = tabsForRole(navigationRole);

  function isActive(href: string) {
    const base = href.split('?')[0];
    return pathname === base || (base !== '/' && pathname.startsWith(base));
  }

  return (
    <nav aria-label={inlineText(lang, 'Primary')} className="hidden lg:flex items-center gap-5 ml-2 min-w-0 overflow-hidden whitespace-nowrap">
      {tabs.map(({ href, key }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? 'page' : undefined}
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
  );
}
