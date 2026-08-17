/**
 * Identify which plan-set sheet a durable gallery label belongs to.
 *
 * Saved sheets predate explicit sheet metadata, so their canonical label is the only identity
 * shared by old and new rows. Keep that compatibility rule here rather than scattering string
 * checks through Preview & Export. New saves should continue using one of these canonical names.
 */
export function savedMapSheetNo(label: string): string | null {
  const normalised = label.trim().toLocaleLowerCase('en');

  if (/^(existing site|site map|what's here now)\b/.test(normalised)) return '01';
  if (/^(sector|sun & wind)\b/.test(normalised)) return '02';
  if (/^zones?\b/.test(normalised)) return '03';
  if (/^water\b/.test(normalised)) return '04';
  if (/^earthworks?\b/.test(normalised)) return '05';
  if (/^planting\b/.test(normalised)) return '06';
  if (/^structures?\b/.test(normalised)) return '07';
  if (/^(whole design|full design|final integrated)\b/.test(normalised)) return '08';
  if (/^(implementation|phasing)\b/.test(normalised)) return '09';

  return null;
}

/** Gallery rows arrive oldest-first. Walking backwards returns the latest matching sheet. */
export function newestSavedMapForSheet<T extends { label: string }>(
  items: readonly T[],
  sheetNo: string,
): T | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item && savedMapSheetNo(item.label) === sheetNo) return item;
  }
  return null;
}
