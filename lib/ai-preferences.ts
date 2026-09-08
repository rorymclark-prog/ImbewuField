'use client';
import { activeAccountLocalStorageKey } from './account-local-storage';
import { AI_FEATURES, type AiFeature } from './ai-features';
const KEY = 'imbewu-ai-preferences';
export function disabledAiFeatures(): AiFeature[] {
  try { const saved = JSON.parse(localStorage.getItem(activeAccountLocalStorageKey(KEY)) || '[]'); return Array.isArray(saved) ? saved.filter((v): v is AiFeature => typeof v === 'string' && v in AI_FEATURES) : []; } catch { return []; }
}
export function saveDisabledAiFeatures(disabled: AiFeature[]): boolean {
  try { const key = activeAccountLocalStorageKey(KEY), value = JSON.stringify(disabled); localStorage.setItem(key,value); return localStorage.getItem(key) === value; } catch { return false; }
}
