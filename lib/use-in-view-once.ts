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
export function useInViewOnce<T extends Element>(): { ref: RefObject<T>; phase: InViewPhase } {
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
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, phase };
}
