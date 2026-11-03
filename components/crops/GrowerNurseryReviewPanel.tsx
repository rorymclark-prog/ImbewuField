'use client';

import { useEffect, useRef, useState } from 'react';
import type { NurserySettings } from '@/lib/nursery-settings';
import { sanitiseNurserySettings } from '@/lib/nursery-settings';
import type { GrowerWorkflowReview } from '@/lib/international/grower-workflow';
import type { GrowerWorkflowSource } from '@/lib/international/grower-workflow-source';
import { buildGrowerNurseryForecast, isGrowerNurseryForecastCurrent, nurserySettingsFingerprint,
  type GrowerNurseryRequest, type GrowerNurseryResult, type GrowerNurseryResourceWindow,
  type GrowerNurseryReservation } from '@/lib/international/grower-nursery';
import type { GrowerInput } from '@/lib/international/grower-planning';
import { buildGrowerNurseryCsv, growerNurseryIssueText as issueText } from '@/lib/nursery-export';
import { downloadFile } from '@/lib/file-delivery';
import { isSampleMode } from '@/lib/sample-mode';

export interface GrowerNurseryReviewPanelProps {
  review: Extract<GrowerWorkflowReview, { status: 'review' }>;
  source: GrowerWorkflowSource;
  settings?: NurserySettings;
  contextRevision: number;
  /** The parent rereads the source/book/actor and checks this original review. */
  onCheckCurrent: (review: Extract<GrowerWorkflowReview, { status: 'review' }>) => Promise<boolean>;
  sample?: boolean;
}

type ResourceRow = { row: number; resource: string; quantity: string; start: string; endExclusive: string };
type Controls = { settingsConfirmed: boolean; availabilityConfirmed: boolean; otherUsesConfirmed: boolean;
  fieldUsesConfirmed: boolean; availability: ResourceRow[]; otherUses: ResourceRow[]; contextKey: string };
const blank = (): Controls => ({ settingsConfirmed: false, availabilityConfirmed: false, otherUsesConfirmed: false,
  fieldUsesConfirmed: false, availability: [], otherUses: [], contextKey: '' });
const field = 'mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm';
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';
const quantity = (value: number | null) => value === null ? 'Unknown' : String(value);


/** The review is transient. Equipment remains in the existing canonical book. */
export default function GrowerNurseryReviewPanel(props: GrowerNurseryReviewPanelProps) {
  const [draftControls, setControls] = useState(blank);
  const [current, setCurrent] = useState<{ request: GrowerNurseryRequest; result: GrowerNurseryResult; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0), nextRow = useRef(0);
  const settings = props.settings ?? sanitiseNurserySettings(undefined);
  const viewSettings = sanitiseNurserySettings(settings);
  const settingsFingerprint = nurserySettingsFingerprint(settings);
  const sample = props.sample === true || isSampleMode();
  const key = JSON.stringify([props.contextRevision, props.source.sourceKey, props.source.sourceRevision,
    props.source.geometryFingerprint, props.source.resourceSiteId, props.review.proposal.fingerprint,
    settingsFingerprint, settingsFingerprint === null ? settings : null, sample]);
  // External edits may retain typed rows, but never inherit the grower's earlier
  // confirmation of different equipment, source or competing work.
  const controls = draftControls.contextKey === key ? draftControls : { ...draftControls, contextKey: key,
    settingsConfirmed: false, availabilityConfirmed: false, otherUsesConfirmed: false, fieldUsesConfirmed: false };
  const live = useRef({ props, key, sample }); live.current = { props, key, sample };
  useEffect(() => { generation.current++; setCurrent(null); setMessage(''); setBusy(false); }, [key]);
  useEffect(() => () => { generation.current++; }, []);
  const resources = [
    ...viewSettings.containers.filter(row => row.siteId === props.source.resourceSiteId).map(row => ({ key: `container:${row.id}`, id: row.id, kind: 'container' as const, name: row.name, unit: 'containers', capacity: row.owned })),
    ...viewSettings.spaces.filter(row => row.siteId === props.source.resourceSiteId).map(row => ({ key: `space:${row.id}`, id: row.id, kind: 'space' as const, name: row.name, unit: 'm²', capacity: row.usableM2 })),
  ];
  const shown = current?.key === key ? current : null;
  function change(next: Controls) { generation.current++; setControls({ ...next, contextKey: key }); setCurrent(null); setMessage(''); setBusy(false); }
  function add(kind: 'availability' | 'otherUses') {
    change({ ...controls, [kind]: [...controls[kind], { row: ++nextRow.current, resource: '', quantity: '', start: '', endExclusive: '' }] });
  }
  function update(kind: 'availability' | 'otherUses', row: number, patch: Partial<ResourceRow>) {
    change({ ...controls, [kind]: controls[kind].map(item => item.row === row ? { ...item, ...patch } : item) });
  }
  function makeRequest(recordedAt: string): GrowerNurseryRequest {
    const estimate = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
      provenance: { kind: 'grower-estimate', recordedAt, note: 'Confirmed for this nursery review; not an observed stock count.' } });
    const missing = { state: 'missing', reason: 'not-entered' } as const;
    const window = (row: ResourceRow): GrowerNurseryResourceWindow => {
      const resource = resources.find(item => item.key === row.resource);
      return { resourceKind: resource?.kind ?? 'container', resourceId: resource?.id ?? '', scope: props.source.scope,
        quantity: row.quantity.trim() === '' ? Number.NaN : Number(row.quantity), window: { start: row.start, endExclusive: row.endExclusive } };
    };
    const start = props.review.request.planningStart, end = props.review.request.planningEndExclusive;
    return { source: { kind: 'proposal', proposal: props.review.proposal, currentRequest: props.review.request,
      competingDemand: props.review.blockedBeds.some(bed => bed.reasons.some(reason => reason !== 'source-bed-held')) ? 'unresolved' : 'assessed-none' }, resourceContext: props.source, settings,
      settingsReview: controls.settingsConfirmed && settingsFingerprint ? { state: 'provided', value: settingsFingerprint, unit: 'nursery-settings-fingerprint',
        provenance: { kind: 'grower-record', recordedAt, reference: 'Saved nursery settings reconfirmed for this review; not their original measurement time.' } } : missing,
      horizon: start.state === 'provided' && end.state === 'provided' ? estimate({ start: start.value, endExclusive: end.value }, 'utc-date-window') : missing,
      availability: controls.availabilityConfirmed ? estimate(controls.availability.map(window), 'nursery-resource-windows') : missing,
      otherReservations: controls.otherUsesConfirmed ? estimate(controls.otherUses.map(row => ({ ...window(row), id: `review-use-${row.row}` } satisfies GrowerNurseryReservation)), 'nursery-resource-reservations') : missing,
      ...(props.review.request.reserved.length ? { accountedFieldReservations: controls.fieldUsesConfirmed
        ? estimate(props.review.request.reserved.map(row => row.id), 'nursery-accounted-field-reservations') : missing } : {}),
    };
  }
  async function review() {
    const turn = ++generation.current, snapshotKey = key, snapshotSample = isSampleMode();
    setBusy(true); setCurrent(null); setMessage('');
    try {
      if (!await props.onCheckCurrent(props.review)) throw Error('stale');
      if (generation.current !== turn || live.current.key !== snapshotKey || isSampleMode() !== snapshotSample) return;
      const request = makeRequest(new Date().toISOString());
      const result = buildGrowerNurseryForecast(request);
      setCurrent({ request, result, key: snapshotKey });
    } catch { if (generation.current === turn) setMessage('The crop plan or saved inputs could not be confirmed. Review the current crop proposal before continuing.'); }
    finally { if (generation.current === turn) setBusy(false); }
  }
  async function exportCsv() {
    if (!shown || busy || shown.result.fingerprint === null) return;
    const turn = ++generation.current, snapshot = shown, snapshotKey = key, snapshotSample = isSampleMode();
    setBusy(true); setMessage('');
    try {
      if (!await props.onCheckCurrent(props.review)) throw Error('stale');
      if (generation.current !== turn || live.current.key !== snapshotKey || isSampleMode() !== snapshotSample) return;
      const fresh = makeRequest(snapshot.request.settingsReview.state === 'provided'
        ? snapshot.request.settingsReview.provenance.recordedAt : snapshot.request.horizon.state === 'provided'
          ? snapshot.request.horizon.provenance.recordedAt : '');
      if (!isGrowerNurseryForecastCurrent(snapshot.result, fresh)) throw Error('stale');
      const csv = buildGrowerNurseryCsv(snapshot.result, props.source.beds, { sample });
      // No awaited share fallback follows this final current-input check.
      downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), sample ? 'ImbewuField-demo-own-nursery.csv' : 'ImbewuField-own-nursery.csv');
      setMessage('Reviewed nursery CSV downloaded. It contains proposed estimates, not live stock.');
    } catch { if (generation.current === turn) { setCurrent(null); setMessage('The current nursery review could not be confirmed. No file was delivered; review the inputs again.'); } }
    finally { if (generation.current === turn) setBusy(false); }
  }
  function resourceRows(kind: 'availability' | 'otherUses') {
    const label = kind === 'availability' ? 'Available resource' : 'Competing resource use';
    return controls[kind].map((row, index) => <fieldset key={row.row} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
      <legend>{label} {index + 1}</legend>
      <label className="block">Resource<select className={field} value={row.resource} onChange={event => update(kind, row.row, { resource: event.target.value })}>
        <option value="">Choose the saved resource</option>{resources.map(resource => <option key={resource.key} value={resource.key}>{resource.name} · {resource.unit}</option>)}
      </select></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label>Quantity<input className={field} type="number" min="0" step={resources.find(item => item.key === row.resource)?.kind === 'container' ? '1' : 'any'} value={row.quantity} onChange={event => update(kind, row.row, { quantity: event.target.value })} /></label>
        <label>From (UTC)<input className={field} type="date" value={row.start} onChange={event => update(kind, row.row, { start: event.target.value })} /></label>
        <label>Until (exclusive, UTC)<input className={field} type="date" value={row.endExclusive} onChange={event => update(kind, row.row, { endExclusive: event.target.value })} /></label>
      </div>
      <button type="button" className={button} onClick={() => change({ ...controls, [kind]: controls[kind].filter(item => item.row !== row.row) })}>Remove {label.toLowerCase()} {index + 1}</button>
    </fieldset>);
  }
  return <section aria-label="Own-input nursery review" className="space-y-3 rounded-xl border border-[var(--border)] p-3 text-sm">
    <h4 className="font-semibold">Nursery requirements for this proposed plan</h4>
    <p>Use the equipment and recipes saved above. Dates and final plant positions come from this crop proposal. No sowing has been accepted or observed.</p>
    {sample && <p className="font-semibold">DEMO — example planning data</p>}
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={controls.settingsConfirmed} onChange={event => change({ ...controls, settingsConfirmed: event.target.checked })} />I have reviewed the saved nursery equipment, recipes and loss estimates.</label>
    {resources.length ? <ul>{resources.map(resource => <li key={resource.key}>{resource.name}: {resource.capacity === undefined ? 'recorded allocation unknown' : `${resource.capacity} ${resource.unit} allocated to this plan`}. This does not establish dated availability.</li>)}</ul> : <p>No saved nursery containers or surfaces for this source.</p>}
    <fieldset className="space-y-3 rounded-lg border border-[var(--border)] p-3"><legend>Available nursery resources</legend>
      <p>Enter gross allocated quantities for each dated interval, before subtracting other uses. Nothing is assumed empty or free. End dates are exclusive.</p>
      {resourceRows('availability')}<button type="button" className={button} onClick={() => add('availability')}>Add resource availability</button>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={controls.availabilityConfirmed} onChange={event => change({ ...controls, availabilityConfirmed: event.target.checked })} />I confirm these dated resource allocations.</label>
    </fieldset>
    <fieldset className="space-y-3 rounded-lg border border-[var(--border)] p-3"><legend>Other nursery uses</legend>
      <p>List competing uses of these containers and surfaces, including existing crops and other projects. An empty list only means none after you confirm it.</p>
      {resourceRows('otherUses')}<button type="button" className={button} onClick={() => add('otherUses')}>Add competing nursery use</button>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={controls.otherUsesConfirmed} onChange={event => change({ ...controls, otherUsesConfirmed: event.target.checked })} />I have listed all other nursery uses, including none if this list is empty.</label>
    </fieldset>
    {props.review.request.reserved.length > 0 && <fieldset className="space-y-2 rounded-lg border border-[var(--border)] p-3"><legend>Known field occupations</legend>
      <ul>{props.review.request.reserved.map(row => <li key={row.id}>{props.source.beds.find(bed => bed.id === row.bedId)?.label ?? 'Growing space'}: {row.window.state === 'provided' ? `${row.window.value.start} to before ${row.window.value.endExclusive}` : 'dates unknown'}.</li>)}</ul>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={controls.fieldUsesConfirmed} onChange={event => change({ ...controls, fieldUsesConfirmed: event.target.checked })} />I accounted for nursery resources used by these existing field occupations.</label>
    </fieldset>}
    <button type="button" className={button} disabled={busy} onClick={() => void review()}>{busy ? 'Checking current nursery inputs…' : 'Review own nursery requirements'}</button>
    {message && <p role="status">{message}</p>}
    {shown && <section aria-label="Reviewed own nursery requirements" className="space-y-3">
      <h5 className="font-semibold">{shown.result.status === 'ready' ? 'Dated nursery estimates' : 'Incomplete nursery estimates'}</h5>
      <p>Resource headroom: {shown.result.headroom === 'within-budget' ? 'Within the supplied dated budget' : shown.result.headroom === 'shortage' ? 'Known shortage; incomplete demand may require more' : 'Unknown; spare capacity is not established'}.</p>
      <p>This comparison covers containers and surface only. Seed purchasing quantities and seedling readiness can still be unknown.</p>
      {!shown.result.batches.length && <p>This proposal has no transplant raising batch. Other nursery uses still need their own resource accounting.</p>}
      {shown.result.batches.map((batch, index) => <article key={batch.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <h6 className="font-semibold">Proposed raising batch {index + 1} · {batch.cropName}</h6>
        <p>{batch.bedIds.map(id => props.source.beds.find(bed => bed.id === id)?.label ?? 'Growing space').join(', ')}. {batch.startDate} to before {batch.endDateExclusive} (UTC).</p>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">{Object.entries({ 'Target final plants': batch.targetPositions, 'Starts to raise': batch.starts, 'Seeds': batch.seeds, 'Container fills': batch.trays, 'Outer container footprint (m²)': batch.areaM2 }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{quantity(value)}</dd></div>)}</dl>
        {batch.issues.length > 0 && <ul>{batch.issues.map((issue, i) => <li key={i}>{issueText(issue)}</li>)}</ul>}
      </article>)}
      {shown.result.resources.map(resource => <article key={`${resource.resourceKind}:${resource.id}`} className="rounded-lg border border-[var(--border)] p-3">
        <h6 className="font-semibold">{resource.name}</h6><p>Known simultaneous demand: {resource.peak ? `${resource.peak[0]}–${resource.peak[1]}` : 'Unknown'} {resource.resourceKind === 'container' ? 'containers' : 'm²'}. Known shortage: {quantity(resource.shortage)} {resource.resourceKind === 'container' ? 'containers' : 'm²'}. {resource.headroom === 'unknown' || !resource.availabilityComplete ? 'This capacity comparison remains unknown.' : resource.incomplete ? 'The container or surface comparison is known; other nursery inputs remain incomplete.' : 'Dated supplied inputs checked.'}</p>
      </article>)}
      {shown.result.issues.length > 0 && <ul>{shown.result.issues.map((issue, i) => <li key={i}>{issueText(issue)}</li>)}</ul>}
      <p>These are raising estimates, not observed stock or local crop instructions. Unknown requirements are not zero. Surface totals do not prove tray packing, paths, hardening or up-pot space.</p>
      <button type="button" className={button} disabled={busy || shown.result.fingerprint === null} onClick={() => void exportCsv()}>Download reviewed nursery CSV</button>
    </section>}
  </section>;
}
