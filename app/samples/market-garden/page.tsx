'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import TabBar from '@/components/TabBar';
import styles from '@/components/SampleExperience.module.css';
import { buildGreenHorizonLettuceTarget, GREEN_HORIZON_SITE } from '@/lib/green-horizon-demo';
import { enterSampleMode } from '@/lib/sample-mode';
import { useSampleWorkspace } from '@/lib/use-role-navigation';

const designHref = `/design?lat=${GREEN_HORIZON_SITE.lat}&lon=${GREEN_HORIZON_SITE.lon}`;
const formatDay = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

export default function MarketGardenSamplePage() {
  const workspace = useSampleWorkspace();
  const [error, setError] = useState('');
  const target = buildGreenHorizonLettuceTarget();
  const cropPlanHref = `/facilitator/crops?canvasSite=${encodeURIComponent(target.siteId)}`;
  const targetWeek = formatDay.format(new Date(target.window.start));

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
              <>
                <h2>Weekly veg box target</h2>
                <p>Plan for {target.weeklyKg} kg of lettuce in the week of {targetWeek}. This is a fictional buyer’s requested quantity. The practice harvest and sale are recorded separately.</p>
                <ol className="my-4 list-decimal space-y-2 pl-5">
                  <li>Open the crop plan to review the target or try planning lettuce in bed A1.</li>
                  <li>Save the proposed cycle, then open the Task Planner to log a dated observation and link the 6 kg practice harvest.</li>
                  <li>Check the separate 4 kg sale in Records, then download a private report from the Task Planner.</li>
                </ol>
                <nav aria-label="Market garden workspace" className={styles.actions}>
                  <Link className={`${styles.button} ${styles.primary}`} href={cropPlanHref}>Open crop plan</Link>
                  <Link className={styles.button} href={`${cropPlanHref}#practice-crop-cycle`}>Try the lettuce cycle</Link>
                  <Link className={styles.button} href="/farmer">Open the map</Link>
                  <Link className={styles.button} href={designHref}>Edit the beds</Link>
                  <Link className={styles.button} href="/cropplan">Open the task planner</Link>
                  <Link className={styles.button} href="/journal">Open the field journal</Link>
                  <Link className={styles.button} href="/records">View harvest and sales</Link>
                </nav>
              </>
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
