import { makeCycleHarvestLink, type CycleHarvestOption, type CycleHarvestSelection } from './cycle-harvest';
import {
  captureCycleHarvestReport, linkExistingCycleHarvest, readCycleHarvestOptions, unlinkExistingCycleHarvest,
  type CycleHarvestOptions, type CycleHarvestReportRead, type CycleHarvestSave,
} from './db/cycle-harvest';
import { checkGrowerOperationsCurrent, isGrowerOperationsCurrent, type GrowerOperationsSources } from './international/grower-operations-source';
import { buildGrowerBoardTasks, type BoardTask } from './task-board';
import { resolveGrowerJournalLink } from './task-record-link';

type Current = () => boolean;

function resolveCurrentTask(source: GrowerOperationsSources, task: BoardTask) {
  if (source.status !== 'ready' || task.kind !== 'grower-cycle' || !task.growerJournalLink) return null;
  const matches = buildGrowerBoardTasks(source.book.plantings, source.contexts, new Date(), new Set())
    .tasks.filter(row => row.id === task.id);
  const canonical = matches.length === 1 ? matches[0] : undefined;
  if (!canonical || canonical.growerEventKind !== task.growerEventKind
    || JSON.stringify(canonical.growerJournalLink) !== JSON.stringify(task.growerJournalLink)) return null;
  const resolved = resolveGrowerJournalLink(source.book.plantings, source.contexts, canonical.growerJournalLink);
  return resolved.status === 'ready' ? resolved : null;
}

export async function openGrowerHarvestOptions(
  source: GrowerOperationsSources, task: BoardTask, isCurrent: Current,
): Promise<CycleHarvestOptions> {
  const current = () => isCurrent() && isGrowerOperationsCurrent(source) && isCurrent();
  if (!current() || task.growerEventKind !== 'first-pick') return { status: 'held', options: [] };
  const resolved = resolveCurrentTask(source, task);
  if (!resolved || !await checkGrowerOperationsCurrent(source, { isCurrent: current }) || !current()) return { status: 'held', options: [] };
  return readCycleHarvestOptions(resolved.cropKey, current, resolved.link);
}

export async function updateGrowerCycleHarvest(
  source: GrowerOperationsSources, task: BoardTask, input: CycleHarvestSelection,
  selected: CycleHarvestOption | null, isCurrent: Current,
): Promise<CycleHarvestSave> {
  const current = () => isCurrent() && isGrowerOperationsCurrent(source) && isCurrent();
  if (!current() || task.growerEventKind !== 'first-pick') return { status: 'held' };
  const resolved = resolveCurrentTask(source, task);
  const link = resolved && makeCycleHarvestLink(resolved.link, resolved.cropKey, input);
  if (!link || !await checkGrowerOperationsCurrent(source, { isCurrent: current }) || !current()) return { status: 'held' };
  return selected ? linkExistingCycleHarvest(link, selected, current) : unlinkExistingCycleHarvest(link, current);
}

export async function readGrowerCycleHarvestReport(
  source: GrowerOperationsSources, task: BoardTask, isCurrent: Current,
): Promise<CycleHarvestReportRead | null> {
  const current = () => isCurrent() && isGrowerOperationsCurrent(source) && isCurrent();
  if (!current()) return null;
  const resolved = resolveCurrentTask(source, task);
  return resolved ? captureCycleHarvestReport(resolved.link, resolved.cropKey, current) : null;
}
