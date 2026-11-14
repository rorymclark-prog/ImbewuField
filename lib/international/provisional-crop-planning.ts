import { isCanadaCabbageFactCandidate, canadaCabbageFactReuse } from './providers/aafc-canada-cabbage';
import { isSaskatchewanNurseryFactCandidate, saskatchewanNurseryFactReuse } from './providers/usask-saskatchewan-cabbage';
import { normaliseGrowerSpacingSelectionReceipt, type GrowerSpacingSelectionReceipt } from '../grower-estimate-units';
import { regionalSpacingReference, type RegionalSpacingConditions } from './providers/regional-spacing-reference';
import { USDA_GREAT_LAKES_CABBAGE_SOURCE } from './providers/usda-great-lakes-cabbage';
import { sourceEvidenceState, sourcePublicationIsKnownBy } from './countries/readiness';
import type { CountrySource } from './countries/types';
import { assessProvisionalTemperature, type ProvisionalTemperatureInput } from './provisional-temperature';
import {
  assessProvisionalGrowerPlanning, growerPlanningScopeKey, growerCountAreaBasisKey, normaliseGrowerMeasuredAreaInput, isGrowerRecordedAt, isGrowerUtcDate,
  normaliseGrowerInput, normaliseGrowerPlanningProfile, normaliseGrowerPlanningScope,
  type GrowerPlanningInputs, type GrowerPlanningProfile, type GrowerPlanningScope,
} from './grower-planning';

export type ProvisionalEvidenceTier = 'local-public-evidence' | 'historical-public-reference' | 'climate-crop-derived' | 'grower-estimate';
type Field = keyof GrowerPlanningInputs;
type Input = GrowerPlanningInputs[Field];

export interface ProvisionalEvidenceContext {
  readonly scope: GrowerPlanningScope;
  readonly countryCode: string | null;
  readonly agriculturalRegionReference: string | null;
  readonly establishment: 'direct' | 'transplant' | null;
  readonly waterRegime: 'rain-fed' | 'irrigated' | null;
  readonly varietyReference?: string | null;
}

export interface ProvisionalFieldCandidate {
  readonly id: string;
  readonly field: Field;
  readonly input: unknown;
  readonly tier: ProvisionalEvidenceTier;
  readonly cropKey: string;
  readonly geography:
    | { readonly kind: 'country'; readonly countryCode: string }
    | { readonly kind: 'region'; readonly countryCode: string; readonly regionReference: string }
    | { readonly kind: 'site'; readonly siteId: string }
    | { readonly kind: 'explicit-transfer'; readonly assumption: string };
  readonly establishment: 'direct' | 'transplant' | 'any';
  readonly waterRegime: 'rain-fed' | 'irrigated' | 'any';
  readonly varietyReference?: string;
  readonly temporalScope:
    | { readonly kind: 'recurring-season' }
    | { readonly kind: 'dated'; readonly fromDate: string; readonly throughDate: string }
    | { readonly kind: 'historical-transfer'; readonly period: string; readonly assumption: string };
  readonly source?: CountrySource;
  readonly reuseReview?: 'reviewed' | 'not-reviewed';
  /** An exclusion-only heat/moisture pass is not a positive planting-window source. */
  readonly positiveWindowEvidence?: boolean;
  /** Listed months support a conditional reference; omitted months are unknown. */
  readonly entryMonthCoverage?: 'positive-only';
  readonly reportedRange?: readonly [number, number];
  readonly planningValueBasis?: 'reported-point' | 'lower-bound' | 'upper-bound';
  readonly assumptions: readonly string[];
}

export interface ResolvedProvisionalField {
  readonly status: 'selected' | 'overridden' | 'missing' | 'conflict' | 'invalid-override';
  readonly activeInput: Input;
  readonly activeTier: ProvisionalEvidenceTier | null;
  readonly baselineDefault: Input | null;
  readonly defaultCandidateIds: readonly string[];
  readonly defaultConflict: boolean;
  readonly defaultOptions: readonly {
    candidateId: string; input: Input; reportedRange: readonly [number, number] | null;
    scope: {
      cropKey: string; geography: ProvisionalFieldCandidate['geography']; temporalScope: ProvisionalFieldCandidate['temporalScope'];
      establishment: ProvisionalFieldCandidate['establishment']; waterRegime: ProvisionalFieldCandidate['waterRegime'];
      varietyReference: string | null;
      entryMonthCoverage?: 'positive-only';
    };
  }[];
  readonly sourceReferences: readonly string[];
  readonly sourceBindings: readonly {
    id: string; title: string; url: string; accessedOn: string | null;
    publishedOn: string | null; publishedMonth: string | null; publishedYear?: number | null; reviewDueOn: string | null; reuseTerms: string;
    attribution: string; limitations: string;
    evidenceState: ReturnType<typeof sourceEvidenceState>;
  }[];
  readonly defaultReportedRange: readonly [number, number] | null;
  readonly defaultPlanningValueBasis: ProvisionalFieldCandidate['planningValueBasis'] | null;
  readonly assumptions: readonly string[];
  readonly defaultEntryMonthCoverage?: 'positive-only';
}

export interface ProvisionalSpacingCountBasis extends RegionalSpacingConditions {
  readonly kind: 'spacing-cell-budget-v1';
  readonly bedId: string;
  readonly rowCm: string;
  readonly inRowCm: string;
  readonly finalStand: string;
  readonly interpretationConfirmed: boolean;
  readonly wholeAreaConfirmed: boolean;
}

export interface ProvisionalDraftRequest {
  readonly profileId: string;
  readonly cropKey: string;
  readonly context: ProvisionalEvidenceContext;
  readonly recordedAt: string;
  readonly asOf: string;
  readonly candidates: readonly ProvisionalFieldCandidate[];
  readonly overrides?: Readonly<Partial<Record<Field, unknown>>>;
  readonly measuredAreaM2: unknown;
  readonly fieldEntryDate: unknown;
  readonly knownPlantingRestriction?: boolean;
  readonly countBasis?: ProvisionalSpacingCountBasis;
  readonly temperatureComparison?: ProvisionalTemperatureInput;
}

const fields: readonly Field[] = ['establishment', 'plantsPerM2', 'yieldKgPerM2', 'nurseryDays',
  'fieldEntryToFirstHarvestDays', 'pickingDays', 'fieldOccupancyDays', 'turnaroundDays', 'allowedEntryMonths'];
const unknown = () => ({ state: 'missing', reason: 'not-known' }) as const;
const ranks: Record<ProvisionalEvidenceTier, number> = { 'local-public-evidence': 0, 'historical-public-reference': 1, 'climate-crop-derived': 2, 'grower-estimate': 3 };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  && value.length <= 2000 && !/[\u0000-\u001f\u007f]/.test(value);

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** This resolves a NEW draft from an owner-reviewed evidence capsule. It neither
 * verifies arbitrary URLs nor replaces saved profiles, actor checks or write admission. */
export function resolveProvisionalCropPlan(request: ProvisionalDraftRequest) {
  const scope = normaliseGrowerPlanningScope(request.context?.scope);
  const context = request.context;
  const reviewedReuse = (candidate: ProvisionalFieldCandidate): string | null => isCanadaCabbageFactCandidate(candidate)
    ? canadaCabbageFactReuse(candidate, context, request.recordedAt)
    : isSaskatchewanNurseryFactCandidate(candidate) ? saskatchewanNurseryFactReuse(candidate, context, request.recordedAt)
    : candidate.source?.licence?.status === 'known' && text(candidate.source.licence.value) ? candidate.source.licence.value : null;
  const emptyInputs = Object.fromEntries(fields.map(field => [field, unknown()]));
  const makeProfile = (inputs: Record<string, unknown>, plantCountOrigin?: GrowerSpacingSelectionReceipt, positiveMonths = false) => normaliseGrowerPlanningProfile({
    version: positiveMonths ? 2 : 1, profileId: request.profileId, cropKey: request.cropKey, scope, inputs, ...(plantCountOrigin ? { plantCountOrigin } : {}),
    ...(positiveMonths ? { entryMonthCoverage: 'positive-only' } : {}),
  });
  const base = makeProfile(emptyInputs);
  const entryDate = normaliseGrowerInput(request.fieldEntryDate, 'utc-date', isGrowerUtcDate);
  const countryValid = context?.countryCode === null || (typeof context?.countryCode === 'string'
    && /^(?:[A-Z]{2}|OTHER)$/.test(context.countryCode));
  if (!scope || !base || !countryValid || !isGrowerRecordedAt(request.recordedAt) || !isGrowerUtcDate(request.asOf)
    || !(context.agriculturalRegionReference === null || text(context.agriculturalRegionReference))
    || ![null, 'direct', 'transplant'].includes(context.establishment)
    || ![null, 'rain-fed', 'irrigated'].includes(context.waterRegime)
    || !(context.varietyReference === undefined || context.varietyReference === null || text(context.varietyReference))
    || (request.knownPlantingRestriction !== undefined && typeof request.knownPlantingRestriction !== 'boolean')
    || !Array.isArray(request.candidates) || Array.from(request.candidates).some(candidate => !record(candidate)
      || typeof candidate.field !== 'string' || !fields.includes(candidate.field as Field))
    || (request.overrides !== undefined && (!record(request.overrides) || Object.keys(request.overrides).some(field => !fields.includes(field as Field))))) {
    return freeze({ status: 'invalid-context' as const, profile: null, fields: null, assessment: null, fingerprint: null });
  }
  if (request.knownPlantingRestriction === true) return freeze({ status: 'restricted' as const,
    profile: null, fields: null, assessment: null, fingerprint: null });

  const normaliseField = (field: Field, value: unknown) => makeProfile({ ...emptyInputs, [field]: value })?.inputs[field] ?? null;
  const rejected: Array<{ id: string; reason: string }> = [];
  const resolved = {} as Record<Field, ResolvedProvisionalField>;
  const inputs: Record<string, unknown> = { ...emptyInputs };
  const candidates: readonly ProvisionalFieldCandidate[] = request.candidates;
  let establishment = context.establishment;
  let positiveMonths = false;
  const ids = new Map<string, number>();
  for (const candidate of candidates) if (text(candidate?.id)) ids.set(candidate.id, (ids.get(candidate.id) ?? 0) + 1);

  for (const field of fields) {
    const accepted: Array<{ candidate: ProvisionalFieldCandidate; input: Input }> = [];
    for (const candidate of candidates) {
      if (!record(candidate) || candidate.field !== field) continue;
      const reject = (reason: string) => rejected.push({ id: text(candidate.id) ? candidate.id : 'invalid-id', reason });
      if (!text(candidate.id) || ids.get(candidate.id) !== 1 || !Object.prototype.hasOwnProperty.call(ranks, candidate.tier)
        || candidate.cropKey !== request.cropKey || !record(candidate.geography)
        || !record(candidate.temporalScope)
        || !Array.isArray(candidate.assumptions) || !Array.from(candidate.assumptions).every(text)
        || (candidate.planningValueBasis !== undefined && !['reported-point', 'lower-bound', 'upper-bound'].includes(candidate.planningValueBasis))
        || !['any', 'direct', 'transplant'].includes(candidate.establishment)
        || !['any', 'rain-fed', 'irrigated'].includes(candidate.waterRegime)) { reject('invalid-candidate'); continue; }
      const geography = candidate.geography;
      // OTHER is the navigation placeholder for unlisted/invalid countries, not
      // a shared jurisdiction. Matching two OTHER values could transfer one
      // country's local evidence to an unrelated unnamed country.
      const namedCountry = context.countryCode !== null && context.countryCode !== 'OTHER';
      const geographicMatch = geography.kind === 'country' ? namedCountry && geography.countryCode === context.countryCode
        : geography.kind === 'region' ? namedCountry && geography.countryCode === context.countryCode && text(geography.regionReference)
          && geography.regionReference === context.agriculturalRegionReference
          : geography.kind === 'site' ? scope.kind === 'mapped-site' && geography.siteId === scope.siteId
            : geography.kind === 'explicit-transfer' && text(geography.assumption) && candidate.tier !== 'local-public-evidence';
      if (!geographicMatch || (field !== 'establishment' && candidate.establishment !== 'any' && candidate.establishment !== establishment)
        || (candidate.waterRegime !== 'any' && candidate.waterRegime !== context.waterRegime)
        || (candidate.varietyReference !== undefined && (!text(candidate.varietyReference)
          || candidate.varietyReference !== context.varietyReference))) { reject('scope-mismatch'); continue; }
      const temporal = candidate.temporalScope;
      if (candidate.tier === 'historical-public-reference' && temporal.kind !== 'historical-transfer') { reject('historical-transfer-unjustified'); continue; }
      if (temporal.kind === 'dated') {
        if (!isGrowerUtcDate(temporal.fromDate) || !isGrowerUtcDate(temporal.throughDate)
          || temporal.fromDate > temporal.throughDate || entryDate?.state !== 'provided'
          || entryDate.value < temporal.fromDate || entryDate.value > temporal.throughDate) { reject('time-scope-mismatch'); continue; }
      } else if (temporal.kind === 'historical-transfer') {
        if (!text(temporal.period) || !text(temporal.assumption) || candidate.tier === 'local-public-evidence') {
          reject('historical-transfer-unjustified'); continue;
        }
      } else if (temporal.kind !== 'recurring-season') { reject('invalid-time-scope'); continue; }
      const value = normaliseField(field, candidate.input);
      if (!value || value.state !== 'provided') { reject('invalid-value'); continue; }
      const coverage = Object.getOwnPropertyDescriptor(candidate, 'entryMonthCoverage');
      if ('entryMonthCoverage' in candidate && (!coverage?.enumerable || !('value' in coverage) || coverage.value !== 'positive-only'
        || field !== 'allowedEntryMonths' || candidate.tier === 'grower-estimate'
        || candidate.positiveWindowEvidence !== true || value.provenance.kind !== 'external-reference'
        || !Array.isArray(value.value) || !value.value.length)) {
        reject('invalid-entry-month-coverage'); continue;
      }
      if (field === 'establishment') {
        // Applicability metadata cannot contradict the capsule's own method.
        if (candidate.establishment !== 'any' && candidate.establishment !== value.value) {
          reject('contradictory-method-candidate'); continue;
        }
        // An automatic default must respect an explicit requested method. A
        // grower can still change it through the separate override below; later
        // fields are then matched against that deliberately edited method.
        if (context.establishment !== null && context.establishment !== value.value) {
          reject('requested-method-mismatch'); continue;
        }
      }
      if (candidate.reportedRange !== undefined) {
        const range = candidate.reportedRange;
        if (!Array.isArray(range) || range.length !== 2 || ![range[0], range[1]].every(number => typeof number === 'number' && Number.isFinite(number) && number >= 0)
          || range[0] > range[1] || typeof value.value !== 'number' || value.value < range[0] || value.value > range[1]
          || !['reported-point', 'lower-bound', 'upper-bound'].includes(candidate.planningValueBasis ?? '')
          || (candidate.planningValueBasis === 'lower-bound' && value.value !== range[0])
          || (candidate.planningValueBasis === 'upper-bound' && value.value !== range[1])) { reject('range-or-selection-mismatch'); continue; }
      }
      if (candidate.tier !== 'grower-estimate') {
        const source = candidate.source;
        if (!record(source) || !text(source.id) || !text(source.url) || !text(source.title)
          || candidate.reuseReview !== 'reviewed' || !reviewedReuse(candidate)
          || value.provenance.kind !== 'external-reference' || value.provenance.sourceUrl !== source.url) {
          reject('source-or-reuse-unverified'); continue;
        }
        const state = sourceEvidenceState(source, request.asOf);
        // An undated or historical table may inform a disclosed estimate, but it
        // must not be promoted to current local evidence or receive an invented date.
        const historicalEstimate = (candidate.tier === 'climate-crop-derived' || candidate.tier === 'historical-public-reference') && temporal.kind === 'historical-transfer'
          && candidate.assumptions.length > 0 && source.verification === 'content-read'
          && isGrowerUtcDate(source.accessedOn) && source.accessedOn <= request.asOf
          && ((source.publishedOn === null && (source.publishedMonth === undefined || source.publishedMonth === null) && source.publishedYear == null)
            || sourcePublicationIsKnownBy(source, request.asOf))
          && (source.reviewDueOn === null || isGrowerUtcDate(source.reviewDueOn));
        if (state !== 'available-reference' && !historicalEstimate) { reject('source-or-reuse-unverified'); continue; }
        if (field === 'allowedEntryMonths' && candidate.positiveWindowEvidence !== true) { reject('positive-window-evidence-missing'); continue; }
      } else if (value.provenance.kind !== 'grower-estimate') { reject('estimate-provenance-mismatch'); continue; }
      if ((candidate.tier === 'climate-crop-derived' || candidate.tier === 'historical-public-reference') && !candidate.assumptions.length) { reject('transfer-assumption-missing'); continue; }
      accepted.push({ candidate, input: value });
    }
    const rank = accepted.length ? accepted.reduce((rank, value) => Math.min(rank, ranks[value.candidate.tier]), Infinity) : null;
    const best = accepted.filter(value => ranks[value.candidate.tier] === rank)
      .sort((a, b) => a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0);
    // Equal-ranked conflicting values are not resolved by array order or a fabricated average.
    const identities = new Set(best.map(({ input, candidate }) => input.state === 'provided'
      ? JSON.stringify([input.unit, input.value, candidate.reportedRange ?? null, candidate.planningValueBasis ?? null,
        ...(candidate.entryMonthCoverage ? [candidate.entryMonthCoverage] : [])]) : 'missing'));
    const conflict = identities.size > 1;
    const defaultInput = best.length && !conflict ? best[0].input : null;
    let activeInput: Input = defaultInput ?? unknown();
    let status: ResolvedProvisionalField['status'] = conflict ? 'conflict' : defaultInput ? 'selected' : 'missing';
    let activeTier: ProvisionalEvidenceTier | null = defaultInput ? best[0].candidate.tier : null;
    if (Object.prototype.hasOwnProperty.call(request.overrides ?? {}, field)) {
      const raw = request.overrides![field];
      const override = record(raw) ? normaliseField(field, raw.state === 'provided' ? { ...raw,
        provenance: { kind: 'grower-estimate', recordedAt: request.recordedAt, note: 'Grower override; automatic default retained.' } } : raw) : null;
      // An invalid edit must stay visibly invalid, not silently restore the automatic default.
      activeInput = override ?? unknown();
      status = override ? 'overridden' : 'invalid-override';
      activeTier = override ? 'grower-estimate' : null;
    }
    if (field === 'allowedEntryMonths') positiveMonths = status === 'selected' && best[0]?.candidate.entryMonthCoverage === 'positive-only';
    const sourceBindings = best.flatMap(({ candidate }) => {
      const source = candidate.source;
      return candidate.tier !== 'grower-estimate' && source && reviewedReuse(candidate) ? [{
        id: source.id, title: source.title, url: source.url, accessedOn: source.accessedOn,
        publishedOn: source.publishedOn, publishedMonth: source.publishedMonth ?? null, ...(source.publishedYear != null ? { publishedYear: source.publishedYear } : {}),
        reviewDueOn: source.reviewDueOn, reuseTerms: reviewedReuse(candidate)!,
        attribution: source.attribution ?? 'Unknown', limitations: source.limitations ?? 'Unknown',
        evidenceState: sourceEvidenceState(source, request.asOf),
      }] : [];
    });
    const sourceReferences = sourceBindings.map(source => source.url);
    const assumptions = best.flatMap(({ candidate }) => [...candidate.assumptions,
      ...(candidate.geography.kind === 'explicit-transfer' ? [candidate.geography.assumption] : []),
      ...(candidate.temporalScope.kind === 'historical-transfer' ? [candidate.temporalScope.period, candidate.temporalScope.assumption] : [])]);
    resolved[field] = { status, activeInput, activeTier, baselineDefault: defaultInput,
      defaultCandidateIds: best.map(value => value.candidate.id), defaultConflict: conflict,
      defaultOptions: best.map(({ candidate, input }) => ({ candidateId: candidate.id, input,
        reportedRange: candidate.reportedRange ? [...candidate.reportedRange] as [number, number] : null,
        scope: { cropKey: candidate.cropKey,
          geography: candidate.geography.kind === 'country' ? { kind: 'country', countryCode: candidate.geography.countryCode }
            : candidate.geography.kind === 'region' ? { kind: 'region', countryCode: candidate.geography.countryCode, regionReference: candidate.geography.regionReference }
              : candidate.geography.kind === 'site' ? { kind: 'site', siteId: candidate.geography.siteId }
                : { kind: 'explicit-transfer', assumption: candidate.geography.assumption },
          temporalScope: candidate.temporalScope.kind === 'recurring-season' ? { kind: 'recurring-season' }
            : candidate.temporalScope.kind === 'dated' ? { kind: 'dated', fromDate: candidate.temporalScope.fromDate, throughDate: candidate.temporalScope.throughDate }
              : { kind: 'historical-transfer', period: candidate.temporalScope.period, assumption: candidate.temporalScope.assumption },
          establishment: candidate.establishment, waterRegime: candidate.waterRegime, varietyReference: candidate.varietyReference ?? null,
          ...(candidate.entryMonthCoverage ? { entryMonthCoverage: candidate.entryMonthCoverage } : {}) } })),
      sourceReferences: [...new Set(sourceReferences)], sourceBindings,
      defaultReportedRange: defaultInput && best[0].candidate.reportedRange ? [...best[0].candidate.reportedRange] as [number, number] : null,
      defaultPlanningValueBasis: defaultInput ? best[0].candidate.planningValueBasis ?? null : null,
      assumptions: [...new Set(assumptions)],
      ...(defaultInput && best[0].candidate.entryMonthCoverage ? { defaultEntryMonthCoverage: best[0].candidate.entryMonthCoverage } : {}) };
    inputs[field] = activeInput;
    if (field === 'establishment' && activeInput.state === 'provided') {
      establishment = activeInput.value as 'direct' | 'transplant';
    } else if (field === 'establishment' && Object.prototype.hasOwnProperty.call(request.overrides ?? {}, field)) {
      establishment = null;
    }
  }
  let plantCountOrigin: GrowerSpacingSelectionReceipt | undefined;
  let spacingSelection: { status: 'ready' | 'missing-inputs' | 'invalid-inputs'; issue: string } | null = null;
  if (request.countBasis !== undefined) {
    const selection = request.countBasis;
    const keys = ['kind', 'bedId', 'purpose', 'habit', 'rowCm', 'inRowCm', 'finalStand', 'interpretationConfirmed', 'wholeAreaConfirmed'];
    const descriptors: PropertyDescriptorMap = record(selection) ? Object.getOwnPropertyDescriptors(selection) : {};
    if (Reflect.ownKeys(descriptors).length !== keys.length || !keys.every(key => descriptors[key]?.enumerable && 'value' in descriptors[key])
      || selection.kind !== 'spacing-cell-budget-v1' || !text(selection.bedId)
      || ![selection.rowCm, selection.inRowCm, selection.finalStand].every(v => typeof v === 'string' && v.length <= 1024)
      || typeof selection.interpretationConfirmed !== 'boolean' || typeof selection.wholeAreaConfirmed !== 'boolean'
      || !['', 'leaves', 'pods-or-grain', 'cabbage-transplants'].includes(selection.purpose)
      || !['', 'spreading', 'erect-or-semi-erect', 'not-applicable'].includes(selection.habit)) {
      return freeze({ status: 'invalid-context' as const, profile: null, fields: null, assessment: null, fingerprint: null });
    }
    // This explicit method never falls back to a retained manual/default density.
    inputs.plantsPerM2 = unknown();
    resolved.plantsPerM2 = { ...resolved.plantsPerM2, activeInput: unknown(), activeTier: null, status: 'overridden',
      assumptions: [...resolved.plantsPerM2.assumptions, 'Entered/default density is not used by the selected spacing-cell count method.'] };
    const area = normaliseGrowerMeasuredAreaInput(request.measuredAreaM2);
    const reference = regionalSpacingReference(context.countryCode, request.cropKey, context.agriculturalRegionReference, selection);
    // The accepted historical capsule may use this one undated USDA guide. No
    // undated source is promoted to current local-public-evidence.
    const sourceSelected = reference && resolved.establishment.sourceBindings.some(s => s.id === reference.source.id
      && (s.evidenceState === 'available-reference' || (s.id === USDA_GREAT_LAKES_CABBAGE_SOURCE.id
        && s.evidenceState === 'undated' && resolved.establishment.defaultOptions.some(option =>
          option.scope.temporalScope.kind === 'historical-transfer'))));
    if (!area) spacingSelection = { status: 'invalid-inputs', issue: 'The supplied measured area or its rectangle origin is invalid; check saved measurements.' };
    else if (!sourceSelected || !reference || establishment !== reference.establishment)
      spacingSelection = { status: 'missing-inputs', issue: 'An applicable regional source, crop purpose and establishment method must be selected.' };
    else if (!selection.interpretationConfirmed || !selection.wholeAreaConfirmed || !selection.rowCm.trim() || !selection.inRowCm.trim()
      || area.state !== 'provided') spacingSelection = { status: 'missing-inputs', issue: 'Declare spacing, station interpretation and use of the whole current measured bed area.' };
    else {
      const origin = normaliseGrowerSpacingSelectionReceipt({ version: 1, conversion: 'spacing-cells-cm-v1',
        scopeKey: growerPlanningScopeKey(scope), profileId: request.profileId, cropKey: request.cropKey,
        bedId: selection.bedId, areaBasisKey: growerCountAreaBasisKey(area), referenceVersion: reference.version,
        countryCode: context.countryCode, regionReference: context.agriculturalRegionReference, varietyReference: context.varietyReference ?? null,
        purpose: selection.purpose, habit: selection.habit, rowCm: selection.rowCm, inRowCm: selection.inRowCm,
        finalStand: selection.finalStand.trim() ? selection.finalStand : null,
        interpretation: 'source-inrow-interpreted-as-station-spacing', areaUse: 'whole-current-measured-area', recordedAt: request.recordedAt },
      { scopeKey: growerPlanningScopeKey(scope)!, profileId: request.profileId, cropKey: request.cropKey });
      if (origin) { plantCountOrigin = origin; spacingSelection = { status: origin.finalStand === null ? 'missing-inputs' : 'ready',
        issue: origin.finalStand === null ? 'Final surviving plants per station are unknown; seeds or planting-cell footnotes do not supply this value.' : 'Conditional grower estimate using whole spacing cells, not physical layout fit.' }; }
      else spacingSelection = { status: 'invalid-inputs', issue: 'Spacing must lie within the source range and final stand must be a non-negative safe whole number.' };
    }
  }
  const profile = makeProfile(inputs, plantCountOrigin, positiveMonths);
  // Every resolved result promises a valid profile. Do not rely on an erased
  // non-null assertion if a future normalizer change breaks that invariant.
  if (!profile) return freeze({ status: 'invalid-context' as const,
    profile: null, fields: null, assessment: null, fingerprint: null });
  const arithmetic = assessProvisionalGrowerPlanning({ profile, scope, measuredAreaM2: request.measuredAreaM2,
    fieldEntryDate: request.fieldEntryDate, ...(request.countBasis ? { countAreaBinding: { bedId: request.countBasis.bedId } } : {}) });
  const assessment = spacingSelection && !plantCountOrigin ? { ...arithmetic,
    estimatedPlantCount: { status: spacingSelection.status === 'invalid-inputs' ? 'invalid-inputs' as const : 'missing-inputs' as const, value: null, issues: [spacingSelection.issue] },
    budgetedStations: { status: spacingSelection.status === 'invalid-inputs' ? 'invalid-inputs' as const : 'missing-inputs' as const, value: null, issues: [spacingSelection.issue] } } : arithmetic;
  const canonicalContext: ProvisionalEvidenceContext = { scope, countryCode: context.countryCode,
    agriculturalRegionReference: context.agriculturalRegionReference, establishment: context.establishment, waterRegime: context.waterRegime,
    varietyReference: context.varietyReference ?? null };
  const temperatureComparison = Object.hasOwn(request, 'temperatureComparison')
    ? assessProvisionalTemperature(request.temperatureComparison, canonicalContext, request.cropKey,
      entryDate?.state === 'provided' ? entryDate.value : null, request.recordedAt, request.asOf) : undefined;
  const fingerprintParts: unknown[] = [growerPlanningScopeKey(scope), canonicalContext, establishment, request.asOf, resolved, request.countBasis ?? null, spacingSelection,
    [...rejected].sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0), assessment.fingerprint];
  // Absent extensions retain the exact old canonical result and saved replay.
  if (temperatureComparison) fingerprintParts.push(['temperature-comparison-v1', temperatureComparison]);
  return freeze({ status: 'resolved' as const, provisional: true, sourceVerification: 'not-verified' as const,
    densityEstimateNotLayoutClearance: true as const, profile, fields: resolved, assessment, rejected, spacingSelection,
    countryOrRegionApproval: false as const, knownPlantLegalityEstablished: false as const,
    requestedEstablishment: context.establishment, activeEstablishment: establishment,
    ...(temperatureComparison ? { temperatureComparison } : {}),
    fingerprint: JSON.stringify(fingerprintParts) });
}
