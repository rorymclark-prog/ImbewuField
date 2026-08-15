'use client';

// THE PAGE WITH NOTHING LEFT TO KILL.
//
// This is where the server sends a phone that keeps dying on /design (see lib/server-rescue.ts
// and middleware.ts). It exists to be survivable, so its discipline is what it does NOT import:
// no Map, no studio, no photo pipeline, no sheet store, no i18n bundle — the chunk must stay a
// few kilobytes, because it is served precisely to phones that could not start the big one.
//
// It reads NOTHING at mount. Even a localStorage scan is a way to be slow on the phone this
// page is for. It tells the farmer the truth, offers the ways back in, and gets out of the way.
//
// The "try again" links carry ?full=1, which resets the server's crash count (a deliberate
// human choice to go back in heavy must not bounce straight back here), and the light variant
// adds ?safe=1 so the design page also skips its photo pipeline client-side.

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LiteInner() {
  const params = useSearchParams();
  const lat = params.get('lat');
  const lon = params.get('lon');
  const coords = lat && lon ? `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` : '';
  const amp = coords ? '&' : '?';

  const link = (href: string, label: string, sub: string, primary = false) => (
    <a
      href={href}
      style={{
        display: 'block', padding: '14px 16px', borderRadius: 14, textDecoration: 'none',
        background: primary ? 'linear-gradient(135deg, #1F4D2B, #2D6B3C)' : '#FBF6EC',
        border: primary ? '1px solid rgba(31,77,43,0.6)' : '1px solid #E2D8C4',
        color: primary ? '#FFFFFF' : '#20190F',
      }}
    >
      <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{label}</span>
      <span style={{ display: 'block', fontSize: 12.5, marginTop: 2, color: primary ? 'rgba(255,255,255,0.85)' : '#5C5040' }}>
        {sub}
      </span>
    </a>
  );

  return (
    <main style={{ minHeight: '100dvh', background: '#E4DCC6', padding: '28px 20px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '16px 18px', borderRadius: 16, background: '#FDF4E3', border: '1px solid #E8D5A8' }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#20190F', fontFamily: 'var(--font-display)' }}>
            Your design is safe
          </div>
          <div style={{ fontSize: 13.5, color: '#5C5040', marginTop: 6, lineHeight: 1.5 }}>
            The full designer kept closing on this phone, so we brought you here instead of letting
            it crash again. Everything you drew and every measurement is exactly as you left it.
          </div>
        </div>

        {link(`/design${coords}${amp}safe=1&full=1`, 'Open the designer, light', 'Your whole design without the background photo — easiest on this phone', true)}
        {link(`/design${coords}${amp}full=1`, 'Open the full designer', 'Everything including the photo — needs a phone with more free memory')}
        {link(`/farmer${coords}`, 'Back to the map', 'Your farm, places and details panel')}
        {link('/farmer?panel=Reports', 'My reports', 'Saved reports, photos and evidence')}

        <div style={{ fontSize: 11.5, color: '#8C7A62', textAlign: 'center', marginTop: 8 }}>
          Closing other tabs and apps frees memory for the full designer.
        </div>
      </div>
    </main>
  );
}

export default function DesignLitePage() {
  // useSearchParams needs a Suspense boundary in the app router; the fallback is the page shell.
  return (
    <Suspense fallback={<main style={{ minHeight: '100dvh', background: '#E4DCC6' }} />}>
      <LiteInner />
    </Suspense>
  );
}
