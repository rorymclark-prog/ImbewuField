'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';

export default function AccountButton() {
  const { user, signOutUser } = useAuth();
  const { lang, t } = useLanguage();
  const isZulu = lang === 'zu';
  // isiXhosa is also an unreviewed machine draft, so it keeps the English beside it like isiZulu.
  const isDraft = lang === 'zu' || lang === 'xh';
  const signOutCopy = 'Signing out ends access to this account on this device. Sign in again to continue.';
  const signOutZulu = 'Ukuphuma ngemvume kuvala ukufinyelela kule akhawunti kule divayisi. Ngena futhi ukuze uqhubeke.';
  const signOutDraft = inlineText(lang, signOutCopy, signOutZulu);

  // Don't render at all when Firebase is unconfigured — no auth to surface.
  if (!isBackendConfigured()) return null;

  if (user) {
    // Sample farm shows a neutral label — never the real signed-in user's name/email (the one
    // spot the demo would otherwise leak their identity; the rest reads "Sample Farmer").
    // zu-07: was the literal English 'Tour' regardless of language — shares the same key
    // SampleModeBanner uses, which matches MenuButton.tsx's own hardcoded isiZulu text.
    const label = isSampleMode() ? t('tourPill') : (user.displayName?.split(' ')[0] ?? user.email ?? 'Account');
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
          className="font-sans transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 17 }}
          aria-label={isDraft ? `${signOutDraft} (${signOutCopy})` : signOutCopy}
          title={isDraft ? `${signOutDraft} (${signOutCopy})` : signOutCopy}
        >
          {isZulu ? 'Phuma ngemvume (Sign out)' : isDraft ? `${inlineText(lang, 'Sign out')} (Sign out)` : 'Sign out'}
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
        // '#2D6B3C', not var(--emerald): the earth theme's --emerald (#3A7518, an "ok"-status
        // olive-green) is a different hue from the brand forest green every other screen still
        // hardcodes — this chip is the app's most-visited header, not the place to fork the
        // brand accent in two.
        color: 'var(--color-forest-700)',
        textDecoration: 'none',
        minHeight: 56,
        fontSize: 20,
      }}
    >
      {isZulu ? 'Ngena ngemvume (Sign in)' : isDraft ? `${inlineText(lang, 'Sign in')} (Sign in)` : 'Sign in'}
    </Link>
  );
}
