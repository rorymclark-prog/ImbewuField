// MONTH NAMES FOR THE MONEY BOOK AND THE INVOICE LIST.
//
// Dates and the month labels in the charts used to print English month words whatever language the
// farmer chose. This module is the one place that decides which word. It changes the WORD only:
// the day number, the year, the order (day month year) and every stored date are exactly as before,
// and English (and any language not listed here) gets back exactly what toLocaleDateString('en-ZA')
// printed, so nothing else moves.
//
// isiZulu uses the month names the app already carries (components/ComingUpHarvests.tsx). Sesotho,
// Tshivenda and Xitsonga are UNREVIEWED MACHINE DRAFTS: two independent drafts agreed on every long
// name and a blind reviewer mapped each name back to a month, but no fluent speaker has checked
// them. A wrong month name would mislead, so a language with no name for a month falls back to
// English for that month alone. isiXhosa uses the month names the app already carries for Home and
// the journal (lib/locales/xh.ts homeMonth*), also an unreviewed machine draft. The short forms are 3 to 4 letters and all different, for a chart
// axis; they are not an established abbreviation convention. See
// docs/translation-reviews/records-finance-2026-10-06/README.md (Round 5) for the open questions.
//
// AFRIKAANS (1 Nov 2026) is deliberately NOT in the tables above. Those tables also feed the report
// builders, and an Afrikaans report is still English throughout (tests/report-header-localization.test.ts,
// tests/report-costs-localization.test.ts pin that), so giving them Afrikaans months would print one
// Afrikaans word inside an English report. The money book, the invoice and the money charts opt in
// through the recordsBook* functions at the bottom, which read the standard Afrikaans month names (the
// same ones lib/update-copy-date.ts prints) and are the plain functions for every other language.

export type RecordsMonthLang = 'zu' | 'st' | 've' | 'ts' | 'xh';

const ENGLISH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const LONG: Record<RecordsMonthLang, readonly string[]> = {
  zu: ['Januwari', 'Februwari', 'Mashi', 'Ephreli', 'Meyi', 'Juni', 'Julayi', 'Agasti', 'Septhemba', 'Okthoba', 'Novemba', 'Disemba'],
  st: ['Pherekgong', 'Hlakola', 'Hlakubele', 'Mmesa', 'Motsheanong', 'Phupjane', 'Phupu', 'Phata', 'Leotshe', 'Mphalane', 'Pundungwane', 'Tshitwe'],
  ve: ['Phando', 'Luhuhi', 'Ṱhafamuhwe', 'Lambamai', 'Shundunthule', 'Fulwi', 'Fulwana', 'Ṱhangule', 'Khubvumedzi', 'Tshimedzi', 'Ḽara', 'Nyendavhusiku'],
  ts: ['Sunguti', 'Nyenyenyani', 'Nyenyankulu', 'Dzivamisoko', 'Mudyaxihi', 'Khotavuxika', 'Mawuwani', 'Mhawuri', 'Ndzhati', 'Nhlangula', 'Hukuri', "N'wendzamhala"],
  xh: ['Janyuwari', 'Februwari', 'Matshi', 'Epreli', 'Meyi', 'Juni', 'Julayi', 'Agasti', 'Septemba', 'Okthobha', 'Novemba', 'Disemba'],
};

const SHORT: Record<RecordsMonthLang, readonly string[]> = {
  zu: ['Jan', 'Feb', 'Mas', 'Eph', 'Mey', 'Jun', 'Jul', 'Aga', 'Sep', 'Okt', 'Nov', 'Dis'],
  st: ['Phe', 'Hlk', 'Hlb', 'Mme', 'Mot', 'Php', 'Phu', 'Pha', 'Leo', 'Mph', 'Pun', 'Tsh'],
  ve: ['Phan', 'Luhu', 'Ṱhaf', 'Lamb', 'Shun', 'Fulw', 'Fwan', 'Ṱhan', 'Khub', 'Tshi', 'Ḽara', 'Nyen'],
  ts: ['Sung', 'Nyny', 'Nyku', 'Dziv', 'Mudy', 'Khot', 'Maw', 'Mhaw', 'Ndzh', 'Nhla', 'Huku', "N'we"],
  xh: ['Jan', 'Feb', 'Mat', 'Epr', 'Mey', 'Jun', 'Jul', 'Aga', 'Sep', 'Okt', 'Nov', 'Dis'],
};

function hasMonthNames(lang: string): lang is RecordsMonthLang {
  return lang in LONG;
}

function validMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

/** 'Jan'…'Dec' in English; the short local name for a listed language. `month` is 1-12. */
export function recordsMonthShort(lang: string, month: number): string {
  if (!validMonth(month)) return '';
  const local = hasMonthNames(lang) ? SHORT[lang][month - 1] : undefined;
  return local && local.trim() !== '' ? local : ENGLISH_SHORT[month - 1];
}

/** The full local name for a listed language, else the English short name ('Jan'). `month` is 1-12. */
export function recordsMonthLong(lang: string, month: number): string {
  if (!validMonth(month)) return '';
  const local = hasMonthNames(lang) ? LONG[lang][month - 1] : undefined;
  return local && local.trim() !== '' ? local : ENGLISH_SHORT[month - 1];
}

/**
 * 'Sep 2025' in English (exactly what the chart readout printed); the full local name and the
 * year for a listed language ('Phupu 2025').
 */
export function recordsMonthYear(lang: string, month: number, year: number): string {
  return `${hasMonthNames(lang) ? recordsMonthLong(lang, month) : recordsMonthShort(lang, month)} ${year}`;
}

/**
 * A date the way the ledger rows print it: '5 Jan' or '5 Jan 2026' in English
 * (toLocaleDateString('en-ZA'), unchanged), the same shape with the short local month for a
 * listed language. An unparseable date is handed back as the caller's `raw`.
 */
export function recordsDate(lang: string, date: Date, withYear: boolean): string {
  if (!hasMonthNames(lang) || Number.isNaN(date.getTime())) {
    return withYear
      ? date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
      : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  }
  // en-ZA pads the day to two digits ('05 Jul'); keep those digits so only the word moves.
  const base = `${String(date.getDate()).padStart(2, '0')} ${recordsMonthShort(lang, date.getMonth() + 1)}`;
  return withYear ? `${base} ${date.getFullYear()}` : base;
}


/** Existing diagram month-range parser, shared with report tables so both keep the same months. */
export function recordsMonthRangeIndices(label:string|undefined):number[] {
  const match=/^\s*([A-Za-z]{3})[a-z]*\s*[–—-]\s*([A-Za-z]{3})[a-z]*\s*$/.exec(label??'');
  if(!match)return [];
  const at=(word:string)=>ENGLISH_SHORT.findIndex(month=>month.toLowerCase()===word.toLowerCase());
  const from=at(match[1]),to=at(match[2]);
  if(from<0||to<0)return [];
  const months:number[]=[];
  for(let i=from;months.length<12;i=(i+1)%12){months.push(i);if(i===to)break;}
  return months;
}

/** Unreviewed AI drafts for source season values; calendar month identities never change. */
export const RECORDS_SEASON_COPY:readonly {english:string;zu:string;st:string;ts:string;ve:string}[]=[
  {
    "english": "year-round",
    "zu": "unyaka wonke",
    "st": "selemo kaofela",
    "ts": "lembe hinkwaro",
    "ve": "ṅwaha woṱhe"
  },
  {
    "english": "none",
    "zu": "akukho",
    "st": "ha ho letho",
    "ts": "ku hava",
    "ve": "a hu na tshithu"
  }
];

const XH_SEASON_WORDS:Readonly<Record<string,string>>={"year-round":"unyaka wonke","none":"akukho nanye"};

/** Recognised source seasons only; a farmer's unknown recorded wording is returned verbatim. */
export function recordsSeasonLabel(language:string,value:string):string {
  if(!hasMonthNames(language))return value;
  const named=RECORDS_SEASON_COPY.find(row=>row.english===value);
  // isiXhosa (unreviewed draft) is not in the four-language packet the table mirrors.
  if(named)return language==='xh'?(XH_SEASON_WORDS[named.english]??value):named[language];
  const months=recordsMonthRangeIndices(value);
  return months.length?`${recordsMonthShort(language,months[0]+1)}–${recordsMonthShort(language,months[months.length-1]+1)}`:value;
}

// ── Afrikaans, for the money book only (see the note at the top) ─────────────────────────────
// An unreviewed machine draft like the rest of the Afrikaans app. Short forms are the usual 3 letters.
const AF_LONG = ['Januarie', 'Februarie', 'Maart', 'April', 'Mei', 'Junie', 'Julie', 'Augustus', 'September', 'Oktober', 'November', 'Desember'] as const;
const AF_SHORT = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'] as const;

/** recordsMonthShort for the money book: Afrikaans gets its own months, every other language is recordsMonthShort. */
export function recordsBookMonthShort(lang: string, month: number): string {
  return lang === 'af' && validMonth(month) ? AF_SHORT[month - 1] : recordsMonthShort(lang, month);
}

/** recordsMonthLong for the money book: Afrikaans gets its own months, every other language is recordsMonthLong. */
export function recordsBookMonthLong(lang: string, month: number): string {
  return lang === 'af' && validMonth(month) ? AF_LONG[month - 1] : recordsMonthLong(lang, month);
}

/** recordsMonthYear for the money book ('Oktober 2026' in Afrikaans); every other language is recordsMonthYear. */
export function recordsBookMonthYear(lang: string, month: number, year: number): string {
  return lang === 'af' && validMonth(month) ? `${AF_LONG[month - 1]} ${year}` : recordsMonthYear(lang, month, year);
}

/** recordsDate for the money book ('05 Mrt 2026' in Afrikaans, same shape as the other languages); every other language is recordsDate. */
export function recordsBookDate(lang: string, date: Date, withYear: boolean): string {
  if (lang !== 'af' || Number.isNaN(date.getTime())) return recordsDate(lang, date, withYear);
  const base = `${String(date.getDate()).padStart(2, '0')} ${AF_SHORT[date.getMonth()]}`;
  return withYear ? `${base} ${date.getFullYear()}` : base;
}
