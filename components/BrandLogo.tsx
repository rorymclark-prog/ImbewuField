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
        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(72,168,100,0.25), rgba(72,168,100,0.08))',
          border: '1px solid rgba(72,168,100,0.4)',
        }}
      >
        {icon}
      </div>
      <span className="hidden sm:inline font-display font-bold text-base tracking-tight text-gradient">ImbewuField</span>
    </Link>
  );
}
