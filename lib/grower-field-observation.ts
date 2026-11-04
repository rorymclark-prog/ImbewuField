import { cropByKey } from './crop-catalog';
import {
  createJournalEntry, isJournalDate, MAX_ENTRIES, MAX_NOTES_LEN,
  JOURNAL_BYTE_BUDGET, JOURNAL_CHANGED_EVENT, inspectJournalRowsForWrite, type JournalEntry,
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

export interface GrowerFieldObservationInput {
  readonly observedDate: string;
  readonly note: string;
  readonly confirmed: true;
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
  let attemptedEntry: string | null = null;
  const actor = captureJournalObservationContext();
  const current = () => journalObservationContextIsCurrent(actor) && options.isCurrent()
    && isGrowerOperationsCurrent(source);
  try {
    if (source.status !== 'ready' || !current()) return changed();
    const generated = buildGrowerBoardTasks(source.book.plantings, source.contexts, new Date(), new Set()).tasks;
    const matches = generated.filter(row => row.id === task.id);
    if (task.kind !== 'grower-cycle' || matches.length !== 1 || !task.growerJournalLink
      || JSON.stringify(matches[0].growerJournalLink) !== JSON.stringify(task.growerJournalLink)) return changed();
    const link = resolveGrowerJournalLink(source.book.plantings, source.contexts, task.growerJournalLink);
    if (link.status !== 'ready') return changed();
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
    const entry: JournalEntry = createJournalEntry({ date: input.observedDate, title: 'Field note', notes: input.note,
      category: 'other', bedId: link.bedId, bedLabel: bed?.label ?? null, cropName: cropName ?? null,
      growerCycleLink: link.link });
    if (entry.bedId !== link.bedId) entry.bedId = null;
    // IDs are generated by the journal's existing authority. A collision must
    // hold rather than replace an older observation from the same task.
    if (rows.some(row => row.id === entry.id)) return journalHeld();
    const next = JSON.stringify([...rows, entry]);
    if (next.length > JOURNAL_BYTE_BUDGET) return held('The journal has no room for this note without removing existing records. Open the journal to review its storage.');
    if (!current()) return changed();
    if (sample && sampleStorage!.getItem(sampleKey!) !== sampleRaw) return journalHeld();
    attemptedEntry = entry.id;
    if (sample) {
      sampleStorage!.setItem(sampleKey!, next);
      if (!current() || readJournalStorage().status !== 'sample' || sampleStorage!.getItem(sampleKey!) !== next) return unconfirmed(entry.id);
      window.dispatchEvent(new CustomEvent(JOURNAL_CHANGED_EVENT));
      if (!current() || sampleStorage!.getItem(sampleKey!) !== next) return unconfirmed(entry.id);
      return { status: 'saved', journalEntryId: entry.id, message: 'DEMO field note saved for this sample session. Your personal journal, checklist and production records have not changed.' };
    }
    const written = writeJournalStorageRaw(next, before.token, undefined, current);
    if (written.status === 'held') return journalHeld();
    if (written.status === 'unconfirmed') return unconfirmed(entry.id);
    const saved = readJournalStorage();
    if (!current() || saved.token !== written.token || saved.journalRaw !== next) return unconfirmed(entry.id);
    return { status: 'saved', journalEntryId: entry.id,
      message: 'Field note saved in your journal with the day you entered. Checklist, harvest, stock and sales records have not changed.' };
  } catch {
    if (attemptedEntry !== null) return unconfirmed(attemptedEntry);
    return held('The current records could not be checked. Your field note has not been confirmed as saved.');
  } finally { revokeJournalObservationContext(actor); }
}
