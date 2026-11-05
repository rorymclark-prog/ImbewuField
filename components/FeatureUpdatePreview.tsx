'use client';

import { useState } from 'react';
import styles from './FeatureUpdatePreview.module.css';

/** A small illustrative walkthrough: no real account data or network requests. */
export default function FeatureUpdatePreview() {
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  return (
    <div className={styles.preview} data-paused={paused} lang="en">
      <div key={run} className={styles.stage} role="img" aria-label="Illustration: choose a saved site, then review assistant access. Other sites stay unselected.">
        <div aria-hidden="true">
          <div className={styles.window}>
            <div className={styles.bar}><i className={styles.dot} /><i className={styles.dot} /><i className={styles.dot} /><span className={styles.brand}>IMBEWUFIELD · DEMO</span></div>
            <p className={styles.title}>Choose sites to share</p>
            <div className={`${styles.row} ${styles.selected}`}><span className={styles.check}>✓</span><span>Your selected site<br /><span className={styles.caption}>Saved map, photos and reports</span></span></div>
            <div className={styles.row}><span className={styles.check}></span><span>Another site</span></div>
          </div>
          <svg className={styles.cursor} viewBox="0 0 24 30"><path d="M2 2v22l6-6 5 10 4-2-5-10h9Z" fill="currentColor" stroke="white" strokeWidth="1.5" /></svg>
          <div className={styles.result} onAnimationEnd={() => setFinished(true)}><span>✓</span>Review assistant access</div>
        </div>
      </div>
      <div className={styles.controls}>
        {!finished && <button type="button" onClick={() => setPaused(!paused)}>{paused ? 'Play animation' : 'Pause animation'}</button>}
        <button type="button" onClick={() => { setPaused(false); setFinished(false); setRun(run + 1); }}>Replay animation ↻</button>
      </div>
    </div>
  );
}
