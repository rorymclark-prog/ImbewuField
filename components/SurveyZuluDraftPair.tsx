import type { ReactNode } from 'react';

export const SURVEY_DISCARD_CONFIRM_ENGLISH = 'Discard your answers so far? This questionnaire has not been saved yet.';
export const SURVEY_DISCARD_BUTTON_ENGLISH = 'Discard answers';

/** HOLD translations stay next to their exact English source until fluent field review. */
export default function SurveyZuluDraftPair({ children, english }: { children: ReactNode; english: string }) {
  return <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
    <span lang="zu">{children}</span>
    {/* w15-02: the stack is visual only. Without this space the text (and a heading's
        accessible name) reads "…wasensiminiEnglish: My fieldwork" as one word. A
        whitespace-only text node is not laid out inside a flex container, so nothing moves. */}
    {' '}
    <small lang="en" style={{ fontSize: '12px', fontWeight: 400, opacity: 0.82 }}>English: {english}</small>
  </span>;
}

export function surveyZuluConfirmDraft(zulu: string, english: string): string {
  return `${zulu}\n\nEnglish: ${english}`;
}
