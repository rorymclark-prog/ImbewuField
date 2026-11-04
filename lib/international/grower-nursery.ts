import { cropByKey } from '../crop-catalog';
import { decimalQuantityProduct } from '../farm-records';
import { sanitiseNurserySettings, type NurserySettings, type NurseryProfile } from '../nursery-settings';
import { nurseryCeilRatio, nurseryPeak as sharedNurseryPeak, type NurseryForecast, type NurseryResourceForecast, type NurseryInterval } from '../crop-export-schedule';
import { generateGrowerAutoPlan, isGrowerAutoPlanCurrent, GROWER_AUTOPLAN_MAX_HORIZON_DAYS, GROWER_AUTOPLAN_MAX_ASSESSMENTS,
  type GrowerAutoPlanProposal, type GrowerAutoPlanRequest, type GrowerUtcWindow, type GrowerWindowInput } from './grower-autoplan';
import { projectGrowerCycles } from './grower-cycle-projection';
import { preserveGrowerCycleMarker, type GrowerCycleContext } from './grower-cycle';
import { growerPlanningScopeKey, isGrowerUtcDate, normaliseGrowerInput, normaliseGrowerPlanningScope,
  type GrowerInput, type GrowerPlanningScope } from './grower-planning';
import { growerWorkflowResourceSiteId, type GrowerWorkflowSource } from './grower-workflow-source';

export type GrowerNurserySource =
  | { readonly kind: 'saved-cycles'; readonly rows: unknown; readonly cycleContext: GrowerCycleContext | null }
  | { readonly kind: 'proposal'; readonly proposal: GrowerAutoPlanProposal; readonly currentRequest: GrowerAutoPlanRequest;
      /** Controller-derived from the fresh whole-book workflow review, never a free-space checkbox. */
      readonly competingDemand?: 'assessed-none' | 'unresolved' };
export interface GrowerNurseryResourceWindow {
  readonly resourceKind: 'container' | 'space';
  readonly resourceId: string;
  readonly scope: GrowerPlanningScope;
  readonly window: GrowerUtcWindow;
  /** Allocated gross capacity before the separately listed other uses. */
  readonly quantity: number;
}
export interface GrowerNurseryReservation extends GrowerNurseryResourceWindow { readonly id: string }
export interface GrowerNurseryRequest {
  readonly source: GrowerNurserySource;
  readonly resourceContext: GrowerWorkflowSource | null;
  readonly settings: unknown;
  /** An explicit reconfirmation of these saved settings, not their original measurement date. */
  readonly settingsReview: GrowerInput<string, 'nursery-settings-fingerprint'>;
  readonly horizon: GrowerWindowInput;
  readonly availability: GrowerInput<readonly GrowerNurseryResourceWindow[], 'nursery-resource-windows'>;
  /** A provided empty list explicitly asserts no other nursery resource uses. */
  readonly otherReservations: GrowerInput<readonly GrowerNurseryReservation[], 'nursery-resource-reservations'>;
  readonly accountedFieldReservations?: GrowerInput<readonly string[], 'nursery-accounted-field-reservations'>;
}
export type GrowerNurseryHeadroom = 'within-budget' | 'shortage' | 'unknown';
export interface GrowerNurseryBatch {
  readonly id: string;
  readonly sourceStatus: 'proposed' | 'saved-planned';
  readonly cycleId: string;
  readonly demandId: string;
  readonly profileId: string;
  readonly cropKey: string;
  readonly cropName: string;
  readonly plantingIds: readonly string[];
  readonly bedIds: readonly string[];
  readonly startDate: string;
  readonly endDateExclusive: string;
  readonly targetPositions: number;
  readonly starts: number | null;
  readonly seeds: number | null;
  readonly trays: number | null;
  readonly areaM2: number | null;
  readonly trayFootprintM2: number | null;
  readonly model: NurseryProfile['model'] | null;
  readonly containerId?: string;
  readonly spaceId?: string;
  readonly basis: readonly string[];
  readonly issues: readonly string[];
  readonly incomplete: boolean;
}
export interface GrowerNurseryResourceBudget extends NurseryResourceForecast {
  readonly resourceKind: 'container' | 'space';
  readonly availability: readonly GrowerNurseryResourceWindow[];
  readonly availabilityComplete: boolean;
  readonly headroom: GrowerNurseryHeadroom;
}
export interface GrowerNurserySnapshot {
  readonly source: unknown;
  readonly resourceContext: GrowerWorkflowSource;
  readonly settings: NurserySettings;
  readonly settingsReview: GrowerNurseryRequest['settingsReview'];
  readonly horizon: GrowerWindowInput;
  readonly availability: GrowerNurseryRequest['availability'];
  readonly otherReservations: GrowerNurseryRequest['otherReservations'];
  readonly accountedFieldReservations?: GrowerNurseryRequest['accountedFieldReservations'];
}
export interface GrowerNurseryResult {
  readonly status: 'ready' | 'partial' | 'invalid-inputs' | 'missing-inputs' | 'stale-source';
  readonly basis: 'grower-nursery-estimates';
  readonly sourceStatus: 'proposed' | 'saved-planned' | null;
  readonly sourceVerification: 'not-verified';
  readonly snapshot: GrowerNurserySnapshot | null;
  readonly fingerprint: string | null;
  readonly batches: readonly GrowerNurseryBatch[];
  readonly resources: readonly GrowerNurseryResourceBudget[];
  /** Compatibility formatting only: own batches carry the exact source and UTC meaning. */
  readonly forecast: NurseryForecast;
  readonly headroom: GrowerNurseryHeadroom;
  readonly issues: readonly string[];
}

const DAY = 86_400_000;
/** Software work ceiling only; not an agricultural quantity or duration. */
export const GROWER_NURSERY_MAX_INTERVAL_WORK = 1_000_000;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const identity = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const time = (date: string) => Date.parse(`${date}T00:00:00.000Z`);
const date = (milliseconds: number) => new Date(milliseconds).toISOString().slice(0, 10);
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
const range = (value: number | null): readonly [number, number] | null => value === null ? null : [value, value];
const safe = (value: number): number | null => finite(value) ? value : null;
const ceil = (top: number[], bottom: number[]) => safe(nurseryCeilRatio(top, bottom));
const unique = (values: readonly string[]) => [...new Set(values)];
function nurseryPeak(intervals: NurseryInterval[], start: number, end: number, capacity?: number | null) {
  const result = sharedNurseryPeak(intervals, start, end, capacity);
  return result.value && !result.value.every(finite) ? { value: null, incomplete: true, shortage: null } : result;
}

function strictSettings(value: unknown): NurserySettings | null {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.spaces) || !Array.isArray(value.containers) || !Array.isArray(value.profiles)) return null;
  if (value.spaces.length + value.containers.length + value.profiles.length > GROWER_AUTOPLAN_MAX_ASSESSMENTS) return null;
  const saved = sanitiseNurserySettings(value);
  if ((['spaces', 'containers', 'profiles'] as const).some(key => saved[key].length !== (value[key] as unknown[]).length)) return null;
  const compare = (a: {id: string;siteId: string}, b: {id: string;siteId: string}) => a.siteId.localeCompare(b.siteId) || a.id.localeCompare(b.id);
  saved.spaces.sort(compare); saved.containers.sort(compare); saved.profiles.sort(compare);
  return saved;
}
export function nurserySettingsFingerprint(value: unknown): string | null {
  try { const settings = strictSettings(value); return settings ? JSON.stringify(settings) : null; } catch { return null; }
}
function windowInput(value: unknown): GrowerWindowInput | null {
  const parsed = normaliseGrowerInput(value, 'utc-date-window', (window): window is GrowerUtcWindow => record(window)
    && isGrowerUtcDate(window.start) && isGrowerUtcDate(window.endExclusive) && window.start < window.endExclusive);
  return parsed?.state === 'provided' ? { ...parsed, value: { start: parsed.value.start, endExclusive: parsed.value.endExclusive } } : parsed;
}
function resourceWindow(value: unknown): GrowerNurseryResourceWindow | null {
  if (!record(value) || !identity(value.resourceId) || !['container', 'space'].includes(value.resourceKind as string)
    || !finite(value.quantity) || (value.resourceKind === 'container' && !Number.isSafeInteger(value.quantity)) || !record(value.window)
    || !isGrowerUtcDate(value.window.start) || !isGrowerUtcDate(value.window.endExclusive) || value.window.start >= value.window.endExclusive) return null;
  const scope = normaliseGrowerPlanningScope(value.scope);
  return scope ? { resourceKind: value.resourceKind as 'container' | 'space', resourceId: value.resourceId, scope,
    quantity: value.quantity, window: { start: value.window.start, endExclusive: value.window.endExclusive } } : null;
}
function reservation(value: unknown): GrowerNurseryReservation | null {
  const parsed = resourceWindow(value);
  return parsed && record(value) && identity(value.id) ? { ...parsed, id: value.id } : null;
}
function listInput<T>(value: unknown, unit: string, parser: (value: unknown) => T | null): GrowerInput<readonly T[], string> | null {
  const parsed = normaliseGrowerInput(value, unit, (rows): rows is unknown[] => Array.isArray(rows) && rows.length <= GROWER_AUTOPLAN_MAX_ASSESSMENTS);
  if (!parsed || parsed.state === 'missing') return parsed;
  const rows = parsed.value.map(parser);
  return rows.some(row => row === null) ? null : { ...parsed, value: rows as T[] };
}
const guidance = 'Dated arithmetic from grower estimates, not local farming instructions or live nursery stock. Each cycle is a separate raising batch. Unknown or unassigned demand is not zero; incomplete budgets cannot certify spare capacity. Tray footprint does not prove geometric packing or include paths, hardening or up-pot stages. Proposed cycles are not accepted or observed sowings. Field dates and measured geometry are unchanged.';
function emptyForecast(issues: string[]): NurseryForecast {
  return { cohorts: [], weeks: [], containers: [], spaces: [], peakTrays: null, peakAreaM2: null, cumulativeTrayUses: null, incomplete: true, issues, guidance };
}

interface CycleFact {
  id: string; cycleId: string; demandId: string; profileId: string; cropKey: string;
  plantingIds: string[]; bedId: string; targetPositions: number; start: string; endExclusive: string;
}
interface SourceFacts {
  status: 'proposed' | 'saved-planned'; scope: GrowerPlanningScope; geometryFingerprint: string;
  beds: readonly {id: string;areaM2: number}[]; cycles: CycleFact[]; snapshot: unknown; issues: string[]; fieldReservationIds: string[];
}
function sourceFacts(source: GrowerNurserySource): SourceFacts | null {
  if (source.kind === 'proposal') {
    if (source.competingDemand !== undefined && source.competingDemand !== 'assessed-none' && source.competingDemand !== 'unresolved') return null;
    if (!isGrowerAutoPlanCurrent(source.proposal, source.currentRequest)) return null;
    // Fingerprint equality alone does not validate a caller's claimed cycle
    // output. Use the freshly generated real assessment, never fake saved rows.
    const fresh = generateGrowerAutoPlan(source.currentRequest);
    if (fresh.status !== 'ready' && fresh.status !== 'with-gaps') return null;
    return { status: 'proposed', scope: fresh.snapshot.scope, geometryFingerprint: fresh.snapshot.geometryFingerprint,
      beds: fresh.snapshot.beds.map(row => row.bed), snapshot: { kind: 'proposal', request: fresh.snapshot,
        proposalFingerprint: fresh.fingerprint, competingDemand: source.competingDemand ?? 'unknown' },
      fieldReservationIds: fresh.snapshot.reserved.map(row => row.id),
      issues: [...(fresh.status === 'with-gaps' ? ['proposal-capacity-gaps'] : []),
        ...(source.competingDemand === 'assessed-none' ? [] : [source.competingDemand === 'unresolved'
          ? 'competing-nursery-demand-unresolved' : 'competing-nursery-demand-review-missing'])],
      cycles: fresh.cycles.flatMap(cycle => cycle.assessment.schedule.nurseryStartDate === null ? [] : [{
        id: cycle.fingerprint, cycleId: cycle.cycleId, demandId: cycle.demandId, profileId: cycle.profileId, cropKey: cycle.cropKey,
        plantingIds: [], bedId: cycle.bedId, targetPositions: cycle.assessment.capacity.estimatedPlantCount,
        start: cycle.assessment.schedule.nurseryStartDate, endExclusive: cycle.assessment.schedule.fieldEntryDate,
      }]) };
  }
  if (source.kind !== 'saved-cycles' || !source.cycleContext || !normaliseGrowerPlanningScope(source.cycleContext.scope)) return null;
  if (Array.isArray(source.rows) && source.rows.length > GROWER_AUTOPLAN_MAX_ASSESSMENTS) return null;
  const rows = structuredClone(source.rows);
  const storedRows = Array.isArray(rows) ? rows.map(row => record(row) ? { ...row, ...preserveGrowerCycleMarker(row) } : row) : rows;
  const context = structuredClone(source.cycleContext), projection = projectGrowerCycles(storedRows, context);
  return { status: 'saved-planned', scope: normaliseGrowerPlanningScope(context.scope)!, geometryFingerprint: context.geometryFingerprint ?? '',
    beds: context.beds, snapshot: { kind: 'saved-cycles', rows: storedRows, cycleContext: context }, fieldReservationIds: [],
    issues: [...(projection.heldRows.length ? ['held-cycle-demand-unresolved'] : []), ...(projection.legacyRows.length ? ['legacy-nursery-demand-unassessed'] : [])],
    cycles: projection.ownCycles.flatMap(cycle => !cycle.nurseryDemand ? [] : [{
      id: cycle.plantingId, cycleId: cycle.cycleId, demandId: cycle.demandId, profileId: cycle.profileId, cropKey: cycle.cropKey,
      plantingIds: [cycle.plantingId], bedId: cycle.bedId, targetPositions: cycle.nurseryDemand.targetPositions,
      ...cycle.nurseryDemand.interval,
    }]) };
}
function batchFor(cycle: CycleFact, status: SourceFacts['status'], settings: NurserySettings, siteId: string): GrowerNurseryBatch {
  const recipe = settings.profiles.find(row => row.siteId === siteId && row.cropKey === cycle.cropKey);
  const container = settings.containers.find(row => row.siteId === siteId && row.id === recipe?.containerId);
  const space = settings.spaces.find(row => row.siteId === siteId && row.id === recipe?.spaceId);
  const issues: string[] = [], basis = ['Target final stand from the current grower cycle; no catalogue spacing or seed rate.', 'Each dated cycle is a separate raising batch.'];
  let starts: number | null = null, seeds: number | null = null, trays: number | null = null;
  if (cycle.targetPositions === 0) {
    starts = seeds = trays = 0; basis.push('The entered target is zero; this cycle requests no raising work. Missing rates have not been defaulted.');
  } else {
    if (!recipe) issues.push('nursery-recipe-missing');
    if (!container) issues.push('nursery-container-missing');
    if (!space) issues.push('nursery-space-missing');
    if (cycle.start >= cycle.endExclusive) issues.push('positive-target-zero-nursery-interval');
    if (recipe?.fieldSurvivalPercent === undefined) issues.push('field-survival-missing');
    else if (recipe.fieldSurvivalPercent === 0) issues.push('field-survival-zero');
    else starts = ceil([cycle.targetPositions, 100], [recipe.fieldSurvivalPercent]);
    if (recipe?.model === 'seed-cell') {
      basis.push('Grower-selected one seed per cell and one transplant per successful cell; each success rate is applied once.');
      if (recipe.germinationPercent === undefined || recipe.nurserySurvivalPercent === undefined) issues.push('germination-or-nursery-survival-missing');
      else if (recipe.germinationPercent === 0 || recipe.nurserySurvivalPercent === 0) issues.push('germination-or-nursery-survival-zero');
      else if (starts !== null) seeds = ceil([starts, 100, 100], [recipe.germinationPercent, recipe.nurserySurvivalPercent]);
      if (container?.cells === undefined) issues.push('container-cells-missing');
      else if (container.cells === 0) issues.push('container-cells-zero');
      else if (seeds !== null) trays = ceil([seeds], [container.cells]);
    } else if (recipe?.model === 'measured-tray') {
      basis.push('Measured usable starts per tray already include germination and nursery losses; they are not applied again.');
      if (recipe.usableStartsPerTray === undefined) issues.push('measured-tray-output-missing');
      else if (recipe.usableStartsPerTray === 0) issues.push('measured-tray-output-zero');
      else if (starts !== null && container) trays = ceil([starts], [recipe.usableStartsPerTray]);
      if (recipe.seedsPerTray === undefined) issues.push('seeds-per-tray-missing');
      else if (trays !== null) seeds = safe(trays * recipe.seedsPerTray);
    }
    if (recipe?.nurseryWeeks !== undefined && recipe.nurseryWeeks * 7 !== (time(cycle.endExclusive) - time(cycle.start)) / DAY) {
      issues.push('recipe-duration-conflicts-with-cycle');
    }
  }
  const footprint = container?.widthCm !== undefined && container.lengthCm !== undefined
    ? decimalQuantityProduct([container.widthCm, container.lengthCm, 0.0001]) : null;
  const trayFootprintM2 = footprint === null ? null : safe(footprint);
  const allocatedArea = trays !== null && trayFootprintM2 !== null ? decimalQuantityProduct([trays, trayFootprintM2]) : null;
  const areaM2 = cycle.targetPositions === 0 ? 0 : allocatedArea === null ? null : safe(allocatedArea);
  if (cycle.targetPositions > 0 && trayFootprintM2 === null) issues.push('container-footprint-missing');
  if (cycle.targetPositions > 0 && (starts === null || seeds === null || trays === null || areaM2 === null) && !issues.length) issues.push('quantity-out-of-range');
  basis.push('Nursery and field-entry dates come from the dated cycle; the recipe never moves them.', 'All supplied resource and propagation figures remain unverified grower estimates.');
  return { id: cycle.id, sourceStatus: status, cycleId: cycle.cycleId, demandId: cycle.demandId, profileId: cycle.profileId,
    cropKey: cycle.cropKey, cropName: cropByKey(cycle.cropKey)?.name ?? cycle.cropKey, plantingIds: [...cycle.plantingIds], bedIds: [cycle.bedId],
    startDate: cycle.start, endDateExclusive: cycle.endExclusive, targetPositions: cycle.targetPositions,
    starts, seeds, trays, areaM2, trayFootprintM2, model: recipe?.model ?? null,
    ...(container ? {containerId: container.id} : {}), ...(space ? {spaceId: space.id} : {}), basis, issues, incomplete: issues.length > 0 };
}

/** Own dated nursery demand, independent of the catalogue/country forecast gate. */
export function buildGrowerNurseryForecast(value: GrowerNurseryRequest): GrowerNurseryResult {
  const fail = (status: GrowerNurseryResult['status'], ...issues: string[]): GrowerNurseryResult => freeze({ status,
    basis: 'grower-nursery-estimates', sourceStatus: null, sourceVerification: 'not-verified', snapshot: null, fingerprint: null,
    batches: [], resources: [], forecast: emptyForecast(issues), headroom: 'unknown', issues });
  try {
    if (!record(value) || !record(value.source)) return fail('invalid-inputs', 'nursery-request-invalid');
    const settings = strictSettings(value.settings), settingsFingerprint = nurserySettingsFingerprint(value.settings);
    if (!settings || !settingsFingerprint) return fail('invalid-inputs', 'nursery-settings-invalid-or-ambiguous');
    const review = normaliseGrowerInput(value.settingsReview, 'nursery-settings-fingerprint', (input): input is string => identity(input));
    const horizon = windowInput(value.horizon);
    const availability = listInput(value.availability, 'nursery-resource-windows', resourceWindow) as GrowerNurseryRequest['availability'] | null;
    const reservations = listInput(value.otherReservations, 'nursery-resource-reservations', reservation) as GrowerNurseryRequest['otherReservations'] | null;
    if (!review || !horizon || !availability || !reservations) return fail('invalid-inputs', 'nursery-inputs-invalid');
    if (horizon.state !== 'provided') return fail('missing-inputs', 'nursery-horizon-missing');
    const start = time(horizon.value.start), end = time(horizon.value.endExclusive);
    if ((end - start) / DAY > GROWER_AUTOPLAN_MAX_HORIZON_DAYS) return fail('invalid-inputs', 'nursery-horizon-work-limit');
    const source = sourceFacts(value.source);
    if (!source) return fail('stale-source', 'current-cycle-source-unavailable-or-stale');
    const resourceContext = value.resourceContext, siteId = growerWorkflowResourceSiteId(resourceContext);
    if (!resourceContext || resourceContext.status !== 'ready' || !siteId
      || resourceContext.sourceVerification !== 'not-verified'
      || resourceContext.geometryFingerprint !== source.geometryFingerprint
      || growerPlanningScopeKey(resourceContext.scope) !== growerPlanningScopeKey(source.scope)
      || !Array.isArray(resourceContext.beds) || !Array.isArray(resourceContext.measuredAreas)
      || new Set(resourceContext.beds.map(bed => bed.id)).size !== resourceContext.beds.length
      || resourceContext.measuredAreas.length !== resourceContext.beds.length
      || source.beds.some(bed => !resourceContext.beds.some(candidate => candidate.id === bed.id && candidate.areaM2 === bed.areaM2))
      || resourceContext.beds.some(bed => !finite(bed.areaM2) || bed.areaM2 <= 0 || !resourceContext.measuredAreas.some(area => area.bedId === bed.id
        && area.areaM2 === bed.areaM2 && ['explicit-saved-dimensions','calibrated-saved-polygon'].includes(area.basis)))) {
      return fail('stale-source', 'resource-source-context-mismatch');
    }
    const sourceIssues = [...source.issues, ...(settings.sourceIssues ?? []), ...(resourceContext.heldBeds.length ? ['held-source-beds-unresolved'] : [])];
    if (review.state === 'missing') sourceIssues.push('nursery-settings-review-missing');
    else if (review.value !== settingsFingerprint) sourceIssues.push('nursery-settings-review-stale');
    if (availability.state === 'missing') sourceIssues.push('nursery-availability-missing');
    if (reservations.state === 'missing') sourceIssues.push('other-nursery-reservations-missing');
    const accountedFieldReservations = value.accountedFieldReservations === undefined ? undefined : listInput(value.accountedFieldReservations,
      'nursery-accounted-field-reservations', input => identity(input) ? input : null) as GrowerNurseryRequest['accountedFieldReservations'] | null;
    if (accountedFieldReservations === null) return fail('invalid-inputs', 'accounted-field-reservations-invalid');
    if (source.fieldReservationIds.length && (accountedFieldReservations?.state !== 'provided'
      || accountedFieldReservations.value.length !== source.fieldReservationIds.length
      || new Set(accountedFieldReservations.value).size !== source.fieldReservationIds.length
      || !source.fieldReservationIds.every(id => accountedFieldReservations.value.includes(id)))) sourceIssues.push('existing-field-reservations-not-accounted-for');
    const available = availability.state === 'provided' ? availability.value : [];
    const other = reservations.state === 'provided' ? reservations.value : [];
    const containers = settings.containers.filter(row => row.siteId === siteId), spaces = settings.spaces.filter(row => row.siteId === siteId);
    const resourceCapacity = (window: GrowerNurseryResourceWindow) => window.resourceKind === 'container'
      ? containers.find(row => row.id === window.resourceId)?.owned
      : spaces.find(row => row.id === window.resourceId)?.usableM2;
    const resourceExists = (window: GrowerNurseryResourceWindow) => window.resourceKind === 'container'
      ? containers.some(row => row.id === window.resourceId) : spaces.some(row => row.id === window.resourceId);
    if ([...available, ...other].some(window => growerPlanningScopeKey(window.scope) !== growerPlanningScopeKey(source.scope) || !resourceExists(window))
      || available.some(window => resourceCapacity(window) !== undefined && window.quantity > resourceCapacity(window)!)
      || new Set(other.map(row => row.id)).size !== other.length) return fail('invalid-inputs', 'resource-reservation-identity-or-capacity');
    for (let index = 0; index < available.length; index++) for (let previous = 0; previous < index; previous++) {
      const a = available[index], b = available[previous];
      if (a.resourceKind === b.resourceKind && a.resourceId === b.resourceId && a.window.start < b.window.endExclusive && a.window.endExclusive > b.window.start) {
        return fail('invalid-inputs', 'overlapping-resource-availability');
      }
    }
    const batches = source.cycles.map(cycle => batchFor(cycle, source.status, settings, siteId));
    for (const batch of batches) if (time(batch.startDate) < start || time(batch.endDateExclusive) > end) sourceIssues.push('nursery-cycle-outside-review-horizon');
    const globalIncomplete = sourceIssues.length > 0;
    const unresolvedInterval = (row: GrowerNurseryBatch) => row.issues.includes('positive-target-zero-nursery-interval')
      || row.issues.includes('recipe-duration-conflicts-with-cycle');
    // Seed counts do not determine the space occupied by a measured-output flat.
    // Preserve unknown purchasing quantities without erasing known tray demand;
    // each resource is held by its own missing quantity or unresolved interval.
    const intervals = (rows: readonly GrowerNurseryBatch[], quantity: 'trays' | 'areaM2'): NurseryInterval[] => rows.filter(row => row.targetPositions > 0).map(row => ({
      start: time(row.startDate), end: time(row.endDateExclusive), value: range(row[quantity]),
      incomplete: row[quantity] === null || unresolvedInterval(row),
    }));
    const buckets: {start: number;end: number}[] = [];
    for (let cursor = start; cursor < end; cursor += 7 * DAY) buckets.push({start: cursor, end: Math.min(end, cursor + 7 * DAY)});
    const resourceCount = containers.length + spaces.length;
    if ((batches.length + other.length + available.length) * Math.max(1,resourceCount) * (buckets.length+1) > GROWER_NURSERY_MAX_INTERVAL_WORK) {
      return fail('invalid-inputs','nursery-resource-work-limit');
    }
    const resource = (resourceKind: 'container' | 'space', id: string, name: string, capacity: number | null): GrowerNurseryResourceBudget => {
      const quantity = resourceKind === 'container' ? 'trays' : 'areaM2';
      const assigned = batches.filter(row => resourceKind === 'container' ? row.containerId === id : row.spaceId === id);
      const unassigned = batches.filter(row => row.targetPositions > 0 && (resourceKind === 'container' ? !row.containerId : !row.spaceId));
      const uses = [...intervals(assigned, quantity), ...intervals(unassigned, quantity).map(row => ({...row, value: null, incomplete: true})),
        ...other.filter(row => row.resourceKind === resourceKind && row.resourceId === id).map(row => ({start: time(row.window.start), end: time(row.window.endExclusive), value: range(row.quantity), incomplete: false}))];
      const windows = available.filter(row => row.resourceKind === resourceKind && row.resourceId === id);
      const points = [...new Set([start, end, ...windows.flatMap(row => [time(row.window.start), time(row.window.endExclusive)]), ...uses.flatMap(row => [row.start,row.end])].filter(point => point >= start && point <= end))].sort((a,b) => a-b);
      const segments = points.slice(0,-1).map((point,index) => {
        const finish = points[index+1], window = windows.find(row => time(row.window.start) <= point && time(row.window.endExclusive) >= finish);
        const known = availability.state === 'provided' && !!window && capacity !== null;
        const demand = nurseryPeak(uses, point, finish, known ? window!.quantity : undefined);
        return { start: point, end: finish, demand, known,
          shortage: known && demand.shortage !== undefined && demand.shortage !== null ? safe(demand.shortage) : null };
      });
      const availabilityComplete = segments.every(row => row.known), peak = nurseryPeak(uses,start,end);
      const incomplete = globalIncomplete || !availabilityComplete || peak.incomplete || capacity === null;
      const shortage = segments.some(row => row.shortage !== null) ? Math.max(...segments.flatMap(row => row.shortage === null ? [] : [row.shortage])) : null;
      return {id,name,resourceKind,capacity,peak:peak.value,shortage,incomplete, availability:windows,availabilityComplete,
        headroom: shortage !== null && shortage > 0 ? 'shortage' : incomplete ? 'unknown' : 'within-budget',
        weeks:buckets.map(bucket => {const demand=nurseryPeak(uses,bucket.start,bucket.end), spans=segments.filter(row=>row.start<bucket.end&&row.end>bucket.start);
          return {startDate:date(bucket.start),endDateExclusive:date(bucket.end),demand:demand.value,
            shortage:spans.some(row=>row.shortage!==null)?Math.max(...spans.flatMap(row=>row.shortage===null?[]:[row.shortage])):null,
            incomplete:globalIncomplete||demand.incomplete||spans.some(row=>!row.known)};})};
    };
    const resources = [...containers.map(row => resource('container',row.id,row.name,row.owned??null)), ...spaces.map(row => resource('space',row.id,row.name,row.usableM2))];
    const trayIntervals = intervals(batches,'trays'), areaIntervals = intervals(batches,'areaM2');
    const peakTrays = nurseryPeak(trayIntervals,start,end), peakArea = nurseryPeak(areaIntervals,start,end);
    const cumulativeTrayUses = batches.some(row=>row.trays===null)?null:safe(batches.reduce((sum,row)=>sum+row.trays!,0));
    const incomplete = globalIncomplete || batches.some(row=>row.incomplete) || resources.some(row=>row.incomplete)
      || peakTrays.incomplete || peakArea.incomplete || cumulativeTrayUses===null;
    const resourceIncomplete = globalIncomplete || resources.some(row => row.incomplete)
      || batches.some(row => row.targetPositions > 0 && (!row.containerId || !row.spaceId
        || row.trays === null || row.areaM2 === null || unresolvedInterval(row)));
    const issues = unique([...sourceIssues,...batches.flatMap(row=>row.issues),...(cumulativeTrayUses===null&&batches.every(row=>row.trays!==null)?['cumulative-tray-uses-out-of-range']:[]),
      ...resources.filter(row=>!row.availabilityComplete).map(row=>`resource-availability-incomplete:${row.resourceKind}:${row.id}`)]);
    const forecast: NurseryForecast = {cohorts:batches.map(batch=>({id:batch.id,cropKey:batch.cropKey,cropName:batch.cropName,phase:'planned',plantingIds:[...batch.plantingIds],bedIds:[...batch.bedIds],
      sowMonth:batch.startDate.slice(0,7),fieldMonth:batch.endDateExclusive.slice(0,7),startDate:batch.startDate,endDateExclusive:batch.endDateExclusive,
      readinessStartDate:null,readinessEndDateExclusive:null,readinessSource:'grower',readinessConflict:batch.issues.includes('recipe-duration-conflicts-with-cycle'),
      positions:range(batch.targetPositions),starts:range(batch.starts),seeds:range(batch.seeds),trays:range(batch.trays),areaM2:range(batch.areaM2),trayFootprintM2:batch.trayFootprintM2,
      model:batch.model,...(batch.containerId?{containerId:batch.containerId}:{}),...(batch.spaceId?{spaceId:batch.spaceId}:{}),basis:[...batch.basis],issues:[...batch.issues],incomplete:batch.incomplete})),
      containers:resources.filter(row=>row.resourceKind==='container'),spaces:resources.filter(row=>row.resourceKind==='space'),
      weeks:buckets.map(bucket=>{const trays=nurseryPeak(trayIntervals,bucket.start,bucket.end),area=nurseryPeak(areaIntervals,bucket.start,bucket.end);return {startDate:date(bucket.start),endDateExclusive:date(bucket.end),trays:trays.value,areaM2:area.value,incomplete:globalIncomplete||trays.incomplete||area.incomplete};}),
      peakTrays:peakTrays.value,peakAreaM2:peakArea.value,cumulativeTrayUses:range(cumulativeTrayUses),incomplete,issues,guidance};
    const snapshot:GrowerNurserySnapshot={source:source.snapshot,resourceContext:structuredClone(resourceContext),settings,settingsReview:review,horizon,availability,otherReservations:reservations,
      ...(accountedFieldReservations === undefined ? {} : {accountedFieldReservations})};
    const fingerprint=JSON.stringify(snapshot);
    return freeze({status:incomplete?'partial':'ready',basis:'grower-nursery-estimates',sourceStatus:source.status,sourceVerification:'not-verified',snapshot,fingerprint,batches,resources,forecast,
      headroom:resources.some(row=>row.headroom==='shortage')?'shortage':resourceIncomplete||!resources.length?'unknown':'within-budget',issues});
  } catch { return fail('invalid-inputs','nursery-request-unreadable'); }
}

export function isGrowerNurseryForecastCurrent(result: GrowerNurseryResult, request: GrowerNurseryRequest): boolean {
  try {
    if (result.fingerprint === null || !['ready','partial'].includes(result.status)) return false;
    const fresh = buildGrowerNurseryForecast(request);
    if (fresh.fingerprint === null || fresh.fingerprint !== result.fingerprint) return false;
    // Current inputs alone cannot validate a changed displayed/exported quantity.
    // Bind every reviewed output to the fresh calculation as well as its inputs.
    const reviewed = (value: GrowerNurseryResult) => [value.status, value.basis, value.sourceStatus,
      value.sourceVerification, value.snapshot, value.batches, value.resources, value.forecast,
      value.headroom, value.issues];
    return JSON.stringify(reviewed(fresh)) === JSON.stringify(reviewed(result));
  } catch { return false; }
}


export interface GrowerNurseryPreparationMetric {
  readonly status: 'complete' | 'unknown' | 'overflow';
  /** Subtotal of represented batches with known counts; not a whole-farm lower bound. */
  readonly knownSubtotal: number | null;
  /** Complete only for the represented members of this group. */
  readonly total: number | null;
  readonly knownBatchCount: number;
  readonly unknownBatchCount: number;
  readonly unknownBatchIds: readonly string[];
}
export interface GrowerNurseryPreparationGroup {
  /** Private grouping/membership keys stay inside the review, never in shareable files. */
  readonly key: string;
  readonly cropKey: string;
  readonly cropName: string;
  readonly profileId: string;
  readonly startDate: string;
  readonly batchIds: readonly string[];
  readonly members: readonly {
    readonly batchId: string;
    readonly cycleId: string;
    readonly plantingIds: readonly string[];
    readonly bedIds: readonly string[];
    readonly endDateExclusive: string;
  }[];
  readonly fieldPositions: GrowerNurseryPreparationMetric;
  readonly startsToRaise: GrowerNurseryPreparationMetric;
  readonly seedsToSow: GrowerNurseryPreparationMetric;
  readonly outsideReviewHorizon: boolean;
  readonly incomplete: boolean;
  readonly issues: readonly string[];
}
export interface GrowerNurseryPreparation {
  readonly status: 'available' | 'unavailable';
  readonly basis: 'grower-nursery-estimates';
  readonly sourceStatus: GrowerNurseryResult['sourceStatus'];
  readonly sourceVerification: 'not-verified';
  readonly fingerprint: string | null;
  readonly reviewStatus: GrowerNurseryResult['status'] | 'unavailable';
  readonly reviewIncomplete: boolean;
  readonly projectionIncomplete: boolean;
  readonly horizon: GrowerUtcWindow | null;
  readonly sourceContext: Pick<GrowerWorkflowSource, 'sourceKey' | 'sourceRevision' | 'geometryFingerprint' | 'resourceSiteId' | 'scope'> | null;
  readonly coverage: 'represented-transplant-raising-batches-only';
  readonly representedBatchCount: number;
  readonly groups: readonly GrowerNurseryPreparationGroup[];
  readonly issues: readonly string[];
  readonly guidance: string;
}
const preparationGuidance = 'Planned grower estimates from represented transplant raising batches only, not observed sowings, stock or seedling readiness. Direct sowings and unresolved or omitted work are not included. Known subtotals cover only represented batches with known counts; unknown or overflowing counts never become complete totals. Complete group counts do not establish whole-farm seed demand or resource availability. Varieties and seed lots are not identified, so grouped counts do not establish interchangeability. No purchasing quantities, pack sizes, seed weights, prices or local crop instructions are inferred. All dates are UTC; field-entry end dates are exclusive.';
const preparationCount = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value);
type PreparationBatch = Pick<GrowerNurseryBatch, 'id' | 'cycleId' | 'demandId' | 'profileId' | 'cropKey' | 'sourceStatus'
  | 'startDate' | 'endDateExclusive' | 'targetPositions' | 'starts' | 'seeds' | 'plantingIds' | 'bedIds' | 'incomplete' | 'issues'>;
function preparationBatch(value: unknown, sourceStatus: GrowerNurseryResult['sourceStatus']): value is PreparationBatch {
  return record(value) && [value.id, value.cycleId, value.demandId, value.profileId, value.cropKey].every(identity)
    && sourceStatus !== null && value.sourceStatus === sourceStatus
    && isGrowerUtcDate(value.startDate) && isGrowerUtcDate(value.endDateExclusive) && value.startDate <= value.endDateExclusive
    && preparationCount(value.targetPositions) && [value.starts, value.seeds].every(count => count === null || preparationCount(count))
    && Array.isArray(value.plantingIds) && Array.isArray(value.bedIds)
    && [value.plantingIds, value.bedIds].every(values => values.every(identity) && new Set(values).size === values.length)
    && typeof value.incomplete === 'boolean' && Array.isArray(value.issues) && value.issues.every(identity);
}
function preparationMetric(batches: readonly PreparationBatch[], field: 'targetPositions' | 'starts' | 'seeds'): GrowerNurseryPreparationMetric {
  let sum = 0, knownBatchCount = 0, overflow = false;
  const unknownBatchIds: string[] = [];
  for (const batch of batches) {
    const value = batch[field];
    if (value === null) { unknownBatchIds.push(batch.id); continue; }
    ++knownBatchCount;
    // Check before addition: an already-rounded unsafe sum cannot be repaired.
    if (value > Number.MAX_SAFE_INTEGER - sum) overflow = true;
    else if (!overflow) sum = safe(sum + value)!;
  }
  const status = overflow ? 'overflow' : unknownBatchIds.length ? 'unknown' : 'complete';
  return { status, knownSubtotal: overflow || knownBatchCount === 0 ? null : sum,
    total: status === 'complete' ? sum : null, knownBatchCount, unknownBatchCount: unknownBatchIds.length, unknownBatchIds };
}

/** Aggregate the existing calculated batch counts once. This is a detached view,
 * not source authentication: callers retain their original current-result check
 * before display/delivery, including full-output equality, not just a fingerprint. */
export function projectGrowerNurseryPreparation(result: GrowerNurseryResult): GrowerNurseryPreparation {
  let header: Omit<GrowerNurseryPreparation, 'status' | 'representedBatchCount' | 'groups' | 'issues'> = {
    basis: 'grower-nursery-estimates', sourceStatus: null, sourceVerification: 'not-verified', fingerprint: null,
    reviewStatus: 'unavailable', reviewIncomplete: true, projectionIncomplete: true, horizon: null, sourceContext: null,
    coverage: 'represented-transplant-raising-batches-only', guidance: preparationGuidance,
  };
  let sourceIssues: string[] = [];
  const fail = (issue: string): GrowerNurseryPreparation => freeze({ ...header, status: 'unavailable',
    reviewIncomplete: true, projectionIncomplete: true, representedBatchCount: 0, groups: [], issues: unique([...sourceIssues, issue]) });
  try {
    if (record(result)) {
      if (Array.isArray(result.issues) && result.issues.every(identity)) sourceIssues = [...result.issues];
      header = { ...header, fingerprint: identity(result.fingerprint) ? result.fingerprint : null,
        sourceStatus: result.sourceStatus === 'proposed' || result.sourceStatus === 'saved-planned' ? result.sourceStatus : null,
        reviewStatus: ['ready', 'partial', 'invalid-inputs', 'missing-inputs', 'stale-source'].includes(result.status) ? result.status : 'unavailable' };
    }
    if (!record(result) || result.basis !== 'grower-nursery-estimates' || result.sourceVerification !== 'not-verified'
      || !['ready', 'partial'].includes(result.status) || !identity(result.fingerprint)
      || !['proposed', 'saved-planned'].includes(result.sourceStatus ?? '') || !record(result.snapshot)
      || !Array.isArray(result.batches) || !Array.isArray(result.issues) || !result.issues.every(identity)) return fail('preparation-review-unavailable');
    sourceIssues = [...result.issues];
    const horizon = windowInput(result.snapshot.horizon), context = result.snapshot.resourceContext;
    if (horizon?.state !== 'provided' || !growerWorkflowResourceSiteId(context)) return fail('preparation-review-context-invalid');
    header = { ...header, sourceStatus: result.sourceStatus, fingerprint: result.fingerprint,
      reviewStatus: result.status, reviewIncomplete: result.status === 'partial' || sourceIssues.length > 0,
      horizon: { ...horizon.value }, sourceContext: {
        sourceKey: context.sourceKey, sourceRevision: context.sourceRevision, geometryFingerprint: context.geometryFingerprint,
        resourceSiteId: context.resourceSiteId, scope: structuredClone(context.scope),
      } };
    const ids = new Set<string>(), grouped = new Map<string, PreparationBatch[]>();
    for (const batch of result.batches) {
      if (!preparationBatch(batch, result.sourceStatus) || ids.has(batch.id)) return fail('preparation-batch-invalid-or-ambiguous');
      ids.add(batch.id);
      const key = JSON.stringify([batch.cropKey, batch.profileId, batch.startDate]);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(batch);
    }
    const groups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, batches]): GrowerNurseryPreparationGroup => {
      const first = batches[0];
      const outsideReviewHorizon = batches.some(batch => batch.startDate < horizon.value.start || batch.endDateExclusive > horizon.value.endExclusive);
      const intervalUnresolved = batches.some(batch => batch.targetPositions > 0 && batch.startDate === batch.endDateExclusive);
      const issues = unique([...batches.flatMap(batch => [...batch.issues]),
        ...(outsideReviewHorizon ? ['nursery-cycle-outside-review-horizon'] : []),
        ...(intervalUnresolved ? ['positive-target-zero-nursery-interval'] : [])]);
      const fieldPositions = preparationMetric(batches, 'targetPositions'), startsToRaise = preparationMetric(batches, 'starts'), seedsToSow = preparationMetric(batches, 'seeds');
      return { key, cropKey: first.cropKey, cropName: cropByKey(first.cropKey)?.name ?? 'Crop name unavailable', profileId: first.profileId,
        startDate: first.startDate, batchIds: batches.map(batch => batch.id), members: batches.map(batch => ({
          batchId: batch.id, cycleId: batch.cycleId, plantingIds: [...batch.plantingIds], bedIds: [...batch.bedIds], endDateExclusive: batch.endDateExclusive,
        })), fieldPositions, startsToRaise, seedsToSow, outsideReviewHorizon,
        incomplete: batches.some(batch => batch.incomplete) || issues.length > 0
          || [fieldPositions, startsToRaise, seedsToSow].some(metric => metric.status !== 'complete'), issues };
    });
    return freeze({ ...header, status: 'available', projectionIncomplete: header.reviewIncomplete || groups.some(group => group.incomplete),
      representedBatchCount: result.batches.length, groups, issues: sourceIssues });
  } catch { return fail('preparation-review-unreadable'); }
}
