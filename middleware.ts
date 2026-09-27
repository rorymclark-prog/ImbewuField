import { NextResponse } from 'next/server';

// ── Site gate: DISABLED ──────────────────────────────────────────────────────
// The shared-password wall is off — every request passes straight through.
// (Rory asked for it gone during prototyping, 2026-07-03.)
//
// The /gate page and /api/gate route were deleted on 2026-09-26 (Rory: "yes
// delete the gate"). Restoring the wall means restoring all three from git
// history — this body, app/gate/page.tsx and app/api/gate/route.ts (the last
// version rate-limited guesses and compared in constant time).

// ── Design/farmer crash rescue: DISABLED ─────────────────────────────────────
// The server-side crash rescue (count page opens in a cookie, redirect a crash
// loop to /design/lite before iOS's grey terminal screen) is off. It shipped on
// 15 August and worked — but at a redirect threshold of one it also fired on
// healthy machines: any open not followed by a settled page within the window
// (a quick refresh, a navigation mid-load) sent the NEXT open to the lite page.
// Rory, same morning, from his laptop: "disable this now its interfering with
// my laptop use too" — and, on the approach itself: "i want a comprehensive
// fix... i dont want any light page fix". The comprehensive fix is the design
// page going on a bundle/memory diet so it simply does not crash.
//
// lib/server-rescue.ts (the decision logic and its tests) and /design/lite are
// kept: the lite page is reachable by URL, harmless, and the logic is tested,
// so restoring the net — e.g. phone-only via User-Agent — is a small, deliberate
// change (git history of this file has the full wiring).
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
