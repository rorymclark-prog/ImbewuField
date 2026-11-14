import { saskatchewanNurseryResultQualifier } from './providers/usask-saskatchewan-cabbage';
import { canadaCabbageResultQualifier } from './providers/aafc-canada-cabbage';
import { regionalSpacingReference } from './providers/regional-spacing-reference';
import { sourcePublicationText } from './countries/readiness';
import { assessGrowerPlanning, type GrowerInputProvenance, type GrowerPlanningSnapshot } from './grower-planning';
import { normaliseGrowerCycleAttachment } from './grower-cycle';
import { readSavedProvisionalProfile, reviewProvisionalCycleProfile } from './provisional-profile';
import { formatDerivedMassKilograms } from '../mass-units';
import { CROPS } from '../crop-catalog';
import { resolveProvisionalCropPlan, type ProvisionalDraftRequest, type ResolvedProvisionalField } from './provisional-crop-planning';
import { provisionalTemperatureLines } from './provisional-temperature';

export const provisionalNumericFields = [
  ['plantsPerM2', 'Plant density (plants per m²)', 'plants/m2'],
  ['yieldKgPerM2', 'Harvest weight (kg per m² per cycle)', 'kg/m2/cycle'],
  ['nurseryDays', 'Nursery duration (days)', 'days'],
  ['fieldEntryToFirstHarvestDays', 'Field entry to first harvest (days)', 'days'],
  ['pickingDays', 'Picking duration (days)', 'days'],
  ['fieldOccupancyDays', 'Field occupancy (days)', 'days'],
  ['turnaroundDays', 'Turnaround after clearing (days)', 'days'],
] as const;
export const provisionalLabels: Record<string, string> = { ...Object.fromEntries(provisionalNumericFields.map(([key, label]) => [key, label])),
  establishment: 'Establishment method', allowedEntryMonths: 'Field-entry months', nurseryStartDate: 'Nursery start',
  firstHarvestDate: 'First harvest', harvestEndExclusiveDate: 'Picking ends (exclusive)', fieldClearDate: 'Field clear',
  nextFieldEntryDate: 'Next field entry' };
export function provisionalInputText(input: { state: string; value?: unknown; unit?: string } | null) {
  if (input?.state !== 'provided') return 'Unknown';
  const unit = ({ 'plants/m2': 'plants/m²', 'kg/m2/cycle': 'kg/m²/cycle', m2: 'm²', 'utc-date': '(UTC)', 'utc-months': '(UTC months)', method: '' } as Record<string, string>)[input.unit ?? ''] ?? input.unit ?? '';
  return `${Array.isArray(input.value) ? input.value.join(', ') : input.value} ${unit}`.trim();
}
export function provisionalEntryWindowText(status: string): string {
  return status === 'reported-positive' ? 'Source reports this month; current suitability is unverified' : status;
}

export function provisionalScopeText(scope: ResolvedProvisionalField['defaultOptions'][number]['scope']) {
  const geography = scope.geography, time = scope.temporalScope;
  const place = geography.kind === 'country' ? geography.countryCode
    : geography.kind === 'region' ? `${geography.countryCode}, region ${geography.regionReference}`
      : geography.kind === 'site' ? 'this saved site' : `transferred evidence: ${geography.assumption}`;
  const period = time.kind === 'recurring-season' ? 'recurring season'
    : time.kind === 'dated' ? `${time.fromDate} through ${time.throughDate}` : `${time.period}; ${time.assumption}`;
  return `${place}; ${period}; establishment ${scope.establishment}; water regime ${scope.waterRegime}${scope.varietyReference ? `; variety ${scope.varietyReference}` : ''}${scope.entryMonthCoverage === 'positive-only' ? '; source reports positive months only; other months unknown' : ''}`;
}

const provenanceText = (p: GrowerInputProvenance) => `${p.kind}; recorded ${p.recordedAt}${'reference' in p ? `; reference ${p.reference}` : ''}${'sourceUrl' in p ? `; source ${p.sourceUrl}` : ''}${'note' in p && p.note ? `; note ${p.note}` : ''}`;

const escape = (value: unknown) => String(value ?? 'Unknown').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const paragraph = (label: string, value: unknown) => `<p><strong>${escape(label)}:</strong> ${escape(value)}</p>`;

export function provisionalPlaceLabel(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'Unnamed site or workspace';
}

/** A portable view of the resolver, never another calculator or saved-plan writer.
 * The caller must freshly admit the source and actor at the actual file handoff. */
export function buildProvisionalCropPreviewHtml(request: ProvisionalDraftRequest, metadata: {
  bedLabel: string; sample: boolean; placeLabel?: string | null;
}): { html: string; fingerprint: string } | null {
  return renderProvisionalCropDocument(request, { bedLabel: metadata.bedLabel, sample: metadata.sample,
    placeLabel: provisionalPlaceLabel(metadata.placeLabel) });
}
interface AcceptedRecordMetadata {
  acceptedAt: string; originalSavedAt: string; originalAsOf: string; reviewedAt: string;
}
/** A historical copy of a validated saved cycle, never permission for a new
 * planting or proof that its source/country context is current today. */
export function buildAdoptedProvisionalCycleHtml(value: unknown, metadata: { bedLabel: string; sample: boolean }) {
  const attachment = normaliseGrowerCycleAttachment(value);
  if (!attachment?.assessmentSnapshot.provisionalReview) return null;
  const snapshot = attachment.assessmentSnapshot, saved = readSavedProvisionalProfile(snapshot.profile);
  if (!saved) return null;
  const review = snapshot.provisionalReview!;
  return renderProvisionalCropDocument({ ...saved.request, profileId: saved.profile.profileId, asOf: review.context.asOf,
    measuredAreaM2: snapshot.measuredAreaM2, fieldEntryDate: snapshot.fieldEntryDate },
    { bedLabel: metadata.bedLabel, sample: metadata.sample }, { acceptedAt: attachment.acceptedAt,
      originalSavedAt: saved.origin.savedAt, originalAsOf: saved.request.asOf, reviewedAt: review.context.reviewedAt });
}
export function provisionalEvidenceTierText(tier: string | null): string {
  return tier === 'historical-public-reference' ? 'Historical public reference (explicit transfer)' : tier ?? 'Unknown';
}
/** Only untouched absence can use a short row. In particular, clearing a value
 * or rejecting its evidence is a grower decision, not absence of evidence. */
export function provisionalFieldCanUseMissingRow(key: string, field: ResolvedProvisionalField, request: ProvisionalDraftRequest): boolean {
  const keys = ['status', 'activeInput', 'activeTier', 'baselineDefault', 'defaultCandidateIds', 'defaultConflict',
    'defaultOptions', 'sourceReferences', 'sourceBindings', 'defaultReportedRange', 'defaultPlanningValueBasis', 'assumptions'];
  return Object.keys(field).every(name => keys.includes(name))
    && field.status === 'missing' && field.activeInput.state === 'missing' && field.activeInput.reason === 'not-known'
    && Object.keys(field.activeInput).every(name => name === 'state' || name === 'reason')
    && field.activeTier === null && field.baselineDefault === null && field.defaultConflict === false
    && field.defaultCandidateIds.length === 0 && field.defaultOptions.length === 0
    && field.sourceReferences.length === 0 && field.sourceBindings.length === 0 && field.assumptions.length === 0
    && field.defaultReportedRange === null && field.defaultPlanningValueBasis === null
    && !Object.prototype.hasOwnProperty.call(request.overrides ?? {}, key)
    && !request.candidates.some(candidate => !candidate || !provisionalLabels[candidate.field] || candidate.field === key);
}
function renderProvisionalCropDocument(request: ProvisionalDraftRequest, metadata: { bedLabel: string; sample: boolean; placeLabel?: string }, record?: AcceptedRecordMetadata): { html: string; fingerprint: string } | null {
  const result = resolveProvisionalCropPlan(request);
  if (result.status !== 'resolved') return null;
  const assessment = result.assessment;
  const snapshot = assessment.snapshot;
  if (!snapshot) return null;
  const crop = CROPS.find(row => row.key === result.profile.cropKey);
  if (!crop) return null;
  const value = (item: { value: unknown; status: string }, unit = '') =>
    `${item.value === null ? 'Unknown' : `${item.value}${unit}`} (${item.status})`;
  const nurseryQualifier = saskatchewanNurseryResultQualifier(result.fields);
  const output = [
    ...(request.countBasis ? [['Budgeted whole stations', value(assessment.budgetedStations)]] : []),
    ['Estimated plants', value(assessment.estimatedPlantCount)],
    ['Estimated harvest weight', value({ ...assessment.estimatedYieldKg, value: assessment.estimatedYieldKg.value === null ? null : formatDerivedMassKilograms(assessment.estimatedYieldKg.value, 'kg') }, ' kg')],
    ...Object.entries(assessment.schedule).map(([key, item]) => [`${provisionalLabels[key]} (UTC)`, value(item)]),
  ];
  const evidenceParts: string[] = [], missingRows: string[] = [];
  const flushMissingRows = () => {
    if (!missingRows.length) return;
    evidenceParts.push(`<table class="missing-evidence"><caption>Inputs with no evidence or grower edits</caption>
      <thead><tr><th>Input</th><th>Status</th><th>Active input</th><th>Active basis</th><th>Evidence default</th></tr></thead>
      <tbody>${missingRows.join('')}</tbody></table>`);
    missingRows.length = 0;
  };
  for (const [key, field] of Object.entries(result.fields)) {
    if (provisionalFieldCanUseMissingRow(key, field, request)) {
      missingRows.push(`<tr><th scope="row">${escape(provisionalLabels[key])}</th><td>${escape(field.status)}</td>
        <td>${escape(provisionalInputText(field.activeInput))}</td><td>${escape(provisionalEvidenceTierText(field.activeTier))}</td>
        <td>${escape(provisionalInputText(field.baselineDefault))}</td></tr>`);
      continue;
    }
    flushMissingRows();
    evidenceParts.push(`<section class="field">
    <h3>${escape(provisionalLabels[key])}</h3>
    ${paragraph('Status', field.status)}
    ${paragraph('Active input', provisionalInputText(field.activeInput))}
    ${paragraph('Active basis', provisionalEvidenceTierText(field.activeTier))}
    ${field.activeInput.state === 'provided' ? paragraph('Input provenance', provenanceText(field.activeInput.provenance)) : ''}
    ${paragraph('Evidence default', provisionalInputText(field.baselineDefault))}
    ${field.defaultEntryMonthCoverage === 'positive-only' ? '<p>Source default reports positive months only; other months are unknown. A grower override replaces the active window, not this source record.</p>' : ''}
    ${field.status === 'overridden' && field.activeInput.state === 'missing' && !(request.countBasis && key === 'plantsPerM2') ? '<p>Grower withheld this value. Its evidence default remains visible but is not used.</p>' : ''}
    ${field.defaultConflict ? '<p><strong>Conflicting defaults remain unresolved. No average was invented.</strong></p>' : ''}
    ${field.status === 'invalid-override' ? '<p><strong>Invalid override: its default has not been substituted.</strong></p>' : ''}
    ${field.defaultOptions.map(option => paragraph(`Default ${option.candidateId}`,
      `${provisionalInputText(option.input)}${option.reportedRange ? `; reported range ${option.reportedRange.join('–')}` : ''}; applies to ${provisionalScopeText(option.scope)}`)).join('')}
    ${field.defaultPlanningValueBasis ? paragraph('Default planning value', field.defaultPlanningValueBasis) : ''}
    ${field.sourceBindings.map(source => `<div class="source">${paragraph('Source', `${source.title} (${source.id})`)}
      ${paragraph('URL', source.url)}${paragraph('Published', sourcePublicationText(source))}${paragraph('Accessed', source.accessedOn)}
      ${paragraph('Review due', source.reviewDueOn)}${paragraph('Reuse terms', source.reuseTerms)}
      ${paragraph('Attribution', source.attribution)}${paragraph('Source limitations', source.limitations)}${paragraph('Evidence state', source.evidenceState)}</div>`).join('')}
    ${field.assumptions.map(item => paragraph('Assumption', item)).join('')}
  </section>`);
  }
  flushMissingRows();
  const evidence = evidenceParts.join('');
  // Do not embed raw fingerprints: they contain account/site scope and serialized
  // source objects. Saved-source revisions can also be serialized raw designs.
  // Neither revision nor fingerprint belongs in the human document.
  return { fingerprint: result.fingerprint, html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>ImbewuField ${record ? 'saved provisional cycle record' : 'provisional crop preview'}</title><style>
body{font:16px/1.5 system-ui,sans-serif;color:#17251b;background:#fff;max-width:850px;margin:0 auto;padding:24px;overflow-wrap:anywhere}
h1{font-size:1.8rem}h2{margin-top:2rem}h3{margin:.3rem 0}p{margin:.5rem 0}.notice{border:2px solid #516546;padding:12px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #b5c1b6}
.field{border-top:1px solid #b5c1b6;padding:14px 0}.source{border-left:3px solid #b5c1b6;padding-left:12px;margin:12px 0}
caption{text-align:left;font-weight:bold;margin:12px 0 6px}.missing-evidence td{white-space:nowrap}
@media print{body{padding:0;font-size:10pt}h1,h2,h3,caption{break-after:avoid}tr,.field,.notice{break-inside:avoid}.temperature{break-inside:auto}.temperature p{break-inside:avoid}.evidence-appendix .field{break-inside:auto}.evidence-appendix p{break-inside:avoid;orphans:3;widows:3}@page{margin:16mm}}
</style></head><body><h1>${metadata.sample ? 'DEMO · ' : ''}${record ? 'Saved provisional cycle record' : 'Provisional crop preview'}</h1>
<div class="notice">${metadata.sample ? '<p><strong>DEMO: sample inputs, not a real farm plan.</strong></p>' : ''}
<p><strong>${record ? 'Historical estimates as accepted. Planned, not observed crops or harvest.' : 'Conditional planning estimates. Not a saved or adopted crop plan.'}</strong></p>
<p>Missing values stay unknown. Suitability and plant legality are not established. Density is not layout clearance.
Source metadata does not verify farming accuracy. These inputs may change after download; recalculate before acting.</p></div>
${record ? `${paragraph('Accepted at (UTC)', record.acceptedAt)}${paragraph('Original profile saved at (UTC)', record.originalSavedAt)}${paragraph('Original evidence as of (UTC)', record.originalAsOf)}${paragraph('New review at (UTC)', record.reviewedAt)}` : ''}
${paragraph(record ? 'Original input record at (UTC)' : 'Calculated at (UTC)', request.recordedAt)}${paragraph(record ? 'Evidence rechecked as of (UTC)' : 'Evidence checked as of (UTC)', request.asOf)}
${record ? '' : paragraph('Site or workspace', metadata.placeLabel)}
${paragraph('Crop', crop.name)}${paragraph('Measured bed', metadata.bedLabel)}
${paragraph('Country', request.context.countryCode)}${paragraph('Agricultural region', request.context.agriculturalRegionReference)}
${paragraph('Water regime', request.context.waterRegime)}${paragraph('Variety reference', request.context.varietyReference)}
${paragraph('Requested establishment', result.requestedEstablishment)}${paragraph('Active establishment', result.activeEstablishment)}
${paragraph('Measured area', provisionalInputText(snapshot.measuredAreaM2))}
${paragraph('Field-entry date (UTC)', provisionalInputText(snapshot.fieldEntryDate))}
${snapshot.measuredAreaM2.state === 'provided' ? paragraph('Saved measurement source', `${snapshot.measuredAreaM2.provenance.kind}${'reference' in snapshot.measuredAreaM2.provenance ? `; reference ${snapshot.measuredAreaM2.provenance.reference}` : ''}`) : ''}
${snapshot.measuredAreaM2.state === 'provided' ? `${paragraph('Saved measurement read at (UTC)', record?.reviewedAt ?? request.recordedAt)}
<p>This is when the saved design was read, not when the measurement was made.</p>` : ''}
${snapshot.measuredAreaM2.arithmeticBasis ? paragraph('Saved rectangle arithmetic', `${snapshot.measuredAreaM2.arithmeticBasis.widthM} m × ${snapshot.measuredAreaM2.arithmeticBasis.heightM} m`) : ''}
${paragraph('Count arithmetic', result.profile.plantCountOrigin?.conversion ?? snapshot.countArithmetic)}
${request.countBasis ? `<section class="field"><h2>Conditional spacing-cell estimate</h2>
${paragraph('Selection status', result.spacingSelection?.status)}${paragraph('Selection information', result.spacingSelection?.issue)}
${paragraph('Source spacing range', regionalSpacingReference(request.context.countryCode, request.cropKey, request.context.agriculturalRegionReference, request.countBasis)?.display)}
${paragraph('Chosen row spacing (cm)', request.countBasis.rowCm || 'Unknown')}
${paragraph('Chosen in-row spacing (cm)', request.countBasis.inRowCm || 'Unknown')}
${paragraph('Final surviving plants per station', request.countBasis.finalStand || 'Unknown')}
${paragraph('Source between-plants distance interpreted as station spacing', request.countBasis.interpretationConfirmed ? 'Declared by grower' : 'Not declared')}
${paragraph('Whole measured bed treated as usable spacing-cell area', request.countBasis.wholeAreaConfirmed ? 'Declared by grower' : 'Not declared')}
<p>Formula: floor(area in m² × 10000 / (row cm × in-row cm)) gives whole budgeted stations; multiply those whole stations by declared final survivors. Original decimal choices are retained. This is a conditional grower estimate, not a sourced density or physical layout clearance. The source’s seeds per hill and planting-cell footnotes do not supply final stand. Entered/default density is not used.</p></section>` : ''}

<h2>Supported results</h2>${paragraph('Entry window', provisionalEntryWindowText(assessment.entryWindow))}
${canadaCabbageResultQualifier(result.fields) ? paragraph('Canadian source conditions', canadaCabbageResultQualifier(result.fields)) : ''}
${result.profile.version === 2 ? '<p>Source reports these months; other months remain unknown. Date offsets are conditional calculations, not planting recommendations. Specify your own field-entry window before automatic planning or adoption.</p>' : ''}
<p>An unknown window does not establish that planting on this date is suitable.</p>
<table><thead><tr><th>Output</th><th>Value and status</th></tr></thead><tbody>
${output.map(([label, text]) => label === `${provisionalLabels.nurseryStartDate} (UTC)` && nurseryQualifier
  ? `<tr class="nursery-reference"><td colspan="2"><p><strong>${escape(label)}:</strong> ${escape(text)}</p><p><strong>Nursery source conditions:</strong> ${escape(nurseryQualifier)}</p></td></tr>`
  : `<tr><th scope="row">${escape(label)}</th><td>${escape(text)}</td></tr>`).join('')}</tbody></table>
${paragraph('Uncertainties', assessment.uncertainties.length ? assessment.uncertainties.join(', ') : 'No additional resolver flags; provisional limits still apply')}
${result.temperatureComparison ? `<section class="field temperature"><h2>Historical temperature comparison</h2>${provisionalTemperatureLines(result.temperatureComparison).map(line => `<p>${escape(line)}</p>`).join('')}</section>` : ''}
<section class="evidence-appendix"><h2>Evidence and grower edits</h2>${evidence}</section>
${result.rejected.length ? `<h2>Evidence not used</h2>${result.rejected.map(item => paragraph(item.id, item.reason)).join('')}` : ''}
<p>${record ? 'Historical saved record. It does not verify current source applicability, current planting suitability or completed work. Check current site and evidence before acting.' : 'Downloaded for review. Downloading this preview does not save a profile or add crops.'} This file does not update when the app changes.</p>
</body></html>` };
}

/** Public member-specific evidence. No actor, source revision/hash, private
 * profile/bed identity, policy fingerprint or raw request is exported. */
export interface ProvisionalCycleEvidenceView {
  readonly version: 1;
  readonly originalAsOf: string;
  readonly originalSavedAt: string;
  readonly reviewedAsOf: string;
  readonly reviewedAt: string;
  readonly countryCode: string | null;
  readonly agriculturalRegionReference: string | null;
  readonly lines: readonly string[];
}
export function buildProvisionalCycleEvidence(snapshot: GrowerPlanningSnapshot): ProvisionalCycleEvidenceView | null {
  try {
    if (!snapshot.provisionalReview) return null;
    const assessment = assessGrowerPlanning({ profile: snapshot.profile, scope: snapshot.scope,
      measuredAreaM2: snapshot.measuredAreaM2, fieldEntryDate: snapshot.fieldEntryDate,
      countAreaBinding: snapshot.countAreaBinding, provisionalContext: snapshot.provisionalReview.context });
    if (assessment.status !== 'ready' || assessment.fingerprint !== JSON.stringify(snapshot)) return null;
    const saved = readSavedProvisionalProfile(snapshot.profile);
    const current = reviewProvisionalCycleProfile(snapshot.profile, snapshot.provisionalReview.context,
      snapshot.measuredAreaM2, snapshot.fieldEntryDate, snapshot.countAreaBinding);
    if (!saved || current.status !== 'ready') return null;
    const context = current.context, original = saved.request;
    const lines = [
      'Conditional grower estimates. Source metadata does not establish agricultural accuracy, plant legality or local suitability.',
      `Original evidence as of (UTC): ${original.asOf}. Profile saved: ${saved.origin.savedAt}.`,
      `New evidence review as of (UTC): ${context.asOf}; reviewed ${context.reviewedAt}. Original source dates have not been renewed.`,
      `Country: ${context.countryCode ?? 'Unknown'}. Agricultural region: ${context.agriculturalRegionReference ?? 'Unknown'}.`,
      `Water regime: ${original.context.waterRegime ?? 'Unknown'}. Variety: ${original.context.varietyReference ?? 'Unknown'}.`,
      `Saved design read: ${context.sourceFreshness === 'cloud-query-copy' ? 'Fetched cloud copy; not a remote write lock' : 'Device saved copy'}; not a new field measurement.`,
      `Measured area used: ${assessment.capacity.measuredAreaM2} m². Estimated plants: ${assessment.capacity.estimatedPlantCount}${assessment.capacity.budgetedStations !== undefined ? `; whole budgeted stations: ${assessment.capacity.budgetedStations}` : ''}. Gross estimated harvest: ${formatDerivedMassKilograms(assessment.capacity.estimatedYieldKg, 'kg')} kg for the whole cycle, not weekly deliveries.`,
      `Planned field entry: ${assessment.schedule.fieldEntryDate}; first harvest: ${assessment.schedule.firstHarvestDate}; picking ends before ${assessment.schedule.harvestEndExclusiveDate}; next field entry ${assessment.schedule.nextFieldEntryDate} (UTC). These are estimates, not observed work or guaranteed harvest.`,
      ...(snapshot.measuredAreaM2.arithmeticBasis ? [`Saved rectangle: ${snapshot.measuredAreaM2.arithmeticBasis.widthM} m × ${snapshot.measuredAreaM2.arithmeticBasis.heightM} m. This is the recorded area basis, not a new measurement or physical row-layout check.`] : []),
    ];
    const spacing = snapshot.profile.plantCountOrigin;
    if (spacing) lines.push(`Chosen spacing: row ${spacing.rowCm} cm; in-row ${spacing.inRowCm} cm. Final surviving plants per station: ${spacing.finalStand ?? 'Unknown'}. Whole measured area and station interpretation declared by grower; not physical layout clearance.`,
      'Whole stations are floored before multiplying by final surviving plants. Source seed counts do not establish final stand.');
    const nurseryQualifier = saskatchewanNurseryResultQualifier(current.result.fields);
    if (nurseryQualifier) lines.push(`Nursery start (UTC): ${assessment.schedule.nurseryStartDate ?? 'Unknown'}.`, nurseryQualifier);
    const canadaQualifier = canadaCabbageResultQualifier(current.result.fields);
    if (canadaQualifier) lines.push(canadaQualifier);
    if (current.result.temperatureComparison) lines.push(...provisionalTemperatureLines(current.result.temperatureComparison));
    for (const [key, field] of Object.entries(current.result.fields)) {
      const label = provisionalLabels[key];
      lines.push(`${label}: ${provisionalInputText(field.activeInput)}; ${field.status}; basis ${provisionalEvidenceTierText(field.activeTier)}. Evidence default: ${provisionalInputText(field.baselineDefault)}.`);
      if (field.activeInput.state === 'provided') lines.push(`${label} input provenance: ${field.activeInput.provenance.kind}; recorded ${field.activeInput.provenance.recordedAt}.`);
      if (field.defaultConflict) lines.push(`${label}: conflicting defaults; no average supplied.`);
      for (const option of field.defaultOptions) lines.push(`${label} default option: ${provisionalInputText(option.input)}${option.reportedRange ? `; reported range ${option.reportedRange.join('–')}` : ''}; applies to ${provisionalScopeText(option.scope)}.`);
      for (const source of field.sourceBindings) lines.push(`${label} source: ${source.title}; ${source.url}. Published ${sourcePublicationText(source)}; accessed ${source.accessedOn ?? 'Unknown'}; review due ${source.reviewDueOn ?? 'Unknown'}; evidence state ${source.evidenceState}. Reuse: ${source.reuseTerms}. Attribution: ${source.attribution}. Limitations: ${source.limitations}.`);
      for (const assumption of field.assumptions) lines.push(`${label} assumption: ${assumption}`);
    }
    for (const rejected of current.result.rejected) {
      const candidate = original.candidates.find(row => row.id === rejected.id);
      lines.push(`Evidence not used for ${candidate ? provisionalLabels[candidate.field] : 'an input'}: ${candidate?.source?.title ?? 'entered estimate'}; ${rejected.reason.replace(/-/g, ' ')}.`);
    }
    for (const uncertainty of current.result.assessment.uncertainties) lines.push(`Uncertainty: ${uncertainty.replace(/-/g, ' ')}.`);
    return Object.freeze({ version: 1, originalAsOf: original.asOf, originalSavedAt: saved.origin.savedAt,
      reviewedAsOf: context.asOf, reviewedAt: context.reviewedAt, countryCode: context.countryCode,
      agriculturalRegionReference: context.agriculturalRegionReference, lines: Object.freeze(lines) });
  } catch { return null; }
}
