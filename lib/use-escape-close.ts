import { useEffect, useRef } from 'react';

// Escape closes an overlay. The listener reads onClose through a ref instead of listing it as a
// dependency: a parent that passes a fresh arrow each render, and has its own Escape listener
// registered earlier (/farmer does), re-renders during the same keydown. React flushes that render
// between listeners, an effect keyed on onClose swaps this listener for a new copy, and the browser
// never calls a listener removed mid-dispatch, so Escape silently did nothing (w28-06).
export function useEscapeClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}
