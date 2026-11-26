'use client';

import { useEffect, useState } from 'react';
import {
  confirmPhaseJournalFeature,
  phaseJournalSites,
  releasePhaseJournalSource,
  reviewPhaseJournalSource,
  type PhaseJournalDraft,
  type PhaseJournalSource,
} from '@/lib/phase-journal-source';
import styles from './PhaseObservationPicker.module.css';

export default function PhaseObservationPicker({ onConfirm, onClose }: {
  onConfirm: (draft: PhaseJournalDraft) => void;
  onClose: () => void;
}) {
  const [sites, setSites] = useState<ReturnType<typeof phaseJournalSites>>([]);
  const [placeId, setPlaceId] = useState('');
  const [source, setSource] = useState<PhaseJournalSource | null>(null);
  const [phaseKey, setPhaseKey] = useState('');
  const [featureId, setFeatureId] = useState('');
  const [changed, setChanged] = useState(false);
  useEffect(() => { setSites(phaseJournalSites()); }, []);
  useEffect(() => () => releasePhaseJournalSource(source), [source]);
  const phase = source?.phases.find(candidate => candidate.key === phaseKey);

  function chooseSite(id: string) {
    setPlaceId(id);
    setSource(id ? reviewPhaseJournalSource(id) : null);
    setPhaseKey('');
    setFeatureId('');
    setChanged(false);
  }

  function confirm() {
    if (!source || !phase || !featureId) return;
    const draft = confirmPhaseJournalFeature(source, phase.key, featureId);
    if (!draft) { setChanged(true); return; }
    onConfirm(draft);
  }

  return (
    <section aria-labelledby="phase-observation-heading" className={styles.picker} lang="en">
      <h2 id="phase-observation-heading">Record a design observation</h2>
      <p>Choose the saved site, the phase and the feature you observed.</p>
      {!sites.length && <p>Save a site with a mapped design in Design Studio to link an observation.</p>}
      {sites.length > 0 && <>
        <label>Saved site
          <select value={placeId} onChange={event => chooseSite(event.target.value)}>
            <option value="">Choose a site</option>
            {sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </label>
        {placeId && !source && <p role="status">There is no verifiable saved design for this site. Check the current design in Design Studio.</p>}
        {source && !source.phases.length && <p>No uniquely identified mapped features are available for these phases.</p>}
        {source?.hasAmbiguousNames && <p>Give repeated features distinct names in Design Studio to link them here.</p>}
        {!!source?.phases.length && <label>Design phase
          <select value={phaseKey} onChange={event => { setPhaseKey(event.target.value); setFeatureId(''); }}>
            <option value="">Choose a phase</option>
            {source.phases.map(candidate => <option key={candidate.key} value={candidate.key}>{candidate.title}</option>)}
          </select>
        </label>}
        {phase && <label>Mapped feature
          <select value={featureId} onChange={event => setFeatureId(event.target.value)}>
            <option value="">Choose a feature</option>
            {phase.features.map(feature => <option key={feature.id} value={feature.id}>{feature.label}</option>)}
          </select>
        </label>}
      </>}
      {changed && <p role="alert">The saved design or site changed. Recheck the site and feature before continuing.</p>}
      <div className={styles.actions}>
        <button type="button" onClick={onClose}>Cancel</button>
        {changed
          ? <button type="button" onClick={() => chooseSite(placeId)}>Review current design</button>
          : <button type="button" onClick={confirm} disabled={!featureId}>Continue to note</button>}
      </div>
    </section>
  );
}
