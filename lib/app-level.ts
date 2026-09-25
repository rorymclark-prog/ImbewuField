'use client';

// SIMPLE / ALL TOOLS — how much of the app a person sees.
//
// Rory: the app "has now become very busy". A farmer who is new to smartphones needs the few
// jobs that matter; a mentor or an NGO officer needs every tool. So the app has one switch with
// two positions, and each screen decides what the Simple position leaves out. The first screen to
// use it is Home: Simple is the decluttered Home (the site named once, the next step on the site
// card, no second My Records door), All tools is Home exactly as it was, kept whole on purpose —
// "there's a lot I like about both", so both stay reachable until it is clear what to carry over.
//
// WHO GETS WHICH BY DEFAULT. Farmers, and anyone not signed in (a first-time visitor is most
// likely a new farmer), start on Simple. Mentors, students, NGO, funder and admin accounts start
// on All tools. The sample-farm tour starts on All tools unless it is previewing the farmer
// role: its stops walk an evaluator through charts and invoices a Simple screen may leave out.
// An organisation-wide default for its farmers is planned next; the person's own choice, once
// made in Settings, always wins.
//
// WHERE IT LIVES. This device's localStorage under the signed-in account's own key (the same
// account scoping every other preference uses), so switching accounts on a shared phone does not
// carry one person's choice onto another.

import { useSyncExternalStore } from 'react';
import { activeAccountLocalStorageKey } from '@/lib/account-local-storage';
import { useRoleNavigation } from '@/lib/use-role-navigation';
import type { UserRole } from '@/lib/db/types';
import { defaultAppLevel, isAppLevel, type AppLevel } from '@/lib/app-level-core';

export { defaultAppLevel, type AppLevel };

export const APP_LEVEL_KEY = 'imbewu_app_level_v1';
export const APP_LEVEL_EVENT = 'imbewu-app-level-changed';

// Only used when localStorage throws, so the choice still takes effect for this tab.
let memoryLevel: AppLevel | null = null;

/** The level this person chose on this device, or null when they have not chosen one. */
export function readStoredAppLevel(): AppLevel | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(APP_LEVEL_KEY));
    return isAppLevel(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function setAppLevel(level: AppLevel): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(activeAccountLocalStorageKey(APP_LEVEL_KEY), level);
  } catch {
    // Storage refused (private mode, quota): the switch still applies until the tab closes.
    memoryLevel = level;
  }
  window.dispatchEvent(new CustomEvent(APP_LEVEL_EVENT));
}

function subscribe(notify: () => void) {
  window.addEventListener(APP_LEVEL_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(APP_LEVEL_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}

const snapshot = () => readStoredAppLevel() ?? memoryLevel;

/**
 * The level to render. Server render and the hydration pass see no stored choice (so they use
 * the role default and match each other); a stored choice takes over straight after.
 */
export function useAppLevel(): AppLevel {
  const { navigationRole, sample } = useRoleNavigation();
  const sampleRole = sampleRoleName(sample, navigationRole);
  const stored = useSyncExternalStore(subscribe, snapshot, () => null);
  return stored ?? defaultAppLevel(navigationRole, sampleRole);
}

// useRoleNavigation reports `sample` and the previewed role; a sample session that previews no
// role reads as 'sample'. Kept as a tiny adapter so defaultAppLevel stays a pure function.
function sampleRoleName(sample: boolean, navigationRole: UserRole | null): string {
  if (!sample) return '';
  return navigationRole ?? 'sample';
}
