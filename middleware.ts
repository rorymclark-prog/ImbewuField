import { NextResponse } from 'next/server';

// ── Site gate: DISABLED ──────────────────────────────────────────────────────
// The shared-password wall is off — every request passes straight through.
// (Rory asked for it gone during prototyping, 2026-07-03.)
//
// To turn the wall back on, restore the gate body below (git history has the
// full version) so it checks `process.env.SITE_PASSWORD` and the `pm_ok`
// cookie, redirecting misses to `/gate`.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
