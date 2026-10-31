// ISIXHOSA FOR THE INLINE isiZulu BRANCHES.
//
// About 400 places in the app translate inline, isiZulu only: `lang === 'zu' ? isiZulu :
// English`, or a local `ui(english, isiZulu)` helper. Those never went through the locale
// dictionary, so an isiXhosa reader got English there even with lib/locales/xh.ts complete.
//
// The isiXhosa wording for them lives in lib/locales/xh-inline/*.ts, KEYED BY THE EXACT ENGLISH
// the screen shows (the same safety property as lib/records-regional-drafts.ts): edit the English
// and its draft stops matching, so the screen falls back to the new English rather than showing a
// stale translation. The xh locale chunk registers them here when it loads (lib/locales/xh.ts),
// so they arrive lazily with isiXhosa and cost English readers nothing; until then — and on the
// server, where no locale chunk loads — every lookup returns the English.
//
// This module stays free of React and lib/i18n.tsx so plain lib/ modules (report and PDF
// builders) and node tests can use it.
//
// Unreviewed machine drafts (Rory asked for the whole app in isiXhosa, 23 Oct 2026); pages that
// show them carry the shared <LanguageDraftNote>. See docs/translation-reviews/xhosa-ui-2026-10-23/.

// Afrikaans (27 Oct 2026) uses the same English-keyed lookup: its drafts live in
// lib/locales/af-inline/*.ts and the af locale chunk registers them the same way.
export const INLINE_DRAFT_LANGS = ['xh', 'af'] as const;
export type InlineDraftLang = typeof INLINE_DRAFT_LANGS[number];
const INLINE: Partial<Record<InlineDraftLang, Record<string, string>>> = {};

export function isInlineDraftLang(lang: string): lang is InlineDraftLang {
  return (INLINE_DRAFT_LANGS as readonly string[]).includes(lang);
}

/** Called once by a locale chunk (xh, af). */
export function registerInlineDrafts(lang: InlineDraftLang, drafts: Record<string, string>): void {
  INLINE[lang] = drafts;
}

/** Called once by the xh locale chunk. */
export function registerXhInline(drafts: Record<string, string>): void {
  registerInlineDrafts('xh', drafts);
}

export function placeholdersOf(text: string): string {
  return [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort().join(',');
}

/** The draft in this language for this exact English, or null (caller shows English). */
export function inlineDraft(lang: string, english: string): string | null {
  if (!isInlineDraftLang(lang)) return null;
  const draft = INLINE[lang]?.[english];
  if (typeof draft !== 'string' || draft.trim() === '') return null;
  // A draft that lost or invented a {placeholder} would drop a figure — refuse it.
  return placeholdersOf(draft) === placeholdersOf(english) ? draft : null;
}

/** The isiXhosa draft for this exact English, or null (caller shows English). */
export function xhInlineDraft(english: string): string | null {
  return inlineDraft('xh', english);
}

/** isiZulu when the screen had it, an isiXhosa or Afrikaans draft from the shards, otherwise the English. */
export function inlineText(lang: string, english: string, zulu?: string): string {
  if (lang === 'zu' && zulu !== undefined) return zulu;
  if (isInlineDraftLang(lang)) return inlineDraft(lang, english) ?? english;
  return english;
}

/** Substitute {name} placeholders; a name missing from `vars` stays visible on purpose. */
export function fillInline(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/**
 * A sentence with a number or name in it. The lookup key is the English TEMPLATE
 * ('{n} entries'), so the draft is bound to the sentence, not to one value.
 */
export function inlineTemplate(lang: string, englishTemplate: string, zuluTemplate: string | null, vars: Record<string, string | number>): string {
  if (lang === 'zu' && zuluTemplate) return fillInline(zuluTemplate, vars);
  return fillInline(inlineText(lang, englishTemplate), vars);
}
