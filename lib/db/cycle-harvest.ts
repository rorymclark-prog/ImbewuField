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
import { getFirebase } from '../firebase/init';
import type { GrowerReportHarvest } from '../grower-progress-report';
import {
  addSandboxCycleHarvestLink, getSandboxCycleHarvestLinks, getSandboxProduction, readSampleModeFlag, removeSandboxCycleHarvestLink,
} from '../sample-mode';
import type { ProductionLog } from './types';

export type CycleHarvestOptions =
  | { status: 'ready'; options: readonly CycleHarvestOption[]; linked?: readonly CycleHarvestSelection[] }
  | { status: 'held'; options: readonly [] };

export type CycleHarvestSave =
  | { status: 'saved' }
  | { status: 'conflict' }
  | { status: 'held' };

type Current = () => boolean;

const heldOptions: CycleHarvestOptions = { status: 'held', options: [] };
const heldReport: GrowerReportHarvest = { status: 'held' };
const unavailable: CycleHarvestSave = { status: 'held' };
const saved: CycleHarvestSave = { status: 'saved' };
const conflict: CycleHarvestSave = { status: 'conflict' };

function captureActor(sourceIsCurrent: Current) {
  const sample = readSampleModeFlag();
  if (sample === null || !sourceIsCurrent()) return null;
  const firebase = sample ? null : getFirebase();
  const owner = sample ? 'demo' : firebase?.auth.currentUser?.uid;
  if (!owner) return null;
  const isCurrent = () => sourceIsCurrent() && readSampleModeFlag() === sample
    && (sample || activeAccountUid() === owner && getFirebase()?.auth.currentUser?.uid === owner);
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
      const old = getSandboxCycleHarvestLinks().get(storageId);
      if (!sourceMatches(source) || !actor.isCurrent()) return unavailable;
      if (old) return sameCycleHarvestLink(old, link) ? saved : conflict;
      addSandboxCycleHarvestLink(storageId, link);
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
      const existing = getSandboxCycleHarvestLinks().get(storageId);
      if (!actor.isCurrent()) return unavailable;
      if (!existing) return saved;
      if (!sameCycleHarvestLink(existing, link)) return conflict;
      removeSandboxCycleHarvestLink(storageId);
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
    ? [...getSandboxCycleHarvestLinks()].map(([id, value]) => ({ id, value }))
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

async function readLinkedHarvests(
  actor: Actor, reference: GrowerJournalLink, cropKey: string,
): Promise<GrowerReportHarvest> {
  if (!actor.isCurrent()) return heldReport;
  const admitted = await readLinkRows(actor, reference.plantingId);
  if (!actor.isCurrent()) return heldReport;
  const outcomes = await Promise.all(admitted.map(async row => {
    const expected = checkedLink(row, reference, cropKey);
    if (!expected || (!actor.sample && expected.observedOn > todayISODate()) || !actor.isCurrent()) return null;
    try {
      const option = actor.sample ? sampleOption(actor, expected.recordId)
        : serverOption(await getDocFromServer(doc(production(actor), expected.recordId)), actor.owner);
      if (!option || !cycleHarvestCropMatches(option, cropKey) || !actor.isCurrent()) return null;
      return { recordId: option.recordId, observedOn: expected.observedOn, quantity: option.quantity, unit: option.unit };
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

/** The exporter re-reads server-confirmed entries through its handoff guard.
 * A missing, pending or inaccessible record can never stand in for a harvest. */
export async function captureCycleHarvestReport(
  reference: GrowerJournalLink, cropKey: string, isCurrent: Current,
): Promise<CycleHarvestReportRead> {
  const unavailableRead = { evidence: heldReport, checkCurrent: async () => isCurrent(), isCurrent };
  try {
    const actor = captureActor(isCurrent);
    if (!actor) return unavailableRead;
    const evidence = await readLinkedHarvests(actor, reference, cropKey);
    if (evidence.status !== 'ready') return unavailableRead;
    const signature = JSON.stringify(evidence);
    const sampleBook = actor.sample ? getSandboxProduction() : null;
    const sampleLinks = actor.sample ? getSandboxCycleHarvestLinks() : null;
    const stillCurrent = () => actor.isCurrent() && (!actor.sample
      || getSandboxProduction() === sampleBook && getSandboxCycleHarvestLinks() === sampleLinks);
    return { evidence, isCurrent: stillCurrent, checkCurrent: async () => stillCurrent()
      && JSON.stringify(await readLinkedHarvests(actor, reference, cropKey)) === signature && stillCurrent() };
  } catch { return unavailableRead; }
}
