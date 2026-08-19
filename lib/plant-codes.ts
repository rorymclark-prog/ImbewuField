/**
 * A short code on every plant, keyed in the legend.
 *
 * WHY THIS EXISTS. On-map callouts group by kind and carry a count — "PAWPAW TREE ×4" with one
 * leader running to one of the four. Every plant is therefore ACCOUNTED for, but only one of them
 * is IDENTIFIED: stand in front of the third pawpaw on the sheet and nothing on the page tells you
 * what it is. Rory: "some plants/trees still don't have labels!"
 *
 * The obvious fix — a leader pill per plant — is the one this sheet already rejected once. The
 * Ubhejane demo alone would carry roughly thirty pills, which is exactly the unreadable sheet the
 * twelve-leader budget in producer-labels.ts exists to prevent.
 *
 * So: the convention published planting plans actually use. Each plant carries a two-letter code,
 * and the legend row that already names the species carries the same code. Every plant is
 * identifiable, the leader budget is untouched, and no new panel competes for space — the legend
 * row was already being drawn, it just gains a prefix.
 *
 * THE INVARIANT THIS MUST NOT BREAK: nothing is drawn on a sheet without a legend row to explain
 * it. A code is therefore only ever drawn where the legend names species INDIVIDUALLY. On the
 * masterplan the legend groups species into families ("Fruit & nut trees"), so a code there would
 * be a mark with nothing to look it up in — see sheetElementNaming and plantCodesForSheet.
 *
 * CODES ARE NOT DATA. Nothing is stored on the design, nothing is counted or billed by them, and a
 * code never travels outside the sheet it was drawn on. They are assigned per sheet, from what is
 * on that sheet, so they cannot go stale.
 */

import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { plantingLegendSectionForFeature } from '@/lib/planting-cartography';

/**
 * HOW A SHEET NAMES ITS PLANTS. One or the other, never both.
 *
 * Running codes AND named callouts together was the first version, and one render of the real
 * Ubhejane farm settled it — a BA chip landed inside the "BANANA CLUMP ×5" pill, spelling
 * "B(IT)ANA CLUMP", and an LC chip sat in the middle of "MACADAMIA TREE". Rory: "i think the
 * labels have to be one or the other". He is right, and not only because of collisions: they are
 * two answers to the same question, and a sheet that gives both answers at once is asking the
 * reader to work out which one to trust.
 *
 * 'codes'  — a two-letter mark on EVERY plant, looked up in the legend. Every plant identified;
 *            the map stays quiet enough to read the design through. What a published planting
 *            plan does, and the only mode that can name the third pawpaw.
 * 'names'  — the plant's name in words, ranged down the label gutter beside the map on a leader.
 *            Nothing is written on the drawing at all; long names get room. Beds, rows and strips
 *            are grouped with a count, so a big garden is one row and not thirty.
 * 'onplant' — the plant's name in words, printed just under the plant itself. Rory: "can we have a
 *            third one, names just under plant or on tree/plant?" No lookup and no leader to
 *            follow — the answer is where the question is. It costs the most ink on the drawing and
 *            it is the mode that runs out of room first, so a name that will not fit beside its own
 *            plant is dropped rather than shrunk past reading (the legend still lists it).
 *
 * The choice is genuine — none is right in general, which is why this is a control and not a
 * constant. Codes lead because they are the mode that answers the complaint that produced them.
 */
export type SheetLabelMode = 'codes' | 'names' | 'onplant';

export const DEFAULT_SHEET_LABEL_MODE: SheetLabelMode = 'codes';

/** What to append to a sheet's cache key. Empty on the default, so every sheet already in a
 *  farmer's gallery stays addressable under the key it was stored with. */
export function labelModeCacheSuffix(mode: SheetLabelMode): string {
  return mode === DEFAULT_SHEET_LABEL_MODE ? '' : `:${mode}`;
}

/** Whether this mode writes the plant's identity ON the drawing. Both marking modes therefore
 *  withhold those plants from the gutter — one answer per plant is the rule the label control was
 *  created to enforce, and it has to hold for the third mode too. */
export function marksPlantsOnMap(mode: SheetLabelMode): boolean {
  return mode !== 'names';
}

/**
 * Codes for the catalog, chosen to be readable as abbreviations of their own names rather than
 * derived — MG is a mango to anyone holding the sheet, whereas a generated code is a lookup every
 * single time. Derivation is the fallback for a plant the catalog does not know, not the rule.
 *
 * Kept apart from lib/design-elements.ts on purpose: this is presentation for one family of sheets,
 * and the catalog is the farm's vocabulary. A code changing must never be able to touch saved data.
 */
export const PLANT_CODES: Readonly<Record<string, string>> = {
  // Fruit and nut trees
  tree_mango: 'MG',
  tree_avocado: 'AV',
  tree_citrus: 'CT',
  tree_orange: 'OR',
  tree_lemon: 'LM',
  tree_grapefruit: 'GF',
  tree_pawpaw: 'PW',
  tree_moringa: 'MO',
  tree_macadamia: 'MC',
  tree_litchi: 'LC',
  tree_guava: 'GU',
  tree_apple: 'AP',
  tree_pear: 'PE',
  tree_plum: 'PL',
  tree_peach: 'PH',
  tree_fig: 'FG',
  tree_pomegranate: 'PG',
  tree_olive: 'OV',
  // Indigenous and other
  tree_natal_plum: 'NP',
  tree_wild_plum: 'WP',
  tree_waterberry: 'WB',
  tree_marula: 'MR',
  tree_kei_apple: 'KA',
  tree_indigenous: 'IT',
  tree_other: 'TR',
  // Bananas
  banana_clump: 'BA',
  banana_circle: 'BC',
  // Beds and ground planting
  veg_bed: 'VB',
  raised_bed: 'RB',
  keyhole_bed: 'KB',
  herb_spiral: 'HS',
  pollinator_strip: 'PS',
  other_planting: 'OP',
  // Hedges, banks and basins
  vetiver_row: 'VR',
  mulch_bank: 'MK',
  spekboom_hedge: 'SP',
  tree_basin: 'TB',
};

/** Only planting carries codes: the legend sections they key into are the planting ones. */
export function plantTakesCode(defId: string): boolean {
  return plantingLegendSectionForFeature(defId) !== null;
}

/** Two letters from a name, for a plant the catalog does not know — initials of the first two
 *  words where there are two ("Wild Fig" -> WF), otherwise the first two letters. */
function derivedCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length >= 2
    ? `${words[0][0] ?? ''}${words[1][0] ?? ''}`
    : (words[0] ?? '').slice(0, 2);
  const code = letters.toUpperCase().replace(/[^A-Z]/g, '');
  return code.length === 2 ? code : (code + 'XX').slice(0, 2);
}

/**
 * The code for every planting id present, guaranteed unique within this sheet.
 *
 * UNIQUENESS IS PER SHEET, NOT GLOBAL, and that is the whole point. A code is a lookup key into
 * THIS legend; two plants sharing one would make the legend ambiguous, which is worse than no code
 * at all. Collisions are broken with a digit rather than by inventing a second letter pairing,
 * because a farmer comparing "MG" with "MG2" can see they are meant to be different things,
 * whereas "MG" against "MA" reads as two unrelated codes.
 *
 * Ids are processed in a stable sorted order so the same design always produces the same codes,
 * however the items happen to be ordered in state.
 */
export function plantCodesForSheet(defIds: Iterable<string>): Map<string, string> {
  const codes = new Map<string, string>();
  const taken = new Set<string>();
  const ids = [...new Set(defIds)].filter(plantTakesCode).sort();
  for (const id of ids) {
    const preferred = PLANT_CODES[id] ?? derivedCode(ELEMENTS_BY_ID[id]?.name ?? id);
    let code = preferred;
    for (let suffix = 2; taken.has(code) && suffix < 10; suffix++) code = `${preferred}${suffix}`;
    if (taken.has(code)) continue; // ten plants colliding on one code: draw none rather than a lie
    taken.add(code);
    codes.set(id, code);
  }
  return codes;
}

/** The legend row's text, with its code in front — "MG · Mango Tree ×4". */
export function codedLegendText(code: string | undefined, text: string): string {
  return code ? `${code} · ${text}` : text;
}
