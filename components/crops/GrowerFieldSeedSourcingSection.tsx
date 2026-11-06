'use client';

import { useEffect, useRef, useState } from 'react';
import GrowerSeedPackBudget from './GrowerSeedPackBudget';
import { useLanguage } from '@/lib/i18n-context';
import { formattingContext } from '@/lib/international/locales/formatting';
import type { GrowerSavedNurseryReview } from './useGrowerWorkflow';
import { reviewGrowerFieldSeedSourcing, type GrowerFieldSeedSourcingInput,
  type GrowerFieldSeedSourcingReview } from '@/lib/international/grower-seed-sourcing';
import { buildGrowerFieldSeedSourcingCsv } from '@/lib/nursery-export';
import { parseSeedPurchaseCountInput, type SeedPurchaseCountKind } from '@/lib/seed-purchase-inputs';
import { downloadFile } from '@/lib/file-delivery';
import { isSampleMode } from '@/lib/sample-mode';
import { captureSeedWorksheetContext, seedWorksheetContextIsCurrent,
  subscribeSeedWorksheetContext, revokeSeedWorksheetContext, type SeedWorksheetContext } from '@/lib/length-unit-preference';

export interface GrowerFieldSeedSourcingSectionProps {
  savedReview: GrowerSavedNurseryReview;
  contextRevision: number;
  sample?: boolean;
  onCheckSavedCurrent: (view: GrowerSavedNurseryReview) => Promise<boolean>;
  onCheckSavedBindingCurrent: (view: GrowerSavedNurseryReview) => boolean;
}
type Requirement = { plantingId: string; materialDeclaration: 'botanical-seed' | 'vegetative' | null; grossText: string; confirmed: boolean };
type Group = { id: string; label: string; plantingIds: readonly string[]; interchangeable: boolean; allocationText: string; packText: string };
type Authority = { props: GrowerFieldSeedSourcingSectionProps; binding: object; lifecycle: object; source: string;
  sampleMode: boolean; sample: boolean; proof: SeedWorksheetContext; retired: boolean; stop: () => void };
type Draft = { authority: Authority; options: GrowerFieldSeedSourcingReview; requirements: readonly Requirement[]; groups: readonly Group[] };
type Reviewed = { draft: Draft; review: GrowerFieldSeedSourcingReview };
type Operation = { kind: 'open' | 'review' | 'export'; authority: Authority; draft: Draft | null };
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';
const field = 'mt-1 min-h-11 min-w-0 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm disabled:opacity-50';
const reasonText: Record<string, string> = {
  'known-vegetative-material-not-seeds': 'The recorded propagation material is vegetative and cannot be counted as botanical seeds.',
  'vegetative-material-not-seeds': 'Vegetative planting material is not a botanical seed requirement.',
  'botanical-material-not-confirmed': 'Declare whether this requirement is for botanical seeds.',
  'gross-requirement-not-confirmed': 'Confirm your entered gross whole-seed requirement.',
  'gross-seed-count-invalid': 'Enter a safe whole seed count using digits, or leave it blank for unknown.',
  'crop-identification-unavailable': 'The public crop identity is unavailable.',
  'field-entry-date-unavailable': 'The planned field-entry date needs review.',
  'interchangeability-not-confirmed': 'Confirm that the selected cycles can use the same seed supply.',
  'cycle-membership-overlap': 'A cycle is selected in more than one supply group.',
  'cycle-membership-duplicate': 'A cycle is repeated in this group.',
  'cycle-not-in-current-review': 'A selected cycle is unavailable in this review.',
  'field-requirement-not-recorded': 'A selected cycle has no entered seed requirement.',
  'field-requirement-invalid': 'Review the selected cycle’s requirement entries.',
  'field-requirement-duplicate': 'A cycle has more than one requirement entry.',
  'group-input-invalid': 'Review this supply group’s entries and cycle selections.',
  'group-id-duplicate': 'Review duplicate supply groups.',
  'allocation-or-pack-count-invalid': 'Enter valid whole allocation and pack counts; a pack size must be positive.',
  'seed-requirement-overflow': 'The seed requirement cannot be safely totalled.',
  'seed-requirement-unknown': 'Some selected seed requirements are unknown.',
  'allocation-or-pack-count-unknown': 'Allocation or pack size is unknown.',
  'pack-count-product-overflow': 'The planned pack count exceeds safe calculation limits.',
  'source-has-held-rows': 'Some saved rows are held and are not counted in this field worksheet.',
  'legacy-source-rows-not-assessed': 'Older saved rows are not assessed by this field worksheet.',
  'nursery-cycles-excluded': 'Cycles with nursery raising need the separate nursery worksheet.',
  'represented-cycles-unassigned': 'Some represented field cycles have not been assigned to a valid supply group.',
  'no-represented-non-nursery-cycles': 'No accepted non-nursery field cycle is represented.',
};
const humanReason = (reason: string) => reasonText[reason] ?? 'Some saved planning details need review before this requirement can be counted.';
const quantity = (value: number | null | undefined) => value === null || value === undefined ? 'Unknown' : value.toLocaleString('en-US');
function sourceIdentity(view: GrowerSavedNurseryReview): string | null {
  try { return JSON.stringify([view.source, view.rows, view.cycleContext]); } catch { return null; }
}
function count(raw: string, kind: SeedPurchaseCountKind): number | string | null {
  const parsed = parseSeedPurchaseCountInput(raw, kind);
  return parsed.status === 'invalid' ? raw : parsed.value;
}
function input(draft: Draft): GrowerFieldSeedSourcingInput {
  return { rows: draft.authority.props.savedReview.rows, cycleContext: draft.authority.props.savedReview.cycleContext,
    requirements: draft.requirements.map(row => ({ plantingId: row.plantingId, materialDeclaration: row.materialDeclaration,
      grossRequiredSeeds: count(row.grossText, 'allocation'), grossRequirementConfirmed: row.confirmed })),
    groups: draft.groups.map(group => ({ id: group.id, label: group.label, plantingIds: group.plantingIds,
      interchangeabilityConfirmed: group.interchangeable, allocatedToPlanSeeds: count(group.allocationText, 'allocation'),
      seedsPerPack: count(group.packText, 'pack') })) };
}

/** Temporary entered field requirements; the parent remains the saved-book authority. */
export default function GrowerFieldSeedSourcingSection(props: GrowerFieldSeedSourcingSectionProps) {
  const { lang } = useLanguage();
  const [draft, setDraft] = useState<Draft | null>(null), [reviewed, setReviewed] = useState<Reviewed | null>(null);
  const [message, setMessage] = useState(''), [sampleLabel, setSampleLabel] = useState(props.sample === true);
  const [, render] = useState(0);
  const lifecycle = useRef<object | null>(null), authority = useRef<Authority | null>(null);
  const draftRef = useRef<Draft | null>(null), reviewedRef = useRef<Reviewed | null>(null), operation = useRef<Operation | null>(null);
  const handler = {}, latestHandler = useRef<object | null>(null); latestHandler.current = handler;
  const source = sourceIdentity(props.savedReview);
  const live = useRef({ props, source, binding: {} });
  if (live.current.props.savedReview !== props.savedReview || live.current.props.contextRevision !== props.contextRevision
    || live.current.props.sample !== props.sample || live.current.props.onCheckSavedCurrent !== props.onCheckSavedCurrent
    || live.current.props.onCheckSavedBindingCurrent !== props.onCheckSavedBindingCurrent
    || live.current.source !== source) live.current = { props, source, binding: {} };
  else live.current.props = props;
  const binding = live.current.binding, mountedLifetime = lifecycle.current;
  const nextGroup = useRef(0);

  function refresh() { latestHandler.current = null; render(value => value + 1); }
  function release(value: Authority) {
    value.stop(); revokeSeedWorksheetContext(value.proof);
    if (authority.current === value) authority.current = null;
  }
  function retire() {
    latestHandler.current = null;
    if (authority.current) release(authority.current);
    draftRef.current = null; reviewedRef.current = null; operation.current = null;
    if (lifecycle.current) { setDraft(null); setReviewed(null); setMessage(''); refresh(); }
  }
  function sourceCurrent(value: Authority): boolean {
    if (value.retired) return false;
    try {
      const current = authority.current === value && lifecycle.current === value.lifecycle && live.current.binding === value.binding
        && live.current.props.savedReview === value.props.savedReview && live.current.props.contextRevision === value.props.contextRevision
        && live.current.props.onCheckSavedCurrent === value.props.onCheckSavedCurrent
        && live.current.props.onCheckSavedBindingCurrent === value.props.onCheckSavedBindingCurrent
        && typeof value.props.onCheckSavedBindingCurrent === 'function'
        && value.props.onCheckSavedBindingCurrent(value.props.savedReview) === true
        && authority.current === value && lifecycle.current === value.lifecycle && live.current.binding === value.binding
        && sourceIdentity(value.props.savedReview) === value.source && isSampleMode() === value.sampleMode
        && seedWorksheetContextIsCurrent(value.proof);
      // A declined original binding withdraws this intent permanently. Only a
      // new explicit check can ask the existing source owner for fresh admission.
      if (!current) value.retired = true;
      return current;
    } catch { value.retired = true; return false; }
  }
  function operationCurrent(value: Operation): boolean {
    return operation.current === value && sourceCurrent(value.authority) && draftRef.current === value.draft;
  }
  const shownDraft = draft && draftRef.current === draft && sourceCurrent(draft.authority) ? draft : null;
  const shownReview = reviewed && reviewedRef.current === reviewed && reviewed.draft === shownDraft ? reviewed : null;
  const busy = !!operation.current && operation.current.authority.binding === binding;
  function editorCurrent() {
    return !!mountedLifetime && lifecycle.current === mountedLifetime && live.current.binding === binding
      && latestHandler.current === handler && !operation.current && (!shownDraft || sourceCurrent(shownDraft.authority));
  }

  useEffect(() => {
    const token = {}; lifecycle.current = token; setSampleLabel(props.sample === true || isSampleMode());
    setDraft(null); setReviewed(null); setMessage(''); refresh();
    const changed = () => { retire(); setSampleLabel(live.current.props.sample === true || isSampleMode()); };
    window.addEventListener('imbewu-sample-mode-changed', changed);
    return () => {
      if (lifecycle.current === token) lifecycle.current = null;
      if (authority.current) release(authority.current);
      draftRef.current = null; reviewedRef.current = null; operation.current = null; latestHandler.current = null;
      window.removeEventListener('imbewu-sample-mode-changed', changed);
    };
    // Every source/revision/permission change retires the original view receipt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding]);

  async function open() {
    if (!editorCurrent() || !source || !mountedLifetime) return;
    if (authority.current) release(authority.current);
    draftRef.current = null; reviewedRef.current = null; setDraft(null); setReviewed(null); setMessage('');
    const proof = captureSeedWorksheetContext();
    if (!proof) { setMessage('The current saved context could not be confirmed. Check saved records again.'); refresh(); return; }
    const value: Authority = { props, binding, lifecycle: mountedLifetime, source, proof, retired: false, stop: () => {},
      sampleMode: isSampleMode(), sample: props.sample === true || isSampleMode() };
    authority.current = value;
    value.stop = subscribeSeedWorksheetContext(proof, () => { if (authority.current === value) retire(); });
    const work: Operation = { kind: 'open', authority: value, draft: null }; operation.current = work; refresh();
    try {
      if (await props.onCheckSavedCurrent(props.savedReview) !== true) throw Error('held');
      if (!operationCurrent(work)) return;
      const options = reviewGrowerFieldSeedSourcing({ rows: props.savedReview.rows, cycleContext: props.savedReview.cycleContext, requirements: [], groups: [] });
      if (!operationCurrent(work) || options.status === 'unavailable') throw Error('held');
      if (await props.onCheckSavedCurrent(props.savedReview) !== true) throw Error('held');
      if (!operationCurrent(work)) return;
      const next: Draft = { authority: value, options, groups: [], requirements: options.cycles.map(cycle => ({
        plantingId: cycle.plantingId, materialDeclaration: null, grossText: '', confirmed: false })) };
      draftRef.current = next; setDraft(next);
    } catch { if (operation.current === work) { retire(); setMessage('The current saved field cycles could not be confirmed. Check saved records again.'); } }
    finally { if (operation.current === work) { operation.current = null; refresh(); } }
  }
  function edit(next: Draft) {
    if (!editorCurrent() || !shownDraft || draftRef.current !== shownDraft || next.authority !== shownDraft.authority) return;
    draftRef.current = next; reviewedRef.current = null; setDraft(next); setReviewed(null); setMessage(''); refresh();
  }
  function editRequirement(index: number, patch: Partial<Omit<Requirement, 'plantingId'>>) {
    if (!shownDraft) return;
    edit({ ...shownDraft, requirements: shownDraft.requirements.map((row, i) => i === index ? { ...row, ...patch } : row) });
  }
  function editGroup(index: number, patch: Partial<Omit<Group, 'id'>>) {
    if (!shownDraft) return;
    edit({ ...shownDraft, groups: shownDraft.groups.map((row, i) => i === index ? { ...row, ...patch } : row) });
  }
  function addGroup() {
    if (!shownDraft || !editorCurrent()) return;
    edit({ ...shownDraft, groups: [...shownDraft.groups, { id: `field-seed-supply-${++nextGroup.current}`, label: '', plantingIds: [],
      interchangeable: false, allocationText: '', packText: '' }] });
  }
  async function review() {
    if (!editorCurrent() || !shownDraft || !shownDraft.groups.length) return;
    const work: Operation = { kind: 'review', authority: shownDraft.authority, draft: shownDraft };
    operation.current = work; reviewedRef.current = null; setReviewed(null); setMessage(''); refresh();
    try {
      if (await work.authority.props.onCheckSavedCurrent(work.authority.props.savedReview) !== true) throw Error('held');
      if (!operationCurrent(work)) return;
      const result = reviewGrowerFieldSeedSourcing(input(shownDraft));
      if (!operationCurrent(work) || result.status === 'unavailable') throw Error('held');
      if (await work.authority.props.onCheckSavedCurrent(work.authority.props.savedReview) !== true) throw Error('held');
      if (!operationCurrent(work)) return;
      const next = { draft: shownDraft, review: result }; reviewedRef.current = next; setReviewed(next);
    } catch { if (operation.current === work) { retire(); setMessage('The current saved field cycles could not be confirmed. No current worksheet is available.'); } }
    finally { if (operation.current === work) { operation.current = null; refresh(); } }
  }
  async function exportCsv() {
    if (!editorCurrent() || !shownReview || reviewedRef.current !== shownReview) return;
    const work: Operation = { kind: 'export', authority: shownReview.draft.authority, draft: shownReview.draft };
    operation.current = work; setMessage(''); refresh();
    try {
      if (await work.authority.props.onCheckSavedCurrent(work.authority.props.savedReview) !== true) throw Error('held');
      if (!operationCurrent(work)) return;
      const request = input(shownReview.draft), replay = reviewGrowerFieldSeedSourcing(request);
      if (!operationCurrent(work) || replay.status === 'unavailable' || JSON.stringify(replay) !== JSON.stringify(shownReview.review)) throw Error('held');
      const csv = buildGrowerFieldSeedSourcingCsv(request, { sample: work.authority.sample });
      if (!operationCurrent(work)) return;
      if (await work.authority.props.onCheckSavedCurrent(work.authority.props.savedReview) !== true) throw Error('held');
      if (!operationCurrent(work)) return;
      const delivered = await downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        `ImbewuField${work.authority.sample ? '-demo' : ''}-field-seed-sourcing.csv`, async () => {
          if (!operationCurrent(work)) return false;
          const allowed = await work.authority.props.onCheckSavedCurrent(work.authority.props.savedReview);
          return allowed === true && operationCurrent(work);
        }, () => operationCurrent(work));
      if (operationCurrent(work) && delivered === 'downloaded') setMessage('Field seed worksheet downloaded. Temporary inputs are not saved; no stock was recorded or order placed.');
    } catch { if (operation.current === work) { retire(); setMessage('The current saved field cycles could not be confirmed. No worksheet was downloaded.'); } }
    finally { if (operation.current === work) { operation.current = null; refresh(); } }
  }

  return <section lang="en" aria-label="Field seed sourcing worksheet" className="min-w-0 space-y-3 rounded-xl border border-[var(--border)] p-3 text-sm [overflow-wrap:anywhere]">
    <h5 className="font-semibold">Field seed sourcing · cycles without nursery raising</h5>
    {sampleLabel && <p className="font-semibold">DEMO · temporary sample planning worksheet.</p>}
    <p>Use accepted saved field cycles that have no nursery phase. No nursery phase does not establish botanical direct sowing. Enter your own gross whole-seed requirement; final plant positions are not seed counts.</p>
    <p>Planning only, not a whole-farm purchase list. No stock is recorded, order placed or plan saved. Unknown counts are not zero. Nursery equipment and a nursery review horizon are not required for this separate field worksheet.</p>
    <button type="button" className={button} disabled={busy} onClick={() => void open()}>Check saved field cycles for seed sourcing</button>
    {shownDraft && <>
      <p>Represented field cycles: {shownDraft.options.representedCycleCount}. Held source rows: {shownDraft.options.heldSourceRowCount}. Legacy rows not assessed: {shownDraft.options.legacySourceRowCount}. Nursery cycles excluded: {shownDraft.options.excludedNurseryCycleCount}.</p>
      {shownDraft.options.sourceIssues.length > 0 && <ul>{[...new Set(shownDraft.options.sourceIssues.map(humanReason))].map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
      {!shownDraft.options.cycles.length && <p>No accepted non-nursery cycle is represented. This does not establish zero seed demand.</p>}
      {shownDraft.options.cycles.map((cycle, index) => {
        const row = shownDraft.requirements[index];
        return <fieldset key={cycle.plantingId} disabled={busy} aria-label={`Field cycle ${index + 1}`} className="min-w-0 space-y-2 rounded-lg border border-[var(--border)] p-3">
          <legend>Field cycle {index + 1} · {cycle.cropName || 'Crop identity unavailable'}</legend>
          <p>Planned field entry: {cycle.plannedFieldEntryDate ?? 'Unknown'} (UTC).</p>
          {cycle.knownMaterialUnit && <p>Recorded propagation material: {cycle.knownMaterialUnit}. This is held from botanical seed counts.</p>}
          {cycle.reasons.length > 0 && <ul>{cycle.reasons.map((reason, i) => <li key={i}>{humanReason(reason)}</li>)}</ul>}
          <label>Planting material declaration · field cycle {index + 1}<select className={field} value={row.materialDeclaration ?? ''} disabled={busy}
            onChange={event => editRequirement(index, { materialDeclaration: event.target.value === 'botanical-seed' ? 'botanical-seed' : event.target.value === 'vegetative' ? 'vegetative' : null })}>
            <option value="">Unknown / not declared</option><option value="botanical-seed">Botanical seeds</option><option value="vegetative">Vegetative material</option>
          </select></label>
          <label>Your gross required seeds · field cycle {index + 1}<input className={field} inputMode="numeric" value={row.grossText} disabled={busy}
            onChange={event => editRequirement(index, { grossText: event.target.value, confirmed: false })} /></label>
          <p>Whole seed count, including any allowances you have chosen. No allowances or rates are added here. Blank means unknown; an explicitly confirmed zero is a planning entry.</p>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={row.confirmed} disabled={busy}
            onChange={event => editRequirement(index, { confirmed: event.target.checked })} />I confirm my gross whole-seed requirement · field cycle {index + 1}</label>
        </fieldset>;
      })}
      {shownDraft.groups.map((group, index) => <fieldset key={group.id} disabled={busy} aria-label={`Field supply group ${index + 1}`} className="min-w-0 space-y-2 rounded-lg border border-[var(--border)] p-3">
        <legend>Field supply group {index + 1}</legend>
        <label>Your field supply group label (optional)<input className={field} value={group.label} disabled={busy} onChange={event => editGroup(index, { label: event.target.value })} /></label>
        {shownDraft.options.cycles.map((cycle, cycleIndex) => <label key={cycle.plantingId} className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={busy}
          checked={group.plantingIds.includes(cycle.plantingId)} onChange={event => editGroup(index, { plantingIds: event.target.checked
            ? [...group.plantingIds.filter(id => id !== cycle.plantingId), cycle.plantingId] : group.plantingIds.filter(id => id !== cycle.plantingId) })} />
          Field cycle {cycleIndex + 1} · {cycle.cropName || 'Crop identity unavailable'} · {cycle.plannedFieldEntryDate ?? 'date unknown'}</label>)}
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={group.interchangeable} disabled={busy}
          onChange={event => editGroup(index, { interchangeable: event.target.checked })} />I confirm these selected field cycles can use the same seed supply. This does not verify variety or seed-lot identity.</label>
        <label>Allocated to this field plan · whole seeds<input className={field} inputMode="numeric" value={group.allocationText} disabled={busy} onChange={event => editGroup(index, { allocationText: event.target.value })} /></label>
        <label>Seeds per pack (optional)<input className={field} inputMode="numeric" value={group.packText} disabled={busy} onChange={event => editGroup(index, { packText: event.target.value })} /></label>
        <p>Enter whole counts without separators. Blank means unknown. Allocation is a planning entry, not observed stock.</p>
        <button type="button" className={button} disabled={busy} onClick={() => edit({ ...shownDraft, groups: shownDraft.groups.filter((_, i) => i !== index) })}>Remove field supply group</button>
      </fieldset>)}
      <button type="button" className={button} disabled={busy || !shownDraft.options.cycles.length} onClick={addGroup}>Add field supply group</button>
      <button type="button" className={button} disabled={busy || !shownDraft.groups.length} onClick={() => void review()}>Review field seed sourcing</button>
    </>}
    {shownReview && <section aria-label="Reviewed field seed sourcing" className="space-y-3">
      <p>Status: {shownReview.review.status}. Field cycles assigned: {shownReview.review.assignedCycleCount}; unassigned: {shownReview.review.unassignedPlantingIds.length}. Whole-farm coverage is not assessed.</p>
      <p>{shownReview.review.guidance}</p>
      {shownReview.review.groups.map((group, index) => <article key={index} aria-label={`Reviewed field supply group ${index + 1}`} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <h6 className="font-semibold">Field supply group {index + 1} · {group.status === 'complete' ? 'Planning counts complete' : group.status === 'held' ? 'Review needed' : group.status === 'overflow' ? 'Count exceeds safe display' : 'Some counts unknown'}</h6>
        <p>Entered label: <span className="whitespace-pre-wrap">{group.identification.enteredLabel ?? 'Not recorded'}</span></p>
        <p>Public crops: {group.identification.cropNames.join(', ') || 'Unknown'}. Selected field cycles: {group.selectedCycleCount}.</p>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">{([
          ['Known seed subtotal', group.knownRequiredSeedsSubtotal], ['Required seeds', group.requiredSeeds],
          ['Additional seeds needed', group.counts?.neededSeeds], ['Planned packs', group.counts?.packsNeeded], ['Seeds in planned packs', group.counts?.plannedPackSeeds],
        ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{quantity(value)}</dd></div>)}</dl>
        {group.issues.length > 0 && <ul>{[...new Set(group.issues.map(humanReason))].map((reason, i) => <li key={i}>{reason}</li>)}</ul>}
      </article>)}
      <GrowerSeedPackBudget reviewProof={shownReview} review={shownReview.review}
        isCurrent={proof => proof === shownReview && reviewedRef.current === shownReview
          && draftRef.current === shownReview.draft && sourceCurrent(shownReview.draft.authority) && !operation.current}
        disabled={busy} sample={shownReview.draft.authority.sample} formatting={formattingContext(lang)} />
      <button type="button" className={button} disabled={busy} onClick={() => void exportCsv()}>Download field seed sourcing CSV</button>
    </section>}
    <p>The CSV includes your entered supply-group labels exactly, including whitespace. Leave out information you do not want in the file. Private saved association IDs and individual variety or lot references are not included.</p>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
