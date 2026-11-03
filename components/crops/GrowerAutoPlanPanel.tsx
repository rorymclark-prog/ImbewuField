'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cropByKey } from '@/lib/crop-catalog';
import type { HarvestTarget } from '@/lib/crop-plan';
import { growerPlanningScopeKey, type GrowerPlanningProfile, type GrowerPlanningScope } from '@/lib/international/grower-planning';
import type { GrowerWorkflowSource } from '@/lib/international/grower-workflow-source';
import type { GrowerWorkflowDraft, GrowerWorkflowReview } from '@/lib/international/grower-workflow';

export interface GrowerAutoPlanPanelProps {
  scope: GrowerPlanningScope | null;
  source: GrowerWorkflowSource | null;
  sourceName: string;
  sourceIssue: string | null;
  checking: boolean;
  /** An invalidation epoch, never a private book token or a displayed source hash. */
  contextRevision: number;
  profiles: readonly GrowerPlanningProfile[];
  targets: readonly HarvestTarget[];
  targetSiteId: string | null;
  onRefresh: () => Promise<void>;
  onReview: (draft: GrowerWorkflowDraft) => Promise<GrowerWorkflowReview>;
  nurseryReview?: (review: Extract<GrowerWorkflowReview, { status: 'review' }>) => ReactNode;
}

const field = 'mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm';
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';
const emptyDraft = (): GrowerWorkflowDraft => ({ planningStart: '', planningEndExclusive: '', maxAssessments: '',
  targetProfiles: [], available: [], assumptionsConfirmed: false });
const issueLabels: Record<string, string> = {
  'mapped-site-required': 'Open a mapped site to use its saved buyer targets.',
  'saleable-share-missing': 'Enter your saleable percentage in the buyer target.',
  'zero-saleable-share': 'A zero saleable percentage cannot supply a positive buyer target.',
  'unit-weight-missing': 'Enter your harvest weight per sales unit in the buyer target.',
  'current-source-required': 'Check the current saved design before reviewing.',
  'saved-plan-changed': 'The saved plan changed. Reload it before reviewing.',
  'pending-plan-edits': 'Save or resolve your open plan edits before reviewing.',
  'source-changed': 'The saved design changed. Check it again before reviewing.',
  'context-changed': 'The site or account changed. Reopen this review in its current context.',
  'source-unavailable': 'Check the current saved design before reviewing.',
  'source-measures-invalid': 'Check the saved dimensions or calibrated polygons in the design.',
  'source-bed-held': 'This growing space needs its saved measurements reviewed.',
  'legacy-occupancy-unresolved': 'An existing sowing has no checked dated reservation here. Resolve it before declaring the bed available.',
  'ambiguous-planting-identities': 'Saved sowing identities overlap. Review the saved records before planning.',
  'unresolved-row-association': 'A saved sowing cannot be safely assigned to this or another site.',
  'assumptions-confirmation-required': 'Confirm that you supply these planning dates and availability as your estimates.',
  'planning-horizon-invalid': 'Enter a valid first planning date and a later exclusive end date.',
  'work-budget-required': 'Enter a whole-number search work limit.',
  'work-budget-invalid': 'The search work limit must be within the displayed software limits.',
  'selected-target-required': 'Select at least one saved buyer target.',
  'selected-profile-required': 'Choose a saved growing estimate for every selected target.',
  'selected-profile-invalid': 'A selected estimate is missing or invalid. Review its saved inputs.',
  'selected-profile-ambiguous': 'A selected estimate has an ambiguous identity. Review the saved profiles.',
  'selected-target-ambiguous': 'A selected buyer target has an ambiguous identity. Review the saved targets.',
  'availability-bed-blocked': 'A selected bed has unresolved occupation or measurements.',
  'availability-window-invalid': 'Enter a valid start and later exclusive end for every checked availability.',
  'plantsPerM2': 'Your plant-density estimate is missing or invalid.',
  'yieldKgPerM2': 'Your cycle harvest-weight estimate is missing or invalid.',
  'establishment': 'Your establishment method is missing or invalid.',
  'nurseryDays': 'Your nursery duration is missing or invalid.',
  'fieldEntryToFirstHarvestDays': 'Your field-entry to first-harvest duration is missing or invalid.',
  'pickingDays': 'Your picking duration is missing or invalid.',
  'fieldOccupancyDays': 'Your field occupancy is missing or invalid.',
  'turnaroundDays': 'Your turnaround after clearing is missing or invalid.',
  'allowedEntryMonths': 'Your allowed field-entry months are missing or invalid.',
};
const issueText = (code: string) => issueLabels[code] ?? issueLabels[code.replace(/^target-/, '')]
  ?? issueLabels[code.split(':').at(-1) ?? ''] ?? 'Check the saved source and entered assumptions before using this review.';

/** Unsaved review controls only. The parent owns all current-source reads. */
export default function GrowerAutoPlanPanel(props: GrowerAutoPlanPanelProps) {
  const [draft, setDraft] = useState(emptyDraft);
  const [review, setReview] = useState<GrowerWorkflowReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const live = useRef(props); live.current = props;
  useEffect(() => { generation.current++; setReview(null); setError(''); setBusy(false); }, [props.contextRevision]);
  useEffect(() => () => { generation.current++; }, []);
  const scopeKey = growerPlanningScopeKey(props.scope);
  const targets = props.scope?.kind === 'mapped-site' && props.targetSiteId
    ? props.targets.filter(target => target.siteId === props.targetSiteId) : [];
  const profiles = props.profiles.filter(profile => growerPlanningScopeKey(profile.scope) === scopeKey);
  const beds = props.source?.beds ?? [];
  function change(next: GrowerWorkflowDraft) { generation.current++; setDraft(next); setReview(null); setError(''); setBusy(false); }
  async function run() {
    const turn = ++generation.current, revision = props.contextRevision;
    setBusy(true); setReview(null); setError('');
    try {
      const result = await props.onReview(draft);
      if (generation.current === turn && live.current.contextRevision === revision) setReview(result);
    } catch { if (generation.current === turn) setError('Could not check the current saved inputs. Your plan has not changed.'); }
    finally { if (generation.current === turn) setBusy(false); }
  }
  function move(index: number, direction: number) {
    const rows = [...draft.targetProfiles], other = index + direction;
    if (other < 0 || other >= rows.length) return;
    [rows[index], rows[other]] = [rows[other], rows[index]];
    change({ ...draft, targetProfiles: rows });
  }
  const usable = review?.status === 'review' && (review.proposal.status === 'ready' || review.proposal.status === 'with-gaps');
  return <details className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-primary)]">
    <summary className="min-h-12 cursor-pointer px-4 py-3 font-display font-semibold">Automatic plan from your estimates</summary>
    <section aria-label="Grower automatic plan review" className="space-y-4 px-4 pb-4 text-sm">
      <p>Match your saved buyer targets to whole beds or field plots using your own growing estimates. This does not choose a local crop calendar or promise weekly deliveries.</p>
      <p>{props.sourceName}. Areas come from the saved design; check them against your ground measurements.</p>
      <button type="button" className={button} disabled={props.checking || busy || !scopeKey} onClick={() => {
        generation.current++; setReview(null); setError(''); void props.onRefresh().catch(() => setError('Could not check this saved design.'));
      }}>{props.checking ? 'Checking saved design…' : 'Check saved design'}</button>
      {props.sourceIssue && <p role="status">{props.sourceIssue}</p>}
      {!props.source && <p>No current design has been checked for this review.</p>}
      <fieldset className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <legend className="px-1 font-semibold">Buyer targets and priority</legend>
        <p>Save buyer targets and growing estimates above first. Select each target and its matching estimate profile. Earlier targets have priority.</p>
        {!targets.length && <p>{props.scope?.kind === 'mapped-site' ? 'No saved buyer targets for this mapped site.' : 'Open a mapped site to review its saved buyer targets.'}</p>}
        {targets.map(target => {
          const selected = draft.targetProfiles.find(row => row.targetId === target.id);
          return <div key={target.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={!!selected} onChange={event => change({ ...draft,
              targetProfiles: event.target.checked ? [...draft.targetProfiles, { targetId: target.id, profileId: '' }]
                : draft.targetProfiles.filter(row => row.targetId !== target.id) })} />Include {cropByKey(target.cropKey)?.name ?? target.cropKey}: {target.startMonth} to {target.endMonth}</label>
            {selected && <label className="block">Growing estimate for this target<select className={field} value={selected.profileId} onChange={event => change({ ...draft,
              targetProfiles: draft.targetProfiles.map(row => row.targetId === target.id ? { ...row, profileId: event.target.value } : row) })}>
              <option value="">Choose your saved estimate</option>{profiles.filter(profile => profile.cropKey === target.cropKey).map((profile, index) => <option key={profile.profileId} value={profile.profileId}>Saved estimate {index + 1}</option>)}
            </select></label>}
          </div>;
        })}
        {draft.targetProfiles.length > 0 && <ol className="space-y-2">{draft.targetProfiles.map((row, index) => <li key={row.targetId} className="flex flex-wrap items-center gap-2">
          <span>{index + 1}. {cropByKey(targets.find(target => target.id === row.targetId)?.cropKey ?? '')?.name ?? 'Unavailable target'}</span>
          <button type="button" className={button} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move target ${index + 1} earlier`}>Earlier</button>
          <button type="button" className={button} disabled={index === draft.targetProfiles.length - 1} onClick={() => move(index, 1)} aria-label={`Move target ${index + 1} later`}>Later</button>
        </li>)}</ol>}
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label>First planning date (UTC)<input type="date" className={field} value={draft.planningStart} onChange={event => change({ ...draft, planningStart: event.target.value })} /></label>
        <label>Planning ends before (UTC)<input type="date" className={field} value={draft.planningEndExclusive} onChange={event => change({ ...draft, planningEndExclusive: event.target.value })} /></label>
        <label>Search work limit<input type="number" min="1" max="10000" step="1" className={field} value={draft.maxAssessments} onChange={event => change({ ...draft, maxAssessments: event.target.value })} /></label>
      </div>
      <p className="text-xs">The search work limit is a software budget of 1–10,000 checks. Reaching it leaves the result unknown; it does not prove there is no space.</p>
      <fieldset className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <legend className="px-1 font-semibold">Your available growing space</legend>
        <p>Nothing is assumed free. Enter each available interval. Known existing occupations are checked separately and cannot be overridden here. End dates are exclusive.</p>
        {!beds.length && <p>No eligible saved bed or field-plot measurements have been checked.</p>}
        {beds.map(bed => {
          const available = draft.available.find(row => row.bedId === bed.id);
          const update = (values: Partial<GrowerWorkflowDraft['available'][number]>) => change({ ...draft, available: [
            ...draft.available.filter(row => row.bedId !== bed.id), { bedId: bed.id, start: '', endExclusive: '', confirmed: false, ...available, ...values }] });
          return <div key={bed.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={available?.confirmed ?? false} onChange={event => update({ confirmed: event.target.checked })} />I confirm availability for {bed.label} · {bed.areaM2} m²</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label>Available from<input type="date" className={field} value={available?.start ?? ''} onChange={event => update({ start: event.target.value })} /></label>
              <label>Available until (exclusive)<input type="date" className={field} value={available?.endExclusive ?? ''} onChange={event => update({ endExclusive: event.target.value })} /></label></div>
          </div>;
        })}
      </fieldset>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={draft.assumptionsConfirmed} onChange={event => change({ ...draft, assumptionsConfirmed: event.target.checked })} />I supply these planning dates and availability as my estimates.</label>
      <button type="button" className={button} disabled={!props.source || props.checking || busy || !scopeKey} onClick={() => void run()}>{busy ? 'Checking current inputs…' : 'Review automatic crop plan'}</button>
      {error && <p role="alert">{error}</p>}
      {review && <section aria-label="Automatic grower proposal" className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <h3 className="font-semibold">{usable ? 'Proposed whole-bed crop cycles' : 'Review inputs before planning'}</h3>
        {review.status === 'held' ? <ul>{review.issues.map((issue, index) => <li key={index}>{issueText(issue)}</li>)}</ul>
          : <><p>Search result: {review.proposal.status.replace(/-/g, ' ')}.</p>
            {!usable && <ul>{review.proposal.issues.map((issue, index) => <li key={index}>{issueText(issue)}</li>)}</ul>}
            {review.targetMetadata.map(target => <p key={target.targetId}>Buyer demand: {target.buyerTotalKg} kg over {target.days} days. Gross estimated cycle capacity needed: {target.grossCapacityRequiredKg} kg. Weekly delivery quantities remain unverified.</p>)}
            {usable && review.proposal.cycles.map(cycle => <article key={cycle.cycleId} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
              <h4 className="font-semibold">{beds.find(bed => bed.id === cycle.bedId)?.label ?? 'Saved growing space'} · {cropByKey(cycle.cropKey)?.name ?? cycle.cropKey}</h4>
              <p>{cycle.assessment.capacity.estimatedPlantCount} estimated plants; {cycle.assessment.capacity.estimatedYieldKg} kg for this whole cycle.</p>
              <dl>{Object.entries({ 'Nursery start': cycle.assessment.schedule.nurseryStartDate ?? 'No nursery phase', 'Field entry': cycle.assessment.schedule.fieldEntryDate,
                'First harvest': cycle.assessment.schedule.firstHarvestDate, 'Picking ends (exclusive)': cycle.assessment.schedule.harvestEndExclusiveDate,
                'Field clear': cycle.assessment.schedule.fieldClearDate, 'Next field entry': cycle.assessment.schedule.nextFieldEntryDate }).map(([label, value]) => <div key={label} className="flex flex-wrap gap-x-2"><dt>{label}:</dt><dd>{value}</dd></div>)}</dl>
            </article>)}
            {usable && review.proposal.demandResults.map(target => <p key={target.demandId}>Estimated gross capacity: {target.estimatedAllocatedKg ?? 'unknown'} kg; remaining: {target.unmetKg ?? 'unknown'} kg; excess: {target.excessEstimatedKg ?? 'unknown'} kg.</p>)}
          </>}
        {review.blockedBeds.length > 0 && <ul>{review.blockedBeds.map(bed => <li key={bed.bedId}>{beds.find(item => item.id === bed.bedId)?.label ?? 'Growing space'} held: {bed.reasons.map(issueText).join('; ')}</li>)}</ul>}
        <p>These are proposed estimates, not planted crops, observed stock or local farming approval. No crop cycle has been added to your saved plan.</p>
        {usable && review.status === 'review' && props.nurseryReview?.(review)}
      </section>}
    </section>
  </details>;
}
