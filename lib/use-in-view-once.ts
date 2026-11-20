'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** 'final': show the finished state (server render, no JS, reduced motion, already seen).
 *  'armed': mounted and waiting to scroll into view, show the pre-animation state.
 *  'play': came into view, run the animation once. */
export type InViewPhase = 'final' | 'armed' | 'play';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Fires once when the element first scrolls into view. Server render and the first client render
 *  report 'final', so nothing flashes empty; the animation starts only after mount. */
export type InViewOptions = { threshold?: number; rootMargin?: string };

/** Tall elements (taller than about 80% of the viewport) can never reach a 0.2 threshold on a phone,
 *  so pass { threshold: 0, rootMargin: '0px 0px -25% 0px' } for those. */
export function useInViewOnce<T extends Element>(
  options: InViewOptions = {},
): { ref: RefObject<T>; phase: InViewPhase } {
  const threshold = options.threshold ?? 0.2;
  const rootMargin = options.rootMargin ?? '0px';
  const ref = useRef<T>(null);
  const [phase, setPhase] = useState<InViewPhase>('final');

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
    setPhase('armed');
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setPhase('play');
        io.disconnect();
      }
    }, { threshold, rootMargin });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, phase };
}
