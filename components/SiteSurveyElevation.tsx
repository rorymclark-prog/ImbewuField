'use client';
import type { ElevationEvidence } from '@/lib/site-energy';
import styles from './SiteSurveyEnergy.module.css';

export default function SiteSurveyElevation({ value, onChange }: { value: ElevationEvidence; onChange: (next: ElevationEvidence) => void }) {
  const benchmark = value.benchmark;
  const patch = (change: Partial<NonNullable<ElevationEvidence['benchmark']>>) => onChange({ ...value,
    benchmark: { elevationM: null, method: 'reported', ...benchmark, ...change } });
  return <section lang="en" className={styles.card} aria-label="Site elevation">
    <h3>Site elevation</h3>
    <p>{value.model ? <><strong>Approximately {value.model.elevationM} m above sea level</strong><br/>{value.model.source} · 30 m terrain grid · five-point sampling baseline {value.model.sampleBaselineM} m. Retrieval date is not recorded.</> : 'No verified model elevation is available in this view. A missing result is not sea level.'}</p>
    <p className={styles.note}>This reference does not replace a survey, contours or measured map geometry.</p>
    <details open={!!benchmark}>
      <summary>Add a reported or surveyed benchmark (optional)</summary>
      <div className={styles.fields}>
        <label className={styles.field}>Benchmark elevation (m)<input type="number" min={-12000} max={10000} step="any" value={benchmark?.elevationM ?? ''} onChange={e => patch({ elevationM: e.target.value === '' ? null : Number(e.target.value) })}/></label>
        <label className={styles.field}>Evidence type<select value={benchmark?.method ?? 'reported'} onChange={e => patch({ method: e.target.value as 'reported' | 'surveyed' })}><option value="reported">Reported, not verified</option><option value="surveyed">From a survey record</option></select></label>
        <label className={styles.field}>Source / benchmark name<input maxLength={500} value={benchmark?.source ?? ''} onChange={e => patch({ source: e.target.value })}/></label>
        <label className={styles.field}>Vertical datum, if known<input maxLength={120} placeholder="Leave blank if unknown" value={benchmark?.datum ?? ''} onChange={e => patch({ datum: e.target.value })}/></label>
        <label className={styles.field}>Observation / survey date<input type="date" value={benchmark?.observedOn ?? ''} onChange={e => patch({ observedOn: e.target.value })}/></label>
      </div>
      <p>Kept alongside the terrain model. A local datum may differ from height above sea level.</p>
      {benchmark && <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => onChange({ model: value.model })}>Remove benchmark</button>}
    </details>
  </section>;
}
