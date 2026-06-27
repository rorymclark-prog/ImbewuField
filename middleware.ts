import { NextRequest, NextResponse } from 'next/server';

// Simple shared-password gate. If SITE_PASSWORD isn't set (e.g. local dev), the gate is off.
export function middleware(req: NextRequest) {
  const PW = process.env.SITE_PASSWORD;
  if (!PW) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Always allow the gate, its API, Next internals, and public branding assets
  // (icon + OG/Twitter image must be reachable so link previews render before login)
  if (
    pathname.startsWith('/gate') || pathname.startsWith('/api/gate') || pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' || pathname === '/manifest.json' || pathname.startsWith('/icon') ||
    pathname.startsWith('/opengraph-image') || pathname.startsWith('/twitter-image') ||
    pathname === '/sync-export'
  ) {
    return NextResponse.next();
  }

  if (req.cookies.get('pm_ok')?.value === PW) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/gate';
  url.search = pathname && pathname !== '/' ? `?from=${encodeURIComponent(pathname)}` : '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
