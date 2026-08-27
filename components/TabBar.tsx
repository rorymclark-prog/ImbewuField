'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, DollarSign, User } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

const TABS = [
  { href: '/home',     key: 'tabHome',    Icon: Home },
  { href: '/farmer',   key: 'tabMap',     Icon: Map },
  { href: '/finances', key: 'tabFinance', Icon: DollarSign },
  { href: '/account',  key: 'tabAccount', Icon: User },
];

export default function TabBar() {
  const pathname = usePathname();
  const { t } = useLanguage();
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
      className="flex"
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
      {TABS.map(({ href, key, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center py-2"
            style={{ textDecoration: 'none' }}
          >
            <div
              className="flex flex-col items-center gap-1"
              style={{
                padding: '4px 14px',
                borderRadius: 12,
                background: active ? 'var(--brand-soft)' : 'transparent',
                transition: 'background var(--dur-fast) var(--ease-out)',
              }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.7}
                style={{
                  // '#1F4D2B', not var(--emerald): the earth theme's --emerald (#3A7518, an
                  // "ok"-status olive-green, see globals.css) is a different hue from the brand
                  // forest green every other screen still hardcodes — swapping just this one
                  // would put two visibly different "brand greens" in the app at once. Matches
                  // the --brand-soft tint already used for the pill background above.
                  color: active ? '#1F4D2B' : 'var(--text-muted)',
                  transition: 'color var(--dur-fast) var(--ease-out)',
                }}
              />
              <span
                className="font-sans"
                style={{
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  color: active ? '#1F4D2B' : 'var(--text-muted)',
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
