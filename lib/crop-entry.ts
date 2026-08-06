import { activeAccountLocalStorageKey } from './account-local-storage';
import { CROPS } from './crop-catalog';

export interface CropEntryOption {
  key: string;
  label: string;
}

const CUSTOM_CROPS_KEY = 'imbewu_custom_crop_names_v1';

// A cover crop with no food harvest does not belong in a produce-sale picker.
// The names themselves remain owned by the reviewed crop catalogue.
export const CROP_ENTRY_OPTIONS: CropEntryOption[] = CROPS
  .filter((crop) => crop.yieldKgPerM2 > 0)
  .map((crop) => ({ key: crop.key, label: crop.name }));

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

/** Resolve saved human-readable names back to the catalogue price key. */
export function cropEntryOption(value: string): CropEntryOption | null {
  const needle = normalise(value);
  if (!needle) return null;
  return CROP_ENTRY_OPTIONS.find((option) => cropAliases(option).includes(needle)) ?? null;
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
      if (!name || seen.has(key) || cropEntryOption(name)) continue;
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
  const catalogue = cropEntryOption(name);
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
