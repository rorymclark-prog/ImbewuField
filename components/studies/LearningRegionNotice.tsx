'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { activeAccountUid } from '@/lib/account-local-storage';
import { loadPlaces, type SavedPlace } from '@/lib/saved-places';
import { isSampleMode } from '@/lib/sample-mode';
import { coordinateSiteIdForPlace, resolveSiteCountryContext, type SiteContextResolution } from '@/lib/international/site-context';
import { readCountryEvidenceSelection, savedCountryEvidenceHref } from '@/lib/international/countries/navigation';
import {
  captureLearningSiteContext, learningSiteContextIsCurrent, subscribeLearningSiteContext, revokeLearningSiteContext,
  type LearningSiteContext,
} from '@/lib/length-unit-preference';

export type LearningRegionScope = 'core-farming' | 'design-preview' | 'finance-preview';
export type LearningDestination = { status: 'unselected' | 'unavailable' }
  | { status: 'selected'; resolution: SiteContextResolution };

/** Provenance describes the teaching source, never permission to act at a destination. */
export function LearningRegionNotice({ scope, destination }: { scope: LearningRegionScope; destination: LearningDestination }) {
  const resolution = destination.status === 'selected' ? destination.resolution : null;
  const context = resolution?.status === 'confirmed' ? resolution.context : null;
  const evidenceHref = resolution ? savedCountryEvidenceHref(resolution) : null;
  const dossier = context ? readCountryEvidenceSelection(context.countryCode) : null;
  return <div className="space-y-2 text-sm">
    {scope === 'core-farming' ? <p><strong>Farming course · South African source material.</strong></p>
      : scope === 'design-preview' ? <p><strong>Design teaching preview.</strong> It draws on Southern African and other teaching sources.</p>
        : <p><strong>Farm Finance teaching preview.</strong> Classroom examples are not local prices.</p>}
    <p>Local suitability has not been assessed here. A saved country, country evidence or a translation cannot establish it.</p>
    {destination.status === 'unavailable' ? <p role="status">Saved-site details are unavailable or changed. Check current saved sites and choose again.</p>
      : !resolution ? <p>No site selected. Country and agricultural region are unknown.</p>
        : context ? <>
          <p>Saved site country: <strong>{context.countryCode}</strong> (grower’s description).</p>
          <p>Agricultural region: {context.agriculturalRegionReference ?? 'Unknown'}{context.agriculturalRegionReference && ' (grower’s description)'}.</p>
          {dossier?.kind !== 'pilot' && <p>No country reference dossier is listed.</p>}
          {evidenceHref && <a href={evidenceHref} className="inline-flex min-h-11 items-center underline">Review country reference evidence</a>}
        </> : <p role="status">{resolution.status === 'conflict' ? 'Saved details for this site disagree. Country and agricultural region are unknown.'
          : resolution.status === 'missing-site' ? 'This saved site has moved or is no longer available. Choose a current site.'
            : 'This site’s country has not been confirmed. Country and agricultural region are unknown.'}</p>}
  </div>;
}

type Snapshot = { proof: LearningSiteContext; places: SavedPlace[]; selected: string | null; sample: boolean };

/** Selection belongs to this mounted caller only. The existing account/sample epoch
 * withdraws private labels even during the gap before AuthProvider replaces its tree. */
export default function LearningRegionContext({ scope }: { scope: LearningRegionScope }) {
  const { user, loading } = useAuth();
  const uid = user?.uid ?? null;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);
  const live = useRef<object | null>(null), proofRef = useRef<LearningSiteContext | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null), rendered = useRef<object | null>(null);
  const handler = {}; rendered.current = handler;
  const lifetime = live.current, proof = proofRef.current;
  const visible = snapshot && snapshot.proof === proof && learningSiteContextIsCurrent(snapshot.proof) ? snapshot : null;

  function publish(next: Snapshot | null) {
    rendered.current = null;
    snapshotRef.current = next;
    setSnapshot(next);
  }
  function handlerCurrent() {
    const ownsHandler = () => !!lifetime && live.current === lifetime && rendered.current === handler && !!proof && proofRef.current === proof;
    if (!ownsHandler()) return false;
    if (!learningSiteContextIsCurrent(proof)) {
      if (live.current === lifetime && proofRef.current === proof) publish(null);
      return false;
    }
    return ownsHandler();
  }

  useEffect(() => {
    const lifetime = {}; live.current = lifetime;
    let proof: LearningSiteContext | null = null;
    let stop = () => {};
    let ownerAtCapture: string | null = uid, sampleAtCapture = false;
    function current() {
      return live.current === lifetime && !!proof && proofRef.current === proof && learningSiteContextIsCurrent(proof)
        && live.current === lifetime && proofRef.current === proof;
    }
    function retire() {
      if (live.current !== lifetime) return;
      let changedIdentity = false;
      try { changedIdentity = activeAccountUid() !== ownerAtCapture || isSampleMode() !== sampleAtCapture; } catch { /* keep the failed identity held */ }
      stop();
      if (proof) revokeLearningSiteContext(proof);
      proofRef.current = null;
      publish(null);
      // Recreating the last failed scope immediately would erase an auth-error
      // hold. Only a different actor/sample acquires choices automatically.
      if (changedIdentity) setAttempt(value => value + 1);
    }
    function refresh() {
      if (!current()) { retire(); return; }
      const previous = snapshotRef.current, owner = rendered.current;
      const places = loadPlaces();
      if (!current()) { retire(); return; }
      if (rendered.current !== owner) return;
      const sample = isSampleMode();
      if (!current()) { retire(); return; }
      if (rendered.current !== owner) return;
      publish({ proof: proof!, places, selected: previous?.proof === proof ? previous.selected : null, sample });
    }
    setStarted(true);
    if (!loading) {
      proof = captureLearningSiteContext();
      proofRef.current = proof;
      if (proof && learningSiteContextIsCurrent(proof)) {
        const sample = isSampleMode();
        ownerAtCapture = activeAccountUid(); sampleAtCapture = sample;
        if (!sample && activeAccountUid() !== uid) { revokeLearningSiteContext(proof); proofRef.current = null; }
        else {
          stop = subscribeLearningSiteContext(proof, retire);
          refresh();
        }
      }
    }
    const refreshEvents = ['storage', 'focus', 'permamap-places-changed'];
    refreshEvents.forEach(event => window.addEventListener(event, refresh));
    return () => {
      if (live.current === lifetime) { live.current = null; rendered.current = null; proofRef.current = null; snapshotRef.current = null; }
      stop();
      if (proof) revokeLearningSiteContext(proof);
      refreshEvents.forEach(event => window.removeEventListener(event, refresh));
    };
  }, [uid, loading, attempt]);

  function choose(raw: unknown) {
    if (!handlerCurrent()) return;
    if (typeof raw !== 'string') return;
    const places = loadPlaces();
    if (!handlerCurrent()) return;
    const selected = !raw || places.some(place => coordinateSiteIdForPlace(place) === raw) ? raw || null : visible?.selected ?? null;
    publish({ proof: proof!, places, selected, sample: visible?.sample ?? false });
  }
  const choices = new Map<string, string[]>();
  for (const place of visible?.places ?? []) {
    const siteId = coordinateSiteIdForPlace(place);
    if (siteId) choices.set(siteId, [...(choices.get(siteId) ?? []), place.name]);
  }
  const selected = visible?.selected ?? null;
  const destination: LearningDestination = selected && visible
    ? { status: 'selected', resolution: resolveSiteCountryContext(visible.places, selected) }
    : { status: started && !visible ? 'unavailable' : 'unselected' };
  return <section lang="en" aria-label="Learning source and selected-site context" className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-4 font-sans text-[var(--text-primary)]">
    <h2 className="font-semibold">{visible?.sample ? 'DEMO · ' : ''}English source · learning context</h2>
    <LearningRegionNotice scope={scope} destination={destination} />
      <label className="block text-sm">Saved site (optional)
        <select value={selected ?? ''} disabled={!visible} onChange={event => { if (handlerCurrent()) choose(event.target.value); }} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-2">
          <option value="">No saved site selected</option>
          {selected && !choices.has(selected) && <option value={selected} disabled>Previously selected location unavailable</option>}
          {[...choices].map(([siteId, names]) => <option key={siteId} value={siteId}>{[...new Set(names)].join(' / ')}</option>)}
        </select>
      </label>
      {started && !visible && <button type="button" onClick={() => {
        if (!lifetime || live.current !== lifetime || rendered.current !== handler) return;
        rendered.current = null;
        setAttempt(value => value + 1);
      }} className="min-h-11 underline">Check current saved sites</button>}
      {visible && !choices.size && <p className="text-sm">No readable saved sites are available in this device context. No destination has been inferred.</p>}
      <p className="text-sm">Temporary choice for this page. Practical app guides remain separate from farming instruction.</p>
  </section>;
}
