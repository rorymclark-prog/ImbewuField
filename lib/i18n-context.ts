import { createContext, useContext } from 'react';
import { LEARNER_UI_ENGLISH } from '@/lib/learner-ui-english';

export interface LangCtx {
  lang: string;
  setLang: (code: string) => void;
  t: (key: string) => string;
  onboarded: boolean;
  completeOnboarding: (code: string) => void;
}

export const Ctx = createContext<LangCtx>({
  lang: 'en', setLang: () => {}, t: (key) => LEARNER_UI_ENGLISH[key] ?? key,
  onboarded: true, completeOnboarding: () => {},
});

export const useLanguage = () => useContext(Ctx);
