export type DraftLanguage = 'fr' | 'es' | 'pt' | 'sw';
export type TextDirection = 'ltr' | 'rtl';
export type PluralCategory = Intl.LDMLPluralRule;
export interface LanguageMetadata {
  language: DraftLanguage;
  englishName: string;
  nativeName: string;
  direction: TextDirection;
  /** Formatting is a separate user choice, never a jurisdiction. */
  suggestedFormattingLocale: string;
  readiness: 'unreviewed-draft';
}
export interface SourceMessage {
  key: string;
  sourceFile: 'lib/i18n.tsx'
    | 'components/crops/NurseryFieldPlantingObservationForm.tsx'
    | 'components/journal/JournalNurseryFieldPlantingSummary.tsx'
    | 'components/crops/SavedGrowerNurseryReviewPanel.tsx'
    | 'components/crops/GrowerEnteredMassField.ts'
    | 'components/crops/GrowerCycleIntent.ts'
    | 'lib/international/grower-cycle-intent.ts'
    | 'lib/release-notes.ts'
    | 'components/studies/LearningRegionNotice.tsx';
  english: string;
  pluralArgument?: string;
}
export interface DraftMessage {
  key: string;
  sourceEnglish: string;
  text: string;
  pluralForms?: Partial<Record<PluralCategory, string>>;
  provenance: { executor: string; method: 'AI draft'; createdOn: string };
  review: { status: 'unreviewed' } | { status: 'human-reviewed'; reviewer: string; reviewedOn: string; sourceEnglish: string; draftText: string; pluralForms?: Partial<Record<PluralCategory, string>> };
}
export type SourceDictionary = Readonly<Record<string, string | undefined>>;
export type DraftDictionary = Readonly<Record<string, DraftMessage | undefined>>;
export type MessageState = 'draft' | 'reviewed' | 'missing' | 'source-missing' | 'stale' | 'invalid';
export interface MessageAssessment {
  key: string;
  state: MessageState;
  issues: string[];
  source: string | undefined;
  draft: DraftMessage | undefined;
}
