import type { CSSProperties } from 'react';

/**
 * The 52px top bar shared by the role and study pages.
 *
 * WHY THE INSET IS NOT OPTIONAL. app/layout.tsx sets `viewportFit: 'cover'`, which is what stops
 * content being cut off at the BOTTOM of the screen — but it is a two-part bargain: once the
 * viewport meta says viewport-fit=cover the page paints edge to edge, and every fixed edge becomes
 * the app's problem. A header pinned at y=0 then sits UNDERNEATH the status bar, so on a phone the
 * clock, signal and battery land on top of the Back button and the page title. Rory hit this on My
 * Studies: the hamburger was half covered, "Back" read as "ack", and the clock sat over the course
 * name. It was never a study-page bug — all seven pages sharing this bar had it, and only a device
 * that reports a status-bar inset shows it, which is why desktop review never caught it.
 *
 * The bottom half of the bargain WAS paid: `.workspace-main` in globals.css already pads itself by
 * env(safe-area-inset-bottom). Only the top was missed.
 *
 * The height grows by the inset rather than the padding eating into it, because Tailwind's
 * preflight sets `border-box` globally: under border-box, padding alone would keep the bar 52px
 * tall and simply squash its contents, which looks like a different bug and fixes nothing. Growing
 * the height and pushing the content down by the same amount keeps the content box exactly 52px.
 *
 * With no inset both calc()s collapse to today's values, so nothing moves on desktop.
 *
 * NOTE: below 650px globals.css overrides this bar's height and padding with !important (to keep
 * one compact layout on every phone). That rule carries the same formula — change both together.
 */
export const APP_HEADER_STYLE: CSSProperties = {
  height: 'calc(52px + env(safe-area-inset-top, 0px))',
  paddingTop: 'env(safe-area-inset-top, 0px)',
  background: '#FFFEFA',
  borderBottom: '1px solid #E2D8C4',
};
