// Field Journal — the dated record of what actually happened on the land.
//
// Storage follows lib/crop-plan.ts exactly: ONE bare localStorage key routed
// through activeAccountLocalStorageKey(), plus a CustomEvent so every mounted
// view refreshes together. That is deliberate and load-bearing for the demo:
// lib/sample-mode.ts patches Storage.prototype itself, so a store that only
// ever touches window.localStorage is sandboxed for free while sampling —
// no sandbox getter/setter of its own, no second copy of that safety boundary.
//
// Everything above the STORAGE section is pure (no window, no I/O) so the
// grouping, normalisation and trimming rules can be tested directly.

import { activeAccountLocalStorageKey } from './account-local-storage';

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
  /** Emoji, rendered as text (same convention as lib/task-board.ts's icons). */
  icon: string;
  tint: string;
  ink: string;
}

// English-only on purpose. lib/i18n.tsx carries 10 languages across ~9k lines and
// is edited by everything; lib/task-board.ts sets the precedent of hardcoding a
// small verb/label set here and translating it in a later pass.
export const JOURNAL_CATEGORIES: readonly JournalCategoryDef[] = Object.freeze([
  { key: 'planting',    label: 'Planting',        icon: '🌱', tint: 'rgba(31,77,43,0.10)',   ink: '#1F4D2B' },
  { key: 'harvest',     label: 'Harvest',         icon: '🧺', tint: 'rgba(164,110,20,0.12)', ink: '#8A5B0F' },
  { key: 'weather',     label: 'Weather',         icon: '🌦️', tint: 'rgba(37,99,143,0.12)',  ink: '#1F5C82' },
  { key: 'pest',        label: 'Pest / disease',  icon: '🐛', tint: 'rgba(160,50,45,0.12)',  ink: '#9B3630' },
  { key: 'maintenance', label: 'Maintenance',     icon: '🛠️', tint: 'rgba(92,80,64,0.12)',   ink: '#5C5040' },
  { key: 'training',    label: 'Visitor / training', icon: '👥', tint: 'rgba(103,66,145,0.12)', ink: '#5C3F86' },
  { key: 'other',       label: 'Other',           icon: '📝', tint: 'rgba(92,80,64,0.10)',   ink: '#5C5040' },
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
  createdAt: number;
  updatedAt: number;
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
  return {
    ...createJournalEntry(input, now),
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

/* ── Storage ─────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'imbewu_field_journal_v1';
export const JOURNAL_CHANGED_EVENT = 'imbewu-field-journal-changed';

export function loadJournal(): JournalEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(STORAGE_KEY));
    return raw ? normaliseJournal(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export interface JournalSaveResult {
  ok: boolean;
  /** What actually landed in storage — may have shed photos or old entries. */
  entries: JournalEntry[];
  trimmed: boolean;
}

export function saveJournal(entries: JournalEntry[]): JournalSaveResult {
  const trimmed = trimJournalForStorage(entries);
  const didTrim = trimmed.length !== entries.length
    || journalByteSize(trimmed) !== journalByteSize(sortJournal(entries).slice(0, MAX_ENTRIES));
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ok: false, entries: trimmed, trimmed: didTrim };
  }
  try {
    window.localStorage.setItem(activeAccountLocalStorageKey(STORAGE_KEY), JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(JOURNAL_CHANGED_EVENT));
    return { ok: true, entries: trimmed, trimmed: didTrim };
  } catch {
    // Quota exceeded even after trimming (another tenant filled the origin) —
    // drop every photo and try once more so the words still survive.
    try {
      const textOnly = trimmed.map((e) => ({ ...e, photos: [] }));
      window.localStorage.setItem(activeAccountLocalStorageKey(STORAGE_KEY), JSON.stringify(textOnly));
      window.dispatchEvent(new CustomEvent(JOURNAL_CHANGED_EVENT));
      return { ok: true, entries: textOnly, trimmed: true };
    } catch {
      return { ok: false, entries: trimmed, trimmed: didTrim };
    }
  }
}
