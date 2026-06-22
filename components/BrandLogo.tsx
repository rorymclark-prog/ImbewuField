'use client';

import Link from 'next/link';

/**
 * The ImbewuField wordmark + icon. Clickable — always returns to the landing hub.
 * Uses the almanac design system: Lima sprout SVG, solid #1F4D2B container, #20190F ink.
 */
// icon prop accepted for legacy callers (RolePlaceholder) but unused — BrandLogo always shows the Lima sprout
export default function BrandLogo({ icon: _icon }: { icon?: string } = {}) {
  return (
    <Link
      href="/"
      title="Home"
      aria-label="ImbewuField home"
      className="flex items-center gap-2.5 flex-shrink-0"
      style={{ textDecoration: 'none' }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          background: '#1F4D2B',
          borderRadius: '10px',
          width: '36px',
          height: '36px',
          flexShrink: 0,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#EAF3E2"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21V11" />
          <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
          <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
        </svg>
      </div>
      <span
        className="hidden sm:inline font-display font-semibold"
        style={{ color: '#20190F', fontSize: '18px', letterSpacing: '-0.01em' }}
      >
        ImbewuField
      </span>
    </Link>
  );
}
