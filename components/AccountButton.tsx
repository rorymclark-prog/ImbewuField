'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';

export default function AccountButton() {
  const { user, signOutUser } = useAuth();

  // Don't render at all when Firebase is unconfigured — no auth to surface.
  if (!isBackendConfigured()) return null;

  if (user) {
    // Sample farm shows a neutral label — never the real signed-in user's name/email (the one
    // spot the demo would otherwise leak their identity; the rest reads "Sample Farmer").
    const label = isSampleMode() ? 'Sample' : (user.displayName?.split(' ')[0] ?? user.email ?? 'Account');
    return (
      <div
        className="flex items-center gap-2 px-3.5 rounded-full flex-shrink-0"
        style={{
          // Tokens, not the '#FFFEFA'/'#E2D8C4' this used to carry: this sits in the header of
          // the farm map, the app's most-visited screen, so it stayed a bright white pill glued
          // to the top of an otherwise-dark screen in dark mode.
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          minHeight: 56,
        }}
      >
        <span
          className="font-display"
          style={{ color: 'var(--text-primary)', fontSize: 20 }}
        >
          {label}
        </span>
        <button
          onClick={signOutUser}
          className="font-mono transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 17 }}
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
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        color: 'var(--emerald)',
        textDecoration: 'none',
        minHeight: 56,
        fontSize: 20,
      }}
    >
      Sign in
    </Link>
  );
}
