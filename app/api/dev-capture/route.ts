import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * DEV-ONLY sheet capture: the browser posts a rendered plan sheet, this writes it to disk.
 *
 * WHY IT EXISTS. Verifying a plan sheet means LOOKING at it, and the loop for that was expensive
 * in a way that limited how many sheets got checked: the image had to be carried out of the page
 * by hand, in pieces, before anyone could see it. This lets the render→look→fix→re-render loop run
 * across all nine sheets as often as needed, which is the only way defects like a legend at the
 * wrong size or a polygon on the wrong sheet get caught before a farmer finds them.
 *
 * DISABLED IN PRODUCTION, and not by an env flag that could be set wrong. `next build` sets
 * NODE_ENV to 'production' for the deployed bundle, so the guard below cannot be switched on by
 * configuration — a deployed instance answers 404 and never touches its filesystem. This route
 * takes a body and writes a file, so it is exactly the shape of thing that must not be reachable
 * from the internet.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAPTURE_DIR = path.join(process.cwd(), '.sheet-captures');
/** Plain file stems only — no separators, no dots, no traversal. */
const SAFE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }
  let body: { name?: unknown; dataUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name : '';
  const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
  if (!SAFE_NAME.test(name)) {
    return NextResponse.json({ error: 'name must match /^[a-z0-9][a-z0-9-]{0,63}$/' }, { status: 400 });
  }
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    return NextResponse.json({ error: 'dataUrl must be a base64 png or jpeg data URL.' }, { status: 400 });
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Capture too large.' }, { status: 413 });
  }
  const file = path.join(CAPTURE_DIR, `${name}.${match[1] === 'png' ? 'png' : 'jpg'}`);
  await mkdir(CAPTURE_DIR, { recursive: true });
  await writeFile(file, buffer);
  return NextResponse.json({ written: file, bytes: buffer.byteLength });
}
