import { captureGardenCycleHarvest } from '@/lib/db/cycle-harvest';
import { inspectJournalGrowerLink } from '@/lib/field-journal';
import { captureGrowerReportJournal } from '@/lib/grower-progress-report';
import { checkGrowerOperationsCurrent, isGrowerOperationsCurrent, type GrowerOperationsSources } from '@/lib/international/grower-operations-source';
import { growerPlanningScopeKey } from '@/lib/international/grower-planning';
import { isSampleMode } from '@/lib/sample-mode';
import { loadPlaces } from '@/lib/saved-places';
import { buildGrowerBoardTasks, type BoardTask } from '@/lib/task-board';
import { resolveGrowerJournalLink } from '@/lib/task-record-link';
import type { GardenNoteSource, GardenReportRecords } from './garden-report';

export interface GardenReportSite {
  id: string;
  label: string;
}

export interface GardenReportRead {
  records: GardenReportRecords;
  notesHeld: boolean;
  isCurrent: () => boolean;
  checkCurrent: () => Promise<boolean>;
  release: () => void;
}

export function gardenReportSites(source: GrowerOperationsSources): GardenReportSite[] {
  if (source.status !== 'ready' || !isGrowerOperationsCurrent(source)) return [];
  const currentScopes = new Set(source.contexts.flatMap(({ scope }) => scope?.kind === 'mapped-site' ? [scope.siteId] : []));
  return loadPlaces().filter(place => currentScopes.has(place.id))
    .map(place => ({ id: place.id, label: place.name.trim() || 'Saved garden' }));
}

type JournalRead = NonNullable<ReturnType<typeof captureGrowerReportJournal>>;

function readGardenNotes(journal: JournalRead, tasks: readonly BoardTask[]): GardenNoteSource[] {
  const taskKeys = new Set(tasks.flatMap(task => task.growerJournalLink ? [JSON.stringify(task.growerJournalLink)] : []));
  const ids = new Map<string, number>();
  for (const row of journal.rows ?? []) ids.set(row.id, (ids.get(row.id) ?? 0) + 1);
  return (journal.rows ?? []).flatMap(entry => {
    const linked = inspectJournalGrowerLink(entry);
    if (ids.get(entry.id) !== 1 || linked.status !== 'linked' || !taskKeys.has(JSON.stringify(linked.link))
      || entry.nurserySowing !== undefined || entry.nurseryProgress !== undefined || entry.nurseryFieldPlanting !== undefined
      || !entry.notes.trim() || !Number.isFinite(entry.createdAt) || entry.createdAt <= 0 || entry.createdAt > 8.64e15) return [];
    const recordedOn = new Date(entry.createdAt).toISOString().slice(0, 10);
    return [{ recordId: entry.id, observedOn: entry.date, recordedOn, text: entry.notes }];
  });
}

/** A local draft can see only fresh, exact links from the chosen mapped site. */
export async function openGardenReport(
  source: GrowerOperationsSources, siteId: string, viewCurrent: () => boolean,
): Promise<GardenReportRead | null> {
  const sample = isSampleMode();
  const current = () => viewCurrent() && isSampleMode() === sample && isGrowerOperationsCurrent(source);
  if (source.status !== 'ready' || !current()) return null;
  const site = gardenReportSites(source).find(place => place.id === siteId);
  if (!site || !await checkGrowerOperationsCurrent(source, { isCurrent: current }) || !current()) return null;
  const tasks = buildGrowerBoardTasks(source.book.plantings, source.contexts, new Date(), new Set()).tasks
    .filter(task => task.growerJournalLink?.scope.kind === 'mapped-site' && task.growerJournalLink.scope.siteId === siteId);
  const checks = await Promise.all(tasks.filter(task => task.growerEventKind === 'first-pick').map(task => {
    const resolved = resolveGrowerJournalLink(source.book.plantings, source.contexts, task.growerJournalLink);
    return resolved.status === 'ready' ? captureGardenCycleHarvest(resolved.link, resolved.cropKey, current) : null;
  }));
  if (!current()) return null;
  const referencedScope = growerPlanningScopeKey({ kind: 'mapped-site', siteId });
  const incomplete = source.heldSources.some(item => !item.scopeKey || item.scopeKey === referencedScope)
    || checks.some(check => check?.evidence.status !== 'ready' || check.evidence.incomplete);
  const harvest = checks.flatMap(check => check?.evidence.status === 'ready' ? check.evidence.rows : []);
  const journal = captureGrowerReportJournal(sample);
  const notesHeld = !journal?.rows;
  const notes = journal ? readGardenNotes(journal, tasks) : [];
  const isCurrent = () => current() && checks.every(check => check?.isCurrent() ?? true)
    && (!journal || journal.isCurrent()) && current();
  return {
    records: { siteId, siteLabel: site.label, sample, harvest, notes, incomplete }, notesHeld,
    isCurrent,
    async checkCurrent() {
      return isCurrent() && await checkGrowerOperationsCurrent(source, { isCurrent })
        && (await Promise.all(checks.map(check => check?.checkCurrent() ?? true))).every(Boolean)
        && isCurrent();
    },
    release() { journal?.release(); },
  };
}
