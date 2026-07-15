'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <html>
      <body style={{ margin: 0, background: '#E4DCC6', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#20190F', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: '#5C5040', marginBottom: 24 }}>{error.message}</p>
          <button onClick={reset} style={{ height: 44, padding: '0 24px', background: '#1F4D2B', color: '#F7F2E9', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
