'use client';

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

  function isActive(href: string) {
    const base = href.split('?')[0];
    return pathname === base || (base !== '/' && pathname.startsWith(base));
  }

  return (
    <div
      className="flex"
      style={{
        background: '#FBF6EC',
        borderTop: '1px solid #E2D8C4',
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
            className="flex-1 flex flex-col items-center gap-1 py-2"
            style={{ textDecoration: 'none' }}
          >
            <Icon
              size={22}
              strokeWidth={active ? 2.2 : 1.7}
              style={{ color: active ? '#1F4D2B' : '#94876F' }}
            />
            <span
              className="font-sans"
              style={{
                fontSize: 11,
                fontWeight: active ? 700 : 600,
                color: active ? '#1F4D2B' : '#94876F',
                letterSpacing: '0.01em',
              }}
            >
              {t(key)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
