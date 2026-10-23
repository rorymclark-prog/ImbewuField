'use client';

// THE PAGE WITH NOTHING LEFT TO KILL.
//
// This is where the server sends a phone that keeps dying on /design or /farmer (see
// lib/server-rescue.ts and middleware.ts). It exists to be survivable, so its discipline is what
// it does NOT import: no Map, no studio, no photo pipeline, no sheet store, no i18n bundle — the
// chunk must stay a few kilobytes, because it is served precisely to phones that could not start
// the big one.
//
// It reads NOTHING at mount. Even a localStorage scan is a way to be slow on the phone this
// page is for. It tells the farmer the truth, offers the ways back in, and gets out of the way.
//
// The "try again" links carry ?full=1: a one-shot grant to go back in heavy (the server plants a
// grant cookie so the auto-reload after a failed retry comes straight back here — never to the
// grey screen). The light variant adds ?safe=1 so the design page also skips its photo pipeline
// client-side. The farmer links carry full=1 for the same reason — without it, a farmer-map
// streak would bounce "Back to the map" straight back to this page.

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LiteInner() {
  const params = useSearchParams();
  const lat = params.get('lat');
  const lon = params.get('lon');
  const coords = lat && lon ? `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` : '';
  const amp = coords ? '&' : '?';
  // Which page kept dying (the middleware marks farmer-map redirects), and whether even the
  // LIGHT designer died — the request that got redirected here already carried safe=1.
  const fromFarmer = params.get('from') === 'farmer';
  const lightDied = params.get('safe') === '1';

  const link = (href: string, label: string, sub: string, primary = false) => (
    <a
      href={href}
      style={{
        display: 'block', padding: '14px 16px', borderRadius: 14, textDecoration: 'none',
        background: primary ? 'linear-gradient(135deg, #1F4D2B, #2D6B3C)' : 'var(--bg-1)',
        border: primary ? '1px solid rgba(31,77,43,0.6)' : '1px solid var(--border)',
        color: primary ? 'var(--on-forest)' : 'var(--text-primary)',
      }}
    >
      <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{label}</span>
      <span style={{ display: 'block', fontSize: 12.5, marginTop: 2, color: primary ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)' }}>
        {sub}
      </span>
    </a>
  );

  const title = fromFarmer ? 'Your farm is safe' : 'Your design is safe';
  const body = fromFarmer
    ? 'The map page kept closing on this device, so we brought you here instead of letting it crash again. Your places, reports and details are exactly as you left them.'
    : lightDied
      ? 'Even the light designer could not stay open on this device right now. Nothing is lost — everything you drew and every measurement is safe. Freeing memory (close other apps and tabs) gives the next try its best chance.'
      : 'The full designer kept closing on this device, so we brought you here instead of letting it crash again. Everything you drew and every measurement is exactly as you left it.';

  const designLight = link(`/design${coords}${amp}safe=1&full=1`, 'Open the designer, light', 'Your whole design without the background photo — easiest on this device', !fromFarmer);
  const designFull = link(`/design${coords}${amp}full=1`, 'Open the full designer', 'Everything including the photo — needs a phone with more free memory');
  const farmerMap = link(`/farmer${coords}${amp}full=1`, 'Back to the map', 'Your farm, places and details panel', fromFarmer);
  const reports = link('/farmer?panel=Reports&full=1', 'My reports', 'Saved reports, photos and evidence');

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg-0)', padding: 'calc(env(safe-area-inset-top, 0px) + 56px) 20px 28px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '16px 18px', borderRadius: 16, background: 'var(--warn-soft)', border: '1px solid color-mix(in srgb, var(--warn) 35%, transparent)' }}>
          <h1 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {title}
          </h1>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
            {body}
          </div>
        </div>

        {fromFarmer ? (
          <>
            {farmerMap}
            {reports}
            {designLight}
            {designFull}
          </>
        ) : (
          <>
            {designLight}
            {designFull}
            {farmerMap}
            {reports}
          </>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
          Closing other tabs and apps frees memory for the full experience.
        </div>
      </div>
    </main>
  );
}

export default function DesignLitePage() {
  // useSearchParams needs a Suspense boundary in the app router; the fallback is the page shell.
  return (
    <Suspense fallback={<main style={{ minHeight: '100dvh', background: 'var(--bg-0)' }} />}>
      <LiteInner />
    </Suspense>
  );
}
