'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { floatingBackAllowed } from '@/lib/back-routes';

/**
 * ONE WAY BACK, ON EVERY PAGE (Rory: "we need a simple go back to the last page button for
 * everything every page").
 *
 * Nine pages already render the shared in-flow BackButton inside their own headers, and the
 * Design Studio has its own arrow built into its title bar. Adding a floating control to every
 * page unconditionally would have put TWO back buttons on those, and — worse — dropped a fixed
 * pill on top of the left-hand tool panel on the map. That is precisely the overlap class that
 * just bit the "Show design" button.
 *
 * So the floating control is the FALLBACK, not the rule: any page that already offers a way back
 * registers itself here, and the floating one then stays out of the way. New pages get a back
 * button for free without anyone remembering to add one.
 */

interface BackRegistry {
  /** Called by an in-flow back control while it is mounted. */
  register: () => () => void;
}

const BackContext = createContext<BackRegistry | null>(null);

/** Registers an in-flow back control so the floating fallback stands down. Safe outside a
 *  provider (returns a no-op), so the shared BackButton keeps working in isolation and tests. */
export function useRegisterBackControl(): void {
  const ctx = useContext(BackContext);
  useEffect(() => {
    if (!ctx) return undefined;
    return ctx.register();
  }, [ctx]);
}


export default function BackControlProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // A count, not a boolean: two in-flow controls unmounting in either order must not leave the
  // registry claiming one is still present.
  const [inFlowCount, setInFlowCount] = useState(0);

  const register = useCallback(() => {
    setInFlowCount((n) => n + 1);
    return () => setInFlowCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo<BackRegistry>(() => ({ register }), [register]);

  const goBack = useCallback(() => {
    // history.length > 1 means there is somewhere to go back TO within this tab. Without the
    // check, a page opened directly from a shared link would fire a back that goes nowhere.
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/home');
  }, [router]);

  const show = inFlowCount === 0 && floatingBackAllowed(pathname);

  return (
    <BackContext.Provider value={value}>
      {children}
      {show && (
        <button
          onClick={goBack}
          aria-label="Go back"
          title="Back"
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            left: 'calc(env(safe-area-inset-left, 0px) + 10px)',
            // Under modals and sheets, above page content: a back button that floats over an open
            // dialog is a way to leave the page mid-decision without answering it.
            zIndex: 40,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            // 44px is the touch-target floor this app holds itself to elsewhere.
            minHeight: 44,
            minWidth: 44,
            justifyContent: 'center',
            padding: '0 12px',
            borderRadius: 999,
            background: '#FFFEFA',
            border: '1px solid #E2D8C4',
            color: '#20190F',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 14px -6px rgba(0,0,0,0.35)',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={16} strokeWidth={2.2} />
          <span>Back</span>
        </button>
      )}
    </BackContext.Provider>
  );
}
