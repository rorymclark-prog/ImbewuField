'use client';

import { useEffect, useState } from 'react';
import { readErrorPageLang, errorPageCopy } from '@/lib/error-page-copy';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  // The root layout itself failed, so this page replaces it entirely — it never loads
  // app/globals.css (no var(--bg-0) etc. here, unlike app/error.tsx/not-found.tsx) and never has
  // LanguageProvider. Never the raw error.message: see lib/error-page-copy.ts. Starts English
  // (matching server render) and reads the saved choice once mounted.
  const [copy, setCopy] = useState(() => errorPageCopy('en'));
  useEffect(() => { setCopy(errorPageCopy(readErrorPageLang())); }, []);

  return (
    <html>
      <body style={{ margin: 0, background: '#E4DCC6', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#20190F', marginBottom: 8 }}>{copy.errorTitle}</h2>
          <p style={{ fontSize: 14, color: '#5C5040', marginBottom: copy.zuluDraftNotice ? 4 : 24 }}>{copy.errorBody}</p>
          {copy.zuluDraftNotice && (
            <p style={{ fontSize: 11, color: '#755942', marginBottom: 24 }}>{copy.zuluDraftNotice}</p>
          )}
          <button onClick={reset} style={{ height: 44, padding: '0 24px', background: '#1F4D2B', color: '#F7F2E9', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {copy.tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}
