'use client';

import { useLanguage } from '@/lib/i18n';

/** The source stays visible so farmers can compare this unreviewed language draft. */
export default function DesignZuluDraftNotice() {
  const { t } = useLanguage();
  const message = t('designZuluDraftNotice');
  const separator = message.indexOf(' · ');
  const isiZulu = separator >= 0 ? message.slice(0, separator) : message;
  const english = separator >= 0 ? message.slice(separator + 3) : '';
  const warningEnd = isiZulu.indexOf('. ');
  const warning = warningEnd >= 0 ? isiZulu.slice(0, warningEnd + 1) : isiZulu;
  const detail = warningEnd >= 0 ? isiZulu.slice(warningEnd + 2) : '';

  return (
    <div
      role="note"
      lang="zu"
      style={{
        padding: '5px 9px',
        borderRadius: 8,
        background: 'rgba(192,122,30,0.10)',
        color: '#5C3B0D',
        fontSize: 10.5,
        lineHeight: 1.35,
      }}
    >
      <strong>{warning}</strong>{detail && <> <span>{detail}</span></>}
      {english && <span lang="en"> · {english}</span>}
    </div>
  );
}
