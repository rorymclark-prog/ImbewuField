export type SiteSurveyWelcomeField =
  | 'fieldNotebook'
  | 'welcomeTitle'
  | 'shortTitle'
  | 'fullTitle'
  | 'fiveSections'
  | 'sevenSections'
  | 'begin'
  | 'continue';

export type SiteSurveyWelcomeDraft = {
  sourceEnglish: string;
  draft: string;
  reviewStatus: 'machine-draft' | 'hold';
};

/** Welcome and mode labels only; held fields remain exact English until fluent review. */
export const SITE_SURVEY_WELCOME_DRAFTS: Record<SiteSurveyWelcomeField, {
  st: SiteSurveyWelcomeDraft;
  ve: SiteSurveyWelcomeDraft;
}> = {
  fieldNotebook: {
    st: { sourceEnglish: 'Your field notebook', draft: 'Buka ya masimo ya hao', reviewStatus: 'machine-draft' },
    ve: { sourceEnglish: 'Your field notebook', draft: 'Bugu ya tsimuni yaṋu', reviewStatus: 'machine-draft' },
  },
  welcomeTitle: {
    st: { sourceEnglish: 'A good plan starts with your land.', draft: 'Moralo o motle o qala ka sebaka sa hao.', reviewStatus: 'machine-draft' },
    ve: { sourceEnglish: 'A good plan starts with your land.', draft: 'A good plan starts with your land.', reviewStatus: 'hold' },
  },
  shortTitle: {
    st: { sourceEnglish: 'Short & simple', draft: 'E kgutshwane ebile e bonolo', reviewStatus: 'machine-draft' },
    ve: { sourceEnglish: 'Short & simple', draft: 'Short & simple', reviewStatus: 'hold' },
  },
  fullTitle: {
    st: { sourceEnglish: 'Comprehensive', draft: 'E felletseng', reviewStatus: 'machine-draft' },
    ve: { sourceEnglish: 'Comprehensive', draft: 'Comprehensive', reviewStatus: 'hold' },
  },
  fiveSections: {
    st: { sourceEnglish: '5 sections + review', draft: '5 sections + review', reviewStatus: 'hold' },
    ve: { sourceEnglish: '5 sections + review', draft: '5 sections + review', reviewStatus: 'hold' },
  },
  sevenSections: {
    st: { sourceEnglish: '7 sections + review', draft: '7 sections + review', reviewStatus: 'hold' },
    ve: { sourceEnglish: '7 sections + review', draft: '7 sections + review', reviewStatus: 'hold' },
  },
  begin: {
    st: { sourceEnglish: 'Start survey', draft: 'Thomani tlhahlobo', reviewStatus: 'machine-draft' },
    ve: { sourceEnglish: 'Start survey', draft: 'Thomani tsedzuluso', reviewStatus: 'machine-draft' },
  },
  continue: {
    st: { sourceEnglish: 'Continue survey', draft: 'Tswelang pele ka tlhahlobo', reviewStatus: 'machine-draft' },
    ve: { sourceEnglish: 'Continue survey', draft: 'Continue survey', reviewStatus: 'hold' },
  },
};

export function resolveSiteSurveyWelcomeDraft(field: SiteSurveyWelcomeField, language: string) {
  if (language !== 'st' && language !== 've') return null;
  return SITE_SURVEY_WELCOME_DRAFTS[field][language];
}
