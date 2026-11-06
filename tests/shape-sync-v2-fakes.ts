// Deterministic test doubles for shape sync v2. Not a Firestore emulator: the transport below
// models exactly the guarantee the real code relies on from runTransaction — a commit fails and
// the step re-runs when the document changed between the read and the commit — plus the three
// network failures that matter: offline before read, a commit whose response is lost, and an
// interleaved commit from another device. Every commit is logged as a receipt.

import type { Feature, FeatureCollection } from 'geojson';
import {
  createShapeSyncController, shapeSyncKeys,
  type ShapeSyncController, type ShapeTransport, type StorageLike, type ControllerOptions,
} from '../lib/shape-sync/controller.ts';
import type { DrawLike } from '../lib/shape-sync/draw-adapter.ts';

/** Enumerable like real localStorage (length/key), with per-key / per-prefix failure injection. */
export class MemoryStorage implements StorageLike {
  rows = new Map<string, string>();
  /** Keys whose setItem throws (quota / private mode). */
  failing = new Set<string>();
  /** Key prefixes whose setItem throws. */
  failPrefixes: string[] = [];
  /** Key prefixes whose removeItem silently does nothing (a failed ack). */
  stickyPrefixes: string[] = [];
  failAll = false;
  get length(): number { return this.rows.size; }
  key(i: number): string | null { return [...this.rows.keys()][i] ?? null; }
  getItem(key: string): string | null { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.failAll || this.failing.has(key) || this.failPrefixes.some((p) => key.startsWith(p))) throw new Error('QuotaExceededError');
    this.rows.set(key, String(value));
  }
  removeItem(key: string): void { if (!this.stickyPrefixes.some((p) => key.startsWith(p))) this.rows.delete(key); }
  holds(marker: string): boolean { return [...this.rows.values()].some((v) => v.includes(marker)); }
  snapshot(): string { return JSON.stringify([...this.rows.entries()].sort()); }
}

export interface Receipt { attempt: number; committed: boolean; seq: number | null }

export class FakeShapeServer {
  doc: Record<string, unknown> | null = null;
  /** The v1 island (`data/shapes`), for drain tests: { shapesJson, version } or null. */
  island: { shapesJson: unknown; version: number } | null = null;
  version = 0;
  receipts: Receipt[] = [];
  offline = false;
  /** Commit the next transaction, then throw as if the response was lost. */
  loseNextResponse = false;
  /** Runs after a step read the document and before its commit — lets a test interleave. */
  beforeCommit: (() => Promise<void> | void) | null = null;
  /** Runs at transaction start, BEFORE the step reads anything — i.e. after the caller snapshotted. */
  beforeRead: (() => Promise<void> | void) | null = null;

  /** `gate` lets one device be offline while others are not. */
  transport(gate: { offline: boolean } = { offline: false }): ShapeTransport {
    return {
      transact: async <R>(step: (current: unknown, island?: { exists: boolean; shapesJson: unknown; version: number }) => { write: unknown; result: R; deleteIsland?: boolean }, opts?: { island?: boolean }): Promise<R> => {
        if (this.offline || gate.offline) throw new Error('unavailable: offline');
        const pre = this.beforeRead;
        if (pre) { this.beforeRead = null; await pre(); }
        for (let attempt = 1; attempt <= 5; attempt++) {
          const readVersion = this.version;
          const current = this.doc ? structuredClone(this.doc) : null;
          const island = opts?.island ? (this.island ? { exists: true, ...structuredClone(this.island) } : { exists: false, shapesJson: undefined, version: 0 }) : undefined;
          const { write, result, deleteIsland } = step(current, island);
          const hook = this.beforeCommit;
          if (hook) { this.beforeCommit = null; await hook(); }
          if (this.version !== readVersion) { this.receipts.push({ attempt, committed: false, seq: null }); continue; }
          if (write) {
            this.doc = structuredClone(write) as Record<string, unknown>;
            this.version += 1;
          }
          if (deleteIsland && island?.exists) { this.island = null; this.version += 1; }
          this.receipts.push({ attempt, committed: !!write, seq: write ? (write as { seq: number }).seq : null });
          if (this.loseNextResponse) { this.loseNextResponse = false; throw new Error('deadline-exceeded: response lost'); }
          return result;
        }
        throw new Error('aborted: too much contention');
      },
    };
  }
}

export interface Device {
  controller: ShapeSyncController;
  gate: { offline: boolean };
  storage: MemoryStorage;
  current: { value: boolean };
  views: string[];
  statuses: Array<ReturnType<ShapeSyncController['status']>>;
  options: ControllerOptions;
}

let seed = 0;
export function makeDevice(server: FakeShapeServer | null, opts: { name: string; storage?: MemoryStorage; uid?: string; now?: () => number; gate?: { offline: boolean } } ): Device {
  const storage = opts.storage ?? new MemoryStorage();
  const gate = opts.gate ?? { offline: false };
  const current = { value: true };
  const views: string[] = [];
  const statuses: Device['statuses'] = [];
  let counter = 0;
  const uid = opts.uid ?? 'farmer';
  const options: ControllerOptions = {
    keys: shapeSyncKeys((base) => `${base}::imbewu-owner::uid:${uid}`),
    storage,
    transport: server ? server.transport(gate) : null,
    isCurrent: () => current.value,
    now: opts.now ?? (() => 1_700_000_000_000),
    randomId: () => `${opts.name}${(seed++).toString(36)}x${(counter++).toString(36)}`,
    onView: (reason) => views.push(reason),
    onStatus: (s) => statuses.push(s),
    schedule: () => () => {}, // tests flush explicitly
  };
  const controller = createShapeSyncController(options);
  controller.start();
  return { controller, gate, storage, current, views, statuses, options };
}

/** Re-open a device on the same storage (a reload / crash restart). */
export function reopen(server: FakeShapeServer | null, device: Device, name: string): Device {
  return makeDevice(server, { name, storage: device.storage, gate: device.gate });
}

export function square(id: string, lon: number, lat: number, props: Record<string, unknown> = {}, size = 0.001): Feature {
  return {
    type: 'Feature', id, properties: { featureType: 'site', ...props },
    geometry: { type: 'Polygon', coordinates: [[[lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat]]] },
  } as Feature;
}

export function moved(feature: Feature, dLon: number): Feature {
  const f = structuredClone(feature);
  const poly = f.geometry as { coordinates: number[][][] };
  poly.coordinates = poly.coordinates.map((ring) => ring.map(([x, y]) => [x + dLon, y]));
  return f;
}

export function renamed(feature: Feature, name: string): Feature {
  const f = structuredClone(feature);
  f.properties = { ...(f.properties ?? {}), name };
  return f;
}

export const ids = (fc: FeatureCollection): string[] => fc.features.map((f) => String(f.id)).sort();
export const byId = (fc: FeatureCollection, id: string): Feature | undefined => fc.features.find((f) => String(f.id) === id);

/** A faithful-enough Mapbox Draw store: honours explicit string ids, assigns ids otherwise, emits nothing. */
export class FakeDraw implements DrawLike {
  store = new Map<string, Feature>();
  private n = 0;
  getAll(): FeatureCollection { return { type: 'FeatureCollection', features: [...this.store.values()].map((f) => structuredClone(f)) }; }
  get(id: string): Feature | undefined { const f = this.store.get(id); return f ? structuredClone(f) : undefined; }
  add(geojson: Feature | FeatureCollection): string[] {
    const list = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
    return list.map((f) => {
      const id = f.id != null ? String(f.id) : `draw${this.n++}`;
      this.store.set(id, { ...structuredClone(f), id, properties: structuredClone(f.properties ?? {}) });
      return id;
    });
  }
  delete(idsToDelete: string | string[]): unknown { for (const id of ([] as string[]).concat(idsToDelete)) this.store.delete(id); return this; }
  set(fc: FeatureCollection): unknown { this.store.clear(); this.add(fc); return this; }
  setFeatureProperty(id: string, property: string, value: unknown): unknown {
    const f = this.store.get(id);
    if (!f) throw new TypeError(`no feature ${id}`); // what Draw's store does for a missing id
    f.properties = { ...(f.properties ?? {}), [property]: value };
    return this;
  }
}

/** The uid-scoped key the fakes use, for seeding v1 caches. */
export const farmKeyFor = (uid = 'farmer') => `imbewu_farm_shapes::imbewu-owner::uid:${uid}`;

/** Pending ops of a namespace, read straight from the per-op journal rows, in author order. */
export function journalOps(storage: MemoryStorage, uid = 'farmer'): Array<{ kind: string; source: string; shapeId: string; opId: string; patch?: Record<string, unknown> }> {
  const suffix = `::imbewu-owner::uid:${uid}`;
  return [...storage.rows.entries()]
    .filter(([k]) => k.startsWith('imbewu_shape_op_v2:') && k.endsWith(suffix))
    .map(([, v]) => JSON.parse(v) as { op: { kind: string; source: string; shapeId: string; opId: string; patch?: Record<string, unknown> }; writer: string; wseq: number; lc: number })
    .sort((a, b) => a.lc - b.lc || (a.writer < b.writer ? -1 : a.writer > b.writer ? 1 : a.wseq - b.wseq))
    .map((e) => e.op);
}
export const journalPrefix = 'imbewu_shape_op_v2:';
