import type { ReactNode } from 'react';

export const SURVEY_DISCARD_CONFIRM_ENGLISH = 'Discard your answers so far? This questionnaire has not been saved yet.';
export const SURVEY_DISCARD_BUTTON_ENGLISH = 'Discard answers';

/** HOLD translations stay next to their exact English source until fluent field review. */
export default function SurveyZuluDraftPair({ children, english }: { children: ReactNode; english: string }) {
  return <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
    <span>{children}</span>
    <small lang="en" style={{ fontSize: '12px', fontWeight: 400, opacity: 0.82 }}>English: {english}</small>
  </span>;
}

export function surveyZuluConfirmDraft(zulu: string, english: string): string {
  return `${zulu}\n\nEnglish: ${english}`;
}
