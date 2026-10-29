import { isJournalDate, sortJournal, type JournalCategory, type JournalEntry } from './field-journal';

export interface JournalViewFilters {
  query?: string;
  category?: JournalCategory | 'all';
  from?: string;
  to?: string;
  /** Opaque value from journalFilterOptions; the recorded bed identity survives renaming. */
  bed?: string;
  crop?: string;
}

export interface JournalFilterOption { value: string; label: string }

function searchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
}

function bedValue(entry: JournalEntry): string | null {
  if (entry.bedId) return `id:${entry.bedId}`;
  if (entry.bedLabel) return `label:${entry.bedLabel}`;
  return null;
}

/** Options come from the notes themselves, including beds since removed from the design.
 * Two different beds called "Bed 1" must never be silently combined into one history. */
export function journalFilterOptions(entries: JournalEntry[]): { beds: JournalFilterOption[]; crops: string[] } {
  const beds = new Map<string, string[]>();
  const crops = new Set<string>();
  for (const entry of sortJournal(entries)) {
    const value = bedValue(entry);
    if (value) {
      const labels = beds.get(value) ?? [];
      if (entry.bedLabel && !labels.includes(entry.bedLabel)) labels.push(entry.bedLabel);
      beds.set(value, labels);
    }
    if (entry.cropName) crops.add(entry.cropName);
  }
  const options = [...beds].map(([value, labels]) => ({
    value,
    label: labels.length ? labels.join(' / ') : 'Unnamed bed',
  }));
  // Keep identical display names distinguishable without presenting a saved label as a new name.
  const counts = new Map<string, number>();
  for (const option of options) counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const option of options) {
    if ((counts.get(option.label) ?? 0) < 2) continue;
    const label = option.label;
    const index = (seen.get(label) ?? 0) + 1;
    seen.set(label, index);
    option.label = `${label} (recorded group ${index})`;
  }
  return {
    beds: options.sort((a, b) => a.label.localeCompare(b.label)),
    crops: [...crops].sort((a, b) => a.localeCompare(b)),
  };
}

export function journalDateRangeError(filters: JournalViewFilters): string | null {
  if (filters.from && !isJournalDate(filters.from)) return 'Choose a valid start date.';
  if (filters.to && !isJournalDate(filters.to)) return 'Choose a valid end date.';
  if (filters.from && filters.to && filters.from > filters.to) return 'The start date must be on or before the end date.';
  return null;
}

/** All filters intersect. Calendar strings stay date-only, so DST and timezone cannot move
 * an observation outside the farmer's chosen inclusive date range. */
export function filterJournalEntries(entries: JournalEntry[], filters: JournalViewFilters = {}): JournalEntry[] {
  if (journalDateRangeError(filters)) return [];
  const words = searchText(filters.query ?? '').split(' ').filter(Boolean);
  return sortJournal(entries.filter(entry => {
    if (!isJournalDate(entry.date)) return false;
    if (filters.category && filters.category !== 'all' && entry.category !== filters.category) return false;
    if (filters.from && entry.date < filters.from || filters.to && entry.date > filters.to) return false;
    if (filters.bed && bedValue(entry) !== filters.bed) return false;
    if (filters.crop && entry.cropName !== filters.crop) return false;
    if (!words.length) return true;
    const text = searchText([entry.title, entry.notes, entry.bedLabel, entry.cropName].filter(Boolean).join(' '));
    return words.every(word => text.includes(word));
  }));
}
