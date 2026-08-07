'use client';

// Mounted once, globally (app/layout.tsx), so the "you're in a demo" notice
// appears on every route without per-page wiring. Fixed positioning, same
// "sit just above the tab bar" offset already used elsewhere in this app
// (e.g. the floating Details button on /farmer) — never depends on any
// particular page's own layout.

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { isSampleMode, exitSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';

export default function SampleModeBanner() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isSampleMode());
    const onChange = () => setActive(isSampleMode());
    window.addEventListener(SAMPLE_MODE_EVENT, onChange);
    return () => window.removeEventListener(SAMPLE_MODE_EVENT, onChange);
  }, []);

  if (!active) return null;

  function handleExit() {
    exitSampleMode();
    // Hard reload, not client-side routing — every mounted component
    // (including ones this session never touches directly) remounts and
    // re-reads through the now-genuinely-real loaders.
    window.location.href = '/home';
  }

  return (
    <div
      className="no-print fixed left-0 right-0 flex items-center justify-center gap-3 px-4 py-2 flex-wrap text-center"
      style={{
        bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        zIndex: 9999,
        background: '#C07A1E',
        borderTop: '1px solid rgba(32,25,15,0.15)',
        boxShadow: '0 -2px 12px rgba(32,25,15,0.18)',
      }}
    >
      <span className="flex items-center gap-1.5 font-display font-semibold" style={{ fontSize: 13, color: '#fff' }}>
        <Sparkles size={14} />
        Sample mode — Ubhejane Creche demo data. Nothing here is saved.
      </span>
      <button
        type="button"
        onClick={handleExit}
        className="flex items-center gap-1 px-3 py-1 rounded-full font-sans font-semibold"
        style={{ fontSize: 12, background: '#fff', color: '#C07A1E', border: 'none', cursor: 'pointer' }}
      >
        <X size={13} />
        Exit sample
      </button>
    </div>
  );
}
