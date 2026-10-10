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

import { RECORDS_DRAFTS } from '@/lib/records-regional-drafts-data';
import { recordQuantity, recordUnit, type RecordQuantityRow, type RecordUnit } from '@/lib/farm-records';

export type RecordsDraftLang = 'zu' | 'st' | 've' | 'ts';
export type RecordsRegionalLang = 'st' | 've' | 'ts';

export const RECORDS_REGIONAL_LANGS: readonly RecordsRegionalLang[] = ['st', 've', 'ts'];

export function isRecordsRegionalLang(lang: string): lang is RecordsRegionalLang {
  return (RECORDS_REGIONAL_LANGS as readonly string[]).includes(lang);
}

/** The draft for `english` in `lang`, or null when there is none (the caller shows English). */
export function recordsDraft(lang: string, english: string): string | null {
  if (lang !== 'zu' && !isRecordsRegionalLang(lang)) return null;
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
