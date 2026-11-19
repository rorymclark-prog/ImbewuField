import {
  ecccDailyObservationUrl, ECCC_DAILY_RESPONSE_LIMIT, parseEcccDailyObservations,
  type EcccDailyObservations, type EcccDailySelection,
} from './eccc-daily-observations.ts';

export type EcccDailyLoad = EcccDailyObservations | {
  readonly status: 'held';
  readonly reason: 'unavailable' | 'rate-limited' | 'cancelled';
};

/** The caller selects a public station, never a farm position or an arbitrary URL. */
export async function loadEcccDailyObservations(selection: EcccDailySelection, signal: AbortSignal): Promise<EcccDailyLoad> {
  const chosen = { ...selection };
  const url = ecccDailyObservationUrl(chosen);
  if (!url || chosen.lastLocalDay > new Date().toISOString().slice(0, 10)) return { status: 'held', reason: 'invalid-selection' };
  if (signal.aborted) return { status: 'held', reason: 'cancelled' };

  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error', credentials: 'omit',
      referrerPolicy: 'no-referrer', cache: 'no-store', headers: { Accept: 'application/geo+json, application/json' } });
    if (response.status === 429) return { status: 'held', reason: 'rate-limited' };
    if (!response.ok) return { status: 'held', reason: 'unavailable' };
    const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (response.redirected || response.url !== url || !response.body
      || (mime !== 'application/json' && mime !== 'application/geo+json')
      || Number(response.headers.get('content-length')) > ECCC_DAILY_RESPONSE_LIMIT) {
      return { status: 'held', reason: 'invalid-response' };
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let body = '';
    try {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        bytes += chunk.value.byteLength;
        if (bytes > ECCC_DAILY_RESPONSE_LIMIT) return { status: 'held', reason: 'invalid-response' };
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
    } catch {
      return { status: 'held', reason: controller.signal.aborted ? signal.aborted ? 'cancelled' : 'unavailable' : 'invalid-response' };
    } finally {
      reader.releaseLock();
    }
    if (controller.signal.aborted) return { status: 'held', reason: signal.aborted ? 'cancelled' : 'unavailable' };
    return parseEcccDailyObservations(body, chosen, { url, retrievedAt: new Date().toISOString(), temperatureUnit: 'celsius' });
  } catch {
    return { status: 'held', reason: signal.aborted ? 'cancelled' : 'unavailable' };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    controller.abort();
  }
}
