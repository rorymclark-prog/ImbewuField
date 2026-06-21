import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }));
  const PW = process.env.SITE_PASSWORD;

  if (PW && password === PW) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('pm_ok', PW, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
