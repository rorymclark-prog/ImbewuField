'use client';

import { useLanguage } from '@/lib/i18n';
import { inlineTemplate, inlineText } from '@/lib/xh-inline';

/**
 * Fixed English text on a SERVER-rendered page (one that exports `metadata`, so it cannot call
 * useLanguage itself). English and every other language render the English unchanged; isiXhosa
 * readers get the draft keyed by that exact English (lib/locales/xh-inline/). With `vars`, `en` is a
 * `{name}` template.
 */
export default function InlineText({ en, vars }: { en: string; vars?: Record<string, string | number> }) {
  const { lang } = useLanguage();
  return <>{vars ? inlineTemplate(lang, en, null, vars) : inlineText(lang, en)}</>;
}
