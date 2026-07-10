import { NextRequest, NextResponse } from 'next/server';

// Simple shared-password gate. If SITE_PASSWORD isn't set, the gate is OFF and
// everything is reachable — set SITE_PASSWORD in the environment to switch the
// wall back on (no code change needed). This fails OPEN by design: a blank
// password must not lock the whole site out.
export function middleware(req: NextRequest) {
  const PW = process.env.SITE_PASSWORD;
  if (!PW) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Always allow the gate, its API, Next internals, and public branding assets
  // (icon + OG/Twitter image must be reachable so link previews render before login)
  if (
    pathname.startsWith('/gate') || pathname.startsWith('/api/gate') || pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' || pathname === '/manifest.json' || pathname.startsWith('/icon') ||
    pathname.startsWith('/opengraph-image') || pathname.startsWith('/twitter-image')
  ) {
    return NextResponse.next();
  }

  if (PW && req.cookies.get('pm_ok')?.value === PW) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/gate';
  url.search = pathname && pathname !== '/' ? `?from=${encodeURIComponent(pathname)}` : '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
