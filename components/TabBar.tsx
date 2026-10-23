'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, DollarSign, User, Users, BarChart3, BookOpen, ClipboardList } from 'lucide-react';
import { useRoleNavigation } from '@/lib/use-role-navigation';
import { canSeeNavLink } from '@/lib/role-access';
import type { UserRole } from '@/lib/db/types';
import { useLanguage } from '@/lib/i18n';
import styles from './TabBar.module.css';

// The third tab is the farmer's money, and there is one of it now. It used to point at
// /finances while a second door, "My Records", held her kilograms — the split the Gogo Test
// audit found she could not reconcile ("she cannot answer how much did I make this season").
// /finances redirects here, so an installed PWA with the old tab still lands in the right place.
//
// 'tabRecords' ("Records"), not 'homeQuickMyRecords' ("My Records"): the tile and page title keep
// the longer label, but the bar is too narrow for it — "My Records" wraps to two lines in English
// and worse in isiZulu (zu-08/ux-08) — so the bar gets its own short key.
const FARMER_TABS = [
  { href: '/home',     key: 'tabHome',    Icon: Home },
  { href: '/farmer',   key: 'tabMap',     Icon: Map },
  { href: '/records',  key: 'tabRecords', Icon: DollarSign },
  { href: '/account',  key: 'tabAccount', Icon: User },
];

// staff-10/sdesk-05: mentor, ngo and funder used to inherit the farmer's own tab set (a mentor's
// dashboard wasn't even a tab) or, for funder, no bar at all. One shape for all three staff
// roles now — Home, the role's own dashboard, Network, Account — with single-word labels so
// nothing wraps. Student gets its own four: Home, Studies, Records, Account.
const STAFF_TABS = {
  mentor: [
    { href: '/home',   key: 'tabHome',      Icon: Home },
    { href: '/mentor', key: 'tabDashboard', Icon: BarChart3 },
    { href: '/assessments', key: 'offlinePageAssessments', Icon: ClipboardList },
    { href: '/account', key: 'tabAccount',  Icon: User },
  ],
  ngo: [
    { href: '/home', key: 'tabHome',       Icon: Home },
    { href: '/ngo',  key: 'tabDashboard',  Icon: BarChart3 },
    { href: '/network', key: 'navNetwork', Icon: Users },
    { href: '/account', key: 'tabAccount', Icon: User },
  ],
  funder: [
    { href: '/home',    key: 'tabHome',      Icon: Home },
    { href: '/funder',  key: 'tabDashboard', Icon: BarChart3 },
    { href: '/network', key: 'navNetwork',   Icon: Users },
    { href: '/account', key: 'tabAccount',   Icon: User },
  ],
  student: [
    { href: '/home',    key: 'tabHome',     Icon: Home },
    { href: '/student', key: 'tabStudies',  Icon: BookOpen },
    { href: '/records', key: 'tabRecords',  Icon: DollarSign },
    { href: '/account', key: 'tabAccount',  Icon: User },
  ],
} as const;

/** Shared with components/layout/AppHeader.tsx, which shows the same four destinations as
 *  16px text links at lg+ instead of this bar (desk-07) rather than keeping its own copy. */
export function tabsForRole(navigationRole: string | null) {
  const set = navigationRole && navigationRole in STAFF_TABS
    ? STAFF_TABS[navigationRole as keyof typeof STAFF_TABS]
    : FARMER_TABS;
  // w18-27: the same gate the menu uses, so a tab can never point at a page that refuses the role.
  return set.filter(({ href }) => canSeeNavLink(navigationRole as UserRole | null, href));
}

export default function TabBar({ hideAtDesktop = false }: { hideAtDesktop?: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { navigationRole } = useRoleNavigation();
  const tabs = tabsForRole(navigationRole);
  const barRef = useRef<HTMLDivElement>(null);

  // Publishes this bar's own rendered height as --bottom-nav-height, so anything that needs to
  // clear it (PWAUpdateNotifier's pill) reads a measured number instead of a guessed constant.
  // TabBar is NOT position: fixed — it's the last child of the `h-[100dvh] flex flex-col
  // overflow-hidden` column each page renders (see app/home/page.tsx), so it sits in normal flow
  // and nothing else declares its height; it comes out of py-2 plus the icon plus the label.
  //
  // TWO observers, not one. A ResizeObserver alone looked like the robust choice — the Appearance
  // text-size setting (lib/theme.tsx's `document.documentElement.style.zoom`) rescales this bar at
  // runtime, so a one-shot mount measurement would go stale the moment someone picks "Larger" — but
  // measured live in the browser, ResizeObserver never actually fires for a `zoom`-only change:
  // getBoundingClientRect() on this element reports the zoomed size correctly, yet no resize
  // notification follows it, so the published variable sat at the old height while the real bar
  // had grown. A MutationObserver watching <html>'s style attribute catches exactly that case,
  // because it is watching the thing that changes (the zoom assignment) rather than trusting a
  // layout signal that does not fire for it. The ResizeObserver stays for the changes zoom-toggling
  // cannot explain — a locale swap making a tab label wrap, a safe-area inset changing on rotate.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    // getBoundingClientRect(), not offsetHeight — offsetHeight rounds to the nearest integer
    // (66.5px reads back as 67), which drifted the published variable from the bar's real size.
    //
    // Writing this value is itself a style mutation on `root`, the exact element the
    // MutationObserver below watches — so a no-op check isn't just tidy, it is what keeps that
    // observer from re-triggering itself every time the height is unchanged.
    const publish = () => {
      const next = `${el.getBoundingClientRect().height}px`;
      if (root.style.getPropertyValue('--bottom-nav-height') !== next) {
        root.style.setProperty('--bottom-nav-height', next);
      }
    };
    publish();

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(publish);
      resizeObserver.observe(el);
    }

    let styleObserver: MutationObserver | undefined;
    if (typeof MutationObserver !== 'undefined') {
      styleObserver = new MutationObserver(publish);
      styleObserver.observe(root, { attributes: true, attributeFilter: ['style'] });
    }

    return () => {
      resizeObserver?.disconnect();
      styleObserver?.disconnect();
      // A route that mounts no TabBar (e.g. /login) must not inherit a stale height from
      // whichever page rendered one last — fall back to globals.css's pre-hydration value.
      root.style.removeProperty('--bottom-nav-height');
    };
  }, []);

  function isActive(href: string) {
    const base = href.split('?')[0];
    return pathname === base || (base !== '/' && pathname.startsWith(base));
  }

  return (
    <div
      ref={barRef}
      // desk-07: at 1280px this bar was still the primary navigation — the phone bottom tab bar
      // stretched edge to edge with its labels spread thin. AppHeader shows the same four
      // destinations as proper desktop nav links at lg+ on the pages that use it, so this bar can
      // step aside there instead of doubling as a second, wrong-shaped nav.
      className={hideAtDesktop ? 'flex lg:hidden' : 'flex'}
      style={{
        // var(--bg-1), not the '#FFFEFA' this used to carry: that hex matches earth LIGHT
        // exactly but never changes, so this bar — present on almost every screen — stayed a
        // bright white strip glued to the bottom of an otherwise-dark screen in dark mode.
        background: 'var(--bg-1)',
        boxShadow: '0 -2px 12px rgba(22,56,32,0.08)',
        flexShrink: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map(({ href, key, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-2 ${styles.link}`}
            style={{ textDecoration: 'none' }}
          >
            <div
              className={`flex flex-col items-center gap-1 ${styles.pill} ${active ? styles.active : ''}`}
              style={{
                padding: '4px 14px',
                borderRadius: 12,
                // w18-33: a tint of the theme's --emerald, not a fixed light pill (it was the only
                // light surface in the dark chrome).
                background: active ? 'color-mix(in srgb, var(--emerald) 16%, transparent)' : 'transparent',
              }}
            >
              <Icon
                className={styles.icon}
                size={22}
                strokeWidth={active ? 2.2 : 1.7}
                style={{
                  color: active ? 'var(--emerald)' : 'var(--text-muted)',
                }}
              />
              <span
                className="font-sans"
                style={{
                  // Still 12px (tests/type-floor.test.ts's FARMER_SURFACES floor, zero budget) —
                  // nowrap plus the shorter tabRecords/tabDashboard/tabStudies keys and the
                  // isiZulu non-breaking hyphen are what stop the label wrapping (ux-08/zu-08),
                  // not a smaller size.
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  fontWeight: active ? 700 : 600,
                  // emerald at 16% over the bar is 4.46:1 in earth light — under 4.5 for 12px text — so the label
                  // takes --text-primary (13:1 / 11:1); the icon keeps the emerald.
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  letterSpacing: '0.01em',
                  transition: 'color var(--dur-fast) var(--ease-out)',
                }}
              >
                {t(key)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
