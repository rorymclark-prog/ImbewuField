import { activeAccountLocalStorageKey } from './account-local-storage';
import { CROPS, hasPlanningYield } from './crop-catalog';
import { buildCropAliasIndex, exactCropKey } from './harvest-reconciliation';
import { PERENNIAL_PRODUCE, PERENNIAL_GROUP_LABEL, PERENNIAL_GROUP_ORDER, perennialKeyForName, type PerennialGroup } from './perennial-produce';

export interface CropEntryOption {
  key: string;
  label: string;
}

const CUSTOM_CROPS_KEY = 'imbewu_custom_crop_names_v1';

// A cover crop with no food harvest does not belong in a produce-sale picker. A null planning
// yield is different: it means the catalog does not yet have a verified kg/m² figure, not that a
// farmer cannot harvest or sell that crop. Keep those edible crops available for factual records.
// The names themselves remain owned by the reviewed crop catalogue.
export const CROP_ENTRY_OPTIONS: CropEntryOption[] = CROPS
  .filter((crop) => crop.yieldKgPerM2 === null || hasPlanningYield(crop))
  .map((crop) => ({ key: crop.key, label: crop.name }));

/**
 * Orchard and food-forest produce, grouped for the picker.
 *
 * A separate list from CROP_ENTRY_OPTIONS, and deliberately not merged into it: an annual crop key
 * is a PLANNABLE thing — the scheduler, the rotation and the yield benchmark all key off it — and a
 * perennial is not. Keeping the two apart is what stops a fruit tree reaching code that assumes a
 * sowing month. See lib/perennial-produce.ts for why that matters.
 */
export interface PerennialEntryGroup {
  group: PerennialGroup;
  label: string;
  options: CropEntryOption[];
}

export const PERENNIAL_ENTRY_OPTIONS: CropEntryOption[] = PERENNIAL_PRODUCE
  .map((produce) => ({ key: produce.key, label: produce.label }));

export const PERENNIAL_ENTRY_GROUPS: PerennialEntryGroup[] = PERENNIAL_GROUP_ORDER
  .map((group) => ({
    group,
    label: PERENNIAL_GROUP_LABEL[group],
    options: PERENNIAL_PRODUCE.filter((p) => p.group === group).map((p) => ({ key: p.key, label: p.label })),
  }))
  .filter((entry) => entry.options.length > 0);

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase('en-ZA').replace(/\s+/g, ' ');
}

function cropAliases(option: CropEntryOption): string[] {
  const aliases = [option.key, option.label];
  const bracketed = option.label.match(/\(([^)]+)\)/)?.[1];
  if (bracketed) aliases.push(...bracketed.split(/[,/]/));
  const beforeBracket = option.label.split('(')[0]?.trim();
  if (beforeBracket) aliases.push(beforeBracket);
  return aliases.map(normalise).filter(Boolean);
}

/**
 * Resolve saved human-readable names back to the catalogue price key.
 *
 * ANNUALS ONLY, on purpose. Callers use the key it returns to look up a researched price and to ask
 * "is this a plannable crop"; a perennial answers no to the second and has no answer to the first.
 * Use produceEntryOption() when you only need to know whether a name is already catalogued at all.
 */
/** Built once — the shared annual alias index, real names plus generated plurals. */
const ANNUAL_ALIASES = buildCropAliasIndex();

export function cropEntryOption(value: string): CropEntryOption | null {
  const needle = normalise(value);
  if (!needle) return null;
  const direct = CROP_ENTRY_OPTIONS.find((option) => cropAliases(option).includes(needle));
  if (direct) return direct;
  // Same second pass as the orchard half below, for the same reason: `cropAliases` is derived from
  // the option's own label and knows nothing about plurals, so "Cabbages" resolved to nothing and
  // became a rival custom crop beside the catalogue's "Cabbage". The shared alias index is the
  // EXACT tier only — never the substring guess — so this can widen the match without ever
  // rewriting a name the catalogue does not genuinely know.
  const key = exactCropKey(value, ANNUAL_ALIASES);
  // Mapped back through CROP_ENTRY_OPTIONS, not CROPS, so the pickers' own rule still decides what
  // counts as produce — a cover crop stays unsellable however the farmer spells it.
  return key ? CROP_ENTRY_OPTIONS.find((option) => option.key === key) ?? null : null;
}

/** The orchard half of the same lookup.
 *
 *  Two passes, and the order matters. `cropAliases` is derived from the option's own label, so it
 *  matches keys and bracketed synonyms but knows nothing about plurals — which meant a farmer
 *  typing "Avocados" fell straight through the duplicate guard that calls this, and ended up with
 *  a custom "Avocados" row beside the catalogue's "Avocado": two rows, two prices, one tree.
 *  `perennialKeyForName` already handles plural forms for the produce catalogue, so the fix is to
 *  fall back to it rather than teach this file a second, drifting copy of the same rules.
 *  Additive on purpose: the exact-alias pass still wins, so nothing that matched before changes. */
export function perennialEntryOption(value: string): CropEntryOption | null {
  const needle = normalise(value);
  if (!needle) return null;
  const direct = PERENNIAL_ENTRY_OPTIONS.find((option) => cropAliases(option).includes(needle));
  if (direct) return direct;
  const key = perennialKeyForName(value);
  return key ? PERENNIAL_ENTRY_OPTIONS.find((option) => option.key === key) ?? null : null;
}

/**
 * Is this name already offered anywhere in the picker?
 *
 * Annuals win a tie: a name that resolves to a plannable crop must keep resolving to it, whatever
 * the orchard list happens to contain.
 */
export function produceEntryOption(value: string): CropEntryOption | null {
  return cropEntryOption(value) ?? perennialEntryOption(value);
}

export function loadCustomCropNames(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(CUSTOM_CROPS_KEY));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const value of parsed) {
      if (typeof value !== 'string') continue;
      const name = value.trim().replace(/\s+/g, ' ');
      const key = normalise(name);
      if (!name || seen.has(key) || produceEntryOption(name)) continue;
      seen.add(key);
      names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}

export function saveCustomCropName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) return null;
  // Already in the picker — annual or orchard — so it must not also become a custom name, or the
  // farmer ends up with two rows for one fruit and a split record.
  const catalogue = produceEntryOption(name);
  if (catalogue) return catalogue.label;
  if (typeof window === 'undefined' || !window.localStorage) return name;
  const names = loadCustomCropNames().filter((row) => normalise(row) !== normalise(name));
  try {
    window.localStorage.setItem(
      activeAccountLocalStorageKey(CUSTOM_CROPS_KEY),
      JSON.stringify([name, ...names].slice(0, 100)),
    );
    return name;
  } catch {
    return null;
  }
}
