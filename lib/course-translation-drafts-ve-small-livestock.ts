/** Source-paired Tshivenda module-card draft. Lesson copy remains held in English. */
import type { TshivendaCourseModuleDraft, TshivendaSourcePair } from './course-translation-drafts-ve.ts';

const pair = (sourceEnglish: string, tshivendaDraft: string): TshivendaSourcePair => ({
  sourceEnglish,
  tshivendaDraft,
  reviewStatus: 'machine-draft',
});

const hold = (sourceEnglish: string): TshivendaSourcePair => ({
  sourceEnglish,
  tshivendaDraft: sourceEnglish,
  reviewStatus: 'hold',
});

export const TSHIVENDA_SMALL_LIVESTOCK_DRAFT: TshivendaCourseModuleDraft = {
  id: 'small-livestock',
  language: 've',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 20, category: 'foundation' },
  title: hold('Small Livestock Integration'),
  description: pair(
    'Chickens, ducks and bees as system components — not afterthoughts.',
    'Chickens, ducks and bees sa system components — hu si zwithu zwo humbulwaho nga murahu.',
  ),
  // Title candidates for the lessons were back-checked and held after terminology mismatches.
  lessons: [],
};
