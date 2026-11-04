// ONE ANSWER TO "WHAT DOES THE MONEY BOOK SAY IN THIS LANGUAGE?"
//
// The money book (app/records/page.tsx, components/MyRecords.tsx and the receipt viewer) was
// translated inline, isiZulu only: every label was recordsText(lang, english, isiZulu), so a
// farmer who chose Sesotho, Tshivenda or Xitsonga got the whole book in English — the screen she
// uses to record what she sold and spent — while the menu around it spoke her language.
//
// The drafts here are KEYED BY THE EXACT ENGLISH the screen shows, not by an id. That is the
// whole safety property: English stays the source authority, and the moment anyone rewrites an
// English line the old draft simply stops matching and the screen falls back to the new English.
// A stale translation of a money instruction that no longer says the same thing is worse than
// English, so it must not be able to survive an edit unnoticed.
//
// Existing translated wording always wins. A draft only fills a place where the screen would
// otherwise show English: the isiZulu wording already in the components, and the Sesotho,
// Tshivenda and Xitsonga values already in lib/locales/*, are never replaced from here.
//
// These are unreviewed machine drafts (Rory authorised regional drafts for later facilitator
// review on 6 October 2026). Xitsonga is provisional standard written Xitsonga; nothing here
// claims Shangani comprehension, fluent review, or local farming approval. The screen says so
// (RECORDS_DRAFT_NOTICE below) wherever a draft can appear.

import { kgPreciseLabel } from '@/lib/format-figures';
import { RECORDS_DRAFTS } from '@/lib/records-regional-drafts-data';
import { recordQuantity, recordUnit, type RecordQuantityRow, type RecordUnit } from '@/lib/farm-records';

export type RecordsDraftLang = 'zu' | 'st' | 've' | 'ts';
export type RecordsRegionalLang = 'st' | 've' | 'ts';

export const RECORDS_REGIONAL_LANGS: readonly RecordsRegionalLang[] = ['st', 've', 'ts'];

export function isRecordsRegionalLang(lang: string): lang is RecordsRegionalLang {
  return (RECORDS_REGIONAL_LANGS as readonly string[]).includes(lang);
}

// New financial/source qualifications stay in English until their exact meaning
// has a paired review. This records a hold, not a translation or approval.
export const RECORDS_ENGLISH_HOLDS: Readonly<Record<string, string>> = Object.freeze({
  "Close recorded invoice prices": "Recorded-price controls need paired financial-language review. Retain exact English; historical invoice values are not current price advice or buyer agreement.",
  "Choose a recorded invoice price": "Recorded-price controls need paired financial-language review. Retain exact English; historical invoice values are not current price advice or buyer agreement.",
  "Recorded invoice prices need review. Reopen the current records before choosing a price.": "Recorded-price controls need paired financial-language review. Retain exact English; historical invoice values are not current price advice or buyer agreement.",
  "Prices previously recorded on invoices in {currency} for this exact item and unit. Confirm the price for this sale.": "Recorded-price controls need paired financial-language review. Retain exact English; historical invoice values are not current price advice or buyer agreement.",
  "No matching recorded invoice prices.": "Recorded-price controls need paired financial-language review. Retain exact English; historical invoice values are not current price advice or buyer agreement.",
  "Recorded amount unavailable": "Recorded-price controls need paired financial-language review. Retain exact English; historical invoice values are not current price advice or buyer agreement.",
  "Invoice #{invoice} · {buyer} · {date}": "Recorded-price controls need paired financial-language review. Retain exact English; historical invoice values are not current price advice or buyer agreement.",
  "Use this recorded price": "Recorded-price controls need paired financial-language review. Retain exact English; historical invoice values are not current price advice or buyer agreement.",
  "Orchard is switched off, so {kg} kg is not in the harvest figure: {names}.": "The held-currency version intentionally makes no complete Rand-income claim. Regional paired wording has not been reviewed; retain the exact English.",
  "Orchard is switched off, so {kg} kg is not in Yield logged: {names}.": "The held-currency version intentionally makes no complete cash-margin claim. Regional paired wording has not been reviewed; retain the exact English.",
  "Orchard is switched off, so this card leaves out {picked} picked and {sold} sold: {names}. Only the kilograms here are filtered. Money elsewhere follows the recorded invoice currency review.": "This revised physical-filter explanation follows scoped invoice-currency review. The retired wording made a broader Rand claim; replacement regional drafts require paired review.",
  "Orchard is switched off, so this card leaves out {picked} picked: {names}. Only the kilograms here are filtered. Money elsewhere follows the recorded invoice currency review.": "This revised physical-filter explanation follows scoped invoice-currency review. The retired wording made a broader Rand claim; replacement regional drafts require paired review.",
  "Orchard is switched off, so this card leaves out {sold} sold: {names}. Only the kilograms here are filtered. Money elsewhere follows the recorded invoice currency review.": "This revised physical-filter explanation follows scoped invoice-currency review. The retired wording made a broader Rand claim; replacement regional drafts require paired review.",
  "Readable weighed produce sold": "Loaded-source coverage may be incomplete, so this label deliberately qualifies the physical evidence. Regional wording has not been reviewed; keep the exact English.",
  "Only explicitly assigned entries are included.": "This allocation qualifier limits which growing-area entries contribute to the figure. Regional wording has not been reviewed; retain the exact English rather than implying whole-book coverage.",
  "Download PDF": "The action downloads a file separately from sharing or printing. A regional label for this action has not been reviewed; retain the exact English.",
  "Keep this invoice separate from the rand sale book until its currency can be reconciled.": "This currency hold must not imply conversion or inclusion in Rand cash totals. Regional financial wording has not been reviewed; retain the exact English.",
});

// Historical packets retain the old drafts. Even a regeneration from those
// packets cannot reactivate the former universal Rand claim through this lookup.
export const RECORDS_RETIRED_SOURCES: Readonly<Record<string, string>> = Object.freeze({
  "Orchard is switched off, so this card leaves out {picked} picked and {sold} sold: {names}. The rands elsewhere on this page still count those sales — only the kilograms here are filtered.": "Retired after invoice currency/source holds made the former universal Rand claim invalid. Exact prior drafts and source hashes are preserved in docs/international/invoice-currency-retired-records-drafts.json.",
  "Orchard is switched off, so this card leaves out {picked} picked: {names}. The rands elsewhere on this page still count those sales — only the kilograms here are filtered.": "Retired after invoice currency/source holds made the former universal Rand claim invalid. Exact prior drafts and source hashes are preserved in docs/international/invoice-currency-retired-records-drafts.json.",
  "Orchard is switched off, so this card leaves out {sold} sold: {names}. The rands elsewhere on this page still count those sales — only the kilograms here are filtered.": "Retired after invoice currency/source holds made the former universal Rand claim invalid. Exact prior drafts and source hashes are preserved in docs/international/invoice-currency-retired-records-drafts.json.",
});

export function recordsEnglishHoldReason(lang: string, english: string): string | null {
  return isRecordsRegionalLang(lang) && Object.hasOwn(RECORDS_ENGLISH_HOLDS, english) ? RECORDS_ENGLISH_HOLDS[english] : null;
}

/** The draft for `english` in `lang`, or null when there is none (the caller shows English). */
export function recordsDraft(lang: string, english: string): string | null {
  if (lang !== 'zu' && !isRecordsRegionalLang(lang)) return null;
  if (Object.hasOwn(RECORDS_RETIRED_SOURCES, english) || recordsEnglishHoldReason(lang, english)) return null;
  const row = RECORDS_DRAFTS[english];
  const draft = row?.[lang as RecordsDraftLang];
  return typeof draft === 'string' && draft.trim() !== '' ? draft : null;
}

/**
 * What a label says in `lang`, given what the screen already showed.
 *
 * `existing` is the wording the code produced before this lookup existed — the inline isiZulu,
 * or t(key) from the locale dictionary. If that already differs from the English source it is a
 * translation someone made, and it is returned untouched. Only an English fallback is filled.
 */
export function recordsFill(lang: string, english: string, existing: string = english): string {
  if (existing !== english) return existing;
  return recordsDraft(lang, english) ?? english;
}

/**
 * English first, the draft after it — the pairing the isiZulu money instructions already use
 * ("Keep the English beside isiZulu when a farmer may act on money or saved records"), extended
 * to the regional drafts. With no draft the English stands alone, never paired with itself.
 */
export function recordsPaired(lang: string, english: string, existing?: string): string {
  const local = existing !== undefined && existing !== english ? existing : recordsDraft(lang, english);
  return local && local !== english ? `${english} — ${local}` : english;
}

/** Substitute {name} placeholders. Placeholders absent from `vars` are left visible on purpose. */
export function fillRecordsTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/**
 * A sentence with a number or name inside it. The lookup key is the English TEMPLATE, so a
 * draft is bound to the sentence, not to one amount. A draft that lost or invented a
 * placeholder would print a wrong or missing figure in a money line, so it is refused and the
 * English sentence is shown instead (tests/records-regional-drafts.test.ts pins this).
 */
export function recordsTemplate(lang: string, englishTemplate: string, isiZuluTemplate: string | null, vars: Record<string, string | number>): string {
  const english = fillRecordsTemplate(englishTemplate, vars);
  const localTemplate = lang === 'zu' && isiZuluTemplate ? isiZuluTemplate : recordsDraft(lang, englishTemplate);
  if (!localTemplate || !samePlaceholders(englishTemplate, localTemplate)) return english;
  return fillRecordsTemplate(localTemplate, vars);
}

export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();
}

export function samePlaceholders(a: string, b: string): boolean {
  return placeholdersOf(a).join(',') === placeholdersOf(b).join(',');
}

/** Unit words as the English screen prints them (lib/farm-records.ts recordQuantityLabel). */
export function recordsUnitWord(unit: RecordUnit, lang: string): string {
  const english = unit === 'each' ? 'items' : unit;
  return recordsFill(lang, english);
}

/**
 * recordQuantityLabel, with the unit word in the farmer's language. The number is formatted
 * exactly as before ('en-ZA', the same digits the invoice prints); only the word after it moves.
 * English output is byte-identical to recordQuantityLabel, which the ledger tests rely on.
 */
export function recordsQuantityLabel(row: RecordQuantityRow, lang: string): string {
  const quantity = recordQuantity(row);
  const unit = recordUnit(row);
  if (quantity === null || !unit) return recordsFill(lang, 'Quantity not recorded');
  // w18-39: kilograms use the app's one kg format ('1 203,6 kg'), so a screen never mixes '43.2 kg' with '427,2 kg'.
  if (unit === 'kg') return kgPreciseLabel(quantity);
  return `${quantity.toLocaleString('en-ZA', { maximumSignificantDigits: 21 })} ${recordsUnitWord(unit, lang)}`;
}

const LANGUAGE_NAMES: Record<RecordsRegionalLang, string> = { st: 'Sesotho', ve: 'Tshivenda', ts: 'Xitsonga' };

/** The visible draft notice for the regional languages. English on purpose: it is a status line. */
export function recordsDraftNotice(lang: RecordsRegionalLang): string {
  const provisional = lang === 'ts' ? ' (provisional standard written Xitsonga)' : '';
  return `Unreviewed ${LANGUAGE_NAMES[lang]} machine draft${provisional}. English source is shown beside instructions; text not yet drafted stays in English.`;
}

/**
 * Text for a tooltip or accessible name, where there is no room for a second paragraph.
 * isiZulu keeps its existing pattern (its own wording, then "English source: …"); a regional
 * language shows the English first and the draft after it, and plain English when there is no draft.
 */
export function recordsLabel(lang: string, englishTemplate: string, isiZuluTemplate: string | null, vars: Record<string, string | number> = {}): string {
  const english = fillRecordsTemplate(englishTemplate, vars);
  if (lang === 'zu') {
    return isiZuluTemplate && samePlaceholders(englishTemplate, isiZuluTemplate)
      ? `${fillRecordsTemplate(isiZuluTemplate, vars)} English source: ${english}`
      : english;
  }
  const local = recordsTemplate(lang, englishTemplate, null, vars);
  return local !== english ? `${english} — ${local}` : english;
}
