import { cropByKey } from './crop-catalog';
import { decimalQuantityProduct } from './farm-records';

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
  /** Optional for measured-output flats; missing is not a fabricated cell count. */
  cells?: number;
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

export type NurseryHeldValue = null | string | number | boolean | NurseryHeldValue[] | { [key: string]: NurseryHeldValue };
export interface NurseryHeldInputGroup {
  collection: 'spaces' | 'containers' | 'profiles' | 'unknown';
  reason: 'ambiguous-identities' | 'unreadable-input';
  /** Preservation only; these rows never contribute capacity or recipe inputs. */
  rows: NurseryHeldValue[];
}

export interface NurserySettings {
  version: 1;
  spaces: NurserySpace[];
  containers: NurseryContainer[];
  profiles: NurseryProfile[];
  /** Ambiguous raw identities stay held across canonical save/reload. */
  sourceIssues?: string[];
  /** Original conflicting claims remain in this same account-scoped book. */
  heldInputs?: NurseryHeldInputGroup[];
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
  const unreadable = (): NurseryHeldValue => ({ kind: 'unreadable-nursery-input', version: 1 });
  const version = Object.getOwnPropertyDescriptor(raw, 'version');
  if (version && !('value' in version)) return { ...empty, sourceIssues: ['nursery-held-input-unreadable', 'nursery-held-inputs-unresolved'],
    heldInputs: [{ collection: 'unknown', reason: 'unreadable-input', rows: [unreadable()] }] };
  if (!version || version.value !== 1) return empty;
  const issues = new Set<string>();
  const heldInputs: NurseryHeldInputGroup[] = [];
  // JSON would execute accessors or discard functions/undefined claims. Held
  // evidence must instead be detached without invoking them or losing its hold.
  const copyHeld = (input: unknown, parents = new Set<object>(), omitUndefinedProperties = false): NurseryHeldValue => {
    if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (!input || typeof input !== 'object' || parents.has(input)) throw Error('Unreadable nursery claim');
    const prototype = Object.getPrototypeOf(input);
    if (!Array.isArray(input) && prototype !== Object.prototype && prototype !== null) throw Error('Unreadable nursery claim');
    parents.add(input);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(input);
      if (Array.isArray(input)) {
        if (Reflect.ownKeys(descriptors).some(key => key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)))
          || Object.keys(descriptors).filter(key => key !== 'length').length !== input.length) throw Error('Unreadable nursery claim');
        return Array.from({ length: input.length }, (_, index) => {
          const property = descriptors[index];
          if (!property || !('value' in property)) throw Error('Unreadable nursery claim');
          return copyHeld(property.value, parents, omitUndefinedProperties);
        });
      }
      const output: { [key: string]: NurseryHeldValue } = {};
      for (const key of Reflect.ownKeys(descriptors)) {
        const property = typeof key === 'string' ? descriptors[key] : null;
        if (typeof key !== 'string' || !property || !('value' in property)) throw Error('Unreadable nursery claim');
        if (omitUndefinedProperties && property.value === undefined) continue;
        Object.defineProperty(output, key, { value: copyHeld(property.value, parents, omitUndefinedProperties), enumerable: true, writable: true, configurable: true });
      }
      return output;
    } finally { parents.delete(input); }
  };
  const preserveRow = (row: unknown): NurseryHeldValue => {
    try { return copyHeld(row); }
    catch { issues.add('nursery-held-input-unreadable'); return unreadable(); }
  };
  const appendHeld = (group: NurseryHeldInputGroup) => {
    const serialized = JSON.stringify(group);
    if (!heldInputs.some(previous => JSON.stringify(previous) === serialized)) heldInputs.push(group);
  };
  const arrayValues = (input: unknown): unknown[] | null => {
    if (!Array.isArray(input)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(descriptors).some(key => key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)))
      || Object.keys(descriptors).filter(key => key !== 'length').length !== input.length) return null;
    const values: unknown[] = [];
    for (let index = 0; index < input.length; index++) {
      const descriptor = descriptors[index];
      values.push(descriptor && 'value' in descriptor ? descriptor.value : Symbol('unreadable-nursery-array-entry'));
    }
    return values;
  };
  const previousHeld = Object.getOwnPropertyDescriptor(raw, 'heldInputs');
  if (previousHeld && (!('value' in previousHeld) || previousHeld.value !== undefined)) {
    const previousGroups = 'value' in previousHeld ? arrayValues(previousHeld.value) : null;
    if (!previousGroups) {
      issues.add('nursery-held-input-unreadable');
      appendHeld({ collection: 'unknown', reason: 'unreadable-input', rows: ['value' in previousHeld ? preserveRow(previousHeld.value) : unreadable()] });
    } else for (const group of previousGroups) {
      try {
        const descriptors = group && typeof group === 'object' ? Object.getOwnPropertyDescriptors(group) : {};
        const collection = descriptors.collection && 'value' in descriptors.collection ? descriptors.collection.value : null;
        const reason = descriptors.reason && 'value' in descriptors.reason ? descriptors.reason.value : null;
        const rows = descriptors.rows && 'value' in descriptors.rows ? arrayValues(descriptors.rows.value) : null;
        if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !('value' in descriptors[key]))
          || !['spaces', 'containers', 'profiles', 'unknown'].includes(collection) || !['ambiguous-identities', 'unreadable-input'].includes(reason) || !rows) throw Error('Unreadable held inputs');
        appendHeld({ collection, reason, rows: rows.map(preserveRow) });
      } catch {
        issues.add('nursery-held-input-unreadable');
        appendHeld({ collection: 'unknown', reason: 'unreadable-input', rows: [preserveRow(group)] });
      }
    }
  }
  const sourceRows: Record<'spaces' | 'containers' | 'profiles', Array<{ original: unknown; readable: unknown }>> = { spaces: [], containers: [], profiles: [] };
  for (const collection of ['spaces', 'containers', 'profiles'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, collection);
    if (!descriptor || 'value' in descriptor && descriptor.value === undefined) continue;
    const rows = 'value' in descriptor ? arrayValues(descriptor.value) : null;
    if (!rows) {
      issues.add('nursery-held-input-unreadable');
      appendHeld({ collection, reason: 'unreadable-input', rows: ['value' in descriptor ? preserveRow(descriptor.value) : unreadable()] });
      continue;
    }
    for (const row of rows) {
      try {
        // Optional undefined form values mean missing inputs; accessors and
        // executable claims still cannot be read or promoted into capacity.
        sourceRows[collection].push({ original: row, readable: copyHeld(row, new Set<object>(), true) });
      } catch {
        issues.add('nursery-held-input-unreadable');
        appendHeld({ collection, reason: 'unreadable-input', rows: [unreadable()] });
      }
    }
  }
  const rawSpaces = sourceRows.spaces.map(row => row.readable);
  const rawContainers = sourceRows.containers.map(row => row.readable);
  const rawProfiles = sourceRows.profiles.map(row => row.readable);
  const previousIssues = Object.getOwnPropertyDescriptor(raw, 'sourceIssues');
  if (previousIssues && (!('value' in previousIssues) || previousIssues.value !== undefined)) {
    const values = 'value' in previousIssues ? arrayValues(previousIssues.value) : null;
    if (!values || values.some(issue => typeof issue !== 'string' || !issue.trim())) {
      issues.add('nursery-source-issues-unreadable');
      appendHeld({ collection: 'unknown', reason: 'unreadable-input', rows: [unreadable()] });
    } else values.forEach(issue => issues.add(issue as string));
  }
  const duplicates = (rows: unknown, field: (row: Record<string, unknown>) => string | null) => {
    const counts = new Map<string, number>();
    if (Array.isArray(rows)) for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const identity = field(row); if (identity !== null) counts.set(identity, (counts.get(identity) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([identity]) => identity));
  };
  const id = (row: Record<string, unknown>) => key(row.id) ? row.id : null;
  const duplicateSpaces = duplicates(rawSpaces, id), duplicateContainers = duplicates(rawContainers, id), duplicateProfiles = duplicates(rawProfiles, id);
  const duplicateRecipes = duplicates(rawProfiles, row => key(row.siteId) && key(row.cropKey) ? `${row.siteId}\0${row.cropKey}` : null);
  if (duplicateSpaces.size) issues.add('ambiguous-nursery-space-identities');
  if (duplicateContainers.size) issues.add('ambiguous-nursery-container-identities');
  if (duplicateProfiles.size || duplicateRecipes.size) issues.add('ambiguous-nursery-recipe-identities');
  const preserveDuplicates = (collection: 'spaces' | 'containers' | 'profiles', duplicateIds: Set<string>) => {
    const implicated = sourceRows[collection].filter(({ readable }) => {
      const row = readable as Record<string, unknown> | null;
      return row && typeof row === 'object' && (duplicateIds.has(row.id as string)
        || collection === 'profiles' && duplicateRecipes.has(`${row.siteId}\0${row.cropKey}`));
    });
    if (implicated.length) appendHeld({ collection, reason: 'ambiguous-identities', rows: implicated.map(row => preserveRow(row.original)) });
  };
  preserveDuplicates('spaces', duplicateSpaces);
  preserveDuplicates('containers', duplicateContainers);
  preserveDuplicates('profiles', duplicateProfiles);
  if (heldInputs.length) issues.add('nursery-held-inputs-unresolved');
  const ids = new Set<string>();
  const takeId = (id: string) => { ids.add(id); return id; };
  const spaces = (rawSpaces as NurserySpace[]).flatMap((s): NurserySpace[] => {
    if (!s || !key(s.id) || duplicateSpaces.has(s.id) || ids.has(s.id) || !key(s.siteId) || !name(s.name)
      || typeof s.usableM2 !== 'number' || !Number.isFinite(s.usableM2) || s.usableM2 < 0) return [];
    return [{ id: takeId(s.id), siteId: s.siteId, name: s.name.trim(), usableM2: s.usableM2 }];
  });
  ids.clear();
  const containers = (rawContainers as NurseryContainer[]).flatMap((c): NurseryContainer[] => {
    if (!c || !key(c.id) || duplicateContainers.has(c.id) || ids.has(c.id) || !key(c.siteId) || !name(c.name)
      || (c.cells !== undefined && !nonnegativeInteger(c.cells))
      || (c.widthCm !== undefined && !positive(c.widthCm))
      || (c.lengthCm !== undefined && !positive(c.lengthCm))
      || (c.owned !== undefined && !nonnegativeInteger(c.owned))) return [];
    if (c.widthCm !== undefined && c.lengthCm !== undefined
      && !positive(decimalQuantityProduct([c.widthCm, c.lengthCm, 0.0001]))) return [];
    return [{ id: takeId(c.id), siteId: c.siteId, name: c.name.trim(),
      ...(c.cells !== undefined ? { cells: c.cells } : {}),
      ...(c.widthCm !== undefined ? { widthCm: c.widthCm } : {}),
      ...(c.lengthCm !== undefined ? { lengthCm: c.lengthCm } : {}),
      ...(c.owned !== undefined ? { owned: c.owned } : {}),
    }];
  });
  ids.clear();
  const crops = new Set<string>();
  const profiles = (rawProfiles as NurseryProfile[]).flatMap((p): NurseryProfile[] => {
    if (!p || !key(p.id) || duplicateProfiles.has(p.id) || duplicateRecipes.has(`${p.siteId}\0${p.cropKey}`) || ids.has(p.id) || !key(p.siteId) || !key(p.cropKey)
      || !cropByKey(p.cropKey) || crops.has(`${p.siteId}\0${p.cropKey}`)
      || !['seed-cell', 'measured-tray'].includes(p.model)
      || (p.containerId !== undefined && !key(p.containerId))
      || (p.spaceId !== undefined && !key(p.spaceId))
      || (p.fieldSurvivalPercent !== undefined && !percent(p.fieldSurvivalPercent))
      || (p.nurseryWeeks !== undefined && (!positive(p.nurseryWeeks) || p.nurseryWeeks > 52))) return [];
    if (p.model === 'seed-cell' && (
      (p.germinationPercent !== undefined && !percent(p.germinationPercent))
      || (p.nurserySurvivalPercent !== undefined && !percent(p.nurserySurvivalPercent)))) return [];
    if (p.model === 'measured-tray' && (
      (p.usableStartsPerTray !== undefined && (typeof p.usableStartsPerTray !== 'number' || !Number.isFinite(p.usableStartsPerTray) || p.usableStartsPerTray < 0))
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
  return { version: 1, spaces, containers, profiles, ...(issues.size ? { sourceIssues: [...issues] } : {}),
    ...(heldInputs.length ? { heldInputs } : {}) };
}
