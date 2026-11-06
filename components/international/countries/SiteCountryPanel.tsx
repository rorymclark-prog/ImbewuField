'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createSiteCountryContext, type SiteContextResolution } from '@/lib/international/site-context';
import { savedCountryEvidenceHref } from '@/lib/international/countries/navigation';
import { updateSiteCountryContext } from '@/lib/saved-places';
import { DEFINITIVE_CONTEXT_REJECTIONS, type PlaceContextOutcome } from '@/lib/user-sync';
import { isSampleMode } from '@/lib/sample-mode';

export interface CountrySaveNotice {
  siteId: string;
  attempt: string;
  phase: 'local' | 'cloud';
  message: string;
  rejected: boolean;
}

const countries = [['ZA', 'South Africa'], ['KE', 'Kenya'], ['GB', 'United Kingdom'], ['US', 'United States'], ['BR', 'Brazil']] as const;
const field = 'mt-1 block min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-[var(--text-primary)]';

export default function SiteCountryPanel({ resolution, onSaved, onDelivery }: {
  resolution: SiteContextResolution;
  onSaved: () => void;
  onDelivery?: (notice: CountrySaveNotice) => void;
}) {
  const current = resolution.context;
  const known = countries.some(([code]) => code === current?.countryCode);
  const [country, setCountry] = useState(current ? known ? current.countryCode : 'other' : '');
  const [otherCode, setOtherCode] = useState(current && !known ? current.countryCode : '');
  const [jurisdiction, setJurisdiction] = useState(current?.jurisdictionReference ?? '');
  const [region, setRegion] = useState(current?.agriculturalRegionReference ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState(false);

  function save(event: FormEvent) {
    event.preventDefault();
    if (!resolution.siteId) { setFailure(true); setMessage('Reopen the saved mapped site before saving country details.'); return; }
    const context = createSiteCountryContext({ siteId: resolution.siteId, countryCode: country === 'other' ? otherCode : country,
      jurisdictionReference: jurisdiction, agriculturalRegionReference: region, confirmed });
    if (!context || !resolution.siteId) { setFailure(true); setMessage('Choose a country and confirm this site description. Other country codes need two letters.'); return; }
    const siteId = resolution.siteId;
    const attempt = JSON.stringify(context);
    const outcomes = new Map<string, PlaceContextOutcome>();
    const result = updateSiteCountryContext(siteId, context, report => {
      outcomes.set(report.placeId, report.outcome);
      const rejected = [...outcomes.values()].some(outcome => DEFINITIVE_CONTEXT_REJECTIONS.includes(outcome) || outcome === 'superseded');
      const acknowledged = outcomes.size === resolution.placeIds.length
        && [...outcomes.values()].every(outcome => outcome === 'applied' || outcome === 'unchanged');
      onDelivery?.({ siteId, attempt, phase: 'cloud', rejected,
        message: rejected ? 'Your account did not accept these country details. The saved site changed or is unavailable; reopen its current details before confirming again.'
          : acknowledged ? 'Your account confirmed these country details for this saved site.'
            : 'Country details are saved here. Account confirmation is still pending or unavailable.' });
    });
    if (result.status !== 'local-saved') {
      setFailure(true);
      setMessage(result.status === 'missing-site' ? 'This saved site is no longer available. Reopen it before saving.'
        : 'Country details could not be saved. Your previous saved details remain in place.');
      return;
    }
    setFailure(false); setConfirmed(false);
    const localMessage = isSampleMode() ? 'Country details saved for this sample session only.'
      : 'Country details saved on this device. Account confirmation is separate.';
    setMessage(localMessage);
    onDelivery?.({ siteId, attempt, phase: 'local', message: localMessage, rejected: false });
    onSaved();
  }

  const evidenceHref = savedCountryEvidenceHref(resolution);

  return <section aria-label="Site country and region" className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 font-sans text-[var(--text-primary)]">
    <h2 className="font-display text-lg font-semibold">Site country and region</h2>
    <p className="mt-1 text-sm text-[var(--text-secondary)]">{current
      ? `Saved country: ${countries.find(([code]) => code === current.countryCode)?.[1] ?? current.countryCode}. This is the grower’s description, not local agronomy approval.`
      : resolution.status === 'conflict' ? 'Saved entries for this same mapped site disagree. Confirm one description for all of them.'
        : 'The country for this site has not been confirmed. Existing plans and measured maps stay saved.'}</p>
    {evidenceHref && <p className="mt-2 text-sm">
      <Link href={evidenceHref} className="inline-flex min-h-11 items-center font-medium underline">
        Review country evidence
      </Link>{' '}
      <span className="text-[var(--text-secondary)]">
        · Reference tools only; opening this link does not save country details or approve farming advice.
      </span>
    </p>}
    {resolution.status === 'missing-site' ? <p className="mt-3 text-sm">Open or save the mapped site first to keep its country details with your existing saved places. <Link href="/farmer" className="underline">Open map and saved sites</Link>. A virtual bed has no saved country.</p> : <details className="mt-3" open={!current}>
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">{current ? 'Review or change country details' : 'Confirm country details'}</summary>
      <form onSubmit={save} className="grid gap-3 pt-2 sm:grid-cols-2">
        <label className="text-sm">Site country<select required className={field} value={country} onChange={event => { setCountry(event.target.value); setConfirmed(false); }}>
          <option value="">Choose country</option>{countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}<option value="other">Other country</option>
        </select></label>
        {country === 'other' && <label className="text-sm">Two-letter country code<input required maxLength={2} pattern="[A-Za-z]{2}" className={field} value={otherCode} onChange={event => { setOtherCode(event.target.value); setConfirmed(false); }} /></label>}
        <label className="text-sm">Jurisdiction reference (optional)<input maxLength={160} className={field} value={jurisdiction} onChange={event => { setJurisdiction(event.target.value); setConfirmed(false); }} placeholder="Your county, state or other jurisdiction" /></label>
        <label className="text-sm">Agricultural region reference (optional)<input maxLength={160} className={field} value={region} onChange={event => { setRegion(event.target.value); setConfirmed(false); }} placeholder="Your own region description" /></label>
        <p className="text-sm text-[var(--text-secondary)] sm:col-span-2">Country, language, currency and measurement units are separate choices. These details do not select a planting calendar or approve farming advice. They travel with a site if you explicitly share that site.</p>
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />I confirm these details describe this mapped site.</label>
        <button type="submit" disabled={!confirmed || !country} className="min-h-11 rounded-xl bg-[var(--color-forest-800)] px-4 py-2 font-semibold text-white disabled:opacity-50 sm:col-span-2">Save country details</button>
      </form>
    </details>}
    {message && <p role={failure ? 'alert' : 'status'} className="mt-3 text-sm">{message}</p>}
  </section>;
}
