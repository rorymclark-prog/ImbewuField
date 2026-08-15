import { NextRequest, NextResponse } from 'next/server';
import { RESCUE_COOKIE, RESCUE_WINDOW_S, decideDesignRescue } from '@/lib/server-rescue';

// ── Site gate: DISABLED ──────────────────────────────────────────────────────
// The shared-password wall is off — every request passes straight through.
// (Rory asked for it gone during prototyping, 2026-07-03.)
//
// To turn the wall back on, restore the gate body below (git history has the
// full version) so it checks `process.env.SITE_PASSWORD` and the `pm_ok`
// cookie, redirecting misses to `/gate`.

// ── Design-page crash rescue ─────────────────────────────────────────────────
// See lib/server-rescue.ts for the whole argument. Short version: every client-side guard this
// app owns assumes our JavaScript gets to run, and on a phone with nothing left the design page
// dies before it does — 15 August, 08:44, battery at 7%, the same grey iOS screen with every
// guard deployed. Cookies ride with the REQUEST, so the server can count what the phone cannot
// live to report: requests for /design that are never followed by a settled page clearing the
// cookie. At the threshold the answer is a redirect to /design/lite — a few kilobytes with
// nothing left to kill — instead of another copy of the page that is doing the killing.
export function middleware(req: NextRequest) {
  const { pathname, search, searchParams } = req.nextUrl;
  if (pathname !== '/design') return NextResponse.next();

  // Prefetches are the router warming a link the farmer has not tapped. Counting them would
  // charge crashes to pages nobody opened.
  const isPrefetch =
    req.headers.get('next-router-prefetch') !== null ||
    (req.headers.get('purpose') ?? '').includes('prefetch') ||
    (req.headers.get('sec-purpose') ?? '').includes('prefetch');
  if (isPrefetch) return NextResponse.next();

  const decision = decideDesignRescue(req.cookies.get(RESCUE_COOKIE)?.value, searchParams.get('full') === '1');

  if (decision.action === 'redirect') {
    // Keep the coordinates: the lite page's way-back-in links need to name the same farm.
    const lite = new URL(`/design/lite${search}`, req.url);
    return NextResponse.redirect(lite);
  }

  const res = NextResponse.next();
  res.cookies.set(RESCUE_COOKIE, String(decision.nextCount), {
    maxAge: RESCUE_WINDOW_S, // a rolling window — two bad opens this morning do not brand the phone for life
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // the SETTLED page deletes it from document.cookie — that is the whole contract
  });
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
