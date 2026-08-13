// WHEN A SHEET IS UP, THE FLOATING BUTTON GETS OUT OF THE WAY.
//
// Lima's launcher (components/ChatWidget.tsx) is mounted globally by app/layout.tsx at z-60.
// Every bottom sheet in the app sits below that, so the FAB floats on top of whatever sheet is
// open — on 13 August it was sitting on the "Tree" row of the Add catalogue, which is a row a
// farmer is meant to be able to press.
//
// The widget already had exactly one escape hatch for exactly this problem: the map broadcasts
// `imbewu-drawing` while a boundary is being traced, because the draw bar owns the bottom strip.
// This is the same idea generalised, so the next screen that opens a sheet does not have to
// rediscover it — and the event name lives in one place rather than being retyped as a string
// literal at both ends, which is how `imbewu-drawing` came to be spelled out twice.
//
// Deliberately a window event rather than context: ChatWidget is mounted in the root layout,
// above every page, so there is no provider a page could reach without restructuring the tree.

export const OVERLAY_EVENT = 'imbewu-overlay-open';

/** Tell the global chrome that a modal or sheet is covering the screen (or is no longer). */
export function announceOverlay(open: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<boolean>(OVERLAY_EVENT, { detail: open }));
}

/** Listen for that. Returns an unsubscribe. */
export function listenForOverlay(onChange: (open: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => onChange(!!(e as CustomEvent).detail);
  window.addEventListener(OVERLAY_EVENT, handler);
  return () => window.removeEventListener(OVERLAY_EVENT, handler);
}
