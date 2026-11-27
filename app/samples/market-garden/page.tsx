'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import TabBar from '@/components/TabBar';
import styles from '@/components/SampleExperience.module.css';
import { GREEN_HORIZON_SITE } from '@/lib/green-horizon-demo';
import { enterSampleMode } from '@/lib/sample-mode';
import { useSampleWorkspace } from '@/lib/use-role-navigation';

const designHref = `/design?lat=${GREEN_HORIZON_SITE.lat}&lon=${GREEN_HORIZON_SITE.lon}`;

export default function MarketGardenSamplePage() {
  const workspace = useSampleWorkspace();
  const [error, setError] = useState('');

  function openGarden() {
    if (!enterSampleMode('green-horizon')) {
      setError('Allow session storage to open the example, then try again.');
      return;
    }
    // Remount all editors and providers when entering a different workspace.
    window.location.reload();
  }

  return (
    <main lang="en" className={styles.page}>
      <AppHeader title="Market garden example" backFallback="/samples" />
      <div className={styles.content}>
        <div className={styles.wrap}>
          <section className={styles.card}>
            <h1>{GREEN_HORIZON_SITE.name}</h1>
            <p>Explore a fictional market garden in Pietermaritzburg, KwaZulu-Natal. Use the schematic beds and practice records to try crop planning, field work and sales.</p>
            <p>Edits stay in this tab. Reloading or changing examples resets the practice records.</p>
            {workspace === 'green-horizon' ? (
              <nav aria-label="Market garden workspace" className={styles.actions}>
                <Link className={`${styles.button} ${styles.primary}`} href="/facilitator/crops">Plan crops</Link>
                <Link className={styles.button} href="/farmer">Open the map</Link>
                <Link className={styles.button} href={designHref}>Edit the beds</Link>
                <Link className={styles.button} href="/cropplan">Open the task planner</Link>
                <Link className={styles.button} href="/journal">Open the field journal</Link>
                <Link className={styles.button} href="/records">View harvest and sales</Link>
              </nav>
            ) : (
              <button type="button" className={styles.primary} onClick={openGarden}>Open market garden workspace</button>
            )}
            {error && <p role="alert">{error}</p>}
          </section>
          <Link className={styles.link} href="/samples">Choose a different example</Link>
        </div>
      </div>
      <div className="no-print"><TabBar hideAtDesktop /></div>
    </main>
  );
}
