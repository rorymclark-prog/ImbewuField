'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';

/**
 * The language to render server-rendered course copy in. The isiXhosa drafts only exist on the client
 * (the locale chunk registers them after load), so a component that hydrates late - a streamed or
 * deferred boundary - can see lang === 'xh' and a registered draft on its very first client render while
 * the server HTML it is hydrating is English. That is a hydration mismatch.
 *
 * Until THIS component has mounted it answers 'en', which is exactly what the server rendered; the effect
 * then flips it to the real language. English, isiZulu and every other language are unchanged after mount.
 */
export function useHydratedLang(): string {
  const { lang } = useLanguage();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted ? lang : 'en';
}
