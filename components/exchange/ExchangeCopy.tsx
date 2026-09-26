'use client';

import { useLanguage } from '@/lib/i18n';
import { EX } from './theme';

/** Trust, privacy and transaction claims keep their exact English source beside the draft. */
export function ExchangeSourceCopy({ en, zu }: { en: string; zu: string }) {
  const { lang } = useLanguage();
  return lang === 'zu' ? (
    <>
      <span>{zu}</span>
      <small style={{ display: 'block', marginTop: 4, fontSize: '0.92em', lineHeight: 1.45 }}>
        English source: {en}
      </small>
    </>
  ) : <>{en}</>;
}

export function ExchangeDraftNotice() {
  const { lang } = useLanguage();
  return lang === 'zu' ? (
    <p role="note" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: EX.faint }}>
      Umbhalo wesiZulu uwuhlaka olusalindele ukubuyekezwa isikhulumi sesiZulu esinekhono.
    </p>
  ) : null;
}
