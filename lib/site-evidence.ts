// Site evidence storage — localStorage-based, keyed by siteId + itemKey
// Photos stored as resized base64 thumbnails (≤ 400px, ~30-50KB each)
// Max 4 items per key, 40 items total across all keys to stay within localStorage limits

import {
  EVIDENCE_CATALOGUE,
  evidenceStorageKeyBelongsToGroup,
  isEvidenceGroupKey,
  isQuickNumberField,
} from './evidence-catalogue';
import { activeAccountLocalStorageKey } from './account-local-storage';

export interface EvidenceItem {
  id: string;
  type: 'photo' | 'pdf' | 'note';
  dataUrl?: string;    // base64 data URL for photos (thumbnail, ≤ 400px)
  name?: string;       // filename for PDFs / notes
  note?: string;
  takenAt: number;     // Unix timestamp ms
  sizeBytes?: number;
}

export interface QuickNumbers {
  [fieldKey: string]: string;
}

interface SiteEvidenceStore {
  [siteId: string]: {
    items: { [itemKey: string]: EvidenceItem[] };
    quickNumbers: { [groupKey: string]: QuickNumbers };
  };
}

const STORE_KEY = 'imbewu_evidence_v1';
const MAX_PER_KEY = 4;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !UNSAFE_KEYS.has(value);
}

function validStoredItem(value: unknown): value is EvidenceItem {
  if (!record(value)
      || !safeKey(value.id)
      || !['photo', 'pdf', 'note'].includes(String(value.type))
      || typeof value.takenAt !== 'number' || !Number.isFinite(value.takenAt) || value.takenAt < 0
      || (value.sizeBytes !== undefined && (
        typeof value.sizeBytes !== 'number' || !Number.isFinite(value.sizeBytes) || value.sizeBytes < 0
      ))
      || (value.dataUrl !== undefined && typeof value.dataUrl !== 'string')
      || (value.name !== undefined && typeof value.name !== 'string')
      || (value.note !== undefined && typeof value.note !== 'string')) return false;
  return true;
}

function hasPayload(value: EvidenceItem): boolean {
  if (value.type === 'photo') return typeof value.dataUrl === 'string' && value.dataUrl.length > 0;
  if (value.type === 'pdf') return typeof value.name === 'string' && value.name.length > 0;
  return typeof value.note === 'string' && value.note.length > 0;
}

function normaliseStore(value: unknown): SiteEvidenceStore {
  const result: SiteEvidenceStore = {};
  if (!record(value)) return result;
  for (const [siteId, siteValue] of Object.entries(value)) {
    if (!safeKey(siteId) || !record(siteValue)) continue;
    const items: Record<string, EvidenceItem[]> = {};
    if (record(siteValue.items)) {
      for (const [itemKey, itemValue] of Object.entries(siteValue.items)) {
        if (!safeKey(itemKey) || !Array.isArray(itemValue)) continue;
        const valid = itemValue.filter(validStoredItem);
        if (valid.length) items[itemKey] = valid;
      }
    }
    const quickNumbers: Record<string, QuickNumbers> = {};
    if (record(siteValue.quickNumbers)) {
      for (const [groupKey, groupValue] of Object.entries(siteValue.quickNumbers)) {
        if (!safeKey(groupKey) || !record(groupValue)) continue;
        const fields: QuickNumbers = {};
        for (const [fieldKey, fieldValue] of Object.entries(groupValue)) {
          if (safeKey(fieldKey) && typeof fieldValue === 'string') fields[fieldKey] = fieldValue;
        }
        if (Object.keys(fields).length) quickNumbers[groupKey] = fields;
      }
    }
    result[siteId] = { items, quickNumbers };
  }
  return result;
}

function load(): SiteEvidenceStore {
  const storage = browserStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(activeAccountLocalStorageKey(STORE_KEY));
    return normaliseStore(raw ? JSON.parse(raw) : {});
  } catch {
    return {};
  }
}

const BYTE_BUDGET = 4 * 1024 * 1024; // 4 MB

function browserStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined') return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* storage access denied */ }
  return null;
}

function save(store: SiteEvidenceStore): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    storage.setItem(activeAccountLocalStorageKey(STORE_KEY), JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

type Located = { siteId: string; itemKey: string; id: string; takenAt: number };

function locatedItems(store: SiteEvidenceStore): Located[] {
  const all: Located[] = [];
  for (const [siteId, site] of Object.entries(store)) {
    for (const [itemKey, items] of Object.entries(site.items)) {
      items.forEach((item) => all.push({ siteId, itemKey, id: item.id, takenAt: item.takenAt }));
    }
  }
  return all.sort((a, b) => a.takenAt - b.takenAt);
}

function removeLocated(store: SiteEvidenceStore, location: Located): void {
  const items = store[location.siteId]?.items?.[location.itemKey];
  if (items) {
    store[location.siteId].items[location.itemKey] = items.filter((item) => item.id !== location.id);
  }
}

/** Evict oldest EvidenceItems until both documented storage limits hold. */
function evictUntilWithinLimits(store: SiteEvidenceStore): void {
  // Collect all items with their location so we can remove them
  const all = locatedItems(store);
  let count = all.length;
  for (const loc of all) {
    // STORAGE PRESSURE IS THE ONLY REASON TO DISCARD A FARMER'S PHOTO.
    //
    // A `count <= 40` cap was added alongside this budget and then removed here. The catalogue
    // offers 52 evidence tiles at MAX_PER_KEY 4 each — 208 items the app itself invites someone to
    // record — so a forty-item ceiling silently deleted the work of anyone who actually did the
    // survey properly, while sitting far inside the 4 MB budget. The byte budget is a real
    // constraint (localStorage runs out); a round number well below the app's own capacity is not.
    if (JSON.stringify(store).length * 2 <= BYTE_BUDGET) break; // conservative UTF-16 estimate
    removeLocated(store, loc);
    count -= 1;
  }
}

export function getSiteEvidence(siteId: string): { [itemKey: string]: EvidenceItem[] } {
  return load()[siteId]?.items ?? {};
}

export function getEvidenceItems(siteId: string, itemKey: string): EvidenceItem[] {
  return (load()[siteId]?.items?.[itemKey] ?? []).filter(hasPayload);
}

export function addEvidenceItem(siteId: string, itemKey: string, item: Omit<EvidenceItem, 'id' | 'takenAt'>): boolean {
  if (!safeKey(siteId) || !safeKey(itemKey)) return false;
  const now = Date.now();
  const candidate: EvidenceItem = {
    ...item,
    id: `ev_${now}_${Math.random().toString(36).slice(2, 7)}`,
    takenAt: now,
  };
  if (!validStoredItem(candidate) || !hasPayload(candidate)) return false;
  const store = load();
  if (!store[siteId]) store[siteId] = { items: {}, quickNumbers: {} };
  if (!store[siteId].items[itemKey]) store[siteId].items[itemKey] = [];
  const existing = store[siteId].items[itemKey];
  while (existing.length >= MAX_PER_KEY) {
    const oldestIndex = existing.reduce(
      (best, row, index) => row.takenAt < existing[best].takenAt ? index : best,
      0,
    );
    existing.splice(oldestIndex, 1);
  }
  existing.push(candidate);
  evictUntilWithinLimits(store);
  // An item larger than the whole budget evicts itself. That is not a successful
  // upload, and the unpersisted working copy must not delete older evidence.
  if (!store[siteId]?.items?.[itemKey]?.some((row) => row.id === candidate.id)) return false;
  return save(store);
}

export function removeEvidenceItem(siteId: string, itemKey: string, itemId: string): boolean {
  if (!safeKey(siteId) || !safeKey(itemKey) || !safeKey(itemId)) return false;
  const store = load();
  const arr = store[siteId]?.items?.[itemKey];
  if (!arr?.some((item) => item.id === itemId)) return false;
  store[siteId].items[itemKey] = arr.filter((item) => item.id !== itemId);
  return save(store);
}

export function getQuickNumbers(siteId: string, groupKey: string): QuickNumbers {
  return load()[siteId]?.quickNumbers?.[groupKey] ?? {};
}

export function setQuickNumber(siteId: string, groupKey: string, fieldKey: string, value: string): boolean {
  if (!safeKey(siteId) || !safeKey(groupKey) || !safeKey(fieldKey) || typeof value !== 'string') return false;
  const store = load();
  if (!store[siteId]) store[siteId] = { items: {}, quickNumbers: {} };
  if (!store[siteId].quickNumbers[groupKey]) store[siteId].quickNumbers[groupKey] = {};
  store[siteId].quickNumbers[groupKey][fieldKey] = value;
  return save(store);
}

// Completeness: 0–100, based on how many of the 6 main groups have ≥ 1 item
export function getReportCompleteness(siteId: string): number {
  const site = load()[siteId];
  const items = site?.items ?? {};
  const groupKeys = EVIDENCE_CATALOGUE.map((group) => group.key);
  const groupsWithItems = groupKeys.filter((groupKey) =>
    Object.entries(items).some(([storageKey, rows]) =>
      evidenceStorageKeyBelongsToGroup(storageKey, groupKey) && rows.some(hasPayload))
  );
  // Also count quick numbers as evidence
  const qn = site?.quickNumbers ?? {};
  const groupsWithQn = groupKeys.filter((groupKey) => {
    return qn[groupKey] && Object.entries(qn[groupKey]).some(
      ([fieldKey, value]) => isQuickNumberField(groupKey, fieldKey) && value.trim().length > 0,
    );
  });
  const covered = new Set([...groupsWithItems, ...groupsWithQn]);
  return Math.round((covered.size / groupKeys.length) * 100);
}

// Total count of evidence items across all keys for a site
export function getTotalEvidenceCount(siteId: string): number {
  const items = load()[siteId]?.items ?? {};
  return Object.values(items).reduce(
    (sum, arr) => sum + arr.filter(hasPayload).length,
    0,
  );
}

// Group-level summary: payload-bearing items in the group's exact catalogue keys
export function getGroupCount(siteId: string, groupKey: string): number {
  if (!isEvidenceGroupKey(groupKey)) return 0;
  const items = load()[siteId]?.items ?? {};
  return Object.entries(items)
    .filter(([storageKey]) => evidenceStorageKeyBelongsToGroup(storageKey, groupKey))
    .reduce((sum, [, arr]) => sum + arr.filter(hasPayload).length, 0);
}

// Resize a File to a small thumbnail for storage
export function resizeForStorage(file: File, maxPx = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode image'));
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}
