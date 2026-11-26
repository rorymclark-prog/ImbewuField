import { activeAccountUid } from './account-local-storage';
import { normaliseCanvasState, readCanvasSourceReceipt, type LineShape } from './design-canvas';
import { ELEMENTS_BY_ID } from './design-elements';
import { coordinateSiteIdForPlace } from './international/site-context';
import {
  captureJournalObservationContext,
  journalObservationContextIsCurrent,
  revokeJournalObservationContext,
  type JournalObservationContext,
} from './length-unit-preference';
import { buildPhasePlan, type PhaseKey } from './phasing';
import { isSampleMode } from './sample-mode';
import { readPlacesForPhaseObservation, type SavedPlace } from './saved-places';

const LINE_NAMES: Record<LineShape['kind'], string> = {
  swale: 'Swale', fence: 'Fence line', path: 'Walking path', bedpath: 'Bed path',
  pipe: 'Buried water pipe', drip: 'Drip irrigation line', windbreak: 'Windbreak hedge', greywater: 'Greywater line',
};

export interface PhaseJournalFeature {
  readonly id: string;
  readonly kind: 'item' | 'line';
  readonly label: string;
}

interface PhaseJournalChoice {
  readonly key: PhaseKey;
  readonly title: string;
  readonly features: readonly PhaseJournalFeature[];
}

export interface PhaseJournalSource {
  readonly siteId: string;
  readonly siteName: string;
  readonly phases: readonly PhaseJournalChoice[];
  readonly hasAmbiguousNames: boolean;
}

export interface PhaseJournalLink {
  readonly version: 1;
  readonly siteId: string;
  readonly placeId: string;
  readonly siteName: string;
  readonly phaseKey: PhaseKey;
  readonly phaseTitle: string;
  readonly featureId: string;
  readonly featureKind: PhaseJournalFeature['kind'];
  readonly featureLabel: string;
}

interface SourceBinding {
  readonly context: JournalObservationContext;
  readonly placeId: string;
  readonly placeStamp: string;
  readonly placeName: string;
  readonly revision: string;
}

export interface PhaseJournalDraft {
  readonly link: PhaseJournalLink;
}

const sources = new WeakMap<PhaseJournalSource, SourceBinding>();
const drafts = new WeakMap<PhaseJournalDraft, SourceBinding>();
const SOURCE_ID_LIMIT = 240;
const LABEL_LIMIT = 120;

function validIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0
    && value.length <= SOURCE_ID_LIMIT && !/[\u0000-\u001f\u007f]/.test(value);
}

function visibleLabel(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, LABEL_LIMIT).trimEnd();
}

function namedPlaces(places: readonly SavedPlace[]): { place: SavedPlace; name: string }[] {
  const choices = places.flatMap(place => {
    const name = visibleLabel(place.name);
    return validIdentity(place.id) && name ? [{ place, name }] : [];
  });
  const counts = new Map<string, number>();
  const keyFor = (name: string) => name.normalize('NFKC').toLowerCase();
  for (const { name } of choices) counts.set(keyFor(name), (counts.get(keyFor(name)) ?? 0) + 1);
  return choices.map(choice => {
    if (counts.get(keyFor(choice.name)) === 1) return choice;
    const { lat, lon } = choice.place;
    return { ...choice, name: `${choice.name} · ${lat.toFixed(5)}, ${lon.toFixed(5)}` };
  });
}

export function phaseJournalSites(): readonly { id: string; name: string }[] {
  return namedPlaces(readPlacesForPhaseObservation()).map(({ place, name }) => ({ id: place.id, name }));
}

/** Inspect raw authored ids before the normalizer can collapse a duplicate. */
function uniqueFeatureIds(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || !('items' in raw) || !('lines' in raw) || !('zones' in raw)) return false;
  const seen = new Set<string>();
  for (const rows of [raw.items, raw.lines, raw.zones]) {
    if (!Array.isArray(rows)) return false;
    for (const row of rows) {
      if (!row || typeof row !== 'object' || !validIdentity(row.id) || seen.has(row.id)) return false;
      seen.add(row.id);
    }
  }
  return true;
}

function matchingRevision(binding: SourceBinding, siteId: string): boolean {
  if (!journalObservationContextIsCurrent(binding.context)) return false;
  const current = namedPlaces(readPlacesForPhaseObservation()).find(candidate => candidate.place.id === binding.placeId);
  if (!current || current.name !== binding.placeName || coordinateSiteIdForPlace(current.place) !== siteId
    || JSON.stringify(current.place) !== binding.placeStamp) return false;
  const receipt = readCanvasSourceReceipt(siteId);
  return receipt.status === 'ready' && receipt.ownerUid === activeAccountUid() && receipt.sample === isSampleMode()
    && receipt.revision === binding.revision && journalObservationContextIsCurrent(binding.context);
}

/** Phase membership comes from the same rules that produce the design sheet.
 * Its timing, tasks and hold points are intentionally outside this observation picker. */
export function reviewPhaseJournalSource(placeId: string): PhaseJournalSource | null {
  const context = captureJournalObservationContext();
  let admitted = false;
  try {
    if (!context || !journalObservationContextIsCurrent(context) || !validIdentity(placeId)) return null;
    const selected = namedPlaces(readPlacesForPhaseObservation()).find(candidate => candidate.place.id === placeId);
    if (!selected) return null;
    const { place, name: siteName } = selected;
    const siteId = coordinateSiteIdForPlace(place);
    if (!siteId) return null;
    const receipt = readCanvasSourceReceipt(siteId, { requireLosslessJson: true });
    if (receipt.status !== 'ready' || !uniqueFeatureIds(receipt.raw)) return null;
    const state = normaliseCanvasState(receipt.raw, siteId);
    if (!state || state.lines.some(line => !Object.hasOwn(LINE_NAMES, line.kind))) return null;

    const featureById = new Map<string, PhaseJournalFeature>();
    for (const item of state.items) {
      const name = Object.hasOwn(ELEMENTS_BY_ID, item.defId) ? ELEMENTS_BY_ID[item.defId].name : '';
      const label = visibleLabel(item.label ?? '') || visibleLabel(name);
      if (label) featureById.set(item.id, Object.freeze({ id: item.id, kind: 'item', label }));
    }
    for (const line of state.lines) {
      const label = visibleLabel(line.name ?? '') || LINE_NAMES[line.kind];
      featureById.set(line.id, Object.freeze({ id: line.id, kind: 'line', label }));
    }
    const plan = buildPhasePlan(state, { boundary: [], house: [], driveway: [] });
    let hasAmbiguousNames = false;
    const phases = plan.phases.flatMap(phase => {
      const features = phase.itemIds.flatMap(id => {
        const feature = featureById.get(id);
        return feature ? [feature] : [];
      });
      const nameCounts = new Map<string, number>();
      const nameKey = (feature: PhaseJournalFeature) => feature.label.toLowerCase();
      for (const feature of features) nameCounts.set(nameKey(feature), (nameCounts.get(nameKey(feature)) ?? 0) + 1);
      const distinct = features.filter(feature => nameCounts.get(nameKey(feature)) === 1);
      if (distinct.length !== features.length) hasAmbiguousNames = true;
      return distinct.length ? [Object.freeze({ key: phase.key, title: phase.title, features: Object.freeze(distinct) })] : [];
    });
    const binding = { context, placeId, placeStamp: JSON.stringify(place), placeName: siteName, revision: receipt.revision };
    if (!matchingRevision(binding, siteId)) return null;
    const source = Object.freeze({ siteId, siteName, phases: Object.freeze(phases), hasAmbiguousNames });
    sources.set(source, binding);
    admitted = true;
    return source;
  } catch {
    return null;
  } finally {
    if (!admitted) revokeJournalObservationContext(context);
  }
}

export function releasePhaseJournalSource(source: PhaseJournalSource | null): void {
  if (!source) return;
  const binding = sources.get(source);
  if (binding) revokeJournalObservationContext(binding.context);
  sources.delete(source);
}

export function confirmPhaseJournalFeature(source: PhaseJournalSource, phaseKey: string, featureId: string): PhaseJournalDraft | null {
  const binding = sources.get(source);
  if (!binding) return null;
  if (!matchingRevision(binding, source.siteId)) {
    releasePhaseJournalSource(source);
    return null;
  }
  const phase = source.phases.find(candidate => candidate.key === phaseKey);
  const feature = phase?.features.find(candidate => candidate.id === featureId);
  if (!phase || !feature) return null;
  sources.delete(source);
  const link: PhaseJournalLink = Object.freeze({
    version: 1, siteId: source.siteId, placeId: binding.placeId, siteName: source.siteName,
    phaseKey: phase.key, phaseTitle: phase.title, featureId: feature.id,
    featureKind: feature.kind, featureLabel: feature.label,
  });
  const draft = Object.freeze({ link });
  drafts.set(draft, binding);
  return draft;
}

export function releasePhaseJournalDraft(draft: PhaseJournalDraft | null | undefined): void {
  if (!draft) return;
  const binding = drafts.get(draft);
  if (binding) revokeJournalObservationContext(binding.context);
  drafts.delete(draft);
}

export function currentPhaseJournalLink(draft: PhaseJournalDraft): PhaseJournalLink | null {
  const binding = drafts.get(draft);
  try {
    if (binding && matchingRevision(binding, draft.link.siteId)) return draft.link;
  } catch { /* A failed read withdraws this confirmation. */ }
  releasePhaseJournalDraft(draft);
  return null;
}
