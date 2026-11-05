import type { GrowerJournalLink } from './field-journal';
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
import { produceLabel } from './produce-label';
import { resolvePlanningSupport } from './international/planning-support';
import { coordinateSiteIdForPlace } from './international/site-context';
import { workspacePlanningIdForDesign } from './international/workspace-context';
import { hasGrowerCycleMarker, type GrowerCycleContext } from './international/grower-cycle';
import { projectGrowerCycles, type GrowerCycleEventKind } from './international/grower-cycle-projection';
import { addGrowerUtcDays, growerPlanningScopeKey } from './international/grower-planning';
import { resolveAbsoluteTaskDate, escapeIcsText, foldIcsLine } from './crop-calendar-ics';

// zu-03 (wave 13 audit): the task board was entirely hard-coded English — verbs, the default
// "Bed {n}" label and "Due this month" — regardless of the farmer's chosen language. lib/i18n.tsx
// itself can't be imported here: it's a .tsx module (LanguageProvider renders JSX), and this file
// is exercised directly by `node --test` under tests/task-board.test.ts, whose loader has no
// JSX/TSX transform — only lib/i18n.tsx's own string-matching tests read it that way. So the
// board takes an optional translator instead of importing one: lib/i18n.tsx carries the matching
// 'taskVerbPrep' etc. keys (sentence source of truth, and where a future first-language review
// would add real translations), and a caller with a React tree — e.g. app/home/page.tsx's
// `const { t } = useLanguage()` — can pass `(key, vars) => { let s = t(key); for (...) ...; return
// s; }` to get the live language. No existing caller does yet (app/home/page.tsx is not in this
// track's owned files), so the board renders in English exactly as before until one does; the
// template structure itself is the fix this finding asks for.
export type BoardTranslate = (key: string, vars?: Record<string, string>) => string;

// Mirrors the English values of the matching lib/i18n.tsx keys exactly — kept here as the
// built-in default so a board rendered with no injected translator (today's only caller) reads
// the same as it always has.
const EN_TASK_BOARD_STRINGS: Record<string, string> = {
  taskVerbPrep: 'Prep bed for {crop}',
  taskVerbSow: 'Sow {crop}',
  taskVerbTransplant: 'Transplant {crop}',
  taskVerbMulch: 'Water in & mulch {crop}',
  taskVerbHarvest: 'Harvest {crop}',
  taskVerbTerminateCover: 'Cut or roll down {crop}',
  taskVerbWeedEarly: 'Weed around {crop}',
  taskVerbWeedMid: 'Weed & check on {crop}',
  taskBedLabel: 'Bed {n}',
  taskDueThisMonth: 'Due this month',
  taskDueNextMonth: 'Due next month',
  taskDueInMonths: 'Due in {n} months',
  taskGrowerNurseryStart: 'Planned nursery start for {crop}',
  taskGrowerFieldEntry: 'Planned field entry for {crop}',
  taskGrowerFirstPick: 'Planned first pick for {crop}',
  taskGrowerPickingEnd: 'Planned picking end boundary for {crop}',
  taskGrowerFieldClear: 'Planned field-clear boundary for {crop}',
  taskGrowerNextEntry: 'Planned next-entry boundary for {crop}',
  taskGrowerPlannedEstimate: 'Planned from your own estimates · {date}',
  taskGrowerExclusiveBoundary: 'Exclusive end boundary · not recorded work',
  taskGrowerAvailabilityBoundary: 'Availability boundary only · not a new planting or confirmation that the bed is free',
  taskGrowerMeasuredBed: 'Measured bed',
};

function defaultBoardTranslate(key: string, vars?: Record<string, string>): string {
  let s = EN_TASK_BOARD_STRINGS[key] ?? key;
  if (vars) for (const [name, value] of Object.entries(vars)) s = s.replace(`{${name}}`, value);
  return s;
}

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

function usableBed(bed: PlanBed): boolean {
  return typeof bed.id === 'string' && bed.id.length > 0
    && Number.isFinite(bed.areaM2) && bed.areaM2 > 0
    && (bed.minDimM === undefined || (Number.isFinite(bed.minDimM) && bed.minDimM > 0));
}

/** Beds from one or more Design Studio canvases, unioned and de-duplicated by
 *  id (first occurrence wins). A null canvas (no Studio design at that site)
 *  contributes nothing, same as bedsFromDesignCanvas(null) === []. */
function unionCanvasBeds(canvases: (DesignCanvasState | null)[]): PlanBed[] {
  const seen = new Set<string>();
  const beds: PlanBed[] = [];
  for (const c of canvases) {
    for (const bed of bedsFromDesignCanvas(c).filter(usableBed)) {
      if (seen.has(bed.id)) continue;
      seen.add(bed.id);
      beds.push(bed);
    }
  }
  return beds;
}

/** Same source priority as the crop planner: main-site Studio, legacy canvas, virtual fallback. */
export function taskBoardBeds(
  canvas: DesignCanvasState | null,
  facilitator: FacilitatorDesignState | null,
): PlanBed[] {
  return taskBoardBedsAcrossPlaces([canvas], facilitator);
}

/** taskBoardBeds, generalised to several sites' canvases at once — the Task
 *  Planner's bed universe is every saved place's Studio canvas unioned
 *  together (main site first), not just the main site's. Facilitator/virtual
 *  fallback still only fires once, globally, when NONE of the canvases have
 *  usable beds — so a farmer with a real canvas at their main site never
 *  gets its beds duplicated alongside a stale facilitator-state fallback. */
export function taskBoardBedsAcrossPlaces(
  canvases: (DesignCanvasState | null)[],
  facilitator: FacilitatorDesignState | null,
): PlanBed[] {
  const canvasBeds = unionCanvasBeds(canvases);
  if (canvasBeds.length > 0) return canvasBeds;
  const facilitatorBeds = computeDesignBeds(facilitator).filter(usableBed);
  return facilitatorBeds.length > 0 ? facilitatorBeds : [VIRTUAL_BED];
}

export const TASK_BOARD_CHANGED_EVENTS = [
  CROP_PLAN_CHANGED_EVENT,
  DESIGN_CANVAS_CHANGED_EVENT,
  'permamap-places-changed',
] as const;

export type BoardTaskKind = 'crop' | 'grower-cycle' | 'survey' | 'lesson';

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
  /** CropDef.key (lib/crop-catalog.ts), retained for crop and own-cycle identity. Lets
   *  the renderer resolve real illustrated art via lib/crop-art.ts's
   *  CROP_ART — the same lookup the veg-bed row renderer and design canvas's
   *  ItemEditSheet use — instead of rendering `icon` as raw emoji text.
   *  Own-cycle identity grants no catalogue instruction. Undefined for
   *  survey/lesson kinds, which have no art system. */
  cropKey?: string;
  /** Keep the actual bed reference for a draft journal handoff; subtitles are translated text. */
  bedId?: string;
  bedLabel?: string;
  /** CropTask['action'] (lib/crop-plan.ts), set only for kind 'crop' tasks. Lets a renderer
   *  pick an icon/category per task without re-parsing the title string — added for the
   *  Task Planner screen (app/cropplan), which used to invent its own day-of-week rota
   *  instead of reading real tasks. */
  action?: CropTask['action'];
  /** Own cycles retain their exact one-time UTC calendar day, including its year. */
  dueDate?: string;
  growerEventKind?: GrowerCycleEventKind;
  /** Planned linkage context only. The journal separately asks what happened
   * and on which observed day; this reference grants no record or access. */
  growerJournalLink?: GrowerJournalLink;
  /** Real calendar month, 1-12, consistent with monthsAway — needed to emit a concrete .ics date. */
  dueMonth: number;
  /** Months until due; own cycles may be negative when overdue. Their dueDate
   *  remains the authority; this offset is display metadata only. */
  monthsAway: number;
  completed: boolean;
}

// Concise verb per action for a board TITLE — deliberately shorter than
// app/facilitator/crops/page.tsx's own TASK_VERB (built for a full sentence,
// e.g. the source-aware soil-assessment preparation phrase), since a
// board row only has room for a short title. Each is a lib/i18n.tsx '{verb}
// {crop}' template key (zu-03) rather than hardcoded English; the crop name
// itself still comes from lib/crop-plan.ts (Codex-owned) as plain English.
const BOARD_VERB_KEY: Record<CropTask['action'], string> = {
  prep: 'taskVerbPrep',
  sow: 'taskVerbSow',
  transplant: 'taskVerbTransplant',
  mulch: 'taskVerbMulch',
  harvest: 'taskVerbHarvest',
  'terminate-cover': 'taskVerbTerminateCover',
  'weed-early': 'taskVerbWeedEarly',
  'weed-mid': 'taskVerbWeedMid',
};

// zu-03/zu-11: the crop name itself used to be passed straight through as plain English
// (t.cropName, from lib/crop-plan.ts). It now reads through the shared produceLabel() helper
// (lib/produce-label.ts) keyed by t.cropKey, which also has an isiZulu common name for the
// crops this draft covers — so 'Prep bed for {crop}' can read 'Lungisa umbhede we{crop}' with
// an isiZulu crop name too, not just an isiZulu verb around an English one.
function boardTaskTitle(action: CropTask['action'], cropKey: string, translateFn: BoardTranslate, lang: string): string {
  return translateFn(BOARD_VERB_KEY[action], { crop: produceLabel(cropKey, lang) });
}

// The default bed label crop-plan.ts assigns is exactly "Bed {n}" (bedById.get(bedId)?.label);
// a farmer who has renamed their own bed gets whatever they typed instead, which must never be
// translated — only the untouched default format is recognised and templated here.
const DEFAULT_BED_LABEL = /^Bed (\d+)$/;

function boardBedLabel(bedLabel: string, translateFn: BoardTranslate): string {
  const match = DEFAULT_BED_LABEL.exec(bedLabel);
  return match ? translateFn('taskBedLabel', { n: match[1] }) : bedLabel;
}

function dueLabel(monthsAway: number, translateFn: BoardTranslate): string {
  if (monthsAway === 0) return translateFn('taskDueThisMonth');
  if (monthsAway === 1) return translateFn('taskDueNextMonth');
  return translateFn('taskDueInMonths', { n: String(monthsAway) });
}

export function buildCropBoardTasks(
  plantings: Planting[],
  beds: PlanBed[],
  currentMonth: number,
  completedIds: Set<string>,
  translateFn: BoardTranslate = defaultBoardTranslate,
  lang: string = 'en',
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
  const plantingBeds = new Map(validPlantings.map((planting) => [planting.id, planting.bedId]));
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
      title: boardTaskTitle(t.action, t.cropKey, translateFn, lang),
      subtitle: `${boardBedLabel(t.bedLabel, translateFn)} · ${dueLabel(monthsAway, translateFn)}`,
      icon: t.icon,
      cropKey: t.cropKey,
      bedId: plantingBeds.get(t.plantingId),
      bedLabel: t.bedLabel,
      action: t.action,
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

const GROWER_VERB_KEY: Record<GrowerCycleEventKind, string> = {
  'nursery-start': 'taskGrowerNurseryStart', 'field-entry': 'taskGrowerFieldEntry', 'first-pick': 'taskGrowerFirstPick',
  'picking-end': 'taskGrowerPickingEnd', 'field-clear': 'taskGrowerFieldClear', 'next-entry': 'taskGrowerNextEntry',
};

function opaqueGrowerTaskDigest(value: string): string {
  // This deterministic 128-bit identifier is not cryptography or anonymisation.
  // Raw persistent IDs need not travel into a calendar. Collisions are held by
  // the allocator below, never accepted as another task's completion identity.
  let left = BigInt('14695981039346656037'), right = BigInt('7809847782465536322');
  const prime = BigInt('1099511628211');
  for (const byte of new TextEncoder().encode(value)) {
    left = BigInt.asUintN(64, (left ^ BigInt(byte)) * prime);
    right = BigInt.asUintN(64, (right ^ BigInt(byte)) * prime);
  }
  return left.toString(16).padStart(16, '0') + right.toString(16).padStart(16, '0');
}

/** One pure allocation authority, with a digest seam so collision protection can
 * actually fail in a test. No date, source geometry or coordinate scope enters
 * identity: the whole-book projector already requires unique planting IDs.
 * Completion remains in the existing account-scoped store, not this function. */
export function resolveGrowerTaskIdentities(
  events: readonly { rowIndex: number; plantingId: string; kind: GrowerCycleEventKind }[],
  digest: (value: string) => string = opaqueGrowerTaskDigest,
): { ids: readonly (string | null)[]; heldRows: ReadonlySet<number> } {
  const groups = new Map<string, number[]>(); const heldRows = new Set<number>();
  const ids = events.map((event, index): string | null => {
    try {
      const hash = digest(JSON.stringify(['grower-cycle-task-v1', event.plantingId, event.kind]));
      if (!/^[a-f0-9]{32}$/.test(hash)) { heldRows.add(event.rowIndex); return null; }
      const id = `grower-cycle-v1-${hash}`;
      groups.set(id, [...(groups.get(id) ?? []), index]);
      return id;
    } catch { heldRows.add(event.rowIndex); return null; }
  });
  for (const indexes of groups.values()) if (indexes.length > 1) {
    for (const index of indexes) heldRows.add(events[index].rowIndex);
  }
  return { ids: ids.map((id, index) => heldRows.has(events[index].rowIndex) ? null : id), heldRows };
}

/** The full book reaches each shared projection: filtering rows by site first
 * would hide duplicate IDs in another site or a legacy row. Same-bed names in
 * different scopes remain independent; ambiguous contexts never choose a winner. */
export function buildGrowerBoardTasks(
  rows: unknown,
  contexts: readonly GrowerCycleContext[],
  now: Date,
  completedIds: Set<string>,
  translateFn: BoardTranslate = defaultBoardTranslate,
  lang: string = 'en',
): { tasks: BoardTask[]; heldPlantings: number } {
  if (!Array.isArray(rows)) return { tasks: [], heldPlantings: 1 };
  const ownRows = rows.filter(hasGrowerCycleMarker);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return { tasks: [], heldPlantings: ownRows.length };
  const byScope = new Map<string, GrowerCycleContext[]>();
  for (const context of contexts) {
    const key = growerPlanningScopeKey(context?.scope);
    if (key) byScope.set(key, [...(byScope.get(key) ?? []), context]);
  }
  const translated = (key: string, vars?: Record<string, string>): string => {
    const label = translateFn(key, vars);
    return typeof label === 'string' && label.trim() && label !== key ? label : defaultBoardTranslate(key, vars);
  };
  const projectedRows = new Set<number>();
  const candidates: { rowIndex: number; plantingId: string; kind: GrowerCycleEventKind; task: Omit<BoardTask, 'id' | 'completed'> }[] = [];
  for (const matches of byScope.values()) {
    if (matches.length !== 1) continue;
    const context = matches[0];
    for (const cycle of projectGrowerCycles(rows, context).ownCycles) {
      projectedRows.add(cycle.rowIndex);
      const bed = context.beds.find(bed => bed.id === cycle.bedId)!;
      const bedLabel = typeof bed.label === 'string' && bed.label.trim() ? bed.label : translated('taskGrowerMeasuredBed');
      for (const event of cycle.plannedEvents) {
        const parts = resolveAbsoluteTaskDate(event.date);
        if (!parts) continue;
        const explanation = event.kind === 'next-entry' ? translated('taskGrowerAvailabilityBoundary')
          : event.endExclusive ? translated('taskGrowerExclusiveBoundary') : null;
        candidates.push({ rowIndex: cycle.rowIndex, plantingId: cycle.plantingId, kind: event.kind,
          task: { kind: 'grower-cycle', growerEventKind: event.kind, dueDate: event.date,
          growerJournalLink: { version: 1, scope: cycle.scope, plantingId: cycle.plantingId,
            bedId: cycle.bedId, eventKind: event.kind, plannedDate: event.date },
          title: translated(GROWER_VERB_KEY[event.kind], { crop: produceLabel(cycle.cropKey, lang) }),
          subtitle: [boardBedLabel(bedLabel, translated), translated('taskGrowerPlannedEstimate', { date: event.date }), explanation].filter(Boolean).join(' · '),
          // The dated panel uses text; crop thumbnail consumers use cropKey's artwork.
          icon: '', cropKey: cycle.cropKey, bedId: cycle.bedId, bedLabel,
          dueMonth: parts.month, monthsAway: (parts.year - now.getUTCFullYear()) * 12 + parts.month - now.getUTCMonth() - 1 } });
      }
    }
  }
  const identities = resolveGrowerTaskIdentities(candidates);
  for (const rowIndex of identities.heldRows) projectedRows.delete(rowIndex);
  const tasks = candidates.flatMap((candidate, index): BoardTask[] => {
    const id = identities.ids[index];
    return id ? [{ ...candidate.task, id, completed: completedIds.has(id) }] : [];
  });
  return { tasks: tasks.sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)
    || Object.keys(GROWER_VERB_KEY).indexOf(a.growerEventKind!) - Object.keys(GROWER_VERB_KEY).indexOf(b.growerEventKind!)
    || a.id.localeCompare(b.id)),
    heldPlantings: ownRows.length - projectedRows.size };
}

/**
 * One-call convenience: loads the saved design + crop plan from localStorage,
 * derives beds the same way app/facilitator/crops/page.tsx does (including
 * the no-design virtual-bed fallback, and dropping plantings whose bed no
 * longer exists), and returns BoardTasks ready to render. Returns [] under
 * SSR/no-window, same as loadCropPlan.
 */
export function loadCropBoardTasks(completedIds: Set<string>, translateFn: BoardTranslate = defaultBoardTranslate, lang: string = 'en'): BoardTask[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const { beds, plantings } = loadCropBoardSource();
  const currentMonth = new Date().getMonth() + 1;
  return buildCropBoardTasks(plantings, beds, currentMonth, completedIds, translateFn, lang);
}

/** Shared bed/planting resolution behind loadCropBoardTasks and
 *  loadCropBoardYear — beds are unioned across EVERY saved place's Design
 *  Studio canvas (main site first, so a colliding id resolves in its favour),
 *  not just the main site's: a planting on a bed at a non-main saved place
 *  used to be silently dropped from the Task Planner because only the main
 *  site's canvas was ever consulted. `savedPlantings` is the UNFILTERED count
 *  straight off the stored plan, so a screen can tell "no plan at all" apart
 *  from "a plan whose plantings all sit on beds that no longer exist". */
function loadCropBoardSource(): { beds: PlanBed[]; plantings: Planting[]; savedPlantings: number; withheldPlantings: number; hasPlanningBasis: boolean } {
  const places = loadPlaces();
  const plan = loadCropPlan();
  const main = resolveMainSite(places);
  const ordered = main ? [main, ...places.filter(p => p.id !== main.id)] : places;
  const candidates = ordered.flatMap(place => {
    const siteId = coordinateSiteIdForPlace(place);
    if (!siteId) return [];
    const beds = bedsFromDesignCanvas(loadCanvasState(siteId)).filter(usableBed);
    const support = resolvePlanningSupport({ places, siteId, workspaceReferences: plan.workspaceReferences });
    return beds.map(bed => ({ bed, origin: siteId, allowed: support.allowCataloguePlanning }));
  });
  if (!candidates.length) {
    const facilitator = loadFacilitatorState();
    const beds = taskBoardBedsAcrossPlaces([], facilitator);
    // No mapped site can fall back to an unmapped reference acknowledgement.
    const siteId = facilitator?.bgSite ? coordinateSiteIdForPlace(facilitator.bgSite) ?? 'invalid-mapped-site' : null;
    const workspaceId = computeDesignBeds(facilitator).filter(usableBed).length
      ? workspacePlanningIdForDesign(facilitator) : 'virtual-bed';
    const support = resolvePlanningSupport({ places, siteId, workspaceId, workspaceReferences: plan.workspaceReferences });
    candidates.push(...beds.map(bed => ({ bed, origin: siteId ?? workspaceId ?? 'unknown-design-workspace', allowed: support.allowCataloguePlanning })));
  }
  const byBed = new Map<string, typeof candidates>();
  for (const candidate of candidates) byBed.set(candidate.bed.id, [...(byBed.get(candidate.bed.id) ?? []), candidate]);
  // A global planting row has only a bed id. If two sites use that id, choosing
  // the supported site first would give the other site's row its calendar.
  const eligible = [...byBed.values()].filter(rows => rows.every(row => row.allowed && row.origin === rows[0].origin));
  const beds = eligible.map(rows => rows[0].bed);
  const bedIds = new Set(beds.map(bed => bed.id));
  const heldIds = new Set([...byBed.keys()].filter(id => !bedIds.has(id)));
  const plantings = plan.plantings.filter(planting => bedIds.has(planting.bedId));
  return { beds, plantings, savedPlantings: plan.plantings.length,
    withheldPlantings: plan.plantings.filter(planting => heldIds.has(planting.bedId)).length,
    hasPlanningBasis: eligible.length > 0 };
}

/** The whole plan laid out over the twelve calendar months, plus the counts a
 *  screen needs to explain an empty result honestly. */
export interface CropBoardYear {
  /** Every month 1-12 is present, so a caller never has to distinguish
   *  "no entry" from "no tasks". Each bucket keeps buildCropBoardTasks'
   *  soonest-first order. */
  byMonth: Map<number, BoardTask[]>;
  /** Tasks across all twelve months — 0 means the planner is empty all year. */
  total: number;
  /** Plantings saved in the crop plan before ANY filtering (bed, sow month,
   *  catalog, timing verification). 0 means there is genuinely no plan yet. */
  savedPlantings: number;
  /** Saved rows retained, but no catalogue instruction is approved for their context. */
  withheldPlantings?: number;
  hasPlanningBasis?: boolean;
}

function emptyMonthBuckets(): Map<number, BoardTask[]> {
  const byMonth = new Map<number, BoardTask[]>();
  for (let m = 1; m <= 12; m++) byMonth.set(m, []);
  return byMonth;
}

/**
 * The farmer's real tasks, filed under the calendar month each one falls in —
 * built for the Task Planner (app/cropplan), which browses month by month
 * through the plan's annual cycle rather than only showing what's due today.
 *
 * Built ONCE against the real current month and then filed by dueMonth. An
 * earlier version rebuilt the list with the BROWSED month as "now" and kept
 * only monthsAway === 0; because a planned crop's sowing always resolves to
 * its NEXT occurrence (offset 0-11), every harvest (+3..+10), transplant (+1)
 * and cover termination was then unreachable in all twelve months, and a
 * clamped prep task showed up in two consecutive months. Anchoring once to the
 * real clock keeps each task on its own cohort timeline, so it lands in
 * exactly one month — the month the plan actually puts it in.
 *
 * Crop-plan months carry no year (lib/crop-plan.ts), so a month bucket is the
 * finest honest granularity: `monthsAway` on each task still says which
 * occurrence of that month name it belongs to.
 */
export function loadCropBoardYear(completedIds: Set<string>, now: Date = new Date()): CropBoardYear {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { byMonth: emptyMonthBuckets(), total: 0, savedPlantings: 0 };
  }
  const { beds, plantings, savedPlantings, withheldPlantings, hasPlanningBasis } = loadCropBoardSource();
  const clock = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const tasks = buildCropBoardTasks(plantings, beds, clock.getMonth() + 1, completedIds);
  const byMonth = emptyMonthBuckets();
  for (const task of tasks) {
    const bucket = byMonth.get(wrapMonth(task.dueMonth));
    if (bucket) bucket.push(task);
  }
  return { byMonth, total: tasks.length, savedPlantings, withheldPlantings, hasPlanningBasis };
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
  if (task.kind === 'grower-cycle') {
    return resolveAbsoluteTaskDate(task.dueDate) ? new Date(`${task.dueDate}T00:00:00.000Z`) : new Date(NaN);
  }
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
  if (!Number.isFinite(start.getTime())) return '';
  const own = task.kind === 'grower-cycle';
  const ownEnd = own ? addGrowerUtcDays(task.dueDate!, 1) : null;
  if (own && !ownEnd) return '';
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1); // DTEND is exclusive for all-day events
  const escape = own ? escapeIcsText : icsEscape;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ImbewuField//Task//EN',
    'BEGIN:VEVENT',
    `UID:${escape(task.id)}@imbewufield.app`,
    `DTSTAMP:${icsDateStamp(clock)}`,
    `DTSTART;VALUE=DATE:${own ? task.dueDate!.replace(/-/g, '') : icsAllDayDate(start)}`,
    `DTEND;VALUE=DATE:${own ? ownEnd!.replace(/-/g, '') : icsAllDayDate(end)}`,
    `SUMMARY:${escape(task.title)}`,
    `DESCRIPTION:${escape(`${own ? 'ImbewuField planned cycle from your own estimates; not recorded work' : 'ImbewuField crop plan'} — ${task.subtitle}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ];
  return (own ? lines.map(foldIcsLine) : lines).join('\r\n');
}

export function downloadTaskIcs(task: BoardTask): boolean {
  if (typeof window === 'undefined') return false;
  // Home can still hold a task button when another tab changes the country or
  // removes its source. An old rendered task is not export permission.
  if (task.kind === 'crop' && !loadCropBoardTasks(new Set()).some(current =>
    current.id === task.id && current.action === task.action && current.cropKey === task.cropKey
    && current.bedId === task.bedId && current.dueMonth === task.dueMonth)) return false;
  const content = buildTaskIcs(task);
  if (!content) return false;
  const blob = new Blob([content], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${task.kind}-task.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
