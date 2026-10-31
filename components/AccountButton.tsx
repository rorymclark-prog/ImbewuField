'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';
import { accountText } from '@/lib/account-copy';
import { sampleWorkspaceText } from '@/lib/sample-tour-localization';

export default function AccountButton() {
  const { user, signOutUser } = useAuth();
  const { lang, t } = useLanguage();
  const native = ['zu', 'st', 'ts', 've'].includes(lang);
  // isiXhosa is also an unreviewed machine draft, so it keeps the English beside it like the four
  // languages above; its wording comes from the isiXhosa inline drafts, not the account tables.
  // Afrikaans reads the same English-keyed inline drafts (lib/xh-inline.ts).
  const inlineDraftLang = lang === 'xh' || lang === 'af';
  const isDraft = native || inlineDraftLang;
  const signIn = inlineDraftLang ? inlineText(lang, 'Sign in') : accountText(lang, 'Sign in', 'Ngena ngemvume', t);
  const signOut = inlineDraftLang ? inlineText(lang, 'Sign out') : accountText(lang, 'Sign out', 'Phuma ngemvume', t);
  const signOutCopy = 'Signing out ends access to this account on this device. Sign in again to continue.';
  const signOutZulu = 'Ukuphuma ngemvume kuvala ukufinyelela kule akhawunti kule divayisi. Ngena futhi ukuze uqhubeke.';
  const signOutDescription = inlineDraftLang ? inlineText(lang, signOutCopy, signOutZulu) : sampleWorkspaceText(lang, signOutCopy, signOutZulu);

  // Don't render at all when Firebase is unconfigured — no auth to surface.
  if (!isBackendConfigured()) return null;

  if (user) {
    // Sample farm shows a neutral label — never the real signed-in user's name/email (the one
    // spot the demo would otherwise leak their identity; the rest reads "Sample Farmer").
    const label = isSampleMode() ? t('tourPill') : (user.displayName?.split(' ')[0] ?? user.email ?? t('tabAccount'));
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
          lang={lang}
          aria-label={isDraft ? `${signOutDescription} (${signOutCopy})` : signOutCopy}
          title={isDraft ? `${signOutDescription} (${signOutCopy})` : signOutCopy}
        >
          {isDraft ? <><span lang={lang}>{signOut}</span> <span lang="en">(Sign out)</span></> : 'Sign out'}
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
      {isDraft ? <><span lang={lang}>{signIn}</span> <span lang="en">(Sign in)</span></> : 'Sign in'}
    </Link>
  );
}
