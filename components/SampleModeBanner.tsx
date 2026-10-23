'use client';

// The sample indicator lives inside MenuButton. Only pages without a menu need
// this compact fallback; no fixed strip is allowed over page content or modals.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import { useLanguage } from '@/lib/i18n';

export default function SampleModeBanner() {
  const pathname = usePathname() || '';
  const { t } = useLanguage();
  const [active, setActive] = useState(false);
  const [hasMenu, setHasMenu] = useState(true);
  useEffect(() => {
    const applyState = () => {
      const mode = isSampleMode(); setActive(mode);
      document.body.classList.toggle('is-sample-mode', mode);
    };
    applyState(); window.addEventListener(SAMPLE_MODE_EVENT, applyState);
    return () => { window.removeEventListener(SAMPLE_MODE_EVENT, applyState); document.body.classList.remove('is-sample-mode'); };
  }, []);
  useEffect(() => {
    const check = () => setHasMenu(!!document.querySelector('[data-app-menu]'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  // sdesk-09/staff-14: /partners has no MenuButton either (same showcase-page convention as
  // /pitch), so this fixed top-right pill landed on top of that page's own top-right "Get the
  // app" button, in both its desktop header and its phone header. Same fix as /pitch: a public
  // showcase page has nothing to tour anyway, so suppress the pill rather than offset it.
  if (!active || pathname.startsWith('/pitch') || pathname.startsWith('/partners') || hasMenu) return null;
  return <Link className="no-print" href="/samples" aria-label="Tour — choose a view" style={{position:'fixed',top:'calc(env(safe-area-inset-top, 0px) + 8px)',right:12,zIndex:40,minHeight:44,display:'inline-flex',alignItems:'center',padding:'0 12px',borderRadius:24,background:'var(--bg-1)',border:'1px solid var(--border)',color:'var(--color-harvest)',fontSize:12,fontWeight:700}}>{t('tourPill')}</Link>;
}
