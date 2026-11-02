'use client';

import LanguageDraftNote from '@/components/LanguageDraftNote';
import { useLanguage } from '@/lib/i18n';

/**
 * The shared "unreviewed machine draft" note, for pages that show isiXhosa or Afrikaans drafts and had no notice at all.
 * It renders only for isiXhosa and Afrikaans (the name predates Afrikaans), so English, isiZulu, Sesotho, Xitsonga
 * and Tshivenda see exactly what they saw before. A client piece of its own so server-rendered pages (which cannot call useLanguage)
 * can place it too. `scope` keys the per-page dismissal, like LanguageDraftNote's.
 */
export default function XhosaDraftNote({ scope, className = 'px-4 pt-2' }: { scope: string; className?: string }) {
  const { lang } = useLanguage();
  if (lang !== 'xh' && lang !== 'af') return null;
  return <div className={`flex-shrink-0 ${className}`}><LanguageDraftNote lang={lang} scope={scope} /></div>;
}
