'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Target, Trash2 } from 'lucide-react';
import { CROPS, cropByKey, hasPlanningYield, MONTHS_SHORT, type RainPattern } from '@/lib/crop-catalog';
import { HARVEST_TARGET_UNITS, sanitiseHarvestTargets, type HarvestTarget, type PlanBed, type Planting, type HarvestPackUnit } from '@/lib/crop-plan';
import { suggestHarvestTargets, type AutoSuggestAnswers, type AutoSuggestResult } from '@/lib/crop-autosuggest';
import { assessHarvestTarget, HARVEST_TARGET_BASIS, targetMonthStamp } from '@/lib/harvest-targets';
import { numberLabel } from '@/lib/format-figures';

interface Props {
  siteId: string;
  targets: HarvestTarget[];
  beds: PlanBed[];
  plantings: Planting[];
  pattern: RainPattern;
  climate: Pick<AutoSuggestAnswers, 'siteMonthlyTempC' | 'siteMonthlyRainMm' | 'siteLatitude' | 'observedFrostMonths'>;
  onTargets: (targets: HarvestTarget[]) => void;
  onAccept: (result: AutoSuggestResult) => void;
}

const field = 'w-full rounded-lg border px-3 py-2 text-sm bg-[var(--bg-0)] text-[var(--text-primary)] border-[var(--border)]';
const secondary = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)]';
const primary = 'min-h-11 rounded-lg px-4 py-2 text-sm font-semibold bg-[#1F4D2B] text-[#F7F2E9] disabled:opacity-50';
const amount = (kg: number | null) => kg === null ? 'Not calculated' : `${numberLabel(kg, 1)} kg`;
const unitLabel = (unit: string) => unit === 'each' ? 'items' : unit;
const packLabel = (unit: string) => ({ each: 'item / head', bunches: 'bunch', bags: 'bag', crates: 'crate', trays: 'tray' })[unit as HarvestPackUnit];
const weeklyLabel = (target: HarvestTarget) => target.weeklyKg !== undefined
  ? `${amount(target.weeklyKg)}/week`
  : `${numberLabel(target.weeklyQuantity)} ${unitLabel(target.unit)}/week`;
const targetAmount = (kg: number | null, target: HarvestTarget) => kg === null ? 'Not calculated'
  : target.unit && target.kgPerUnit !== undefined
    ? `${numberLabel(kg / target.kgPerUnit, 1)} ${unitLabel(target.unit)} equivalent (${amount(kg)})`
    : amount(kg);
const monthName = (stamp: string) => `${MONTHS_SHORT[Number(stamp.slice(5)) - 1]} ${stamp.slice(0, 4)}`;

export default function HarvestTargetsPanel({ siteId, targets, beds, plantings, pattern, climate, onTargets, onAccept }: Props) {
  const today = new Date();
  const now = { year: today.getFullYear(), month: today.getMonth() + 1 };
  const current = now.year * 12 + now.month - 1;
  const [cropKey, setCropKey] = useState('');
  const [weeklyQuantity, setWeeklyQuantity] = useState('');
  const [unit, setUnit] = useState<typeof HARVEST_TARGET_UNITS[number]>('kg');
  const [kgPerUnit, setKgPerUnit] = useState('');
  const [marketablePercent, setMarketablePercent] = useState('');
  const [outlet, setOutlet] = useState('');
  const [startMonth, setStartMonth] = useState(targetMonthStamp(current));
  const [endMonth, setEndMonth] = useState(targetMonthStamp(current + 11));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [irrigated, setIrrigated] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [vines, setVines] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState<{ key: string; result: AutoSuggestResult } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const accepting = useRef(false);
  const ownTargets = targets.filter((t) => t.siteId === siteId);
  const answers: AutoSuggestAnswers = {
    goal: 'commercial', groups: [], cropKeys: ownTargets.map((t) => t.cropKey), rhythm: 'steady',
    rotateCrops: true, reliableIrrigation: irrigated, allowMixedCropsInBed: sharing,
    allowVinesInBeds: vines, ...climate,
  };
  const key = JSON.stringify([siteId, ownTargets, beds, plantings, pattern, answers, now]);
  const result = review?.key === key ? review.result : null;
  const assessments = ownTargets.map((target) => assessHarvestTarget(target, beds, plantings)!);

  function saveTarget(event: FormEvent) {
    event.preventDefault();
    const base = { id: editingId ?? crypto.randomUUID(), siteId, cropKey, startMonth, endMonth,
      ...(outlet.trim() ? { outlet: outlet.trim() } : {}),
      ...(marketablePercent.trim() ? { marketablePercent: Number(marketablePercent) } : {}),
    };
    const target: HarvestTarget = unit === 'kg' ? { ...base, weeklyKg: Number(weeklyQuantity) }
      : { ...base, weeklyQuantity: Number(weeklyQuantity), unit: unit as HarvestPackUnit,
        ...(kgPerUnit.trim() ? { kgPerUnit: Number(kgPerUnit) } : {}) };
    const saved = sanitiseHarvestTargets([target])[0];
    if (!saved) {
      setError('Choose a crop, positive quantity and 1–12 harvest months. Items need whole numbers. Enter a positive pack weight when known and a saleable share from 0–100%.');
      return;
    }
    onTargets([...targets.filter((t) => t.id !== saved.id), saved]);
    resetForm(); setAccepted(false);
  }

  function resetForm() {
    setEditingId(null); setWeeklyQuantity(''); setCropKey(''); setUnit('kg');
    setKgPerUnit(''); setMarketablePercent(''); setOutlet(''); setError('');
  }

  return <details className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-primary)]">
    <summary className="min-h-12 cursor-pointer px-4 py-3 font-display font-semibold">
      <Target size={17} aria-hidden className="inline mr-2 align-text-bottom" />
      Harvest targets{ownTargets.length > 0 ? ` · ${ownTargets.length}` : ''}{' '}
      <span className="ml-2 text-xs font-sans font-normal text-[var(--text-secondary)]">Plan from weekly demand</span>
    </summary>
    <div className="px-4 pb-4 space-y-4 font-sans">
      <p className="text-sm text-[var(--text-secondary)]">Plan the produce you want each week for a market, restaurant or box scheme. Review the growing space and dated sowings before adding them to your saved beds.</p>
      <form onSubmit={saveTarget} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-sm">Crop
          <select required value={cropKey} onChange={(e) => { setCropKey(e.target.value); setKgPerUnit(''); setMarketablePercent(''); }} className={field}>
            <option value="">Choose a crop</option>
            {CROPS.filter((c) => hasPlanningYield(c) || c.yieldKgPerM2 === null).map((crop) => <option key={crop.key} value={crop.key}>{crop.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Weekly quantity
          <input required type="number" min="0" step={unit === 'each' ? '1' : 'any'} inputMode="decimal" value={weeklyQuantity} onChange={(e) => setWeeklyQuantity(e.target.value)} className={field} />
        </label>
        <label className="text-sm">Sales unit
          <select value={unit} onChange={(e) => { setUnit(e.target.value as typeof unit); setKgPerUnit(''); }} className={field}>
            {HARVEST_TARGET_UNITS.map((u) => <option key={u} value={u}>{u === 'each' ? 'Items / heads' : u === 'trays' ? 'Trays of harvested produce' : u}</option>)}
          </select>
        </label>
        <label className="text-sm">For (optional)
          <input value={outlet} onChange={(e) => setOutlet(e.target.value)} maxLength={120} placeholder="Market, restaurant or box scheme" className={field} />
        </label>
        <label className="text-sm">First harvest month
          <input required type="month" min="2020-01" max="2099-12" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className={field} />
        </label>
        <label className="text-sm">Last harvest month (included)
          <input required type="month" min={startMonth || '2020-01'} max="2099-12" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className={field} />
        </label>
        {unit !== 'kg' && <label className="text-sm">Harvest kg per {packLabel(unit)} (your estimate)
          <input type="number" min="0" step="any" inputMode="decimal" value={kgPerUnit} onChange={(e) => setKgPerUnit(e.target.value)} placeholder="Leave blank until you know" className={field} />
        </label>}
        <label className="text-sm">Saleable share (%) (optional)
          <input type="number" min="0" max="100" step="any" inputMode="decimal" value={marketablePercent} onChange={(e) => setMarketablePercent(e.target.value)} placeholder="Your own estimate" className={field} />
        </label>
        <p className="sm:col-span-2 lg:col-span-4 text-xs text-[var(--text-secondary)]">Use your measured harvest weight for one produce pack. A target without its pack weight stays saved; growing space waits for that conversion. The saleable share is a percentage of the catalogue benchmark; leave it blank to apply no allowance. Trays here contain harvested produce; nursery starts need their own planning.</p>
        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2">
          <button type="submit" className={primary}>{editingId ? 'Save target changes' : 'Save harvest target'}</button>
          {editingId && <button type="button" className={secondary} onClick={resetForm}>Cancel edit</button>}
          <span className="text-xs text-[var(--text-secondary)]">Targets are saved with this site’s crop plan on this device.</span>
        </div>
        {error && <p role="alert" className="sm:col-span-2 lg:col-span-4 text-sm text-[var(--gold)]">{error}</p>}
      </form>

      {assessments.map((a) => <article key={a.target.id} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div><h3 className="font-display font-semibold">{cropByKey(a.target.cropKey)?.name} · {weeklyLabel(a.target)}</h3>
            {a.target.outlet && <p className="text-sm">{a.target.outlet}</p>}
            <p className="text-xs text-[var(--text-secondary)]">{monthName(a.target.startMonth)} – {monthName(a.target.endMonth)} · {a.days} days</p></div>
          <div className="flex gap-1 flex-shrink-0"><button type="button" className={secondary} onClick={() => {
            setEditingId(a.target.id); setCropKey(a.target.cropKey);
            setWeeklyQuantity(String(a.target.weeklyKg ?? a.target.weeklyQuantity)); setUnit(a.target.unit ?? 'kg');
            setKgPerUnit(a.target.kgPerUnit === undefined ? '' : String(a.target.kgPerUnit));
            setMarketablePercent(a.target.marketablePercent === undefined ? '' : String(a.target.marketablePercent)); setOutlet(a.target.outlet ?? '');
            setStartMonth(a.target.startMonth); setEndMonth(a.target.endMonth); setError('');
          }}>Edit</button><button type="button" className={secondary} aria-label={`Remove ${cropByKey(a.target.cropKey)?.name} target`} onClick={() => {
            onTargets(targets.filter((t) => t.id !== a.target.id));
            if (editingId === a.target.id) resetForm();
            setAccepted(false);
          }}><Trash2 size={16} aria-hidden /></button></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
          <p><span className="block text-xs text-[var(--text-secondary)]">Total demand</span>{targetAmount(a.demandKg, a.target)}</p>
          <p><span className="block text-xs text-[var(--text-secondary)]">Crop-cycle area needed</span>{a.cycleAreaM2 === null ? 'Not calculated' : `${numberLabel(a.cycleAreaM2, 1)} m²`}</p>
          <p><span className="block text-xs text-[var(--text-secondary)]">{a.target.marketablePercent === undefined ? 'Benchmark before allowance' : 'Capacity after your allowance'}</span>{a.missingReasons.includes('crop-evidence') ? 'Not calculated' : targetAmount(a.allocatedKg, a.target)}</p>
          <p><span className="block text-xs text-[var(--text-secondary)]">Unallocated volume</span>{targetAmount(a.shortageKg, a.target)}</p>
        </div>
        {a.surplusKg !== null && a.surplusKg > 0.001 && <p className="text-xs">{targetAmount(a.surplusKg, a.target)} above total demand because whole fields or standard bed shares are used.</p>}
        {a.target.unit && a.target.kgPerUnit !== undefined && <p className="text-xs">Your conversion: {String(a.target.kgPerUnit)} kg of harvest per {packLabel(a.target.unit)}. Pack equivalents are estimates, not packed stock.</p>}
        {a.target.marketablePercent !== undefined && <p className="text-xs">Your saleable share: {numberLabel(a.target.marketablePercent)}%. Benchmark before your allowance: {amount(a.grossCycleKg)}. This allowance sizes this target; production graphs keep the harvest benchmark.</p>}
        {a.missingReasons.includes('unit-weight') && <p className="text-xs text-[var(--gold)]">Enter your own harvest kg per sales unit before calculating growing space or suggesting sowings.</p>}
        {a.missingReasons.includes('zero-saleable-share') && <p className="text-xs text-[var(--gold)]">Your saleable share is 0%, so no saleable capacity can be planned.</p>}
        {a.missingReasons.includes('crop-evidence') && <p className="text-xs text-[var(--gold)]">Verified crop yield, timing or establishment evidence is missing.</p>}
        {a.gapMonths.length > 0 && <p className="text-xs text-[var(--gold)]">No linked picking window: {a.gapMonths.map(monthName).join(', ')}.</p>}
        {a.excludedRows > 0 && <p className="text-xs text-[var(--gold)]">{a.excludedRows} linked planting(s) excluded: check dates, crop, timing evidence, mapped area and overlaps.</p>}
        <p className="text-xs text-[var(--text-secondary)]">Area is summed across crop cycles; successive crops may reuse ground. Weekly supply remains unverified.</p>
      </article>)}

      {ownTargets.length > 0 && <>
        <fieldset className="flex flex-col gap-2 text-sm"><legend className="mb-2 font-semibold">Before suggesting sowings</legend>
          <label className="flex gap-2 items-start min-h-8"><input type="checkbox" checked={irrigated} onChange={(e) => setIrrigated(e.target.checked)} className="mt-1" />Reliable irrigation for every crop cycle</label>
          <label className="flex gap-2 items-start min-h-8"><input type="checkbox" checked={sharing} onChange={(e) => setSharing(e.target.checked)} className="mt-1" />Allow standard bed shares (whole open fields stay whole)</label>
          <label className="flex gap-2 items-start min-h-8"><input type="checkbox" checked={vines} onChange={(e) => setVines(e.target.checked)} className="mt-1" />Allow space-hungry crops in beds after checking their layout</label>
        </fieldset>
        <p className="text-xs text-[var(--text-secondary)]">Rotation is checked. Sowing searches the next 12 months using the existing South African calendar and available site climate. Earlier-ending targets are placed first. Saved crops are kept; only plantings linked to a target count towards it.</p>
        <button type="button" className={primary} onClick={() => { accepting.current = false; setAccepted(false); setReview({ key, result: suggestHarvestTargets(ownTargets, siteId, answers, pattern, beds, plantings, now) }); }}>Suggest target sowings</button>
      </>}

      {result && <section aria-label="Target sowing review" className="rounded-xl border border-[var(--border)] p-3 space-y-3">
        <h3 className="font-display font-semibold">Review {result.plantings.length} proposed sowing{result.plantings.length === 1 ? '' : 's'}</h3>
        {ownTargets.map((target) => {
          const a = assessHarvestTarget(target, beds, [...plantings, ...result.plantings])!;
          return <p key={target.id} className="text-sm"><strong>{cropByKey(target.cropKey)?.name} · {weeklyLabel(target)}:</strong> {a.demandKg === null ? 'Growing space awaits your pack weight. ' : `${targetAmount(a.allocatedKg, target)} linked cycle capacity after adding${target.marketablePercent === undefined ? ' (unadjusted benchmark)' : ' (after your saleable allowance)'}; ${targetAmount(a.shortageKg, target)} still unallocated. `}{a.surplusKg !== null && a.surplusKg > 0.001 ? `${targetAmount(a.surplusKg, target)} above total demand. ` : ''}{a.gapMonths.length ? `No picking window in ${a.gapMonths.map(monthName).join(', ')}.` : 'A picking window reaches each requested month; weekly quantities remain unverified.'}</p>;
        })}
        {result.plantings.length > 0 && <div className="max-h-64 overflow-auto"><table className="w-full text-left text-xs">
          <caption className="text-left mb-2">Proposed additions — saved crops stay in place</caption>
          <thead><tr><th className="py-2 pr-3">Growing area</th><th className="py-2 pr-3">Crop</th><th className="py-2 pr-3">Sow</th><th className="py-2">Share</th></tr></thead>
          <tbody>{result.plantings.map((p) => <tr key={p.id} className="border-t border-[var(--border)]"><td className="py-2 pr-3">{beds.find((b) => b.id === p.bedId)?.label}</td><td className="py-2 pr-3">{cropByKey(p.cropKey)?.name}</td><td className="py-2 pr-3 whitespace-nowrap">{monthName(p.once!)}</td><td className="py-2">{p.areaFraction ? `${numberLabel(p.areaFraction * 100, 1)}%` : 'Whole area'}</td></tr>)}</tbody>
        </table></div>}
        <ul className="text-xs space-y-2 text-[var(--text-secondary)]">{result.notes.map((note, i) => <li key={i}>{note.text}</li>)}</ul>
        {result.plantings.length > 0 && <button type="button" className={primary} onClick={() => {
          if (accepting.current) return;
          accepting.current = true; onAccept(result); setReview(null); setAccepted(true);
        }}>Add {result.plantings.length} dated sowing{result.plantings.length === 1 ? '' : 's'} to my plan</button>}
      </section>}
      {accepted && <p role="status" className="text-sm">Dated sowings added. Review their preparation, sowing and harvest tasks in the calendar below. They do not repeat next year.</p>}
      <p className="text-xs text-[var(--text-secondary)]">{HARVEST_TARGET_BASIS} Removing a target keeps its plantings.</p>
    </div>
  </details>;
}
