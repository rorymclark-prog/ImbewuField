import {
  collection, doc, getDocFromServer, getDocsFromServer, query, runTransaction, where,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { activeAccountUid } from '../account-local-storage';
import {
  CYCLE_HARVEST_LINK_KIND, cycleHarvestCropMatches, cycleHarvestDocumentId, cycleHarvestOption,
  makeCycleHarvestLink, sameCycleHarvestLink, sameCycleHarvestOption, validCycleHarvestRecordId,
  type CycleHarvestLink, type CycleHarvestOption, type CycleHarvestSelection,
} from '../cycle-harvest';
import { isJournalDate, todayISODate, type GrowerJournalLink } from '../field-journal';
import { recordUnit, type RecordUnit } from '../farm-records';
import { getFirebase } from '../firebase/init';
import type { GrowerReportHarvest } from '../grower-progress-report';
import { getSandboxProduction, getSandboxProfile, getSandboxSales, SAMPLE_MODE_EVENT } from '../sample-mode';
import { checkBuyerSaleRows } from '../international/buyer-fulfilment-source';
import type { CheckedFulfilmentSource } from '../international/buyer-fulfilment';
import type { ProductionLog, SalesLog } from './types';

export type CycleHarvestOptions =
  | { status: 'ready'; options: readonly CycleHarvestOption[]; linked?: readonly CycleHarvestSelection[] }
  | { status: 'held'; options: readonly [] };

export type CycleHarvestSave =
  | { status: 'saved' }
  | { status: 'conflict' }
  | { status: 'held' };

type Current = () => boolean;

const heldOptions: CycleHarvestOptions = { status: 'held', options: [] };
const heldReport = { status: 'held' } as const;
const unavailable: CycleHarvestSave = { status: 'held' };
const saved: CycleHarvestSave = { status: 'saved' };
const conflict: CycleHarvestSave = { status: 'conflict' };

function readSampleModeFlag(): boolean | null {
  try { return typeof window === 'undefined' ? null : window.sessionStorage.getItem('imbewu_sample_mode') === '1'; }
  catch { return null; }
}

// The association contains no harvest values. Bind it to the existing demo
// lifecycle without changing the historical sample module or device storage.
type SampleScope = { links: ReadonlyMap<string, CycleHarvestLink> };
const sampleScopes = new WeakMap<Window, SampleScope>();
function sampleScope() {
  const existing = sampleScopes.get(window);
  if (existing) return existing;
  const target = window;
  const scope: SampleScope = { links: new Map() };
  sampleScopes.set(target, scope);
  target.addEventListener(SAMPLE_MODE_EVENT, () => { sampleScopes.set(target, { links: new Map() }); });
  return scope;
}

function captureActor(sourceIsCurrent: Current) {
  const sample = readSampleModeFlag();
  if (sample === null || !sourceIsCurrent()) return null;
  const firebase = sample ? null : getFirebase();
  const scope = sample ? sampleScope() : null;
  const owner = sample ? getSandboxProfile().id : firebase?.auth.currentUser?.uid;
  if (!owner) return null;
  const isCurrent = () => sourceIsCurrent() && readSampleModeFlag() === sample
    && (scope ? sampleScope() === scope && getSandboxProfile().id === owner
      : activeAccountUid() === owner && getFirebase()?.auth.currentUser?.uid === owner);
  return isCurrent() ? { owner, sample, db: firebase?.db ?? null, isCurrent } : null;
}
type Actor = NonNullable<ReturnType<typeof captureActor>>;

/** Keep the association in the existing owner-only map data. Staff who can
 * read a harvest row do not acquire the grower's private design or cycle IDs. */
const privateLinks = (actor: Actor) => collection(actor.db!, 'user_map_data', actor.owner, 'data');
const production = (actor: Actor) => collection(actor.db!, 'production_logs');

function serverOption(snapshot: DocumentSnapshot, owner: string): CycleHarvestOption | null {
  if (!snapshot.exists() || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return null;
  return cycleHarvestOption(snapshot.id, snapshot.data() as ProductionLog, owner);
}

function sampleOption(actor: Actor, recordId: string): CycleHarvestOption | null {
  const row = getSandboxProduction().find(record => record.id === recordId);
  return row ? cycleHarvestOption(row.id, row, actor.owner) : null;
}

function linkedOption(id: string, row: ProductionLog, owner: string, forGarden: boolean): CycleHarvestOption | null {
  const option = cycleHarvestOption(id, row, owner);
  if (option || !forGarden || row.profile_id !== owner || !validCycleHarvestRecordId(id)
    || typeof row.crop !== 'string' || !row.crop.trim()) return option;
  const unit = recordUnit(row);
  // Read an explicit zero if an already linked source now contains one.
  // Existing harvest entry and link controls keep their positive-quantity contract.
  if (!unit || row.quantity !== 0 || (unit === 'kg' ? row.kg !== 0 : row.kg !== null)) return null;
  return { recordId: id, crop: row.crop, quantity: 0, unit, enteredAt: null };
}

function entryDay(value: unknown): string | null {
  if (isJournalDate(value)) return value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !isJournalDate(value.slice(0, 10))) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}

export async function readCycleHarvestOptions(
  cropKey: string, isCurrent: Current, reference?: GrowerJournalLink,
): Promise<CycleHarvestOptions> {
  try {
    const actor = captureActor(isCurrent);
    if (!actor) return heldOptions;
    const rows = actor.sample ? getSandboxProduction().map(row => cycleHarvestOption(row.id, row, actor.owner))
      : (await getDocsFromServer(query(production(actor), where('profile_id', '==', actor.owner))))
        .docs.map(row => serverOption(row, actor.owner));
    if (!actor.isCurrent()) return heldOptions;
    const links = reference ? await readLinkRows(actor, reference.plantingId) : [];
    if (!actor.isCurrent()) return heldOptions;
    const linked = reference ? links.flatMap(row => {
      const link = checkedLink(row, reference, cropKey);
      return link ? [{ recordId: link.recordId, observedOn: link.observedOn }] : [];
    }) : [];
    const options = rows.filter((row): row is CycleHarvestOption => !!row && cycleHarvestCropMatches(row, cropKey));
    options.sort((a, b) => (b.enteredAt ?? '').localeCompare(a.enteredAt ?? '') || a.recordId.localeCompare(b.recordId));
    return { status: 'ready', options: Object.freeze(options.map(row => Object.freeze(row))),
      linked: Object.freeze(linked.map(link => Object.freeze(link))) };
  } catch { return heldOptions; }
}

export async function linkExistingCycleHarvest(
  link: CycleHarvestLink, selected: CycleHarvestOption, isCurrent: Current,
): Promise<CycleHarvestSave> {
  try {
    const actor = captureActor(isCurrent);
    if (!actor || !validCycleHarvestRecordId(link.recordId) || !isJournalDate(link.observedOn)
      || !actor.sample && link.observedOn > todayISODate()
      || selected.recordId !== link.recordId || !cycleHarvestCropMatches(selected, link.cropKey)) return unavailable;
    const storageId = cycleHarvestDocumentId(link.recordId);
    const sourceMatches = (source: CycleHarvestOption | null) => !!source && sameCycleHarvestOption(source, selected);
    if (actor.sample) {
      const source = sampleOption(actor, link.recordId);
      const old = sampleScope().links.get(storageId);
      if (!sourceMatches(source) || !actor.isCurrent()) return unavailable;
      if (old) return sameCycleHarvestLink(old, link) ? saved : conflict;
      const scope = sampleScope();
      scope.links = new Map([...scope.links, [storageId, Object.freeze(link)]]);
      return actor.isCurrent() ? saved : unavailable;
    }
    const target = doc(privateLinks(actor), storageId);
    const source = doc(production(actor), link.recordId);
    const result = await runTransaction(actor.db!, async transaction => {
      if (!actor.isCurrent()) return unavailable;
      const record = await transaction.get(source);
      if (!actor.isCurrent() || !sourceMatches(serverOption(record, actor.owner))) return unavailable;
      const existing = await transaction.get(target);
      if (!actor.isCurrent()) return unavailable;
      if (existing.exists()) return sameCycleHarvestLink(existing.data(), link) ? saved : conflict;
      transaction.set(target, link);
      return saved;
    });
    return actor.isCurrent() ? result : unavailable;
  } catch { return unavailable; }
}

export async function unlinkExistingCycleHarvest(link: CycleHarvestLink, isCurrent: Current): Promise<CycleHarvestSave> {
  try {
    const actor = captureActor(isCurrent);
    if (!actor || !validCycleHarvestRecordId(link.recordId)) return unavailable;
    const storageId = cycleHarvestDocumentId(link.recordId);
    if (actor.sample) {
      const existing = sampleScope().links.get(storageId);
      if (!actor.isCurrent()) return unavailable;
      if (!existing) return saved;
      if (!sameCycleHarvestLink(existing, link)) return conflict;
      const scope = sampleScope(), links = new Map(scope.links);
      links.delete(storageId);
      scope.links = links;
      return actor.isCurrent() ? saved : unavailable;
    }
    const target = doc(privateLinks(actor), storageId);
    const result = await runTransaction(actor.db!, async transaction => {
      if (!actor.isCurrent()) return unavailable;
      const existing = await transaction.get(target);
      if (!actor.isCurrent()) return unavailable;
      if (!existing.exists()) return saved;
      if (!sameCycleHarvestLink(existing.data(), link)) return conflict;
      transaction.delete(target);
      return saved;
    });
    return actor.isCurrent() ? result : unavailable;
  } catch { return unavailable; }
}

type LinkRow = { id: string; value: Partial<CycleHarvestLink>; pending?: boolean };

async function readLinkRows(actor: Actor, plantingId: string): Promise<LinkRow[]> {
  const rows: LinkRow[] = actor.sample
    ? [...sampleScope().links].map(([id, value]) => ({ id, value }))
    : (await getDocsFromServer(query(privateLinks(actor), where('plantingId', '==', plantingId))))
      .docs.map(row => ({ id: row.id, value: row.data(), pending: row.metadata.hasPendingWrites || row.metadata.fromCache }));
  return rows.filter(row => row.id.startsWith(CYCLE_HARVEST_LINK_KIND + '-') && row.value.plantingId === plantingId);
}

function checkedLink({ id, value, pending }: LinkRow, reference: GrowerJournalLink, cropKey: string) {
  if (pending || !validCycleHarvestRecordId(value.recordId) || !isJournalDate(value.observedOn)
    || id !== cycleHarvestDocumentId(value.recordId)) return null;
  const expected = makeCycleHarvestLink(reference, cropKey, { recordId: value.recordId, observedOn: value.observedOn });
  return expected && sameCycleHarvestLink(value, expected) ? expected : null;
}

type LinkedHarvestRow = { recordId: string; observedOn: string; recordedOn: string | null; quantity: number; unit: RecordUnit };
type LinkedHarvestEvidence = { status: 'held' }
  | { status: 'ready'; rows: readonly LinkedHarvestRow[]; incomplete: boolean };

async function readLinkedHarvests(
  actor: Actor, reference: GrowerJournalLink, cropKey: string, forGarden: boolean,
): Promise<LinkedHarvestEvidence> {
  if (!actor.isCurrent()) return heldReport;
  const admitted = await readLinkRows(actor, reference.plantingId);
  if (!actor.isCurrent()) return heldReport;
  const outcomes = await Promise.all(admitted.map(async row => {
    const expected = checkedLink(row, reference, cropKey);
    if (!expected || (!actor.sample && expected.observedOn > todayISODate()) || !actor.isCurrent()) return null;
    try {
      const snapshot = actor.sample ? null : await getDocFromServer(doc(production(actor), expected.recordId));
      const row = snapshot === null ? getSandboxProduction().find(item => item.id === expected.recordId)
        : snapshot.exists() && !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites
          ? snapshot.data() as ProductionLog : undefined;
      const option = row && linkedOption(expected.recordId, row, actor.owner, forGarden);
      if (!option || !cycleHarvestCropMatches(option, cropKey) || !actor.isCurrent()) return null;
      return { recordId: option.recordId, observedOn: expected.observedOn, recordedOn: forGarden ? entryDay(row.logged_at) : null,
        quantity: option.quantity, unit: option.unit };
    } catch { return null; }
  }));
  if (!actor.isCurrent()) return heldReport;
  const results = outcomes.flatMap(row => row ? [row] : []);
  results.sort((a, b) => a.observedOn.localeCompare(b.observedOn) || a.recordId.localeCompare(b.recordId));
  return { status: 'ready', rows: results, incomplete: results.length !== admitted.length };
}

export interface CycleHarvestReportRead {
  evidence: GrowerReportHarvest;
  checkCurrent: () => Promise<boolean>;
  isCurrent: Current;
}

export interface GardenCycleHarvestRead {
  evidence: LinkedHarvestEvidence;
  checkCurrent: () => Promise<boolean>;
  isCurrent: Current;
}

/** The exporter re-reads server-confirmed entries through its handoff guard.
 * A missing, pending or inaccessible record can never stand in for a harvest. */
async function captureLinkedHarvests(
  reference: GrowerJournalLink, cropKey: string, isCurrent: Current, forGarden: boolean,
): Promise<GardenCycleHarvestRead> {
  const unavailableRead = { evidence: heldReport, checkCurrent: async () => isCurrent(), isCurrent };
  try {
    const actor = captureActor(isCurrent);
    if (!actor) return unavailableRead;
    const evidence = await readLinkedHarvests(actor, reference, cropKey, forGarden);
    if (evidence.status !== 'ready') return unavailableRead;
    const signature = JSON.stringify(evidence);
    const sampleBook = actor.sample ? getSandboxProduction() : null;
    const sampleLinks = actor.sample ? sampleScope().links : null;
    const stillCurrent = () => actor.isCurrent() && (!actor.sample
      || getSandboxProduction() === sampleBook && sampleScope().links === sampleLinks);
    return { evidence, isCurrent: stillCurrent, checkCurrent: async () => stillCurrent()
      && JSON.stringify(await readLinkedHarvests(actor, reference, cropKey, forGarden)) === signature && stillCurrent() };
  } catch { return unavailableRead; }
}

export async function captureCycleHarvestReport(
  reference: GrowerJournalLink, cropKey: string, isCurrent: Current,
): Promise<CycleHarvestReportRead> {
  const captured = await captureLinkedHarvests(reference, cropKey, isCurrent, false);
  const { evidence } = captured;
  return { ...captured, evidence: evidence.status === 'held' ? heldReport
    : { ...evidence, rows: evidence.rows.map(({ recordId, observedOn, quantity, unit }) => ({ recordId, observedOn, quantity, unit })) } };
}

export function captureGardenCycleHarvest(
  reference: GrowerJournalLink, cropKey: string, isCurrent: Current,
): Promise<GardenCycleHarvestRead> {
  return captureLinkedHarvests(reference, cropKey, isCurrent, true);
}

export interface BuyerSaleRead {
  readonly sources: readonly CheckedFulfilmentSource[];
  readonly incomplete: boolean;
  readonly isCurrent: Current;
  readonly checkCurrent: () => Promise<boolean>;
}

/** Sales evidence uses the same captured account and sample lifetime as the
 * harvest links. The normal cached sales list is for display only. */
export async function captureBuyerSaleEvidence(viewCurrent: Current): Promise<BuyerSaleRead | null> {
  try {
    const actor = captureActor(viewCurrent);
    if (!actor) return null;
    const sampleSales = actor.sample ? getSandboxSales() : null;
    const isCurrent = () => actor.isCurrent() && (!actor.sample || getSandboxSales() === sampleSales);
    const read = async () => {
      if (!isCurrent()) return null;
      if (sampleSales) {
        const result = await checkBuyerSaleRows(sampleSales.map(value => ({ id: value.id, value })), actor.owner);
        return isCurrent() ? result : null;
      }
      const snapshot = await getDocsFromServer(query(collection(actor.db!, 'sales_logs'), where('profile_id', '==', actor.owner)));
      if (!isCurrent() || snapshot.metadata.fromCache) return null;
      const result = await checkBuyerSaleRows(snapshot.docs.map(row => ({
        id: row.id, value: row.data() as SalesLog, pending: row.metadata.fromCache || row.metadata.hasPendingWrites,
      })), actor.owner);
      return isCurrent() ? result : null;
    };
    const result = await read();
    if (!result) return null;
    const signature = JSON.stringify(result);
    const checkCurrent = async () => {
      try { return isCurrent() && JSON.stringify(await read()) === signature && isCurrent(); }
      catch { return false; }
    };
    return Object.freeze({ ...result, isCurrent, checkCurrent });
  } catch { return null; }
}
