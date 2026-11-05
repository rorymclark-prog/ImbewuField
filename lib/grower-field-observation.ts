import { cropByKey } from './crop-catalog';
import {
  createJournalEntry, isJournalDate, MAX_ENTRIES, MAX_NOTES_LEN,
  JOURNAL_BYTE_BUDGET, JOURNAL_CHANGED_EVENT, inspectJournalRowsForWrite, normaliseJournalNurserySowingObservation, normaliseJournalNurseryProgressObservation,
  type JournalEntry, type JournalNurserySowingObservation, type JournalNurseryProgressObservation,
} from './field-journal';
import { resolveGrowerJournalLink } from './task-record-link';
import { buildGrowerBoardTasks, type BoardTask } from './task-board';
import {
  captureJournalObservationContext, journalObservationContextIsCurrent, revokeJournalObservationContext,
} from './length-unit-preference';
import {
  checkGrowerOperationsCurrent, isGrowerOperationsCurrent, type GrowerOperationsSources,
} from './international/grower-operations-source';
import { initialiseJournalStorage, readJournalStorage, writeJournalStorageRaw, JOURNAL_LEGACY_KEY } from './journal-storage';
import { activeAccountLocalStorageKey } from './account-local-storage';
import { growerPlanningScopeKey } from './international/grower-planning';
import { resolveGrowerNurseryBatchReference } from './international/grower-nursery';
import { detachJsonData } from './lossless-json';

export interface GrowerFieldObservationInput {
  readonly observedDate: string;
  readonly note: string;
  readonly confirmed: true;
}
export interface GrowerNurserySowingInput extends GrowerFieldObservationInput {
  readonly traysUsed: number | null;
}
export interface GrowerNurseryProgressInput extends GrowerFieldObservationInput {
  readonly plantsObserved: number;
  readonly stage: JournalNurseryProgressObservation['stage'];
  readonly coverage: JournalNurseryProgressObservation['coverage'];
}
export interface GrowerFieldObservationResult {
  readonly status: 'saved' | 'held' | 'unconfirmed';
  readonly message: string;
  readonly journalEntryId?: string;
}
const held = (message: string): GrowerFieldObservationResult => ({ status: 'held', message });
const changed = () => held('The saved plan, design or account changed. Check its current records before writing a field note.');
const journalHeld = () => held('The field journal needs a storage check. Open the journal to review its saved copies before writing this note.');
const unconfirmed = (id: string): GrowerFieldObservationResult => ({ status: 'unconfirmed', journalEntryId: id,
  message: 'A journal write was attempted, but its final receipt could not be confirmed. Check the journal before recording this note again.' });

function inputSnapshot(value: unknown): GrowerFieldObservationInput | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const fields = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(fields).length !== 3 || !['observedDate', 'note', 'confirmed'].every(key => fields[key] && 'value' in fields[key])) return null;
    const observedDate: unknown = fields.observedDate.value, note: unknown = fields.note.value;
    if (fields.confirmed.value !== true || !isJournalDate(observedDate) || typeof note !== 'string'
      || !note.trim() || note.length > MAX_NOTES_LEN) return null;
    return { observedDate, note, confirmed: true };
  } catch { return null; }
}

/** A note is an explicit observation in the existing journal. Current planning
 * sources establish only its link, never that an event or a quantity occurred. */
export async function recordGrowerFieldObservation(
  source: GrowerOperationsSources,
  task: BoardTask,
  value: GrowerFieldObservationInput,
  options: { isCurrent: () => boolean },
): Promise<GrowerFieldObservationResult> {
  const input = inputSnapshot(value);
  if (!input) return held('Choose the day you observed the work, enter a field note and confirm it before saving.');
  return appendObservation(source, task, input, options);
}

function nurseryInputFields(value: unknown, keys: readonly string[]): PropertyDescriptorMap | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const fields = Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(fields).length === keys.length
      && keys.every(key => fields[key]?.enumerable && 'value' in fields[key]) ? fields : null;
  } catch { return null; }
}
function sowingInputSnapshot(value: unknown): GrowerNurserySowingInput | null {
  const fields = nurseryInputFields(value, ['observedDate', 'note', 'confirmed', 'traysUsed']);
  if (!fields) return null;
  const generic = inputSnapshot({ observedDate: fields.observedDate.value, note: fields.note.value, confirmed: fields.confirmed.value });
  const traysUsed: unknown = fields.traysUsed.value;
  if (!generic || traysUsed !== null && (typeof traysUsed !== 'number' || !Number.isSafeInteger(traysUsed) || traysUsed < 0)) return null;
  return { ...generic, traysUsed: traysUsed as number | null };
}
function progressInputSnapshot(value: unknown): GrowerNurseryProgressInput | null {
  const fields = nurseryInputFields(value, ['observedDate', 'note', 'confirmed', 'plantsObserved', 'stage', 'coverage']);
  if (!fields) return null;
  const generic = inputSnapshot({ observedDate: fields.observedDate.value, note: fields.note.value, confirmed: fields.confirmed.value });
  // The canonical observation model owns stage, coverage and count semantics.
  // Current labels are resolved only after authenticating this saved task.
  const observation = normaliseJournalNurseryProgressObservation({ kind: 'nursery-progress-observation', version: 1,
    plantsObserved: fields.plantsObserved.value, stage: fields.stage.value, coverage: fields.coverage.value,
    references: { variety: null, seedLotReference: null, raisingBatchReference: null } });
  return generic && observation ? { ...generic, plantsObserved: observation.plantsObserved,
    stage: observation.stage, coverage: observation.coverage } : null;
}

/** Physical trays are an entered observation, independent of planned demand. */
export async function recordGrowerNurserySowing(
  source: GrowerOperationsSources, task: BoardTask, value: GrowerNurserySowingInput,
  options: { isCurrent: () => boolean },
): Promise<GrowerFieldObservationResult> {
  const input = sowingInputSnapshot(value);
  if (!input) return held('Enter the observed day, a note and a whole tray count or leave it unknown, then confirm the observation.');
  return appendNurseryObservation(source, task, input, options, 'sowing');
}

/** A point-in-time entered count is not available stock or a calculated rate. */
export async function recordGrowerNurseryProgress(
  source: GrowerOperationsSources, task: BoardTask, value: GrowerNurseryProgressInput,
  options: { isCurrent: () => boolean },
): Promise<GrowerFieldObservationResult> {
  const input = progressInputSnapshot(value);
  if (!input) return held('Enter the observed day, a note, a whole plant count, its stage and coverage, then confirm the observation.');
  return appendNurseryObservation(source, task, input, options, 'progress');
}

async function appendNurseryObservation(
  source: GrowerOperationsSources, task: BoardTask, input: GrowerNurserySowingInput | GrowerNurseryProgressInput,
  options: { isCurrent: () => boolean }, kind: 'sowing' | 'progress',
): Promise<GrowerFieldObservationResult> {
  let safeTask: BoardTask;
  try { safeTask = detachJsonData(task, { allowUndefinedObjectFields: true }) as BoardTask; }
  catch { return changed(); }
  return appendObservation(source, safeTask, input, options, kind);
}

async function appendObservation(
  source: GrowerOperationsSources, task: BoardTask, input: GrowerFieldObservationInput | GrowerNurserySowingInput | GrowerNurseryProgressInput,
  options: { isCurrent: () => boolean }, nurseryKind?: 'sowing' | 'progress',
): Promise<GrowerFieldObservationResult> {
  let attemptedEntry: string | null = null;
  const actor = captureJournalObservationContext();
  // Source checks read storage and call the original form guard. Either can
  // synchronously revoke the actor/form that was current before those reads.
  const current = () => journalObservationContextIsCurrent(actor) && options.isCurrent()
    && isGrowerOperationsCurrent(source) && options.isCurrent() && journalObservationContextIsCurrent(actor);
  try {
    if (source.status !== 'ready' || !current()) return changed();
    const generated = buildGrowerBoardTasks(source.book.plantings, source.contexts, new Date(), new Set()).tasks;
    const matches = generated.filter(row => row.id === task.id);
    if (task.kind !== 'grower-cycle' || matches.length !== 1 || !task.growerJournalLink
      || JSON.stringify(matches[0].growerJournalLink) !== JSON.stringify(task.growerJournalLink)) return changed();
    const link = resolveGrowerJournalLink(source.book.plantings, source.contexts, task.growerJournalLink);
    if (link.status !== 'ready') return changed();
    let sowing: JournalNurserySowingObservation | null = null;
    let progress: JournalNurseryProgressObservation | null = null;
    if (nurseryKind) {
      if (task.growerEventKind !== 'nursery-start' || link.link.eventKind !== 'nursery-start') return changed();
      const contexts = source.contexts.filter(context => growerPlanningScopeKey(context.scope) === growerPlanningScopeKey(link.link.scope));
      if (contexts.length !== 1) return changed();
      const reference = resolveGrowerNurseryBatchReference(source.book.plantings, contexts[0], link.link.plantingId);
      if (reference.status !== 'ready') return held(nurseryKind === 'sowing'
        ? 'The saved nursery references need a fresh check before recording sowing.'
        : 'The saved nursery references need a fresh check before recording a count.');
      if (nurseryKind === 'sowing') {
        sowing = normaliseJournalNurserySowingObservation({ kind: 'nursery-sowing-observation', version: 1,
          traysUsed: (input as GrowerNurserySowingInput).traysUsed, references: reference.fields });
      } else {
        const count = input as GrowerNurseryProgressInput;
        progress = normaliseJournalNurseryProgressObservation({ kind: 'nursery-progress-observation', version: 1,
          plantsObserved: count.plantsObserved, stage: count.stage, coverage: count.coverage, references: reference.fields });
      }
      if (!sowing && !progress) return held('The saved nursery references cannot be recorded faithfully. Check them before saving.');
    }
    await initialiseJournalStorage();
    if (!current()) return changed();
    const before = readJournalStorage();
    const sample = before.status === 'sample';
    const sampleStorage = sample ? window.localStorage : null;
    const sampleKey = sample ? activeAccountLocalStorageKey(JOURNAL_LEGACY_KEY) : null;
    const sampleRaw = sampleStorage && sampleKey ? sampleStorage.getItem(sampleKey) : null;
    if (!sample && (before.status !== 'ready' || !before.writable || !before.token || before.journalRaw === null)) return journalHeld();
    const rows = inspectJournalRowsForWrite(sample ? sampleRaw ?? '[]' : before.journalRaw!)?.rows;
    if (!rows || rows.length >= MAX_ENTRIES) return journalHeld();
    if (!await checkGrowerOperationsCurrent(source, { isCurrent: current }) || !current()) return changed();
    const fresh = readJournalStorage();
    if (sample ? fresh.status !== 'sample' || window.localStorage !== sampleStorage || sampleStorage!.getItem(sampleKey!) !== sampleRaw
      : fresh.token !== before.token || fresh.journalRaw !== before.journalRaw || !fresh.writable) return journalHeld();
    const bed = source.contexts.filter(context => growerPlanningScopeKey(context.scope) === growerPlanningScopeKey(link.link.scope))
      .flatMap(context => context.beds).find(row => row.id === link.bedId);
    const cropName = cropByKey(link.cropKey)?.name;
    const entry: JournalEntry = createJournalEntry({ date: input.observedDate, title: progress ? 'Nursery count' : sowing ? 'Nursery sowing' : 'Field note', notes: input.note,
      category: sowing || progress ? 'planting' : 'other', bedId: link.bedId, bedLabel: bed?.label ?? null, cropName: cropName ?? null,
      growerCycleLink: link.link, ...(sowing ? { nurserySowing: sowing } : {}), ...(progress ? { nurseryProgress: progress } : {}) });
    if (entry.bedId !== link.bedId) entry.bedId = null;
    // IDs are generated by the journal's existing authority. A collision must
    // hold rather than replace an older observation from the same task.
    if (rows.some(row => row.id === entry.id)) return journalHeld();
    const next = JSON.stringify([...rows, entry]);
    if (next.length > JOURNAL_BYTE_BUDGET) return held('The journal has no room for this note without removing existing records. Open the journal to review its storage.');
    if (!current()) return changed();
    if (sample && sampleStorage!.getItem(sampleKey!) !== sampleRaw) return journalHeld();
    // A storage read can synchronously withdraw the original sample/form proof.
    // Check after the last read, before any append has actually been attempted.
    if (!current()) return changed();
    attemptedEntry = entry.id;
    if (sample) {
      sampleStorage!.setItem(sampleKey!, next);
      if (!current() || readJournalStorage().status !== 'sample' || sampleStorage!.getItem(sampleKey!) !== next) return unconfirmed(entry.id);
      window.dispatchEvent(new CustomEvent(JOURNAL_CHANGED_EVENT));
      if (!current() || sampleStorage!.getItem(sampleKey!) !== next) return unconfirmed(entry.id);
      return { status: 'saved', journalEntryId: entry.id, message: progress
        ? 'DEMO nursery count saved in the sample journal. Your personal journal, planned batches, forecasts, checklist, harvest, stock and sales records have not changed.'
        : sowing
        ? 'DEMO nursery sowing saved in the sample journal. Your personal journal, planned batches, checklist, harvest, stock and sales records have not changed.'
        : 'DEMO field note saved for this sample session. Your personal journal, checklist and production records have not changed.' };
    }
    const written = writeJournalStorageRaw(next, before.token, undefined, current);
    if (written.status === 'held') return journalHeld();
    if (written.status === 'unconfirmed') return unconfirmed(entry.id);
    const saved = readJournalStorage();
    if (!current() || saved.token !== written.token || saved.journalRaw !== next) return unconfirmed(entry.id);
    return { status: 'saved', journalEntryId: entry.id,
      message: progress
        ? 'Nursery count saved in your journal with the observed day, coverage and reference snapshot. This observation does not change planned batches, forecasts, stock, checklist, harvest or sales.'
        : sowing
        ? 'Nursery sowing saved in your journal with the observed day and reference snapshot. Planned batches, checklist, harvest, stock and sales records have not changed.'
        : 'Field note saved in your journal with the day you entered. Checklist, harvest, stock and sales records have not changed.' };
  } catch {
    if (attemptedEntry !== null) return unconfirmed(attemptedEntry);
    return held('The current records could not be checked. Your field note has not been confirmed as saved.');
  } finally { revokeJournalObservationContext(actor); }
}
