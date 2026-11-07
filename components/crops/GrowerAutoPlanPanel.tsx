'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cropByKey } from '@/lib/crop-catalog';
import { estimateNumberLabel as quantity } from '@/lib/format-figures';
import type { HarvestTarget } from '@/lib/crop-plan';
import { growerPlanningScopeKey, type GrowerPlanningProfile, type GrowerPlanningScope } from '@/lib/international/grower-planning';
import type { GrowerWorkflowSource } from '@/lib/international/grower-workflow-source';
import type { GrowerWorkflowDemandDraft, GrowerWorkflowDraft, GrowerWorkflowReview } from '@/lib/international/grower-workflow';
import { GROWER_DEMAND_SELECTION_MAX_ROWS, type GrowerEnteredDemandEntry, type GrowerEnteredDemandPurpose } from '@/lib/international/grower-entered-demand';
import type { MassQuantityEntry } from '@/lib/mass-units';
import GrowerEnteredMassField from './GrowerEnteredMassField';
import type { GrowerWorkflowAcceptanceResult, GrowerWorkflowAcceptanceState } from './useGrowerWorkflow';

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
  onAccept?: (review: Extract<GrowerWorkflowReview, { status: 'review' }>, displayedReviewIsCurrent: () => boolean) => Promise<GrowerWorkflowAcceptanceResult>;
  acceptance?: GrowerWorkflowAcceptanceState;
  nurseryReview?: (review: Extract<GrowerWorkflowReview, { status: 'review' }>) => ReactNode;
}

const field = 'mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm';
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';
type Availability = GrowerWorkflowDraft['available'][number];
type AvailabilityRow = Availability & { rowKey: string };
type PanelDraft = Omit<GrowerWorkflowDraft, 'available' | 'targetProfiles' | 'demands'> & {
  available: AvailabilityRow[];
  /** One ordered priority list for buyer targets and grower-entered demands. */
  demands: GrowerWorkflowDemandDraft[];
};
const emptyDraft = (): PanelDraft => ({ planningStart: '', planningEndExclusive: '', maxAssessments: '',
  demands: [], available: [], assumptionsConfirmed: false });
const purposeLabel = (purpose: GrowerEnteredDemandPurpose) => purpose === 'trial' ? 'Trial' : 'Household';
const demandKey = (row: GrowerWorkflowDemandDraft) => row.kind === 'buyer-target' ? `buyer:${row.targetId}` : `entered:${row.entryId}`;
/** Buyer-only selections keep the exact legacy request shape. Any grower-entered
 * row switches to the ordered list; buyer rows are never duplicated in both. */
function workflowRequest(draft: PanelDraft): GrowerWorkflowDraft {
  const available = draft.available.map(({ rowKey: _rowKey, ...row }) => row);
  const head = { planningStart: draft.planningStart, planningEndExclusive: draft.planningEndExclusive, maxAssessments: draft.maxAssessments };
  if (!draft.demands.some(row => row.kind === 'grower-entered')) {
    return { ...head, targetProfiles: draft.demands.flatMap(row => row.kind === 'buyer-target'
      ? [{ targetId: row.targetId, profileId: row.profileId }] : []), available, assumptionsConfirmed: draft.assumptionsConfirmed };
  }
  return { ...head, targetProfiles: [], demands: draft.demands.map(row => ({ ...row })), available, assumptionsConfirmed: draft.assumptionsConfirmed };
}
const issueLabels: Record<string, string> = {
  'mapped-site-required': 'Open a mapped site to use its saved buyer targets.',
  'saleable-share-missing': 'Enter your saleable percentage in the buyer target.',
  'zero-saleable-share': 'A zero saleable percentage cannot supply a positive buyer target.',
  'unit-weight-missing': 'Enter your harvest weight per sales unit in the buyer target.',
  'current-source-required': 'Check the current saved design before reviewing.',
  'unreadable-workflow-input': 'This review contains unreadable inputs. Enter the affected demand again before reviewing.',
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
  'availability-window-overlap': 'Confirmed intervals for the same growing space overlap. Correct or unconfirm the overlapping interval.',
  'plantsPerM2': 'Your plant-density estimate is missing or invalid.',
  'yieldKgPerM2': 'Your cycle harvest-weight estimate is missing or invalid.',
  'establishment': 'Your establishment method is missing or invalid.',
  'nurseryDays': 'Your nursery duration is missing or invalid.',
  'fieldEntryToFirstHarvestDays': 'Your field-entry to first-harvest duration is missing or invalid.',
  'pickingDays': 'Your picking duration is missing or invalid.',
  'fieldOccupancyDays': 'Your field occupancy is missing or invalid.',
  'turnaroundDays': 'Your turnaround after clearing is missing or invalid.',
  'allowedEntryMonths': 'Your allowed field-entry months are missing or invalid.',
  'totalKg': 'A demand weight has not been entered. Blank is not zero: enter 0 only when the known demand is zero.',
  'harvestWindow': 'A positive demand needs both harvest dates.',
  'demand-selection-ambiguous': 'This review mixed two demand lists. Reopen the form and review again.',
  'selected-demand-required': 'Select a saved buyer target or add a household or trial demand.',
  'demand-row-limit': `A review can include at most ${GROWER_DEMAND_SELECTION_MAX_ROWS} demands (a software limit).`,
  'demand-kind-invalid': 'A demand row was not recognised. Remove it and add it again.',
  'entered-demand-unavailable': 'A household or trial row could not be read. Remove it and add it again.',
  'entered-entry-unreadable': 'A household or trial row could not be read. Remove it and add it again.',
  'entered-entry-shape-invalid': 'A household or trial row could not be read. Remove it and add it again.',
  'entered-entry-id-invalid': 'A household or trial row could not be read. Remove it and add it again.',
  'entered-entry-ambiguous': 'Two household or trial rows share one identity. Remove one and add it again.',
  'entered-demand-id-collision': 'A household or trial row identity matches a saved buyer target. Remove the row and add it again.',
  'entered-entry-row-limit': `A review can include at most ${GROWER_DEMAND_SELECTION_MAX_ROWS} household or trial rows (a software limit).`,
  'entered-crop-required': 'Choose a crop for every household or trial demand.',
  'entered-profile-required': 'Choose a saved growing estimate for every household or trial demand.',
  'entered-profile-missing': 'A chosen growing estimate is no longer saved. Choose one again.',
  'entered-profile-ambiguous': 'A chosen growing estimate has an ambiguous identity. Review the saved profiles.',
  'entered-profile-invalid': 'A chosen growing estimate is invalid. Review its saved inputs.',
  'entered-profile-identity-mismatch': 'A chosen growing estimate changed. Choose it again.',
  'entered-scope-mismatch': 'A chosen growing estimate belongs to another site.',
  'entered-crop-identity-mismatch': 'A chosen growing estimate is for a different crop. Choose an estimate for this crop.',
  'entered-purpose-invalid': 'Choose household or trial for every entered demand.',
  'entered-gross-kg-invalid': 'Enter the gross harvest weight as a plain number of kilograms, or leave it blank.',
  'entered-gross-kg-format': 'Enter the gross harvest weight as a plain number of kilograms, for example 12 or 12.5.',
  'entered-gross-kg-negative': 'A gross harvest weight cannot be negative.',
  'entered-gross-kg-precision': 'Use at most six decimal places for kilograms.',
  'entered-gross-kg-range': 'This gross harvest weight is outside the software range.',
  'entered-gross-kg-representation-loss': 'This weight cannot be stored exactly. Enter a weight with fewer digits.',
  'entered-quantity-entry-conflict': 'This demand has two weight entries. Remove it and enter the weight again.',
  'entered-mass-entry-invalid': 'Enter a weight and choose kilograms or pounds.',
  'entered-mass-entry-unreadable': 'This weight could not be read. Enter it again.',
  'entered-mass-entry-format': 'This weight text is too long. Enter a shorter plain decimal.',
  'entered-decimal-representation-loss': 'This weight or its kilogram conversion cannot be stored exactly. Enter a weight with fewer digits.',
  'entered-incomplete-number': 'Finish entering your weight. Your original text is kept.',
  'entered-plain-decimal-required': 'Enter a plain decimal weight in the selected unit, without thousands separators.',
  'entered-outside-finite-range': 'This weight or its conversion is outside the software range.',
  'entered-harvest-window-incomplete': 'Enter both harvest dates, or leave both blank.',
  'entered-harvest-window-invalid': 'Enter a valid harvest start and a later exclusive end date.',
};
const issueText = (code: string) => issueLabels[code] ?? issueLabels[code.replace(/^target-/, '')]
  ?? issueLabels[code.split(':').at(-1) ?? '']
  ?? (code.startsWith('entered-') ? 'Check your household or trial demands before using this review.' : undefined)
  ?? 'Check the saved source and entered assumptions before using this review.';

/** Review and receipt UI. The parent owns current-source reads and guarded writes. */
export default function GrowerAutoPlanPanel(props: GrowerAutoPlanPanelProps) {
  const [draft, setDraft] = useState(emptyDraft);
  const [review, setReview] = useState<GrowerWorkflowReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receiptHidden, setReceiptHidden] = useState(false);
  const generation = useRef(0), accepting = useRef(false);
  const formId = useId(), rowSequence = useRef(0), virtualRows = useRef(new Map<string, string>());
  const draftRef = useRef(draft); draftRef.current = draft;
  const reviewGeneration = useRef<number | null>(null);
  const reviewContext = useRef<{ revision: number; source: GrowerWorkflowSource | null; scopeKey: string | null } | null>(null);
  const reviewRef = useRef(review); reviewRef.current = review;
  const live = useRef(props); live.current = props;
  const scopeKey = growerPlanningScopeKey(props.scope);
  useEffect(() => { generation.current++; reviewGeneration.current = null; reviewContext.current = null; setReview(null); setError(''); setBusy(false); }, [props.contextRevision, props.source, scopeKey]);
  useEffect(() => () => { generation.current++; }, []);
  const targets = props.scope?.kind === 'mapped-site' && props.targetSiteId
    ? props.targets.filter(target => target.siteId === props.targetSiteId) : [];
  const profiles = props.profiles.filter(profile => growerPlanningScopeKey(profile.scope) === scopeKey);
  const beds = props.source?.beds ?? [];
  const contextCurrent = () => live.current.contextRevision === props.contextRevision && live.current.source === props.source
    && growerPlanningScopeKey(live.current.scope) === scopeKey;
  const draftCurrent = () => contextCurrent() && draftRef.current === draft;
  const reviewMatchesContext = reviewContext.current?.revision === props.contextRevision && reviewContext.current?.source === props.source
    && reviewContext.current?.scopeKey === scopeKey;
  function change(next: PanelDraft) {
    if (!draftCurrent()) return;
    generation.current++; reviewGeneration.current = null; reviewContext.current = null; draftRef.current = next;
    setReceiptHidden(true); setDraft(next); setReview(null); setError(''); setBusy(false);
  }
  function newRowKey() { return `${formId}-availability-${++rowSequence.current}`; }
  function virtualKey(bedId: string) {
    let key = virtualRows.current.get(bedId);
    if (!key) { key = newRowKey(); virtualRows.current.set(bedId, key); }
    return key;
  }
  const blankRow = (bedId: string, rowKey = newRowKey()): AvailabilityRow => ({ rowKey, bedId, start: '', endExclusive: '', confirmed: false });
  function updateAvailability(bedId: string, rowKey: string, values: Partial<Omit<Availability, 'bedId'>>) {
    if (!draftCurrent()) return;
    const rows = draft.available.filter(row => row.bedId === bedId);
    if (rows.some(row => row.rowKey === rowKey)) {
      change({ ...draft, available: draft.available.map(row => row.bedId === bedId && row.rowKey === rowKey ? { ...row, ...values } : row) });
    } else if (!rows.length && virtualRows.current.get(bedId) === rowKey) {
      change({ ...draft, available: [...draft.available, { ...blankRow(bedId, rowKey), ...values }] });
    }
  }
  function addAvailability(bedId: string) {
    if (!draftCurrent()) return;
    const rows = draft.available.filter(row => row.bedId === bedId);
    change({ ...draft, available: [...draft.available,
      ...(!rows.length ? [blankRow(bedId, virtualKey(bedId))] : []), blankRow(bedId)] });
  }
  function removeAvailability(bedId: string, rowKey: string) {
    if (!draftCurrent() || !draft.available.some(row => row.bedId === bedId && row.rowKey === rowKey)) return;
    const available = draft.available.filter(row => row.bedId !== bedId || row.rowKey !== rowKey);
    // A removed row must not lend its callbacks or confirmation to the new
    // empty placeholder, even when it was the last interval for this bed.
    if (!available.some(row => row.bedId === bedId)) virtualRows.current.set(bedId, newRowKey());
    change({ ...draft, available });
  }
  /** A fresh identity per entered row. It becomes the persisted engine demand
   * suffix, so it must not repeat across sessions the way a useId sequence can. */
  function newEntryId() {
    try { const uuid = globalThis.crypto?.randomUUID?.(); if (uuid) return `entry-${uuid}`; } catch { /* fall through */ }
    return `${formId}-entered-${Date.now().toString(36)}-${++rowSequence.current}`;
  }
  function addEntered(purpose: GrowerEnteredDemandPurpose) {
    if (!draftCurrent() || draft.demands.length >= GROWER_DEMAND_SELECTION_MAX_ROWS) return;
    const row: GrowerEnteredDemandEntry = { kind: 'grower-entered', entryId: newEntryId(), purpose, cropKey: '', profileId: '',
      grossKg: '', harvestStart: '', harvestEndExclusive: '' };
    change({ ...draft, demands: [...draft.demands, row] });
  }
  // Every edit, including a household/trial switch, goes through change():
  // the displayed review, its save button and any old receipt are withdrawn.
  function updateEntered(entryId: string, values: Partial<Omit<GrowerEnteredDemandEntry, 'kind' | 'entryId' | 'grossKg' | 'quantityEntry'>>) {
    if (!draftCurrent() || !draft.demands.some(row => row.kind === 'grower-entered' && row.entryId === entryId)) return;
    change({ ...draft, demands: draft.demands.map(row => row.kind === 'grower-entered' && row.entryId === entryId ? { ...row, ...values } : row) });
  }
  function updateEnteredQuantity(entryId: string, quantityEntry: MassQuantityEntry): boolean {
    if (!draftCurrent() || !draft.demands.some(row => row.kind === 'grower-entered' && row.entryId === entryId)) return false;
    change({ ...draft, demands: draft.demands.map(row => {
      if (row.kind !== 'grower-entered' || row.entryId !== entryId) return row;
      const { grossKg: _legacy, quantityEntry: _previous, ...fields } = row;
      return { ...fields, quantityEntry: { ...quantityEntry } };
    }) });
    return true;
  }
  function removeEntered(entryId: string) {
    if (!draftCurrent() || !draft.demands.some(row => row.kind === 'grower-entered' && row.entryId === entryId)) return;
    change({ ...draft, demands: draft.demands.filter(row => row.kind !== 'grower-entered' || row.entryId !== entryId) });
  }
  async function run() {
    if (!draftCurrent()) return;
    const turn = ++generation.current, revision = props.contextRevision;
    reviewGeneration.current = null; reviewContext.current = null;
    setBusy(true); setReview(null); setError('');
    try {
      const request = workflowRequest(draft);
      const result = await props.onReview(request);
      if (generation.current === turn && live.current.contextRevision === revision && contextCurrent()) {
        reviewGeneration.current = turn; reviewContext.current = { revision, source: props.source, scopeKey }; setReview(result);
      }
    } catch { if (generation.current === turn) setError('Could not check the current saved inputs. Your plan has not changed.'); }
    finally { if (generation.current === turn) setBusy(false); }
  }
  // A superseded receipt follows a completed write. Keep its warning and block
  // retained save callbacks until a new source check or review replaces it.
  async function save() {
    if (accepting.current || live.current.acceptance?.status === 'confirmed' || live.current.acceptance?.status === 'superseded' || !props.onAccept || review?.status !== 'review' || !contextCurrent() || !reviewMatchesContext
      || reviewRef.current !== review || reviewGeneration.current !== generation.current) return;
    const expected = review, turn = ++generation.current, revision = props.contextRevision;
    reviewGeneration.current = turn;
    accepting.current = true; setReceiptHidden(false); setError('');
    try {
      await props.onAccept(expected, () => generation.current === turn && reviewRef.current === expected
        && live.current.contextRevision === revision && contextCurrent());
    } catch { if (generation.current === turn) setError('Could not confirm this save. Review the current saved records before trying again.'); }
    finally { accepting.current = false; }
  }
  function move(index: number, direction: number) {
    const rows = [...draft.demands], other = index + direction;
    if (other < 0 || other >= rows.length) return;
    [rows[index], rows[other]] = [rows[other], rows[index]];
    change({ ...draft, demands: rows });
  }
  const saving = props.acceptance?.status === 'saving';
  const saved = props.acceptance?.status === 'confirmed';
  const usable = review?.status === 'review' && (review.proposal.status === 'ready' || review.proposal.status === 'with-gaps');
  const mapped = props.scope?.kind === 'mapped-site';
  const entered = draft.demands.filter((row): row is GrowerEnteredDemandEntry => row.kind === 'grower-entered');
  const enteredCrops = [...new Set(profiles.map(profile => profile.cropKey))];
  const demandLabel = (row: GrowerWorkflowDemandDraft) => row.kind === 'buyer-target'
    ? `Buyer target · ${cropByKey(targets.find(target => target.id === row.targetId)?.cropKey ?? '')?.name ?? 'Unavailable target'}`
    : `${purposeLabel(row.purpose)} · ${cropByKey(row.cropKey)?.name ?? 'crop not chosen'}`;
  const enteredMeta = (demandId: string) => review?.status === 'review' ? review.enteredDemandMetadata?.find(row => row.demandId === demandId) : undefined;
  return <details className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-primary)]">
    <summary className="min-h-12 cursor-pointer px-4 py-3 font-display font-semibold">Automatic plan from your estimates</summary>
    <section aria-label="Grower automatic plan review" className="space-y-4 px-4 pb-4 text-sm">
      <p>Match your saved buyer targets to whole beds or field plots using your own growing estimates. This does not choose a local crop calendar or promise weekly deliveries.</p>
      <p>{props.sourceName}. Areas come from the saved design; check them against your ground measurements.</p>
      <button type="button" className={button} disabled={props.checking || busy || saving || !scopeKey} onClick={() => {
        if (!contextCurrent()) return;
        generation.current++; reviewGeneration.current = null; reviewContext.current = null; setReview(null); setError(''); void props.onRefresh().catch(() => setError('Could not check this saved design.'));
      }}>{props.checking ? 'Checking saved design…' : 'Check saved design'}</button>
      {props.sourceIssue && <p role="status">{props.sourceIssue}</p>}
      {!props.source && <p>No current design has been checked for this review.</p>}
      <fieldset className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <legend className="px-1 font-semibold">Buyer targets and priority</legend>
        <p>Save buyer targets and growing estimates above first. Select each target and its matching estimate profile. Earlier targets have priority.</p>
        {!targets.length && <p>{props.scope?.kind === 'mapped-site' ? 'No saved buyer targets for this mapped site.' : 'Open a mapped site to review its saved buyer targets.'}</p>}
        {targets.map(target => {
          const selected = draft.demands.find(row => row.kind === 'buyer-target' && row.targetId === target.id);
          return <div key={target.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={!!selected} onChange={event => change({ ...draft,
              demands: event.target.checked ? [...draft.demands, { kind: 'buyer-target', targetId: target.id, profileId: '' }]
                : draft.demands.filter(row => row.kind !== 'buyer-target' || row.targetId !== target.id) })} />Include {cropByKey(target.cropKey)?.name ?? target.cropKey}: {target.startMonth} to {target.endMonth}</label>
            {selected && <label className="block">Growing estimate for this target<select className={field} value={selected.profileId} onChange={event => change({ ...draft,
              demands: draft.demands.map(row => row.kind === 'buyer-target' && row.targetId === target.id ? { ...row, profileId: event.target.value } : row) })}>
              <option value="">Choose your saved estimate</option>{profiles.filter(profile => profile.cropKey === target.cropKey).map((profile, index) => <option key={profile.profileId} value={profile.profileId}>Saved estimate {index + 1}</option>)}
            </select></label>}
          </div>;
        })}
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <legend className="px-1 font-semibold">Household and trial growing (no buyer)</legend>
        <p>Plan your own food or a trial on the same measured beds with your own growing estimates. Enter the gross harvest weight this plan should cover across the whole harvest window. Choose kilograms or pounds independently of country or language. Blank means not entered; 0 means a known zero.</p>
        <p>This is not a nutrition or food-security assessment, a sale, or evidence that a crop or trial is suitable or safe.</p>
        {!mapped ? <p>Open a mapped site to plan household or trial growing. Unmapped designs stay on hold.</p> : <>
          {!enteredCrops.length && <p>Save a growing estimate for this site above first.</p>}
          {entered.map((row, index) => {
            const name = `${purposeLabel(row.purpose)} demand ${index + 1}`;
            return <div key={row.entryId} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
              <label className="block">Purpose — {name}<select className={field} value={row.purpose} onChange={event => {
                const purpose = event.target.value;
                if (purpose === 'household' || purpose === 'trial') updateEntered(row.entryId, { purpose });
              }}><option value="household">Household food</option><option value="trial">Trial</option></select></label>
              <label className="block">Crop — {name}<select className={field} value={row.cropKey}
                onChange={event => updateEntered(row.entryId, { cropKey: event.target.value, profileId: '' })}>
                <option value="">Choose a crop with a saved estimate</option>{enteredCrops.map(key => <option key={key} value={key}>{cropByKey(key)?.name ?? key}</option>)}
              </select></label>
              <label className="block">Growing estimate — {name}<select className={field} value={row.profileId} disabled={!row.cropKey}
                onChange={event => updateEntered(row.entryId, { profileId: event.target.value })}>
                <option value="">Choose your saved estimate</option>{profiles.filter(profile => profile.cropKey === row.cropKey).map((profile, profileIndex) => <option key={profile.profileId} value={profile.profileId}>Saved estimate {profileIndex + 1}</option>)}
              </select></label>
              <GrowerEnteredMassField name={name} fieldClass={field}
                entry={Object.hasOwn(row, 'quantityEntry') ? row.quantityEntry! : { unit: 'kg', text: row.grossKg! }}
                isCurrent={() => draftCurrent() && draft.demands.includes(row)}
                onEdit={entry => updateEnteredQuantity(row.entryId, entry)} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label>Harvest from (UTC) — {name}<input type="date" className={field} value={row.harvestStart} onChange={event => updateEntered(row.entryId, { harvestStart: event.target.value })} /></label>
                <label>Harvest ends before (UTC, exclusive) — {name}<input type="date" className={field} value={row.harvestEndExclusive} onChange={event => updateEntered(row.entryId, { harvestEndExclusive: event.target.value })} /></label>
              </div>
              <button type="button" className={button} aria-label={`Remove ${name}`} onClick={() => removeEntered(row.entryId)}>Remove demand</button>
            </div>;
          })}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={draft.demands.length >= GROWER_DEMAND_SELECTION_MAX_ROWS} onClick={() => addEntered('household')}>Add household demand</button>
            <button type="button" className={button} disabled={draft.demands.length >= GROWER_DEMAND_SELECTION_MAX_ROWS} onClick={() => addEntered('trial')}>Add trial demand</button>
          </div>
        </>}
      </fieldset>
      {draft.demands.length > 0 && <section aria-label="Demand priority" className="space-y-2 rounded-xl border border-[var(--border)] p-3">
        <h3 className="font-semibold">Demand priority</h3>
        <p>Earlier demands are planned first and keep their beds; later demands use what remains.</p>
        <ol className="space-y-2">{draft.demands.map((row, index) => <li key={demandKey(row)} className="flex flex-wrap items-center gap-2">
          <span>{index + 1}. {demandLabel(row)}</span>
          <button type="button" className={button} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move demand ${index + 1} earlier`}>Earlier</button>
          <button type="button" className={button} disabled={index === draft.demands.length - 1} onClick={() => move(index, 1)} aria-label={`Move demand ${index + 1} later`}>Later</button>
        </li>)}</ol>
      </section>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label>First planning date (UTC)<input type="date" className={field} value={draft.planningStart} onChange={event => change({ ...draft, planningStart: event.target.value })} /></label>
        <label>Planning ends before (UTC)<input type="date" className={field} value={draft.planningEndExclusive} onChange={event => change({ ...draft, planningEndExclusive: event.target.value })} /></label>
        <label>Search work limit<input type="number" min="1" max="10000" step="1" className={field} value={draft.maxAssessments} onChange={event => change({ ...draft, maxAssessments: event.target.value })} /></label>
      </div>
      <p className="text-xs">The search work limit is a software budget of 1–10,000 checks. Reaching it leaves the result unknown; it does not prove there is no space.</p>
      <fieldset className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <legend className="px-1 font-semibold">Your available growing space</legend>
        <p>Nothing is assumed free. Enter each available interval. Known existing occupations are checked separately and cannot be overridden here. End dates are exclusive: the end day is outside that interval. Gaps are unavailable. Adjacent intervals stay separate; a crop cycle must fit within one interval.</p>
        {!beds.length && <p>No eligible saved bed or field-plot measurements have been checked.</p>}
        {beds.map((bed, bedIndex) => {
          const savedRows = draft.available.filter(row => row.bedId === bed.id);
          const rows = savedRows.length ? savedRows : [blankRow(bed.id, virtualKey(bed.id))];
          return <div key={bed.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
            {rows.map((row, index) => {
              const suffix = `${bed.label}, growing space ${bedIndex + 1}, interval ${index + 1}`;
              return <div key={row.rowKey} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                <label htmlFor={`${row.rowKey}-confirmed`} className="flex min-h-11 items-center gap-2"><input id={`${row.rowKey}-confirmed`} type="checkbox" checked={row.confirmed} onChange={event => updateAvailability(bed.id, row.rowKey, { confirmed: event.target.checked })} />I confirm availability for {bed.label} · {quantity(bed.areaM2)} m² · growing space {bedIndex + 1}, interval {index + 1}</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label htmlFor={`${row.rowKey}-start`}>Available from — {suffix}<input id={`${row.rowKey}-start`} type="date" className={field} value={row.start} onChange={event => updateAvailability(bed.id, row.rowKey, { start: event.target.value })} /></label>
                  <label htmlFor={`${row.rowKey}-end`}>Available until (exclusive) — {suffix}<input id={`${row.rowKey}-end`} type="date" className={field} value={row.endExclusive} onChange={event => updateAvailability(bed.id, row.rowKey, { endExclusive: event.target.value })} /></label>
                </div>
                <button type="button" className={button} disabled={!savedRows.length} aria-label={`Remove interval ${index + 1} for ${bed.label}, growing space ${bedIndex + 1}`} onClick={() => removeAvailability(bed.id, row.rowKey)}>Remove interval</button>
              </div>;
            })}
            <button type="button" className={button} aria-label={`Add availability interval for ${bed.label}, growing space ${bedIndex + 1}`} onClick={() => addAvailability(bed.id)}>Add availability interval</button>
          </div>;
        })}
      </fieldset>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={draft.assumptionsConfirmed} onChange={event => change({ ...draft, assumptionsConfirmed: event.target.checked })} />I supply these planning dates and availability as my estimates.</label>
      <button type="button" className={button} disabled={!props.source || props.checking || busy || saving || !scopeKey} onClick={() => void run()}>{busy ? 'Checking current inputs…' : 'Review automatic crop plan'}</button>
      {error && <p role="alert">{error}</p>}
      {review && reviewMatchesContext && <section aria-label="Automatic grower proposal" className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <h3 className="font-semibold">{usable ? 'Proposed whole-bed crop cycles' : 'Review inputs before planning'}</h3>
        {review.status === 'held' ? <ul>{review.issues.map((issue, index) => <li key={index}>{issueText(issue)}</li>)}</ul>
          : <><p>Search result: {review.proposal.status.replace(/-/g, ' ')}.</p>
            {!usable && <ul>{review.proposal.issues.map((issue, index) => <li key={index}>{issueText(issue)}</li>)}</ul>}
            {review.targetMetadata.map(target => <p key={target.targetId}>Buyer demand: {quantity(target.buyerTotalKg)} kg over {target.days} days. Gross estimated cycle capacity needed: {quantity(target.grossCapacityRequiredKg)} kg. Weekly delivery quantities remain unverified.</p>)}
            {review.enteredDemandMetadata?.map(entry => <p key={entry.demandId}>{purposeLabel(entry.purpose)} demand you entered: {entry.grossCapacityKg === null ? 'weight not entered' : `${quantity(entry.grossCapacityKg)} kg gross for the whole window`}. No buyer or sale; not a nutrition check{entry.purpose === 'trial' ? ', trial evidence or safety finding' : ''}.</p>)}
            {review.enteredDemandMetadata?.map(entry => <p key={`entry:${entry.demandId}`}>Original entered weight for this whole demand: <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.quantityEntry.text || 'not entered'} {entry.quantityEntry.unit}</span>. Kilogram figures above are the canonical planning equivalent.</p>)}
            {usable && review.proposal.cycles.map(cycle => <article key={cycle.cycleId} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
              <h4 className="font-semibold">{beds.find(bed => bed.id === cycle.bedId)?.label ?? 'Saved growing space'} · {cropByKey(cycle.cropKey)?.name ?? cycle.cropKey}{enteredMeta(cycle.demandId) ? ` · ${purposeLabel(enteredMeta(cycle.demandId)!.purpose)}` : ''}</h4>
              <p>{quantity(cycle.assessment.capacity.estimatedPlantCount)} estimated plants; {quantity(cycle.assessment.capacity.estimatedYieldKg)} kg for this whole cycle.</p>
              <dl>{Object.entries({ 'Nursery start': cycle.assessment.schedule.nurseryStartDate ?? 'No nursery phase', 'Field entry': cycle.assessment.schedule.fieldEntryDate,
                'First harvest': cycle.assessment.schedule.firstHarvestDate, 'Picking ends (exclusive)': cycle.assessment.schedule.harvestEndExclusiveDate,
                'Field clear': cycle.assessment.schedule.fieldClearDate, 'Next field entry': cycle.assessment.schedule.nextFieldEntryDate }).map(([label, value]) => <div key={label} className="flex flex-wrap gap-x-2"><dt>{label}:</dt><dd>{value}</dd></div>)}</dl>
            </article>)}
            {usable && review.proposal.demandResults.map(target => <p key={target.demandId}>{review.enteredDemandMetadata
              ? `${enteredMeta(target.demandId) ? purposeLabel(enteredMeta(target.demandId)!.purpose) : 'Buyer target'}: ` : ''}Estimated gross capacity: {quantity(target.estimatedAllocatedKg)} kg; remaining: {quantity(target.unmetKg)} kg; excess: {quantity(target.excessEstimatedKg)} kg.</p>)}
          </>}
        {review.blockedBeds.length > 0 && <ul>{review.blockedBeds.map(bed => <li key={bed.bedId}>{beds.find(item => item.id === bed.bedId)?.label ?? 'Growing space'} held: {bed.reasons.map(issueText).join('; ')}</li>)}</ul>}
        {!saved && props.acceptance?.status !== 'superseded' && <p>These are proposed estimates, not planted crops, observed stock or local farming approval. No crop cycle has been added to your saved plan.</p>}
        {props.onAccept && review.status === 'review' && review.proposal.status === 'ready' && review.proposal.cycles.length > 0 && <button
          type="button" className={button} disabled={saving || saved || props.acceptance?.status === 'superseded' || props.checking || busy} onClick={() => void save()}>
          {saving ? 'Checking and saving planned cycles…' : `Save all ${review.proposal.cycles.length} planned crop cycles`}
        </button>}
        {usable && review.status === 'review' && props.nurseryReview?.(review)}
      </section>}
      {!receiptHidden && props.acceptance?.status === 'confirmed' && <p role="status">{props.acceptance.sample ? 'DEMO — ' : ''}{props.acceptance.rows} planned crop cycles saved {props.acceptance.sample ? 'in the example workspace' : 'on this device'}. No sowing, harvest, stock or sales have been recorded. Nursery resource availability remains a separate check. <Link className="underline" href="/cropplan" prefetch={false}>Open dated work in the Task Planner</Link>.</p>}
      {props.acceptance?.status === 'failed' && <p role="alert">The crop cycles could not be saved. Keep this review open and try again when storage is available.</p>}
      {props.acceptance?.status === 'held' && <p role="alert">No crop cycles were saved. {props.acceptance.reasons.map(issueText).join(' ')}</p>}
      {props.acceptance?.status === 'superseded' && <p role="alert">The write completed, but the current saved plan could not be confirmed. Reopen its saved records before continuing. Do not repeat this save from the old review.</p>}
    </section>
  </details>;
}
