'use client';

import type { ReactNode } from 'react';
import { useLanguage } from '@/lib/i18n';

/** English-only chrome that the isiZulu draft notice replaces, so the two never stack in isiZulu mode. */
export default function EnglishOnly({ children }: { children: ReactNode }) {
  const { lang } = useLanguage();
  return lang === 'zu' ? null : <>{children}</>;
}
