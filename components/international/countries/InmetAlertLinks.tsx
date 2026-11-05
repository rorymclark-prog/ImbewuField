'use client';

import { useState } from 'react';
import { resolveInmetAlertReference, type InmetAlertReference } from '@/lib/international/providers/inmet-alert-reference';
import styles from './CountryReview.module.css';

const external = { target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' } as const;
const link = `${styles.link} inline-flex min-h-11 max-w-full items-center whitespace-normal`;

function ReferenceCard({ reference }: { reference: InmetAlertReference }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return <section lang="en" aria-label="Brazil official INMET alert links" className={`${styles.card} min-w-0 [overflow-wrap:anywhere]`}>
    <p className={styles.eyebrow}>English prototype · official source links</p>
    <h2>Check official INMET weather-alert sources</h2>
    <p>Open INMET to check the provider’s geographic area and dates. Alerts are not retrieved or evaluated here, and these links do not update crop advice or establish conditions on your farm.</p>
    <p className={styles.secondary}>Links inspected on {reference.reviewedOn}. This is a link-inspection date, not a weather publication date or freshness check.</p>
    <ul className="space-y-1">
      <li><a {...external} href={reference.alertsAppUrl} className={link}>Open official INMET weather alerts ↗</a></li>
      <li><a {...external} href={reference.portalUrl} className={link}>Open the official INMET portal ↗</a></li>
      <li><a {...external} href={reference.rssFeedUrl} className={link}>Open the official Alert-AS RSS link ↗</a></li>
    </ul>
    <details className={styles.details} open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer">Source review details</summary>
      <p>The official primary portal’s text and links were inspected. The alerts site returned a JavaScript application shell; the RSS feed body was not inspected. No feed item, alert count or alert-free status was established.</p>
      <p>Direct machine requests ended in connection resets without response bodies. Those failures do not establish provider downtime or an empty feed.</p>
      <dl className="space-y-2">
        <div><dt className="font-semibold">Feed schema</dt><dd>{reference.feedSchema}</dd></div>
        <div><dt className="font-semibold">Feed timestamps</dt><dd>{reference.feedTimestamps}</dd></div>
        <div><dt className="font-semibold">Geographic coverage</dt><dd>{reference.geographicCoverage}</dd></div>
        <div><dt className="font-semibold">Update cadence</dt><dd>{reference.updateCadence}</dd></div>
        <div><dt className="font-semibold">Authentication</dt><dd>{reference.authentication}</dd></div>
        <div><dt className="font-semibold">Reuse licence</dt><dd>{reference.reuseLicence}</dd></div>
        <div><dt className="font-semibold">Freshness</dt><dd>{reference.verifiedFreshness === 'not-assessed' ? 'Not assessed' : 'Unknown'}</dd></div>
      </dl>
      <p className={styles.secondary}>This is external source navigation. It does not select a farm location, interpret an alert or approve local growing advice.</p>
    </details>
  </section>;
}

/** The resolver owns country eligibility and every outbound destination. */
export default function InmetAlertLinks({ countryCode }: { countryCode: unknown }) {
  const result = resolveInmetAlertReference(countryCode);
  return result.status === 'reference' ? <ReferenceCard reference={result.reference} /> : null;
}
