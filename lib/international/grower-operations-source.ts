import { createProvisionalCycleContext, provisionalSiteConditions, type ProvisionalCycleContext } from './provisional-profile';
import { currentPlanningSupport } from './planning-support';
import { readRawCropPlanReceipt, type CropPlanState } from '../crop-plan';
import { activeAccountUid } from '../account-local-storage';
import { getFirebase, isBackendConfigured } from '../firebase/init';
import { isSampleMode } from '../sample-mode';
import { loadPlaces } from '../saved-places';
import { readCanvasSourceReceipt } from '../design-canvas';
import { readFacilitatorSourceReceipt } from '../facilitator-design';
import { myDesigns } from '../db/queries';
import { hasGrowerCycleMarker, normaliseGrowerCycleAttachment, resolvePlantingBasis, type GrowerCycleContext } from './grower-cycle';
import { growerPlanningScopeKey, normaliseGrowerPlanningScope, type GrowerPlanningScope } from './grower-planning';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource,
  type GrowerWorkflowSource, type GrowerWorkflowSourceRequest, type RawGrowerSourceReceipt } from './grower-workflow-source';

export interface GrowerOperationsSourceDiagnostic { readonly reason: string; readonly scopeKey?: string }
export type GrowerOperationsSources =
  | { readonly status: 'ready'; readonly book: CropPlanState; readonly contexts: readonly GrowerCycleContext[];
      readonly heldSources: readonly GrowerOperationsSourceDiagnostic[] }
  | { readonly status: 'held'; readonly book: null; readonly contexts: readonly [];
      readonly heldSources: readonly GrowerOperationsSourceDiagnostic[] };
type Ready = Extract<GrowerOperationsSources, { status: 'ready' }>;
interface LocalReceipt { read: () => RawGrowerSourceReceipt; signature: string }
interface Binding { owner: string | null; sample: boolean; token: string; places: string; locals: LocalReceipt[]; sources: string; reviewDay?: string }
const bindings = new WeakMap<object, Binding>();
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const held = (reason: string): GrowerOperationsSources => ({ status: 'held', book: null, contexts: [], heldSources: [{ reason }] });
const signature = (receipt: RawGrowerSourceReceipt) => receipt.status === 'ready'
  ? JSON.stringify([receipt.status, receipt.ownerUid, receipt.sample, receipt.revision]) : JSON.stringify([receipt.status, receipt.reasons]);
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function actor(owner: string | null, sample: boolean): boolean {
  try { return activeAccountUid() === owner && isSampleMode() === sample
    && (sample || !isBackendConfigured() || (getFirebase()?.auth.currentUser?.uid ?? null) === owner); }
  catch { return false; }
}
function localCurrent(binding: Binding): boolean {
  try {
    if (!actor(binding.owner, binding.sample) || binding.reviewDay && new Date().toISOString().slice(0, 10) !== binding.reviewDay) return false;
    const book = readRawCropPlanReceipt();
    if (book.status !== 'ready' || book.token !== binding.token || JSON.stringify(loadPlaces()) !== binding.places) return false;
    if (binding.locals.some(row => signature(row.read()) !== row.signature)) return false;
    const after = readRawCropPlanReceipt();
    return actor(binding.owner, binding.sample) && after.status === 'ready' && after.token === binding.token;
  } catch { return false; }
}

/** The raw operational book deliberately retains unknown runtime rows. Its
 * typed Planting[] is not admission: every consumer must use the own-cycle
 * projector over the whole list, including malformed and duplicate identities. */
export async function loadGrowerOperationsSources(options: { isCurrent?: () => boolean } = {}): Promise<GrowerOperationsSources> {
  let owner: string | null, sample: boolean;
  try { owner = activeAccountUid(); sample = isSampleMode(); } catch { return held('actor-unavailable'); }
  const permitted = () => actor(owner, sample) && (options.isCurrent?.() ?? true);
  try {
    if (!permitted()) return held('actor-changed');
    const receipt = readRawCropPlanReceipt();
    if (receipt.status === 'held' && receipt.reasons.length === 1 && receipt.reasons[0] === 'missing-book' && permitted()) {
      const after = readRawCropPlanReceipt();
      return held(permitted() && after.status === 'held' && after.reasons.length === 1 && after.reasons[0] === 'missing-book'
        ? 'no-saved-plan' : 'context-changed');
    }
    if (receipt.status !== 'ready' || !record(receipt.raw) || receipt.raw.version !== 1 || !Array.isArray(receipt.raw.plantings)) return held('book-unavailable');
    const book = structuredClone(receipt.raw) as unknown as CropPlanState;
    const binding: Binding = { owner, sample, token: receipt.token, places: JSON.stringify(loadPlaces()), locals: [], sources: '' };
    const current = () => permitted() && localCurrent(binding);
    if (!current()) return held('context-changed');
    const reviewedAt = new Date().toISOString();
    const heldSources: GrowerOperationsSourceDiagnostic[] = [];
    type Need = { scope: GrowerPlanningScope; scopeKey: string; geometry: string; legacy: boolean; reviews: ProvisionalCycleContext[] };
    const needs = new Map<string, Need>();
    const counts = new Map<unknown, number>();
    for (const row of book.plantings as unknown[]) if (record(row) && typeof row.id === 'string') counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
    for (const row of book.plantings as unknown[]) {
      if (!hasGrowerCycleMarker(row)) continue;
      const basis = resolvePlantingBasis(row);
      const attachment = record(row) ? normaliseGrowerCycleAttachment(row.growerCycle) : null;
      if (!attachment || !record(row) || counts.get(row.id) !== 1 || basis.kind !== 'held'
        || basis.reasons.length !== 1 || basis.reasons[0] !== 'current-geometry-context-required'
        || !/^[a-f0-9]{64}$/.test(attachment.geometryFingerprint)) {
        heldSources.push({ reason: 'own-row-needs-review' }); continue;
      }
      const scope = normaliseGrowerPlanningScope(attachment.assessmentSnapshot.scope), scopeKey = growerPlanningScopeKey(scope);
      if (!scope || !scopeKey) { heldSources.push({ reason: 'own-row-needs-review' }); continue; }
      const key = JSON.stringify([scopeKey, attachment.geometryFingerprint]);
      const need = needs.get(key) ?? { scope, scopeKey, geometry: attachment.geometryFingerprint, legacy: false, reviews: [] };
      const review = attachment.assessmentSnapshot.provisionalReview;
      if (review) { need.reviews.push(review.context); binding.reviewDay = reviewedAt.slice(0, 10); }
      else need.legacy = true;
      needs.set(key, need);
    }
    const candidates: GrowerWorkflowSource[] = [];
    const inspected: Array<{ request: GrowerWorkflowSourceRequest; inspection: ReturnType<typeof inspectGrowerWorkflowSource> }> = [];
    const capture = (kind: 'studio-canvas' | 'facilitator-local', sourceId: string, read: () => RawGrowerSourceReceipt) => {
      const raw = read(); binding.locals.push({ read, signature: signature(raw) });
      if (raw.status === 'ready' && raw.ownerUid === owner && raw.sample === sample) {
        const request = { kind, sourceId, raw: raw.raw, sourceRevision: raw.revision };
        inspected.push({ request, inspection: inspectGrowerWorkflowSource(request) });
      }
    };
    if (needs.size) {
      for (const siteId of new Set([...needs.values()].flatMap(need => need.scope.kind === 'mapped-site' ? [need.scope.siteId] : []))) {
        capture('studio-canvas', siteId, () => readCanvasSourceReceipt(siteId));
      }
      capture('facilitator-local', 'local', readFacilitatorSourceReceipt);
    }
    const wanted = (source: { scope: GrowerPlanningScope }) => [...needs.values()].some(need => growerPlanningScopeKey(source.scope) === need.scopeKey);
    for (const item of inspected) {
      if (!current()) return held('context-changed');
      if (item.inspection.status !== 'inspected' || !wanted(item.inspection)) continue;
      const source = await fingerprintGrowerWorkflowSource(item.inspection);
      if (!current()) return held('context-changed');
      if (source.status === 'ready') candidates.push(source);
    }
    const sourceKey = (source: ProvisionalCycleContext['source']) => JSON.stringify([source.kind, source.sourceKey, source.sourceRevision, source.geometryFingerprint]);
    const matches = (need: Need) => {
      const sameGeometry = candidates.filter(source => growerPlanningScopeKey(source.scope) === need.scopeKey && source.geometryFingerprint === need.geometry);
      // A marked record can identify its original source, but cannot resolve a
      // legacy row's ambiguous geometry by borrowing another row's receipt.
      if (need.legacy) return sameGeometry;
      // Each row later validates its own receipt. An older revision must not
      // suppress a current marked neighbour sharing this measured geometry.
      return sameGeometry.filter(source => need.reviews.some(review => sourceKey(review.source) === sourceKey(source)));
    };
    if ([...needs.values()].some(need => !matches(need).length && (need.legacy || need.reviews.some(review => review.source.kind === 'facilitator-cloud')))
      && owner && !sample && isBackendConfigured()) {
      if (!current()) return held('context-changed');
      let rows: Awaited<ReturnType<typeof myDesigns>> = [];
      try { rows = await myDesigns(); } catch { heldSources.push({ reason: 'cloud-source-unavailable' }); }
      if (!current()) return held('context-changed');
      const ids = new Map<string, number>();
      for (const row of rows) if (row.owner_id === owner) ids.set(row.id, (ids.get(row.id) ?? 0) + 1);
      for (const row of rows) {
        if (row.owner_id !== owner || ids.get(row.id) !== 1
          || !normaliseGrowerPlanningScope({ kind: 'unmapped-workspace', workspaceId: `design:${row.id}` })) continue;
        const revision = JSON.stringify(row);
        const inspection = inspectGrowerWorkflowSource({ kind: 'facilitator-cloud', sourceId: row.id, raw: row, sourceRevision: revision });
        if (inspection.status !== 'inspected' || !wanted(inspection)) continue;
        const source = await fingerprintGrowerWorkflowSource(inspection);
        if (!current() || JSON.stringify(row) !== revision) return held('context-changed');
        if (source.status === 'ready') candidates.push(source);
      }
    }
    const contexts: GrowerCycleContext[] = [], sourceReceipts: string[][] = [];
    for (const need of needs.values()) {
      const found = matches(need);
      if (found.length !== 1) { heldSources.push({ reason: found.length ? 'ambiguous-current-source' : 'current-source-unavailable', scopeKey: need.scopeKey }); continue; }
      const source = found[0];
      const provisionalContext = need.reviews.length ? createProvisionalCycleContext(source, provisionalSiteConditions(currentPlanningSupport(
        source.scope.kind === 'mapped-site' ? source.scope.siteId : null,
        source.scope.kind === 'unmapped-workspace' ? source.scope.workspaceId : null)), reviewedAt) : null;
      if (need.reviews.length && !provisionalContext) { heldSources.push({ reason: 'current-provisional-context-unavailable', scopeKey: need.scopeKey }); continue; }
      contexts.push({ scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint,
        ...(provisionalContext ? { provisionalContext } : {}) });
      sourceReceipts.push([source.sourceKey, source.sourceRevision]);
    }
    if (!current()) return held('context-changed');
    binding.sources = JSON.stringify(sourceReceipts.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    const result: Ready = freeze({ status: 'ready', book, contexts, heldSources });
    bindings.set(result, binding); return result;
  } catch { return held('source-read-unavailable'); }
}

/** Synchronous local/actor guard immediately before an action, after any await. */
export function isGrowerOperationsCurrent(result: GrowerOperationsSources): boolean {
  const binding = result.status === 'ready' ? bindings.get(result) : undefined;
  return !!binding && localCurrent(binding);
}

/** Each requery records its actual read time. Compare its source/site/day facts,
 * rather than requiring two independent reads to occur in the same millisecond. */
function currentContextFacts(contexts: readonly GrowerCycleContext[]): string {
  return JSON.stringify(contexts.map(context => ({ ...context, ...(context.provisionalContext
    ? { provisionalContext: { ...context.provisionalContext, reviewedAt: null } } : {}) })));
}

/** Requery cloud snapshots without replacing the original ready-object binding.
 * This is a current fetched copy, never a cloud compare-and-swap receipt. */
export async function checkGrowerOperationsCurrent(result: GrowerOperationsSources, options: { isCurrent?: () => boolean } = {}): Promise<boolean> {
  const previous = result.status === 'ready' ? bindings.get(result) : undefined;
  if (!previous || !isGrowerOperationsCurrent(result)) return false;
  const fresh = await loadGrowerOperationsSources(options);
  const next = fresh.status === 'ready' ? bindings.get(fresh) : undefined;
  return !!next && (options.isCurrent?.() ?? true) && isGrowerOperationsCurrent(result)
    && next.token === previous.token && next.sources === previous.sources
    && currentContextFacts(fresh.contexts) === currentContextFacts(result.contexts)
    && JSON.stringify(fresh.heldSources) === JSON.stringify(result.heldSources);
}
