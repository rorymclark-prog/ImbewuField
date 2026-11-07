// How the Design Studio PALETTE names an element for a draft-language reader.
//
// The English names in lib/design-elements.ts are data: saved maps, the report builders and the cost lines
// match on them, so they never change. A draft language (lib/xh-inline.ts isInlineDraftLang) reads the
// translated name at RENDER, through the same English-keyed drafts as everything else. English and the
// hand-translated regional languages (isiZulu, Sesotho, Xitsonga, Tshivenda) get the catalogue name untouched.
//
// Crop and species names are never translated: a def with a botanical name, and the growing-category defs
// named after a crop ("Mango Tree", "Spekboom Hedge"), keep their English name. The few growing defs whose
// name is generic, not a species ("Vegetable Bed", "Other Tree"), are listed by id.

import { inlineTemplate, inlineText, isInlineDraftLang } from './xh-inline';

/** Growing-category defs whose name describes a kind of planting, not a crop or species. */
const GENERIC_PLANTING_IDS: ReadonlySet<string> = new Set([
  'veg_bed', 'tree_other', 'tree_indigenous', 'other_planting', 'pollinator_strip',
]);

/** Defs that carry a crop in their name even though they are not in the growing category. */
const CROP_NAMED_IDS: ReadonlySet<string> = new Set(['banana_circle']);

export interface DisplayNamedDef { id: string; name: string; category: string; botanical?: string }

export function designElementDisplayName(def: DisplayNamedDef, lang: string): string {
  if (!isInlineDraftLang(lang)) return def.name;
  if (def.botanical || CROP_NAMED_IDS.has(def.id)) return def.name;
  if (def.category === 'growing' && !GENERIC_PLANTING_IDS.has(def.id)) return def.name;
  return inlineText(lang, def.name);
}

/** A group or layer heading ("Beds & strips"): generic words, so always the draft when there is one. */
export function designGroupDisplayLabel(label: string, lang: string): string {
  return isInlineDraftLang(lang) ? inlineText(lang, label) : label;
}

/** Sample-farm item labels that are generic words and a figure, not a name the farmer typed (lib/demo-farm.ts). */
const GENERIC_ITEM_LABELS: ReadonlySet<string> = new Set(['Rainwater tank (2500 L)', 'Compost bays']);

/**
 * The text drawn on the map for a placed item. A saved item keeps `it.label ?? def.name` everywhere else (print set,
 * AI prompt, saved maps), so only this render-time reading changes: an item with no label of its own, or whose label is
 * just the catalogue name, reads the translated element name; the sample farm's default "Bed 3" and a few generic labels
 * read their draft with the figure kept exactly. Anything the farmer typed, and every species name, is shown as saved.
 */
export function designItemDisplayLabel(item: { label?: string }, def: DisplayNamedDef, lang: string): string {
  if (!isInlineDraftLang(lang)) return item.label ?? def.name;
  const label = item.label;
  if (label === undefined || label === def.name) return designElementDisplayName(def, lang);
  const bed = /^Bed (\d+)$/.exec(label);
  if (bed) return inlineTemplate(lang, 'Bed {n}', null, { n: bed[1] });
  return GENERIC_ITEM_LABELS.has(label) ? inlineText(lang, label) : label;
}
