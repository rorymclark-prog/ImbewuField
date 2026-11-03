'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Target, Trash2 } from 'lucide-react';
import { CROPS, cropByKey, hasPlanningYield, MONTHS_SHORT, type RainPattern } from '@/lib/crop-catalog';
import { HARVEST_TARGET_UNITS, sanitiseHarvestTargets, type HarvestTarget, type PlanBed, type Planting, type HarvestPackUnit } from '@/lib/crop-plan';
import { suggestHarvestTargets, type AutoSuggestAnswers, type AutoSuggestResult } from '@/lib/crop-autosuggest';
import { assessHarvestTarget, HARVEST_TARGET_BASIS, targetMonthStamp } from '@/lib/harvest-targets';
import { numberLabel } from '@/lib/format-figures';
import { buildNurseryForecast } from '@/lib/crop-export-schedule';
import { sanitiseNurserySettings, type NurserySettings } from '@/lib/nursery-settings';
import { createMassDraft, editMassDraft, readMassDraft, switchMassDraftUnit, formatMassKilograms, type MassDraft, type MassUnit } from '@/lib/mass-units';
import { captureHarvestMassUnitPreferenceContext, harvestMassUnitPreferenceContextIsCurrent, readHarvestMassUnitPreference, writeHarvestMassUnitPreference, subscribeHarvestMassUnitPreferenceContext, revokeHarvestMassUnitPreferenceContext, type HarvestMassUnitPreferenceContext } from '@/lib/length-unit-preference';
import { harvestTargetsSourceKey, createHarvestSaveRequest, harvestSaveContextIsCurrent, harvestSaveResultMatches, harvestSaveResultSourceKey, type HarvestSaveContext, type HarvestSaveRequest, type HarvestSaveResult } from '@/lib/nursery-save-receipt';
import NurseryForecastSummary from './NurseryForecastSummary';

export interface HarvestTargetsPanelProps {
  /** Records remain useful where catalogue crop-plan assumptions are held. */
  basis?: 'catalogue' | 'own-records';
  siteId: string;
  targets: HarvestTarget[];
  beds: PlanBed[];
  plantings: Planting[];
  pattern: RainPattern;
  climate: Pick<AutoSuggestAnswers, 'siteMonthlyTempC' | 'siteMonthlyRainMm' | 'siteLatitude' | 'observedFrostMonths'>;
  nurserySettings?: NurserySettings;
  saveContext?: HarvestSaveContext | null;
  onTargets: (targets: HarvestTarget[], request?: HarvestSaveRequest) => boolean | void | HarvestSaveResult | Promise<boolean | void | HarvestSaveResult>;
  onSaveTargets?: (targets: HarvestTarget[], request?: HarvestSaveRequest) => boolean | void | HarvestSaveResult | Promise<boolean | void | HarvestSaveResult>;
  onAccept: (result: AutoSuggestResult) => void;
}

const field = 'w-full rounded-lg border px-3 py-2 text-sm bg-[var(--bg-0)] text-[var(--text-primary)] border-[var(--border)]';
const secondary = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)]';
const primary = 'min-h-11 rounded-lg px-4 py-2 text-sm font-semibold bg-[#1F4D2B] text-[#F7F2E9] disabled:opacity-50';
const amount = (kg: number | null, massUnit: MassUnit) => {
  const display = kg === null ? null : formatMassKilograms(kg, massUnit);
  return display === null ? 'Not calculated' : `${display} ${massUnit}`;
};
const unitLabel = (unit: string) => unit === 'each' ? 'items' : unit;
const packLabel = (unit: string) => ({ each: 'item / head', bunches: 'bunch', bags: 'bag', crates: 'crate', trays: 'tray' })[unit as HarvestPackUnit];
const weeklyLabel = (target: HarvestTarget, massUnit: MassUnit) => target.weeklyKg !== undefined
  ? `${amount(target.weeklyKg, massUnit)}/week`
  : `${numberLabel(target.weeklyQuantity)} ${unitLabel(target.unit)}/week`;
const targetAmount = (kg: number | null, target: HarvestTarget, massUnit: MassUnit) => kg === null ? 'Not calculated'
  : target.unit && target.kgPerUnit !== undefined
    ? `${numberLabel(kg / target.kgPerUnit, 1)} ${unitLabel(target.unit)} equivalent (${amount(kg, massUnit)})`
    : amount(kg, massUnit);
const monthName = (stamp: string) => `${MONTHS_SHORT[Number(stamp.slice(5)) - 1]} ${stamp.slice(0, 4)}`;

type Editor = { sourceKey: string; context: HarvestMassUnitPreferenceContext | null; saveContext: HarvestSaveContext | null;
  massUnit: MassUnit; weekly: MassDraft<'weeklyKg'>; pack: MassDraft<'kgPerUnit'>;
  cropKey: string; weeklyQuantity: string; unit: typeof HARVEST_TARGET_UNITS[number]; marketablePercent: string; outlet: string;
  startMonth: string; endMonth: string; editingId: string | null; irrigated: boolean; sharing: boolean; vines: boolean; dirty: boolean; uncertain: boolean };
function freshEditor(sourceKey: string, massUnit: MassUnit, context: HarvestMassUnitPreferenceContext | null, saveContext: HarvestSaveContext | null, basis: 'catalogue' | 'own-records', currentMonth: number): Editor {
  return { sourceKey, massUnit, context, saveContext,
    weekly: createMassDraft({ sourceKey, unit: massUnit, kilograms: { weeklyKg: undefined } }),
    pack: createMassDraft({ sourceKey, unit: massUnit, kilograms: { kgPerUnit: undefined }, optionalFields: ['kgPerUnit'] }),
    cropKey: '', weeklyQuantity: '', unit: 'kg', marketablePercent: '', outlet: '', editingId: null,
    startMonth: basis === 'catalogue' ? targetMonthStamp(currentMonth) : '', endMonth: basis === 'catalogue' ? targetMonthStamp(currentMonth + 11) : '',
    irrigated: false, sharing: false, vines: false, dirty: false, uncertain: false };
}
export default function HarvestTargetsPanel(props: HarvestTargetsPanelProps) {
  return <HarvestTargetEditor key={`${props.siteId}:${props.basis ?? 'catalogue'}`} {...props} />;
}
function HarvestTargetEditor({ siteId, targets, beds, plantings, pattern, climate, nurserySettings, onTargets, onSaveTargets, onAccept, basis = 'catalogue', saveContext }: HarvestTargetsPanelProps) {
  const today = new Date(), now = { year: today.getFullYear(), month: today.getMonth() + 1 };
  const currentMonth = now.year * 12 + now.month - 1, sourceKey = harvestTargetsSourceKey(siteId, targets) ?? '';
  const [editor, setEditor] = useState(() => freshEditor(sourceKey, 'kg', null, saveContext ?? null, basis, currentMonth));
  const { cropKey, unit, marketablePercent, outlet, startMonth, endMonth, editingId, irrigated, sharing, vines, massUnit } = editor;
  const weeklyQuantity = unit === 'kg' ? editor.weekly.fields.weeklyKg.text : editor.weeklyQuantity;
  const kgPerUnit = editor.pack.fields.kgPerUnit.text;
  const [error, setError] = useState(''), [saveStatus, setSaveStatus] = useState(''), [preferenceNote, setPreferenceNote] = useState('');
  const [review, setReview] = useState<{ key: string; result: AutoSuggestResult } | null>(null);
  const [accepted, setAccepted] = useState(false), [authorityChanged, setAuthorityChanged] = useState(false);
  const accepting = useRef(false), active = useRef(false), interacted = useRef(false), pending = useRef(false);
  // Equal source values can return under a new lease. Only this exact verified
  // write may hand its cleared/retained forms to delayed parent props once.
  const confirmedHandoff = useRef<{ result: unknown; request: HarvestSaveRequest; sourceKey: string } | null>(null);
  const ownTargets = targets.filter((t) => t.siteId === siteId);
  const answers: AutoSuggestAnswers = {
    goal: 'commercial', groups: [], cropKeys: ownTargets.map((t) => t.cropKey), rhythm: 'steady',
    rotateCrops: true, reliableIrrigation: irrigated, allowMixedCropsInBed: sharing,
    allowVinesInBeds: vines, ...climate,
  };
  const key = JSON.stringify([siteId, ownTargets, beds, plantings, pattern, answers, now]);
  const result = basis === 'catalogue' && review?.key === key ? review.result : null;
  const nurseryForecast = useMemo(() => result
    ? buildNurseryForecast([...plantings, ...result.plantings], beds, siteId, sanitiseNurserySettings(nurserySettings), now)
    : null, [plantings, result, beds, siteId, nurserySettings, now]);
  const assessments = basis === 'catalogue' ? ownTargets.map((target) => assessHarvestTarget(target, beds, plantings)!) : [];
  const producerExpected = saveContext !== undefined;
  const live = useRef({ sourceKey, editor, saveContext, producerExpected, onTargets, onSaveTargets, onAccept, basis, key, result });
  live.current = { sourceKey, editor, saveContext, producerExpected, onTargets, onSaveTargets, onAccept, basis, key, result };
  useEffect(() => {
    active.current = true; const captured = captureHarvestMassUnitPreferenceContext();
    setEditor(previous => ({ ...previous, context: captured }));
    const stop = subscribeHarvestMassUnitPreferenceContext(captured, () => { if (active.current) setAuthorityChanged(true); });
    const preference = readHarvestMassUnitPreference(captured);
    setEditor(previous => interacted.current || !harvestMassUnitPreferenceContextIsCurrent(captured) ? previous
      : freshEditor(previous.sourceKey, preference.unit, captured, previous.saveContext, basis, currentMonth));
    if (preference.remembered) setPreferenceNote(interacted.current ? 'Your entries keep their original weight unit. Choose a weight unit explicitly to change it.' : 'Harvest weight unit remembered on this device.');
    return () => { active.current = false; stop(); revokeHarvestMassUnitPreferenceContext(captured); };
  }, []);
  useEffect(() => {
    setEditor(previous => {
      if (previous.sourceKey === sourceKey) {
        const handoff = confirmedHandoff.current;
        const confirmsThisWrite = !!handoff && handoff.sourceKey === sourceKey
          && harvestSaveResultSourceKey(handoff.result, handoff.request) === sourceKey;
        if (saveContext && harvestSaveContextIsCurrent(saveContext) && previous.saveContext !== saveContext
          && (confirmsThisWrite || !previous.saveContext && !previous.dirty && !previous.uncertain && !interacted.current)) {
          confirmedHandoff.current = null; return { ...previous, saveContext };
        }
        return previous;
      }
      return pending.current || previous.dirty || previous.uncertain ? previous : freshEditor(sourceKey, previous.massUnit, previous.context, saveContext ?? null, basis, currentMonth);
    });
  }, [sourceKey, saveContext]);
  const actorCurrent = !authorityChanged && harvestMassUnitPreferenceContextIsCurrent(editor.context);
  const current = actorCurrent && !!sourceKey && editor.sourceKey === sourceKey && !editor.uncertain
    && (!producerExpected || !!editor.saveContext && harvestSaveContextIsCurrent(editor.saveContext));
  function isCurrent(captured: Editor) {
    const latest = live.current;
    return active.current && !authorityChanged && harvestMassUnitPreferenceContextIsCurrent(captured.context)
      && latest.editor === captured && !!latest.sourceKey && captured.sourceKey === latest.sourceKey
      && (!latest.producerExpected || !!captured.saveContext && harvestSaveContextIsCurrent(captured.saveContext));
  }
  function mutate(change: (previous: Editor) => Editor) {
    const captured = editor; if (!isCurrent(captured) || pending.current || captured.uncertain) return;
    interacted.current = true;
    setEditor(previous => previous === captured && isCurrent(captured) && !pending.current && !previous.uncertain ? change(previous) : previous);
  }
  const setWeeklyQuantity = (text: string) => mutate(previous => previous.unit === 'kg'
    ? { ...previous, weekly: editMassDraft(previous.weekly, 'weeklyKg', text), dirty: true }
    : { ...previous, weeklyQuantity: text, dirty: true });
  const setKgPerUnit = (text: string) => mutate(previous => ({ ...previous, pack: editMassDraft(previous.pack, 'kgPerUnit', text), dirty: true }));
  const setMarketablePercent = (text: string) => mutate(previous => ({ ...previous, marketablePercent: text, dirty: true }));
  const setOutlet = (text: string) => mutate(previous => ({ ...previous, outlet: text, dirty: true }));
  const setStartMonth = (text: string) => mutate(previous => ({ ...previous, startMonth: text, dirty: true }));
  const setEndMonth = (text: string) => mutate(previous => ({ ...previous, endMonth: text, dirty: true }));
  const setUnit = (unit: Editor['unit']) => mutate(previous => ({ ...previous, unit,
    weeklyQuantity: previous.unit === 'kg' ? previous.weekly.fields.weeklyKg.text : previous.weeklyQuantity,
    weekly: unit === 'kg' ? previous.unit !== 'kg' ? editMassDraft(previous.weekly, 'weeklyKg', previous.weeklyQuantity) : previous.weekly
      : createMassDraft({ sourceKey: previous.sourceKey, unit: previous.massUnit, kilograms: { weeklyKg: undefined } }),
    pack: createMassDraft({ sourceKey: previous.sourceKey, unit: previous.massUnit, kilograms: { kgPerUnit: undefined }, optionalFields: ['kgPerUnit'] }), dirty: true }));
  const setIrrigated = (value: boolean) => mutate(previous => ({ ...previous, irrigated: value }));
  const setSharing = (value: boolean) => mutate(previous => ({ ...previous, sharing: value }));
  const setVines = (value: boolean) => mutate(previous => ({ ...previous, vines: value }));
  function clearForm(previous: Editor, newKey = previous.sourceKey, newContext = previous.saveContext): Editor {
    return { ...freshEditor(newKey, previous.massUnit, previous.context, newContext, basis, currentMonth), irrigated: previous.irrigated, sharing: previous.sharing, vines: previous.vines };
  }
  function resetForm() { mutate(previous => clearForm(previous)); setError(''); }
  function changeMassUnit(nextUnit: MassUnit) {
    if (!['kg', 'lb'].includes(nextUnit)) return;
    const captured = editor; if (!isCurrent(captured) || pending.current || captured.uncertain) return;
    interacted.current = true;
    setEditor(previous => {
      if (previous !== captured || !isCurrent(captured) || pending.current) return previous;
      const invalidDomain = [...Object.values(previous.weekly.fields), ...Object.values(previous.pack.fields)].some(field => field.status === 'ready' && field.canonicalValue !== undefined && field.canonicalValue <= 0);
      const weekly = switchMassDraftUnit(previous.weekly, nextUnit, sourceKey), pack = switchMassDraftUnit(previous.pack, nextUnit, sourceKey);
      if (invalidDomain || weekly.status !== 'ready' || pack.status !== 'ready') { setError('Complete valid positive weights before switching units. Your entries keep their original weight unit.'); return previous; }
      setError(''); return { ...previous, massUnit: nextUnit, weekly: weekly.draft, pack: pack.draft };
    });
  }
  const remembered = useRef<{ context: HarvestMassUnitPreferenceContext | null; unit: MassUnit } | null>(null);
  useEffect(() => {
    if (!interacted.current || remembered.current?.unit === massUnit && remembered.current.context === editor.context) return;
    remembered.current = { context: editor.context, unit: massUnit };
    if (!isCurrent(editor)) return;
    const outcome = writeHarvestMassUnitPreference(editor.context, massUnit);
    setPreferenceNote(outcome.remembered ? 'Harvest weight unit remembered on this device.' : outcome.destination === 'sample'
      ? 'Harvest weight unit applies only to this sample session.' : 'Harvest weight unit works here, but could not be remembered on this device.');
  }, [massUnit]);
  function reload() {
    if (!active.current || !actorCurrent || !sourceKey || pending.current) return;
    if (producerExpected && (!saveContext || !harvestSaveContextIsCurrent(saveContext))) { setError('Reopen the crop plan to check its saved harvest targets before retrying.'); return; }
    confirmedHandoff.current = null;
    setEditor(freshEditor(sourceKey, massUnit, editor.context, saveContext ?? null, basis, currentMonth)); setError(''); setReview(null); setAccepted(false);
    setSaveStatus(saveContext ? 'Saved harvest targets reloaded.' : 'Harvest entries reloaded from the current plan. Device save is not confirmed.');
  }
  function persist(next: HarvestTarget[], clear: (previous: Editor) => Editor) {
    const captured = editor;
    if (!isCurrent(captured) || pending.current || captured.uncertain) { setError('The harvest targets or account context changed. Reload saved targets before continuing.'); return; }
    const request = captured.saveContext ? createHarvestSaveRequest(captured.saveContext, next) : null;
    if (captured.saveContext && !request) { setError('The harvest save context changed. Reload saved targets before continuing.'); return; }
    confirmedHandoff.current = null; interacted.current = true; pending.current = true; setSaveStatus('Checking harvest target save…');
    const unconfirmed = () => {
      setEditor(previous => previous !== captured ? previous : { ...previous, uncertain: true, dirty: true });
      setSaveStatus('Save outcome is not confirmed. Your entries are retained. Reload saved harvest targets before trying again.');
    };
    const finish = (outcome: boolean | void | HarvestSaveResult) => {
      pending.current = false;
      if (!active.current || !harvestMassUnitPreferenceContextIsCurrent(captured.context) || live.current.editor !== captured) return;
      const destination = request ? harvestSaveResultMatches(outcome, request) : null;
      const confirmedKey = destination && request ? harvestSaveResultSourceKey(outcome, request) : null;
      if (!destination || !confirmedKey) { unconfirmed(); return; }
      confirmedHandoff.current = request && !(live.current.saveContext && harvestSaveContextIsCurrent(live.current.saveContext))
        ? { result: outcome, request, sourceKey: confirmedKey } : null;
      setEditor(previous => previous !== captured ? previous : clear({ ...previous, sourceKey: confirmedKey, saveContext: live.current.saveContext ?? null,
        weekly: { ...previous.weekly, sourceKey: confirmedKey }, pack: { ...previous.pack, sourceKey: confirmedKey }, uncertain: false }));
      setError(''); setSaveStatus(destination === 'sample' ? 'Buyer targets kept in this sample session.' : 'Buyer targets saved on this device.'); setAccepted(false);
    };
    try {
      const outcome = live.current.onSaveTargets ? live.current.onSaveTargets(next, request ?? undefined) : live.current.onTargets(next, request ?? undefined);
      if (outcome && typeof (outcome as Promise<unknown>).then === 'function') Promise.resolve(outcome).then(finish, () => finish(undefined));
      else finish(outcome as boolean | void | HarvestSaveResult);
    } catch { finish(undefined); }
  }
  function editTarget(target: HarvestTarget) {
    mutate(previous => ({ ...previous, editingId: target.id, cropKey: target.cropKey, weeklyQuantity: target.weeklyQuantity === undefined ? '' : String(target.weeklyQuantity), unit: target.unit ?? 'kg',
      weekly: createMassDraft({ sourceKey: previous.sourceKey, unit: previous.massUnit, kilograms: { weeklyKg: target.weeklyKg } }),
      pack: createMassDraft({ sourceKey: previous.sourceKey, unit: previous.massUnit, kilograms: { kgPerUnit: target.kgPerUnit }, optionalFields: ['kgPerUnit'] }),
      marketablePercent: target.marketablePercent === undefined ? '' : String(target.marketablePercent), outlet: target.outlet ?? '', startMonth: target.startMonth, endMonth: target.endMonth, dirty: true }));
    setError(''); setSaveStatus('');
  }
  function removeTarget(target: HarvestTarget) {
    persist(targets.filter(row => row.siteId !== siteId || row.id !== target.id), previous => previous.editingId === target.id ? clearForm(previous) : previous);
  }
  function saveTarget(event: FormEvent) {
    event.preventDefault(); setSaveStatus('');
    const base = { id: editingId ?? crypto.randomUUID(), siteId, cropKey, startMonth, endMonth,
      ...(outlet.trim() ? { outlet: outlet.trim() } : {}), ...(marketablePercent.trim() ? { marketablePercent: Number(marketablePercent) } : {}) };
    const weekly = readMassDraft(editor.weekly, sourceKey), pack = readMassDraft(editor.pack, sourceKey);
    if (unit === 'kg' ? weekly.status !== 'ready' : pack.status !== 'ready') { setError('Choose a crop, positive quantity and 1–12 harvest months. Items need whole numbers. Enter a positive pack weight when known and a saleable share from 0–100%.'); return; }
    const target: HarvestTarget = unit === 'kg' ? { ...base, weeklyKg: weekly.status === 'ready' ? weekly.kilograms.weeklyKg! : NaN }
      : { ...base, weeklyQuantity: Number(editor.weeklyQuantity), unit: unit as HarvestPackUnit,
        ...(pack.status === 'ready' && pack.kilograms.kgPerUnit !== undefined ? { kgPerUnit: pack.kilograms.kgPerUnit } : {}) };
    const saved = sanitiseHarvestTargets([target])[0];
    if (!saved) { setError('Choose a crop, positive quantity and 1–12 harvest months. Items need whole numbers. Enter a positive pack weight when known and a saleable share from 0–100%.'); return; }
    persist([...targets.filter(t => t.siteId !== siteId || t.id !== saved.id), saved], previous => clearForm(previous));
  }
  function catalogueCurrent() { return isCurrent(editor) && live.current.basis === 'catalogue' && live.current.key === key; }
  if (!editor.context || authorityChanged || !actorCurrent) return <details className="mb-4 rounded-2xl border p-4"><summary>Harvest targets</summary><p role="status">{editor.context || authorityChanged
    ? 'The account or sample session changed. Reopen the crop plan to load its harvest targets.' : 'Checking the account or sample context before showing harvest targets.'}</p>
    <label>Harvest weight unit<select aria-label="Harvest weight unit" value="kg" disabled><option value="kg">Kilograms (kg)</option></select></label></details>;
  return <details className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-primary)]">
    <summary className="min-h-12 cursor-pointer px-4 py-3 font-display font-semibold">
      <Target size={17} aria-hidden className="inline mr-2 align-text-bottom" />
      Harvest targets{ownTargets.length > 0 ? ` · ${ownTargets.length}` : ''}{' '}
      <span className="ml-2 text-xs font-sans font-normal text-[var(--text-secondary)]">{basis === 'catalogue' ? 'Plan from weekly demand' : 'Your buyer-demand records'}</span>
    </summary>
    <div className="px-4 pb-4 space-y-4 font-sans">
      <p className="text-sm text-[var(--text-secondary)]">{basis === 'catalogue'
        ? 'Plan the produce you want each week for a market, restaurant or box scheme. Review the growing space and dated sowings before adding them to your saved beds.'
        : 'Record what a market, restaurant or box scheme wants. Crop names identify your records. Use your own growing estimates below to review capacity; saving a target does not approve local farming advice or promise supply.'}</p>
      <label className="text-sm">Harvest weight unit<select aria-label="Harvest weight unit" value={massUnit} onChange={event => changeMassUnit(event.target.value as MassUnit)} className={field} disabled={!current || pending.current}>
        <option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option>
      </select></label>
      <p className="text-xs text-[var(--text-secondary)]">Weight units change entry and display only. Saved weights stay in kilograms. Use decimals with a dot or comma; no grouping, fractions or unit suffixes. Pack counts, sales units, dates and saleable share are unchanged.</p>
      {preferenceNote && <p role="status" className="text-xs">{preferenceNote}</p>}
      {producerExpected && !editor.saveContext && <p role="status">{saveContext ? 'The target save context arrived after these entries. Reload saved harvest targets before continuing.' : 'Preparing the harvest target save context before editing.'}</p>}
      {!sourceKey || editor.sourceKey !== sourceKey || editor.uncertain ? <p role="alert">Saved harvest targets changed or a save outcome is unconfirmed. Your entries are retained. Reload saved targets before continuing.</p> : null}
      <button type="button" className={secondary} onClick={reload} disabled={!actorCurrent || pending.current}>Reload saved harvest targets</button>
      <form onSubmit={saveTarget} onChange={() => setSaveStatus('')} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-sm">Crop
          <select required value={cropKey} onChange={(e) => { const cropKey = e.target.value; mutate(previous => ({ ...previous, cropKey, pack: createMassDraft({ sourceKey: previous.sourceKey, unit: previous.massUnit, kilograms: { kgPerUnit: undefined }, optionalFields: ['kgPerUnit'] }), marketablePercent: '', dirty: true })); }} className={field} disabled={!current || pending.current}>
            <option value="">Choose a crop</option>
            {CROPS.filter((c) => basis === 'own-records' || hasPlanningYield(c) || c.yieldKgPerM2 === null).map((crop) => <option key={crop.key} value={crop.key}>{crop.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Weekly quantity{unit === 'kg' ? ` (${massUnit})` : ''}
          <input required type={unit === 'kg' ? 'text' : 'number'} min="0" step={unit === 'each' ? '1' : 'any'} inputMode="decimal" value={weeklyQuantity} onChange={(e) => setWeeklyQuantity(e.target.value)} className={field} disabled={!current || pending.current} />
        </label>
        <label className="text-sm">Sales unit
          <select value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)} className={field} disabled={!current || pending.current}>
            {HARVEST_TARGET_UNITS.map((u) => <option key={u} value={u}>{u === 'kg' ? massUnit : u === 'each' ? 'Items / heads' : u === 'trays' ? 'Trays of harvested produce' : u}</option>)}
          </select>
        </label>
        <label className="text-sm">For (optional)
          <input value={outlet} onChange={(e) => setOutlet(e.target.value)} maxLength={120} placeholder="Market, restaurant or box scheme" className={field} disabled={!current || pending.current} />
        </label>
        <label className="text-sm">First harvest month
          <input required type="month" min="2020-01" max="2099-12" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className={field} disabled={!current || pending.current} />
        </label>
        <label className="text-sm">Last harvest month (included)
          <input required type="month" min={startMonth || '2020-01'} max="2099-12" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className={field} disabled={!current || pending.current} />
        </label>
        {unit !== 'kg' && <label className="text-sm">{`Harvest ${massUnit} per ${packLabel(unit)} (your estimate)`}
          <input inputMode="decimal" value={kgPerUnit} onChange={(e) => setKgPerUnit(e.target.value)} placeholder="Leave blank until you know" className={field} disabled={!current || pending.current} />
        </label>}
        <label className="text-sm">Saleable share (%) (optional)
          <input type="number" min="0" max="100" step="any" inputMode="decimal" value={marketablePercent} onChange={(e) => setMarketablePercent(e.target.value)} placeholder="Your own estimate" className={field} disabled={!current || pending.current} />
        </label>
        <p className="sm:col-span-2 lg:col-span-4 text-xs text-[var(--text-secondary)]">{basis === 'catalogue'
          ? 'Use your measured harvest weight for one produce pack. A target without its pack weight stays saved; growing space waits for that conversion. The saleable share is a percentage of the catalogue benchmark; leave it blank to apply no allowance. Trays here contain harvested produce; nursery starts need their own planning.'
          : 'Use your own harvest weight per sales unit and saleable share. Blank values stay saved as unknown; own-cycle capacity waits for them. Trays here contain harvested produce, not nursery seedlings.'}</p>
        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={!current || pending.current} className={primary}>{editingId ? 'Save target changes' : 'Save harvest target'}</button>
          {editingId && <button type="button" className={secondary} onClick={resetForm}>Cancel edit</button>}
          <span className="text-xs text-[var(--text-secondary)]">Targets are saved with this site’s crop plan on this device.</span>
        </div>
        {error && <p role="alert" className="sm:col-span-2 lg:col-span-4 text-sm text-[var(--gold)]">{error}</p>}
      </form>
      {saveStatus && <p role="status">{saveStatus}</p>}
      {basis === 'own-records' && ownTargets.map(target => <article key={target.id} className="space-y-2 rounded-xl border border-[var(--border)] p-3 text-sm">
        <h3 className="font-semibold">{cropByKey(target.cropKey)?.name ?? target.cropKey} · {weeklyLabel(target, massUnit)}</h3>
        <p>{monthName(target.startMonth)} – {monthName(target.endMonth)}. Saleable share: {target.marketablePercent === undefined ? 'unknown' : `${target.marketablePercent}%`}.</p>
        <div className="flex gap-2"><button type="button" className={secondary} onClick={() => editTarget(target)}>Edit</button>
          <button type="button" className={secondary} onClick={() => removeTarget(target)} aria-label={`Remove ${cropByKey(target.cropKey)?.name} target`}>Remove</button></div>
      </article>)}

      {assessments.map((a) => <article key={a.target.id} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div><h3 className="font-display font-semibold">{cropByKey(a.target.cropKey)?.name} · {weeklyLabel(a.target, massUnit)}</h3>
            {a.target.outlet && <p className="text-sm">{a.target.outlet}</p>}
            <p className="text-xs text-[var(--text-secondary)]">{monthName(a.target.startMonth)} – {monthName(a.target.endMonth)} · {a.days} days</p></div>
          <div className="flex gap-1 flex-shrink-0"><button type="button" className={secondary} onClick={() => editTarget(a.target)}>Edit</button><button type="button" className={secondary} aria-label={`Remove ${cropByKey(a.target.cropKey)?.name} target`} onClick={() => removeTarget(a.target)}><Trash2 size={16} aria-hidden /></button></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
          <p><span className="block text-xs text-[var(--text-secondary)]">Total demand</span>{targetAmount(a.demandKg, a.target, massUnit)}</p>
          <p><span className="block text-xs text-[var(--text-secondary)]">Crop-cycle area needed</span>{a.cycleAreaM2 === null ? 'Not calculated' : `${numberLabel(a.cycleAreaM2, 1)} m²`}</p>
          <p><span className="block text-xs text-[var(--text-secondary)]">{a.target.marketablePercent === undefined ? 'Benchmark before allowance' : 'Capacity after your allowance'}</span>{a.missingReasons.includes('crop-evidence') ? 'Not calculated' : targetAmount(a.allocatedKg, a.target, massUnit)}</p>
          <p><span className="block text-xs text-[var(--text-secondary)]">Unallocated volume</span>{targetAmount(a.shortageKg, a.target, massUnit)}</p>
        </div>
        {a.surplusKg !== null && a.surplusKg > 0.001 && <p className="text-xs">{targetAmount(a.surplusKg, a.target, massUnit)} above total demand because whole fields or standard bed shares are used.</p>}
        {a.target.unit && a.target.kgPerUnit !== undefined && <p className="text-xs">Your conversion: {formatMassKilograms(a.target.kgPerUnit, massUnit)} {massUnit} of harvest per {packLabel(a.target.unit)}. Pack equivalents are estimates, not packed stock.</p>}
        {a.target.marketablePercent !== undefined && <p className="text-xs">Your saleable share: {numberLabel(a.target.marketablePercent)}%. Benchmark before your allowance: {amount(a.grossCycleKg, massUnit)}. This allowance sizes this target; production graphs keep the harvest benchmark.</p>}
        {a.missingReasons.includes('unit-weight') && <p className="text-xs text-[var(--gold)]">Enter your own harvest weight per sales unit before calculating growing space or suggesting sowings.</p>}
        {a.missingReasons.includes('zero-saleable-share') && <p className="text-xs text-[var(--gold)]">Your saleable share is 0%, so no saleable capacity can be planned.</p>}
        {a.missingReasons.includes('crop-evidence') && <p className="text-xs text-[var(--gold)]">Verified crop yield, timing or establishment evidence is missing.</p>}
        {a.gapMonths.length > 0 && <p className="text-xs text-[var(--gold)]">No linked picking window: {a.gapMonths.map(monthName).join(', ')}.</p>}
        {a.excludedRows > 0 && <p className="text-xs text-[var(--gold)]">{a.excludedRows} linked planting(s) excluded: check dates, crop, timing evidence, mapped area and overlaps.</p>}
        <p className="text-xs text-[var(--text-secondary)]">Area is summed across crop cycles; successive crops may reuse ground. Weekly supply remains unverified.</p>
      </article>)}

      {basis === 'catalogue' && ownTargets.length > 0 && <>
        <fieldset className="flex flex-col gap-2 text-sm"><legend className="mb-2 font-semibold">Before suggesting sowings</legend>
          <label className="flex gap-2 items-start min-h-8"><input type="checkbox" checked={irrigated} onChange={(e) => setIrrigated(e.target.checked)} className="mt-1" />Reliable irrigation for every crop cycle</label>
          <label className="flex gap-2 items-start min-h-8"><input type="checkbox" checked={sharing} onChange={(e) => setSharing(e.target.checked)} className="mt-1" />Allow standard bed shares (whole open fields stay whole)</label>
          <label className="flex gap-2 items-start min-h-8"><input type="checkbox" checked={vines} onChange={(e) => setVines(e.target.checked)} className="mt-1" />Allow space-hungry crops in beds after checking their layout</label>
        </fieldset>
        <p className="text-xs text-[var(--text-secondary)]">Rotation is checked. Sowing searches the next 12 months using the existing South African calendar and available site climate. Earlier-ending targets are placed first. Saved crops are kept; only plantings linked to a target count towards it.</p>
        <button type="button" className={primary} onClick={() => { if (!catalogueCurrent()) return; accepting.current = false; setAccepted(false); setReview({ key, result: suggestHarvestTargets(ownTargets, siteId, answers, pattern, beds, plantings, now) }); }}>Suggest target sowings</button>
      </>}

      {result && <section aria-label="Target sowing review" className="rounded-xl border border-[var(--border)] p-3 space-y-3">
        <h3 className="font-display font-semibold">Review {result.plantings.length} proposed sowing{result.plantings.length === 1 ? '' : 's'}</h3>
        {ownTargets.map((target) => {
          const a = assessHarvestTarget(target, beds, [...plantings, ...result.plantings])!;
          return <p key={target.id} className="text-sm"><strong>{cropByKey(target.cropKey)?.name} · {weeklyLabel(target, massUnit)}:</strong> {a.demandKg === null ? 'Growing space awaits your pack weight. ' : `${targetAmount(a.allocatedKg, target, massUnit)} linked cycle capacity after adding${target.marketablePercent === undefined ? ' (unadjusted benchmark)' : ' (after your saleable allowance)'}; ${targetAmount(a.shortageKg, target, massUnit)} still unallocated. `}{a.surplusKg !== null && a.surplusKg > 0.001 ? `${targetAmount(a.surplusKg, target, massUnit)} above total demand. ` : ''}{a.gapMonths.length ? `No picking window in ${a.gapMonths.map(monthName).join(', ')}.` : 'A picking window reaches each requested month; weekly quantities remain unverified.'}</p>;
        })}
        {result.plantings.length > 0 && <div className="max-h-64 overflow-auto"><table className="w-full text-left text-xs">
          <caption className="text-left mb-2">Proposed additions — saved crops stay in place</caption>
          <thead><tr><th className="py-2 pr-3">Growing area</th><th className="py-2 pr-3">Crop</th><th className="py-2 pr-3">Sow</th><th className="py-2">Share</th></tr></thead>
          <tbody>{result.plantings.map((p) => <tr key={p.id} className="border-t border-[var(--border)]"><td className="py-2 pr-3">{beds.find((b) => b.id === p.bedId)?.label}</td><td className="py-2 pr-3">{cropByKey(p.cropKey)?.name}</td><td className="py-2 pr-3 whitespace-nowrap">{monthName(p.once!)}</td><td className="py-2">{p.areaFraction ? `${numberLabel(p.areaFraction * 100, 1)}%` : 'Whole area'}</td></tr>)}</tbody>
        </table></div>}
        <ul className="text-xs space-y-2 text-[var(--text-secondary)]">{result.notes.map((note, i) => <li key={i}>{note.text}</li>)}</ul>
        {nurseryForecast && result.plantings.length > 0 && <NurseryForecastSummary
          forecast={nurseryForecast} beds={beds} compact title="Nursery check before adding target sowings"
        />}
        {result.plantings.length > 0 && <button type="button" className={primary} onClick={() => {
          if (accepting.current || !catalogueCurrent() || live.current.result !== result) return;
          accepting.current = true; live.current.onAccept(result); setReview(null); setAccepted(true);
        }}>Add {result.plantings.length} dated sowing{result.plantings.length === 1 ? '' : 's'} to my plan</button>}
      </section>}
      {accepted && <p role="status" className="text-sm">Dated sowings added. Review their preparation, sowing and harvest tasks in the calendar below. They do not repeat next year.</p>}
      <p className="text-xs text-[var(--text-secondary)]">{basis === 'catalogue' ? HARVEST_TARGET_BASIS : 'Buyer demand is separate from crop capacity, observed harvests and sales.'} Removing a target keeps its plantings.</p>
    </div>
  </details>;
}
