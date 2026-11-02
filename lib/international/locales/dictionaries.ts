import { FR_DRAFTS } from './fr';
import { ES_DRAFTS } from './es';
import { PT_DRAFTS } from './pt';
import { SW_DRAFTS } from './sw';
import type { DraftDictionary, DraftLanguage } from './types';

export const DRAFT_DICTIONARIES: Readonly<Record<DraftLanguage, DraftDictionary>> = {
  fr: FR_DRAFTS, es: ES_DRAFTS, pt: PT_DRAFTS, sw: SW_DRAFTS,
};
