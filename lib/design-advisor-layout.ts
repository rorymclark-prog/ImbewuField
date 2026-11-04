import type { CSSProperties } from 'react';

export type AdvisorLayoutRect = Pick<DOMRectReadOnly, 'top' | 'bottom' | 'left' | 'right'>;
export interface AdvisorVisibleRegion {
  topInset: number;
  bottomInset: number;
  availableHeight: number;
}

function validRect(rect: AdvisorLayoutRect): boolean {
  return [rect.top, rect.bottom, rect.left, rect.right].every(Number.isFinite)
    && rect.bottom >= rect.top && rect.right >= rect.left;
}

/** The fixed phone sheet does not participate in the canvas flex layout. Reserve
 * only its intersection with the visible canvas; never resize the measured plan
 * or assume that a palette cap equals its actual occupied height. */
export function visibleAdvisorRegion(
  canvas: AdvisorLayoutRect, sheet: AdvisorLayoutRect | null, viewport: AdvisorLayoutRect,
): AdvisorVisibleRegion | null {
  if (!validRect(canvas) || !validRect(viewport) || sheet && !validRect(sheet)) return null;
  const left = Math.max(canvas.left, viewport.left), right = Math.min(canvas.right, viewport.right);
  const top = Math.max(canvas.top, viewport.top), visibleBottom = Math.min(canvas.bottom, viewport.bottom);
  if (right <= left || visibleBottom <= top) return null;
  const overlaps = sheet && sheet.bottom > sheet.top && sheet.right > sheet.left && sheet.right > left && sheet.left < right
    && sheet.bottom > top && sheet.top < visibleBottom;
  const bottom = overlaps ? Math.max(top, Math.min(visibleBottom, sheet.top)) : visibleBottom;
  return { topInset: top - canvas.top, bottomInset: canvas.bottom - bottom, availableHeight: bottom - top };
}

/** This wrapper is paint chrome inside the existing canvas. A short visible
 * region clips its own scrollable advisor rather than placing it over tools. */
export function advisorRegionPresentation(phone: boolean, region: AdvisorVisibleRegion | null): CSSProperties {
  return { position: 'absolute', left: 0, right: 0, top: phone ? region?.topInset ?? 0 : 0,
    bottom: phone ? region?.bottomInset ?? 0 : 0, pointerEvents: 'none',
    ...(phone ? { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start',
      overflow: 'hidden', visibility: region && region.availableHeight > 0 ? 'visible' : 'hidden' } : {}) };
}

export type AdvisorLayoutHost = Pick<Window, 'innerHeight' | 'innerWidth' | 'visualViewport' | 'addEventListener' | 'removeEventListener'>
  & { ResizeObserver?: typeof ResizeObserver };

/** Measure the mounted phone sheet and real canvas together. Captured scroll
 * also follows the Water page's own scroll container, not just window scrolling. */
export function observeDesignAdvisorLayout(input: {
  canvas: HTMLElement;
  sheet: HTMLElement | null;
  onChange: (region: AdvisorVisibleRegion | null) => void;
  host?: AdvisorLayoutHost;
}): () => void {
  const host = input.host ?? window;
  const visualViewport = host.visualViewport;
  let active = true;
  const measure = () => {
    if (!active) return;
    if (!input.canvas.isConnected) { input.onChange(null); return; }
    try {
      const viewport = host.visualViewport;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      input.onChange(visibleAdvisorRegion(input.canvas.getBoundingClientRect(),
        input.sheet?.isConnected ? input.sheet.getBoundingClientRect() : null,
        { left, top, right: left + (viewport?.width ?? host.innerWidth), bottom: top + (viewport?.height ?? host.innerHeight) }));
    } catch { input.onChange(null); }
  };
  const observer = host.ResizeObserver ? new host.ResizeObserver(measure) : null;
  observer?.observe(input.canvas);
  if (input.sheet) observer?.observe(input.sheet);
  host.addEventListener('resize', measure);
  host.addEventListener('scroll', measure, true);
  visualViewport?.addEventListener('resize', measure);
  visualViewport?.addEventListener('scroll', measure);
  measure();
  return () => {
    active = false;
    observer?.disconnect();
    host.removeEventListener('resize', measure);
    host.removeEventListener('scroll', measure, true);
    visualViewport?.removeEventListener('resize', measure);
    visualViewport?.removeEventListener('scroll', measure);
  };
}
