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
        className="flex items-center gap-2 px-3 py-2 rounded-full flex-shrink-0"
        style={{
          background: 'rgba(22,37,20,0.6)',
          border: '1px solid var(--border)',
        }}
      >
        <span
          className="text-sm font-display"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </span>
        <button
          onClick={signOutUser}
          className="text-xs font-mono transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
      className="flex items-center px-3 py-2 rounded-full text-sm font-display transition-opacity hover:opacity-80 flex-shrink-0"
      style={{
        background: 'rgba(22,37,20,0.6)',
        border: '1px solid var(--border)',
        color: 'var(--emerald-bright)',
        textDecoration: 'none',
      }}
    >
      Sign in
    </Link>
  );
}
