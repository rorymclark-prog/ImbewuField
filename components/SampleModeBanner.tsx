'use client';

// Mounted once, globally (app/layout.tsx), so the "you're in a demo" notice
// appears on every route without per-page wiring. Fixed positioning, same
// "sit just above the tab bar" offset already used elsewhere in this app
// (e.g. the floating Details button on /farmer) — never depends on any
// particular page's own layout.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { isSampleMode, exitSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';

export default function SampleModeBanner() {
  const pathname = usePathname() || '';
  const [active, setActive] = useState(false);

  useEffect(() => {
    const applyState = () => {
      const mode = isSampleMode();
      setActive(mode);
      if (mode) {
        document.body.classList.add('is-sample-mode');
      } else {
        document.body.classList.remove('is-sample-mode');
      }
    };
    applyState();
    window.addEventListener(SAMPLE_MODE_EVENT, applyState);
    return () => {
      window.removeEventListener(SAMPLE_MODE_EVENT, applyState);
      document.body.classList.remove('is-sample-mode');
    };
  }, []);

  // The /pitch projector deck opts out. The deck enters sample mode itself as load-bearing
  // setup for its live slides, and those slides carry this banner INSIDE their app frames,
  // where it is true and useful. Floating it over the deck chrome as well would put an
  // "Exit sample" button on a projected slide — a control whose only possible effect is to
  // break the presentation in front of the audience.
  if (!active || pathname.startsWith('/pitch')) return null;

  function handleExit() {
    exitSampleMode();
    // Hard reload, not client-side routing — every mounted component
    // (including ones this session never touches directly) remounts and
    // re-reads through the now-genuinely-real loaders.
    window.location.href = '/home';
  }

  return (
    <div
      className="no-print fixed bottom-[calc(60px+env(safe-area-inset-bottom,0px))] lg:bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-3 py-0 text-center whitespace-nowrap"
      style={{
        zIndex: 9999,
        background: '#7A4A06',
        borderTop: '1px solid rgba(32,25,15,0.15)',
        fontSize: 12,
        boxShadow: '0 -2px 12px rgba(32,25,15,0.18)',
      }}
    >
      <span className="flex items-center gap-1.5 font-display font-semibold" style={{ fontSize: 13, color: '#fff' }}>
        <Sparkles size={14} />
        Sample · fictional
      </span>
      <Link href="/samples" style={{ color: 'white', textDecoration: 'underline', minHeight: 44, display: 'inline-flex', alignItems: 'center' }} aria-label="Switch sample view">Switch</Link>
      <button
        type="button"
        aria-label="Exit sample"
        onClick={handleExit}
        className="flex items-center gap-1 px-3 py-1 rounded-full font-sans font-semibold"
        style={{ fontSize: 12, background: '#fff', color: '#7A4A06', minHeight: 44, border: 'none', cursor: 'pointer' }}
      >
        <X size={13} />
        Exit
      </button>
    </div>
  );
}
