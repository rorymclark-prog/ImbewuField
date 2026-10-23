'use client';

import { useLanguage } from '@/lib/i18n';
import { inlineTemplate, inlineText } from '@/lib/xh-inline';
import { EX } from './theme';

/**
 * Trust, privacy and transaction claims keep their exact English source beside the draft.
 * isiZulu comes from `zu`; isiXhosa comes from the xh-inline drafts, keyed by the English `en`
 * (or by `tpl` — the same sentence with {placeholders} — when it carries a name or a figure,
 * filled from `vars`). With no isiXhosa draft yet the English is shown on its own.
 */
export function ExchangeSourceCopy({ en, zu, tpl, vars }: { en: string; zu: string; tpl?: string; vars?: Record<string, string | number> }) {
  const { lang } = useLanguage();
  if (lang === 'xh') {
    const draft = tpl ? inlineTemplate(lang, tpl, null, vars ?? {}) : inlineText(lang, en);
    if (draft === en) return <>{en}</>;
    return (
      <>
        <span lang="xh">{draft}</span>
        <small style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.45 }}>
          English source: {en}
        </small>
      </>
    );
  }
  return lang === 'zu' ? (
    <>
      <span>{zu}</span>
      <small style={{ display: 'block', marginTop: 4, fontSize: 12, lineHeight: 1.45 }}>
        English source: {en}
      </small>
    </>
  ) : <>{en}</>;
}

export function ExchangeDraftNotice() {
  const { lang } = useLanguage();
  if (lang === 'xh') {
    return (
      <p role="note" lang="xh" style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: EX.faint }}>
        {inlineText(lang, 'Unreviewed isiXhosa draft. This wording is waiting for a fluent isiXhosa speaker to review it.')}
      </p>
    );
  }
  return lang === 'zu' ? (
    <p role="note" style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: EX.faint }}>
      Umbhalo wesiZulu uwuhlaka olusalindele ukubuyekezwa isikhulumi sesiZulu esinekhono.
    </p>
  ) : null;
}
