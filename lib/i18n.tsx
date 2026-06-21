'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const APP_LANGS = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'zu', label: 'isiZulu', native: 'isiZulu' },
  { code: 'xh', label: 'isiXhosa', native: 'isiXhosa' },
  { code: 'af', label: 'Afrikaans', native: 'Afrikaans' },
  { code: 'st', label: 'Sesotho', native: 'Sesotho' },
  { code: 'nso', label: 'Sepedi', native: 'Sepedi' },
  { code: 'tn', label: 'Setswana', native: 'Setswana' },
  { code: 'ts', label: 'Xitsonga', native: 'Xitsonga' },
  { code: 've', label: 'Tshivenda', native: 'Tshivenḓa' },
  { code: 'ss', label: 'siSwati', native: 'siSwati' },
  { code: 'nr', label: 'isiNdebele', native: 'isiNdebele' },
] as const;

type Dict = Record<string, string>;

// Core UI strings translated into the most-spoken SA languages; others fall back to English.
const T: Record<string, Dict> = {
  en: {
    tagline: 'Permaculture Intelligence',
    welcomeTitle: 'Welcome to ImbewuField',
    welcomeSub: 'Smart permaculture planning for South African land.',
    pickLang: 'Choose your language',
    pickLangSub: 'You can change it any time from the top bar.',
    start: 'Start',
    heroSub: 'Tap anywhere in South Africa to get a full permaculture plan for your land.',
    clickAnalyse: 'Tap the map to analyse',
    dataSources: 'Data sources',
    language: 'Language',
  },
  af: {
    tagline: 'Permakultuur-Intelligensie',
    welcomeTitle: 'Welkom by ImbewuField',
    welcomeSub: 'Slim permakultuur-beplanning vir Suid-Afrikaanse grond.',
    pickLang: 'Kies jou taal',
    pickLangSub: 'Jy kan dit enige tyd bo verander.',
    start: 'Begin',
    heroSub: "Tik enige plek in Suid-Afrika om 'n volledige permakultuurplan vir jou grond te kry.",
    clickAnalyse: 'Tik die kaart om te ontleed',
    dataSources: 'Databronne',
    language: 'Taal',
  },
  zu: {
    tagline: 'Ubuhlakani be-Permaculture',
    welcomeTitle: 'Wamukelekile ku-ImbewuField',
    welcomeSub: 'Ukuhlela kwe-permaculture okuhlakaniphile komhlaba waseNingizimu Afrika.',
    pickLang: 'Khetha ulimi lwakho',
    pickLangSub: 'Ungalushintsha noma nini ngenhla.',
    start: 'Qala',
    heroSub: 'Thepha noma kuphi eNingizimu Afrika ukuthola uhlelo olugcwele lomhlaba wakho.',
    clickAnalyse: 'Thepha imephu ukuze uhlaziye',
    dataSources: 'Imithombo yedatha',
    language: 'Ulimi',
  },
  xh: {
    tagline: 'Ubukrelekrele be-Permaculture',
    welcomeTitle: 'Wamkelekile ku-ImbewuField',
    welcomeSub: 'Ucwangciso lwe-permaculture olukrelekrele lomhlaba waseMzantsi Afrika.',
    pickLang: 'Khetha ulwimi lwakho',
    pickLangSub: 'Ungalutshintsha nanini na ngentla.',
    start: 'Qalisa',
    heroSub: 'Cofa naphi na eMzantsi Afrika ufumane isicwangciso esipheleleyo somhlaba wakho.',
    clickAnalyse: 'Cofa imephu ukuze uhlalutye',
    dataSources: 'Imithombo yedatha',
    language: 'Ulwimi',
  },
  st: {
    tagline: 'Bohlale ba Permaculture',
    welcomeTitle: 'O amohelehile ho ImbewuField',
    welcomeSub: 'Moralo o bohlale oa permaculture bakeng sa naha ea Afrika Boroa.',
    pickLang: 'Khetha puo ea hau',
    pickLangSub: 'O ka e fetola neng kapa neng ka holimo.',
    start: 'Qala',
    heroSub: 'Tobetsa kae kapa kae Afrika Boroa ho fumana moralo o felletseng oa naha ea hau.',
    clickAnalyse: "Tobetsa 'mapa ho hlahloba",
    dataSources: 'Mehloli ea data',
    language: 'Puo',
  },
  tn: {
    tagline: 'Botlhale jwa Permaculture',
    welcomeTitle: 'O amogetswe mo ImbewuField',
    welcomeSub: 'Thulaganyo e e botlhale ya permaculture ya lefatshe la Aforika Borwa.',
    pickLang: 'Tlhopha puo ya gago',
    pickLangSub: 'O ka e fetola nako nngwe le nngwe kwa godimo.',
    start: 'Simolola',
    heroSub: 'Tobetsa gongwe le gongwe mo Aforika Borwa go bona thulaganyo e e feletseng ya lefatshe la gago.',
    clickAnalyse: 'Tobetsa mmapa go sekaseka',
    dataSources: 'Metswedi ya data',
    language: 'Puo',
  },
};

// Look up a string in any language (used by onboarding to preview before committing)
export function translate(lang: string, key: string): string {
  return T[lang]?.[key] ?? T.en[key] ?? key;
}

interface LangCtx {
  lang: string;
  setLang: (code: string) => void;
  t: (key: string) => string;
  onboarded: boolean;
  completeOnboarding: (code: string) => void;
}

const Ctx = createContext<LangCtx>({
  lang: 'en', setLang: () => {}, t: (k) => k, onboarded: true, completeOnboarding: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState('en');
  const [onboarded, setOnboarded] = useState(true); // assume true until we check, avoids modal flash on SSR

  useEffect(() => {
    const saved = localStorage.getItem('permamap_lang');
    const done = localStorage.getItem('permamap_onboarded') === '1';
    if (saved) setLangState(saved);
    setOnboarded(done);
  }, []);

  const setLang = (code: string) => {
    setLangState(code);
    localStorage.setItem('permamap_lang', code);
  };
  const completeOnboarding = (code: string) => {
    setLang(code);
    localStorage.setItem('permamap_onboarded', '1');
    setOnboarded(true);
  };
  const t = (key: string) => T[lang]?.[key] ?? T.en[key] ?? key;

  return <Ctx.Provider value={{ lang, setLang, t, onboarded, completeOnboarding }}>{children}</Ctx.Provider>;
}

export const useLanguage = () => useContext(Ctx);
