import type { PhaseJournalLink } from '@/lib/phase-journal-source';
import styles from './PhaseObservationPicker.module.css';

export default function PhaseObservationContext({ link, recorded = false }: { link: PhaseJournalLink; recorded?: boolean }) {
  return (
    <p className={styles.context} lang="en">
      <strong>{recorded ? 'Design linked when recorded' : 'Selected design context'}</strong>
      {link.siteName} · {link.phaseTitle} · {link.featureLabel}
      {!recorded && <><br />This note records what you observed. The phase status and sign-off stay separate.</>}
    </p>
  );
}
