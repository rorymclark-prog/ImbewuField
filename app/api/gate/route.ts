import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { RateLimiter, clientIp } from '@/lib/api-rate-limit';

// This route is reachable only if SITE_PASSWORD is set AND something redirects to /gate — and as
// of middleware.ts (the site gate was switched off there on 2026-07-03), nothing in this codebase
// does either. It is hardened rather than removed anyway: it is one string compare and one cookie
// set away from being a working password check the moment someone flips the switch back on, and a
// brute-force guesser doesn't care whether the door is currently bolted from the other side.
const limiter = new RateLimiter(500);
// A person typing a password gets it wrong at most a handful of times; a script guessing it wants
// thousands of tries. Ten attempts per ten minutes per address survives every real mis-type and
// costs a brute-force guesser dearly — the same shape of ceiling app/api/build-info/route.ts uses
// against a runaway client, sized down because this route's whole job is defending a secret.
const BUDGET = { limit: 10, windowMs: 10 * 60 * 1000 };

/**
 * `===` on the raw strings would leak the password one byte at a time: a guess that matches the
 * first three characters returns a hair faster than one that matches none, and that difference is
 * measurable over enough attempts. `timingSafeEqual` requires equal-length buffers, so a
 * short-circuit on length would reintroduce exactly the leak it exists to close — comparing the
 * guess against a same-length zero buffer keeps a wrong-length guess costing the same time as a
 * right-length, wrong-content one.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const decision = limiter.check(clientIp(req), BUDGET);
  if (!decision.allowed) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { 'Retry-After': String(decision.retryAfterSeconds) } },
    );
  }

  const { password } = await req.json().catch(() => ({ password: '' }));
  const PW = process.env.SITE_PASSWORD;
  const guess = typeof password === 'string' ? password : '';

  if (PW && constantTimeEqual(guess, PW)) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('pm_ok', PW, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
