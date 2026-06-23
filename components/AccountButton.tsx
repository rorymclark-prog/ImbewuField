'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';

export default function AccountButton() {
  const { user, signOutUser } = useAuth();

  // Don't render at all when Firebase is unconfigured — no auth to surface.
  if (!isBackendConfigured()) return null;

  if (user) {
    const label = user.displayName?.split(' ')[0] ?? user.email ?? 'Account';
    return (
      <div
        className="flex items-center gap-2 px-3.5 rounded-full flex-shrink-0"
        style={{
          background: '#FBF6EC',
          border: '1px solid #E2D8C4',
          minHeight: 56,
        }}
      >
        <span
          className="font-display"
          style={{ color: '#20190F', fontSize: 20 }}
        >
          {label}
        </span>
        <button
          onClick={signOutUser}
          className="font-mono transition-opacity hover:opacity-80"
          style={{ color: '#5C5040', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 17 }}
          aria-label="Sign out"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="flex items-center px-3.5 rounded-full font-display transition-opacity hover:opacity-80 flex-shrink-0"
      style={{
        background: '#FBF6EC',
        border: '1px solid #E2D8C4',
        color: '#2D6B3C',
        textDecoration: 'none',
        minHeight: 56,
        fontSize: 20,
      }}
    >
      Sign in
    </Link>
  );
}
