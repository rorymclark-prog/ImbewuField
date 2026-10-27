import { useEffect, useRef, type RefObject } from 'react';

// Keyboard focus for the custom (non-<dialog>) overlays: move focus in when one opens, keep Tab
// inside it, and hand focus back to whatever opened it. Native <dialog>.showModal() does all of
// this itself; the sheets and drawers built from positioned divs did not. Escape stays with each
// component, which already knows what "close" means for it.

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => !el.hidden && el.getClientRects().length > 0 && !el.closest('[inert]'));
}

// Where Tab/Shift+Tab should go, or null to let the browser move focus on its own. Wraps at either
// end, and pulls focus back in when it has strayed outside the container (or sits on the container
// itself, which is focusable but not part of the list).
export function nextTabTarget<T>(items: T[], active: T | null, shift: boolean, container: T): T | null {
  if (items.length === 0) return container;
  const i = active === null ? -1 : items.indexOf(active);
  if (i === -1) return shift ? items[items.length - 1] : items[0];
  if (shift && i === 0) return items[items.length - 1];
  if (!shift && i === items.length - 1) return items[0];
  return null;
}

interface Options {
  // 'first' (default) focuses the first control — or an element marked data-autofocus. 'container'
  // focuses the container itself, for when the first control would be a destructive action.
  initialFocus?: 'first' | 'container';
}

export function useDialogFocus(open: boolean, ref: RefObject<HTMLElement>, options: Options = {}) {
  const initial = useRef(options.initialFocus);
  initial.current = options.initialFocus;

  useEffect(() => {
    const container = ref.current;
    if (!open || !container) return;
    const opener = document.activeElement as HTMLElement | null;

    if (initial.current === 'container') {
      if (!container.hasAttribute('tabindex')) container.tabIndex = -1;
      container.focus({ preventScroll: true });
    } else {
      const target = container.querySelector<HTMLElement>('[data-autofocus]') ?? focusableIn(container)[0];
      if (target) target.focus({ preventScroll: true });
      else { if (!container.hasAttribute('tabindex')) container.tabIndex = -1; container.focus({ preventScroll: true }); }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      // An overlay opened from inside this one (Settings from the drawer) traps for itself.
      const owner = (e.target as HTMLElement | null)?.closest?.('[aria-modal="true"]');
      if (owner && owner !== container) return;
      const next = nextTabTarget(focusableIn(container), document.activeElement as HTMLElement | null, e.shiftKey, container);
      if (next) { e.preventDefault(); next.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener && opener.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
