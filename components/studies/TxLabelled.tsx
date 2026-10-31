'use client';

import type { ElementType, HTMLAttributes } from 'react';
import { useLanguage } from '@/lib/i18n';
import { inlineTemplate, inlineText } from '@/lib/xh-inline';

/**
 * A landmark or scroll region whose aria-label is fixed English course copy, on a SERVER-rendered
 * page (which cannot call useLanguage). English and every other language keep the English label
 * unchanged; isiXhosa reads the draft keyed by that exact English. With `values`, `en` is a
 * `{name}` template; `lookup` names the values that are themselves English course text (a table
 * title) and get their own draft.
 */
export default function TxLabelled({ as: Tag = 'div', en, values, lookup, ...rest }: {
  as?: ElementType; en: string; values?: Record<string, string | number>; lookup?: string[];
} & Omit<HTMLAttributes<HTMLElement>, 'aria-label'>) {
  const { lang } = useLanguage();
  const filled = values && lookup?.length
    ? Object.fromEntries(Object.entries(values).map(([key, value]) => [key, lookup.includes(key) ? inlineText(lang, String(value)) : value]))
    : values;
  return <Tag {...rest} aria-label={filled ? inlineTemplate(lang, en, null, filled) : inlineText(lang, en)} />;
}
