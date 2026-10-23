// zu-11 / ux-18 (wave 14): one shared crop-name display helper so a crop is spelled the same way
// everywhere a farmer sees it — MyRecords' recent-harvest rows, the lender summary, the Home task
// board, app/calendar/page.tsx, lib/demo-farm.ts's sample data and the /prices guide. Before this,
// the same crop read 'Sweet Potato' on /calendar, 'Sweet potato' on /home and /prices, and
// all-lowercase 'carrots'/'swiss chard' in Records — three different casings for one crop.
//
// lib/crop-catalog.ts (Codex-owned, read-only here) already has the canonical sentence-case
// English name per catalog key ('Sweet potato', 'Swiss chard (spinach)'); this only adds an
// isiZulu common name on top where one is confidently known, as an unreviewed machine draft like
// every other isiZulu string elsewhere in this codebase.
//
// The isiZulu names live as a plain Record IN THIS FILE rather than as lib/i18n.tsx/
// lib/locales/zu.ts t() keys, deliberately: lib/task-board.ts calls produceLabel() and is
// exercised directly by `node --test` (tests/task-board.test.ts) under a loader with no JSX/TSX
// transform, while lib/i18n.tsx has JSX at its bottom (the LanguageProvider component) and
// crashes that loader on import — the same reason lib/task-board.ts itself takes a plain
// `BoardTranslate` function instead of importing useLanguage(). Keeping this file's only import
// to lib/crop-catalog.ts (a plain object module) keeps it safe to call from anywhere: client
// components, lib/task-board.ts, and node --test alike.
import { cropByKey } from './crop-catalog';
import { inlineText } from './xh-inline';

// catalog key -> isiZulu common name. Confident, widely-used names only; a key with no entry
// here falls back to the English catalog name — correct, if not yet translated — rather than a
// guessed isiZulu word next to a farmer's real harvest records.
const CROP_NAME_ZU: Record<string, string> = {
  maize: 'Ummbila',
  'dry-beans': 'Izindumba ezomile',
  'green-beans': 'Izindumba eziluhlaza',
  pumpkin: 'Ithanga',
  cabbage: 'Iklabishi',
  carrots: 'Amakherothi',
  onions: 'U-anyanisi',
  tomatoes: 'Utamatisi',
  potato: 'Izambane',
  'sweet-potato': 'Ubhatata',
  lettuce: 'Ulethisi',
  garlic: 'Ugaliki',
  peas: 'Amaphizi',
  'swiss-chard': 'Ushevu',
  'true-spinach': 'Isipinashi',
  kale: 'Imifino',
  groundnuts: 'Amakinati',
  watermelon: 'Ikhabe',
  cucumber: 'Ukhukhamba',
  broccoli: 'Ubhrokholi',
  cauliflower: 'Ikholiflawa',
  sorghum: 'Amabele',
  peppers: 'Upelepele',
  chilli: 'Upelepele obabayo',
  soybean: 'Usoya',
  brinjal: 'Ubhinjela',
  spanspek: 'Isipanspeki',
  amaranth: 'Imbuya',
  'african-nightshade': 'Umsobo',
  amadumbe: 'Amadumbe',
};

// A catalog key is already hyphenated sentence case ('sweet-potato') — used only when a key has
// no lib/crop-catalog.ts entry at all (shouldn't normally happen, but a stale or hand-typed key
// must still render as something readable rather than 'undefined').
function sentenceCaseFallback(key: string): string {
  const words = key.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Sentence-case display name for a crop catalog key, with an isiZulu common name when one is
 *  known and lang is 'zu'. Always safe to call with any string — an unknown key degrades to a
 *  readable sentence-cased version of itself rather than throwing. */
export function produceLabel(key: string, lang: string): string {
  const crop = cropByKey(key);
  const english = crop?.name ?? sentenceCaseFallback(key);
  // isiXhosa: the common name from lib/locales/xh-inline/ for this exact catalogue name, else English.
  if (lang === 'xh') return inlineText(lang, english);
  if (lang !== 'zu') return english;
  return CROP_NAME_ZU[key] ?? english;
}
