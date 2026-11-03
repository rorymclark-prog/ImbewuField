'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Sprout, Trash2 } from 'lucide-react';
import { CROPS, cropByKey } from '@/lib/crop-catalog';
import type { PlanBed, Planting } from '@/lib/crop-plan';
import { buildNurseryForecast } from '@/lib/crop-export-schedule';
import { sanitiseNurserySettings, type NurserySettings, type NurseryProfile, type NurseryContainer, type NurserySpace } from '@/lib/nursery-settings';
import { numberLabel } from '@/lib/format-figures';
import { buildNurseryCsv } from '@/lib/nursery-export';
import { deliverFile } from '@/lib/file-delivery';
import { isSampleMode } from '@/lib/sample-mode';
import NurseryForecastSummary from './NurseryForecastSummary';

export interface NurseryPlanPanelProps {
  siteId: string;
  siteName?: string;
  settings?: NurserySettings;
  plantings: Planting[];
  beds: PlanBed[];
  now: { year: number; month: number };
  showBuyingCalendar?: boolean;
  /** Equipment remains useful before this site's catalogue planning basis is supported. */
  allowCatalogueForecast?: boolean;
  onSettings: (settings: NurserySettings) => boolean | void;
}

const field = 'mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--text-primary)]';
const secondary = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)]';
const primary = 'min-h-11 rounded-lg bg-[#1F4D2B] px-4 py-2 text-sm font-semibold text-[#F7F2E9]';
const formGrid = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';
const hint = 'text-xs text-[var(--text-secondary)]';
const emptySpace = { id: '', name: '', usableM2: '' };
const emptyContainer = { id: '', name: '', cells: '', widthCm: '', lengthCm: '', owned: '' };
const emptyProfile = { id: '', cropKey: '', containerId: '', spaceId: '', model: '' as NurseryProfile['model'] | '', germinationPercent: '', nurserySurvivalPercent: '', usableStartsPerTray: '', seedsPerTray: '', fieldSurvivalPercent: '', nurseryWeeks: '' };
const ownValue = (value: number | undefined) => value === undefined ? '' : String(value);
const optionalNumber = (value: string) => value.trim() === '' ? undefined : Number(value);
const showPercent = (value: number | undefined) => value === undefined ? 'unknown' : `${numberLabel(value, 1)}%`;

/** Remount forms on site changes so an unfinished edit cannot move to another site. */
export default function NurseryPlanPanel(props: NurseryPlanPanelProps) {
  return <NurseryPlanEditor key={props.siteId} {...props} />;
}

function NurseryPlanEditor({ siteId, siteName, settings, plantings, beds, now, showBuyingCalendar = false, allowCatalogueForecast = true, onSettings }: NurseryPlanPanelProps) {
  const saved = useMemo(() => sanitiseNurserySettings(settings), [settings]);
  const spaces = saved.spaces.filter((s) => s.siteId === siteId);
  const containers = saved.containers.filter((c) => c.siteId === siteId);
  const profiles = saved.profiles.filter((p) => p.siteId === siteId);
  const forecast = useMemo(() => allowCatalogueForecast
    ? buildNurseryForecast(plantings, beds, siteId, saved, now)
    : null, [allowCatalogueForecast, plantings, beds, siteId, saved, now]);
  const [space, setSpace] = useState(emptySpace);
  const [container, setContainer] = useState(emptyContainer);
  const [profile, setProfile] = useState(emptyProfile);
  const [error, setError] = useState<{ section: 'space' | 'container' | 'profile'; message: string } | null>(null);
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [sample, setSample] = useState(false);
  useEffect(() => { setSample(isSampleMode()); }, [siteId]);

  async function exportCsv() {
    if (exporting || !allowCatalogueForecast || !forecast) return;
    setExporting(true); setExportStatus('');
    try {
      const demo = isSampleMode();
      const csv = buildNurseryCsv(forecast, beds, { siteName, sample: demo });
      const delivery = await deliverFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), demo ? 'ImbewuField-demo-nursery.csv' : 'ImbewuField-nursery.csv', 'ImbewuField nursery planning forecast');
      setExportStatus(delivery === 'cancelled' ? 'Sharing cancelled; no file was sent.'
        : delivery === 'shared' ? `${demo ? 'Demo nursery' : 'Nursery'} CSV shared. It contains planning estimates, not live stock.`
          : `${demo ? 'Demo nursery' : 'Nursery'} CSV downloaded. It contains planning estimates, not live stock.`);
    } catch {
      setExportStatus('Could not export the nursery CSV. Please try again.');
    } finally { setExporting(false); }
  }

  function publish(next: NurserySettings, message: string) {
    setStatus('');
    try {
      const receipt = onSettings(sanitiseNurserySettings(next));
      if (receipt === false) { setStatus('Could not save on this device. Your open entries are retained; reopen the current plan before trying again.'); return false; }
      setError(null); setStatus(receipt === true ? `${message} Saved on this device.` : 'Changes sent to the plan. Device save is not confirmed.');
      return true;
    } catch { setStatus('Could not save on this device. Your saved settings remain unchanged.'); return false; }
  }

  function saveSpace(event: FormEvent) {
    event.preventDefault();
    const candidate: NurserySpace = { id: space.id || crypto.randomUUID(), siteId, name: space.name, usableM2: Number(space.usableM2) };
    const valid = space.usableM2.trim() !== '' && sanitiseNurserySettings({ version: 1, spaces: [candidate] }).spaces[0];
    if (!valid) { setError({ section: 'space', message: 'Enter a name and a net usable growing area of zero or more square metres.' }); return; }
    if (!publish({ ...saved, spaces: [...saved.spaces.filter((s) => s.siteId !== siteId || s.id !== valid.id), valid] }, 'Nursery space saved for this site.')) return;
    setSpace(emptySpace);
  }

  function saveContainer(event: FormEvent) {
    event.preventDefault();
    const candidate: NurseryContainer = { id: container.id || crypto.randomUUID(), siteId, name: container.name, cells: optionalNumber(container.cells),
      widthCm: optionalNumber(container.widthCm), lengthCm: optionalNumber(container.lengthCm), owned: optionalNumber(container.owned) };
    const valid = sanitiseNurserySettings({ version: 1, containers: [candidate] }).containers[0];
    if (!valid) { setError({ section: 'container', message: 'Enter a name. Known cell counts and owned stock must be whole numbers of zero or more; dimensions must be positive. Leave unknown values blank.' }); return; }
    if (!publish({ ...saved, containers: [...saved.containers.filter((c) => c.siteId !== siteId || c.id !== valid.id), valid] }, 'Nursery container saved for this site.')) return;
    setContainer(emptyContainer);
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (profile.model !== 'seed-cell' && profile.model !== 'measured-tray') {
      setError({ section: 'profile', message: 'Choose your propagation model. The app cannot infer one seed per cell or a measured tray output.' }); return;
    }
    const previous = profiles.find((p) => p.cropKey === profile.cropKey);
    const candidate: NurseryProfile = { id: profile.id || previous?.id || crypto.randomUUID(), siteId, cropKey: profile.cropKey, model: profile.model,
      ...(profile.containerId ? { containerId: profile.containerId } : {}), ...(profile.spaceId ? { spaceId: profile.spaceId } : {}),
      fieldSurvivalPercent: optionalNumber(profile.fieldSurvivalPercent), nurseryWeeks: optionalNumber(profile.nurseryWeeks),
      ...(profile.model === 'seed-cell' ? { germinationPercent: optionalNumber(profile.germinationPercent), nurserySurvivalPercent: optionalNumber(profile.nurserySurvivalPercent) }
        : { usableStartsPerTray: optionalNumber(profile.usableStartsPerTray), seedsPerTray: optionalNumber(profile.seedsPerTray) }) };
    const valid = sanitiseNurserySettings({ version: 1, profiles: [candidate] }).profiles[0];
    if (!valid) { setError({ section: 'profile', message: 'Choose an existing crop identity and propagation model. Use percentages from 0–100, usable starts and whole seeds of zero or more, and nursery weeks above zero up to 52. Leave unknown estimates blank.' }); return; }
    if (!publish({ ...saved, profiles: [...saved.profiles.filter((p) => p.siteId !== siteId || (p.id !== valid.id && p.cropKey !== valid.cropKey)), valid] }, 'Crop nursery recipe saved for this site.')) return;
    setProfile(emptyProfile);
  }

  function editProfile(p: NurseryProfile) {
    setProfile({ id: p.id, cropKey: p.cropKey, containerId: p.containerId ?? '', spaceId: p.spaceId ?? '', model: p.model,
      germinationPercent: ownValue(p.germinationPercent), nurserySurvivalPercent: ownValue(p.nurserySurvivalPercent),
      usableStartsPerTray: ownValue(p.usableStartsPerTray), seedsPerTray: ownValue(p.seedsPerTray),
      fieldSurvivalPercent: ownValue(p.fieldSurvivalPercent), nurseryWeeks: ownValue(p.nurseryWeeks) });
    setError(null);
  }

  return <details className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-primary)]">
    <summary className="min-h-12 cursor-pointer px-4 py-3 font-display font-semibold">
      <Sprout size={17} aria-hidden className="mr-2 inline align-text-bottom" />Nursery planner
      <span className="ml-2 font-sans text-xs font-normal text-[var(--text-secondary)]">This site’s trays and growing surface</span>
    </summary>
    <div className="space-y-4 px-4 pb-4 font-sans">
      <p className="text-sm text-[var(--text-secondary)]">{allowCatalogueForecast
        ? 'Plan nursery demand from accepted crop sowings. Add your own equipment and crop estimates below. Blank values stay unknown; the app does not choose germination rates, tray sizes or nursery losses for you.'
        : 'Keep your own nursery equipment and crop estimates here. Demand forecasts are unavailable until this site has a supported local planning basis. Saving these inputs does not approve local crop timing, spacing or suitability.'}</p>
      {saved.sourceIssues?.length ? <p role="alert" className="text-sm">Some saved nursery settings have ambiguous or invalid identities. Resource headroom remains unknown until those records are reviewed.</p> : null}
      {forecast && <>
      <div id="nursery-seed-needs" className="scroll-mt-24"><NurseryForecastSummary forecast={forecast} beds={beds} /></div>
      <div className="space-y-2">
        <button type="button" disabled={exporting} className={`${secondary} disabled:opacity-50`} onClick={exportCsv}>{exporting ? 'Preparing nursery CSV…' : 'Download nursery CSV'}</button>
        {sample && <p className={hint}>Sample farm: this export is marked DEMO and contains example planning data.</p>}
        {exportStatus && <p role="status" className="text-sm">{exportStatus}</p>}
        <nav aria-label="Nursery planning next steps" className="flex flex-wrap gap-2">
          <a href={showBuyingCalendar ? '#nursery-purchasing' : '#nursery-seed-needs'} className={`${secondary} inline-flex items-center`}>Review seeds and equipment to source</a>
          <a href="/cropplan" className={`${secondary} inline-flex items-center`}>Open task planner</a>
        </nav>
        <p className={hint}>Nursery checks leave your field-task calendar unchanged. Review the crop plan before changing field dates.</p>
      </div>
      </>}

      <details className="rounded-xl border border-[var(--border)] p-3">
        <summary className="min-h-11 cursor-pointer font-semibold">1. Net nursery growing surface · {spaces.length}</summary>
        <div className="space-y-3 pt-2">
          <p className={hint}>For this site only. Enter the net surface allocated to these crops after paths, work areas and other uses. Zero means no surface is allocated.</p>
          {spaces.map((s) => <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-2">
            <p className="text-sm"><strong>{s.name}</strong> · {numberLabel(s.usableM2, 2)} m² net allocated</p>
            <div className="flex gap-2"><button type="button" className={secondary} onClick={() => { setSpace({ id: s.id, name: s.name, usableM2: String(s.usableM2) }); setError(null); }}>Edit</button>
              <button type="button" className={secondary} aria-label={`Remove ${s.name} nursery space`} onClick={() => {
                if (!publish({ ...saved, spaces: saved.spaces.filter((row) => row.siteId !== siteId || row.id !== s.id) }, 'Space removed. Dependent crop recipes remain saved and their space allocation is unknown.')) return;
                if (space.id === s.id) setSpace(emptySpace);
              }}><Trash2 size={16} aria-hidden /></button></div>
          </div>)}
          <form onSubmit={saveSpace} className={formGrid}>
            <label className="text-sm">Space name<input required maxLength={120} value={space.name} onChange={(e) => setSpace({ ...space, name: e.target.value })} className={field} /></label>
            <label className="text-sm">Net usable surface (m²)<input required type="number" min="0" step="any" inputMode="decimal" value={space.usableM2} onChange={(e) => setSpace({ ...space, usableM2: e.target.value })} className={field} /></label>
            <div className="flex flex-wrap items-end gap-2"><button type="submit" className={primary}>{space.id ? 'Save space changes' : 'Add nursery space'}</button>{space.id && <button type="button" className={secondary} onClick={() => { setSpace(emptySpace); setError(null); }}>Cancel edit</button>}</div>
            {error?.section === 'space' && <p role="alert" className="text-sm text-[var(--gold)] sm:col-span-2 lg:col-span-3">{error.message}</p>}
          </form>
        </div>
      </details>

      <details className="rounded-xl border border-[var(--border)] p-3">
        <summary className="min-h-11 cursor-pointer font-semibold">2. Your trays and containers · {containers.length}</summary>
        <div className="space-y-3 pt-2">
          <p className={hint}>Give each tray type its own name. Outer width and length determine its bench footprint. Owned stock is the number allocated to this plan, not a count of trays currently empty.</p>
          {containers.map((c) => <div key={c.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--border)] p-2">
            <div className="text-sm"><strong>{c.name}</strong> · {c.cells === undefined ? 'cell count unknown' : `${numberLabel(c.cells)} cells`}
              <p className={hint}>Outer size: {c.widthCm === undefined ? 'width unknown' : `${numberLabel(c.widthCm, 1)} cm wide`} × {c.lengthCm === undefined ? 'length unknown' : `${numberLabel(c.lengthCm, 1)} cm long`}. Owned: {c.owned === undefined ? 'unknown' : numberLabel(c.owned)}.</p>
            </div>
            <div className="flex gap-2"><button type="button" className={secondary} onClick={() => { setContainer({ id: c.id, name: c.name, cells: ownValue(c.cells), widthCm: ownValue(c.widthCm), lengthCm: ownValue(c.lengthCm), owned: ownValue(c.owned) }); setError(null); }}>Edit</button>
              <button type="button" className={secondary} aria-label={`Remove ${c.name} nursery container`} onClick={() => {
                if (!publish({ ...saved, containers: saved.containers.filter((row) => row.siteId !== siteId || row.id !== c.id) }, 'Container removed. Dependent crop recipes remain saved and container sizing is now unknown.')) return;
                if (container.id === c.id) setContainer(emptyContainer);
              }}><Trash2 size={16} aria-hidden /></button></div>
          </div>)}
          <form onSubmit={saveContainer} className={formGrid}>
            <label className="text-sm">Container name<input required maxLength={120} value={container.name} onChange={(e) => setContainer({ ...container, name: e.target.value })} className={field} /></label>
            <label className="text-sm">Cells per container (optional)<input type="number" min="0" step="1" inputMode="numeric" value={container.cells} onChange={(e) => setContainer({ ...container, cells: e.target.value })} className={field} /></label>
            <label className="text-sm">Owned containers (optional)<input type="number" min="0" step="1" inputMode="numeric" value={container.owned} placeholder="Unknown" onChange={(e) => setContainer({ ...container, owned: e.target.value })} className={field} /></label>
            <label className="text-sm">Outer width (cm, optional)<input type="number" min="0" step="any" inputMode="decimal" value={container.widthCm} placeholder="Unknown" onChange={(e) => setContainer({ ...container, widthCm: e.target.value })} className={field} /></label>
            <label className="text-sm">Outer length (cm, optional)<input type="number" min="0" step="any" inputMode="decimal" value={container.lengthCm} placeholder="Unknown" onChange={(e) => setContainer({ ...container, lengthCm: e.target.value })} className={field} /></label>
            <div className="flex flex-wrap items-end gap-2"><button type="submit" className={primary}>{container.id ? 'Save container changes' : 'Add container type'}</button>{container.id && <button type="button" className={secondary} onClick={() => { setContainer(emptyContainer); setError(null); }}>Cancel edit</button>}</div>
            {error?.section === 'container' && <p role="alert" className="text-sm text-[var(--gold)] sm:col-span-2 lg:col-span-3">{error.message}</p>}
          </form>
        </div>
      </details>

      <details className="rounded-xl border border-[var(--border)] p-3">
        <summary className="min-h-11 cursor-pointer font-semibold">3. Your crop nursery recipes · {profiles.length}</summary>
        <div className="space-y-3 pt-2">
          <p className={hint}>{allowCatalogueForecast
            ? 'Keep one recipe per crop identity for this site. Your own method and losses need review; a crop name does not determine propagation. The catalogue forecast uses only its supported transplant crops and timing. Own dated cycles keep their reviewed field dates.'
            : 'Keep one grower-entered recipe per crop identity for this site. Missing values stay unknown. Use the own-cycle review to calculate demand from your dated plan; these equipment entries do not set field dates.'}</p>
          {profiles.map((p) => <div key={p.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--border)] p-2">
            <div className="min-w-0 flex-1 text-sm"><strong>{cropByKey(p.cropKey)?.name ?? p.cropKey}</strong> · {p.model === 'seed-cell' ? 'One seed / one transplant per cell' : 'Measured usable starts per tray'}
              <p className={hint}>{p.containerId ? containers.find((c) => c.id === p.containerId)?.name ?? 'Container removed or unavailable' : 'Container not selected'} · {p.spaceId ? spaces.find((s) => s.id === p.spaceId)?.name ?? 'Space removed or unavailable' : 'Space not selected'}</p>
              <p className={hint}>{p.model === 'seed-cell' ? `Your germination: ${showPercent(p.germinationPercent)}; nursery survival: ${showPercent(p.nurserySurvivalPercent)}.` : `Your usable starts per tray: ${p.usableStartsPerTray === undefined ? 'unknown' : numberLabel(p.usableStartsPerTray, 1)} (nursery losses included); seeds per tray: ${p.seedsPerTray === undefined ? 'unknown' : numberLabel(p.seedsPerTray)}.`} Field survival: {p.fieldSurvivalPercent === undefined ? 'unknown' : showPercent(p.fieldSurvivalPercent)}. Own duration: {p.nurseryWeeks === undefined ? 'not entered' : `${numberLabel(p.nurseryWeeks, 1)} weeks`}.</p>
              {(p.germinationPercent === 0 || p.nurserySurvivalPercent === 0 || p.fieldSurvivalPercent === 0) && <p className="text-xs text-[var(--gold)]">A saved success rate is 0%; this recipe cannot size starts or trays.</p>}
            </div>
            <div className="flex gap-2"><button type="button" className={secondary} onClick={() => editProfile(p)}>Edit</button><button type="button" className={secondary} aria-label={`Remove ${cropByKey(p.cropKey)?.name ?? p.cropKey} nursery recipe`} onClick={() => {
              if (!publish({ ...saved, profiles: saved.profiles.filter((row) => row.siteId !== siteId || row.id !== p.id) }, 'Crop nursery recipe removed for this site. Its crop sowings remain in the field plan.')) return;
              if (profile.id === p.id) setProfile(emptyProfile);
            }}><Trash2 size={16} aria-hidden /></button></div>
          </div>)}
          <form onSubmit={saveProfile} className={formGrid}>
            <label className="text-sm">Crop identity for nursery recipe<select required value={profile.cropKey} onChange={(e) => { const existing = profiles.find((p) => p.cropKey === e.target.value); if (existing) editProfile(existing); else { setProfile({ ...emptyProfile, cropKey: e.target.value }); setError(null); } }} className={field}>
              <option value="">Choose a crop</option>{CROPS.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select></label>
            <label className="text-sm">Nursery model<select value={profile.model} onChange={(e) => setProfile({ ...profile, model: e.target.value as NurseryProfile['model'] })} className={field}>
              <option value="">Choose your propagation model</option><option value="seed-cell">One seed / one transplant per cell</option><option value="measured-tray">Measured usable starts per tray</option>
            </select></label>
            <label className="text-sm">Container type<select value={profile.containerId} onChange={(e) => setProfile({ ...profile, containerId: e.target.value })} className={field}>
              <option value="">Unknown / choose later</option>{profile.containerId && !containers.some((c) => c.id === profile.containerId) && <option value={profile.containerId}>Removed or unavailable container</option>}{containers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
            <label className="text-sm">Allocated nursery space<select value={profile.spaceId} onChange={(e) => setProfile({ ...profile, spaceId: e.target.value })} className={field}>
              <option value="">Unknown / choose later</option>{profile.spaceId && !spaces.some((s) => s.id === profile.spaceId) && <option value={profile.spaceId}>Removed or unavailable space</option>}{spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            {profile.model === 'seed-cell' ? <>
              <label className="text-sm">Your germination (%)<input type="number" min="0" max="100" step="any" inputMode="decimal" value={profile.germinationPercent} placeholder="Unknown" onChange={(e) => setProfile({ ...profile, germinationPercent: e.target.value })} className={field} /></label>
              <label className="text-sm">Your nursery survival (%)<input type="number" min="0" max="100" step="any" inputMode="decimal" value={profile.nurserySurvivalPercent} placeholder="Unknown" onChange={(e) => setProfile({ ...profile, nurserySurvivalPercent: e.target.value })} className={field} /></label>
              <p className={`${hint} sm:col-span-2 lg:col-span-3`}>Nursery survival is the share of germinated seedlings that remain usable at transplanting. This model assumes one seed is sown per cell and one transplant is taken from each successful cell.</p>
            </> : profile.model === 'measured-tray' ? <>
              <label className="text-sm">Your usable starts per tray<input type="number" min="0" step="any" inputMode="decimal" value={profile.usableStartsPerTray} placeholder="Unknown" onChange={(e) => setProfile({ ...profile, usableStartsPerTray: e.target.value })} className={field} /></label>
              <label className="text-sm">Your seeds sown per tray (optional)<input type="number" min="0" step="1" inputMode="numeric" value={profile.seedsPerTray} placeholder="Unknown" onChange={(e) => setProfile({ ...profile, seedsPerTray: e.target.value })} className={field} /></label>
              <p className={`${hint} sm:col-span-2 lg:col-span-3`}>Use your observed usable seedling output for a tray, including nursery losses. Suitable for your multi-sown or pricked-out method; no extra germination or nursery-loss allowance is applied.</p>
            </> : null}
            <label className="text-sm">Your field survival (%, optional)<input type="number" min="0" max="100" step="any" inputMode="decimal" value={profile.fieldSurvivalPercent} placeholder="Unknown" onChange={(e) => setProfile({ ...profile, fieldSurvivalPercent: e.target.value })} className={field} /></label>
            <label className="text-sm">Your nursery duration (weeks, optional)<input type="number" min="0" max="52" step="any" inputMode="decimal" value={profile.nurseryWeeks} placeholder={allowCatalogueForecast ? 'Use source timing envelope' : 'Unknown'} onChange={(e) => setProfile({ ...profile, nurseryWeeks: e.target.value })} className={field} /></label>
            <p className={`${hint} sm:col-span-2 lg:col-span-3`}>Field survival is separate from nursery losses. Own-cycle requirements stay unknown until you enter it. The separate catalogue forecast applies no extra field allowance when blank. A saved 0% remains an observation, not a finite positive raising requirement.</p>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3"><button type="submit" className={primary}>{profile.id ? 'Save recipe changes' : 'Save crop recipe'}</button>{profile.cropKey && <button type="button" className={secondary} onClick={() => { setProfile(emptyProfile); setError(null); }}>Clear form</button>}</div>
            {error?.section === 'profile' && <p role="alert" className="text-sm text-[var(--gold)] sm:col-span-2 lg:col-span-3">{error.message}</p>}
          </form>
        </div>
      </details>
      {status && <p role="status" className="text-sm">{status}</p>}
      <p className={hint}>{allowCatalogueForecast
        ? 'Settings belong to this site’s crop plan on this device. Removing equipment leaves its dependent recipes visibly incomplete. This is a planning forecast, not observed live nursery stock. Net surface does not guarantee rectangular tray packing or include up-pot stage scheduling.'
        : 'Settings belong to this site’s crop plan on this device. Removing equipment leaves dependent recipes incomplete. Equipment entries are your inputs, not live stock counts. No nursery demand, field timing, purchasing forecast or tray-packing result is supplied here.'}</p>
    </div>
  </details>;
}
