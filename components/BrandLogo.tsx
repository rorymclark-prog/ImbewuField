'use client';

import Link from 'next/link';

/**
 * The ImbewuField wordmark + icon. Clickable — always returns to the landing hub.
 */
export default function BrandLogo({ icon = '🌿' }: { icon?: string }) {
  return (
    <Link
      href="/home"
      title="Home"
      aria-label="ImbewuField home"
      className="flex items-center gap-2.5 flex-shrink-0"
      style={{ textDecoration: 'none' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-base"
        style={{
          background: 'linear-gradient(135deg, rgba(72,168,100,0.25), rgba(72,168,100,0.08))',
          border: '1px solid rgba(72,168,100,0.4)',
        }}
      >
        {icon}
      </div>
      <span className="hidden sm:inline font-display font-bold text-sm tracking-tight text-gradient">ImbewuField</span>
    </Link>
  );
}
