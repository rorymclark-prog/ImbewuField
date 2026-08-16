// Home-page task board — a small, glanceable "what's due soon" list built on
// top of the crop plan (lib/crop-plan.ts). Deliberately generic (BoardTask
// carries a `kind`) so a later round can add survey/lesson producers without
// restructuring the board — crop tasks are just the first, real data source.

import type { PlanBed, Planting, CropTask } from './crop-plan';
import { CROP_PLAN_CHANGED_EVENT, loadCropPlan, taskMonthsFromNow, tasksForPlan } from './crop-plan';
import type { FacilitatorDesignState } from './facilitator-design';
import { loadFacilitatorState } from './facilitator-design';
import { DESIGN_CANVAS_CHANGED_EVENT, loadCanvasState, type DesignCanvasState } from './design-canvas';
import { bedsFromDesignCanvas } from './design-beds-bridge';
import { loadPlaces, resolveMainSite } from './saved-places';
import { designSiteIdFromLocation } from './design-studio';
import type { LocationData } from './types';
import { activeAccountLocalStorageKey } from './account-local-storage';

// Months throughout lib/crop-plan.ts are 1-12 (Jan-Dec), wrapping via the
// same rule as that module's internal wrapMonth — kept in sync here since
// it isn't exported. Copied from app/facilitator/crops/page.tsx, the source
// of truth for this month-offset math.
function wrapMonth(m: number): number {
  return ((m - 1) % 12 + 12) % 12 + 1;
}

// Generic BoardTask calendar arithmetic only. Crop cohort offsets come from
// taskMonthsFromNow above; this helper merely resolves an already-derived
// dueMonth when exporting a BoardTask to a concrete date.
function forwardOnlyOffset(m: number, originMonth: number): number {
  return ((m - originMonth) % 12 + 12) % 12;
}

// Beds = design items of type 'bed'/'hugel', in placement (array) order.
// Copied from app/facilitator/crops/page.tsx (private there too) rather than
// imported, per this codebase's established wrapMonth-style convention.
function computeDesignBeds(state: FacilitatorDesignState | null): PlanBed[] {
  if (!state) return [];
  const beds: PlanBed[] = [];
  let bedN = 0;
  let hugelN = 0;
  for (const it of state.items) {
    if (it.type === 'bed') {
      bedN += 1;
      const wM = Number.isFinite(it.wM) && it.wM > 0 ? it.wM : 1;
      const hM = Number.isFinite(it.hM) && it.hM > 0 ? it.hM : 1;
      beds.push({ id: it.id, label: `Bed ${bedN}`, areaM2: wM * hM, minDimM: Math.min(wM, hM) });
    } else if (it.type === 'hugel') {
      hugelN += 1;
      const wM = Number.isFinite(it.wM) && it.wM > 0 ? it.wM : 1;
      const hM = Number.isFinite(it.hM) && it.hM > 0 ? it.hM : 1;
      beds.push({ id: it.id, label: `Hügel ${hugelN}`, areaM2: wM * hM, minDimM: Math.min(wM, hM) });
    }
  }
  return beds;
}

// Copied from app/facilitator/crops/page.tsx: when the design has no
// bed/hugel items the planner offers a single virtual bed, and plantings
// made that way carry this exact bedId — the board must recognise them too,
// or those farmers' tasks silently vanish.
const VIRTUAL_BED: PlanBed = { id: 'virtual-bed-1', label: 'Bed 1', areaM2: 10 };

/** Same source priority as the crop planner: main-site Studio, legacy canvas, virtual fallback. */
export function taskBoardBeds(
  canvas: DesignCanvasState | null,
  facilitator: FacilitatorDesignState | null,
): PlanBed[] {
  const usable = (bed: PlanBed) =>
    typeof bed.id === 'string' && bed.id.length > 0
    && Number.isFinite(bed.areaM2) && bed.areaM2 > 0
    && (bed.minDimM === undefined || (Number.isFinite(bed.minDimM) && bed.minDimM > 0));
  const canvasBeds = bedsFromDesignCanvas(canvas).filter(usable);
  if (canvasBeds.length > 0) return canvasBeds;
  const facilitatorBeds = computeDesignBeds(facilitator).filter(usable);
  return facilitatorBeds.length > 0 ? facilitatorBeds : [VIRTUAL_BED];
}

export const TASK_BOARD_CHANGED_EVENTS = [
  CROP_PLAN_CHANGED_EVENT,
  DESIGN_CANVAS_CHANGED_EVENT,
  'permamap-places-changed',
] as const;

export type BoardTaskKind = 'crop' | 'survey' | 'lesson';

export interface BoardTask {
  /** Namespaced per producer (crop ids start `${planting.id}:${action}` and a
   *  later picking month appends its offset) so ids never collide across kinds
   *  even though completion is tracked in one set. */
  id: string;
  kind: BoardTaskKind;
  title: string;
  subtitle: string;
  /** Emoji, e.g. crop.icon — the fallback the renderer shows when no real art
   *  exists for this task yet (see cropKey below). */
  icon: string;
  /** CropDef.key (lib/crop-catalog.ts), set only for kind 'crop' tasks. Lets
   *  the renderer resolve real illustrated art via lib/crop-art.ts's
   *  CROP_ART — the same lookup the veg-bed row renderer and design canvas's
   *  ItemEditSheet use — instead of rendering `icon` as raw emoji text.
   *  Undefined for non-crop kinds (survey/lesson), which have no art system. */
  cropKey?: string;
  /** Real calendar month, 1-12, consistent with monthsAway — needed to emit a concrete .ics date. */
  dueMonth: number;
  /** Months until due; can exceed 11 for the harvest of a crop planned nearly a year out. */
  monthsAway: number;
  completed: boolean;
}

// Concise verb per action for a board TITLE — deliberately shorter than
// app/facilitator/crops/page.tsx's own TASK_VERB (built for a full sentence,
// e.g. the source-aware soil-assessment preparation phrase), since a
// board row only has room for a short title. Plain hardcoded English, same
// as TASK_VERB itself (confirmed not routed through t() there either).
const BOARD_VERB: Record<CropTask['action'], string> = {
  prep: 'Prep bed for',
  sow: 'Sow',
  transplant: 'Transplant',
  mulch: 'Water in & mulch',
  harvest: 'Harvest',
  'terminate-cover': 'Cut or roll down',
  'weed-early': 'Weed around',
  'weed-mid': 'Weed & check on',
};

function dueLabel(monthsAway: number): string {
  if (monthsAway === 0) return 'Due this month';
  if (monthsAway === 1) return 'Due next month';
  return `Due in ${monthsAway} months`;
}

export function buildCropBoardTasks(
  plantings: Planting[],
  beds: PlanBed[],
  currentMonth: number,
  completedIds: Set<string>,
): BoardTask[] {
  if (!Number.isSafeInteger(currentMonth) || currentMonth < 1 || currentMonth > 12) return [];
  const bedIds = new Set(beds.map((bed) => bed.id));
  const seenPlantingIds = new Set<string>();
  const validPlantings = plantings.filter((planting) => {
    if (!planting || typeof planting.id !== 'string' || !planting.id
      || seenPlantingIds.has(planting.id)
      || !bedIds.has(planting.bedId)
      || !Number.isSafeInteger(planting.sowMonth)
      || planting.sowMonth < 1 || planting.sowMonth > 12) {
      return false;
    }
    seenPlantingIds.add(planting.id);
    return true;
  });
  const out: BoardTask[] = [];
  for (const t of tasksForPlan(validPlantings, beds, currentMonth)) {
    // Crop-plan owns cohort chronology. Re-deriving it here from the action
    // name made every future transplant crop's prep one month early because
    // direct sowing uses a prior-month prep marker while tray crops do not.
    const monthsAway = taskMonthsFromNow(t, currentMonth);
    if (monthsAway < 0) continue;
    out.push({
      id: t.id,
      kind: 'crop',
      title: `${BOARD_VERB[t.action]} ${t.cropName}`,
      subtitle: `${t.bedLabel} · ${dueLabel(monthsAway)}`,
      icon: t.icon,
      cropKey: t.cropKey,
      // Derived from the resolved offset (not t.month) so a clamped-to-now
      // prep task carries the month it's actually due.
      dueMonth: wrapMonth(currentMonth + monthsAway),
      monthsAway,
      completed: completedIds.has(t.id),
    });
  }
  return out.sort((a, b) =>
    a.monthsAway - b.monthsAway
    || a.dueMonth - b.dueMonth
    || a.id.localeCompare(b.id));
}

/**
 * One-call convenience: loads the saved design + crop plan from localStorage,
 * derives beds the same way app/facilitator/crops/page.tsx does (including
 * the no-design virtual-bed fallback, and dropping plantings whose bed no
 * longer exists), and returns BoardTasks ready to render. Returns [] under
 * SSR/no-window, same as loadCropPlan.
 */
export function loadCropBoardTasks(completedIds: Set<string>): BoardTask[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const main = resolveMainSite(loadPlaces());
  const canvas = main && Number.isFinite(main.lat) && Number.isFinite(main.lon)
    ? loadCanvasState(designSiteIdFromLocation({ lat: main.lat, lon: main.lon } as LocationData))
    : null;
  const beds = taskBoardBeds(canvas, loadFacilitatorState());
  const bedIds = new Set(beds.map((b) => b.id));
  const plantings = loadCropPlan().plantings.filter((p) => bedIds.has(p.bedId));
  const currentMonth = new Date().getMonth() + 1;
  return buildCropBoardTasks(plantings, beds, currentMonth, completedIds);
}

// ── Completion store ────────────────────────────────────────────────────────
// One shared completed-id set across all future kinds (crop/survey/lesson) —
// each producer namespaces its own ids, so there's no collision risk. Same
// load/save pair pattern as loadAllowBedSharing/saveAllowBedSharing
// (lib/crop-plan.ts) and loadCropPriceOverrides/saveCropPriceOverrides
// (lib/crop-prices.ts).
const COMPLETED_TASKS_KEY = 'imbewu_completed_tasks_v1';

export function loadCompletedTaskIds(): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set();
  try {
    const raw = window.localStorage.getItem(
      activeAccountLocalStorageKey(COMPLETED_TASKS_KEY),
    );
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed)
      ? parsed
        .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        .map((k) => k.trim())
      : []);
  } catch {
    return new Set();
  }
}

export function saveCompletedTaskIds(ids: Set<string>): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const clean = new Set([...ids]
      .filter((id) => typeof id === 'string' && id.trim().length > 0)
      .map((id) => id.trim()));
    window.localStorage.setItem(
      activeAccountLocalStorageKey(COMPLETED_TASKS_KEY),
      JSON.stringify([...clean]),
    );
    return true;
  } catch {
    return false;
  }
}

/** Toggle one durable completion without rebuilding the shared set from the visible crop rows.
 * Survey/lesson tasks and crop work that is temporarily off-board must survive untouched. */
export function setCompletedTaskState(id: string, completed: boolean): Set<string> {
  const before = loadCompletedTaskIds();
  const cleanId = typeof id === 'string' ? id.trim() : '';
  if (!cleanId) return before;
  const next = new Set(before);
  if (completed) next.add(cleanId);
  else next.delete(cleanId);
  if (next.size === before.size && next.has(cleanId) === before.has(cleanId)) return before;
  return saveCompletedTaskIds(next) ? next : before;
}

// ── Add to calendar (.ics) ───────────────────────────────────────────────────
// No Google Calendar OAuth exists in this repo — a downloadable .ics file
// works identically across Google/Apple/Outlook with zero auth, so this is
// the whole "add to calendar" feature for this round.

/** A real forward-looking Date for a task, day fixed to the 1st (CropTask
 *  only ever carries a month, never a day). Resolved from dueMonth against
 *  the clock AT CALL TIME — monthsAway was computed when the board loaded and
 *  goes stale once the calendar month rolls over in a long-lived session; it
 *  is only consulted to recover which 12-month cycle a far-out (> 11 months)
 *  task belongs to. */
export function resolveTaskDate(task: BoardTask, now = new Date()): Date {
  const origin = Number.isFinite(now.getTime()) ? now : new Date();
  const currentMonth = origin.getMonth() + 1;
  const dueMonth = Number.isSafeInteger(task.dueMonth) && task.dueMonth >= 1 && task.dueMonth <= 12
    ? task.dueMonth
    : currentMonth;
  const monthsAway = Number.isFinite(task.monthsAway) && task.monthsAway >= 0
    ? Math.floor(task.monthsAway)
    : forwardOnlyOffset(dueMonth, currentMonth);
  const fwd = forwardOnlyOffset(dueMonth, currentMonth);
  const cycles = Math.max(0, Math.floor((monthsAway - fwd) / 12));
  return new Date(origin.getFullYear(), origin.getMonth() + fwd + cycles * 12, 1);
}

function icsDateStamp(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}Z`;
}

function icsAllDayDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// RFC 5545 §3.3.11 TEXT escaping — crop names and bed labels are free text
// (a farmer can rename a bed to contain a comma), and an unescaped \ ; , or
// newline corrupts the whole event in strict parsers.
function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

export function buildTaskIcs(task: BoardTask, now = new Date()): string {
  const clock = Number.isFinite(now.getTime()) ? now : new Date();
  const start = resolveTaskDate(task, clock);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1); // DTEND is exclusive for all-day events
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ImbewuField//Task//EN',
    'BEGIN:VEVENT',
    `UID:${icsEscape(task.id)}@imbewufield.app`,
    `DTSTAMP:${icsDateStamp(clock)}`,
    `DTSTART;VALUE=DATE:${icsAllDayDate(start)}`,
    `DTEND;VALUE=DATE:${icsAllDayDate(end)}`,
    `SUMMARY:${icsEscape(task.title)}`,
    `DESCRIPTION:${icsEscape(`ImbewuField crop plan — ${task.subtitle}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function downloadTaskIcs(task: BoardTask): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([buildTaskIcs(task)], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${task.kind}-task.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
