// Pure fallback-vs-real bed loader for the Task Planner (./page.tsx).
//
// Split out from the 'use client' page so the fallback decision can be unit-tested
// directly — page.tsx has JSX and can't be imported by node's type-stripping (see
// tests/farmer-panel-format.test.ts, which does the same split for the same reason).
//
// Run with: node --import ../tests/register-alias.mjs --test tests/cropplan-beds.test.ts

import { activeAccountLocalStorageKey } from '@/lib/account-local-storage';

export interface Bed { letter: string; crop: string }

// Invented four-bed example (Spinach/Tomatoes/Maize/Beans) shown only when the farmer has
// saved no beds of their own anywhere. page.tsx must flag this — see loadBedsResult.isDemo —
// rather than let a farmer mistake these for beds they actually planted.
export const DEFAULT_BEDS: Bed[] = [
  { letter: 'A', crop: 'Spinach' }, { letter: 'B', crop: 'Tomatoes' },
  { letter: 'C', crop: 'Maize' },   { letter: 'D', crop: 'Beans' },
];
const LATEST_SURVEY_KEY = 'imbewu_garden_survey';
const DEFAULT_SURVEY_KEY = 'imbewu_garden_survey_default';
const PLANNER_CROPS_KEY = 'imbewu_planner_crops';

export interface LoadedBeds { beds: Bed[]; isDemo: boolean }

/**
 * Loads the farmer's task-planner beds. Tries the two account-local garden-survey
 * records, then the standalone planner crop list; only when none of those exist does
 * it fall back to DEFAULT_BEDS — a fictional example, never anything the farmer typed
 * in. `isDemo` is true only in that last case, so the page can show it's an example.
 */
export function loadBeds(): LoadedBeds {
  if (typeof window === 'undefined') return { beds: DEFAULT_BEDS, isDemo: false };
  for (const baseKey of [LATEST_SURVEY_KEY, DEFAULT_SURVEY_KEY]) {
    try {
      const s = JSON.parse(
        localStorage.getItem(activeAccountLocalStorageKey(baseKey)) || 'null',
      );
      if (s?.bedCrops?.length) {
        return {
          beds: s.bedCrops.map((c: string, i: number) => ({
            letter: String.fromCharCode(65 + i),
            crop: c,
          })),
          isDemo: false,
        };
      }
    } catch { /* try the next account-local source */ }
  }
  try {
    const p = JSON.parse(
      localStorage.getItem(activeAccountLocalStorageKey(PLANNER_CROPS_KEY)) || 'null',
    );
    if (Array.isArray(p) && p.length) {
      return {
        beds: p.slice(0, 6).map((c: string, i: number) => ({ letter: String.fromCharCode(65 + i), crop: c })),
        isDemo: false,
      };
    }
  } catch { /* ignore */ }
  return { beds: DEFAULT_BEDS, isDemo: true };
}
