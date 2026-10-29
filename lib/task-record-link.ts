import { cropByKey } from './crop-catalog';
import { MAX_TITLE_LEN, type JournalCategory } from './field-journal';
import type { CropTask } from './crop-plan';
import type { BoardTask } from './task-board';

const ACTIONS: readonly CropTask['action'][] = [
  'prep', 'sow', 'transplant', 'mulch', 'harvest', 'terminate-cover', 'weed-early', 'weed-mid',
];
// Journal tags have a sixty-character limit. These are draft tags, not a new store.
const MAX_TAG_LEN = 60;

export interface TaskJournalDraft {
  cropKey: string;
  cropName: string;
  action: CropTask['action'];
  category: JournalCategory;
  title: string;
  bedId?: string;
  bedLabel?: string;
}

/** Query strings may suggest a draft, never claim that planned work actually happened. */
function plainText(value: string | null, limit: number): string | null {
  if (!value || /[<>\u0000-\u001f\u007f]/.test(value)) return null;
  const text = value.trim().slice(0, limit);
  return text || null;
}

function single(params: URLSearchParams, key: string): string | null {
  return params.getAll(key).length === 1 ? params.get(key) : null;
}

function cropFromQuery(params: URLSearchParams) {
  const key = single(params, 'crop');
  return key && key.length <= 100 ? cropByKey(key) : undefined;
}

export function taskJournalCategory(action: CropTask['action']): JournalCategory {
  return action === 'harvest' ? 'harvest' : action === 'sow' || action === 'transplant' ? 'planting' : 'maintenance';
}

export function parseTaskJournalQuery(params: URLSearchParams): TaskJournalDraft | null {
  if (single(params, 'task') !== '1') return null;
  const crop = cropFromQuery(params);
  const action = single(params, 'action') as CropTask['action'] | null;
  const title = plainText(single(params, 'title'), MAX_TITLE_LEN);
  if (!crop || !action || !ACTIONS.includes(action) || !title) return null;
  const bedId = plainText(single(params, 'bed'), MAX_TAG_LEN);
  const bedLabel = plainText(single(params, 'bedLabel'), MAX_TAG_LEN);
  // A label without its id may be a useful note, but it cannot identify a saved bed.
  // Never truncate an id into a different valid-looking reference.
  const rawBed = single(params, 'bed');
  const safeBedId = bedId && rawBed === bedId ? bedId : null;
  return {
    cropKey: crop.key, cropName: crop.name, action, category: taskJournalCategory(action), title,
    ...(safeBedId ? { bedId: safeBedId, ...(bedLabel ? { bedLabel } : {}) } : {}),
  };
}

export function taskJournalHref(task: BoardTask): string | null {
  if (task.kind !== 'crop' || !task.cropKey || !task.action) return null;
  const params = new URLSearchParams({ task: '1', crop: task.cropKey, action: task.action, title: task.title });
  if (task.bedId) params.set('bed', task.bedId);
  if (task.bedLabel) params.set('bedLabel', task.bedLabel);
  const draft = parseTaskJournalQuery(params);
  if (!draft) return null;
  params.set('title', draft.title);
  params.delete('bed');
  params.delete('bedLabel');
  if (draft.bedId) params.set('bed', draft.bedId);
  if (draft.bedLabel) params.set('bedLabel', draft.bedLabel);
  return `/journal?${params.toString()}`;
}

export function parseTaskHarvestQuery(params: URLSearchParams): { cropKey: string; cropName: string } | null {
  if (single(params, 'tab') !== 'picked') return null;
  const crop = cropFromQuery(params);
  // Cover crops excluded by the existing produce picker cannot be turned into food records.
  if (!crop || crop.yieldKgPerM2 === 0) return null;
  return { cropKey: crop.key, cropName: crop.name };
}

export function taskHarvestHref(task: BoardTask): string | null {
  if (task.kind !== 'crop' || task.action !== 'harvest' || !task.cropKey) return null;
  const params = new URLSearchParams({ tab: 'picked', crop: task.cropKey });
  return parseTaskHarvestQuery(params) ? `/records?${params.toString()}` : null;
}
