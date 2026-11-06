import { LOCAL_ADVICE_CODES, type LocalAdviceRequestContext } from './local-advice-types';

export const LOCAL_ADVICE_SITE_HOLD = 'Local advice needs a supported saved site and current country details. Sign in, save the site and review its country in the crop planner. Manual maps and records remain available.';
export const LOCAL_ADVICE_BASIS = 'Existing South African references · grower-confirmed country; local agronomy is unverified.';
export const LOCAL_ADVICE_GENERAL_BASIS = 'General app help · saved-site and record context is not attached. Local farming recommendations are unavailable in this mode.';

export interface LocalAdviceClientSnapshot {
  key: string;
  adviceContext: LocalAdviceRequestContext;
}
export type LocalAdviceClientResult =
  | { status: 'stale' }
  | { status: 'error' }
  | { status: 'unavailable'; allowanceMayBeSpent: boolean }
  | { status: 'held'; allowanceMayBeSpent: boolean }
  | { status: 'ready'; text: string };

export function localAdviceHoldMessage(result: { allowanceMayBeSpent: boolean }): string {
  return result.allowanceMayBeSpent
    ? 'The site or country changed before this answer was ready. The answer was withheld; work already done may have used allowance. Review the saved site before trying again.'
    : LOCAL_ADVICE_SITE_HOLD;
}

export function localAdviceUnavailableMessage(result: { allowanceMayBeSpent: boolean }): string {
  return 'The answer could not be completed. Try again explicitly.'
    + (result.allowanceMayBeSpent ? ' Work already done may have used allowance.' : '');
}

/** A late chunk cannot be retracted from a farmer's instructions. Keep the
 * whole answer private until both the server and this captured UI admit it. */
export async function requestLocalAdvice(input: {
  snapshot: LocalAdviceClientSnapshot;
  body: Record<string, unknown>;
  isCurrent: () => boolean;
  headers: () => Promise<Record<string, string>>;
  fetcher: (init: RequestInit) => Promise<Response>;
  signal: AbortSignal;
}): Promise<LocalAdviceClientResult> {
  const current = () => {
    try { return !input.signal.aborted && input.isCurrent(); } catch { return false; }
  };
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    if (!current()) return { status: 'stale' };
    // Freeze before token acquisition; a delayed credential must not select a
    // newer request body while keeping an older country acknowledgement.
    const body = JSON.stringify({ ...input.body, adviceContext: input.snapshot.adviceContext });
    const headers = await input.headers();
    if (!current()) return { status: 'stale' };
    const response = await input.fetcher({ method: 'POST', signal: input.signal,
      headers: { 'Content-Type': 'application/json', ...headers }, body });
    if (!current()) { await response.body?.cancel().catch(() => {}); return { status: 'stale' }; }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      if (!current()) return { status: 'stale' };
      if (data?.code === 'LOCAL_ADVICE_MODEL_UNAVAILABLE') return { status: 'unavailable', allowanceMayBeSpent: data.allowanceMayBeSpent === true };
      return typeof data?.code === 'string' && (Object.values(LOCAL_ADVICE_CODES) as string[]).includes(data.code)
        ? { status: 'held', allowanceMayBeSpent: data.allowanceMayBeSpent === true }
        : { status: 'error' };
    }
    if (!response.body || response.headers.get('X-Imbewu-Advice-Mode') !== input.snapshot.adviceContext.mode) {
      await response.body?.cancel().catch(() => {});
      return current() ? { status: 'error' } : { status: 'stale' };
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const chunk = await reader.read();
      if (!current()) return { status: 'stale' };
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return current() ? { status: 'ready', text } : { status: 'stale' };
  } catch { return current() ? { status: 'error' } : { status: 'stale' }; }
  finally {
    if (reader) {
      try { await reader.cancel(); } catch { /* A closed or failed stream has nothing left to retire. */ }
      reader.releaseLock();
    }
  }
}
