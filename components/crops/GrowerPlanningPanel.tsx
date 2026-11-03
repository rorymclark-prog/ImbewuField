'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CROPS, cropByKey, MONTHS_SHORT } from '@/lib/crop-catalog';
import type { PlanBed } from '@/lib/crop-plan';
import {
  assessGrowerPlanning, growerPlanningScopeKey, normaliseGrowerPlanningProfile, normaliseGrowerPlanningScope,
  type GrowerInput, type GrowerPlanningAssessment, type GrowerPlanningInputs,
  type GrowerPlanningProfile, type GrowerPlanningScope,
} from '@/lib/international/grower-planning';

export interface GrowerPlanningPanelProps {
  scope: GrowerPlanningScope | null;
  beds: readonly PlanBed[];
  profiles: readonly GrowerPlanningProfile[];
  onSaveProfiles: (profiles: GrowerPlanningProfile[]) => boolean;
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

export default function GrowerPlanningPanel(props: GrowerPlanningPanelProps) {
  // Changing farms must discard the editor's authority, including callbacks an
  // earlier render left open. The parent remains the single persistence owner.
  const current = useRef(props); current.current = props;
  return <Editor key={scopeKey(props.scope)} {...props} current={current} />;
}

function Editor({ scope, beds, profiles, current }: GrowerPlanningPanelProps & {
  current: { current: GrowerPlanningPanelProps };
}) {
  const normalScope = normaliseGrowerPlanningScope(scope);
  const key = scopeKey(scope);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [cropKey, setCropKey] = useState('');
  const [numbers, setNumbers] = useState(emptyNumbers);
  const [establishment, setEstablishment] = useState('');
  const [windowKnown, setWindowKnown] = useState(false);
  const [months, setMonths] = useState<number[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bedId, setBedId] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState<{ key: string; result: GrowerPlanningAssessment } | null>(null);
  const ownProfiles = profiles.filter(profile => scopeKey(profile.scope) === key);
  const selectedBeds = beds.filter(bed => bed.id === bedId);
  const selectedBed = selectedBeds.length === 1 ? selectedBeds[0] : null;
  const draftKey = JSON.stringify([key, cropKey, numbers, establishment, windowKnown, months, confirmed,
    bedId, selectedBed?.areaM2, entryDate, editingId]);
  const result = review?.key === draftKey ? review.result : null;

  function authorised() { return active.current && normalScope && scopeKey(current.current.scope) === key; }
  function dirty() { setFeedback(''); setError(''); setReview(null); }
  function reset() {
    setCropKey(''); setNumbers(emptyNumbers()); setEstablishment(''); setWindowKnown(false); setMonths([]);
    setConfirmed(false); setEditingId(null); setReview(null); setError(''); setFeedback('');
    setBedId(''); setEntryDate('');
  }
  function estimate<T, U extends string>(value: T, unit: U, recordedAt: string): GrowerInput<T, U> {
    return { state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt } };
  }
  function profile(recordedAt: string): GrowerPlanningProfile | null {
    if (!authorised()) { setError('Choose a current site or workspace before saving or reviewing estimates.'); return null; }
    if (!confirmed) { setError('Confirm that you supply these values as your estimates.'); return null; }
    const numberInput = <U extends string>(name: NumericKey, unit: U): GrowerInput<number, U> => numbers[name].trim() === ''
      ? { state: 'missing', reason: 'not-entered' } : estimate(Number(numbers[name]), unit, recordedAt);
    const inputs: GrowerPlanningInputs = {
      plantsPerM2: numberInput('plantsPerM2', 'plants/m2'), yieldKgPerM2: numberInput('yieldKgPerM2', 'kg/m2/cycle'),
      establishment: establishment === 'direct' || establishment === 'transplant' ? estimate(establishment, 'method', recordedAt) : { state: 'missing', reason: 'not-entered' },
      nurseryDays: numberInput('nurseryDays', 'days'), fieldEntryToFirstHarvestDays: numberInput('fieldEntryToFirstHarvestDays', 'days'),
      pickingDays: numberInput('pickingDays', 'days'), fieldOccupancyDays: numberInput('fieldOccupancyDays', 'days'),
      turnaroundDays: numberInput('turnaroundDays', 'days'),
      allowedEntryMonths: windowKnown ? estimate(months, 'utc-months', recordedAt) : { state: 'missing', reason: 'not-entered' },
    };
    const candidate = normaliseGrowerPlanningProfile({ version: 1, profileId: editingId ?? crypto.randomUUID(), cropKey, scope: normalScope, inputs });
    if (!candidate) setError('Choose an existing crop identity. Supplied values must be finite and non-negative; durations must be whole days. Blank values stay missing.');
    return candidate;
  }
  function persist(next: GrowerPlanningProfile[], success: string) {
    let saved = false;
    try { saved = current.current.onSaveProfiles(next); } catch { /* A callback failure is a device-save failure too. */ }
    if (saved) { setError(''); setFeedback(success); }
    else { setFeedback(''); setError('Could not save on this device. Your previously saved profiles remain unchanged.'); }
    return saved;
  }
  function save(event: FormEvent) {
    event.preventDefault(); setFeedback('');
    const candidate = profile(new Date().toISOString()); if (!candidate) return;
    // Merge at action time so editing one farm never drops newer profiles in
    // another farm or a just-completed parent save.
    const latest = current.current.profiles;
    if (latest.some(item => item.profileId === candidate.profileId && scopeKey(item.scope) !== key)) {
      setError('This profile identity belongs to another scope. Start a new profile.'); return;
    }
    if (persist([...latest.filter(item => item.profileId !== candidate.profileId), candidate], 'Profile saved on this device.')) setEditingId(candidate.profileId);
  }
  function calculate() {
    setError(''); setFeedback('');
    const recordedAt = new Date().toISOString(), candidate = profile(recordedAt); if (!candidate) return;
    const result = assessGrowerPlanning({ profile: candidate, scope: current.current.scope,
      measuredAreaM2: selectedBed ? { state: 'provided', value: selectedBed.areaM2, unit: 'm2',
        provenance: { kind: 'grower-record', recordedAt, reference: `Measured bed: ${selectedBed.id}` } } : { state: 'missing', reason: 'not-entered' },
      fieldEntryDate: entryDate ? estimate(entryDate, 'utc-date', recordedAt) : { state: 'missing', reason: 'not-entered' } });
    setReview({ key: draftKey, result });
  }
  function edit(item: GrowerPlanningProfile) {
    if (!authorised()) return;
    const latest = current.current.profiles.find(profile => profile.profileId === item.profileId && scopeKey(profile.scope) === key);
    const value = normaliseGrowerPlanningProfile(latest);
    if (!value) { setError('This saved profile cannot be read as valid estimates.'); return; }
    dirty(); setEditingId(value.profileId); setCropKey(value.cropKey);
    setNumbers(Object.fromEntries(numericFields.map(([name]) => [name, value.inputs[name].state === 'provided' ? String(value.inputs[name].value) : ''])) as Record<NumericKey, string>);
    setEstablishment(value.inputs.establishment.state === 'provided' ? value.inputs.establishment.value : '');
    setWindowKnown(value.inputs.allowedEntryMonths.state === 'provided');
    setMonths(value.inputs.allowedEntryMonths.state === 'provided' ? [...value.inputs.allowedEntryMonths.value] : []);
    setConfirmed(false);
  }
  function remove(item: GrowerPlanningProfile) {
    if (!authorised()) return;
    const latest = current.current.profiles;
    if (!latest.some(profile => profile.profileId === item.profileId && scopeKey(profile.scope) === key)) { setError('This profile is no longer in the current scope.'); return; }
    if (persist(latest.filter(profile => !(profile.profileId === item.profileId && scopeKey(profile.scope) === key)), 'Profile removed on this device.')) {
      if (editingId === item.profileId) { reset(); setFeedback('Profile removed on this device.'); }
    }
  }

  return <details className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-primary)]">
    <summary className="min-h-11 cursor-pointer px-4 py-3 font-display font-semibold">Your growing estimates</summary>
    <section aria-label="Grower planning estimates" className="space-y-4 px-4 pb-4 font-sans">
      <p className="text-sm text-[var(--text-secondary)]">Use your own estimates with an existing measured bed, in any country. Crop names identify your records only. These calculations do not use catalogue growing instructions or approve local suitability.</p>
      {!normalScope && <p role="note">Choose a current site or unmapped workspace first. No estimates can be saved or calculated without that context.</p>}
      <ul aria-label="Saved estimate profiles" className="space-y-2">
        {ownProfiles.map(item => <li key={item.profileId} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-2">
          <span className="flex-1 text-sm">{cropByKey(item.cropKey)?.name ?? 'Unknown crop identity'} · saved estimates</span>
          <button type="button" className={button} onClick={() => edit(item)}>Edit {cropByKey(item.cropKey)?.name ?? 'profile'}</button>
          <button type="button" className={button} onClick={() => remove(item)}>Remove {cropByKey(item.cropKey)?.name ?? 'profile'}</button>
        </li>)}
      </ul>
      {ownProfiles.length === 0 && <p className="text-sm text-[var(--text-secondary)]">No saved estimate profiles for this context.</p>}
      <form onSubmit={save} className="space-y-3">
        <h3 className="font-semibold">{editingId ? 'Edit your estimates' : 'New estimate profile'}</h3>
        {editingId && <p className="text-sm text-[var(--text-secondary)]">Saving replaces these inputs with your newly confirmed estimates. Blank fields remain missing.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Crop identity<select className={field} value={cropKey} onChange={event => { dirty(); setCropKey(event.target.value); }}>
            <option value="">Choose an existing crop</option>{CROPS.map(crop => <option key={crop.key} value={crop.key}>{crop.name}</option>)}
          </select></label>
          <label className="text-sm">Establishment method<select className={field} value={establishment} onChange={event => { dirty(); setEstablishment(event.target.value); }}>
            <option value="">Not entered</option><option value="direct">Direct in field</option><option value="transplant">Transplant from nursery</option>
          </select></label>
          {numericFields.map(([name, label, step]) => <label key={name} className="text-sm">{label}<input type="number" min="0" step={step} inputMode="decimal" className={field} value={numbers[name]} onChange={event => { dirty(); setNumbers(previous => ({ ...previous, [name]: event.target.value })); }} /></label>)}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">Leave unknown numbers blank. Nursery duration is required only for transplants. Field occupancy must include the full picking period. Zero is retained as entered; it is never treated as missing.</p>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={windowKnown} onChange={event => { dirty(); setWindowKnown(event.target.checked); }} />I specify the allowed field-entry months</label>
        <fieldset disabled={!windowKnown} className="rounded-lg border border-[var(--border)] p-3">
          <legend className="px-1 text-sm">Allowed field-entry months (UTC)</legend>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">{MONTHS_SHORT.map((month, index) => <label key={month} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={months.includes(index + 1)} onChange={event => { dirty(); setMonths(previous => event.target.checked ? [...previous, index + 1] : previous.filter(value => value !== index + 1)); }} />{month}</label>)}</div>
          <p className="text-xs text-[var(--text-secondary)]">An unspecified window stays missing. Specifying a window with no months permits no field-entry date.</p>
        </fieldset>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => { dirty(); setConfirmed(event.target.checked); }} />I supply these as my estimates</label>
        <p className="text-xs text-[var(--text-secondary)]">Provided profile values are recorded as grower estimates at the time you save or review. They are not independently verified evidence.</p>
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={!normalScope} className={button}>Save estimate profile</button><button type="button" className={button} onClick={reset}>Start a new profile</button></div>
      </form>
      <fieldset className="space-y-3 rounded-xl border border-[var(--border)] p-3">
        <legend className="px-1 font-semibold">Review one measured bed</legend>
        <label className="block text-sm">Measured bed<select className={field} value={bedId} onChange={event => { dirty(); setBedId(event.target.value); }}>
          <option value="">Choose an existing bed</option>{beds.filter(bed => beds.filter(other => other.id === bed.id).length === 1).map(bed => <option key={bed.id} value={bed.id}>{bed.label} · {bed.areaM2} m²</option>)}
        </select></label>
        <p className="text-sm">Measured area: {selectedBed ? `${selectedBed.areaM2} m²` : 'Not selected'}. Area comes from this bed and cannot be changed here.</p>
        <label className="block text-sm">Planned field-entry date (UTC)<input type="date" className={field} value={entryDate} onChange={event => { dirty(); setEntryDate(event.target.value); }} /></label>
        <button type="button" disabled={!normalScope} className={button} onClick={calculate}>Review estimated capacity and dates</button>
      </fieldset>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      {result && <section aria-label="Estimate review" className="space-y-2 rounded-xl border border-[var(--border)] p-3 text-sm">
        <h3 className="font-semibold">{result.status === 'ready' ? 'Estimated capacity and dates' : ({ 'missing-inputs': 'Missing inputs', 'invalid-inputs': 'Invalid inputs', 'scope-mismatch': 'Site or workspace mismatch', 'entry-window-excluded': 'Field-entry date outside your allowed window' })[result.status]}</h3>
        {result.status === 'ready' ? <>
          <p>Measured area: {result.capacity.measuredAreaM2} m²</p><p>Estimated plants: {result.capacity.estimatedPlantCount}</p><p>Estimated harvest weight per cycle: {result.capacity.estimatedYieldKg} kg</p>
          <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">{Object.entries({ 'Field entry': result.schedule.fieldEntryDate, 'Nursery start': result.schedule.nurseryStartDate ?? 'Not applicable: direct in field', 'First harvest': result.schedule.firstHarvestDate, 'Picking ends (exclusive)': result.schedule.harvestEndExclusiveDate, 'Field clear': result.schedule.fieldClearDate, 'Next field entry': result.schedule.nextFieldEntryDate }).map(([label, value]) => <div key={label}><dt className="text-[var(--text-secondary)]">{label} (UTC)</dt><dd>{value}</dd></div>)}</dl>
        </> : <ul>{result.issues.map(issue => <li key={issue}>{issueLabel(issue)}</li>)}</ul>}
        <p className="text-[var(--text-secondary)]">Arithmetic from your estimates only. Density is not layout clearance, yield is not actual stock, and these dates are not local farming advice. No crop has been added to your plan.</p>
      </section>}
    </section>
  </details>;
}
