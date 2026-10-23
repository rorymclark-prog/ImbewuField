'use client';

import { useEffect, useState } from 'react';
import { readErrorPageLang, errorPageCopy } from '@/lib/error-page-copy';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  // This boundary can fire because something above it (including LanguageProvider itself)
  // failed, so it never reads the language context — see lib/error-page-copy.ts. Never the raw
  // error.message: a farmer cannot act on a JS stack trace, and lang-07 asks for a fixed
  // message instead (console.error above keeps the real error for debugging). Starts English
  // (matching server render) and reads the saved choice once mounted, same as LanguageProvider.
  const [copy, setCopy] = useState(() => errorPageCopy('en'));
  useEffect(() => { setCopy(errorPageCopy(readErrorPageLang())); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg-0)', padding: 24, textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21V11" /><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" /><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
        </svg>
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{copy.errorTitle}</h2>
      <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, color: 'var(--text-secondary)', marginBottom: copy.zuluDraftNotice ? 4 : 24 }}>
        {copy.errorBody}
      </p>
      {copy.zuluDraftNotice && (
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 11, color: 'var(--text-muted)', marginBottom: 24 }}>
          {copy.zuluDraftNotice}
        </p>
      )}
      <button
        onClick={reset}
        style={{ height: 44, padding: '0 24px', background: 'var(--emerald)', color: 'var(--bg-0)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
      >
        {copy.tryAgain}
      </button>
    </div>
  );
}
