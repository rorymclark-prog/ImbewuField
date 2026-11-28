'use client';

import Link from 'next/link';
import { useState } from 'react';
import AppHeader from '@/components/layout/AppHeader';
import TabBar from '@/components/TabBar';
import styles from '@/components/SampleExperience.module.css';
import { RIVIER_UITSIG_BEDS, RIVIER_UITSIG_FIELDS, RIVIER_UITSIG_LAYOUT_PROVENANCE, RIVIER_UITSIG_SITE,
  RIVIER_UITSIG_SITE_ID } from '@/lib/rivier-uitsig-layout';
import { enterSampleMode } from '@/lib/sample-mode';
import { useSampleWorkspace } from '@/lib/use-role-navigation';

const sampleHref = '/samples/rivier-uitsig';
const cropPlanHref = `/facilitator/crops?canvasSite=${encodeURIComponent(RIVIER_UITSIG_SITE_ID)}`;
const layoutHref = `/design?lat=${RIVIER_UITSIG_SITE.lat}&lon=${RIVIER_UITSIG_SITE.lon}`;
const bedArea = RIVIER_UITSIG_BEDS.reduce((area, bed) => area + bed.nominalWidthM * bed.nominalLengthM, 0);
const imageryDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' })
  .format(new Date(RIVIER_UITSIG_LAYOUT_PROVENANCE.imageryDate));

export default function RivierUitsigSamplePage() {
  const active = useSampleWorkspace() === 'rivier-uitsig';
  const [error, setError] = useState('');

  function openExample(href: string) {
    if (!enterSampleMode('rivier-uitsig')) {
      setError('Allow session storage to open the example, then try again.');
      return;
    }
    // All editors must remount when the active sample or its records change.
    window.location.assign(href);
  }

  return (
    <main lang="en" className={styles.page}>
      <AppHeader title="Rivier Uitsig example" backFallback="/samples" />
      <div className={styles.content}>
        <div className={styles.wrap}>
          <section className={styles.card}>
            <h1>Rivier Uitsig</h1>
            <p>Open the practice production plan to see sowing and picking work already laid out on mapped beds.</p>
            <p>The practice dates, quantities and yield estimates are fictional. Actual farm production and sales are unknown.</p>
            <nav aria-label="Rivier Uitsig workspace" className={styles.actions}>
              {active ? <>
                <Link className={`${styles.button} ${styles.primary}`} href={cropPlanHref} prefetch={false}>Open practice production plan</Link>
                <Link className={styles.button} href={layoutHref} prefetch={false}>Open field layout</Link>
                <Link className={styles.button} href="/cropplan" prefetch={false}>Open Task Planner</Link>
              </> : <>
                <button type="button" className={styles.primary} onClick={() => openExample(cropPlanHref)}>Open practice production plan</button>
                <button type="button" onClick={() => openExample(layoutHref)}>Open field layout</button>
              </>}
            </nav>
            {error && <p role="alert">{error}</p>}
            <p>Edits stay in this tab until you reload, reset or change examples.</p>
            {active && <button type="button" onClick={() => openExample(sampleHref)}>Reset practice workspace</button>}
          </section>
          <section className={styles.card} aria-labelledby="rivier-layout-title">
            <h2 id="rivier-layout-title">Fields and beds</h2>
            <p>{RIVIER_UITSIG_BEDS.length} illustrative beds in two banks cover {bedArea.toFixed(1)} m² of growing space.</p>
            <p>Zoom into the vegetable area to see banks A and B and edit individual beds.</p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {RIVIER_UITSIG_FIELDS.map(field => <div key={field.id}>
                <dt>{field.id === 'V01' ? 'Vegetable area' : field.id}</dt>
                <dd className="font-semibold">Approx. {field.approximateAreaHa.toFixed(2)} ha</dd>
              </div>)}
            </dl>
            <p>Field outlines were traced from the {imageryDate} view ({RIVIER_UITSIG_LAYOUT_PROVENANCE.attribution}). The map uses an artificial location, and the outlines are approximate.</p>
          </section>
          <Link className={styles.link} href="/samples">Choose a different example</Link>
        </div>
      </div>
      <div className="no-print"><TabBar hideAtDesktop /></div>
    </main>
  );
}
