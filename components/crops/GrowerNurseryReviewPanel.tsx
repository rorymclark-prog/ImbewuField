'use client';

import { useEffect, useRef, useState } from 'react';
import { estimateNumberLabel as quantity } from '@/lib/format-figures';
import GrowerCycleIntent from './GrowerCycleIntent';
import GrowerSeedSourcingPanel from './GrowerSeedSourcingPanel';
import type { SeedSourcingGroupDraft, SeedSourcingGroupPatch } from './GrowerSeedSourcingForm';
import { parseSeedPurchaseCountInput, type SeedPurchaseCountKind } from '@/lib/seed-purchase-inputs';
import { reviewGrowerSeedSourcing, type GrowerSeedSourcingReview } from '@/lib/international/grower-seed-sourcing';
import type { NurserySettings } from '@/lib/nursery-settings';
import { sanitiseNurserySettings } from '@/lib/nursery-settings';
import type { GrowerWorkflowReview } from '@/lib/international/grower-workflow';
import type { GrowerWorkflowSource } from '@/lib/international/grower-workflow-source';
import type { GrowerSavedNurseryReview } from './useGrowerWorkflow';
import { buildGrowerNurseryForecast, isGrowerNurseryForecastCurrent, nurserySettingsFingerprint,
  projectGrowerNurseryPreparation,
  type GrowerNurseryRequest, type GrowerNurseryResult, type GrowerNurseryResourceWindow,
  type GrowerNurseryReservation, type GrowerNurseryBatchReferenceView } from '@/lib/international/grower-nursery';
import type { GrowerInput } from '@/lib/international/grower-planning';
import { buildGrowerNurseryCsv, buildGrowerNurseryPreparationCsv, buildGrowerNurseryPreparationPdf, buildGrowerNurseryBatchLabelsPdf, buildGrowerSeedSourcingCsv, NurseryReferenceExportError, growerNurseryIssueText as issueText } from '@/lib/nursery-export';
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

interface NurseryReviewCommonProps {
  source: GrowerWorkflowSource;
  settings?: NurserySettings;
  contextRevision: number;
  sample?: boolean;
}
export interface GrowerNurseryReviewPanelProps extends NurseryReviewCommonProps {
  review: Extract<GrowerWorkflowReview, { status: 'review' }>;
  savedReview?: never;
  /** The parent rereads the source/book/actor and checks this original review. */
  onCheckCurrent: (review: Extract<GrowerWorkflowReview, { status: 'review' }>) => Promise<unknown>;
  onCheckSavedCurrent?: never;
}
export interface SavedNurseryReviewPanelProps extends NurseryReviewCommonProps {
  review?: never;
  savedReview: GrowerSavedNurseryReview;
  onCheckCurrent?: never;
  onCheckSavedCurrent: (review: GrowerSavedNurseryReview) => Promise<boolean>;
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
type NurseryReviewPair = { request: GrowerNurseryRequest; result: GrowerNurseryResult; key: string };
type SeedDraft = {
  props: GrowerNurseryReviewPanelProps | SavedNurseryReviewPanelProps;
  key: string;
  sample: boolean;
  sampleMode: boolean;
  context: ReturnType<typeof captureNurseryUnitPreferenceContext>;
  pair: NurseryReviewPair;
  groups: readonly SeedSourcingGroupDraft[];
  retainForUnit: boolean;
};
type SeedReviewed = { draft: SeedDraft; review: GrowerSeedSourcingReview; controls: Controls; unit: NurseryUnitChoice; turn: number };
type SeedOperation = { draft: SeedDraft; turn: number; kind: 'review' | 'export'; controls: Controls; unit: NurseryUnitChoice };
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

function referenceDetails(reference: GrowerNurseryBatchReferenceView | undefined) {
  if (reference?.status !== 'ready') return <p>Individual saved batch reference: {reference?.status === 'held' ? 'Needs review' : 'Not recorded'}.</p>;
  return <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 [overflow-wrap:anywhere]">{([
    ['Your variety / cultivar', reference.fields.variety], ['Your seed-lot reference', reference.fields.seedLotReference],
    ['Your raising-batch reference', reference.fields.raisingBatchReference],
  ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}</dl>;
}

/** The review is transient. Equipment remains in the existing canonical book. */
export default function GrowerNurseryReviewPanel(props: GrowerNurseryReviewPanelProps | SavedNurseryReviewPanelProps) {
  const [draftControls, setControls] = useState(blank);
  const [unit, setUnit] = useState<NurseryUnitChoice>('metric');
  const [unitNote, setUnitNote] = useState('');
  const [current, setCurrent] = useState<NurseryReviewPair | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0), nextRow = useRef(0), active = useRef(true);
  const prefContext = useRef<ReturnType<typeof captureNurseryUnitPreferenceContext>>(null);
  const [seedDraft, setSeedDraft] = useState<SeedDraft | null>(null);
  const [seedReviewed, setSeedReviewed] = useState<SeedReviewed | null>(null);
  const [seedMessage, setSeedMessage] = useState('');
  const [, seedRender] = useState(0);
  const seedDraftRef = useRef<SeedDraft | null>(null), seedReviewedRef = useRef<SeedReviewed | null>(null);
  const seedOperation = useRef<SeedOperation | null>(null), nextSeedGroup = useRef(0);
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
    props.savedReview ?? props.review!.proposal.fingerprint,
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
  const live = useRef({ props, key, sample, controls, unit, current });
  live.current = { props, key, sample, controls, unit, current };

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
      resetSeed();
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
    resetSeed();
    setCurrent(null);
    setMessage('');
    setBusy(false);
  }, [key]);

  useEffect(() => { active.current = true; return () => {
    active.current = false; generation.current++; seedDraftRef.current = null; seedReviewedRef.current = null; seedOperation.current = null;
  }; }, []);

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
  const fieldReservations = props.review?.request.reserved ?? [];
  // Legacy deferred callers may have an unknown promise result. Only an actual
  // affirmative boolean can authenticate either displayed source mode.
  const checkCurrent = async () => (props.savedReview
    ? await props.onCheckSavedCurrent(props.savedReview) : await props.onCheckCurrent(props.review)) === true;
  const renderedInputsCurrent = () => active.current && live.current.props === props && live.current.key === key && live.current.controls === controls;

  function resetSeed(clearDraft = true) {
    seedReviewedRef.current = null; seedOperation.current = null; setSeedReviewed(null); setSeedMessage('');
    if (clearDraft) { seedDraftRef.current = null; setSeedDraft(null); }
    seedRender(value => value + 1);
  }
  function seedSourceCurrent(draft: SeedDraft): boolean {
    return active.current && live.current.props === draft.props && live.current.key === draft.key
      && live.current.sample === draft.sample && isSampleMode() === draft.sampleMode && !!draft.props.savedReview
      && prefContext.current === draft.context && nurseryUnitPreferenceContextIsCurrent(draft.context)
      && (live.current.current === draft.pair || draft.retainForUnit && live.current.current === null);
  }
  function originalReviewTime(pair: NurseryReviewPair): string {
    return pair.request.settingsReview.state === 'provided' ? pair.request.settingsReview.provenance.recordedAt
      : pair.request.horizon.state === 'provided' ? pair.request.horizon.provenance.recordedAt : '';
  }
  function seedInputsCurrent(draft: SeedDraft): boolean {
    return seedSourceCurrent(draft) && live.current.current === draft.pair
      && isGrowerNurseryForecastCurrent(draft.pair.result, makeRequest(originalReviewTime(draft.pair)));
  }
  function seedProofCurrent(proof: SeedReviewed): boolean {
    return seedReviewedRef.current === proof && seedDraftRef.current === proof.draft && generation.current === proof.turn
      && live.current.controls === proof.controls && live.current.unit === proof.unit && seedInputsCurrent(proof.draft);
  }
  // Retiring refs during render blocks retained callbacks immediately. An effect
  // alone would leave the previous account/source proof callable until commit.
  if (seedDraftRef.current && !seedSourceCurrent(seedDraftRef.current)) {
    seedDraftRef.current = null; seedReviewedRef.current = null; seedOperation.current = null;
  }
  if (seedReviewedRef.current && !seedProofCurrent(seedReviewedRef.current)) seedReviewedRef.current = null;
  if (seedOperation.current && (generation.current !== seedOperation.current.turn
    || seedDraftRef.current !== seedOperation.current.draft || live.current.controls !== seedOperation.current.controls
    || live.current.unit !== seedOperation.current.unit || !seedInputsCurrent(seedOperation.current.draft))) seedOperation.current = null;
  const shownSeedDraft = seedDraftRef.current === seedDraft ? seedDraft : null;
  const shownSeedReview = seedReviewedRef.current === seedReviewed ? seedReviewed : null;
  const seedPending = seedOperation.current;
  const savedSeedSource = !!props.savedReview && !!shown && shown.result.sourceStatus === 'saved-planned';

  function seedEditorCurrent(): boolean {
    return renderedInputsCurrent() && savedSeedSource && live.current.current === shown && !busy && !seedOperation.current
      && seedDraftRef.current === shownSeedDraft && !!prefContext.current && nurseryUnitPreferenceContextIsCurrent(prefContext.current)
      && (!shownSeedDraft || seedSourceCurrent(shownSeedDraft));
  }
  function editSeedGroups(groups: readonly SeedSourcingGroupDraft[]) {
    if (!seedEditorCurrent() || !shown) return;
    generation.current++; resetSeed(false);
    const next: SeedDraft = { props, key, sample, sampleMode: isSampleMode(), context: prefContext.current, pair: shown, groups, retainForUnit: false };
    seedDraftRef.current = next; setSeedDraft(next);
  }
  function addSeedGroup() {
    if (!seedEditorCurrent() || !shown?.result.batches.length) return;
    editSeedGroups([...(shownSeedDraft?.groups ?? []), { id: `seed-supply-${++nextSeedGroup.current}`, label: '', batchIds: [],
      interchangeabilityConfirmed: false, allocatedToPlanSeedsText: '', seedsPerPackText: '' }]);
  }
  function changeSeedGroup(id: string, patch: SeedSourcingGroupPatch) {
    if (!seedEditorCurrent() || !shownSeedDraft || !shownSeedDraft.groups.some(group => group.id === id)) return;
    editSeedGroups(shownSeedDraft.groups.map(group => group.id === id ? { ...group, ...patch } : group));
  }
  function removeSeedGroup(id: string) {
    if (!seedEditorCurrent() || !shownSeedDraft || !shownSeedDraft.groups.some(group => group.id === id)) return;
    editSeedGroups(shownSeedDraft.groups.filter(group => group.id !== id));
  }
  function seedGroups(draft: SeedDraft) {
    const count = (raw: unknown, kind: SeedPurchaseCountKind) => {
      const parsed = parseSeedPurchaseCountInput(raw, kind);
      // Invalid authored input must reach numeric validation as invalid, never
      // become unknown or a rounded safe-looking number.
      return parsed.status === 'invalid' ? typeof raw === 'string' ? raw : false : parsed.value;
    };
    return draft.groups.map(group => ({ id: group.id, label: group.label, batchIds: group.batchIds,
      interchangeabilityConfirmed: group.interchangeabilityConfirmed,
      allocatedToPlanSeeds: count(group.allocatedToPlanSeedsText, 'allocation'), seedsPerPack: count(group.seedsPerPackText, 'pack') }));
  }
  function seedOperationCurrent(operation: SeedOperation): boolean {
    return seedOperation.current === operation && generation.current === operation.turn && seedDraftRef.current === operation.draft
      && live.current.controls === operation.controls && live.current.unit === operation.unit && seedInputsCurrent(operation.draft);
  }
  async function reviewSeed() {
    if (!seedEditorCurrent() || !shownSeedDraft?.groups.length || !shown?.result.batches.length || !seedInputsCurrent(shownSeedDraft)) return;
    const operation: SeedOperation = { draft: shownSeedDraft, turn: ++generation.current, kind: 'review', controls, unit };
    seedOperation.current = operation; seedReviewedRef.current = null; setSeedReviewed(null); setSeedMessage(''); seedRender(value => value + 1);
    try {
      if (!await checkCurrent()) throw Error('stale');
      if (!seedOperationCurrent(operation)) return;
      const request = makeRequest(originalReviewTime(operation.draft.pair));
      const projection = reviewGrowerSeedSourcing({ result: operation.draft.pair.result, currentRequest: request, groups: seedGroups(operation.draft) });
      if (!seedOperationCurrent(operation)) return;
      if (projection.status === 'unavailable') throw Error('stale');
      if (!await checkCurrent()) throw Error('stale');
      if (!seedOperationCurrent(operation)) return;
      const next: SeedReviewed = { draft: operation.draft, review: projection, controls, unit, turn: operation.turn };
      seedReviewedRef.current = next; setSeedReviewed(next);
    } catch {
      if (seedOperation.current === operation) {
        seedReviewedRef.current = null; setSeedReviewed(null);
        setSeedMessage('The current saved nursery context could not be confirmed. No seed worksheet is available; check the saved nursery review again.');
      }
    } finally {
      if (seedOperation.current === operation) { seedOperation.current = null; seedRender(value => value + 1); }
    }
  }
  async function exportSeed() {
    if (!renderedInputsCurrent() || busy || seedOperation.current || !shownSeedReview || !seedProofCurrent(shownSeedReview)) return;
    const proof = shownSeedReview, operation: SeedOperation = { draft: proof.draft, turn: ++generation.current, kind: 'export', controls, unit };
    const renewed = { ...proof, turn: operation.turn };
    seedReviewedRef.current = renewed; seedOperation.current = operation; setSeedReviewed(renewed); setSeedMessage(''); seedRender(value => value + 1);
    try {
      if (!await checkCurrent()) throw Error('stale');
      if (!seedOperationCurrent(operation)) return;
      const request = makeRequest(originalReviewTime(operation.draft.pair));
      const csv = buildGrowerSeedSourcingCsv(operation.draft.pair.result, request, seedGroups(operation.draft), { sample });
      if (!seedOperationCurrent(operation)) return;
      // Even a synchronous formatter can invoke a test/browser callback. A file
      // must not escape on a stale source merely because it required no await.
      if (!await checkCurrent()) throw Error('stale');
      if (!seedOperationCurrent(operation)) return;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      if (!seedOperationCurrent(operation)) return;
      downloadFile(blob, `ImbewuField${sample ? '-demo' : ''}-planned-seed-sourcing.csv`);
      if (seedOperationCurrent(operation)) setSeedMessage('Seed sourcing worksheet downloaded. Planning inputs are not saved; no stock was recorded or order placed.');
    } catch {
      if (seedOperation.current === operation) {
        seedReviewedRef.current = null; setSeedReviewed(null);
        setSeedMessage('The current saved nursery context could not be confirmed. No file was delivered; check the saved nursery review again.');
      }
    } finally {
      if (seedOperation.current === operation) { seedOperation.current = null; seedRender(value => value + 1); }
    }
  }

  function change(next: Controls, preserveSeedForUnit = false) {
    if (!renderedInputsCurrent()) return;
    generation.current++;
    if (preserveSeedForUnit && seedDraftRef.current) {
      const retained = { ...seedDraftRef.current, retainForUnit: true };
      seedDraftRef.current = retained; setSeedDraft(retained); resetSeed(false);
    } else resetSeed();
    const updated = { ...next, contextKey: key };
    live.current = { ...live.current, controls: updated };
    setControls(updated);
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
    }, true);
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
    }, true);
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

    const start = props.review?.request.planningStart, end = props.review?.request.planningEndExclusive;
    return {
      source: props.savedReview ? { kind: 'saved-cycles', rows: props.savedReview.rows, cycleContext: props.savedReview.cycleContext } : {
        kind: 'proposal',
        proposal: props.review!.proposal,
        currentRequest: props.review!.request,
        competingDemand: props.review!.blockedBeds.some(bed => bed.reasons.some(reason => reason !== 'source-bed-held')) ? 'unresolved' : 'assessed-none',
      },
      resourceContext: props.source,
      settings,
      settingsReview: controls.settingsConfirmed && settingsFingerprint ? {
        state: 'provided',
        value: settingsFingerprint,
        unit: 'nursery-settings-fingerprint',
        provenance: { kind: 'grower-record', recordedAt, reference: 'Saved nursery settings reconfirmed for this review; not their original measurement time.' },
      } : missing,
      horizon: props.savedReview ? props.savedReview.horizon
        : start?.state === 'provided' && end?.state === 'provided' ? estimate({ start: start.value, endExclusive: end.value }, 'utc-date-window') : missing,
      availability: controls.availabilityConfirmed ? estimate(controls.availability.map(window), 'nursery-resource-windows') : missing,
      otherReservations: controls.otherUsesConfirmed ? estimate(controls.otherUses.map(row => ({ ...window(row), id: `review-use-${row.row}` } satisfies GrowerNurseryReservation)), 'nursery-resource-reservations') : missing,
      ...(fieldReservations.length ? {
        accountedFieldReservations: controls.fieldUsesConfirmed
          ? estimate(fieldReservations.map(row => row.id), 'nursery-accounted-field-reservations') : missing,
      } : {}),
    };
  }

  async function review() {
    if (!renderedInputsCurrent()) return;
    const retainedSeed = seedDraftRef.current?.retainForUnit ? seedDraftRef.current : null;
    resetSeed(!retainedSeed);
    const turn = ++generation.current, snapshotKey = key, snapshotSample = isSampleMode();
    setBusy(true); setCurrent(null); setMessage('');
    try {
      if (!await checkCurrent()) throw Error('stale');
      if (generation.current !== turn || live.current.key !== snapshotKey || isSampleMode() !== snapshotSample) return;
      const request = makeRequest(new Date().toISOString());
      const result = buildGrowerNurseryForecast(request);
      const pair = { request, result, key: snapshotKey };
      // A unit-only paint change may retain authored seed strings, but only the
      // canonical replay can establish that the actual nursery request stayed
      // equal. Retention never carries the earlier reviewed-count proof.
      if (retainedSeed && seedDraftRef.current === retainedSeed && seedSourceCurrent(retainedSeed)
        && isGrowerNurseryForecastCurrent(retainedSeed.pair.result, makeRequest(originalReviewTime(retainedSeed.pair)))) {
        // Keep the unit-retention allowance while the separate state updates
        // commit. A transient null current pair cannot erase these raw strings.
        // Every later renewal still requires the same canonical request replay.
        const next = { ...retainedSeed, pair, retainForUnit: true };
        seedDraftRef.current = next; setSeedDraft(next);
      } else resetSeed();
      setCurrent(pair);
    } catch {
      if (generation.current === turn) setMessage('The crop plan or saved inputs could not be confirmed. Review the current crop proposal before continuing.');
    } finally {
      if (generation.current === turn) setBusy(false);
    }
  }

  async function exportReview(kind: 'resource-review' | 'preparation' | 'preparation-pdf' | 'batch-cards-pdf' = 'resource-review') {
    if (!renderedInputsCurrent() || !shown || busy || shown.result.fingerprint === null) return;
    if (kind !== 'resource-review' && preparation?.status !== 'available') return;
    const turn = ++generation.current, snapshot = shown, snapshotKey = key, snapshotSample = isSampleMode();
    const sameDisplay = () => active.current && generation.current === turn && live.current.key === snapshotKey && isSampleMode() === snapshotSample;
    const sameInputs = () => isGrowerNurseryForecastCurrent(snapshot.result, makeRequest(snapshot.request.settingsReview.state === 'provided'
      ? snapshot.request.settingsReview.provenance.recordedAt : snapshot.request.horizon.state === 'provided'
        ? snapshot.request.horizon.provenance.recordedAt : ''));
    setBusy(true); setMessage('');
    try {
      if (!await checkCurrent()) throw Error('stale');
      if (!sameDisplay()) return;
      if (!sameInputs()) throw Error('stale');
      if (kind === 'preparation-pdf' || kind === 'batch-cards-pdf') {
        const batchCards = kind === 'batch-cards-pdf';
        const pdf = await (batchCards ? buildGrowerNurseryBatchLabelsPdf : buildGrowerNurseryPreparationPdf)(snapshot.result, { sample });
        if (!sameDisplay()) return;
        // Loading the PDF writer yields. A matching displayed key alone cannot
        // prove that saved source/account records stayed current meanwhile.
        if (!await checkCurrent()) throw Error('stale');
        if (!sameDisplay()) return;
        if (!sameInputs()) throw Error('stale');
        downloadFile(pdf, `ImbewuField${sample ? '-demo' : ''}-${batchCards ? 'planned-nursery-batch-cards' : 'transplant-preparation'}.pdf`);
        setMessage(batchCards
          ? 'Planned nursery batch cards downloaded. Counts remain planned estimates, not observed sowing or stock.'
          : 'Transplant preparation PDF downloaded. Counts remain planned estimates, not observed sowing or stock.');
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
    } catch (error) {
      if (sameDisplay()) {
        if (error instanceof NurseryReferenceExportError && error.reason === 'unsupported-reference-glyph') {
          setMessage('The PDF font cannot print a planned reference faithfully. No PDF was delivered. Download the transplant preparation CSV to retain its exact text.');
        } else {
          setCurrent(null); setMessage('The current nursery review could not be confirmed. No file was delivered; review the inputs again.');
        }
      }
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
      <h4 className="font-semibold">{props.savedReview ? 'Nursery requirements for saved planned batches' : 'Nursery requirements for this proposed plan'}</h4>
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
    <p>{props.savedReview
      ? 'Use the equipment and recipes saved above. Dates and final plant positions come from saved planned cycles. Saving a plan does not record observed sowing or live nursery stock.'
      : 'Use the equipment and recipes saved above. Dates and final plant positions come from this crop proposal. No sowing has been accepted or observed.'}</p>
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
    {fieldReservations.length > 0 && <fieldset className="space-y-2 rounded-lg border border-[var(--border)] p-3"><legend>Known field occupations</legend>
      <ul>{fieldReservations.map(row => <li key={row.id}>{props.source.beds.find(bed => bed.id === row.bedId)?.label ?? 'Growing space'}: {row.window.state === 'provided' ? `${row.window.value.start} to before ${row.window.value.endExclusive}` : 'dates unknown'}.</li>)}</ul>
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
              {props.savedReview && <ul className="space-y-2">{group.members.map((member, memberIndex) => <li key={member.batchId}>
                <p>Represented batch {memberIndex + 1} · raising ends before {member.endDateExclusive} (exclusive, UTC).</p>
                {referenceDetails(member.reference)}
              </li>)}</ul>}
              {group.outsideReviewHorizon && <p>Some raising dates extend beyond the review horizon.</p>}
              {group.issues.length > 0 && <ul>{group.issues.map((issue, i) => <li key={i}>{issueText(issue)}</li>)}</ul>}
            </article>)}
            <p>This is not a complete purchase list. Matching crop names do not prove interchangeable varieties or seed lots.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={button} disabled={busy || shown.result.fingerprint === null} onClick={() => void exportReview('preparation')}>Download transplant preparation CSV</button>
              <button type="button" className={button} disabled={busy || shown.result.fingerprint === null} onClick={() => void exportReview('preparation-pdf')}>Download preparation PDF</button>
              <button type="button" className={button} disabled={busy || shown.result.fingerprint === null} onClick={() => void exportReview('batch-cards-pdf')}>Download planned batch cards</button>
            </div>
          </>}
      </section>}
      {!shown.result.batches.length && <p>{props.savedReview ? 'These saved cycles have no represented transplant raising batch.' : 'This proposal has no transplant raising batch.'} Other nursery uses still need their own resource accounting.</p>}
      {shown.result.batches.map((batch, index) => {
        const footprintLabel = `Outer container footprint (${unit === 'metric' ? 'm²' : 'ft²'})`;
        return <article key={batch.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
          <h6 className="font-semibold">{props.savedReview ? 'Saved planned' : 'Proposed'} raising batch {index + 1} · {batch.cropName}</h6>
          <p>{batch.bedIds.map(id => props.source.beds.find(bed => bed.id === id)?.label ?? 'Growing space').join(', ')}. {batch.startDate} to before {batch.endDateExclusive} (UTC).</p>
          {props.savedReview && <GrowerCycleIntent view={batch.origin?.status === 'proposed' ? undefined : batch.origin} />}
          {props.savedReview && referenceDetails(batch.reference)}
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
      {savedSeedSource && <section aria-label="Planned seed sourcing" className="min-w-0 space-y-3 border-t border-[var(--border)] pt-3">
        <p>Seed sourcing inputs are temporary and are not saved. {sample ? 'DEMO — example planned seed requirements.' : 'Use only your current saved planned nursery batches.'}</p>
        <GrowerSeedSourcingPanel batches={shown.result.batches.map((batch, index) => ({ id: batch.id,
          label: `Saved planned batch ${index + 1} · ${batch.cropName} · ${batch.startDate} to before ${batch.endDateExclusive} (UTC)` }))}
          groups={shownSeedDraft?.groups ?? []} review={shownSeedReview?.review ?? null} disabled={busy || seedPending?.kind === 'export'}
          reviewing={seedPending?.kind === 'review'} onAddGroup={addSeedGroup} onRemoveGroup={removeSeedGroup}
          onChangeGroup={changeSeedGroup} onReview={() => void reviewSeed()} />
        <button type="button" className={button} disabled={busy || !!seedPending || !shownSeedReview}
          onClick={() => void exportSeed()}>Download seed sourcing worksheet CSV</button>
        <p className="text-xs text-[var(--text-secondary)]">The CSV includes your entered supply-group labels. Leave out information you do not want in the file.</p>
        <p role="status" aria-live="polite">{seedMessage}</p>
      </section>}
      <button type="button" className={button} disabled={busy || shown.result.fingerprint === null} onClick={() => void exportReview()}>Download reviewed nursery CSV</button>
    </section>}
  </section>;
}
