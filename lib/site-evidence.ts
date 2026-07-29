// Site evidence storage — localStorage-based, keyed by siteId + itemKey
// Photos stored as resized base64 thumbnails (≤ 400px, ~30-50KB each)
// Max 4 items per key, 40 items total across all keys to stay within localStorage limits

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

function load(): SiteEvidenceStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const BYTE_BUDGET = 4 * 1024 * 1024; // 4 MB

function save(store: SiteEvidenceStore): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/** Evict oldest EvidenceItems (by takenAt across all siteIds/keys) until serialized size is under BYTE_BUDGET. */
function evictUntilUnderBudget(store: SiteEvidenceStore): void {
  // Collect all items with their location so we can remove them
  type Located = { siteId: string; itemKey: string; idx: number; takenAt: number };
  const all: Located[] = [];
  for (const siteId of Object.keys(store)) {
    const items = store[siteId]?.items ?? {};
    for (const itemKey of Object.keys(items)) {
      items[itemKey].forEach((ev, idx) => {
        all.push({ siteId, itemKey, idx, takenAt: ev.takenAt });
      });
    }
  }
  // Sort oldest first
  all.sort((a, b) => a.takenAt - b.takenAt);

  for (const loc of all) {
    if (JSON.stringify(store).length * 2 <= BYTE_BUDGET) break; // rough byte estimate
    const arr = store[loc.siteId]?.items?.[loc.itemKey];
    if (!arr) continue;
    // Find the item by index position (remove by identity since indices may shift)
    const evToRemove = arr.find((ev) => ev.takenAt === loc.takenAt);
    if (evToRemove) {
      store[loc.siteId].items[loc.itemKey] = arr.filter((ev) => ev !== evToRemove);
    }
  }
}

export function getSiteEvidence(siteId: string): { [itemKey: string]: EvidenceItem[] } {
  return load()[siteId]?.items ?? {};
}

export function getEvidenceItems(siteId: string, itemKey: string): EvidenceItem[] {
  return load()[siteId]?.items?.[itemKey] ?? [];
}

export function addEvidenceItem(siteId: string, itemKey: string, item: Omit<EvidenceItem, 'id' | 'takenAt'>): boolean {
  const store = load();
  if (!store[siteId]) store[siteId] = { items: {}, quickNumbers: {} };
  if (!store[siteId].items[itemKey]) store[siteId].items[itemKey] = [];
  const existing = store[siteId].items[itemKey];
  if (existing.length >= MAX_PER_KEY) existing.splice(0, 1); // drop oldest
  existing.push({ ...item, id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, takenAt: Date.now() });
  // Enforce byte budget before writing
  if (JSON.stringify(store).length * 2 > BYTE_BUDGET) {
    evictUntilUnderBudget(store);
  }
  return save(store);
}

export function removeEvidenceItem(siteId: string, itemKey: string, itemId: string): void {
  const store = load();
  const arr = store[siteId]?.items?.[itemKey];
  if (arr) {
    store[siteId].items[itemKey] = arr.filter((e) => e.id !== itemId);
    save(store);
  }
}

export function getQuickNumbers(siteId: string, groupKey: string): QuickNumbers {
  return load()[siteId]?.quickNumbers?.[groupKey] ?? {};
}

export function setQuickNumber(siteId: string, groupKey: string, fieldKey: string, value: string): boolean {
  const store = load();
  if (!store[siteId]) store[siteId] = { items: {}, quickNumbers: {} };
  if (!store[siteId].quickNumbers[groupKey]) store[siteId].quickNumbers[groupKey] = {};
  store[siteId].quickNumbers[groupKey][fieldKey] = value;
  return save(store);
}

// Completeness: 0–100, based on how many of the 6 main groups have ≥ 1 item
export function getReportCompleteness(siteId: string): number {
  const items = load()[siteId]?.items ?? {};
  const MAIN_GROUPS = ['water', 'structures', 'soil', 'trees', 'animals', 'energy'];
  const groupsWithItems = MAIN_GROUPS.filter((g) =>
    Object.keys(items).some((k) => k.startsWith(`${g}_`) && (items[k]?.length ?? 0) > 0)
  );
  // Also count quick numbers as evidence
  const qn = load()[siteId]?.quickNumbers ?? {};
  const groupsWithQn = MAIN_GROUPS.filter((g) => {
    return qn[g] && Object.values(qn[g]).some(Boolean);
  });
  const covered = new Set([...groupsWithItems, ...groupsWithQn]);
  return Math.round((covered.size / MAIN_GROUPS.length) * 100);
}

// Total count of evidence items across all keys for a site
export function getTotalEvidenceCount(siteId: string): number {
  const items = load()[siteId]?.items ?? {};
  return Object.values(items).reduce((sum, arr) => sum + arr.length, 0);
}

// Group-level summary: how many items in any key that starts with groupKey
export function getGroupCount(siteId: string, groupKey: string): number {
  const items = load()[siteId]?.items ?? {};
  return Object.entries(items)
    .filter(([k]) => k.startsWith(`${groupKey}_`))
    .reduce((sum, [, arr]) => sum + arr.length, 0);
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
