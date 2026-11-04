'use client';

import { useEffect, useRef, useState } from 'react';
import { estimateNumberLabel as quantity } from '@/lib/format-figures';
import type { NurserySettings } from '@/lib/nursery-settings';
import { sanitiseNurserySettings } from '@/lib/nursery-settings';
import type { GrowerWorkflowReview } from '@/lib/international/grower-workflow';
import type { GrowerWorkflowSource } from '@/lib/international/grower-workflow-source';
import { buildGrowerNurseryForecast, isGrowerNurseryForecastCurrent, nurserySettingsFingerprint,
  projectGrowerNurseryPreparation,
  type GrowerNurseryRequest, type GrowerNurseryResult, type GrowerNurseryResourceWindow,
  type GrowerNurseryReservation } from '@/lib/international/grower-nursery';
import type { GrowerInput } from '@/lib/international/grower-planning';
import { buildGrowerNurseryCsv, buildGrowerNurseryPreparationCsv, buildGrowerNurseryPreparationPdf, growerNurseryIssueText as issueText } from '@/lib/nursery-export';
import { downloadFile } from '@/lib/file-delivery';
import { isSampleMode } from '@/lib/sample-mode';
import {
  captureNurseryUnitPreferenceContext,
  nurseryUnitPreferenceContextIsCurrent,
  readNurseryUnitPreference,
  writeNurseryUnitPreference,
  subscribeNurseryUnitPreferenceContext,
  subscribeNurseryUnitPreferenceValue,
  revokeNurseryUnitPreferenceContext,
  type NurseryUnitChoice,
} from '@/lib/length-unit-preference';
import {
  createNurseryDimensionDraft,
  editNurseryDimensionDraft,
  readNurseryDimensionDraft,
  switchNurseryDimensionDraftUnit,
  formatNurseryDimension,
  type NurseryDimensionDraft,
} from '@/lib/length-units';

export interface GrowerNurseryReviewPanelProps {
  review: Extract<GrowerWorkflowReview, { status: 'review' }>;
  source: GrowerWorkflowSource;
  settings?: NurserySettings;
  contextRevision: number;
  /** The parent rereads the source/book/actor and checks this original review. */
  onCheckCurrent: (review: Extract<GrowerWorkflowReview, { status: 'review' }>) => Promise<boolean>;
  sample?: boolean;
}

type SurfaceDraft = NurseryDimensionDraft<'usableM2'>;
type ResourceRow = {
  row: number;
  resource: string;
  quantity: string;
  surfaceDraft: SurfaceDraft | null;
  start: string;
  endExclusive: string;
};
type Controls = {
  settingsConfirmed: boolean;
  availabilityConfirmed: boolean;
  otherUsesConfirmed: boolean;
  fieldUsesConfirmed: boolean;
  availability: ResourceRow[];
  otherUses: ResourceRow[];
  contextKey: string;
};
const blank = (): Controls => ({
  settingsConfirmed: false,
  availabilityConfirmed: false,
  otherUsesConfirmed: false,
  fieldUsesConfirmed: false,
  availability: [],
  otherUses: [],
  contextKey: '',
});
const field = 'mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm';
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';

function formatArea(m2: number | undefined | null, unit: NurseryUnitChoice): string {
  if (m2 === undefined || m2 === null || !Number.isFinite(m2)) return 'Unknown';
  const formatted = formatNurseryDimension(m2, unit === 'metric' ? 'm2' : 'ft2');
  return formatted !== null ? `${formatted} ${unit === 'metric' ? 'm²' : 'ft²'}` : 'Unknown';
}

function makeSurfaceDraft(sourceKey: string, unit: NurseryUnitChoice, text = ''): SurfaceDraft {
  const initial = createNurseryDimensionDraft<'usableM2'>({
    sourceKey,
    unit: unit === 'metric' ? 'm2' : 'ft2',
    values: { usableM2: undefined },
  });
  return text ? editNurseryDimensionDraft(initial, 'usableM2', text) : initial;
}

/** The review is transient. Equipment remains in the existing canonical book. */
export default function GrowerNurseryReviewPanel(props: GrowerNurseryReviewPanelProps) {
  const [draftControls, setControls] = useState(blank);
  const [unit, setUnit] = useState<NurseryUnitChoice>('metric');
  const [unitNote, setUnitNote] = useState('');
  const [current, setCurrent] = useState<{ request: GrowerNurseryRequest; result: GrowerNurseryResult; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0), nextRow = useRef(0);
  const prefContext = useRef<ReturnType<typeof captureNurseryUnitPreferenceContext>>(null);
  const settings = props.settings ?? sanitiseNurserySettings(undefined);
  const viewSettings = sanitiseNurserySettings(settings);
  const settingsFingerprint = nurserySettingsFingerprint(settings);
  const sample = props.sample === true || isSampleMode();
  const key = JSON.stringify([
    props.contextRevision,
    props.source.sourceKey,
    props.source.sourceRevision,
    props.source.geometryFingerprint,
    props.source.resourceSiteId,
    props.review.proposal.fingerprint,
    settingsFingerprint,
    settingsFingerprint === null ? settings : null,
    sample,
  ]);

  const controls = draftControls.contextKey === key ? draftControls : {
    ...draftControls,
    contextKey: key,
    settingsConfirmed: false,
    availabilityConfirmed: false,
    otherUsesConfirmed: false,
    fieldUsesConfirmed: false,
  };

  const handleExternalUnitRef = useRef<(u: NurseryUnitChoice) => void>(() => {});
  const live = useRef({ props, key, sample, controls, unit });
  live.current = { props, key, sample, controls, unit };

  const [prefEpoch, setPrefEpoch] = useState(0);

  // Preference context acquisition & lifecycle
  useEffect(() => {
    const ctx = captureNurseryUnitPreferenceContext();
    prefContext.current = ctx;
    const read = readNurseryUnitPreference(ctx);
    setUnit(read.unit);

    const stopContext = subscribeNurseryUnitPreferenceContext(ctx, () => {
      // Actor or sample lease transition: trigger fresh effect cycle with clean reset
      generation.current++;
      setCurrent(null);
      setMessage('');
      setUnitNote('');
      // Invalidate existing surface drafts and reset confirmations across actor transition
      setControls(blank());
      setPrefEpoch(e => e + 1);
    });

    const stopValue = subscribeNurseryUnitPreferenceValue(ctx, (newUnit) => {
      handleExternalUnitRef.current(newUnit);
    });

    return () => {
      stopContext();
      stopValue();
      revokeNurseryUnitPreferenceContext(ctx);
      if (prefContext.current === ctx) {
        prefContext.current = null;
      }
    };
  }, [prefEpoch]);

  useEffect(() => {
    generation.current++;
    setCurrent(null);
    setMessage('');
    setBusy(false);
  }, [key]);

  useEffect(() => () => { generation.current++; }, []);

  const resources = [
    ...viewSettings.containers.filter(row => row.siteId === props.source.resourceSiteId).map(row => ({
      key: `container:${row.id}`,
      id: row.id,
      kind: 'container' as const,
      name: row.name,
      unitLabel: 'containers',
      capacityLabel: row.owned === undefined ? 'recorded allocation unknown' : `${row.owned} containers`,
    })),
    ...viewSettings.spaces.filter(row => row.siteId === props.source.resourceSiteId).map(row => ({
      key: `space:${row.id}`,
      id: row.id,
      kind: 'space' as const,
      name: row.name,
      unitLabel: unit === 'metric' ? 'm²' : 'ft²',
      capacityLabel: row.usableM2 === undefined ? 'recorded allocation unknown' : `${formatArea(row.usableM2, unit)}`,
    })),
  ];

  const shown = current?.key === key ? current : null;
  const preparation = shown ? projectGrowerNurseryPreparation(shown.result) : null;

  function change(next: Controls) {
    generation.current++;
    setControls({ ...next, contextKey: key });
    setCurrent(null);
    setMessage('');
    setBusy(false);
  }

  function applySwitchedRows(nextUnit: NurseryUnitChoice, currentKey: string): { ok: true; availability: ResourceRow[]; otherUses: ResourceRow[] } | { ok: false } {
    const nextDimensionUnit = nextUnit === 'metric' ? 'm2' : 'ft2';
    let switchBlocked = false;
    const switchedAvailability: ResourceRow[] = [];
    const switchedOtherUses: ResourceRow[] = [];

    const switchRows = (rows: ResourceRow[], dest: ResourceRow[]) => {
      for (const row of rows) {
        if (!row.surfaceDraft) {
          dest.push(row);
        } else {
          // Attempt switch with current draft; if draft sourceKey !== currentKey, switch returns status: 'held'
          const switched = switchNurseryDimensionDraftUnit(row.surfaceDraft, nextDimensionUnit, currentKey);
          if (switched.status !== 'ready') {
            switchBlocked = true;
            dest.push(row);
          } else {
            const fieldText = switched.draft.fields.usableM2.text;
            dest.push({
              ...row,
              quantity: fieldText,
              surfaceDraft: switched.draft,
            });
          }
        }
      }
    };

    switchRows(live.current.controls.availability, switchedAvailability);
    switchRows(live.current.controls.otherUses, switchedOtherUses);

    if (switchBlocked) return { ok: false };
    return { ok: true, availability: switchedAvailability, otherUses: switchedOtherUses };
  }

  function handleExternalUnit(newUnit: NurseryUnitChoice) {
    if (newUnit === live.current.unit) return;
    const outcome = applySwitchedRows(newUnit, live.current.key);
    if (!outcome.ok) {
      setUnitNote('Complete or correct entered area numbers before changing units.');
      return;
    }
    setUnit(newUnit);
    setUnitNote('');
    change({
      ...live.current.controls,
      availability: outcome.availability,
      otherUses: outcome.otherUses,
    });
  }

  handleExternalUnitRef.current = handleExternalUnit;

  function handleUserUnitSwitch(nextUnit: NurseryUnitChoice) {
    if (nextUnit === live.current.unit) return;
    const outcome = applySwitchedRows(nextUnit, live.current.key);
    if (!outcome.ok) {
      setUnitNote('Complete or correct entered area numbers before changing units.');
      return;
    }
    const targetCtx = prefContext.current;
    const targetKey = live.current.key;
    const targetGeneration = generation.current;

    // Write preference without echoing back into subscriber recursion.
    // An earlier external listener invoked during writeNurseryUnitPreference may synchronously
    // trigger an actor change or enter sample mode, revoking targetCtx or resetting controls.
    writeNurseryUnitPreference(targetCtx, nextUnit);

    // Recheck that preference context is still current, key is unchanged, and no lifecycle
    // or actor transition occurred during the synchronous write before committing controls or unit.
    if (
      !nurseryUnitPreferenceContextIsCurrent(targetCtx) ||
      prefContext.current !== targetCtx ||
      live.current.key !== targetKey ||
      generation.current !== targetGeneration
    ) {
      return;
    }

    setUnit(nextUnit);
    setUnitNote('');
    change({
      ...live.current.controls,
      availability: outcome.availability,
      otherUses: outcome.otherUses,
    });
  }

  function add(kind: 'availability' | 'otherUses') {
    change({
      ...controls,
      [kind]: [
        ...controls[kind],
        { row: ++nextRow.current, resource: '', quantity: '', surfaceDraft: null, start: '', endExclusive: '' },
      ],
    });
  }

  function update(kind: 'availability' | 'otherUses', rowNumber: number, patch: Partial<ResourceRow>) {
    const updated = controls[kind].map(item => {
      if (item.row !== rowNumber) return item;
      const next = { ...item, ...patch };
      // Check if resource changed
      if (patch.resource !== undefined && patch.resource !== item.resource) {
        const res = resources.find(r => r.key === patch.resource);
        if (res?.kind === 'space') {
          next.quantity = '';
          next.surfaceDraft = makeSurfaceDraft(key, unit, '');
        } else {
          next.quantity = '';
          next.surfaceDraft = null;
        }
      } else if (patch.quantity !== undefined && next.surfaceDraft) {
        // If sourceKey changed, creating a fresh draft from new input text for the active key
        const baseDraft = next.surfaceDraft.sourceKey === key
          ? next.surfaceDraft
          : makeSurfaceDraft(key, unit, '');
        next.surfaceDraft = editNurseryDimensionDraft(baseDraft, 'usableM2', patch.quantity);
      }
      return next;
    });
    change({ ...controls, [kind]: updated });
  }

  function makeRequest(recordedAt: string): GrowerNurseryRequest {
    const estimate = <T, U extends string>(value: T, unitStr: U): GrowerInput<T, U> => ({
      state: 'provided',
      value,
      unit: unitStr,
      provenance: { kind: 'grower-estimate', recordedAt, note: 'Confirmed for this nursery review; not an observed stock count.' },
    });
    const missing = { state: 'missing', reason: 'not-entered' } as const;

    const window = (row: ResourceRow): GrowerNurseryResourceWindow => {
      const resource = resources.find(item => item.key === row.resource);
      let canonicalQuantity = Number.NaN;
      if (resource?.kind === 'space' && row.surfaceDraft) {
        const read = readNurseryDimensionDraft(row.surfaceDraft, key);
        if (read.status === 'ready' && read.values.usableM2 !== undefined) {
          canonicalQuantity = read.values.usableM2;
        }
      } else if (row.quantity.trim() !== '') {
        canonicalQuantity = Number(row.quantity);
      }
      return {
        resourceKind: resource?.kind ?? 'container',
        resourceId: resource?.id ?? '',
        scope: props.source.scope,
        quantity: canonicalQuantity,
        window: { start: row.start, endExclusive: row.endExclusive },
      };
    };

    const start = props.review.request.planningStart, end = props.review.request.planningEndExclusive;
    return {
      source: {
        kind: 'proposal',
        proposal: props.review.proposal,
        currentRequest: props.review.request,
        competingDemand: props.review.blockedBeds.some(bed => bed.reasons.some(reason => reason !== 'source-bed-held')) ? 'unresolved' : 'assessed-none',
      },
      resourceContext: props.source,
      settings,
      settingsReview: controls.settingsConfirmed && settingsFingerprint ? {
        state: 'provided',
        value: settingsFingerprint,
        unit: 'nursery-settings-fingerprint',
        provenance: { kind: 'grower-record', recordedAt, reference: 'Saved nursery settings reconfirmed for this review; not their original measurement time.' },
      } : missing,
      horizon: start.state === 'provided' && end.state === 'provided' ? estimate({ start: start.value, endExclusive: end.value }, 'utc-date-window') : missing,
      availability: controls.availabilityConfirmed ? estimate(controls.availability.map(window), 'nursery-resource-windows') : missing,
      otherReservations: controls.otherUsesConfirmed ? estimate(controls.otherUses.map(row => ({ ...window(row), id: `review-use-${row.row}` } satisfies GrowerNurseryReservation)), 'nursery-resource-reservations') : missing,
      ...(props.review.request.reserved.length ? {
        accountedFieldReservations: controls.fieldUsesConfirmed
          ? estimate(props.review.request.reserved.map(row => row.id), 'nursery-accounted-field-reservations') : missing,
      } : {}),
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
    } catch {
      if (generation.current === turn) setMessage('The crop plan or saved inputs could not be confirmed. Review the current crop proposal before continuing.');
    } finally {
      if (generation.current === turn) setBusy(false);
    }
  }

  async function exportReview(kind: 'resource-review' | 'preparation' | 'preparation-pdf' = 'resource-review') {
    if (!shown || busy || shown.result.fingerprint === null) return;
    if (kind !== 'resource-review' && preparation?.status !== 'available') return;
    const turn = ++generation.current, snapshot = shown, snapshotKey = key, snapshotSample = isSampleMode();
    const sameDisplay = () => generation.current === turn && live.current.key === snapshotKey && isSampleMode() === snapshotSample;
    const sameInputs = () => isGrowerNurseryForecastCurrent(snapshot.result, makeRequest(snapshot.request.settingsReview.state === 'provided'
      ? snapshot.request.settingsReview.provenance.recordedAt : snapshot.request.horizon.state === 'provided'
        ? snapshot.request.horizon.provenance.recordedAt : ''));
    setBusy(true); setMessage('');
    try {
      if (!await props.onCheckCurrent(props.review)) throw Error('stale');
      if (!sameDisplay()) return;
      if (!sameInputs()) throw Error('stale');
      if (kind === 'preparation-pdf') {
        const pdf = await buildGrowerNurseryPreparationPdf(snapshot.result, { sample });
        if (!sameDisplay()) return;
        // Loading the PDF writer yields. A matching displayed key alone cannot
        // prove that saved source/account records stayed current meanwhile.
        if (!await props.onCheckCurrent(props.review)) throw Error('stale');
        if (!sameDisplay()) return;
        if (!sameInputs()) throw Error('stale');
        downloadFile(pdf, `ImbewuField${sample ? '-demo' : ''}-transplant-preparation.pdf`);
        setMessage('Transplant preparation PDF downloaded. Counts remain planned estimates, not observed sowing or stock.');
        return;
      }
      const csv = kind === 'preparation'
        ? buildGrowerNurseryPreparationCsv(snapshot.result, { sample })
        : buildGrowerNurseryCsv(snapshot.result, props.source.beds, { sample });
      const suffix = kind === 'preparation' ? 'transplant-preparation' : 'own-nursery';
      downloadFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `ImbewuField${sample ? '-demo' : ''}-${suffix}.csv`);
      setMessage(kind === 'preparation'
        ? 'Transplant preparation CSV downloaded. It covers represented planned batches, not observed sowing, stock or seedling readiness.'
        : 'Reviewed nursery CSV downloaded (area values in canonical m²). It contains proposed estimates, not live stock.');
    } catch {
      if (generation.current === turn) { setCurrent(null); setMessage('The current nursery review could not be confirmed. No file was delivered; review the inputs again.'); }
    } finally {
      if (generation.current === turn) setBusy(false);
    }
  }

  function resourceRows(kind: 'availability' | 'otherUses') {
    const label = kind === 'availability' ? 'Available resource' : 'Competing resource use';
    return controls[kind].map((row, index) => {
      const res = resources.find(item => item.key === row.resource);
      const isSpace = res?.kind === 'space';
      const quantityLabel = isSpace ? `Quantity (${unit === 'metric' ? 'm²' : 'ft²'})` : 'Quantity (containers)';
      return <fieldset key={row.row} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
        <legend>{label} {index + 1}</legend>
        <label className="block">Resource<select className={field} value={row.resource} onChange={event => update(kind, row.row, { resource: event.target.value })}>
          <option value="">Choose the saved resource</option>{resources.map(resource => <option key={resource.key} value={resource.key}>{resource.name} · {resource.unitLabel}</option>)}
        </select></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label>{quantityLabel}<input className={field} type={isSpace ? 'text' : 'number'} inputMode={isSpace ? 'decimal' : 'numeric'} min={isSpace ? undefined : '0'} step={isSpace ? undefined : '1'} value={row.quantity} onChange={event => update(kind, row.row, { quantity: event.target.value })} /></label>
          <label>From (UTC)<input className={field} type="date" value={row.start} onChange={event => update(kind, row.row, { start: event.target.value })} /></label>
          <label>Until (exclusive, UTC)<input className={field} type="date" value={row.endExclusive} onChange={event => update(kind, row.row, { endExclusive: event.target.value })} /></label>
        </div>
        <button type="button" className={button} onClick={() => change({ ...controls, [kind]: controls[kind].filter(item => item.row !== row.row) })}>Remove {label.toLowerCase()} {index + 1}</button>
      </fieldset>;
    });
  }

  return <section lang="en" aria-label="Own-input nursery review" className="space-y-3 rounded-xl border border-[var(--border)] p-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-semibold">Nursery requirements for this proposed plan</h4>
      <label className="flex items-center gap-2 text-xs">
        <span>Nursery units</span>
        <select
          aria-label="Nursery units"
          className={field}
          value={unit}
          onChange={event => handleUserUnitSwitch(event.target.value as NurseryUnitChoice)}
        >
          <option value="metric">Metric (m²)</option>
          <option value="imperial">Imperial (ft²)</option>
        </select>
      </label>
    </div>
    {unitNote && <p role="status" className="text-xs text-[var(--gold)]">{unitNote}</p>}
    <p>Use the equipment and recipes saved above. Dates and final plant positions come from this crop proposal. No sowing has been accepted or observed.</p>
    {sample && <p className="font-semibold">DEMO — example planning data</p>}
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={controls.settingsConfirmed} onChange={event => change({ ...controls, settingsConfirmed: event.target.checked })} />I have reviewed the saved nursery equipment, recipes and loss estimates.</label>
    {resources.length ? <ul>{resources.map(resource => <li key={resource.key}>{resource.name}: {resource.capacityLabel} allocated to this plan. This does not establish dated availability.</li>)}</ul> : <p>No saved nursery containers or surfaces for this source.</p>}
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
      {preparation && <section aria-label="Planned transplant preparation" className="space-y-3 rounded-lg border border-[var(--border)] p-3">
        <h6 className="font-semibold">Planned transplant preparation</h6>
        <p>Represented transplant batches only. Direct sowing and omitted work need separate review. These are planned estimates, not observed sowing, stock or seedling readiness.</p>
        {preparation.status !== 'available' ? <p>The preparation worksheet is unavailable. Review the current inputs and individual batch details.</p>
          : <>
            {preparation.projectionIncomplete && <p className="font-semibold">This preparation worksheet is incomplete. Known counts cover only the included batches; unknown requirements are not zero.</p>}
            {!preparation.groups.length && <p>No transplant batch is represented in this review. This does not establish a zero requirement for the whole garden.</p>}
            {preparation.groups.map((group, index) => <article key={group.key} className="space-y-2 border-t border-[var(--border)] pt-2">
              <p className="font-semibold">{group.cropName} · preparation group {index + 1}</p>
              <p>Raising starts {group.startDate} (UTC). Raising ends {[...new Set(group.members.map(member => member.endDateExclusive))].sort().map(date => `before ${date}`).join('; ')} (exclusive, UTC).</p>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">{([
                ['Final field positions', group.fieldPositions],
                ['Starts to raise', group.startsToRaise],
                ['Seeds to sow', group.seedsToSow],
              ] as const).map(([label, metric]) => <div key={label}><dt>{label}</dt><dd>{metric.status === 'complete'
                ? quantity(metric.total!)
                : metric.status === 'overflow' ? 'Total unavailable; review the input counts'
                  : `Unknown total; known subtotal ${metric.knownSubtotal === null ? 'Unknown' : quantity(metric.knownSubtotal)}`}</dd></div>)}</dl>
              <p>{group.members.length} represented {group.members.length === 1 ? 'batch' : 'batches'}. Counts already include the supplied loss estimates; do not apply them again.</p>
              {group.outsideReviewHorizon && <p>Some raising dates extend beyond the review horizon.</p>}
              {group.issues.length > 0 && <ul>{group.issues.map((issue, i) => <li key={i}>{issueText(issue)}</li>)}</ul>}
            </article>)}
            <p>This is not a complete purchase list. Matching crop names do not prove interchangeable varieties or seed lots.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button} disabled={busy || shown.result.fingerprint === null} onClick={() => void exportReview('preparation')}>Download transplant preparation CSV</button>
              <button type="button" className={button} disabled={busy || shown.result.fingerprint === null} onClick={() => void exportReview('preparation-pdf')}>Download preparation PDF</button>
            </div>
          </>}
      </section>}
      {!shown.result.batches.length && <p>This proposal has no transplant raising batch. Other nursery uses still need their own resource accounting.</p>}
      {shown.result.batches.map((batch, index) => {
        const footprintLabel = `Outer container footprint (${unit === 'metric' ? 'm²' : 'ft²'})`;
        return <article key={batch.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
          <h6 className="font-semibold">Proposed raising batch {index + 1} · {batch.cropName}</h6>
          <p>{batch.bedIds.map(id => props.source.beds.find(bed => bed.id === id)?.label ?? 'Growing space').join(', ')}. {batch.startDate} to before {batch.endDateExclusive} (UTC).</p>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">{Object.entries({
            'Target final plants': batch.targetPositions,
            'Starts to raise': batch.starts,
            'Seeds': batch.seeds,
            'Container fills': batch.trays,
            [footprintLabel]: formatArea(batch.areaM2, unit),
          }).map(([lbl, val]) => <div key={lbl}><dt>{lbl}</dt><dd>{typeof val === 'number' ? quantity(val) : (val ?? 'Unknown')}</dd></div>)}</dl>
          {batch.issues.length > 0 && <ul>{batch.issues.map((issue, i) => <li key={i}>{issueText(issue)}</li>)}</ul>}
        </article>;
      })}
      {shown.result.resources.map(resource => {
        const isSpace = resource.resourceKind === 'space';
        const resUnit = isSpace ? (unit === 'metric' ? 'm²' : 'ft²') : 'containers';
        const peakStr = resource.peak
          ? (isSpace
              ? `${formatArea(resource.peak[0], unit)}–${formatArea(resource.peak[1], unit)}`
              : `${quantity(resource.peak[0])}–${quantity(resource.peak[1])} ${resUnit}`)
          : 'Unknown';
        const shortageStr = isSpace ? formatArea(resource.shortage, unit) : `${quantity(resource.shortage)} ${resUnit}`;
        return <article key={`${resource.resourceKind}:${resource.id}`} className="rounded-lg border border-[var(--border)] p-3">
          <h6 className="font-semibold">{resource.name}</h6>
          <p>Known simultaneous demand: {peakStr}. Known shortage: {shortageStr}. {resource.headroom === 'unknown' || !resource.availabilityComplete ? 'This capacity comparison remains unknown.' : resource.incomplete ? 'The container or surface comparison is known; other nursery inputs remain incomplete.' : 'Dated supplied inputs checked.'}</p>
        </article>;
      })}
      {shown.result.issues.length > 0 && <ul>{shown.result.issues.map((issue, i) => <li key={i}>{issueText(issue)}</li>)}</ul>}
      <p>These are raising estimates, not observed stock or local crop instructions. Unknown requirements are not zero. Surface totals do not prove tray packing, paths, hardening or up-pot space.</p>
      <button type="button" className={button} disabled={busy || shown.result.fingerprint === null} onClick={() => void exportReview()}>Download reviewed nursery CSV</button>
    </section>}
  </section>;
}
