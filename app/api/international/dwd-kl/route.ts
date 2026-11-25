import { loadDwdKlRecentObservations } from '@/lib/international/providers/dwd-kl-http';

export const runtime = 'nodejs';

/** The endpoint reads a single public archive, with no farm or account payload. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const stationId = params.get('stationId');
  const firstDay = params.get('firstDay');
  const lastDay = params.get('lastDay');
  const result = params.size === 3 && stationId && firstDay && lastDay
    ? await loadDwdKlRecentObservations({ stationId, firstDay, lastDay }, request.signal)
    : { status: 'held', reason: 'invalid-selection' } as const;
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
