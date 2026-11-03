'use client';

import { useState } from 'react';
import { KMD_BULLETIN_COUNTIES, resolveKmdBulletinReference } from '@/lib/international/providers/kmd-bulletin-reference';
import styles from './CountryReview.module.css';

interface Props { countryCode: string }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// These are nominal calendar labels, not time-zone or validity conversions.
const calendarLabel = (date: string) => {
  const [year, month, day] = date.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
};

export default function CountyBulletinReference({ countryCode }: Props) {
  if (countryCode !== 'KE') return null;
  return <KenyaCountyBulletin key={countryCode} countryCode={countryCode} />;
}

function KenyaCountyBulletin({ countryCode }: Props) {
  const [countyId, setCountyId] = useState('');
  const resolved = resolveKmdBulletinReference(countryCode, countyId);
  return <section className={styles.card} aria-labelledby="county-bulletin-heading">
    <p className={styles.eyebrow}>Official dated reference</p>
    <h2 id="county-bulletin-heading">County weather bulletin</h2>
    <p>Choose a county to see a recorded official reference. This does not select an agricultural region or approve crop-planning advice.</p>
    <div className={styles.fields}><label>County
      <select aria-label="County bulletin county" value={countyId} onChange={event => setCountyId(event.target.value)}>
        <option value="">Choose a county</option>
        {KMD_BULLETIN_COUNTIES.map(county => <option key={county.id} value={county.id}>{county.label}</option>)}
      </select>
    </label></div>
    {resolved.status === 'available' ? <article aria-label={`${resolved.reference.countyLabel} dated bulletin reference`}>
      <h3>{resolved.reference.countyLabel} · {resolved.reference.authority}</h3>
      <p><strong>Advertised calendar dates:</strong> <time dateTime={resolved.reference.advertisedWindow.start}>{calendarLabel(resolved.reference.advertisedWindow.start)}</time> to{' '}
        <time dateTime={resolved.reference.advertisedWindow.end}>{calendarLabel(resolved.reference.advertisedWindow.end)}</time>.</p>
      <p className={styles.secondary}>PDF source retrieved: {calendarLabel(resolved.reference.checkedAtUtc.slice(0, 10))} (UTC). This is a retrieval record, not a publication or issue time.</p>
      <p><strong>Freshness has not been assessed.</strong> This is not a live feed. Check the Kenya Meteorological Department for its newest bulletin.</p>
      <p><a href={resolved.reference.officialPageUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={styles.link}>Open official dated page ↗</a></p>
      <p><a href={resolved.reference.documentUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={styles.link}>Open dated bulletin PDF ↗</a></p>
      <p><a href={resolved.reference.indexUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={styles.link}>Check KMD’s county bulletin index ↗</a></p>
      <details className={styles.details}><summary>About this reference</summary>
        <p>Time zone: unknown. The advertised calendar dates have not been established as exact validity times.</p>
        <p>Reuse licence: unknown. This reference does not establish permission to reuse its contents or approval for local crop planning.</p>
      </details>
    </article> : <p className={styles.secondary} role="status">{resolved.reason === 'county-not-selected'
      ? 'No county selected. Choose a county to open its dated reference.' : 'There is no verified reference for this county selection.'}</p>}
  </section>;
}
