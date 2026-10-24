// app/error.tsx, app/not-found.tsx and app/global-error.tsx can render when something ABOVE
// them in the tree has failed — including the root layout that mounts LanguageProvider itself
// (global-error.tsx replaces the whole root layout, so it never has the provider at all) — so
// none of the three can safely call useLanguage()/t(). This reads the farmer's saved language
// choice directly from localStorage, safely, and returns a small fixed English/isiZulu copy
// pair instead (lang-07): never the raw JavaScript error message.

export type ErrorPageLang = 'en' | 'zu' | 'xh';

export function readErrorPageLang(): ErrorPageLang {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem('permamap_lang');
    return saved === 'zu' ? 'zu' : saved === 'xh' ? 'xh' : 'en';
  } catch {
    return 'en';
  }
}

export interface ErrorPageCopy {
  errorTitle: string;
  errorBody: string;
  tryAgain: string;
  notFoundTitle: string;
  notFoundBody: string;
  goHome: string;
  /** Set only for the isiZulu and isiXhosa copy — shown as a small separate line, never folded into errorBody/notFoundBody. */
  zuluDraftNotice?: string;
}

const EN: ErrorPageCopy = {
  errorTitle: 'Something went wrong',
  errorBody: 'This page ran into a problem. Your other reports, photos and places are safe.',
  tryAgain: 'Try again',
  notFoundTitle: 'Page not found',
  notFoundBody: "That page doesn't exist.",
  goHome: 'Go home',
};

// Unreviewed isiZulu draft — a fluent isiZulu speaker and a local farming reviewer have not
// approved it yet, so zuluDraftNotice is shown alongside it (same marking convention as the
// rest of this wave's translations, kept in English here since translating "this is an
// unreviewed draft" into the language under review would defeat the point).
const ZU: ErrorPageCopy = {
  errorTitle: 'Kukhona okungahambi kahle',
  errorBody: 'Leli khasi lihlangabezane nenkinga. Imibiko yakho, izithombe nezindawo zakho zilondolozekile.',
  tryAgain: 'Zama futhi',
  notFoundTitle: 'Ikhasi alitholakali',
  notFoundBody: 'Leli khasi alikho.',
  goHome: 'Goduka',
  zuluDraftNotice: 'Unreviewed isiZulu draft.',
};

// Unreviewed isiXhosa machine draft (23 Oct 2026). Written out here rather than looked up through
// lib/xh-inline: these pages can render without the locale chunk that registers those drafts, so
// an inline lookup would quietly fall back to English exactly when this copy is needed.
const XH: ErrorPageCopy = {
  errorTitle: 'Kukho into engahambanga kakuhle',
  errorBody: 'Eli phepha lihlangabezane nengxaki. Ezinye iingxelo zakho, iifoto neendawo zakho zikhuselekile.',
  tryAgain: 'Zama kwakhona',
  notFoundTitle: 'Iphepha alifumanekanga',
  notFoundBody: 'Elo phepha alikho.',
  goHome: 'Buyela ekhaya',
  zuluDraftNotice: 'Unreviewed isiXhosa draft.',
};

export function errorPageCopy(lang: ErrorPageLang): ErrorPageCopy {
  return lang === 'zu' ? ZU : lang === 'xh' ? XH : EN;
}
