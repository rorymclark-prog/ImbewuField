'use client';

import { useId, useState } from 'react';
import { KMD_COUNTY_CHOICES, resolveKmdBulletinReference } from '@/lib/international/providers/kmd-bulletin-reference';
import styles from './CountryReview.module.css';

const external = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' } as const;
const link = `${styles.link} inline-flex min-h-11 max-w-full items-center whitespace-normal`;

/** Curated source discovery only: selecting a county never requests a bulletin
 * or connects this reference to a saved farm or readiness assessment. */
export default function CountyBulletinReference() {
  const [county, setCounty] = useState('');
  const countyId = useId();
  const result = resolveKmdBulletinReference('KE', county);
  return <section lang="en" aria-label="Kenya county bulletin reference" className={`${styles.card} min-w-0 [overflow-wrap:anywhere]`}>
    <p className={styles.eyebrow}>English prototype · official source links</p>
    <h2>Find an inspected Kenya county bulletin</h2>
    <p>Choose a county explicitly to view the recorded official links. This reference does not supply current farm conditions, interpret weather figures or approve local crop advice.</p>
    <div className={styles.fields}><label htmlFor={countyId}>County for bulletin links
      <select id={countyId} className="min-h-11 min-w-0 w-full" value={county} onChange={event => setCounty(event.target.value)}>
        <option value="">Choose a county</option>
        {KMD_COUNTY_CHOICES.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
      </select>
    </label></div>
    <p className={styles.secondary}>The agricultural-region text above does not select a county or establish source coverage.</p>
    <div role="status" aria-live="polite">
      {result.status === 'unavailable' && <p>{result.reason === 'county-not-selected'
        ? 'No county selected. No bulletin PDF is selected.'
        : 'No checked bulletin reference is recorded for this selection.'}</p>}
      {result.status === 'reference' && <>
        <h3>{result.reference.countyLabel} · inspected source reference</h3>
        <p>{result.reference.sourceTitle}</p>
        <dl className="space-y-2">
          <div><dt className="font-semibold">Source inspected on</dt><dd>{result.reference.inspectedOn} — inspection date, not publication.</dd></div>
          <div><dt className="font-semibold">Advertised calendar window</dt><dd>{result.reference.advertisedCalendarWindow.startDate} to {result.reference.advertisedCalendarWindow.endDate}</dd></div>
        </dl>
        <p>Freshness has not been assessed. This reference does not establish whether the bulletin is current or latest.</p>
        <ul className="space-y-1">
          <li><a {...external} href={result.reference.officialPageUrl} className={link}>Open the dated official Kiambu page ↗</a></li>
          <li><a {...external} href={result.reference.documentUrl} className={link}>Open its linked November 2026 PDF ↗</a></li>
          <li><a {...external} href={result.reference.officialSearchUrl} className={link}>Search the official KMD site for Kiambu ↗</a></li>
          <li><a {...external} href={result.reference.officialIndexUrl} className={link}>Open the official county-forecast index ↗</a></li>
        </ul>
        <details className={styles.details}>
          <summary className="min-h-11 cursor-pointer">Source review details</summary>
          <dl className="space-y-2">
            <div><dt className="font-semibold">Calendar-window basis</dt><dd>Source heading; timezone {result.reference.advertisedCalendarWindow.timezone}. Date-boundary meaning is {result.reference.advertisedCalendarWindow.boundarySemantics === 'not-established' ? 'not established' : 'unknown'}.</dd></div>
            <div><dt className="font-semibold">Freshness / currentness</dt><dd>{result.reference.verifiedFreshness === 'not-assessed' ? 'Not assessed' : 'Unknown'}</dd></div>
            <div><dt className="font-semibold">Whether this is the latest bulletin</dt><dd>{result.reference.latestBulletin === 'not-established' ? 'Not established' : 'Unknown'}</dd></div>
            <div><dt className="font-semibold">Publication date</dt><dd>{result.reference.publishedAt}</dd></div>
            <div><dt className="font-semibold">Reuse licence</dt><dd>{result.reference.reuseLicence}</dd></div>
            <div><dt className="font-semibold">API contract</dt><dd>{result.reference.apiContract}</dd></div>
          </dl>
          <p className={styles.secondary}>The advertised dates remain calendar labels. They are not converted to UTC instants or used to calculate expiry. Opening a source does not update the app’s crop calendar, saved site or country readiness.</p>
        </details>
        <details className={styles.details}>
          <summary className="min-h-11 cursor-pointer">Separate historical links · July 2025</summary>
          <p>When inspected, the generic Kiambu page linked a document whose filename advertises July 2025. That historical link is separate from the dated November 2026 reference above.</p>
          <p><a {...external} href={result.reference.historicalPageUrl} className={link}>Open the historical generic page · July 2025 ↗</a></p>
          <p><a {...external} href={result.reference.historicalDocumentUrl} className={link}>Open the listed historical PDF · July 2025 ↗</a></p>
          <p className={styles.secondary}>The historical PDF body was not inspected for this reference.</p>
        </details>
      </>}
    </div>
  </section>;
}
