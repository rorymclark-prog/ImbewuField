'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CROPS, cropByKey, MONTHS_SHORT } from '@/lib/crop-catalog';
import type { GrowerWorkflowMeasuredArea } from '@/lib/international/grower-workflow-source';
import type { PlanBed, GrowerProfileChangeRequest } from '@/lib/crop-plan';
import { createCanonicalUnitDraft, editCanonicalUnitDraft, readCanonicalUnitDraft, switchCanonicalUnitDraft,
  formatNurseryDimension, type CanonicalUnitDraft } from '@/lib/length-units';
import { formatMassKilograms } from '@/lib/mass-units';
import { GROWER_ESTIMATE_DENSITY_SPEC as densitySpec,
  normaliseGrowerEstimateSourceReceipt, type GrowerEstimateSourceField, type GrowerEstimateSourceReceipt,
  type GrowerEstimateDensityUnit, type GrowerEstimateDensityKind } from '@/lib/grower-estimate-units';
import { captureGrowerEstimateUnitPreferenceContext, growerEstimateUnitPreferenceContextIsCurrent,
  readGrowerEstimateUnitPreference, writeGrowerEstimateUnitPreference, revokeGrowerEstimateUnitPreferenceContext,
  subscribeGrowerEstimateUnitPreferenceContext, subscribeGrowerEstimateUnitPreferenceValue,
  type GrowerEstimateUnitChoice, type GrowerEstimateUnitPreferenceContext } from '@/lib/length-unit-preference';
import {
  assessGrowerPlanning, growerPlanningScopeKey, normaliseGrowerPlanningProfile, normaliseGrowerPlanningScope,
  type GrowerInput, type GrowerPlanningAssessment, type GrowerPlanningInputs,
  type GrowerPlanningProfile, type GrowerPlanningScope,
} from '@/lib/international/grower-planning';

export interface GrowerPlanningPanelProps {
  scope: GrowerPlanningScope | null;
  beds: readonly PlanBed[];
  profiles: readonly GrowerPlanningProfile[];
  measuredAreas?: readonly GrowerWorkflowMeasuredArea[];
  measurementsFingerprint?: string | null;
  measurementsRequired?: boolean;
  measurementsReady?: boolean;
  checkingMeasurements?: boolean;
  onCheckMeasurements?: () => Promise<void>;
  onSaveProfiles: (profiles: GrowerPlanningProfile[], request?: GrowerProfileChangeRequest) => boolean;
}

const field = 'min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--text-primary)]';
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50';
const numericFields = [
  ['plantsPerM2', 'Plant density (plants per m²)', 'any'],
  ['yieldKgPerM2', 'Harvest weight (kg per m² per cycle)', 'any'],
  ['nurseryDays', 'Nursery duration (days)', '1'],
  ['fieldEntryToFirstHarvestDays', 'Field entry to first harvest (days)', '1'],
  ['pickingDays', 'Picking duration (days)', '1'],
  ['fieldOccupancyDays', 'Field occupancy (days)', '1'],
  ['turnaroundDays', 'Turnaround after clearing (days)', '1'],
] as const;
type NumericKey = typeof numericFields[number][0];
const emptyNumbers = (): Record<NumericKey, string> => Object.fromEntries(numericFields.map(([key]) => [key, ''])) as Record<NumericKey, string>;
const issueLabel = (key: string) => numericFields.find(([name]) => name === key)?.[1]
  ?? ({ establishment: 'Establishment method', allowedEntryMonths: 'Allowed field-entry months',
    measuredAreaM2: 'Measured bed area', fieldEntryDate: 'Field-entry date', profile: 'Profile values or provenance',
    scope: 'Current site or workspace', estimatedPlantCount: 'Plant-count range', estimatedYieldKg: 'Harvest-weight range',
    'date-range': 'Calendar date range' } as Record<string, string>)[key] ?? key;
const scopeKey = growerPlanningScopeKey;
type DensityDraft = CanonicalUnitDraft<'value', GrowerEstimateDensityUnit, GrowerEstimateDensityKind>;
type DensityOrigin = Readonly<{ decimal: string; unit: GrowerEstimateDensityUnit }>;
type DensityPair = { choice: GrowerEstimateUnitChoice; plant: DensityDraft; harvest: DensityDraft;
  plantOrigin: DensityOrigin | null; harvestOrigin: DensityOrigin | null };
function densityPair(sourceKey: string, choice: GrowerEstimateUnitChoice, plant?: number, harvest?: number,
  sources?: GrowerPlanningProfile['exactDensitySources']): DensityPair {
  const draft = (unit: GrowerEstimateDensityUnit, value: number | undefined) => createCanonicalUnitDraft(densitySpec,
    { sourceKey, unit, values: { value }, optionalFields: ['value'] });
  return { choice, plant: draft(choice === 'metric' ? 'plants/m2' : 'plants/ft2', plant),
    harvest: draft(choice === 'metric' ? 'kg/m2/cycle' : 'lb/ft2/cycle', harvest),
    plantOrigin: sources?.plantsPerM2 ? { decimal: sources.plantsPerM2.decimal, unit: sources.plantsPerM2.unit } : null,
    harvestOrigin: sources?.yieldKgPerM2 ? { decimal: sources.yieldKgPerM2.decimal, unit: sources.yieldKgPerM2.unit } : null };
}

type MeasurementProps = Pick<GrowerPlanningPanelProps, 'beds' | 'measuredAreas' | 'measurementsFingerprint'
  | 'measurementsRequired' | 'measurementsReady' | 'checkingMeasurements'>;
function measurementIdentity(props: MeasurementProps, bedId: string): string {
  return JSON.stringify([!!props.measurementsRequired, props.measurementsReady, !!props.checkingMeasurements,
    props.measurementsFingerprint ?? null, props.beds.filter(bed => bed.id === bedId).map(bed => [bed.id, bed.areaM2]),
    props.measuredAreas === undefined ? null : props.measuredAreas.filter(row => row.bedId === bedId)]);
}
function measurementContext(props: MeasurementProps): string {
  return JSON.stringify([!!props.measurementsRequired, props.measurementsFingerprint ?? null]);
}
type EditSession = Readonly<{ profileId: string | null; signature: string | null }>;
const changedSourceMessage = 'This saved estimate changed, was removed or cannot be read uniquely. Reload the saved estimate or start a new profile before saving or reviewing.';
function profileSignature(value: unknown): string | null {
  try { const profile = normaliseGrowerPlanningProfile(value); return profile ? JSON.stringify(profile) : null; }
  catch { return null; }
}
function currentProfile(rows: readonly GrowerPlanningProfile[], profileId: string, scope: string) {
  try {
    const matches = rows.filter(row => row.profileId === profileId);
    if (matches.length !== 1) return null;
    const profile = normaliseGrowerPlanningProfile(matches[0]);
    return profile && scopeKey(profile.scope) === scope ? { profile, signature: JSON.stringify(profile) } : null;
  } catch { return null; }
}

export default function GrowerPlanningPanel(props: GrowerPlanningPanelProps) {
  // Changing farms must discard the editor's authority, including callbacks an
  // earlier render left open. The parent remains the single persistence owner.
  const current = useRef(props); current.current = props;
  const normalScope = normaliseGrowerPlanningScope(props.scope), key = scopeKey(normalScope);
  // No scope means no numeric draft source and no account preference lease.
  // Never manufacture a source key just to let an invalid editor stage inputs.
  if (!normalScope || key === null) return <details className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-primary)]">
    <summary className="min-h-11 cursor-pointer px-4 py-3 font-display font-semibold">Your growing estimates</summary>
    <section lang="en" aria-label="Grower planning estimates" className="px-4 pb-4 font-sans">
      <p role="note">Choose a current site or unmapped workspace first. No estimates can be saved or calculated without that context.</p>
    </section>
  </details>;
  return <Editor key={key} {...props} scope={normalScope} sourceKey={key} current={current} />;
}

function Editor({ scope, beds, profiles, current, sourceKey, measuredAreas, measurementsFingerprint,
  measurementsRequired = false, measurementsReady, checkingMeasurements = false, onCheckMeasurements }: GrowerPlanningPanelProps & {
  sourceKey: string;
  current: { current: GrowerPlanningPanelProps };
}) {
  const normalScope = normaliseGrowerPlanningScope(scope);
  const key = sourceKey;
  const active = useRef(true);
  const lease = useRef<GrowerEstimateUnitPreferenceContext | null>(null);
  const revoked = useRef(false);
  const [available, setAvailable] = useState(false);
  const [density, setDensity] = useState(() => densityPair(key, 'metric'));
  const densityLive = useRef(density); densityLive.current = density;
  const [unitMessage, setUnitMessage] = useState('');
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [cropKey, setCropKey] = useState('');
  const [numbers, setNumbers] = useState(emptyNumbers);
  const [establishment, setEstablishment] = useState('');
  const [windowKnown, setWindowKnown] = useState(false);
  const [months, setMonths] = useState<number[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [session, setSession] = useState<EditSession>(() => Object.freeze({ profileId: null, signature: null }));
  // Only an explicit load/reset or successful save advances this authority; an
  // old render or callback must never acquire the newest edit generation.
  const sessionLive = useRef(session);
  const heldSession = useRef<EditSession | null>(null);
  const editingId = session.profileId;
  const switchUnitsLive = useRef<(choice: GrowerEstimateUnitChoice) => void>(() => {});
  switchUnitsLive.current = choice => switchUnits(choice, false);
  const [bedId, setBedId] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [feedback, setFeedback] = useState('');
  const measurementCheck = useRef<object | null>(null);
  const [checkingLocally, setCheckingLocally] = useState(false);
  const [measurementFeedback, setMeasurementFeedback] = useState<{ context: string; text: string; error: boolean } | null>(null);
  const [error, setError] = useState('');
  const [review, setReview] = useState<{ key: string; result: GrowerPlanningAssessment } | null>(null);
  const ownProfiles = profiles.filter(profile => scopeKey(profile.scope) === key);
  const selectedBeds = beds.filter(bed => bed.id === bedId);
  const selectedBed = selectedBeds.length === 1 ? selectedBeds[0] : null;
  const selectedMeasurements = measuredAreas?.filter(row => row.bedId === bedId);
  const selectedMeasurement = selectedBed && selectedMeasurements?.length === 1
    && selectedMeasurements[0].areaM2 === selectedBed.areaM2 ? selectedMeasurements[0] : null;
  const measurementKey = measurementIdentity({ beds, measuredAreas, measurementsFingerprint, measurementsRequired, measurementsReady, checkingMeasurements }, bedId);
  const measurementFeedbackContext = measurementContext({ beds, measurementsFingerprint, measurementsRequired });
  const checking = checkingMeasurements || checkingLocally;
  const requiredMeasurementsReady = !measurementsRequired || measurementsReady === true
    && typeof measurementsFingerprint === 'string' && measurementsFingerprint.trim() !== '' && measuredAreas !== undefined;
  useEffect(() => { setReview(null); }, [measurementKey]);
  const plantRead = readCanonicalUnitDraft(densitySpec, density.plant, key);
  const harvestRead = readCanonicalUnitDraft(densitySpec, density.harvest, key);
  // Display changes must not invalidate a review or parse rounded labels back into
  // canonical estimates. Unfinished entry remains part of the semantic draft.
  const densityKey = [plantRead.status === 'ready' ? plantRead.values : density.plant.fields,
    harvestRead.status === 'ready' ? harvestRead.values : density.harvest.fields];
  const draftKey = JSON.stringify([key, cropKey, numbers, densityKey, density.plantOrigin, density.harvestOrigin, establishment, windowKnown, months, confirmed,
    bedId, selectedBed?.areaM2, measurementKey, entryDate, editingId]);
  const latestEditRow = editingId === null ? null : currentProfile(profiles, editingId, key);
  if (editingId !== null && latestEditRow?.signature !== session.signature) heldSession.current = session;
  const sourceChanged = heldSession.current === session;
  const result = !sourceChanged && review?.key === draftKey ? review.result : null;

  useEffect(() => {
    const context = captureGrowerEstimateUnitPreferenceContext(); lease.current = context;
    if (!context || !growerEstimateUnitPreferenceContextIsCurrent(context)) { withdraw(); revokeGrowerEstimateUnitPreferenceContext(context); return; }
    const stopContext = subscribeGrowerEstimateUnitPreferenceContext(context, withdraw);
    const stopValue = subscribeGrowerEstimateUnitPreferenceValue(context, choice => {
      if (authorised() && densityLive.current.choice !== choice) switchUnitsLive.current(choice);
    });
    const remembered = readGrowerEstimateUnitPreference(context);
    if (growerEstimateUnitPreferenceContextIsCurrent(context) && !revoked.current) {
      commitDensity(densityPair(key, remembered.unit)); setAvailable(true);
      setUnitMessage(remembered.destination === 'sample' ? 'Unit choice is temporary in this sample.'
        : remembered.remembered ? 'Unit choice remembered on this device.'
        : remembered.destination === 'unavailable' ? 'Unit choice cannot be remembered on this device. Your current entries remain usable.' : '');
    } else withdraw();
    return () => { stopValue(); stopContext(); revokeGrowerEstimateUnitPreferenceContext(context); lease.current = null; };
  }, []);

  function commitDensity(next: DensityPair) { densityLive.current = next; setDensity(next); }
  function withdraw() {
    revoked.current = true; setAvailable(false);
    reset(); setUnitMessage('');
  }
  function authorised(): boolean {
    if (!active.current || !normalScope || scopeKey(current.current.scope) !== key || revoked.current) return false;
    if (!growerEstimateUnitPreferenceContextIsCurrent(lease.current)) { withdraw(); return false; }
    return true;
  }
  function draftIsCurrent(): boolean { return authorised() && sessionLive.current === session; }
  function clearMeasurementCheck() {
    measurementCheck.current = null; setCheckingLocally(false); setMeasurementFeedback(null);
  }
  async function checkMeasurements() {
    if (!draftIsCurrent() || measurementCheck.current || checkingMeasurements || current.current.checkingMeasurements
      || measurementContext(current.current) !== measurementFeedbackContext) return;
    const callback = current.current.onCheckMeasurements; if (!callback) return;
    const token = {}, context = measurementContext(current.current);
    measurementCheck.current = token; setCheckingLocally(true); setMeasurementFeedback(null); setReview(null);
    const stillCurrent = () => draftIsCurrent() && measurementCheck.current === token
      && measurementContext(current.current) === context;
    try {
      await callback();
      // The parent alone admits newly checked measurements. A fulfilled refresh
      // callback is not a measurement receipt or permission to reuse old beds.
    } catch {
      if (stillCurrent()) setMeasurementFeedback({ context, error: true,
        text: 'Could not check saved bed measurements. Try Check saved bed measurements again.' });
    } finally {
      if (measurementCheck.current === token) { measurementCheck.current = null; if (active.current) setCheckingLocally(false); }
    }
  }
  function replaceSession(profile: GrowerPlanningProfile | null) {
    const next = Object.freeze({ profileId: profile?.profileId ?? null, signature: profile ? JSON.stringify(profile) : null });
    sessionLive.current = next; heldSession.current = null; setSession(next); setReview(null); clearMeasurementCheck();
  }
  function editSourceIsCurrent(): boolean {
    if (!draftIsCurrent()) return false;
    if (session.profileId === null) return true;
    const latest = currentProfile(current.current.profiles, session.profileId, key);
    if (heldSession.current !== session && latest?.signature === session.signature) return true;
    heldSession.current = session; setReview(null); setFeedback(''); setError(changedSourceMessage); return false;
  }
  function switchUnits(choice: GrowerEstimateUnitChoice, remember = true) {
    if (!['metric', 'imperial'].includes(choice) || !draftIsCurrent()) return;
    const before = densityLive.current;
    const plant = switchCanonicalUnitDraft(densitySpec, before.plant, choice === 'metric' ? 'plants/m2' : 'plants/ft2', key);
    const harvest = switchCanonicalUnitDraft(densitySpec, before.harvest, choice === 'metric' ? 'kg/m2/cycle' : 'lb/ft2/cycle', key);
    if (plant.status !== 'ready' || harvest.status !== 'ready') {
      setUnitMessage('Finish both density and harvest-weight entries before changing units. Neither entry nor its unit was changed.'); return;
    }
    commitDensity({ ...before, choice, plant: plant.draft, harvest: harvest.draft });
    setUnitMessage('');
    if (!remember) return;
    // Publish staged drafts before synchronous listeners run. A nested actor or
    // value change must never be overwritten by this older write's completion.
    const outcome = writeGrowerEstimateUnitPreference(lease.current, choice);
    if (!draftIsCurrent() || densityLive.current.choice !== choice) return;
    setUnitMessage(outcome.destination === 'sample' ? 'Unit choice is temporary in this sample.'
      : outcome.remembered ? 'Unit choice remembered on this device.'
      : 'Unit choice cannot be remembered on this device. Your current entries remain usable.');
  }
  function editDensity(name: 'plant' | 'harvest', text: string) {
    if (!draftIsCurrent()) return;
    const before = densityLive.current, next = editCanonicalUnitDraft(densitySpec, before[name], 'value', text);
    // A pristine displayed string may be rounded. Its unchanged input event is
    // not new evidence, and must never replace a loaded source or invent one.
    if (next === before[name]) return;
    dirty();
    const origin = text.trim() === '' ? null : { decimal: text, unit: before[name].unit };
    commitDensity({ ...before, [name]: next, [name === 'plant' ? 'plantOrigin' : 'harvestOrigin']: origin });
  }
  function areaLabel(area: number): string {
    const unit = density.choice === 'metric' ? 'm2' : 'ft2', value = formatNurseryDimension(area, unit);
    return value === null ? 'Outside display range' : `${value} ${unit === 'm2' ? 'm²' : 'ft²'}`;
  }
  function harvestLabel(kg: number): string {
    const unit = density.choice === 'metric' ? 'kg' : 'lb', value = formatMassKilograms(kg, unit);
    return value === null ? 'Outside display range' : `${value} ${unit}`;
  }
  function dirty() { setFeedback(''); setError(''); setReview(null); }
  function reset() {
    setCropKey(''); setNumbers(emptyNumbers()); commitDensity(densityPair(key, densityLive.current.choice)); setEstablishment(''); setWindowKnown(false); setMonths([]);
    setConfirmed(false); replaceSession(null); setReview(null); setError(''); setFeedback('');
    setBedId(''); setEntryDate('');
  }
  function estimate<T, U extends string>(value: T, unit: U, recordedAt: string): GrowerInput<T, U> {
    return { state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt } };
  }
  function profile(recordedAt: string): GrowerPlanningProfile | null {
    if (!editSourceIsCurrent()) return null;
    if (!confirmed) { setError('Confirm that you supply these values as your estimates.'); return null; }
    const numberInput = <U extends string>(name: NumericKey, unit: U): GrowerInput<number, U> => numbers[name].trim() === ''
      ? { state: 'missing', reason: 'not-entered' } : estimate(Number(numbers[name]), unit, recordedAt);
    const plant = readCanonicalUnitDraft(densitySpec, densityLive.current.plant, key);
    const harvest = readCanonicalUnitDraft(densitySpec, densityLive.current.harvest, key);
    if (plant.status !== 'ready' || harvest.status !== 'ready') {
      setError('Density and harvest weight must be finished, finite and non-negative. Use a dot or comma decimal without grouping; blank values stay missing.'); return null;
    }
    const densityInput = <U extends string>(value: number | undefined, unit: U): GrowerInput<number, U> => value === undefined
      ? { state: 'missing', reason: 'not-entered' } : estimate(value, unit, recordedAt);
    const inputs: GrowerPlanningInputs = {
      plantsPerM2: densityInput(plant.values.value, 'plants/m2'), yieldKgPerM2: densityInput(harvest.values.value, 'kg/m2/cycle'),
      establishment: establishment === 'direct' || establishment === 'transplant' ? estimate(establishment, 'method', recordedAt) : { state: 'missing', reason: 'not-entered' },
      nurseryDays: numberInput('nurseryDays', 'days'), fieldEntryToFirstHarvestDays: numberInput('fieldEntryToFirstHarvestDays', 'days'),
      pickingDays: numberInput('pickingDays', 'days'), fieldOccupancyDays: numberInput('fieldOccupancyDays', 'days'),
      turnaroundDays: numberInput('turnaroundDays', 'days'),
      allowedEntryMonths: windowKnown ? estimate(months, 'utc-months', recordedAt) : { state: 'missing', reason: 'not-entered' },
    };
    const profileId = editingId ?? crypto.randomUUID();
    const base = normaliseGrowerPlanningProfile({ version: 1, profileId, cropKey, scope: normalScope, inputs });
    if (!base) { setError('Choose an existing crop identity. Supplied values must be finite and non-negative; durations must be whole days. Blank values stay missing.'); return null; }
    const exactDensitySources: Partial<Record<GrowerEstimateSourceField, GrowerEstimateSourceReceipt>> = {};
    const origins: Array<[GrowerEstimateSourceField, number | undefined, DensityOrigin | null]> = [
      ['plantsPerM2', plant.values.value, densityLive.current.plantOrigin],
      ['yieldKgPerM2', harvest.values.value, densityLive.current.harvestOrigin],
    ];
    for (const [field, canonical, origin] of origins) {
      if (!origin) continue;
      if (canonical === undefined) { setError('Re-enter the density field before saving or reviewing its original entry.'); return null; }
      const owner = { scopeKey: key, profileId, cropKey, field };
      const receipt = normaliseGrowerEstimateSourceReceipt({ ...owner, version: 1, conversion: 'density-si-v1', ...origin }, owner, canonical);
      if (!receipt) { setError('The original density entry cannot be retained with these values. Re-enter that field before saving or reviewing.'); return null; }
      exactDensitySources[field] = receipt;
    }
    const candidate = normaliseGrowerPlanningProfile({ ...base,
      ...(Object.keys(exactDensitySources).length ? { exactDensitySources } : {}) });
    if (!candidate) setError('Choose an existing crop identity. Supplied values must be finite and non-negative; durations must be whole days. Blank values stay missing.');
    return candidate;
  }
  function persist(next: GrowerPlanningProfile[], success: string, request: GrowerProfileChangeRequest) {
    if (!draftIsCurrent()) return false;
    let saved = false;
    try { saved = current.current.onSaveProfiles(next, request); } catch { /* A callback failure is a device-save failure too. */ }
    if (!draftIsCurrent()) return false;
    if (saved) { setError(''); setFeedback(success); }
    else { setFeedback(''); setError('Could not save on this device. Your previously saved profiles remain unchanged.'); }
    return saved;
  }
  function save(event: FormEvent) {
    event.preventDefault(); if (!draftIsCurrent()) return; setFeedback('');
    const candidate = profile(new Date().toISOString()); if (!candidate) return;
    // Merge at action time so editing one farm never drops newer profiles in
    // another farm or a just-completed parent save.
    if (!editSourceIsCurrent()) return;
    const latest = current.current.profiles;
    if (latest.some(item => item.profileId === candidate.profileId && scopeKey(item.scope) !== key)) {
      setError('This profile identity belongs to another scope. Start a new profile.'); return;
    }
    const expected = editingId === null ? null : currentProfile(latest, editingId, key);
    if (editingId !== null && expected?.signature !== session.signature) { setError(changedSourceMessage); return; }
    const request: GrowerProfileChangeRequest = { kind: 'edit', profileId: candidate.profileId, expectedProfile: expected?.profile ?? null };
    if (persist([...latest.filter(item => item.profileId !== candidate.profileId), candidate], 'Profile saved on this device.', request)) replaceSession(candidate);
  }
  function calculate() {
    if (!draftIsCurrent()) return;
    setError(''); setFeedback('');
    if (checking || measurementCheck.current) { setReview(null); setError('Wait for the saved bed measurement check to finish, then review the current bed.'); return; }
    if (!requiredMeasurementsReady || measurementIdentity(current.current, bedId) !== measurementKey) {
      setReview(null); setError('Check saved bed measurements before reviewing this bed. Estimate profiles can still be saved.'); return;
    }
    if (selectedBed && measuredAreas !== undefined && !selectedMeasurement) {
      setReview(null); setError('The selected bed does not have one matching saved measurement. Check saved bed measurements and select a current bed.'); return;
    }
    const recordedAt = new Date().toISOString(), candidate = profile(recordedAt); if (!candidate) return;
    const result = assessGrowerPlanning({ profile: candidate, scope: current.current.scope,
      measuredAreaM2: selectedBed ? { state: 'provided', value: selectedBed.areaM2, unit: 'm2',
        provenance: { kind: 'grower-record', recordedAt, reference: `Measured bed: ${selectedBed.id}` },
        ...(selectedMeasurement && Object.hasOwn(selectedMeasurement, 'arithmeticBasis') ? { arithmeticBasis: selectedMeasurement.arithmeticBasis } : {}) } : { state: 'missing', reason: 'not-entered' },
      fieldEntryDate: entryDate ? estimate(entryDate, 'utc-date', recordedAt) : { state: 'missing', reason: 'not-entered' } });
    if (editSourceIsCurrent() && measurementIdentity(current.current, bedId) === measurementKey) setReview({ key: draftKey, result });
  }
  function edit(profileId: string, shownSignature: string | null) {
    if (!draftIsCurrent()) return;
    const latest = currentProfile(current.current.profiles, profileId, key);
    if (!draftIsCurrent()) return;
    if (!latest || !shownSignature || latest.signature !== shownSignature) { setReview(null); setError(changedSourceMessage); return; }
    const value = latest.profile;
    if (value.provisionalOrigin) { setError('This profile preserves provisional source evidence. Open its saved evidence in Provisional crop preview; this estimate editor cannot replace that evidence.'); return; }
    if (value.plantCountOrigin) { setError('This estimate uses spacing cells. This editor cannot change that count basis; the original choices remain saved.'); return; }
    dirty(); replaceSession(value); setCropKey(value.cropKey);
    setNumbers(Object.fromEntries(numericFields.map(([name]) => [name, name === 'plantsPerM2' || name === 'yieldKgPerM2' ? '' : value.inputs[name].state === 'provided' ? String(value.inputs[name].value) : ''])) as Record<NumericKey, string>);
    commitDensity(densityPair(key, densityLive.current.choice, value.inputs.plantsPerM2.state === 'provided' ? value.inputs.plantsPerM2.value : undefined,
      value.inputs.yieldKgPerM2.state === 'provided' ? value.inputs.yieldKgPerM2.value : undefined, value.exactDensitySources));
    setEstablishment(value.inputs.establishment.state === 'provided' ? value.inputs.establishment.value : '');
    setWindowKnown(value.inputs.allowedEntryMonths.state === 'provided');
    setMonths(value.inputs.allowedEntryMonths.state === 'provided' ? [...value.inputs.allowedEntryMonths.value] : []);
    setConfirmed(false);
  }
  function remove(profileId: string, shownSignature: string | null) {
    if (!draftIsCurrent()) return;
    const latest = current.current.profiles, row = currentProfile(latest, profileId, key);
    if (!draftIsCurrent()) return;
    if (!row || !shownSignature || row.signature !== shownSignature) { setReview(null); setError(changedSourceMessage); return; }
    if (persist(latest.filter(profile => !(profile.profileId === profileId && scopeKey(profile.scope) === key)), 'Profile removed on this device.', { kind: 'remove', profileId, expectedProfile: row.profile })) {
      if (editingId === profileId) { reset(); setFeedback('Profile removed on this device.'); }
    }
  }

  return <details className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-primary)]">
    <summary className="min-h-11 cursor-pointer px-4 py-3 font-display font-semibold">Your growing estimates</summary>
    <section lang="en" aria-label="Grower planning estimates" className="space-y-4 px-4 pb-4 font-sans">
      <p className="text-sm text-[var(--text-secondary)]">Use your own estimates with an existing measured bed, in any country. Crop names identify your records only. These calculations do not use catalogue growing instructions or approve local suitability.</p>
      {!normalScope && <p role="note">Choose a current site or unmapped workspace first. No estimates can be saved or calculated without that context.</p>}
      {!available && <div role="alert" className="space-y-2 text-sm"><p>Growing estimates are held because this editor has no current account or sample context. Reload to open the current context; previous private drafts will not be reused.</p><button type="button" className={button} onClick={() => window.location.reload()}>Reload estimates</button></div>}
      {available && <>
      <label className="block text-sm">Estimate units<select className={field} value={density.choice} onChange={event => switchUnits(event.target.value as GrowerEstimateUnitChoice)}><option value="metric">Metric: m² and kg</option><option value="imperial">Imperial: ft² and lb</option></select></label>
      {unitMessage && <p role="status" className="text-sm">{unitMessage}</p>}
      <p className="text-xs text-[var(--text-secondary)]">Units change entry and display only. Saved density stays in plants per m² and harvest weight in kg per m² per cycle. Durations, whole plant counts and UTC dates keep their meaning.</p>
      <ul aria-label="Saved estimate profiles" className="space-y-2">
        {ownProfiles.map((item, index) => {
          // Bind callbacks to the row actually shown, never look up a newer row
          // under an old button's identity and silently treat it as reviewed.
          const shownSignature = profileSignature(item), shownProfileId = item.profileId;
          return <li key={`${item.profileId}:${index}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-2">
            <span className="flex-1 text-sm">{cropByKey(item.cropKey)?.name ?? 'Unknown crop identity'} · {item.provisionalOrigin ? 'saved provisional evidence; review above' : 'saved estimates'}</span>
            <button type="button" className={button} onClick={() => edit(shownProfileId, shownSignature)}>Edit {cropByKey(item.cropKey)?.name ?? 'profile'}</button>
            <button type="button" className={button} onClick={() => remove(shownProfileId, shownSignature)}>Remove {cropByKey(item.cropKey)?.name ?? 'profile'}</button>
          </li>;
        })}
      </ul>
      {ownProfiles.length === 0 && <p className="text-sm text-[var(--text-secondary)]">No saved estimate profiles for this context.</p>}
      <form onSubmit={save} className="space-y-3">
        <h3 className="font-semibold">{editingId ? 'Edit your estimates' : 'New estimate profile'}</h3>
        {editingId && <p className="text-sm text-[var(--text-secondary)]">Saving replaces these inputs with your newly confirmed estimates. Blank fields remain missing.</p>}
        {sourceChanged && <div role="alert" className="space-y-2 text-sm"><p>{changedSourceMessage}</p>
          {latestEditRow && <button type="button" className={button} onClick={() => edit(latestEditRow.profile.profileId, latestEditRow.signature)}>Reload saved estimate</button>}
        </div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Crop identity<select className={field} value={cropKey} onChange={event => { if (!draftIsCurrent()) return; dirty(); setCropKey(event.target.value); }}>
            <option value="">Choose an existing crop</option>{CROPS.map(crop => <option key={crop.key} value={crop.key}>{crop.name}</option>)}
          </select></label>
          <label className="text-sm">Establishment method<select className={field} value={establishment} onChange={event => { if (!draftIsCurrent()) return; dirty(); setEstablishment(event.target.value); }}>
            <option value="">Not entered</option><option value="direct">Direct in field</option><option value="transplant">Transplant from nursery</option>
          </select></label>
          {numericFields.map(([name, label, step]) => name === 'plantsPerM2' || name === 'yieldKgPerM2'
            ? <label key={name} className="text-sm">{density.choice === 'metric' ? label : name === 'plantsPerM2' ? 'Plant density (plants per ft²)' : 'Harvest weight (lb per ft² per cycle)'}<input type="text" inputMode="decimal" className={field} value={density[name === 'plantsPerM2' ? 'plant' : 'harvest'].fields.value.text} onChange={event => editDensity(name === 'plantsPerM2' ? 'plant' : 'harvest', event.target.value)} /></label>
            : <label key={name} className="text-sm">{label}<input type="number" min="0" step={step} inputMode="decimal" className={field} value={numbers[name]} onChange={event => { if (!draftIsCurrent()) return; dirty(); setNumbers(previous => ({ ...previous, [name]: event.target.value })); }} /></label>)}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">Leave unknown numbers blank. Nursery duration is required only for transplants. Field occupancy must include the full picking period. Zero is retained as entered; it is never treated as missing.</p>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={windowKnown} onChange={event => { if (!draftIsCurrent()) return; dirty(); setWindowKnown(event.target.checked); }} />I specify the allowed field-entry months</label>
        <fieldset disabled={!windowKnown} className="rounded-lg border border-[var(--border)] p-3">
          <legend className="px-1 text-sm">Allowed field-entry months (UTC)</legend>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">{MONTHS_SHORT.map((month, index) => <label key={month} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={months.includes(index + 1)} onChange={event => { if (!draftIsCurrent()) return; dirty(); setMonths(previous => event.target.checked ? [...previous, index + 1] : previous.filter(value => value !== index + 1)); }} />{month}</label>)}</div>
          <p className="text-xs text-[var(--text-secondary)]">An unspecified window stays missing. Specifying a window with no months permits no field-entry date.</p>
        </fieldset>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => { if (!draftIsCurrent()) return; dirty(); setConfirmed(event.target.checked); }} />I supply these as my estimates</label>
        <p className="text-xs text-[var(--text-secondary)]">Provided profile values are recorded as grower estimates at the time you save or review. They are not independently verified evidence.</p>
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={!normalScope} className={button}>Save estimate profile</button><button type="button" className={button} onClick={() => { if (draftIsCurrent()) reset(); }}>Start a new profile</button></div>
      </form>
      <fieldset className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <legend className="px-1 font-semibold">Review one measured bed</legend>
        {measurementsRequired && <p className="text-sm">{requiredMeasurementsReady ? 'Saved bed measurements are checked for this source. They are not an independent survey.' : 'Check the current saved layout before reviewing a measured bed. Estimate profiles can still be saved while measurements are unavailable.'}</p>}
        {!measurementsRequired && measuredAreas === undefined && <p className="text-xs text-[var(--text-secondary)]">This review uses the selected bed’s existing area value. No original saved dimensions have been supplied.</p>}
        {onCheckMeasurements && <button type="button" className={button} disabled={checking} onClick={checkMeasurements}>Check saved bed measurements</button>}
        {checking && <p role="status" className="text-sm">Checking saved bed measurements…</p>}
        {measurementFeedback?.context === measurementFeedbackContext && <p role={measurementFeedback.error ? 'alert' : 'status'} className="text-sm">{measurementFeedback.text}</p>}
        <label className="block text-sm">Measured bed<select className={field} value={bedId} onChange={event => { if (!draftIsCurrent()) return; dirty(); setBedId(event.target.value); }}>
          <option value="">Choose an existing bed</option>{beds.filter(bed => beds.filter(other => other.id === bed.id).length === 1).map(bed => <option key={bed.id} value={bed.id}>{bed.label} · {areaLabel(bed.areaM2)}</option>)}
        </select></label>
        <p className="text-sm">Measured area: {selectedBed ? areaLabel(selectedBed.areaM2) : 'Not selected'}. Area comes from this bed and cannot be changed here.</p>
        <label className="block text-sm">Planned field-entry date (UTC)<input type="date" className={field} value={entryDate} onChange={event => { if (!draftIsCurrent()) return; dirty(); setEntryDate(event.target.value); }} /></label>
        <button type="button" disabled={!normalScope} className={button} onClick={calculate}>Review estimated capacity and dates</button>
      </fieldset>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      {result && <section aria-label="Estimate review" className="space-y-2 rounded-xl border border-[var(--border)] p-3 text-sm">
        <h3 className="font-semibold">{result.status === 'ready' ? 'Estimated capacity and dates' : ({ 'missing-inputs': 'Missing inputs', 'invalid-inputs': 'Invalid inputs', 'scope-mismatch': 'Site or workspace mismatch', 'entry-window-excluded': 'Field-entry date outside your allowed window' })[result.status]}</h3>
        {result.status === 'ready' ? <>
          <p>Measured area: {areaLabel(result.capacity.measuredAreaM2)}</p><p>Estimated plants: {result.capacity.estimatedPlantCount}</p><p>Estimated harvest weight per cycle: {harvestLabel(result.capacity.estimatedYieldKg)}</p>
          <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">{Object.entries({ 'Field entry': result.schedule.fieldEntryDate, 'Nursery start': result.schedule.nurseryStartDate ?? 'Not applicable: direct in field', 'First harvest': result.schedule.firstHarvestDate, 'Picking ends (exclusive)': result.schedule.harvestEndExclusiveDate, 'Field clear': result.schedule.fieldClearDate, 'Next field entry': result.schedule.nextFieldEntryDate }).map(([label, value]) => <div key={label}><dt className="text-[var(--text-secondary)]">{label} (UTC)</dt><dd>{value}</dd></div>)}</dl>
        </> : <ul>{result.issues.map(issue => <li key={issue}>{issueLabel(issue)}</li>)}</ul>}
        <p className="text-[var(--text-secondary)]">Arithmetic from your estimates only. Density is not layout clearance, yield is not actual stock, and these dates are not local farming advice. No crop has been added to your plan.</p>
      </section>}
      </>}
    </section>
  </details>;
}
