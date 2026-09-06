// Presentation preferences never change designs, caches, render prices or prompts.
// The card palette is now standard. The classic value is retained only so older
// callers/storage remain readable; it resolves to the current default.
// tests/ui-version.test.ts enforces the separation from data and render paths.

export type UiVersion = 'classic' | 'cards';

/** What everyone gets until they choose otherwise. Flipping THIS constant is how a new UI
 *  eventually becomes the default for everyone — one line, reversible, no data change. */
export const DEFAULT_UI_VERSION: UiVersion = 'cards';

export const UI_VERSION_KEY = 'imbewu_ui_version';
export const UI_VERSION_EVENT = 'imbewu-ui-version-change';

// The trial is over: old saved classic preferences now resolve to the standard cards UI.
const KNOWN: readonly UiVersion[] = ['cards'];

export function uiVersion(): UiVersion {
  if (typeof window === 'undefined') return DEFAULT_UI_VERSION;
  try {
    const raw = window.localStorage.getItem(UI_VERSION_KEY);
    return (KNOWN as readonly string[]).includes(raw ?? '') ? (raw as UiVersion) : DEFAULT_UI_VERSION;
  } catch {
    return DEFAULT_UI_VERSION;
  }
}

export function setUiVersion(next: UiVersion): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_VERSION_KEY, next);
  } catch {
    /* private mode: the choice lasts the session via the event below, which is honest enough */
  }
  window.dispatchEvent(new Event(UI_VERSION_EVENT));
}
