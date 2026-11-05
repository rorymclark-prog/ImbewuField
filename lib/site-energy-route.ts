import { authenticateApiRequest, type ApiAuthResult } from './api-auth';
import { checkApiRateLimit } from './api-rate-limit';
import { energyCoordinatesMatch, parsePvgisResponse, pvgisRequestUrl } from './site-energy';

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store', ...extra },
});

export async function handleSiteEnergyRequest(req: Request, dependencies: {
  authenticate?: (req: Request) => Promise<ApiAuthResult>;
  fetch?: typeof fetch;
  rateLimit?: typeof checkApiRateLimit;
  now?: () => Date;
} = {}): Promise<Response> {
  const auth = await (dependencies.authenticate ?? (r => authenticateApiRequest(r, '/api/site-energy')))(req);
  // The legacy auth helper has a soft deployment mode. This new site-linked lookup always
  // requires a verified actor; sample headers and client-supplied IDs cannot establish one.
  if (!auth.uid) return json({ error: 'Sign in to fetch a solar reference for this site.' }, 401);
  if (auth.response) return auth.response;
  const rate = (dependencies.rateLimit ?? checkApiRateLimit)(req, '/api/site-energy', auth.uid);
  if (!rate.verdict.allowed) return json({ error: 'Too many site-data lookups. Please wait before trying again.' }, 429, { 'Retry-After': String(rate.verdict.retryAfterSeconds) });
  let input: Record<string, unknown>;
  try {
    if (Number(req.headers.get('content-length')) > 2048) return json({ error: 'The lookup request is too large.' }, 413);
    // A missing content-length must not bypass the bound.
    const reader = req.body?.getReader();
    if (!reader) return json({ error: 'Choose a site first.' }, 400);
    let bytes = 0, raw = '';
    const decoder = new TextDecoder();
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2048) { await reader.cancel(); return json({ error: 'The lookup request is too large.' }, 413); }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    input = JSON.parse(raw + decoder.decode());
  } catch { return json({ error: 'Choose valid site coordinates.' }, 400); }
  if (!input || typeof input.siteId !== 'string' || !energyCoordinatesMatch(input.siteId, input.lat, input.lon)) return json({ error: 'Site and coordinates do not match. Reopen the selected site.' }, 400);
  try {
    // No arbitrary URL, cookies, account details, site name or saved geometry reach JRC.
    const result = await (dependencies.fetch ?? fetch)(pvgisRequestUrl(input.lat as number, input.lon as number), {
      method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    if (!result.ok) return json({ error: result.status === 400
      ? 'PVGIS has no supported result for this location or configuration. No estimate was substituted.'
      : 'PVGIS is unavailable or busy. Your existing reference has not changed.' }, result.status === 400 ? 422 : 502);
    const reader = result.body?.getReader();
    if (!reader) throw new Error('Missing provider data');
    let raw = '', bytes = 0;
    const decoder = new TextDecoder();
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 64000) { await reader.cancel(); throw new Error('Unexpected provider data size'); }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    const solar = parsePvgisResponse(JSON.parse(raw + decoder.decode()), input.siteId, (dependencies.now ?? (() => new Date()))().toISOString());
    return json({ actorId: auth.uid, siteId: input.siteId, solar });
  } catch { return json({ error: 'The solar reference could not be verified. No estimate was substituted; try again later.' }, 502); }
}
