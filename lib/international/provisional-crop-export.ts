import { sourcePublicationText } from './countries/readiness';
import type { GrowerInputProvenance } from './grower-planning';
import { formatDerivedMassKilograms } from '../mass-units';
import { CROPS } from '../crop-catalog';
import { resolveProvisionalCropPlan, type ProvisionalDraftRequest, type ResolvedProvisionalField } from './provisional-crop-planning';

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
export function provisionalScopeText(scope: ResolvedProvisionalField['defaultOptions'][number]['scope']) {
  const geography = scope.geography, time = scope.temporalScope;
  const place = geography.kind === 'country' ? geography.countryCode
    : geography.kind === 'region' ? `${geography.countryCode}, region ${geography.regionReference}`
      : geography.kind === 'site' ? 'this saved site' : `transferred evidence: ${geography.assumption}`;
  const period = time.kind === 'recurring-season' ? 'recurring season'
    : time.kind === 'dated' ? `${time.fromDate} through ${time.throughDate}` : `${time.period}; ${time.assumption}`;
  return `${place}; ${period}; establishment ${scope.establishment}; water regime ${scope.waterRegime}${scope.varietyReference ? `; variety ${scope.varietyReference}` : ''}`;
}

const provenanceText = (p: GrowerInputProvenance) => `${p.kind}; recorded ${p.recordedAt}${'reference' in p ? `; reference ${p.reference}` : ''}${'sourceUrl' in p ? `; source ${p.sourceUrl}` : ''}${'note' in p && p.note ? `; note ${p.note}` : ''}`;

const escape = (value: unknown) => String(value ?? 'Unknown').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const paragraph = (label: string, value: unknown) => `<p><strong>${escape(label)}:</strong> ${escape(value)}</p>`;

/** A portable view of the resolver, never another calculator or saved-plan writer.
 * The caller must freshly admit the source and actor at the actual file handoff. */
export function buildProvisionalCropPreviewHtml(request: ProvisionalDraftRequest, metadata: {
  bedLabel: string; sample: boolean;
}): { html: string; fingerprint: string } | null {
  const result = resolveProvisionalCropPlan(request);
  if (result.status !== 'resolved') return null;
  const assessment = result.assessment;
  const snapshot = assessment.snapshot;
  if (!snapshot) return null;
  const crop = CROPS.find(row => row.key === result.profile.cropKey);
  if (!crop) return null;
  const value = (item: { value: unknown; status: string }, unit = '') =>
    `${item.value === null ? 'Unknown' : `${item.value}${unit}`} (${item.status})`;
  const output = [
    ['Estimated plants', value(assessment.estimatedPlantCount)],
    ['Estimated harvest weight', value({ ...assessment.estimatedYieldKg, value: assessment.estimatedYieldKg.value === null ? null : formatDerivedMassKilograms(assessment.estimatedYieldKg.value, 'kg') }, ' kg')],
    ...Object.entries(assessment.schedule).map(([key, item]) => [`${provisionalLabels[key]} (UTC)`, value(item)]),
  ];
  const evidence = Object.entries(result.fields).map(([key, field]) => `<section class="field">
    <h3>${escape(provisionalLabels[key])}</h3>
    ${paragraph('Status', field.status)}
    ${paragraph('Active input', provisionalInputText(field.activeInput))}
    ${paragraph('Active basis', field.activeTier ?? 'Unknown')}
    ${field.activeInput.state === 'provided' ? paragraph('Input provenance', provenanceText(field.activeInput.provenance)) : ''}
    ${paragraph('Evidence default', provisionalInputText(field.baselineDefault))}
    ${field.status === 'overridden' && field.activeInput.state === 'missing' ? '<p>Grower withheld this value. Its evidence default remains visible but is not used.</p>' : ''}
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
  </section>`).join('');
  // Do not embed raw fingerprints: they contain account/site scope and serialized
  // source objects. Saved-source revisions can also be serialized raw designs.
  // Neither revision nor fingerprint belongs in the human document.
  return { fingerprint: result.fingerprint, html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>ImbewuField provisional crop preview</title><style>
body{font:16px/1.5 system-ui,sans-serif;color:#17251b;background:#fff;max-width:850px;margin:0 auto;padding:24px;overflow-wrap:anywhere}
h1{font-size:1.8rem}h2{margin-top:2rem}h3{margin:.3rem 0}p{margin:.5rem 0}.notice{border:2px solid #516546;padding:12px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #b5c1b6}
.field{border-top:1px solid #b5c1b6;padding:14px 0}.source{border-left:3px solid #b5c1b6;padding-left:12px;margin:12px 0}
@media print{body{padding:0;font-size:10pt}h1,h2,h3{break-after:avoid}tr,.field,.notice{break-inside:avoid}@page{margin:16mm}}
</style></head><body><h1>${metadata.sample ? 'DEMO · ' : ''}Provisional crop preview</h1>
<div class="notice">${metadata.sample ? '<p><strong>DEMO: sample inputs, not a real farm plan.</strong></p>' : ''}
<p><strong>Conditional planning estimates. Not a saved or adopted crop plan.</strong></p>
<p>Missing values stay unknown. Suitability and plant legality are not established. Density is not layout clearance.
Source metadata does not verify farming accuracy. These inputs may change after download; recalculate before acting.</p></div>
${paragraph('Calculated at (UTC)', request.recordedAt)}${paragraph('Evidence checked as of (UTC)', request.asOf)}
${paragraph('Crop', crop.name)}${paragraph('Measured bed', metadata.bedLabel)}
${paragraph('Country', request.context.countryCode)}${paragraph('Agricultural region', request.context.agriculturalRegionReference)}
${paragraph('Water regime', request.context.waterRegime)}${paragraph('Variety reference', request.context.varietyReference)}
${paragraph('Requested establishment', result.requestedEstablishment)}${paragraph('Active establishment', result.activeEstablishment)}
${paragraph('Measured area', provisionalInputText(snapshot.measuredAreaM2))}
${paragraph('Field-entry date (UTC)', provisionalInputText(snapshot.fieldEntryDate))}
${snapshot.measuredAreaM2.state === 'provided' ? paragraph('Saved measurement source', `${snapshot.measuredAreaM2.provenance.kind}${'reference' in snapshot.measuredAreaM2.provenance ? `; reference ${snapshot.measuredAreaM2.provenance.reference}` : ''}`) : ''}
${snapshot.measuredAreaM2.state === 'provided' ? `${paragraph('Saved measurement read at (UTC)', request.recordedAt)}
<p>This is when the saved design was read, not when the measurement was made.</p>` : ''}
${snapshot.measuredAreaM2.arithmeticBasis ? paragraph('Saved rectangle arithmetic', `${snapshot.measuredAreaM2.arithmeticBasis.widthM} m × ${snapshot.measuredAreaM2.arithmeticBasis.heightM} m`) : ''}
${paragraph('Count arithmetic', snapshot.countArithmetic)}

<h2>Supported results</h2>${paragraph('Entry window', assessment.entryWindow)}
<p>An unknown window does not establish that planting on this date is suitable.</p>
<table><thead><tr><th>Output</th><th>Value and status</th></tr></thead><tbody>
${output.map(([label, text]) => `<tr><th scope="row">${escape(label)}</th><td>${escape(text)}</td></tr>`).join('')}</tbody></table>
${paragraph('Uncertainties', assessment.uncertainties.length ? assessment.uncertainties.join(', ') : 'No additional resolver flags; provisional limits still apply')}
<h2>Evidence and grower edits</h2>${evidence}
${result.rejected.length ? `<h2>Evidence not used</h2>${result.rejected.map(item => paragraph(item.id, item.reason)).join('')}` : ''}
<p>Downloaded for review. No profile or crop was saved or adopted. This file does not update when the app changes.</p>
</body></html>` };
}
