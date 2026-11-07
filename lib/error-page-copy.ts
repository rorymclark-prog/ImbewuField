// app/error.tsx, app/not-found.tsx and app/global-error.tsx can render when something ABOVE
// them in the tree has failed — including the root layout that mounts LanguageProvider itself
// (global-error.tsx replaces the whole root layout, so it never has the provider at all) — so
// none of the three can safely call useLanguage()/t(). This reads the farmer's saved language
// choice directly from localStorage, safely, and returns a small fixed English/isiZulu copy
// pair instead (lang-07): never the raw JavaScript error message.

export type ErrorPageLang = 'en' | 'zu' | 'xh' | 'af';

export function readErrorPageLang(): ErrorPageLang {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem('permamap_lang');
    return saved === 'zu' ? 'zu' : saved === 'xh' ? 'xh' : saved === 'af' ? 'af' : 'en';
  } catch {
    return 'en';
  }
}

export interface ErrorPageCopy {
  errorTitle: string;
  errorBody: string;
  tryAgain: string;
  /** Shown instead of errorTitle/errorBody when the failure is a missing chunk or the phone is offline. */
  offlineTitle: string;
  offlineBody: string;
  /** Link to /offline ("Saved on this device"). */
  offlineSaved: string;
  notFoundTitle: string;
  notFoundBody: string;
  goHome: string;
  /** Set only for the isiZulu, isiXhosa and Afrikaans copy — shown as a small separate line, never folded into errorBody/notFoundBody. */
  zuluDraftNotice?: string;
}

const EN: ErrorPageCopy = {
  errorTitle: 'Something went wrong',
  errorBody: 'This page ran into a problem. Your other reports, photos and places are safe.',
  tryAgain: 'Try again',
  offlineTitle: "You're offline",
  offlineBody: "This screen isn't saved on your phone yet. Screens you opened before still work. Open one of those, or try again when you have signal.",
  offlineSaved: 'Saved on this device',
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
  offlineTitle: 'Awuxhumekile ku-inthanethi',
  offlineBody: 'Leli khasi alikalondolozwa efonini yakho. Amakhasi owavule ngaphambilini asasebenza. Vula elinye lawo, noma uzame futhi uma unesignali.',
  offlineSaved: 'Okulondoloziwe kule foni',
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
  offlineTitle: 'Awukho kwi-intanethi',
  offlineBody: 'Esi sikrini asikagcinwa kwifowuni yakho. Izikrini owazivula ngaphambili zisasebenza. Vula esinye sazo, okanye uzame kwakhona xa unesiginali.',
  offlineSaved: 'Kugcinwe kwesi sixhobo',
  zuluDraftNotice: 'Unreviewed isiXhosa draft.',
};

// Unreviewed Afrikaans machine draft (31 Oct 2026), written out for the same reason as isiXhosa.
const AF: ErrorPageCopy = {
  errorTitle: 'Iets het skeefgeloop',
  errorBody: "Hierdie bladsy het 'n probleem ondervind. Jou ander verslae, foto's en plekke is veilig.",
  tryAgain: 'Probeer weer',
  notFoundTitle: 'Bladsy nie gevind nie',
  notFoundBody: 'Daardie bladsy bestaan nie.',
  goHome: 'Gaan na die tuisblad',
  offlineTitle: 'Jy is vanlyn',
  offlineBody: 'Hierdie skerm is nog nie op jou foon gestoor nie. Skerms wat jy voorheen oopgemaak het, werk steeds. Maak een daarvan oop, of probeer weer wanneer jy sein het.',
  offlineSaved: 'Op hierdie toestel gestoor',
  zuluDraftNotice: 'Unreviewed Afrikaans draft.',
};

// A chunk that will not load is the app saying "this screen's code was never saved on this phone",
// not a bug in the screen — and on a farm with no signal the generic "Try again" just fails again.
// Matches webpack's ChunkLoadError / "Loading chunk N failed" / "Loading CSS chunk N failed" and the
// browser's dynamic-import failure text (Chrome, Firefox, Safari wordings).
const CHUNK_FAILURE = /Loading (?:CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function isOfflineError(error: { name?: string; message?: string } | null | undefined): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return error?.name === 'ChunkLoadError' || CHUNK_FAILURE.test(error?.message ?? '');
}

export function errorPageCopy(lang: ErrorPageLang): ErrorPageCopy {
  return lang === 'zu' ? ZU : lang === 'xh' ? XH : lang === 'af' ? AF : EN;
}
