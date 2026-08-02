import { NextRequest, NextResponse } from 'next/server';
import { guardPaidApiRequest } from '@/lib/api-auth';

// Polls a fal.ai queue request (used by the gpt-image-2 async path). The client calls this
// every few seconds with the status/response URLs fal handed back at submit time. Each call
// is quick — the slow generation runs on fal — so this never hits Vercel's function timeout.
export const maxDuration = 30;

// SSRF guard: we attach the FAL_KEY to whatever URL we're given, so only allow fal's queue host.
const isFalQueueUrl = (u?: string) => !!u && /^https:\/\/queue\.fal\.run\//.test(u);

export async function POST(req: NextRequest) {
  const auth = await guardPaidApiRequest(req, '/api/ai-render/poll');
  if (auth.response) return auth.response;
  const key = process.env.FAL_KEY;
  if (!key) {
    return NextResponse.json({ error: 'FAL_KEY is not configured on the server.' }, { status: 500 });
  }

  let body: { statusUrl?: string; responseUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const { statusUrl, responseUrl } = body;
  if (!isFalQueueUrl(statusUrl) || !isFalQueueUrl(responseUrl)) {
    return NextResponse.json({ error: 'Invalid or missing fal queue URLs.' }, { status: 400 });
  }

  // 1) Check status
  let statusRes: Response;
  try {
    statusRes = await fetch(statusUrl!, { headers: { Authorization: `Key ${key}` } });
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${String(e)}` }, { status: 502 });
  }
  if (!statusRes.ok) {
    const d = await statusRes.text().catch(() => '');
    return NextResponse.json({ error: `fal status ${statusRes.status}`, detail: d.slice(0, 300) }, { status: 502 });
  }
  const status = (await statusRes.json().catch(() => ({}))) as { status?: string };
  if (status.status !== 'COMPLETED') {
    return NextResponse.json({ pending: true, status: status.status ?? 'IN_PROGRESS' });
  }

  // 2) Fetch the result
  let resultRes: Response;
  try {
    resultRes = await fetch(responseUrl!, { headers: { Authorization: `Key ${key}` } });
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${String(e)}` }, { status: 502 });
  }
  if (!resultRes.ok) {
    const d = await resultRes.text().catch(() => '');
    return NextResponse.json({ error: `fal result ${resultRes.status}`, detail: d.slice(0, 300) }, { status: 502 });
  }
  const result = (await resultRes.json().catch(() => ({}))) as { images?: { url?: string }[] };
  const imgUrl = result.images?.[0]?.url;
  if (!imgUrl) {
    return NextResponse.json({ error: 'fal result had no image.', detail: JSON.stringify(result).slice(0, 300) }, { status: 502 });
  }

  // Only server-fetch fal's own CDN (avoid a second-order SSRF if the result URL is ever
  // tampered/unexpected). Anything else → hand the raw URL to the client to load directly.
  if (!/^https:\/\/([a-z0-9-]+\.)?fal\.(media|run)\//i.test(imgUrl)) {
    return NextResponse.json({ image: imgUrl });
  }

  // 3) Inline as a data URL (taint-free for download/export)
  try {
    const imgRes = await fetch(imgUrl);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const mime = imgRes.headers.get('content-type') ?? 'image/jpeg';
    return NextResponse.json({ image: `data:${mime};base64,${buf.toString('base64')}` });
  } catch {
    return NextResponse.json({ image: imgUrl });
  }
}
