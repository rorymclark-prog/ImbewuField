'use client';

// Browser tab titles in isiXhosa.
//
// Every route's <title> is static English metadata (app/**/layout.tsx, pinned by
// tests/page-titles.test.ts) and the reader's language lives only in the browser, so the server
// cannot localise it. When the language is isiXhosa this reads the title Next.js set, splits off
// the shared " — ImbewuField" suffix, translates the page part (lib/locales/xh-inline/
// g29-document-titles.ts) and writes it back. A title with no draft stays English. Other
// languages are left completely alone.
//
// Next.js re-writes <title> on every client navigation (and may replace the element), so a
// MutationObserver on <head> re-applies the translation. The loop guard: the value this component
// wrote is remembered and a mutation that merely shows that value is ignored, and a title is only
// written when it differs from what is already there.

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';

const SUFFIX = ' — ImbewuField';

/** The isiXhosa title for an English document title, or the title unchanged when there is no draft. */
export function xhDocumentTitle(english: string): string {
  const whole = inlineText('xh', english);
  if (whole !== english) return whole;
  if (english.endsWith(SUFFIX)) {
    const part = english.slice(0, -SUFFIX.length);
    const translated = inlineText('xh', part);
    if (translated !== part) return translated + SUFFIX;
  }
  return english;
}

export default function DocumentTitle() {
  const { lang, t } = useLanguage();
  const pathname = usePathname();
  const source = useRef<string | null>(null); // the English title Next.js set
  const applied = useRef<string | null>(null); // what this component last wrote

  // `t` is a new function whenever the provider re-renders, including once the lazily loaded
  // isiXhosa chunk (which registers the drafts) lands — so the title is re-applied then too.
  useEffect(() => {
    if (lang !== 'xh' || typeof document === 'undefined') return;

    const apply = () => {
      const current = document.title;
      // Our own write (or an unchanged re-render) shows what we wrote: translate again from the
      // English we kept. Anything else is a title Next.js just set.
      if (applied.current === null || current !== applied.current) source.current = current;
      const english = source.current;
      if (english === null) return;
      const next = xhDocumentTitle(english);
      if (next === english) {
        applied.current = null;
        return;
      }
      applied.current = next;
      if (document.title !== next) document.title = next;
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [lang, pathname, t]);

  // Leaving isiXhosa puts the English back if the title is still the one this component wrote.
  useEffect(() => {
    if (lang === 'xh') return;
    if (applied.current !== null && source.current !== null && document.title === applied.current) {
      document.title = source.current;
    }
    applied.current = null;
    source.current = null;
  }, [lang]);

  return null;
}
