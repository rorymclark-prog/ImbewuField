'use client';

import { useEffect, useRef, useState } from 'react';
import { checkEaRainfallPublicDemo } from '@/app/international/ea-rainfall-actions';
import { EA_RAINFALL_REFERENCE_PROVIDER } from '@/lib/international/providers/ea-rainfall-reference';
import type { EaRainfallPublicDemoResult } from '@/lib/international/providers/ea-rainfall-public-demo';
import styles from './CountryReview.module.css';

type View = { status: 'idle' | 'loading' } | { status: 'result'; result: EaRainfallPublicDemoResult } | { status: 'error' };
const failureCopy: Readonly<Record<string, string>> = {
  'unsupported-demo': 'This public network demonstration is unavailable for that selection.',
  'invalid-options': 'The reference request could not be prepared.',
  timeout: 'The public rainfall reference request timed out.',
  'network-error': 'The public rainfall reference service could not be reached.',
  'rate-limited': 'The public rainfall reference service rate-limited this request.',
  'http-error': 'The public rainfall reference service returned an HTTP error.',
  'malformed-response': 'The response did not match the checked rainfall reference contract. Values are withheld.',
  'response-too-large': 'The response exceeded this demonstration’s software size limit.',
  'invalid-provenance': 'The retrieval receipt could not be checked. Values are withheld.',
  'unsupported-measurement': 'The response did not supply the required accumulated rainfall measurement. Values are withheld.',
};
const external = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' } as const;
const link = `${styles.link} inline-flex min-h-11 max-w-full items-center whitespace-normal`;

/** One explicit public network request, never a farm or planner measurement. */
export default function EaRainfallReference() {
  const [view, setView] = useState<View>({ status: 'idle' });
  const liveView = useRef(view); liveView.current = view;
  const active = useRef(true), pending = useRef(false), generation = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; pending.current = false; generation.current++; };
  }, []);
  function publish(next: View) { liveView.current = next; setView(next); }
  async function check() {
    if (!active.current || pending.current || liveView.current !== view) return;
    const turn = ++generation.current; pending.current = true; publish({ status: 'loading' });
    try {
      const result = await checkEaRainfallPublicDemo();
      if (active.current && generation.current === turn) publish({ status: 'result', result });
    } catch {
      if (active.current && generation.current === turn) publish({ status: 'error' });
    } finally { if (generation.current === turn) pending.current = false; }
  }
  const result = view.status === 'result' ? view.result : null;
  const reading = result && (result.status === 'available' || result.status === 'partial') ? result.reading : null;
  return <section lang="en" aria-label="Environment Agency public rainfall network reference" className={`${styles.card} min-w-0 [overflow-wrap:anywhere]`}>
    <p className={styles.eyebrow}>English prototype · public network reference</p>
    <h2>Try an Environment Agency rainfall network sample</h2>
    <p>A public network sample, not a reading for your farm. Latest available data can be delayed by telemetry transfer.</p>
    <button type="button" className={`${styles.button} min-h-11 max-w-full whitespace-normal`} disabled={view.status === 'loading'} onClick={() => void check()}>
      {view.status === 'loading' ? 'Checking public rainfall reference…' : 'Check public rainfall reference'}
    </button>
    <div role="status" aria-live="polite" aria-atomic="true" aria-busy={view.status === 'loading'} className={`${styles.result} min-w-0 space-y-3`}>
      {view.status === 'idle' && <p>No rainfall reference has been requested.</p>}
      {view.status === 'loading' && <p>One bounded public request is in progress. No automatic retry.</p>}
      {view.status === 'error' && <p>The public reference check could not be completed. No replacement values were supplied. Check again explicitly if needed.</p>}
      {result?.status === 'failed' && <p>{Object.hasOwn(failureCopy, result.reason) ? failureCopy[result.reason] : 'The public reference could not be checked. No replacement rainfall values were supplied.'} No automatic retry.</p>}
      {result?.status === 'unavailable' && <p>No reading was returned in this bounded network sample. Missing is not zero rainfall.</p>}
      {reading && <>
        <h3>{result?.status === 'partial' ? 'Partial network reference · missing fields remain Unknown' : 'Latest-available network reference received'}</h3>
        <dl className="min-w-0 space-y-2">
          <div><dt className="font-semibold">Accumulated rainfall total · {reading.periodSeconds} seconds</dt><dd>{reading.rainfallMm === null ? 'Unknown' : `${reading.rainfallMm} ${reading.units}`}</dd></div>
          <div><dt className="font-semibold">Source-reported time · unverified text</dt><dd>{reading.reportedAt ?? 'Unknown'}</dd></div>
        </dl>
        <p className={styles.secondary}>The source time is retained as reported, not independently verified as a timestamp. Whether it marks the accumulation’s start or end is unknown.</p>
      </>}
      {result && <p className={styles.secondary}>Response retrieved at: {result.provenance.fetchedAt ?? 'Unknown'}. Retrieval does not establish measurement freshness.</p>}
    </div>
    <p className={styles.secondary}>{EA_RAINFALL_REFERENCE_PROVIDER.attribution}</p>
    <p className="flex min-w-0 flex-wrap gap-x-4 gap-y-1">
      <a {...external} href={EA_RAINFALL_REFERENCE_PROVIDER.docsUrl} className={link}>Official rainfall documentation ↗</a>
      <a {...external} href={EA_RAINFALL_REFERENCE_PROVIDER.referenceUrl} className={link}>Official API reference ↗</a>
      <a {...external} href={EA_RAINFALL_REFERENCE_PROVIDER.licenceUrl} className={link}>Open Government Licence ↗</a>
    </p>
    <details className={styles.details}>
      <summary className="min-h-11 cursor-pointer">Source review details</summary>
      <dl className="min-w-0 space-y-2">
        <div><dt className="font-semibold">Coverage</dt><dd>{EA_RAINFALL_REFERENCE_PROVIDER.coverage}</dd></div>
        <div><dt className="font-semibold">Transfer and latest-available meaning</dt><dd>{EA_RAINFALL_REFERENCE_PROVIDER.cadence}</dd></div>
        <div><dt className="font-semibold">Quality status</dt><dd>Unknown</dd></div>
        <div><dt className="font-semibold">Accumulation time boundaries</dt><dd>Unknown</dd></div>
        <div><dt className="font-semibold">Currentness</dt><dd>Not assessed</dd></div>
        <div><dt className="font-semibold">Sample completeness</dt><dd>One bounded network item; complete coverage is not established.</dd></div>
        <div><dt className="font-semibold">Source inspected on</dt><dd>{EA_RAINFALL_REFERENCE_PROVIDER.inspectedOn}</dd></div>
        <div><dt className="font-semibold">Reuse basis</dt><dd>{EA_RAINFALL_REFERENCE_PROVIDER.licence}</dd></div>
      </dl>
      <p className={styles.secondary}>The GB workspace hosts this network example; it does not establish national or nearest-farm coverage. No source or receipt dates are converted or compared here. This result does not update saved sites, country readiness or crop-planning advice.</p>
    </details>
  </section>;
}
