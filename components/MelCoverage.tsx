'use client';
import Link from 'next/link';
import { MEL_STAGES } from '@/lib/mel';
import { MEL_TEMPLATES } from '@/lib/mel-templates';
import styles from './MelDashboard.module.css';

/** Template coverage is public information; unpublished responses stay private. */
export default function MelCoverage() {
  return <section className={styles.card} style={{margin:'20px 0'}}>
    <h2>The full assessment cycle</h2>
    <p>These assessment tools are available. Results appear below when the organisation has reviewed and shared them; a tool listed here does not mean an assessment is complete.</p>
    <div className={styles.grid}>{MEL_STAGES.map(stage=><article key={stage}><span className={styles.tag}>{stage.startsWith('app_')?'App experience':'Project & training'}</span><h3 style={{marginTop:10}}>{MEL_TEMPLATES[stage].en}</h3><p>{MEL_TEMPLATES[stage].timing}</p></article>)}</div>
    <h3>Turn feedback into the next improvement</h3>
    <p>Record what needs to change, who will act and when to review it. Organisations can attach a learning action to an assessment. App requests go to the developer through the feedback form.</p>
    <Link href="/feedback">Report a bug or request a feature →</Link>
    <p className={styles.muted}>Feature requests are tracked separately from assessment results. Linking a request to a release and a later assessment is planned.</p>
  </section>;
}
