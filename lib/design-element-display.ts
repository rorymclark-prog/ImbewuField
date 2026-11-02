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

import { inlineText, isInlineDraftLang } from './xh-inline';

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
