import type { WizardStep } from './design-canvas';
import { designAdviceSourceFingerprint } from './design-advice-source';

export interface DesignAdviceClientSnapshot {
  key: string;
  mode: 'personal-site' | 'original-demo-reference';
  siteId: string;
  currentStep: WizardStep;
  countryFingerprint: string;
  raw: unknown;
}
export type DesignAdviceClientResult =
  | { status: 'stale' }
  | { status: 'error'; error?: string }
  | { status: 'ready'; suggestions: string[] };

/** Every await can outlive the account, country confirmation or displayed
 * geometry that started it. An obsolete request may never become a new tip. */
export async function requestDesignAdvice(input: {
  snapshot: DesignAdviceClientSnapshot;
  isCurrent: () => boolean;
  headers: () => Promise<Record<string, string>>;
  fetcher: (init: RequestInit) => Promise<Response>;
  signal: AbortSignal;
}): Promise<DesignAdviceClientResult> {
  const { snapshot, signal } = input;
  const current = () => {
    try { return !signal.aborted && input.isCurrent(); } catch { return false; }
  };
  try {
    if (!current()) return { status: 'stale' };
    const sourceFingerprint = await designAdviceSourceFingerprint(snapshot.raw, snapshot.siteId);
    if (!current()) return { status: 'stale' };
    if (!sourceFingerprint) return { status: 'error' };
    const headers = await input.headers();
    if (!current()) return { status: 'stale' };
    const response = await input.fetcher({ method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ mode: snapshot.mode, siteId: snapshot.siteId, currentStep: snapshot.currentStep,
        sourceFingerprint, countryFingerprint: snapshot.countryFingerprint }),
    });
    if (!current()) return { status: 'stale' };
    const data = await response.json().catch(() => null);
    if (!current()) return { status: 'stale' };
    if (!response.ok) return { status: 'error', error: (response.status === 429 || typeof data?.code === 'string' && data.code.startsWith('ADVICE_'))
      && typeof data?.error === 'string' ? data.error : undefined };
    if (data?.mode !== snapshot.mode || data?.siteId !== snapshot.siteId || data?.currentStep !== snapshot.currentStep
      || data?.countryFingerprint !== snapshot.countryFingerprint || typeof data?.sourceFingerprint !== 'string'
      || !/^[a-f0-9]{64}$/.test(data.sourceFingerprint)
      || (snapshot.mode === 'personal-site' && data.sourceFingerprint !== sourceFingerprint)
      || !Array.isArray(data?.suggestions)) return { status: 'error' };
    return { status: 'ready', suggestions: data.suggestions.filter((value: unknown): value is string => typeof value === 'string')
      .map((value: string) => value.trim()).filter(Boolean).slice(0, 3) };
  } catch { return current() ? { status: 'error' } : { status: 'stale' }; }
}
