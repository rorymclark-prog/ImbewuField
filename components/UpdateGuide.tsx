'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { visibleUpdateTour } from '@/lib/release-notes';
import {
  OPEN_UPDATE_GUIDE_EVENT, UPDATE_GUIDE_KEY, readUpdateGuide, type UpdateGuideState,
} from '@/lib/update-tour';
import styles from './UpdateGuide.module.css';

export default function UpdateGuide({ loadedBuildSha }: { loadedBuildSha: string | null }) {
  const pathname = usePathname();
  const [guide, setGuide] = useState<UpdateGuideState | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    try {
      setGuide(readUpdateGuide(window.sessionStorage.getItem(UPDATE_GUIDE_KEY), loadedBuildSha));
    } catch { /* The tour is optional when storage is unavailable. */ }
    const open = () => setGuide({
      sha: loadedBuildSha, stops: visibleUpdateTour(), phase: 'offer', index: 0,
    });
    window.addEventListener(OPEN_UPDATE_GUIDE_EVENT, open);
    return () => window.removeEventListener(OPEN_UPDATE_GUIDE_EVENT, open);
  }, [loadedBuildSha]);

  // On arrival, get out of the way so the farmer can actually see and use the page.
  useEffect(() => {
    if (!guide || guide.phase !== 'tour') { setMinimized(false); return; }
    setMinimized(pathname === guide.stops[guide.index].href.split('#')[0]);
  }, [pathname, guide?.phase, guide?.index]);

  function save(next: UpdateGuideState | null) {
    setGuide(next);
    try {
      if (next) window.sessionStorage.setItem(UPDATE_GUIDE_KEY, JSON.stringify(next));
      else window.sessionStorage.removeItem(UPDATE_GUIDE_KEY);
    } catch { /* The guide still works until this tab closes. */ }
  }

  if (!guide || !guide.stops.length) return null;
  const stop = guide.stops[guide.index];
  const onPage = pathname === stop.href.split('#')[0];

  if (minimized && guide.phase === 'tour') {
    return <section className={styles.mini} role="region" aria-label="Update guide">
      <button type="button" onClick={() => setMinimized(false)}>
        Continue guide · {guide.index + 1}/{guide.stops.length}
      </button>
      <button type="button" onClick={() => save(null)} aria-label="Close update guide">×</button>
    </section>;
  }

  return (
    <section className={styles.guide} role="region" aria-label="Update guide">
      <div className={styles.head}>
        <span>{guide.phase === 'offer' ? 'UPDATED APP' : `UPDATE GUIDE · ${guide.index + 1} OF ${guide.stops.length}`}</span>
        <button type="button" className={styles.close} onClick={() => save(null)} aria-label="Close update guide">×</button>
      </div>
      {guide.phase === 'offer' ? (
        <>
          <h2>Want to see what changed?</h2>
          <p>A short guide will take you to the pages in this update. You can stop at any time.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => save({ ...guide, phase: 'tour' })}>Guide me</button>
            <button type="button" onClick={() => save(null)}>Not now</button>
          </div>
        </>
      ) : (
        <>
          <h2>{stop.title}</h2>
          <p className={styles.where}>{stop.where}</p>
          <p>{stop.detail}</p>
          <div className={styles.actions}>
            {!onPage && <a className={styles.primary} href={stop.href}>Open this page</a>}
            {onPage && <span className={styles.arrived}>You’re on this page. Take a look around.</span>}
          </div>
          <div className={styles.actions}>
            {guide.index > 0 && <button type="button" onClick={() => save({ ...guide, index: guide.index - 1 })}>Previous</button>}
            <button type="button" onClick={() => guide.index + 1 < guide.stops.length
              ? save({ ...guide, index: guide.index + 1 }) : save(null)}>
              {guide.index + 1 < guide.stops.length ? 'Next update' : 'Finish guide'}
            </button>
            <button type="button" onClick={() => save(null)}>Stop</button>
          </div>
        </>
      )}
    </section>
  );
}
