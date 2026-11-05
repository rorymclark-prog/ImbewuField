'use client';

import { useEffect, useRef, useState } from 'react';
import { checkNwsPublicDemo } from '@/app/international/nws-actions';
import { NWS_REFERENCE_PROVIDER } from '@/lib/international/providers/nws-reference';
import type { NwsPublicDemoFailure, NwsPublicDemoResult } from '@/lib/international/providers/nws-public-demo';

type View = { status: 'idle' | 'loading' } | { status: 'result'; result: NwsPublicDemoResult } | { status: 'error' };
const failureCopy: Record<NwsPublicDemoFailure, string> = {
  'unsupported-demo': 'This public demonstration is unavailable for the requested selection.',
  'invalid-options': 'The public reference request could not be prepared.',
  timeout: 'The public reference request timed out.',
  'network-error': 'The public reference service could not be reached.',
  'rate-limited': 'The National Weather Service rate-limited this request.',
  'http-error': 'The public reference service returned an HTTP error.',
  'malformed-response': 'The response did not match the checked forecast contract. Values are withheld.',
  'response-too-large': 'The response exceeded this demonstration’s software size limit.',
};

/** Public reference delivery only. Mounting the US review never requests data. */
export default function NwsForecastReference() {
  const [view, setView] = useState<View>({ status: 'idle' });
  const currentView = useRef(view); currentView.current = view;
  const mounted = useRef(true), pending = useRef(false), generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; pending.current = false; };
  }, []);
  function publish(next: View) { currentView.current = next; setView(next); }
  async function check() {
    // A retained button belongs to its original displayed state; neither a
    // second click nor a later render can lend it a fresh request authority.
    if (!mounted.current || pending.current || currentView.current !== view) return;
    const turn = ++generation.current; pending.current = true;
    publish({ status: 'loading' });
    try {
      const result = await checkNwsPublicDemo();
      if (mounted.current && generation.current === turn) publish({ status: 'result', result });
    } catch {
      if (mounted.current && generation.current === turn) publish({ status: 'error' });
    } finally { if (generation.current === turn) pending.current = false; }
  }
  const result = view.status === 'result' ? view.result : null;
  return <section lang="en" aria-label="NWS public Washington forecast reference" className="min-w-0 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 [overflow-wrap:anywhere]">
    <h2 className="font-display text-lg font-semibold">Try a public Washington forecast reference</h2>
    <p>This is a coarse public Washington demonstration, not current conditions at your farm or a weather-alert service.</p>
    <p>National Weather Service forecast reference only. These values do not change crop advice, planning dates or country readiness.</p>
    <button type="button" disabled={view.status === 'loading'} onClick={() => void check()}
      className="min-h-11 max-w-full whitespace-normal rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm disabled:opacity-50">
      {view.status === 'loading' ? 'Checking Washington reference…' : 'Check Washington forecast reference'}
    </button>
    <div role="status" aria-live="polite" aria-atomic="true" aria-busy={view.status === 'loading'} className="space-y-3">
      {view.status === 'idle' && <p>No forecast has been requested.</p>}
      {view.status === 'loading' && <p>One bounded public reference request is in progress. No automatic retry.</p>}
      {view.status === 'error' && <p>The reference check could not be completed. No replacement values were supplied. You may check again explicitly.</p>}
      {result?.status === 'failed' && <div className="space-y-2">
        <p>{failureCopy[result.reason]} No automatic retry.</p>
        <p>Request stage: {result.stage}.{result.httpStatus !== undefined && ` HTTP status: ${result.httpStatus}.`}
          {result.retryAfterSeconds !== undefined && result.retryAfterSeconds !== null && ` Reported Retry-After: ${result.retryAfterSeconds} seconds.`}</p>
        {result.provenance.fetchedAt && <p>Response retrieved at: {result.provenance.fetchedAt}</p>}
      </div>}
      {result && result.status !== 'failed' && <div className="min-w-0 space-y-3">
        <h3 className="font-semibold">{result.status === 'partial' ? 'Partial public reference · missing fields remain Unknown' : 'Public forecast reference received'}</h3>
        <p>Demonstration place: {result.provenance.demoPlace}</p>
        <dl className="space-y-1 text-sm">
          <div><dt className="font-semibold">Source generatedAt</dt><dd>{result.metadata.generatedAt}</dd></div>
          <div><dt className="font-semibold">Underlying source updateTime</dt><dd>{result.metadata.updateTime}</dd></div>
          <div><dt className="font-semibold">Source validTimes interval</dt><dd>{result.metadata.validTimes}</dd></div>
          <div><dt className="font-semibold">Response retrieved at</dt><dd>{result.provenance.fetchedAt}</dd></div>
        </dl>
        <p className="text-sm">Source date-time offsets are shown unchanged. Retrieval time does not establish forecast freshness.</p>
        <ol className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {result.periods.map(period => <li key={period.number} className="min-w-0 space-y-2 rounded-xl border border-[var(--border)] p-3">
            <h4 className="font-semibold">Period {period.number}: {period.name ?? 'Unknown'}</h4>
            <dl className="space-y-1 text-sm">
              <div><dt className="font-semibold">Source start</dt><dd>{period.startTime}</dd></div>
              <div><dt className="font-semibold">Source end</dt><dd>{period.endTime}</dd></div>
              <div><dt className="font-semibold">Temperature (°C)</dt><dd>{period.temperatureC === null ? 'Unknown' : `${period.temperatureC} °C`}</dd></div>
              <div><dt className="font-semibold">Precipitation probability (%)</dt><dd>{period.precipitationPercent === null ? 'Unknown' : `${period.precipitationPercent}%`}</dd></div>
            </dl>
            <div><p className="text-sm font-semibold">NWS source summary</p><p>{period.shortForecast ?? 'Unknown'}</p></div>
            <div><p className="text-sm font-semibold">NWS source detail</p><p>{period.detailedForecast ?? 'Unknown'}</p></div>
          </li>)}
        </ol>
      </div>}
    </div>
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <a className="inline-flex min-h-11 items-center underline" href={NWS_REFERENCE_PROVIDER.apiDocsUrl} target="_blank" rel="noreferrer">NWS API documentation</a>
      <a className="inline-flex min-h-11 items-center underline" href={NWS_REFERENCE_PROVIDER.disclaimerUrl} target="_blank" rel="noreferrer">NWS disclaimer</a>
    </p>
  </section>;
}
