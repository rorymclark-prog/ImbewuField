// How the Design map reads the sector notes lib/sector.ts writes, for a draft-language reader.
//
// lib/sector.ts builds each note as English prose (some with a figure inside, e.g. "across about 120 m") and its output
// feeds pinned tests and the Glossy renderer, so it never changes. The Design canvas shows the strongest note as a chip
// over the map; a draft language (lib/xh-inline.ts isInlineDraftLang) reads the isiXhosa draft here, at render.
//   - A note with no figure is looked up whole, like every other inline draft.
//   - A note with a figure has a fixed sentence shape and one value slot. Its English TEMPLATE below is the lookup key, the
//     figure is cut out of the English the model wrote and put back into the draft untouched, so no number is ever invented
//     or re-rounded. A note that does not fit a template exactly stays English.
// Every other language gets the note it was given, byte for byte.

import { inlineTemplate, inlineText, isInlineDraftLang } from './xh-inline';

const SECTOR_NOTE_TEMPLATES: ReadonlyArray<{ template: string; slot: string }> = [
  {
    template: 'This site’s own wind data reads {deg}° off the regional pattern — a bimodal wind rose average can land between its two real lobes, not on either one; trust the regional sectors over this site’s single mean.',
    slot: 'deg',
  },
  { template: 'Slope direction is estimated from a site-local SRTM sample across about {m} m — indicative, not surveyed.', slot: 'm' },
  { template: 'Site reads ~flat at this {m} m sampling scale — confirm fall on site.', slot: 'm' },
];

const escapeForRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SHAPES = SECTOR_NOTE_TEMPLATES.map(({ template, slot }) => ({
  template,
  slot,
  // The slot takes a plain number (a rounded bearing, or a metre figure that may carry a decimal point).
  pattern: new RegExp(`^${escapeForRegExp(template).replace(escapeForRegExp(`{${slot}}`), '(\\d+(?:\\.\\d+)?)')}$`),
}));

/** The sector note as the Design canvas shows it: the isiXhosa draft for a draft language, the note itself for every other. */
export function sectorNoteText(lang: string, note: string): string {
  if (!isInlineDraftLang(lang)) return note;
  const whole = inlineText(lang, note);
  if (whole !== note) return whole;
  for (const { template, slot, pattern } of SHAPES) {
    const match = pattern.exec(note);
    if (match) return inlineTemplate(lang, template, null, { [slot]: match[1] });
  }
  return note;
}

/** "Wind confirmed on site: NW (recorded 2/11/2026)" — the farmer's own wind observation, with its direction label and date kept as given. */
export function windConfirmedNoteText(lang: string, from: string, recorded: string | null): string {
  return recorded
    ? inlineTemplate(lang, 'Wind confirmed on site: {from} (recorded {date})', null, { from, date: recorded })
    : inlineTemplate(lang, 'Wind confirmed on site: {from}', null, { from });
}
