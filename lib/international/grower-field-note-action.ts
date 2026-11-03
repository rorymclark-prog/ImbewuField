import { readAccountLocalSampleState } from '../account-local-storage';
import type { CropPlanState } from '../crop-plan';
import { isBackendConfigured } from '../firebase/init';
import { openCanonicalJournal, writeCanonicalJournal, type CanonicalJournalView,
  type CanonicalJournalWriteResult, type JournalEntryInput } from '../field-journal';
import { getGrowerTaskJournalLink, type BoardTask } from '../task-board';
import type { GrowerCycleContext } from './grower-cycle';
import { resolveGrowerFieldNoteLink, type GrowerFieldNoteLink } from './grower-field-note-link';
import { growerPlanningScopeKey } from './grower-planning';

export interface GrowerFieldNoteSource {
  readonly book: Pick<CropPlanState, 'plantings'>;
  readonly contexts: readonly GrowerCycleContext[];
  checkCurrent: () => Promise<boolean>;
  isCurrent: () => boolean;
}

export interface GrowerFieldNoteDraft {
  readonly bedLabel: string | null;
}

interface DraftBinding {
  readonly source: GrowerFieldNoteSource;
  readonly selection: GrowerFieldNoteLink;
  readonly view: Extract<CanonicalJournalView, { status: 'ready' }>;
  pending: boolean;
}

const drafts = new WeakMap<GrowerFieldNoteDraft, DraftBinding>();
const changed = { status: 'held', reason: 'context-changed' } as const;

export function canOpenGrowerFieldNote(): boolean {
  // Linked notes depend on the new journal. Account transfer and sample
  // isolation must pass their own gates before enabling those modes.
  return !isBackendConfigured() && readAccountLocalSampleState() === false;
}

function currentLink(source: GrowerFieldNoteSource, selection: GrowerFieldNoteLink) {
  const scope = growerPlanningScopeKey(selection.scope);
  const contexts = source.contexts.filter(context => growerPlanningScopeKey(context.scope) === scope);
  if (!scope || contexts.length !== 1) return null;
  const context = contexts[0];
  const resolved = resolveGrowerFieldNoteLink(source.book.plantings, context, selection);
  if (resolved.status !== 'resolved') return null;
  const label = context.beds.find(bed => bed.id === resolved.link.bedId)?.label;
  return { link: resolved.link, bedLabel: typeof label === 'string' && label.trim() ? label : null };
}

/** Capture the exact journal view while opening an explicitly requested note.
 * The task object is checked in memory and never put in navigation state. */
export async function openGrowerFieldNote(task: BoardTask, source: GrowerFieldNoteSource): Promise<GrowerFieldNoteDraft | null> {
  try {
    const selection = getGrowerTaskJournalLink(task);
    if (!selection || !canOpenGrowerFieldNote() || !source.isCurrent() || !await source.checkCurrent()) return null;
    if (!canOpenGrowerFieldNote() || !source.isCurrent()) return null;
    const context = currentLink(source, selection);
    if (!context) return null;
    const view = await openCanonicalJournal();
    if (view.status !== 'ready' || !canOpenGrowerFieldNote() || !source.isCurrent()) return null;
    const draft = Object.freeze({ bedLabel: context.bedLabel });
    drafts.set(draft, { source, selection: context.link, view, pending: false });
    return draft;
  } catch { return null; }
}

export function closeGrowerFieldNote(draft: GrowerFieldNoteDraft): void {
  drafts.delete(draft);
}

/** The observation date comes only from the form. Recheck the original
 * planner source, resolve membership again, then let the journal verify its
 * original view and perform the single locked append. */
export async function saveGrowerFieldNote(
  draft: GrowerFieldNoteDraft,
  input: JournalEntryInput,
): Promise<CanonicalJournalWriteResult> {
  const binding = drafts.get(draft);
  if (!binding || binding.pending) return changed;
  const current = () => drafts.get(draft) === binding && canOpenGrowerFieldNote() && binding.source.isCurrent();
  binding.pending = true;
  try {
    if (!current() || !await binding.source.checkCurrent() || !current()) return changed;
    const resolved = currentLink(binding.source, binding.selection);
    if (!resolved) return changed;
    // Pass the date descriptor as data so a getter cannot supply an observation.
    const date = Object.getOwnPropertyDescriptor(input, 'date')?.value;
    const { title, notes, category, cropName, photos } = input;
    const result = await writeCanonicalJournal(binding.view, {
      kind: 'append-linked',
      input: { date, title, notes, category, cropName, photos, bedId: resolved.link.bedId, bedLabel: resolved.bedLabel },
      selection: resolved.link,
      sourceIsCurrent: current,
    });
    if (result.status !== 'held') drafts.delete(draft);
    return result;
  } catch { return changed; }
  finally { binding.pending = false; }
}
