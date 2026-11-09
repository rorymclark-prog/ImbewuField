'use client';

import { useEffect, useRef, useState } from 'react';
import NwsForecastValues from './NwsForecastValues';
import { checkNwsPointReference } from '@/app/international/nws-actions';
import { NWS_REFERENCE_PROVIDER } from '@/lib/international/providers/nws-reference';
import type { NwsPointResult } from '@/lib/international/providers/nws-public-demo';
import { canonicalCoordinateSiteId, coordinateSiteIdParts } from '@/lib/site-id';
import { loadPlaces } from '@/lib/saved-places';
import { isSampleMode } from '@/lib/sample-mode';
import { coordinateSiteIdForPlace, normaliseSiteCountryContext, placeRevision,
  resolveSiteCountryContext, type SiteContextResolution } from '@/lib/international/site-context';
import { captureWeatherReferenceContext, weatherReferenceContextIsCurrent,
  subscribeWeatherReferenceContext, revokeWeatherReferenceContext, type WeatherReferenceContext } from '@/lib/length-unit-preference';

interface Props { siteId: string | null; resolution: SiteContextResolution }
type Point = { latitude4: string; longitude4: string };
type View = { status: 'idle' | 'loading' | 'error' } | { status: 'result'; result: NwsPointResult };
interface RequestOwner {
  lifecycle: object; binding: object; receipt: string; point: Point; sample: boolean;
  proof: WeatherReferenceContext; pending: boolean; stop: () => void;
}

// Keep complete saved identity private. A four-decimal request point can collide
// across two distinct five-decimal sites and cannot authorize either one's UI.
function savedReceipt(siteId: string | null, displayed: SiteContextResolution): string | null {
  try {
    const canonical = canonicalCoordinateSiteId(siteId);
    if (!canonical || canonical !== siteId || displayed.siteId !== siteId || displayed.status !== 'confirmed'
      || displayed.context?.countryCode !== 'US' || displayed.context.siteId !== siteId) return null;
    const places = loadPlaces(), fresh = resolveSiteCountryContext(places, canonical);
    if (fresh.status !== 'confirmed' || fresh.context?.countryCode !== 'US' || fresh.context.siteId !== siteId
      || JSON.stringify(normaliseSiteCountryContext(displayed.context)) !== JSON.stringify(fresh.context)
      || JSON.stringify([...displayed.placeIds].sort()) !== JSON.stringify([...fresh.placeIds].sort())) return null;
    const aliases = places.filter(place => coordinateSiteIdForPlace(place) === canonical)
      .map(place => ({ id: place.id, lat: place.lat, lon: place.lon, revision: placeRevision(place), savedAt: place.savedAt,
        context: normaliseSiteCountryContext(place.siteCountryContext) }))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return JSON.stringify({ siteId: canonical, aliases });
  } catch { return null; }
}

const failureCopy: Record<string, string> = {
  'invalid-point': 'The saved point could not be prepared for this reference.',
  'unsupported-demo': 'This reference selection is unavailable.',
  'invalid-options': 'The reference request could not be prepared.',
  timeout: 'The reference request timed out.',
  'network-error': 'The public reference service could not be reached.',
  'rate-limited': 'The National Weather Service rate-limited this request.',
  'http-error': 'The public reference service returned an HTTP error.',
  'malformed-response': 'The response did not match the checked forecast contract. Values are withheld.',
  'response-too-large': 'The response exceeded the software size limit.',
};

/** Explicit point disclosure and request, independent of the public Washington demo. */
export default function SavedSiteNwsReference({ siteId, resolution }: Props) {
  const [view, setView] = useState<View>({ status: 'idle' });
  const [sampleLabel, setSampleLabel] = useState(false);
  const lifecycle = useRef<object | null>(null), request = useRef<RequestOwner | null>(null);
  const rendered = useRef<object | null>(null);
  const propKey = JSON.stringify({ siteId, resolution });
  const binding = useRef({ key: propKey, identity: {} });
  if (binding.current.key !== propKey) binding.current = { key: propKey, identity: {} };
  const currentBinding = binding.current.identity, currentLifecycle = lifecycle.current;
  const handler = {}; rendered.current = handler;
  const viewBinding = useRef(currentBinding);
  const visible = viewBinding.current === currentBinding ? view : { status: 'idle' as const };

  function publish(next: View) { rendered.current = null; viewBinding.current = binding.current.identity; setView(next); }
  function release(owner: RequestOwner) {
    owner.stop(); revokeWeatherReferenceContext(owner.proof);
    if (request.current === owner) request.current = null;
  }
  function retire() {
    const owner = request.current;
    if (owner) release(owner);
    // Withdrawing local authority discards delivery; it does not abort an
    // already-started server action or undo its upstream request.
    if (lifecycle.current) publish({ status: 'idle' });
  }
  function current(owner: RequestOwner): boolean {
    return request.current === owner && lifecycle.current === owner.lifecycle
      && binding.current.identity === owner.binding && weatherReferenceContextIsCurrent(owner.proof)
      && isSampleMode() === owner.sample && savedReceipt(siteId, resolution) === owner.receipt;
  }

  useEffect(() => {
    const token = {}; lifecycle.current = token;
    setSampleLabel(isSampleMode());
    publish({ status: 'idle' });
    const placesChanged = () => {
      const owner = request.current;
      if (owner && !current(owner)) retire();
    };
    const sampleChanged = () => { retire(); setSampleLabel(isSampleMode()); };
    window.addEventListener('permamap-places-changed', placesChanged);
    window.addEventListener('storage', placesChanged);
    window.addEventListener('imbewu-sample-mode-changed', sampleChanged);
    return () => {
      if (lifecycle.current === token) lifecycle.current = null;
      if (request.current) release(request.current);
      window.removeEventListener('permamap-places-changed', placesChanged);
      window.removeEventListener('storage', placesChanged);
      window.removeEventListener('imbewu-sample-mode-changed', sampleChanged);
    };
    // Each prop change creates a new lifetime, including A → B → A. The
    // synchronous binding guard already hides previous values during render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propKey]);

  async function check() {
    if (!currentLifecycle || lifecycle.current !== currentLifecycle || rendered.current !== handler
      || binding.current.identity !== currentBinding || visible.status === 'loading') return;
    if (request.current?.pending) return;
    if (request.current) release(request.current);
    const receipt = savedReceipt(siteId, resolution), parts = siteId ? coordinateSiteIdParts(siteId) : null;
    if (!receipt || !parts) { publish({ status: 'error' }); return; }
    const proof = captureWeatherReferenceContext();
    if (!proof) { publish({ status: 'error' }); return; }
    const point = Object.freeze({ latitude4: Number(parts.lat.toFixed(4)).toFixed(4), longitude4: Number(parts.lon.toFixed(4)).toFixed(4) });
    const owner: RequestOwner = { lifecycle: currentLifecycle, binding: currentBinding, receipt, point,
      sample: isSampleMode(), proof, pending: true, stop: () => {} };
    request.current = owner;
    owner.stop = subscribeWeatherReferenceContext(proof, () => { if (request.current === owner) retire(); });
    publish({ status: 'loading' });
    try {
      if (!current(owner)) { if (request.current === owner) retire(); return; }
      const result = await checkNwsPointReference(point);
      if (!current(owner)) { if (request.current === owner) retire(); return; }
      const provenance = result.provenance;
      if (provenance.kind !== 'requested-point' || provenance.referenceOnly !== true
        || provenance.providerId !== 'nws-forecast-reference' || !provenance.requestedPoint
        || provenance.requestedPoint.latitude4 !== point.latitude4 || provenance.requestedPoint.longitude4 !== point.longitude4) {
        publish({ status: 'error' }); return;
      }
      publish({ status: 'result', result });
    } catch {
      if (current(owner)) publish({ status: 'error' });
      else if (request.current === owner) retire();
    } finally { if (request.current === owner) owner.pending = false; }
  }

  const eligible = resolution.status === 'confirmed' && resolution.siteId === siteId
    && resolution.context?.siteId === siteId && resolution.context.countryCode === 'US';
  if (!eligible) return null;
  const result = visible.status === 'result' ? visible.result : null;
  return <section lang="en" aria-label="Saved US point NWS forecast reference" className="mt-3 min-w-0 space-y-3 rounded-xl border border-[var(--border)] p-4 [overflow-wrap:anywhere]">
    <h3 className="font-semibold">{sampleLabel ? 'DEMO · ' : ''}NWS reference for this saved point</h3>
    <p>Checking sends this saved site’s coordinates rounded to four decimal places to the National Weather Service, in the upstream request URL. It sends no saved site ID, account ID or private site label.</p>
    <p>This is a forecast reference for a coarsened point, not current farm conditions or a weather-alert service. A saved US country description does not prove jurisdiction. These values do not change crop advice, planning dates or country readiness.</p>
    {sampleLabel && <p>DEMO: this request uses the sample session’s saved point.</p>}
    <button type="button" disabled={visible.status === 'loading'} onClick={() => void check()}
      className="min-h-11 max-w-full whitespace-normal rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm disabled:opacity-50">
      {visible.status === 'loading' ? 'Checking saved point reference…' : 'Send coarsened point and check NWS reference'}
    </button>
    <div role="status" aria-live="polite" aria-atomic="true" aria-busy={visible.status === 'loading'} className="space-y-3">
      {visible.status === 'idle' && <p>No forecast has been requested for this saved point.</p>}
      {visible.status === 'loading' && <p>One bounded reference request is in progress. No automatic retry. Changing the saved context discards its display; an upstream request already sent may continue.</p>}
      {visible.status === 'error' && <p>The reference check could not be completed for the current saved context. No replacement values were supplied. Reopen current site details and check again explicitly.</p>}
      {result?.status === 'failed' && <div className="space-y-2">
        <p>{failureCopy[result.reason] ?? 'The reference request failed.'} No automatic retry.</p>
        <p>Request stage: {result.stage}.{result.httpStatus !== undefined && ` HTTP status: ${result.httpStatus}.`}
          {result.retryAfterSeconds !== undefined && result.retryAfterSeconds !== null && ` Reported Retry-After: ${result.retryAfterSeconds} seconds.`}</p>
        {result.provenance.fetchedAt && <p>Response retrieved at: {result.provenance.fetchedAt}</p>}
      </div>}
      {result && result.status !== 'failed' && <div className="min-w-0 space-y-3">
        <h4 className="font-semibold">{result.status === 'partial' ? 'Partial point reference · missing fields remain Unknown' : 'Point forecast reference received'}</h4>
        <p>Requested coarsened point: {result.provenance.requestedPoint?.latitude4}, {result.provenance.requestedPoint?.longitude4}</p>
        <NwsForecastValues metadata={result.metadata} periods={result.periods} fetchedAt={result.provenance.fetchedAt} />
      </div>}
    </div>
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <a className="inline-flex min-h-11 items-center underline" href={NWS_REFERENCE_PROVIDER.apiDocsUrl} target="_blank" rel="noreferrer">NWS API documentation</a>
      <a className="inline-flex min-h-11 items-center underline" href={NWS_REFERENCE_PROVIDER.disclaimerUrl} target="_blank" rel="noreferrer">NWS disclaimer</a>
    </p>
  </section>;
}
