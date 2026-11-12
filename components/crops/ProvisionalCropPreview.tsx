'use client';

import { useEffect, useRef, useState } from 'react';
import { CROPS, MONTHS_SHORT } from '@/lib/crop-catalog';
import { growerPlanningScopeKey, type GrowerPlanningScope } from '@/lib/international/grower-planning';
import { formatDerivedMassKilograms } from '@/lib/mass-units';
import { downloadFile } from '@/lib/crop-export-deliver';
import { buildProvisionalCropPreviewHtml, provisionalNumericFields as numericFields, provisionalLabels as labels, provisionalInputText as inputText, provisionalScopeText as scopeText } from '@/lib/international/provisional-crop-export';
import { growerWorkflowResourceSiteId, type GrowerWorkflowSource } from '@/lib/international/grower-workflow-source';
import { resolveProvisionalCropPlan, type ProvisionalFieldCandidate, type ProvisionalDraftRequest } from '@/lib/international/provisional-crop-planning';
import { sourcePublicationText } from '@/lib/international/countries/readiness';
import { worldvegKenyaCabbageCandidates, worldvegKenyaCabbageReference, worldvegKenyaCabbageRegionMatches } from '@/lib/international/providers/worldveg-kenya-cabbage';

export interface ProvisionalCropPreviewProps {
  ownerKey: string;
  sample?: boolean;
  scope: GrowerPlanningScope | null;
  source: GrowerWorkflowSource | null;
  countryCode: string | null;
  agriculturalRegionReference: string | null;
  contextRevision: string | number;
  actorIsCurrent: () => boolean;
  checking: boolean;
  onRefresh: () => Promise<unknown>;
  onCheckSource: (expected: GrowerWorkflowSource) => Promise<{ isCurrent: () => boolean } | null>;
  /** Only owner-reviewed adapters supply candidates. Research metadata alone is
   * not an adapter; absent evidence must leave defaults unknown. */
  evidence?: { revision: string; candidates: readonly ProvisionalFieldCandidate[]; knownPlantingRestriction?: boolean };
}

type NumericField = typeof numericFields[number][0];
type Draft = {
  crop: string; bed: string; date: string; method: '' | 'direct' | 'transplant';
  water: '' | 'rain-fed' | 'irrigated'; variety: string;
  values: Partial<Record<NumericField, string>>; months: number[] | null; regionalConsent: string | null;
};
type Resolution = ReturnType<typeof resolveProvisionalCropPlan>;
const control = 'min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm';
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';
function binding(props: ProvisionalCropPreviewProps): string | null {
  try {
    // A changed source revision can invalidate evidence even when area is identical.
    // Include the actual capsule too: a reused revision label must not retain an old preview.
    return JSON.stringify([props.ownerKey, props.sample === true, growerPlanningScopeKey(props.scope), props.source,
      props.countryCode, props.agriculturalRegionReference, props.contextRevision, props.checking, props.evidence ?? null]);
  } catch { return null; }
}

export default function ProvisionalCropPreview(props: ProvisionalCropPreviewProps) {
  const scopeKey = growerPlanningScopeKey(props.scope);
  return <details className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-primary)]">
    <summary className="min-h-11 cursor-pointer px-4 py-3 font-display font-semibold">Provisional crop preview</summary>
    {scopeKey && props.actorIsCurrent() ? <Editor key={`${props.ownerKey}:${scopeKey}`} {...props} />
      : <p className="px-4 pb-4" role="note">Choose a current account and site or workspace before previewing.</p>}
  </details>;
}

function Editor(props: ProvisionalCropPreviewProps) {
  const current = useRef(props); current.current = props;
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [draft, setDraft] = useState<Draft>({ crop: '', bed: '', date: '', method: '', water: '', variety: '', values: {}, months: null, regionalConsent: null });
  const draftLive = useRef(draft); draftLive.current = draft;
  const [preview, setPreview] = useState<{ binding: string; draft: Draft; result: Resolution; request: ProvisionalDraftRequest; bedLabel: string; receipt: { isCurrent: () => boolean } } | null>(null);
  const previewLive = useRef(preview); previewLive.current = preview;
  const [error, setError] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const pending = useRef<object | null>(null);
  const [checkingSource, setCheckingSource] = useState(false);
  const environment = binding(props);
  const regionalReference = worldvegKenyaCabbageReference(props.countryCode, draft.crop);
  const regionalMatch = worldvegKenyaCabbageRegionMatches(props.agriculturalRegionReference);
  const regionalConsentKey = environment === null ? null : JSON.stringify([environment, draft.crop]);
  const useRegionalMethod = regionalConsentKey !== null && draft.regionalConsent === regionalConsentKey && regionalMatch;
  const source = props.source;
  const sourceReady = !!source && growerWorkflowResourceSiteId(source) !== null
    && growerPlanningScopeKey(source.scope) === growerPlanningScopeKey(props.scope) && !props.checking;
  const result = props.actorIsCurrent() && sourceReady && environment !== null && preview?.binding === environment
    && preview.draft === draft && preview.request.asOf === new Date().toISOString().slice(0, 10)
    && preview.receipt.isCurrent() ? preview.result : null;
  function isCurrent() {
    return active.current && current.current.actorIsCurrent() && environment !== null
      && binding(current.current) === environment && draftLive.current === draft;
  }
  function edit(next: Partial<Draft>) {
    if (!isCurrent()) return;
    const value = { ...draft, ...next }; draftLive.current = value; setDraft(value); setPreview(null); setError(''); setExportMessage('');
  }
  async function refresh() {
    if (!isCurrent()) return;
    setPreview(null); setError(''); setExportMessage('');
    try { await current.current.onRefresh(); }
    catch { if (isCurrent()) setError('Could not check saved measurements. Try again.'); }
  }
  async function calculate() {
    if (!isCurrent() || pending.current) return;
    // The day belongs to this calculation, not the render-time edit guard. A form
    // left open overnight must still accept edits and start a fresh calculation.
    const calculationDay = new Date().toISOString().slice(0, 10);
    setPreview(null); setError(''); setExportMessage('');
    if (!sourceReady || !source || !props.scope) { setError('Check saved measurements before previewing.'); return; }
    const beds = source.beds.filter(row => row.id === draft.bed);
    const measures = source.measuredAreas.filter(row => row.bedId === draft.bed);
    if (beds.length !== 1 || measures.length !== 1 || beds[0].areaM2 !== measures[0].areaM2) {
      setError('Choose one bed with a matching saved measurement.'); return;
    }
    const token = {}; pending.current = token; setCheckingSource(true);
    try {
      const receipt = await current.current.onCheckSource(source);
      if (!isCurrent()) return;
      if (calculationDay !== new Date().toISOString().slice(0, 10)) { setError('The UTC date changed. Calculate again with today’s evidence.'); return; }
      if (!receipt?.isCurrent()) { setError('Saved measurements changed or could not be checked. Check them again before previewing.'); return; }
      const recordedAt = new Date().toISOString();
      const supplied = (value: unknown, unit: string) => ({ state: 'provided', value, unit,
        provenance: { kind: 'grower-estimate', recordedAt } });
      const overrides: Record<string, unknown> = {};
      for (const [key, , unit] of numericFields) if (Object.hasOwn(draft.values, key)) {
        const value = draft.values[key]!;
        // Clearing an override explicitly withholds the value; only Reset uses the default again.
        overrides[key] = value.trim() === '' ? { state: 'missing', reason: 'not-entered' } : supplied(Number(value), unit);
      }
      if (draft.method) overrides.establishment = supplied(draft.method, 'method');
      if (draft.months !== null) overrides.allowedEntryMonths = supplied(draft.months, 'utc-months');
      const context = { scope: props.scope, countryCode: props.countryCode, agriculturalRegionReference: props.agriculturalRegionReference,
        establishment: draft.method || null, waterRegime: draft.water || null, varietyReference: draft.variety.trim() || null };
      const request: ProvisionalDraftRequest = structuredClone({ profileId: 'provisional-preview', cropKey: draft.crop,
        context, recordedAt, asOf: recordedAt.slice(0, 10),
        candidates: [...(props.evidence?.candidates ?? []), ...worldvegKenyaCabbageCandidates(context, draft.crop, recordedAt, useRegionalMethod)], overrides,
        knownPlantingRestriction: props.evidence?.knownPlantingRestriction,
        measuredAreaM2: { state: 'provided', value: measures[0].areaM2, unit: 'm2',
          provenance: { kind: 'grower-record', recordedAt, reference: `Saved measured bed: ${draft.bed}` },
          ...(measures[0].arithmeticBasis ? { arithmeticBasis: measures[0].arithmeticBasis } : {}) },
        fieldEntryDate: draft.date ? supplied(draft.date, 'utc-date') : { state: 'missing', reason: 'not-entered' } });
      const next = resolveProvisionalCropPlan(request);
      if (isCurrent() && receipt.isCurrent()) setPreview({ binding: environment!, draft, result: next, request, bedLabel: beds[0].label, receipt });
    } catch { if (isCurrent()) setError('Could not check this preview. Check the saved measurements and evidence again.'); }
    finally { if (pending.current === token) { pending.current = null; if (active.current) setCheckingSource(false); } }
  }
  async function exportPreview() {
    if (!isCurrent() || !result || result.status !== 'resolved' || !preview || !source || pending.current) return;
    const selected = preview;
    if (selected.request.asOf !== new Date().toISOString().slice(0, 10) || !selected.receipt.isCurrent()) {
      setPreview(null); setError('The preview is no longer current. Recalculate before downloading.'); return;
    }
    const token = {}; pending.current = token; setCheckingSource(true); setExportMessage('');
    let receipt: { isCurrent: () => boolean } | null = null;
    const bound = () => isCurrent() && previewLive.current === selected
      && selected.request.asOf === new Date().toISOString().slice(0, 10) && selected.receipt.isCurrent();
    const handoff = () => bound() && receipt?.isCurrent() === true;
    const check = async () => {
      if (!bound()) return false;
      receipt = await current.current.onCheckSource(source);
      return handoff();
    };
    try {
      if (!await check()) { if (bound()) { setPreview(null); setError('Saved measurements changed. Recalculate before downloading.'); } return; }
      const document = buildProvisionalCropPreviewHtml(selected.request, {
        bedLabel: selected.bedLabel, sample: props.sample === true,
      });
      if (!document || document.fingerprint !== selected.result.fingerprint || !handoff()) return;
      const delivered = await downloadFile(new Blob([document.html], { type: 'text/html;charset=utf-8' }),
        `ImbewuField${props.sample ? '-demo' : ''}-provisional-preview.html`, check, handoff);
      if (bound()) {
        if (delivered === 'downloaded') setExportMessage('Printable preview download requested. Open the HTML file in a browser to print it. No plan was saved or adopted.');
        else { setPreview(null); setError('Preview changed before download. Recalculate before downloading.'); }
      }
    } catch { if (bound()) { setPreview(null); setError('Could not confirm a current preview. Nothing was downloaded.'); } }
    finally { if (pending.current === token) { pending.current = null; if (active.current) setCheckingSource(false); } }
  }
  return <section lang="en" aria-label="Provisional crop preview" className="space-y-4 px-4 pb-4 font-sans">
    <p className="text-sm">Preview supported counts and dates using applicable evidence and your edits. Missing values stay unknown. Nothing here saves a profile or adds a crop.</p>
    <p role="note" className="text-sm">Provisional estimates: source metadata is not verification of farming accuracy. Suitability and plant legality are not established. Density is not layout clearance.</p>
    <p className="text-sm">Country: {props.countryCode ?? 'Unknown'} · Agricultural region: {props.agriculturalRegionReference ?? 'Unknown'}</p>
    {!props.evidence?.candidates.length && !useRegionalMethod && <p className="text-sm">No reviewed source defaults are connected for this preview. Enter your own estimates to see supported partial results.</p>}
    <button type="button" className={button} disabled={props.checking} onClick={refresh}>{props.checking ? 'Checking measurements…' : 'Check saved measurements'}</button>
    {!sourceReady && <p role="note">Current saved measurements are required. Previously calculated results are hidden.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Preview crop<select aria-label="Preview crop" className={control} value={draft.crop} onChange={e => edit({ crop: e.target.value, values: {}, months: null, regionalConsent: null })}>
        <option value="">Choose an existing crop</option>{CROPS.map(crop => <option key={crop.key} value={crop.key}>{crop.name}</option>)}</select></label>
      <label className="text-sm">Preview measured bed<select aria-label="Preview measured bed" className={control} value={draft.bed} onChange={e => edit({ bed: e.target.value })}>
        <option value="">Choose a measured bed</option>{sourceReady && source?.beds.map(bed => <option key={bed.id} value={bed.id}>{bed.label} · {bed.areaM2} m²</option>)}</select></label>
      <label className="text-sm">Preview field-entry date (UTC)<input className={control} type="date" value={draft.date} onChange={e => edit({ date: e.target.value })} /></label>
      <label className="text-sm">Preview establishment<select aria-label="Preview establishment" className={control} value={draft.method} onChange={e => edit({ method: e.target.value as Draft['method'] })}>
        <option value="">Use evidence if available</option><option value="direct">Direct sowing</option><option value="transplant">Transplant</option></select></label>
      <label className="text-sm">Water regime<select aria-label="Water regime" className={control} value={draft.water} onChange={e => edit({ water: e.target.value as Draft['water'] })}>
        <option value="">Unknown</option><option value="rain-fed">Rain-fed</option><option value="irrigated">Irrigated</option></select></label>
      <label className="text-sm">Variety reference (optional)<input className={control} value={draft.variety} onChange={e => edit({ variety: e.target.value })} /></label>
    </div>
    {regionalReference && <section aria-label="Kenya method reference" className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
      <h3 className="font-semibold">WorldVeg cabbage method reference</h3>
      <p>The manual describes transplanting at 4–5 true leaves. This is a growth stage, not nursery days.</p>
      <p>Its cabbage discussion names central Kenya as a favourable context; it does not define a boundary or certify your site. Your region description has not been independently checked.</p>
      <p>Published: {sourcePublicationText(regionalReference)}. No numeric defaults are supplied: spacing has no named axes, and bed preparation lead time is not seedling age.</p>
      <p><a className="underline" href={`${regionalReference.url}#page=39`} target="_blank" rel="noreferrer">Read the original WorldVeg manual, page 35</a></p>
      <p>{regionalReference.attribution}</p><p>{regionalReference.licence.status === 'known' && regionalReference.licence.value}</p>
      {!regionalMatch && <p role="note">The method is available only with an explicit Central Kenya region description. It is not inferred from country or coordinates.</p>}
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label="Use WorldVeg method reference" disabled={!regionalMatch}
        checked={useRegionalMethod} onChange={e => edit({ regionalConsent: e.target.checked ? regionalConsentKey : null })} />Use this transplant-method reference for this preview</label>
      <p>Density, yield, nursery days and harvest dates stay unknown until supported separately. Nothing is saved.</p>
    </section>}
    <fieldset className="space-y-3"><legend className="font-semibold">Your preview overrides</legend>
      <p className="text-sm">Entered values are your estimates. Reset restores the evidence default, if available. Clearing an edited field keeps it unknown.</p>
      <div className="grid gap-3 sm:grid-cols-2">{numericFields.map(([key, label, unit]) => <div key={key}>
        <label className="block text-sm">{label}<input className={control} type="number" step={unit === 'days' ? '1' : 'any'} value={draft.values[key] ?? ''}
          onChange={e => edit({ values: { ...draft.values, [key]: e.target.value } })} /></label>
        {Object.hasOwn(draft.values, key) && <button type="button" className={button} onClick={() => { const next = { ...draft.values }; delete next[key]; edit({ values: next }); }}>Reset {label}</button>}
      </div>)}</div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.months !== null}
        onChange={e => edit({ months: e.target.checked ? [] : null })} />I specify preview field-entry months</label>
      {draft.months !== null && <div className="flex flex-wrap gap-2">{MONTHS_SHORT.map((month, i) => <label key={month} className="flex min-h-11 items-center gap-1 text-sm">
        <input type="checkbox" checked={draft.months!.includes(i + 1)} onChange={e => edit({ months: e.target.checked ? [...draft.months!, i + 1].sort((a, b) => a - b) : draft.months!.filter(n => n !== i + 1) })} />{month}</label>)}</div>}
    </fieldset>
    <button type="button" className={button} disabled={!sourceReady || !draft.crop || checkingSource} onClick={calculate}>Calculate provisional preview</button>
    {checkingSource && <p role="status">Checking current saved measurements…</p>}
    {error && <p role="alert">{error}</p>}
    {result?.status === 'invalid-context' && <p role="alert">This preview context is invalid. Check the current crop, source and conditions.</p>}
    {result?.status === 'restricted' && <p role="alert">A known planting restriction prevents this preview.</p>}
    {result?.status === 'resolved' && <section aria-label="Provisional results" className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <h3 className="font-semibold">Provisional results</h3>
      <button type="button" className={button} disabled={checkingSource} onClick={exportPreview}>Download printable preview</button>
      {exportMessage && <p role="status">{exportMessage}</p>}
      <p>Entry window: {result.assessment.entryWindow}. An unknown window does not establish that planting on this date is suitable.</p>
      <p>Estimated plants: {result.assessment.estimatedPlantCount.value ?? 'Unknown'} ({result.assessment.estimatedPlantCount.status})</p>
      <p>Estimated harvest weight: {result.assessment.estimatedYieldKg.value === null ? 'Unknown' : `${formatDerivedMassKilograms(result.assessment.estimatedYieldKg.value, 'kg')} kg`} ({result.assessment.estimatedYieldKg.status})</p>
      <ul>{Object.entries(result.assessment.schedule).map(([key, value]) => <li key={key}>{labels[key]} (UTC): {value.value ?? 'Unknown'} ({value.status})</li>)}</ul>
      {!!result.assessment.uncertainties.length && <p>Uncertainties: {result.assessment.uncertainties.join(', ')}</p>}
      <h4 className="font-semibold">Evidence and edits</h4>
      {Object.entries(result.fields).map(([key, value]) => <details key={key} className="rounded border border-[var(--border)] p-2">
        <summary className="min-h-11 cursor-pointer">{labels[key]}: {inputText(value.activeInput)} · {value.status}</summary>
        <p>Active basis: {value.activeTier ?? 'Unknown'}. Evidence default: {inputText(value.baselineDefault)}.</p>
        {value.activeInput.state === 'provided' && <p>Input provenance: {value.activeInput.provenance.kind}; recorded {value.activeInput.provenance.recordedAt}.</p>}
        {value.status === 'overridden' && value.activeInput.state === 'missing' && <p>Grower withheld this value. Its evidence default remains visible but is not used.</p>}
        {value.defaultConflict && <p role="note">Conflicting defaults remain unresolved; no average was invented.</p>}
        {value.status === 'invalid-override' && <p role="alert">Invalid override. Correct or reset this field; its default has not been substituted.</p>}
        {value.defaultOptions.map(option => <p key={option.candidateId}>Default {option.candidateId}: {inputText(option.input)}{option.reportedRange ? `; reported range ${option.reportedRange.join('–')}` : ''}. Applies to {scopeText(option.scope)}.</p>)}
        {value.defaultPlanningValueBasis && <p>Default planning value: {value.defaultPlanningValueBasis}</p>}
        {value.sourceBindings.map((item, i) => <div key={`${item.id}:${i}`} className="break-words"><p>Source: {item.title} · {item.url}. Published: {sourcePublicationText(item)}; accessed: {item.accessedOn ?? 'Unknown'}; review due: {item.reviewDueOn ?? 'Unknown'}. Reuse: {item.reuseTerms}. Evidence state: {item.evidenceState}.</p><p>{item.attribution}</p><p>{item.limitations}</p></div>)}
        {value.assumptions.map(item => <p key={item}>Assumption: {item}</p>)}
      </details>)}
      {!!result.rejected.length && <details><summary className="min-h-11 cursor-pointer">Evidence not used</summary><ul>{result.rejected.map((item, i) => <li key={i}>{item.id}: {item.reason}</li>)}</ul></details>}
      <p>Source checked at {preview?.request.recordedAt} (UTC). This is a checked snapshot, not a live source feed.</p>
      <p>Nothing has been saved or added. These are conditional planning estimates, not locally validated farming instructions.</p>
    </section>}
  </section>;
}
