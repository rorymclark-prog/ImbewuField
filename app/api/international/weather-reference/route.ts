import { guardPaidApiRequest } from '@/lib/api-auth';
import { fetchNwsStationReference, SONOMA_NWS_REFERENCE, type NwsObservationResult } from '@/lib/international/providers/nws-observation';

export const dynamic = 'force-dynamic';

function noStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function resultStatus(result: NwsObservationResult): number {
  if (result.status !== 'failed') return 200;
  if (result.reason === 'unsupported-reference') return 400;
  if (result.reason === 'timeout') return 504;
  // An upstream throttle is a temporarily unavailable service, distinct from
  // the shared guard's 429 for this caller's exhausted app budget.
  if (result.reason === 'rate-limited') return 503;
  return 502;
}

export async function GET(req: Request): Promise<Response> {
  if (req.method !== 'GET') return noStore(Response.json({ error: 'Use GET for a public weather reference.' }, { status: 405, headers: { Allow: 'GET' } }));
  const auth = await guardPaidApiRequest(req, '/api/international/weather-reference');
  if (auth.response) return noStore(auth.response);

  const entries = [...new URL(req.url).searchParams.entries()];
  if (entries.length !== 1 || entries[0][0] !== 'reference' || entries[0][1] !== SONOMA_NWS_REFERENCE.key) {
    return noStore(Response.json({ reason: 'invalid-query', error: 'Choose exactly one supported public weather reference.' }, { status: 400 }));
  }
  const result = await fetchNwsStationReference(SONOMA_NWS_REFERENCE.key, {
    // Both Next's upstream fetch cache and the route response cache must stay
    // out of this request: retrieval time must not disguise app-cached weather.
    fetcher: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
  });
  const headers = new Headers();
  if (result.status === 'failed' && result.reason === 'rate-limited' && result.retryAfterSeconds !== null && result.retryAfterSeconds !== undefined) {
    headers.set('Retry-After', String(result.retryAfterSeconds));
  }
  return noStore(Response.json(result, { status: resultStatus(result), headers }));
}
