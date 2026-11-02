import { cropByKey } from './crop-catalog';

export interface NurserySpace {
  id: string;
  siteId: string;
  name: string;
  /** Net growing surface allocated to this plan; excludes paths and other work. */
  usableM2: number;
}

export interface NurseryContainer {
  id: string;
  siteId: string;
  name: string;
  cells: number;
  widthCm?: number;
  lengthCm?: number;
  /** Peak simultaneous demand is compared with this stock, not seasonal uses. */
  owned?: number;
}

export interface NurseryProfile {
  id: string;
  siteId: string;
  cropKey: string;
  containerId?: string;
  spaceId?: string;
  /** Measured tray output avoids inventing a per-cell germination model for
   * multi-sown or pricked-out seedlings. Its losses are already in that output. */
  model: 'seed-cell' | 'measured-tray';
  germinationPercent?: number;
  nurserySurvivalPercent?: number;
  usableStartsPerTray?: number;
  seedsPerTray?: number;
  /** Separate from nursery survival: these starts must establish in the field. */
  fieldSurvivalPercent?: number;
  /** Own readiness estimate; it never silently changes the field calendar. */
  nurseryWeeks?: number;
}

export interface NurserySettings {
  version: 1;
  spaces: NurserySpace[];
  containers: NurseryContainer[];
  profiles: NurseryProfile[];
}

const key = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 200;
const name = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.trim().length <= 120;
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const nonnegativeInteger = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const percent = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

/** Unknown physical dimensions and loss rates must survive a save as unknown.
 * Missing resource references also survive: deleting a tray is not evidence
 * that its dependent sowings require no nursery space. */
export function sanitiseNurserySettings(value: unknown): NurserySettings {
  const empty: NurserySettings = { version: 1, spaces: [], containers: [], profiles: [] };
  if (!value || typeof value !== 'object') return empty;
  const raw = value as Partial<NurserySettings>;
  if (raw.version !== 1) return empty;
  const ids = new Set<string>();
  const takeId = (id: string) => { ids.add(id); return id; };
  const spaces = (Array.isArray(raw.spaces) ? raw.spaces : []).flatMap((s): NurserySpace[] => {
    if (!s || !key(s.id) || ids.has(s.id) || !key(s.siteId) || !name(s.name)
      || typeof s.usableM2 !== 'number' || !Number.isFinite(s.usableM2) || s.usableM2 < 0) return [];
    return [{ id: takeId(s.id), siteId: s.siteId, name: s.name.trim(), usableM2: s.usableM2 }];
  });
  ids.clear();
  const containers = (Array.isArray(raw.containers) ? raw.containers : []).flatMap((c): NurseryContainer[] => {
    if (!c || !key(c.id) || ids.has(c.id) || !key(c.siteId) || !name(c.name)
      || !Number.isSafeInteger(c.cells) || c.cells <= 0
      || (c.widthCm !== undefined && !positive(c.widthCm))
      || (c.lengthCm !== undefined && !positive(c.lengthCm))
      || (c.owned !== undefined && !nonnegativeInteger(c.owned))) return [];
    if (c.widthCm !== undefined && c.lengthCm !== undefined
      && !positive(c.widthCm * c.lengthCm / 10_000)) return [];
    return [{ id: takeId(c.id), siteId: c.siteId, name: c.name.trim(), cells: c.cells,
      ...(c.widthCm !== undefined ? { widthCm: c.widthCm } : {}),
      ...(c.lengthCm !== undefined ? { lengthCm: c.lengthCm } : {}),
      ...(c.owned !== undefined ? { owned: c.owned } : {}),
    }];
  });
  ids.clear();
  const crops = new Set<string>();
  const profiles = (Array.isArray(raw.profiles) ? raw.profiles : []).flatMap((p): NurseryProfile[] => {
    if (!p || !key(p.id) || ids.has(p.id) || !key(p.siteId) || !key(p.cropKey)
      || !cropByKey(p.cropKey)?.transplant || crops.has(`${p.siteId}\0${p.cropKey}`)
      || !['seed-cell', 'measured-tray'].includes(p.model)
      || (p.containerId !== undefined && !key(p.containerId))
      || (p.spaceId !== undefined && !key(p.spaceId))
      || (p.fieldSurvivalPercent !== undefined && !percent(p.fieldSurvivalPercent))
      || (p.nurseryWeeks !== undefined && (!positive(p.nurseryWeeks) || p.nurseryWeeks > 52))) return [];
    if (p.model === 'seed-cell' && (
      (p.germinationPercent !== undefined && !percent(p.germinationPercent))
      || (p.nurserySurvivalPercent !== undefined && !percent(p.nurserySurvivalPercent)))) return [];
    if (p.model === 'measured-tray' && (
      (p.usableStartsPerTray !== undefined && !positive(p.usableStartsPerTray))
      || (p.seedsPerTray !== undefined && !nonnegativeInteger(p.seedsPerTray)))) return [];
    crops.add(`${p.siteId}\0${p.cropKey}`);
    return [{ id: takeId(p.id), siteId: p.siteId, cropKey: p.cropKey, model: p.model,
      ...(p.containerId !== undefined ? { containerId: p.containerId } : {}),
      ...(p.spaceId !== undefined ? { spaceId: p.spaceId } : {}),
      ...(p.fieldSurvivalPercent !== undefined ? { fieldSurvivalPercent: p.fieldSurvivalPercent } : {}),
      ...(p.nurseryWeeks !== undefined ? { nurseryWeeks: p.nurseryWeeks } : {}),
      ...(p.model === 'seed-cell' ? {
        ...(p.germinationPercent !== undefined ? { germinationPercent: p.germinationPercent } : {}),
        ...(p.nurserySurvivalPercent !== undefined ? { nurserySurvivalPercent: p.nurserySurvivalPercent } : {}),
      } : {
        ...(p.usableStartsPerTray !== undefined ? { usableStartsPerTray: p.usableStartsPerTray } : {}),
        ...(p.seedsPerTray !== undefined ? { seedsPerTray: p.seedsPerTray } : {}),
      }),
    }];
  });
  return { version: 1, spaces, containers, profiles };
}
