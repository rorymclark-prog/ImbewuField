'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CROPS, MONTHS_SHORT } from '@/lib/crop-catalog';
import { growerPlanningScopeKey, normaliseGrowerMeasuredAreaInput, type GrowerPlanningScope } from '@/lib/international/grower-planning';
import { formatDerivedMassKilograms } from '@/lib/mass-units';
import { downloadFile } from '@/lib/crop-export-deliver';
import { buildProvisionalCropPreviewHtml, provisionalPlaceLabel, provisionalEntryWindowText, provisionalNumericFields as numericFields, provisionalLabels as labels, provisionalInputText as inputText, provisionalScopeText as scopeText } from '@/lib/international/provisional-crop-export';
import { growerWorkflowResourceSiteId, type GrowerWorkflowSource } from '@/lib/international/grower-workflow-source';
import { resolveProvisionalCropPlan, type ProvisionalFieldCandidate, type ProvisionalDraftRequest } from '@/lib/international/provisional-crop-planning';
import { usdaGreatLakesCabbageReference, usdaGreatLakesCabbageCandidates, usdaGreatLakesRegionMatches, USDA_CABBAGE_SPACING, type UsdaCabbageNurseryBasis } from '@/lib/international/providers/usda-great-lakes-cabbage';
import { usdaGreatLakesTomatoReference, usdaGreatLakesTomatoCandidates, USDA_TOMATO_NURSERY } from '@/lib/international/providers/usda-great-lakes-tomato';
import { createSavedProvisionalProfile, readSavedProvisionalProfile, type ProvisionalProfileSaveResult } from '@/lib/international/provisional-profile';
import type { GrowerPlanningProfile } from '@/lib/international/grower-planning';
import { sourcePublicationText } from '@/lib/international/countries/readiness';
import { worldvegKenyaCabbageCandidates, worldvegKenyaCabbageReference, worldvegKenyaCabbageRegionMatches } from '@/lib/international/providers/worldveg-kenya-cabbage';
import { worldvegKenyaCowpeaCandidates, worldvegKenyaCowpeaReference, worldvegKenyaCowpeaSpacing, type CowpeaReferenceConditions } from '@/lib/international/providers/worldveg-kenya-cowpea';

export interface ProvisionalCropPreviewProps {
  ownerKey: string;
  sample?: boolean;
  scope: GrowerPlanningScope | null;
  source: GrowerWorkflowSource | null;
  sourceName?: string | null;
  countryCode: string | null;
  agriculturalRegionReference: string | null;
  contextRevision: string | number;
  actorIsCurrent: () => boolean;
  checking: boolean;
  onRefresh: () => Promise<unknown>;
  onCheckSource: (expected: GrowerWorkflowSource) => Promise<{ isCurrent: () => boolean } | null>;
  /** Only owner-reviewed adapters supply candidates. Research metadata alone is
   * not an adapter; absent evidence must leave defaults unknown. */
  profiles?: readonly GrowerPlanningProfile[];
  onSaveProfile?: (profile: GrowerPlanningProfile, isCurrent: () => boolean) => ProvisionalProfileSaveResult;
  evidence?: { revision: string; candidates: readonly ProvisionalFieldCandidate[]; knownPlantingRestriction?: boolean };
}

type NumericField = typeof numericFields[number][0];
type Draft = {
  crop: string; bed: string; date: string; method: '' | 'direct' | 'transplant';
  water: '' | 'rain-fed' | 'irrigated'; variety: string;
  values: Partial<Record<NumericField, string>>; months: number[] | null; regionalConsent: string | null;
  cowpea: CowpeaReferenceConditions; cowpeaConsent: string | null; usdaConsent: string | null;
  tomatoConsent?: string | null;
  usdaNursery?: { basis: UsdaCabbageNurseryBasis | ''; contextKey: string | null };
  countMode: 'density' | 'spacing';
  spacing: { rowCm: string; inRowCm: string; finalStand: string };
  stationConsent: string | null; areaConsent: string | null;
};
type Resolution = ReturnType<typeof resolveProvisionalCropPlan>;
const control = 'min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm';
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';
function binding(props: ProvisionalCropPreviewProps): string | null {
  try {
    // A changed source revision can invalidate evidence even when area is identical.
    // Include the actual capsule too: a reused revision label must not retain an old preview.
    return JSON.stringify([props.ownerKey, props.sample === true, growerPlanningScopeKey(props.scope), props.source,
      props.countryCode, props.agriculturalRegionReference, props.contextRevision, props.checking, props.evidence ?? null,
      props.sourceName ?? null]);
  } catch { return null; }
}


function savedAreaText(value: unknown) {
  const area = normaliseGrowerMeasuredAreaInput(value);
  return area?.state === 'provided' ? String(area.value) : 'Unknown';
}

function EvidenceFields({ fields, spacing }: { fields: Extract<Resolution, { status: 'resolved' }>['fields']; spacing: boolean }) {
  return <>
      {Object.entries(fields).map(([key, value]) => <details key={key} className="rounded border border-[var(--border)] p-2">
        <summary className="min-h-11 cursor-pointer">{labels[key]}: {inputText(value.activeInput)} · {value.status}</summary>
        <p>Active basis: {value.activeTier ?? 'Unknown'}. Evidence default: {inputText(value.baselineDefault)}.</p>
        {value.defaultEntryMonthCoverage === 'positive-only' && <p>Source default reports positive months only; other months are unknown. A grower override replaces the active window, not this source record.</p>}
        {value.activeInput.state === 'provided' && <p>Input provenance: {value.activeInput.provenance.kind}; recorded {value.activeInput.provenance.recordedAt}.</p>}
        {value.status === 'overridden' && value.activeInput.state === 'missing' && <p>{key === 'plantsPerM2' && spacing ? 'The chosen spacing method does not use an entered/default density.' : 'Grower withheld this value. Its evidence default remains visible but is not used.'}</p>}
        {value.defaultConflict && <p role="note">Conflicting defaults remain unresolved; no average was invented.</p>}
        {value.status === 'invalid-override' && <p role="alert">Invalid override. Correct or reset this field; its default has not been substituted.</p>}
        {value.defaultOptions.map(option => <p key={option.candidateId}>Default {option.candidateId}: {inputText(option.input)}{option.reportedRange ? `; reported range ${option.reportedRange.join('–')}` : ''}. Applies to {scopeText(option.scope)}.</p>)}
        {value.defaultPlanningValueBasis && <p>Default planning value: {value.defaultPlanningValueBasis}</p>}
        {value.sourceBindings.map((item, i) => <div key={`${item.id}:${i}`} className="break-words"><p>Source: {item.title} · {item.url}. Published: {sourcePublicationText(item)}; accessed: {item.accessedOn ?? 'Unknown'}; review due: {item.reviewDueOn ?? 'Unknown'}. Reuse: {item.reuseTerms}. Evidence state: {item.evidenceState}.</p><p>{item.attribution}</p><p>{item.limitations}</p></div>)}
        {value.assumptions.map(item => <p key={item}>Assumption: {item}</p>)}
      </details>)}
  </>;
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
  const [draft, setDraft] = useState<Draft>({ crop: '', bed: '', date: '', method: '', water: '', variety: '', values: {}, months: null, regionalConsent: null, cowpea: { purpose: '', habit: '' }, cowpeaConsent: null, usdaConsent: null, countMode: 'density', spacing: { rowCm: '', inRowCm: '', finalStand: '' }, stationConsent: null, areaConsent: null });
  const draftLive = useRef(draft); draftLive.current = draft;
  const [preview, setPreview] = useState<{ binding: string; generation: number; draft: Draft; result: Resolution; request: ProvisionalDraftRequest; bedLabel: string; placeLabel: string; receipt: { isCurrent: () => boolean } } | null>(null);
  const previewLive = useRef(preview); previewLive.current = preview;
  const [error, setError] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [saveConsent, setSaveConsent] = useState<object | null>(null);
  const saveDeclaration = useRef<{ selected: object | null }>({ selected: null });
  function declareSave(selected: object | null) {
    // A checkbox round trip during an awaited source read is a new decision,
    // never permission for the already pending attempt to resume.
    saveDeclaration.current = { selected }; setSaveConsent(selected);
  }
  const [saveMessage, setSaveMessage] = useState('');
  const consumed = useRef<object | null>(null);
  const pending = useRef<object | null>(null);
  const [checkingSource, setCheckingSource] = useState(false);
  const environment = binding(props);
  // Equal values after a context round trip are not continuous authority. Retire
  // consent, results and retained callbacks even when A -> B -> A looks identical.
  const context = useRef({ environment, generation: 0 });
  if (context.current.environment !== environment) context.current = { environment, generation: context.current.generation + 1 };
  const generation = context.current.generation;
  const regionalReference = worldvegKenyaCabbageReference(props.countryCode, draft.crop);
  const regionalMatch = worldvegKenyaCabbageRegionMatches(props.agriculturalRegionReference);
  const regionalConsentKey = environment === null ? null : JSON.stringify([environment, generation, draft.crop]);
  const useRegionalMethod = regionalConsentKey !== null && draft.regionalConsent === regionalConsentKey && regionalMatch;
  const cowpeaReference = worldvegKenyaCowpeaReference(props.countryCode, draft.crop);
  const cowpeaSpacing = worldvegKenyaCowpeaSpacing(draft.cowpea);
  const cowpeaConsentKey = environment === null ? null : JSON.stringify([environment, generation, draft.crop, draft.variety, draft.cowpea]);
  const useCowpeaMethod = cowpeaConsentKey !== null && draft.cowpeaConsent === cowpeaConsentKey && cowpeaSpacing !== null;
  const usdaReference = usdaGreatLakesCabbageReference(props.countryCode, draft.crop);
  const usdaRegionMatch = usdaGreatLakesRegionMatches(props.agriculturalRegionReference);
  const usdaConsentKey = environment === null ? null : JSON.stringify([environment, generation, draft.crop, draft.variety]);
  const useUsdaMethod = usdaConsentKey !== null && draft.usdaConsent === usdaConsentKey && usdaRegionMatch;
  const usdaNurseryBasis = useUsdaMethod && draft.method !== 'direct' && draft.usdaNursery?.contextKey === usdaConsentKey ? draft.usdaNursery.basis : '';
  const tomatoReference = usdaGreatLakesTomatoReference(props.countryCode, draft.crop);
  const tomatoConsentKey = environment === null ? null : JSON.stringify([environment, generation, draft.crop, draft.variety, draft.method, draft.water]);
  const useTomatoReference = tomatoConsentKey !== null && draft.tomatoConsent === tomatoConsentKey
    && usdaRegionMatch && draft.method !== 'direct';
  const spacingConsentKey = environment === null ? null : JSON.stringify([environment, generation, draft.crop, draft.bed, draft.variety, draft.cowpea, draft.countMode, draft.spacing]);
  const stationConfirmed = spacingConsentKey !== null && draft.stationConsent === spacingConsentKey;
  const wholeAreaConfirmed = spacingConsentKey !== null && draft.areaConsent === spacingConsentKey;
  const source = props.source;
  const sourceReady = !!source && growerWorkflowResourceSiteId(source) !== null
    && growerPlanningScopeKey(source.scope) === growerPlanningScopeKey(props.scope) && !props.checking;
  const result = props.actorIsCurrent() && sourceReady && environment !== null && preview?.binding === environment && preview.generation === generation
    && preview.draft === draft && preview.request.asOf === new Date().toISOString().slice(0, 10)
    && preview.receipt.isCurrent() ? preview.result : null;
  function isCurrent() {
    return active.current && current.current.actorIsCurrent() && environment !== null
      && context.current.generation === generation && binding(current.current) === environment && draftLive.current === draft;
  }
  function edit(next: Partial<Draft>) {
    if (!isCurrent()) return;
    const sourceChoiceChanged = ['crop', 'variety', 'method', 'water'].some(key => Object.hasOwn(next, key));
    const value = { ...draft, ...next, ...(sourceChoiceChanged ? { tomatoConsent: null } : {}) }; draftLive.current = value; setDraft(value); setPreview(null); setError(''); setExportMessage(''); declareSave(null); setSaveMessage('');
  }
  async function refresh() {
    if (!isCurrent()) return;
    setPreview(null); setError(''); setExportMessage(''); declareSave(null); setSaveMessage('');
    try { await current.current.onRefresh(); }
    catch { if (isCurrent()) setError('Could not check saved measurements. Try again.'); }
  }
  async function calculate() {
    if (!isCurrent() || pending.current) return;
    // The day belongs to this calculation, not the render-time edit guard. A form
    // left open overnight must still accept edits and start a fresh calculation.
    const calculationDay = new Date().toISOString().slice(0, 10);
    setPreview(null); setError(''); setExportMessage(''); declareSave(null); setSaveMessage('');
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
        candidates: [...(props.evidence?.candidates ?? []), ...worldvegKenyaCabbageCandidates(context, draft.crop, recordedAt, useRegionalMethod),
          ...worldvegKenyaCowpeaCandidates(context, draft.crop, recordedAt, useCowpeaMethod, draft.cowpea),
          ...usdaGreatLakesCabbageCandidates(context, draft.crop, recordedAt, useUsdaMethod, usdaNurseryBasis || null),
          ...usdaGreatLakesTomatoCandidates(context, draft.crop, recordedAt, useTomatoReference)], overrides,
        ...(draft.countMode === 'spacing' ? { countBasis: { kind: 'spacing-cell-budget-v1', bedId: draft.bed,
          ...(usdaReference ? { purpose: 'cabbage-transplants', habit: 'not-applicable' } : draft.cowpea), ...draft.spacing,
          interpretationConfirmed: stationConfirmed, wholeAreaConfirmed } } : {}),
        knownPlantingRestriction: props.evidence?.knownPlantingRestriction,
        measuredAreaM2: { state: 'provided', value: measures[0].areaM2, unit: 'm2',
          provenance: { kind: 'grower-record', recordedAt, reference: `Saved measured bed: ${draft.bed}` },
          ...(measures[0].arithmeticBasis ? { arithmeticBasis: measures[0].arithmeticBasis } : {}) },
        fieldEntryDate: draft.date ? supplied(draft.date, 'utc-date') : { state: 'missing', reason: 'not-entered' } });
      const next = resolveProvisionalCropPlan(request);
      if (isCurrent() && receipt.isCurrent()) setPreview({ binding: environment!, generation, draft, result: next, request,
        bedLabel: beds[0].label, placeLabel: provisionalPlaceLabel(props.sourceName), receipt });
    } catch { if (isCurrent()) setError('Could not check this preview. Check the saved measurements and evidence again.'); }
    finally { if (pending.current === token) { pending.current = null; if (active.current) setCheckingSource(false); } }
  }
  const savedProfiles = useMemo(() => (props.profiles ?? []).map(readSavedProvisionalProfile)
    .filter(value => value && growerPlanningScopeKey(value.profile.scope) === growerPlanningScopeKey(props.scope)), [props.profiles, props.scope]);
  async function savePreview() {
    const selected = preview, writer = props.onSaveProfile;
    if (!isCurrent() || !selected || result?.status !== 'resolved' || !source || !writer
      || saveConsent !== selected || consumed.current === selected || pending.current) return;
    const declaration = saveDeclaration.current;
    const bound = () => isCurrent() && previewLive.current === selected && current.current.onSaveProfile === writer
      && declaration.selected === selected && saveDeclaration.current === declaration
      && selected.request.asOf === new Date().toISOString().slice(0, 10) && selected.receipt.isCurrent();
    if (!bound()) return;
    const token = {}; pending.current = token; setCheckingSource(true); setSaveMessage('');
    try {
      const fresh = await current.current.onCheckSource(source);
      const currentSave = () => bound() && fresh?.isCurrent() === true;
      if (!currentSave()) { if (isCurrent()) setError('Saved measurements or context changed. Calculate a fresh preview before saving.'); return; }
      const candidate = createSavedProvisionalProfile(selected.request, crypto.randomUUID(), new Date().toISOString(), source, selected.draft.bed, selected.bedLabel);
      if (!candidate || candidate.provisionalOrigin?.previewFingerprint !== selected.result.fingerprint) {
        if (bound()) setError('Finish valid source and spacing choices before saving this profile. Missing yield or dates may remain unknown.'); return;
      }
      if (!currentSave()) return;
      // Consume before calling a writer: a thrown callback or post-write event
      // must never turn an uncertain completed write into an automatic retry.
      consumed.current = selected;
      const outcome = writer(candidate, currentSave);
      if (outcome.status === 'held' || outcome.status === 'failed') consumed.current = null;
      if (!isCurrent()) return;
      if (outcome.status === 'confirmed' && outcome.profileId === candidate.profileId) {
        setSaveMessage('Profile saved. Open its saved provisional evidence below. No sowings were added.');
      } else if (outcome.status === 'superseded' || outcome.status === 'confirmed') {
        setSaveMessage('A save occurred or its result could not be confirmed. Check the saved profiles before starting another save.');
      } else setError('The profile was not saved. Check the current saved plan and measurements, then try again.');
    } catch {
      if (isCurrent()) setError(consumed.current === selected
        ? 'The save result could not be confirmed. Check saved profiles before starting another save.'
        : 'Could not check this save. Check measurements and try again.');
    } finally { if (pending.current === token) { pending.current = null; if (active.current) setCheckingSource(false); } }
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
        bedLabel: selected.bedLabel, placeLabel: selected.placeLabel, sample: props.sample === true,
      });
      if (!document || document.fingerprint !== selected.result.fingerprint || !handoff()) return;
      const delivered = await downloadFile(new Blob([document.html], { type: 'text/html;charset=utf-8' }),
        `ImbewuField${props.sample ? '-demo' : ''}-provisional-preview.html`, check, handoff);
      if (bound()) {
        if (delivered === 'downloaded') setExportMessage('Printable preview download requested. Open the HTML file in a browser to print it. Downloading does not add crops to your plan.');
        else { setPreview(null); setError('Preview changed before download. Recalculate before downloading.'); }
      }
    } catch { if (bound()) { setPreview(null); setError('Could not confirm a current preview. Nothing was downloaded.'); } }
    finally { if (pending.current === token) { pending.current = null; if (active.current) setCheckingSource(false); } }
  }
  return <section lang="en" aria-label="Provisional crop preview" className="space-y-4 px-4 pb-4 font-sans">
    <p className="text-sm">Site or workspace: {provisionalPlaceLabel(props.sourceName)}</p>
    <p className="text-sm">Preview supported counts and dates using applicable evidence and your edits. Missing values stay unknown. {props.onSaveProfile ? 'Calculating does not save. Use the separate save action to keep a profile for review.' : 'Nothing here saves a profile or adds a crop.'}</p>
    <p role="note" className="text-sm">Provisional estimates: source metadata is not verification of farming accuracy. Suitability and plant legality are not established. Density is not layout clearance.</p>
    <p className="text-sm">Country: {props.countryCode ?? 'Unknown'} · Agricultural region: {props.agriculturalRegionReference ?? 'Unknown'}</p>
    {!props.evidence?.candidates.length && !useRegionalMethod && !useCowpeaMethod && !useUsdaMethod && !useTomatoReference && <p className="text-sm">No reviewed source defaults are connected for this preview. Enter your own estimates to see supported partial results.</p>}
    {!!savedProfiles.length && <section aria-label="Saved provisional profiles" className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <h3 className="font-semibold">Saved provisional profiles</h3>
      <p>Historical evidence, not a current source check or an approved planting plan. To change conditions, calculate and save a new preview.</p>
      {savedProfiles.map(saved => saved && <details key={saved.profile.profileId} className="space-y-2 break-words">
        <summary className="min-h-11 cursor-pointer">{CROPS.find(crop => crop.key === saved.profile.cropKey)?.name} · {saved.origin.bedLabel} · saved {saved.origin.savedAt}</summary>
        <p>Evidence as of {saved.request.asOf}; saved country {saved.request.context.countryCode ?? 'Unknown'}; region {saved.request.context.agriculturalRegionReference ?? 'Unknown'}.</p>
        <p>Water regime: {saved.request.context.waterRegime ?? 'Unknown'}. Variety: {saved.request.context.varietyReference ?? 'Unknown'}. Current applicability has not been checked.</p>
        <p>Saved measured area: {savedAreaText(saved.request.measuredAreaM2)} m².</p>
        {saved.request.countBasis && <p>Chosen spacing: {saved.request.countBasis.rowCm} cm between rows; {saved.request.countBasis.inRowCm} cm within rows; final survivors per station: {saved.request.countBasis.finalStand || 'Unknown'}. This is an area budget, not physical layout fit.</p>}
        {saved.request.countBasis && <p>Saved budgeted whole stations: {saved.result.assessment.budgetedStations.value ?? 'Unknown'} ({saved.result.assessment.budgetedStations.status}).</p>}
        <p>Saved estimate: {saved.result.assessment.estimatedPlantCount.value ?? 'Unknown'} plants ({saved.result.assessment.estimatedPlantCount.status}); harvest weight {saved.result.assessment.estimatedYieldKg.value ?? 'Unknown'} kg ({saved.result.assessment.estimatedYieldKg.status}).</p>
        <p>Saved entry window: {provisionalEntryWindowText(saved.result.assessment.entryWindow)}. Current planting suitability is unverified.</p>
        {saved.result.profile.version === 2 && <p>Source reports these months; other months remain unknown. Saved date offsets are conditional calculations, not planting recommendations. Specify your own field-entry window in a new preview before automatic planning or adoption.</p>}
        <ul>{Object.entries(saved.result.assessment.schedule).map(([key, value]) => <li key={key}>{labels[key]} (UTC): {value.value ?? 'Unknown'} ({value.status})</li>)}</ul>
        <EvidenceFields fields={saved.result.fields} spacing={!!saved.request.countBasis} />
        {!!saved.result.rejected.length && <details><summary className="min-h-11 cursor-pointer">Saved evidence not used</summary><ul>{saved.result.rejected.map((item, i) => <li key={i}>{item.id}: {item.reason}</li>)}</ul></details>}
      </details>)}
    </section>}
    <button type="button" className={button} disabled={props.checking} onClick={refresh}>{props.checking ? 'Checking measurements…' : 'Check saved measurements'}</button>
    {!sourceReady && <p role="note">Current saved measurements are required. Previously calculated results are hidden.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Preview crop<select aria-label="Preview crop" className={control} value={draft.crop} onChange={e => edit({ crop: e.target.value, values: {}, months: null, regionalConsent: null, cowpea: { purpose: '', habit: '' }, cowpeaConsent: null, usdaConsent: null, countMode: 'density', spacing: { rowCm: '', inRowCm: '', finalStand: '' }, stationConsent: null, areaConsent: null })}>
        <option value="">Choose an existing crop</option>{CROPS.map(crop => <option key={crop.key} value={crop.key}>{crop.name}</option>)}</select></label>
      <label className="text-sm">Preview measured bed<select aria-label="Preview measured bed" className={control} value={draft.bed} onChange={e => edit({ bed: e.target.value, stationConsent: null, areaConsent: null })}>
        <option value="">Choose a measured bed</option>{sourceReady && source?.beds.map(bed => <option key={bed.id} value={bed.id}>{bed.label} · {bed.areaM2} m²</option>)}</select></label>
      <label className="text-sm">Preview field-entry date (UTC)<input className={control} type="date" value={draft.date} onChange={e => edit({ date: e.target.value })} /></label>
      <label className="text-sm">Preview establishment<select aria-label="Preview establishment" className={control} value={draft.method} onChange={e => edit({ method: e.target.value as Draft['method'], usdaNursery: undefined })}>
        <option value="">Use evidence if available</option><option value="direct">Direct sowing</option><option value="transplant">Transplant</option></select></label>
      <label className="text-sm">Water regime<select aria-label="Water regime" className={control} value={draft.water} onChange={e => edit({ water: e.target.value as Draft['water'] })}>
        <option value="">Unknown</option><option value="rain-fed">Rain-fed</option><option value="irrigated">Irrigated</option></select></label>
      <label className="text-sm">Variety reference (optional)<input className={control} value={draft.variety} onChange={e => edit({ variety: e.target.value, cowpeaConsent: null, usdaConsent: null, stationConsent: null, areaConsent: null })} /></label>
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
    {cowpeaReference && <section aria-label="Kenya cowpea reference" className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
      <h3 className="font-semibold">WorldVeg cowpea conditions and method</h3>
      <p>This Kenya manual section concerns cowpea leaves. Choose your purpose and growth habit before using its method. Neither selection verifies your variety or farm suitability.</p>
      <label className="block">Cowpea harvest purpose<select aria-label="Cowpea harvest purpose" className={control} value={draft.cowpea.purpose}
        onChange={e => edit({ cowpea: { ...draft.cowpea, purpose: e.target.value as CowpeaReferenceConditions['purpose'] }, cowpeaConsent: null, spacing: { rowCm: '', inRowCm: '', finalStand: '' }, stationConsent: null, areaConsent: null })}>
        <option value="">Unknown</option><option value="leaves">Leaves</option><option value="pods-or-grain">Pods or grain</option></select></label>
      <label className="block">Cowpea growth habit<select aria-label="Cowpea growth habit" className={control} value={draft.cowpea.habit}
        onChange={e => edit({ cowpea: { ...draft.cowpea, habit: e.target.value as CowpeaReferenceConditions['habit'] }, cowpeaConsent: null, spacing: { rowCm: '', inRowCm: '', finalStand: '' }, stationConsent: null, areaConsent: null })}>
        <option value="">Unknown</option><option value="spreading">Spreading</option><option value="erect-or-semi-erect">Erect or semi-erect</option></select></label>
      {cowpeaSpacing ? <p>Source spacing for your selected habit: {cowpeaSpacing}. No point value is selected by the source.</p>
        : <p>Choose leaf production and a known growth habit to see the matching spacing reference. Pod or grain production needs separate evidence.</p>}
      <p>The source describes direct sowing with 2–3 seeds per hill. Seeds sown do not establish the final surviving plants per station. Density, yield and dates remain unknown; separately entered numbers are your estimates.</p>
      <p>Published: {sourcePublicationText(cowpeaReference)}. <a className="underline" href={`${cowpeaReference.url}#page=26`} target="_blank" rel="noreferrer">Read the original manual, page 22</a></p>
      <p>{cowpeaReference.attribution}</p><p>{cowpeaReference.licence.status === 'known' && cowpeaReference.licence.value}</p>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={!cowpeaSpacing} checked={useCowpeaMethod}
        onChange={e => edit({ cowpeaConsent: e.target.checked ? cowpeaConsentKey : null })} />Use this direct-sowing reference for this preview</label>
    </section>}
    {usdaReference && <section aria-label="Great Lakes cabbage reference" className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
      <h3 className="font-semibold">USDA Great Lakes cabbage transplant reference</h3>
      <p>This undated community-garden guide describes cabbage bedding plants transplanted into rows in the Great Lakes States. It is not a US-wide default or current local suitability assessment.</p>
      <p>Source spacing: {USDA_CABBAGE_SPACING.display}</p>
      <p>Publication and revision dates are unknown. Cultivar, head size and final surviving plants per station are unknown. The planting-cell footnote (1) describes cell size, not one survivor.</p>
      <p><a className="underline" href={`${usdaReference.url}#page=5`} target="_blank" rel="noreferrer">Read the original USDA guide, page 5</a></p>
      <p>{usdaReference.attribution}</p><p>{usdaReference.licence.status === 'known' && usdaReference.licence.value}</p>
      {!usdaRegionMatch && <p role="note">Enter the explicit region description “Great Lakes States” to consider this reference. Region is declared by you; no boundary is inferred from country, state or coordinates.</p>}
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label="Use undated USDA transplant reference" disabled={!usdaRegionMatch}
        checked={useUsdaMethod} onChange={e => edit({ usdaConsent: e.target.checked ? usdaConsentKey : null, usdaNursery: undefined })} />Use this undated reference for cabbage bedding transplants in my declared Great Lakes States region</label>
      <p>The same cabbage row reports 4–6 weeks before transplanting (28–42 days). This is seed-starting lead time before garden transplanting, not days after emergence or germination time. It does not select one nursery age. Choose a bound only if you want a conditional nursery start from your own field-entry date.</p>
      <label className="block">USDA nursery lead-time choice<select aria-label="USDA nursery lead-time choice" className={control}
        disabled={!useUsdaMethod || draft.method === 'direct'} value={usdaNurseryBasis}
        onChange={e => edit({ usdaNursery: { basis: e.target.value as UsdaCabbageNurseryBasis | '', contextKey: usdaConsentKey } })}>
        <option value="">No source duration selected</option>
        <option value="lower-bound">4 weeks · 28 days · shorter</option>
        <option value="upper-bound">6 weeks · 42 days · longer</option>
      </select></label>
      <p>A shorter lead time starts seeds later; a longer lead time starts them earlier, for the same field-entry date.</p>
      <p>This is not a local planting calendar, frost-safety check or guarantee of seedling readiness. Yield and harvest dates receive no defaults. Your nursery-duration override below takes precedence; reset it to use your selected source bound.</p>
    </section>}
    {tomatoReference && <section aria-label="Great Lakes tomato reference" className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
      <h3 className="font-semibold">USDA Great Lakes tomato seed-starting reference</h3>
      <p>The undated guide’s Tomato row gives {USDA_TOMATO_NURSERY.weeks} weeks before garden transplanting ({USDA_TOMATO_NURSERY.days} days). This is seed-starting lead time, not days after emergence or a germination duration.</p>
      <p>A conditional nursery start can be calculated from your own field-entry date. The source does not approve that date or establish frost safety, seedling readiness, yield or harvest dates. No extra hardening-off interval is added.</p>
      <p>Publication and revision dates are unknown. This is not a US-wide default or current local suitability assessment. Variety, growth habit and seed-starting conditions remain unknown.</p>
      <p><a className="underline" href={`${tomatoReference.url}#page=5`} target="_blank" rel="noreferrer">Read the original USDA guide, page 5</a></p>
      <p>{tomatoReference.attribution}</p><p>{tomatoReference.licence.status === 'known' && tomatoReference.licence.value}</p>
      {!usdaRegionMatch && <p role="note">Declare the explicit region “Great Lakes States” to consider this reference. Country and coordinates alone do not select it.</p>}
      {draft.method === 'direct' && <p role="note">This reference concerns bedding transplants, not direct sowing.</p>}
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label="Use undated USDA tomato seed-starting reference"
        disabled={!usdaRegionMatch || draft.method === 'direct'} checked={useTomatoReference}
        onChange={e => edit({ tomatoConsent: e.target.checked ? tomatoConsentKey : null })} />Use this undated tomato seed-starting reference for my declared Great Lakes States region</label>
      <p>Your nursery-duration override takes precedence. Reset it to use the source’s {USDA_TOMATO_NURSERY.days}-day reference; clearing your override keeps the duration unknown.</p>
    </section>}
    {(cowpeaReference || usdaReference) && <section aria-label="Regional spacing estimate" className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
      <label className="block">Plant-count method<select aria-label="Plant-count method" className={control} value={draft.countMode}
        onChange={e => edit({ countMode: e.target.value as Draft['countMode'], stationConsent: null, areaConsent: null })}>
        <option value="density">Entered density or evidence default</option><option value="spacing">Whole spacing-cell area estimate</option></select></label>
      {draft.countMode === 'spacing' && <div className="space-y-3" aria-label="Spacing-cell choices">
        <p>Choose each spacing yourself within the range above. Nothing is prefilled. Whole cells are rounded down before multiplying by surviving plants per station.</p>
        <p>This budgets area only. It does not show rows that physically fit, edge clearance or paths. Yield and dates receive no new defaults.</p>
        {([['rowCm', 'Chosen row spacing (cm)'], ['inRowCm', 'Chosen in-row spacing (cm)'], ['finalStand', 'Final surviving plants per station']] as const).map(([key, label]) =>
          <label className="block" key={key}>{label}<input className={control} inputMode="decimal" value={draft.spacing[key]}
            onChange={e => edit({ spacing: { ...draft.spacing, [key]: e.target.value }, stationConsent: null, areaConsent: null })} /></label>)}
        <p>Leave final stand blank if unknown. Seeds per hill and planting-cell footnotes are not surviving plants. An explicit zero means no survivors.</p>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={stationConfirmed}
          onChange={e => edit({ stationConsent: e.target.checked ? spacingConsentKey : null })} />I interpret the source’s between-plants distance as distance between stations for this estimate.</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={wholeAreaConfirmed}
          onChange={e => edit({ areaConsent: e.target.checked ? spacingConsentKey : null })} />I treat the whole selected measured bed area as usable spacing-cell area, without paths or excluded space.</label>
      </div>}
    </section>}
    <fieldset className="space-y-3"><legend className="font-semibold">Your preview overrides</legend>
      <p className="text-sm">Entered values are your estimates. Reset restores the evidence default, if available. Clearing an edited field keeps it unknown.</p>
      <div className="grid gap-3 sm:grid-cols-2">{numericFields.filter(([key]) => draft.countMode !== 'spacing' || key !== 'plantsPerM2').map(([key, label, unit]) => <div key={key}>
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
      {props.onSaveProfile && <div className="space-y-2 rounded border border-[var(--border)] p-3">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={saveConsent === preview}
          onChange={event => declareSave(event.target.checked ? preview : null)} />Save these inputs, source limits and unknowns as a new profile for review. Do not add sowings.</label>
        <button type="button" className={button} disabled={checkingSource || saveConsent !== preview || consumed.current === preview}
          onClick={savePreview}>Save provisional profile</button>
      </div>}
      {saveMessage && <p role="status">{saveMessage}</p>}
      <p>Entry window: {provisionalEntryWindowText(result.assessment.entryWindow)}. An unknown window does not establish that planting on this date is suitable.</p>
      {result.profile.version === 2 && <p>Source reports these months; other months remain unknown. Date offsets are conditional calculations, not planting recommendations. Specify your own field-entry window before automatic planning or adoption.</p>}
      {result.spacingSelection && <p role="note">Spacing-cell estimate: {result.spacingSelection.issue} ({result.spacingSelection.status})</p>}
      {draft.countMode === 'spacing' && <p>Budgeted whole stations: {result.assessment.budgetedStations.value ?? 'Unknown'} ({result.assessment.budgetedStations.status}). Area budget only; physical layout fit is unassessed.</p>}
      <p>Estimated plants: {result.assessment.estimatedPlantCount.value ?? 'Unknown'} ({result.assessment.estimatedPlantCount.status})</p>
      <p>Estimated harvest weight: {result.assessment.estimatedYieldKg.value === null ? 'Unknown' : `${formatDerivedMassKilograms(result.assessment.estimatedYieldKg.value, 'kg')} kg`} ({result.assessment.estimatedYieldKg.status})</p>
      <ul>{Object.entries(result.assessment.schedule).map(([key, value]) => <li key={key}>{labels[key]} (UTC): {value.value ?? 'Unknown'} ({value.status})</li>)}</ul>
      {!!result.assessment.uncertainties.length && <p>Uncertainties: {result.assessment.uncertainties.join(', ')}</p>}
      <h4 className="font-semibold">Evidence and edits</h4>
      <EvidenceFields fields={result.fields} spacing={draft.countMode === 'spacing'} />
      {!!result.rejected.length && <details><summary className="min-h-11 cursor-pointer">Evidence not used</summary><ul>{result.rejected.map((item, i) => <li key={i}>{item.id}: {item.reason}</li>)}</ul></details>}
      <p>Source checked at {preview?.request.recordedAt} (UTC). This is a checked snapshot, not a live source feed.</p>
      <p>{props.onSaveProfile ? 'Saving a profile keeps its evidence for review; it does not add sowings.' : 'Nothing has been saved or added.'} These are conditional planning estimates, not locally validated farming instructions.</p>
    </section>}
  </section>;
}
