'use client';

import { useState } from 'react';
import { BMKG_SOURCE_NAVIGATION } from '@/lib/international/providers/bmkg-source-navigation';
import styles from './CountryReview.module.css';

const external = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' } as const;
const link = `${styles.link} inline-flex min-h-11 max-w-full items-center whitespace-normal`;

/** Indonesia is a separate research entry, not evidence for the selected pilot. */
export default function BmkgResearchLinks() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const reference = BMKG_SOURCE_NAVIGATION;
  return <section lang="en" aria-label="Indonesia BMKG research sources" className={`${styles.card} min-w-0 [overflow-wrap:anywhere]`}>
    <p className={styles.eyebrow}>Research queue · Indonesia · English prototype</p>
    <h3>Find Indonesia’s official BMKG sources</h3>
    <p>Explore BMKG’s forecast documentation, open-data description and general terms. These are source links, not a forecast feed or conditions measured on your farm.</p>
    <p>No Indonesia dossier or locally reviewed crop advice is enabled here. This research entry is separate from the pilot country selected above; opening a source does not change your site, region, saved plans or readiness.</p>
    <ul className="space-y-1">
      <li><a {...external} href={reference.forecastDocumentationUrl} className={link}>Open official BMKG forecast documentation ↗</a></li>
      <li><a {...external} href={reference.openDataAboutUrl} className={link}>Open the official BMKG open-data description ↗</a></li>
      <li><a {...external} href={reference.generalTermsUrl} className={link}>Open official BMKG general terms ↗</a></li>
    </ul>
    <p className={styles.secondary}>Source pages reviewed on {reference.reviewedOn}. This is a source-review date, not a forecast production, retrieval or validity time.</p>
    <p>BMKG’s general terms report a written-permission condition for republication, third-party integration or commercial use. Its application alongside the open-data guidance remains unresolved; no integration permission or commercial reuse licence is confirmed here.</p>
    <details className={styles.details} open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer">BMKG source review details</summary>
      <p>The coordinator inspected official pages through a web reader. Original HTTP response bodies were not captured, and no forecast API payload was inspected. This is source navigation, not an implemented data connection.</p>
      <p>The open-data guidance requires BMKG source attribution. It does not resolve the separate permission condition or establish a local farming recommendation.</p>
      <dl className="space-y-2">
        <div><dt className="font-semibold">Forecast documentation revision</dt><dd>{reference.forecastDocumentationUpdatedOn}</dd></div>
        <div><dt className="font-semibold">General terms revision</dt><dd>{reference.generalTermsUpdatedOn}</dd></div>
        <div><dt className="font-semibold">Forecast API payload</dt><dd>{reference.forecastApiPayloadInspected === false ? 'Not inspected' : 'Unknown'}</dd></div>
        <div><dt className="font-semibold">Original HTTP response bodies</dt><dd>{reference.originalHttpBodiesCaptured === false ? 'Not captured' : 'Unknown'}</dd></div>
        <div><dt className="font-semibold">Endpoint authentication</dt><dd>{reference.endpointAuthentication}</dd></div>
        <div><dt className="font-semibold">Endpoint availability</dt><dd>{reference.endpointAvailability}</dd></div>
        <div><dt className="font-semibold">Complete geographic coverage</dt><dd>{reference.completeGeographicCoverage}</dd></div>
        <div><dt className="font-semibold">Forecast freshness</dt><dd>{reference.verifiedForecastFreshness === 'not-assessed' ? 'Not assessed' : 'Unknown'}</dd></div>
        <div><dt className="font-semibold">Integration permission</dt><dd>{reference.integrationPermission}</dd></div>
        <div><dt className="font-semibold">Reuse licence</dt><dd>{reference.reuseLicence}</dd></div>
        <div><dt className="font-semibold">Conditions applicability</dt><dd>{reference.conditionsApplicability}</dd></div>
      </dl>
      <p className={styles.secondary}>Documentation revision dates are not forecast timestamps. These source links do not approve plant legality or apply South African crop defaults to Indonesia.</p>
    </details>
  </section>;
}
