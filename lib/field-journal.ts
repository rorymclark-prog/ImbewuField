// Field Journal — the dated record of what actually happened on the land.
//
// Protected journal storage retains the exact old copy as cutover evidence.
// Older loaded JavaScript may still write v1, so v2 is the sole active personal
// journal. Sample mode keeps its established v1 Storage shim and never writes a
// real canonical pair. Reads carry actor/sample and raw-storage provenance;
// display normalization alone never grants permission to replace saved notes.
//
// Everything above the STORAGE section is pure (no window, no I/O) so the
// grouping, normalisation and trimming rules can be tested directly.

import { Sprout, ShoppingBasket, CloudSun, Bug, Wrench, Users, NotebookPen, type LucideIcon } from 'lucide-react';
import { activeAccountLocalStorageKey } from './account-local-storage';
import { detachJsonData as detachJournalJSON, rawJsonIsLossless as journalRawJSONIsLossless } from './lossless-json';
import { readJournalStorage, writeJournalStorageRaw, JOURNAL_LEGACY_KEY } from './journal-storage';
import { captureJournalObservationContext, journalObservationContextIsCurrent, revokeJournalObservationContext, type JournalObservationContext } from './length-unit-preference';
import { normaliseGrowerPlanningScope, type GrowerPlanningScope } from './international/grower-planning';
import type { GrowerCycleEventKind } from './international/grower-cycle-projection';

/* ── Types ───────────────────────────────────────────────────────────────── */

export type JournalCategory =
  | 'planting'
  | 'harvest'
  | 'weather'
  | 'pest'
  | 'maintenance'
  | 'training'
  | 'other';

export interface JournalCategoryDef {
  key: JournalCategory;
  label: string;
  /** Lucide icon component — CLAUDE.md is Lucide-only, no emoji as UI icons (ux-05, sdesk-10). */
  icon: LucideIcon;
  tint: string;
  ink: string;
}

// English-only on purpose. lib/i18n.tsx carries 10 languages across ~9k lines and
// is edited by everything; lib/task-board.ts sets the precedent of hardcoding a
// small verb/label set here and translating it in a later pass.
export const JOURNAL_CATEGORIES: readonly JournalCategoryDef[] = Object.freeze([
  { key: 'planting',    label: 'Planting',        icon: Sprout,         tint: 'rgba(31,77,43,0.10)',   ink: 'var(--color-forest-800)' },
  { key: 'harvest',     label: 'Harvest',         icon: ShoppingBasket, tint: 'rgba(164,110,20,0.12)', ink: 'var(--gold)' },
  { key: 'weather',     label: 'Weather',         icon: CloudSun,       tint: 'rgba(37,99,143,0.12)',  ink: 'var(--blue)' },
  { key: 'pest',        label: 'Pest / disease',  icon: Bug,            tint: 'rgba(160,50,45,0.12)',  ink: 'var(--orange)' },
  { key: 'maintenance', label: 'Maintenance',     icon: Wrench,         tint: 'rgba(92,80,64,0.12)',   ink: 'var(--text-secondary)' },
  { key: 'training',    label: 'Visitor / training', icon: Users,       tint: 'rgba(103,66,145,0.12)', ink: 'var(--violet)' },
  { key: 'other',       label: 'Other',           icon: NotebookPen,    tint: 'rgba(92,80,64,0.10)',   ink: 'var(--text-secondary)' },
]);

const CATEGORY_KEYS = new Set<string>(JOURNAL_CATEGORIES.map((c) => c.key));

export function isJournalCategory(value: unknown): value is JournalCategory {
  return typeof value === 'string' && CATEGORY_KEYS.has(value);
}

export function journalCategory(key: JournalCategory): JournalCategoryDef {
  return JOURNAL_CATEGORIES.find((c) => c.key === key) ?? JOURNAL_CATEGORIES[JOURNAL_CATEGORIES.length - 1];
}

export interface JournalEntry {
  id: string;
  /** Calendar date the thing happened, 'YYYY-MM-DD'. NOT a timestamp: a farmer
   *  writes up Tuesday's work on Thursday, and the entry belongs to Tuesday. */
  date: string;
  title: string;
  notes: string;
  category: JournalCategory;
  /** Design-canvas bed/plot id when the entry was tagged from the picker; the
   *  label is stored alongside so an entry still reads correctly after a bed is
   *  renamed or the design is redrawn. */
  bedId?: string | null;
  bedLabel?: string | null;
  cropName?: string | null;
  /** Resized thumbnails (data URLs, ≤400px via resizeForStorage). */
  photos?: string[];
  /** Private planned-source reference. A stored marker still needs current membership review. */
  growerCycleLink?: unknown;
  /** Entered actual sowing evidence, separate from planned nursery requirements. */
  nurserySowing?: unknown;
  /** A dated count/assessment, never nursery stock or planned capacity. */
  nurseryProgress?: unknown;
  createdAt: number;
  updatedAt: number;
}

export interface GrowerJournalLink {
  readonly version: 1;
  readonly scope: GrowerPlanningScope;
  readonly plantingId: string;
  readonly bedId: string;
  readonly eventKind: GrowerCycleEventKind;
  /** The planned event day, separate from the journal's observed date. */
  readonly plannedDate: string;
}

export type JournalGrowerLinkInspection =
  | { readonly status: 'legacy' }
  | { readonly status: 'linked'; readonly link: GrowerJournalLink }
  | { readonly status: 'held'; readonly reason: 'invalid-link' | 'bed-changed' };

const GROWER_JOURNAL_EVENTS: readonly GrowerCycleEventKind[] = [
  'nursery-start', 'field-entry', 'first-pick', 'picking-end', 'field-clear', 'next-entry',
];
const LINK_FIELDS = ['version', 'scope', 'plantingId', 'bedId', 'eventKind', 'plannedDate'] as const;
function ownLinkFields(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!record(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key))) return null;
  const fields: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property?.enumerable || !Object.hasOwn(property, 'value')) return null;
    fields[key] = property.value;
  }
  return fields;
}

/** Decode only the private reference shape. Membership and actor admission are
 * established separately against the whole current saved crop book. */
export function normaliseGrowerJournalLink(value: unknown): GrowerJournalLink | null {
  try {
    const fields = ownLinkFields(value, LINK_FIELDS);
    if (!fields || fields.version !== 1) return null;
    const validId = (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0
      && !/[\u0000-\u001f\u007f]/.test(id);
    if (!validId(fields.plantingId) || !validId(fields.bedId)
      || !GROWER_JOURNAL_EVENTS.includes(fields.eventKind as GrowerCycleEventKind) || !isJournalDate(fields.plannedDate)) return null;
    if (!record(fields.scope)) return null;
    const kind = Object.getOwnPropertyDescriptor(fields.scope, 'kind');
    if (!kind || !Object.hasOwn(kind, 'value')) return null;
    const scopeFields = ownLinkFields(fields.scope, kind.value === 'mapped-site' ? ['kind', 'siteId'] : ['kind', 'workspaceId']);
    const scope = normaliseGrowerPlanningScope(scopeFields);
    if (!scope) return null;
    return Object.freeze({ version: 1, scope, plantingId: fields.plantingId, bedId: fields.bedId,
      eventKind: fields.eventKind as GrowerCycleEventKind, plannedDate: fields.plannedDate });
  } catch { return null; }
}

export function inspectJournalGrowerLink(entry: unknown): JournalGrowerLinkInspection {
  const invalid = { status: 'held', reason: 'invalid-link' } as const;
  try {
    if (!record(entry)) return invalid;
    const property = Object.getOwnPropertyDescriptor(entry, 'growerCycleLink');
    if (!property) return 'growerCycleLink' in entry ? invalid : { status: 'legacy' };
    if (!property.enumerable || !Object.hasOwn(property, 'value')) return invalid;
    const link = normaliseGrowerJournalLink(property.value);
    if (!link) return invalid;
    const bed = Object.getOwnPropertyDescriptor(entry, 'bedId');
    if (bed && !Object.hasOwn(bed, 'value')) return invalid;
    if (bed?.value !== undefined && bed.value !== null && bed.value !== link.bedId) return { status: 'held', reason: 'bed-changed' };
    return { status: 'linked', link };
  } catch { return invalid; }
}

// Stored malformed JSON evidence remains present through ordinary edits. Active
// runtime descriptors cannot be serialized safely, so retain an explicit hold.
function preserveJournalGrowerLink(entry: object): Pick<JournalEntry, 'growerCycleLink'> {
  const held = () => ({ growerCycleLink: { version: 0, held: true } });
  try {
    const property = Object.getOwnPropertyDescriptor(entry, 'growerCycleLink');
    if (!property) return 'growerCycleLink' in entry ? held() : {};
    if (!Object.hasOwn(property, 'value')) return held();
    return { growerCycleLink: detachJournalJSON(property.value) };
  } catch { return held(); }
}

export interface JournalNurserySowingObservation {
  readonly kind: 'nursery-sowing-observation';
  readonly version: 1;
  /** Physical trays used, including partly filled trays; null is unknown. */
  readonly traysUsed: number | null;
  readonly references: {
    readonly variety: string | null;
    readonly seedLotReference: string | null;
    readonly raisingBatchReference: string | null;
  };
}

export type JournalNurserySowingInspection =
  | { readonly status: 'legacy' }
  | { readonly status: 'observed'; readonly observation: JournalNurserySowingObservation }
  | { readonly status: 'held'; readonly reason: string };

const NURSERY_SOWING_FIELDS = ['kind', 'version', 'traysUsed', 'references'] as const;
const NURSERY_SOWING_REFERENCES = ['variety', 'seedLotReference', 'raisingBatchReference'] as const;

function nurseryReferenceSnapshot(value: unknown): JournalNurserySowingObservation['references'] | null {
  const references = ownLinkFields(value, NURSERY_SOWING_REFERENCES);
  if (!references || !NURSERY_SOWING_REFERENCES.every(key => references[key] === null
    || typeof references[key] === 'string' && references[key].trim().length > 0
      && references[key].length <= 120 && !/[\u0000-\u001f\u007f]/.test(references[key]))) return null;
  return Object.freeze({ variety: references.variety as string | null, seedLotReference: references.seedLotReference as string | null,
    raisingBatchReference: references.raisingBatchReference as string | null });
}

/** Shape inspection does not prove current crop membership or admit a writer. */
export function normaliseJournalNurserySowingObservation(value: unknown): JournalNurserySowingObservation | null {
  try {
    const fields = ownLinkFields(detachJournalJSON(value), NURSERY_SOWING_FIELDS);
    if (!fields || fields.kind !== 'nursery-sowing-observation' || fields.version !== 1
      || fields.traysUsed !== null && (typeof fields.traysUsed !== 'number'
        || !Number.isSafeInteger(fields.traysUsed) || fields.traysUsed < 0)) return null;
    const references = nurseryReferenceSnapshot(fields.references);
    if (!references) return null;
    return Object.freeze({ kind: 'nursery-sowing-observation', version: 1, traysUsed: fields.traysUsed, references });
  } catch { return null; }
}

/** Historical observations remain readable when their original plan is gone.
 * Only the guarded append writer checks current membership and actor/source. */
export function inspectJournalNurserySowing(entry: unknown): JournalNurserySowingInspection {
  const held = (reason: string): JournalNurserySowingInspection => ({ status: 'held', reason });
  try {
    if (!record(entry)) return held('invalid-entry');
    const property = Object.getOwnPropertyDescriptor(entry, 'nurserySowing');
    if (!property) return 'nurserySowing' in entry ? held('invalid-observation') : { status: 'legacy' };
    if ('nurseryProgress' in entry) return held('ambiguous-nursery-observation');
    if (!property.enumerable || !Object.hasOwn(property, 'value')) return held('invalid-observation');
    const observation = normaliseJournalNurserySowingObservation(property.value);
    if (!observation) return held('invalid-observation');
    const link = inspectJournalGrowerLink(entry);
    if (link.status !== 'linked' || link.link.eventKind !== 'nursery-start') return held('nursery-link-required');
    return { status: 'observed', observation };
  } catch { return held('observation-unreadable'); }
}

function preserveJournalNurserySowing(entry: object): Pick<JournalEntry, 'nurserySowing'> {
  return preserveJournalNurseryPayload(entry, 'nurserySowing');
}

function preserveJournalNurseryPayload(entry: object, key: 'nurserySowing' | 'nurseryProgress'): Pick<JournalEntry, 'nurserySowing' | 'nurseryProgress'> {
  const held = () => ({ [key]: { version: 0, held: true } });
  try {
    const property = Object.getOwnPropertyDescriptor(entry, key);
    if (!property) return key in entry ? held() : {};
    if (!property.enumerable || !Object.hasOwn(property, 'value')) return held();
    // Keep future/malformed JSON verbatim; dropping it could falsely turn an
    // uncertain observation into an ordinary unlinked note on the next save.
    return { [key]: detachJournalJSON(property.value) };
  } catch { return held(); }
}

export interface JournalNurseryProgressObservation {
  readonly kind: 'nursery-progress-observation';
  readonly version: 1;
  readonly stage: 'emerged' | 'alive' | 'ready';
  readonly coverage: 'whole-batch' | 'checked-subset';
  readonly plantsObserved: number;
  readonly references: JournalNurserySowingObservation['references'];
}
export type JournalNurseryProgressInspection =
  | { readonly status: 'legacy' }
  | { readonly status: 'observed'; readonly observation: JournalNurseryProgressObservation }
  | { readonly status: 'held'; readonly reason: string };
const NURSERY_PROGRESS_FIELDS = ['kind', 'version', 'stage', 'coverage', 'plantsObserved', 'references'] as const;

/** This is an entered count and assessment, not a derived inventory balance. */
export function normaliseJournalNurseryProgressObservation(value: unknown): JournalNurseryProgressObservation | null {
  try {
    const fields = ownLinkFields(detachJournalJSON(value), NURSERY_PROGRESS_FIELDS);
    if (!fields || fields.kind !== 'nursery-progress-observation' || fields.version !== 1
      || fields.stage !== 'emerged' && fields.stage !== 'alive' && fields.stage !== 'ready'
      || fields.coverage !== 'whole-batch' && fields.coverage !== 'checked-subset'
      || typeof fields.plantsObserved !== 'number' || !Number.isSafeInteger(fields.plantsObserved) || fields.plantsObserved < 0) return null;
    const references = nurseryReferenceSnapshot(fields.references);
    if (!references) return null;
    return Object.freeze({ kind: 'nursery-progress-observation', version: 1, stage: fields.stage,
      coverage: fields.coverage, plantsObserved: fields.plantsObserved, references });
  } catch { return null; }
}

export function inspectJournalNurseryProgress(entry: unknown): JournalNurseryProgressInspection {
  const held = (reason: string): JournalNurseryProgressInspection => ({ status: 'held', reason });
  try {
    if (!record(entry)) return held('invalid-entry');
    const property = Object.getOwnPropertyDescriptor(entry, 'nurseryProgress');
    if (!property) return 'nurseryProgress' in entry ? held('invalid-observation') : { status: 'legacy' };
    if ('nurserySowing' in entry) return held('ambiguous-nursery-observation');
    if (!property.enumerable || !Object.hasOwn(property, 'value')) return held('invalid-observation');
    const observation = normaliseJournalNurseryProgressObservation(property.value);
    if (!observation) return held('invalid-observation');
    const link = inspectJournalGrowerLink(entry);
    if (link.status !== 'linked' || link.link.eventKind !== 'nursery-start') return held('nursery-link-required');
    return { status: 'observed', observation };
  } catch { return held('observation-unreadable'); }
}

export interface JournalMonthGroup {
  /** 'YYYY-MM' */
  key: string;
  label: string;
  entries: JournalEntry[];
}

export interface JournalSummary {
  total: number;
  thisMonth: number;
  /** null when the journal is empty. */
  daysSinceLast: number | null;
  photoCount: number;
}

/* ── Limits ──────────────────────────────────────────────────────────────── */

export const MAX_ENTRIES = 300;
export const MAX_PHOTOS_PER_ENTRY = 3;
export const MAX_TITLE_LEN = 120;
export const MAX_NOTES_LEN = 2000;
const MAX_TAG_LEN = 60;
/** Same order of magnitude as lib/site-evidence.ts's 4 MB budget — localStorage
 *  is ~5 MB per origin and the journal is not the only tenant. */
export const JOURNAL_BYTE_BUDGET = 3 * 1024 * 1024;

/* ── Date helpers (pure, timezone-stable) ────────────────────────────────── */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real calendar date in 'YYYY-MM-DD' form (rejects 2026-02-31). */
export function isJournalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m;
  const year = Number(y); const month = Number(mo); const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

/** Local calendar date as 'YYYY-MM-DD' (what the farmer's phone shows today). */
export function todayISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function utcOf(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) return 0;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 'Tue 5 Aug' — short enough for a phone row, unambiguous about the day. */
export function formatJournalDate(date: string): string {
  if (!isJournalDate(date)) return date;
  const dt = new Date(utcOf(date));
  return `${WEEKDAY_SHORT[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTH_SHORT[dt.getUTCMonth()]}`;
}

export function monthKeyOf(date: string): string {
  return isJournalDate(date) ? date.slice(0, 7) : 'unknown';
}

export function monthLabelOf(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return 'Undated';
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return 'Undated';
  return `${MONTH_NAMES[monthIdx]} ${m[1]}`;
}

/** Whole days between two calendar dates, ignoring clocks and DST. */
export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((utcOf(toDate) - utcOf(fromDate)) / 86_400_000);
}

/* ── Normalisation ───────────────────────────────────────────────────────── */

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function cleanTag(value: unknown): string | null {
  const s = cleanText(value, MAX_TAG_LEN);
  return s.length ? s : null;
}

function cleanPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is string => typeof p === 'string' && p.startsWith('data:image/'))
    .slice(0, MAX_PHOTOS_PER_ENTRY);
}

function finiteTime(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Newest first: by calendar date, then by createdAt so two entries written on
 * the same day keep the order they were written in (latest at the top).
 */
export function sortJournal(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

/**
 * Turn anything that came out of storage into a trustworthy entry list.
 * Drops non-objects, unusable ids/dates, unknown categories and entries with
 * neither a title nor notes; de-duplicates ids; caps the list at MAX_ENTRIES.
 */
export function normaliseJournal(value: unknown): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: JournalEntry[] = [];
  for (const raw of value) {
    if (!record(raw)) continue;
    const id = cleanText(raw.id, 80);
    if (!id || seen.has(id)) continue;
    if (!isJournalDate(raw.date)) continue;
    const title = cleanText(raw.title, MAX_TITLE_LEN);
    const notes = cleanText(raw.notes, MAX_NOTES_LEN);
    if (!title && !notes) continue;
    const createdAt = finiteTime(raw.createdAt, 0);
    seen.add(id);
    out.push({
      id,
      date: raw.date,
      title,
      notes,
      category: isJournalCategory(raw.category) ? raw.category : 'other',
      bedId: cleanTag(raw.bedId),
      bedLabel: cleanTag(raw.bedLabel),
      cropName: cleanTag(raw.cropName),
      photos: cleanPhotos(raw.photos),
      ...preserveJournalGrowerLink(raw),
      ...preserveJournalNurserySowing(raw),
      ...preserveJournalNurseryPayload(raw, 'nurseryProgress'),
      createdAt,
      updatedAt: finiteTime(raw.updatedAt, createdAt),
    });
  }
  return sortJournal(out).slice(0, MAX_ENTRIES);
}

/* ── Pure list operations ────────────────────────────────────────────────── */

export interface JournalEntryInput {
  date: string;
  title: string;
  notes: string;
  category: JournalCategory;
  bedId?: string | null;
  bedLabel?: string | null;
  cropName?: string | null;
  photos?: string[];
  growerCycleLink?: unknown;
  nurserySowing?: unknown;
  nurseryProgress?: unknown;
}

export function newJournalId(now: number = Date.now()): string {
  return `je_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Build a storable entry from raw form input. Never throws; always normalised. */
export function createJournalEntry(input: JournalEntryInput, now: number = Date.now()): JournalEntry {
  return {
    id: newJournalId(now),
    date: isJournalDate(input.date) ? input.date : todayISODate(new Date(now)),
    title: cleanText(input.title, MAX_TITLE_LEN),
    notes: cleanText(input.notes, MAX_NOTES_LEN),
    category: isJournalCategory(input.category) ? input.category : 'other',
    bedId: cleanTag(input.bedId),
    bedLabel: cleanTag(input.bedLabel),
    cropName: cleanTag(input.cropName),
    photos: cleanPhotos(input.photos),
    ...preserveJournalGrowerLink(input),
    ...preserveJournalNurserySowing(input),
    ...preserveJournalNurseryPayload(input, 'nurseryProgress'),
    createdAt: now,
    updatedAt: now,
  };
}

/** Insert or replace by id, keeping the list sorted and capped. */
export function upsertJournalEntry(entries: JournalEntry[], entry: JournalEntry): JournalEntry[] {
  const without = entries.filter((e) => e.id !== entry.id);
  return sortJournal([...without, entry]).slice(0, MAX_ENTRIES);
}

export function removeJournalEntry(entries: JournalEntry[], id: string): JournalEntry[] {
  return entries.filter((e) => e.id !== id);
}

/** Apply edited fields to an existing entry, refreshing updatedAt. */
export function editJournalEntry(
  entry: JournalEntry,
  input: JournalEntryInput,
  now: number = Date.now(),
): JournalEntry {
  const edited = createJournalEntry(input, now);
  // An ordinary editor cannot attach a new observed fact to a legacy note.
  // Original evidence alone survives, including retained malformed evidence.
  delete edited.nurserySowing;
  delete edited.nurseryProgress;
  return {
    ...edited,
    ...preserveJournalGrowerLink(entry),
    ...preserveJournalNurserySowing(entry),
    ...preserveJournalNurseryPayload(entry, 'nurseryProgress'),
    id: entry.id,
    createdAt: entry.createdAt,
    updatedAt: now,
  };
}

/* ── Views ───────────────────────────────────────────────────────────────── */

/** Newest month first; entries inside each month stay newest first. */
export function groupJournalByMonth(entries: JournalEntry[]): JournalMonthGroup[] {
  const buckets = new Map<string, JournalEntry[]>();
  for (const entry of sortJournal(entries)) {
    const key = monthKeyOf(entry.date);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }
  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([key, list]) => ({ key, label: monthLabelOf(key), entries: list }));
}

export function journalSummary(entries: JournalEntry[], today: string = todayISODate()): JournalSummary {
  const sorted = sortJournal(entries);
  const monthKey = today.slice(0, 7);
  return {
    total: sorted.length,
    thisMonth: sorted.filter((e) => monthKeyOf(e.date) === monthKey).length,
    daysSinceLast: sorted.length ? Math.max(0, daysBetween(sorted[0].date, today)) : null,
    photoCount: sorted.reduce((n, e) => n + (e.photos?.length ?? 0), 0),
  };
}

/** Most recent photos across the whole journal, for the timeline's photo strip. */
export function recentJournalPhotos(
  entries: JournalEntry[],
  limit = 8,
): Array<{ entryId: string; date: string; src: string }> {
  const out: Array<{ entryId: string; date: string; src: string }> = [];
  for (const entry of sortJournal(entries)) {
    for (const src of entry.photos ?? []) {
      out.push({ entryId: entry.id, date: entry.date, src });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/* ── Storage-size guard ──────────────────────────────────────────────────── */

export function journalByteSize(entries: JournalEntry[]): number {
  return JSON.stringify(entries).length;
}

/**
 * Keep the WRITING even when the photos will not fit. Notes are the record a
 * farmer cannot re-create; a thumbnail is a nice-to-have. So we shed photos
 * from the oldest entries first, and only then drop whole oldest entries.
 * lib/site-evidence.ts evicts silently for the same reason — here the caller
 * is told (saveJournal's return) so the UI can say what happened.
 */
export function trimJournalForStorage(
  entries: JournalEntry[],
  budgetBytes: number = JOURNAL_BYTE_BUDGET,
): JournalEntry[] {
  let list = sortJournal(entries).slice(0, MAX_ENTRIES);
  if (journalByteSize(list) <= budgetBytes) return list;

  // Oldest first for shedding — sortJournal is newest first.
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (journalByteSize(list) <= budgetBytes) return list;
    if (list[i].photos?.length) list = list.map((e, idx) => (idx === i ? { ...e, photos: [] } : e));
  }
  while (list.length > 1 && journalByteSize(list) > budgetBytes) list = list.slice(0, -1);
  return list;
}

/** Share the existing normalization authority without saving its reconstructed
 * display list over an unrecognized or partly hidden original record. */
export function inspectJournalRowsForWrite(raw: string): { rows: Record<string, unknown>[]; entries: JournalEntry[] } | null {
  try {
    if (!journalRawJSONIsLossless(raw)) return null;
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length > MAX_ENTRIES) return null;
    const entries = normaliseJournal(rows);
    if (entries.length !== rows.length) return null;
    const byId = new Map(entries.map(row => [row.id, row]));
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
      const entry = byId.get(row.id);
      if (!entry || inspectJournalGrowerLink(row).status === 'held' || inspectJournalNurserySowing(row).status === 'held'
        || inspectJournalNurseryProgress(row).status === 'held') return null;
      for (const key of ['id', 'date', 'title', 'notes', 'category', 'bedId', 'bedLabel', 'cropName', 'photos', 'createdAt', 'updatedAt', 'nurserySowing', 'nurseryProgress'] as const) {
        if (Object.hasOwn(row, key) && JSON.stringify(row[key]) !== JSON.stringify(entry[key])) return null;
      }
    }
    return { rows, entries };
  } catch { return null; }
}

/* ── Storage ─────────────────────────────────────────────────────────────── */

export const JOURNAL_CHANGED_EVENT = 'imbewu-field-journal-changed';
interface JournalReadAdmission {
  context: JournalObservationContext | null;
  token: string;
  raw: string;
  sample: boolean;
  storage: Storage;
  key: string;
  display: string;
}
const journalReadAdmissions = new WeakMap<JournalEntry[], JournalReadAdmission>();
export function releaseJournalRead(entries: JournalEntry[]): void {
  const admission = journalReadAdmissions.get(entries);
  if (admission) { revokeJournalObservationContext(admission.context); journalReadAdmissions.delete(entries); }
}
function notifyJournal(): void {
  try { window.dispatchEvent(new CustomEvent(JOURNAL_CHANGED_EVENT)); } catch { /* Storage receipts, not UI events, establish the write. */ }
}
export function loadJournal(): JournalEntry[] {
  if (typeof window === 'undefined') return [];
  let context: JournalObservationContext | null = null;
  try {
    context = captureJournalObservationContext();
    if (!journalObservationContextIsCurrent(context)) { revokeJournalObservationContext(context); return []; }
    const state = readJournalStorage(), sample = state.status === 'sample';
    const storage = window.localStorage, key = activeAccountLocalStorageKey(JOURNAL_LEGACY_KEY);
    const raw = sample ? storage.getItem(key) ?? '[]' : state.journalRaw;
    const entries = raw === null ? [] : normaliseJournal(JSON.parse(raw));
    const admission = raw === null ? null : inspectJournalRowsForWrite(raw);
    if (admission && (sample || state.status === 'ready' && state.writable && state.token)) {
      journalReadAdmissions.set(entries, { context, token: sample ? raw! : state.token!, raw: raw!, sample,
        storage, key, display: JSON.stringify(entries) });
    } else revokeJournalObservationContext(context);
    return entries;
  } catch { revokeJournalObservationContext(context); return []; }
}

export interface JournalSaveResult {
  ok: boolean;
  entries: JournalEntry[];
  trimmed: boolean;
  /** A side effect may have happened. The editor must retain its draft and
   * direct the grower to inspect the journal rather than repeat the write. */
  unconfirmed?: boolean;
  held?: boolean;
}

/** The original loaded list is explicit write provenance. A new actor, stale
 * editor or display-normalized empty list cannot overwrite the canonical book. */
export function saveJournal(entries: JournalEntry[], sourceEntries?: JournalEntry[]): JournalSaveResult {
  const fail = (): JournalSaveResult => ({ ok: false, entries, trimmed: false, held: true });
  const admission = sourceEntries && journalReadAdmissions.get(sourceEntries);
  if (!admission || !journalObservationContextIsCurrent(admission.context)
    ) return fail();
  try { if (admission.display !== JSON.stringify(detachJournalJSON(sourceEntries))) return fail(); } catch { return fail(); }
  const before = inspectJournalRowsForWrite(admission.raw);
  if (!before || typeof window === 'undefined' || window.localStorage !== admission.storage) return fail();
  let attempted = false;
  const current = () => journalObservationContextIsCurrent(admission.context)
    && window.localStorage === admission.storage && activeAccountLocalStorageKey(JOURNAL_LEGACY_KEY) === admission.key
    && (admission.sample ? admission.storage.getItem(admission.key) === admission.raw : readJournalStorage().token === admission.token);
  try {
    if (!current()) return fail();
    const candidate = detachJournalJSON(entries) as JournalEntry[];
    if (!Array.isArray(candidate) || candidate.length > MAX_ENTRIES || normaliseJournal(candidate).length !== candidate.length) return fail();
    const rawById = new Map(before.rows.map(row => [row.id, row]));
    const nextRows = candidate.map(entry => {
      const original = rawById.get(entry.id);
      // Ordinary edits may retain a link; only the checked task action creates
      // a new one. Never silently change or discard an original marker.
      if (!original && Object.hasOwn(entry, 'growerCycleLink')) throw Error('new-link-requires-current-cycle');
      if (original && (Object.hasOwn(original, 'growerCycleLink') !== Object.hasOwn(entry, 'growerCycleLink')
        || JSON.stringify(original.growerCycleLink) !== JSON.stringify(entry.growerCycleLink))) throw Error('link-changed');
      if (!original && Object.hasOwn(entry, 'nurserySowing')) throw Error('new-observation-requires-current-cycle');
      if (original && (Object.hasOwn(original, 'nurserySowing') !== Object.hasOwn(entry, 'nurserySowing')
        || JSON.stringify(original.nurserySowing) !== JSON.stringify(entry.nurserySowing))) throw Error('observation-changed');
      if (!original && Object.hasOwn(entry, 'nurseryProgress')) throw Error('new-progress-requires-current-cycle');
      if (original && (Object.hasOwn(original, 'nurseryProgress') !== Object.hasOwn(entry, 'nurseryProgress')
        || JSON.stringify(original.nurseryProgress) !== JSON.stringify(entry.nurseryProgress))) throw Error('progress-changed');
      return { ...original, ...entry };
    });
    const next = JSON.stringify(nextRows);
    if (next.length > JOURNAL_BYTE_BUDGET || !inspectJournalRowsForWrite(next) || !current()) return fail();
    let unconfirmed = false, writtenToken: string | null = null;
    if (admission.sample) {
      attempted = true; admission.storage.setItem(admission.key, next);
      unconfirmed = !journalObservationContextIsCurrent(admission.context) || admission.storage.getItem(admission.key) !== next;
    } else {
      attempted = true;
      const result = writeJournalStorageRaw(next, admission.token, undefined, () => journalObservationContextIsCurrent(admission.context));
      if (result.status === 'held') return fail();
      unconfirmed = result.status === 'unconfirmed';
      if (result.status === 'written') writtenToken = result.token;
    }
    if (!journalObservationContextIsCurrent(admission.context)) unconfirmed = true;
    if (unconfirmed) return { ok: false, entries, trimmed: false, unconfirmed: true };
    const ownReceiptMatches = () => admission.sample
      ? admission.storage.getItem(admission.key) === next
      : readJournalStorage().token === writtenToken && readJournalStorage().journalRaw === next;
    if (!ownReceiptMatches()) return { ok: false, entries, trimmed: false, unconfirmed: true };
    const saved = loadJournal(); notifyJournal();
    if (!ownReceiptMatches()) { releaseJournalRead(saved); return { ok: false, entries, trimmed: false, unconfirmed: true }; }
    if (!journalObservationContextIsCurrent(admission.context)) { releaseJournalRead(saved); return { ok: false, entries, trimmed: false, unconfirmed: true }; }
    releaseJournalRead(sourceEntries!);
    return { ok: true, entries: saved, trimmed: false };
  } catch { return attempted ? { ok: false, entries, trimmed: false, unconfirmed: true } : fail(); }
}
