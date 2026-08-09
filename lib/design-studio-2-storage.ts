// Persistence for the Design Studio 2.0 shell.
//
// DELIBERATELY ITS OWN STORE, NOT loadCanvasState/saveCanvasState.
//
// lib/design-studio-shell.ts already says why, and it is the whole reason this file exists rather
// than a call into the real one: 2.0's canvas is a blank true-scale grid measured in metres from a
// stage origin. It has no CanvasFrame, no GPS anchor and no siteId lineage. The farmer's REAL
// design is georeferenced, and the current studio reads it. Writing stage metres into that store
// would not be an incomplete integration — it would be a farmer's actual plan overwritten with
// coordinates that mean something else. Separate key, no overlap, no risk to saved work.
//
// What this buys today is the thing that made 2.0 read as a mock: reload and your work is gone.
// It is now a studio you can close and come back to, while staying honest that it is not yet
// wired to the real map.

import { accountLocalStorageKey, activeAccountLocalStorageKey } from '@/lib/account-local-storage';
import type { DemoItem, DemoLine } from '@/lib/design-studio-shell';

export const STUDIO2_STORAGE_BASE = 'imbewu_studio2_design';

/** Bumped only when a stored shape can no longer be read. A mismatch is discarded, never migrated
 *  by guesswork — this store holds exploratory work, and a wrong migration is worse than a blank
 *  stage the farmer can see is blank. */
export const STUDIO2_STORAGE_VERSION = 1;

export interface Studio2Design {
  items: DemoItem[];
  lines: DemoLine[];
}

interface StoredShape {
  v: number;
  items: unknown;
  lines: unknown;
  savedAt: string;
}

function keyFor(siteId: string, ownerUid?: string | null): string {
  const base = `${STUDIO2_STORAGE_BASE}_${siteId}`;
  return ownerUid === undefined ? activeAccountLocalStorageKey(base) : accountLocalStorageKey(base, ownerUid);
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Validate on READ, always. localStorage is editable by anyone at the keyboard and survives every
 *  refactor this shape will go through; a component that trusts it renders NaN coordinates into a
 *  canvas and takes the whole studio down with it. */
function readItems(raw: unknown): DemoItem[] {
  if (!Array.isArray(raw)) return [];
  const out: DemoItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const { id, defId, xM, yM } = r as Record<string, unknown>;
    if (typeof id !== 'string' || !id) continue;
    if (typeof defId !== 'string' || !defId) continue;
    if (!finite(xM) || !finite(yM)) continue;
    out.push({ id, defId, xM, yM });
  }
  return out;
}

function readLines(raw: unknown): DemoLine[] {
  if (!Array.isArray(raw)) return [];
  const out: DemoLine[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const { id, kind, pointsM } = r as Record<string, unknown>;
    if (typeof id !== 'string' || !id) continue;
    if (typeof kind !== 'string' || !kind) continue;
    if (!Array.isArray(pointsM)) continue;
    const pts = pointsM.filter(
      (p): p is [number, number] => Array.isArray(p) && p.length === 2 && finite(p[0]) && finite(p[1]),
    );
    // A line needs two points to BE a line. One survivor is corruption, not a line.
    if (pts.length < 2) continue;
    out.push({ id, kind: kind as DemoLine['kind'], pointsM: pts });
  }
  return out;
}

export function loadStudio2Design(siteId: string, ownerUid?: string | null): Studio2Design | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyFor(siteId, ownerUid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredShape;
    if (!parsed || parsed.v !== STUDIO2_STORAGE_VERSION) return null;
    const design = { items: readItems(parsed.items), lines: readLines(parsed.lines) };
    // An empty result from a non-empty record means every entry failed validation. Report nothing
    // rather than an empty design, so the caller does not overwrite a recoverable record with {}.
    if (!design.items.length && !design.lines.length) return null;
    return design;
  } catch {
    return null;
  }
}

/** Thrown when the design genuinely could not be persisted.
 *
 *  Callers MUST surface this. lib/design-canvas.ts learned it the expensive way — its own
 *  CanvasSaveError comment reads "silently returning 'saved' is what let a farmer's zones
 *  disappear while the header said 'Saved'". The same rule holds for a quota failure here. */
export class Studio2SaveError extends Error {}

export function saveStudio2Design(siteId: string, design: Studio2Design, ownerUid?: string | null): void {
  if (typeof window === 'undefined') return;
  const payload: StoredShape = {
    v: STUDIO2_STORAGE_VERSION,
    items: design.items,
    lines: design.lines,
    savedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(keyFor(siteId, ownerUid), JSON.stringify(payload));
  } catch (err) {
    throw new Studio2SaveError(err instanceof Error ? err.message : 'Could not save');
  }
}

export function clearStudio2Design(siteId: string, ownerUid?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(siteId, ownerUid));
  } catch {
    /* best effort */
  }
}
