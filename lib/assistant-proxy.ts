// One fixed backend target; a caller can never turn this into a URL-fetch proxy.
export async function assistantProxy(req: Request, path: string): Promise<Response> {
  if (!/^[a-z-]+(?:\/[A-Za-z0-9_-]+)?$/.test(path)) return Response.json({ error: 'Unknown connector route.' }, { status: 404 });
  const upstream = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === '1'
    ? new URL(process.env.ASSISTANT_EMULATOR_ORIGIN ?? 'http://127.0.0.1:5001/fieldproof-sa/europe-west1/imbewuConnector')
    : new URL('https://europe-west1-fieldproof-sa.cloudfunctions.net/imbewuConnector');
  // NextRequest normalises loopback hosts even inside query values. OAuth must
  // preserve the registered callback, so read the underlying web Request URL.
  const input = new URL(Reflect.get(Request.prototype, 'url', req));
  for (const [key, value] of input.searchParams) if (key !== 'connector_path') upstream.searchParams.append(key, value);
  upstream.searchParams.set('connector_path', `/${path}`);
  const headers = new Headers();
  for (const name of ['authorization', 'content-type', 'accept', 'origin', 'mcp-protocol-version', 'mcp-session-id']) {
    const value = req.headers.get(name); if (value) headers.set(name, value);
  }
  // Raw media transfers use the backend's bounded binary endpoint, avoiding Vercel's body cap.
  let body: ArrayBuffer | undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = await req.arrayBuffer();
    if (body.byteLength > 512 * 1024) return Response.json({ error: 'Use the original-file upload URL for media.' }, { status: 413 });
  }
  try {
    const response = await fetch(upstream, { method: req.method, headers, ...(body ? { body } : {}), redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(110_000) });
    const output = new Headers({ 'Cache-Control': 'private, no-store' });
    for (const name of ['content-type', 'location', 'www-authenticate', 'allow', 'retry-after', 'mcp-session-id', 'access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers', 'access-control-expose-headers', 'vary']) {
      const value = response.headers.get(name); if (value) output.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers: output });
  } catch { return Response.json({ error: 'The ImbewuField connector is unavailable. Your operation is not confirmed.' }, { status: 503 }); }
}
