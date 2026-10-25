import assert from 'node:assert/strict';
import { cropExportText, isCropExportDraftLanguage } from '../../lib/crop-export-copy.ts';
import type { ExpectedSeason } from '../../lib/production-product-guidance.ts';
import type { PlacedTreeGroup } from '../../lib/perennial-harvest.ts';

/** Season wording is now translated too. Derive it from the immutable source snapshot,
 * retaining its exact decision, month list and citation rather than pinning English metadata. */
export function translatedSeasonExpectation(source: ExpectedSeason | undefined, group: PlacedTreeGroup, language: string): ExpectedSeason | undefined {
  if (!source || !isCropExportDraftLanguage(language)) return source;
  const t = (text: string, values?: Record<string, string | number>) => cropExportText(text, language, values);
  const label = t(source.label) !== source.label ? t(source.label) : source.label.startsWith('Regional reference:')
    ? t('Regional reference: {name}', { name: source.label.slice('Regional reference:'.length).trimStart() }) : source.label;
  assert.notEqual(label, source.label, 'native season labels need their declared source-bound draft');
  const region = group.harvest.windows.map(window => window.region).filter(region => source.basis.startsWith(region + '. ')).sort((a, b) => b.length - a.length)[0];
  assert.ok(region, 'retain the original regional reference identity');
  const caution = 'Planning reference when established; confirm local picking dates. No food quantity or first-year crop promised.';
  const tail = source.basis.slice(region.length + 2);
  assert.ok(tail.endsWith(caution), 'the complete source qualification must be represented');
  const note = tail.slice(0, -caution.length).trim();
  if (note) assert.notEqual(t(note), note, 'the source-specific qualification needs its complete declared draft');
  // Match the immutable original window first; only its display qualifier is native.
  const basis = t('{region}. {note}Planning reference when established; confirm local picking dates. No food quantity or first-year crop promised.', { region: t(region), note: note ? t(note) + ' ' : '' });
  return { ...source, label, basis, calendarLabel: source.label.startsWith('Regional reference:') ? t('Regional season') : label };
}

export function translateExpectedGuideSeason(item: { lines: string[]; expectedSeason?: ExpectedSeason }, group: PlacedTreeGroup, language: string): void {
  const source = item.expectedSeason, native = translatedSeasonExpectation(source, group, language);
  if (!source || !native || source === native) return;
  const at = item.lines.indexOf(`${source.label}. ${source.basis}`);
  assert.ok(at >= 0, 'the original season line must remain in the same guide position');
  item.lines[at] = `${native.label}. ${native.basis}`;
  item.expectedSeason = native;
}
