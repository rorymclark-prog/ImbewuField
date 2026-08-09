// THE UI VERSION SWITCH — how the interface gets upgraded without touching anyone's work.
//
// Rory: "We must be able to upgrade UI in the future so you must figure out how to easily do
// this that it doesn't affect farmers."
//
// The rule that makes that possible is a boundary, not a mechanism: THE FLAG MAY ONLY EVER BE
// READ BY PRESENTATION. A component may consult it to decide how something LOOKS — card or chip,
// rail width, header layout. Nothing that writes a design, keys a cache, names a storage record,
// prices a render or builds an AI prompt may branch on it. Data written under one UI version must
// be byte-identical to data written under the other, which is what makes flipping the switch —
// in either direction — always safe. tests/ui-version.test.ts enforces the read side; the write
// side is enforced by the fact that this module exports nothing a data path would want.
//
// Versions are NAMED, not boolean, so the third UI someday is 'v3', not a second flag that
// multiplies states with the first. Unknown stored values fall back to the default rather than
// throwing: a farmer whose localStorage carries a retired version name gets the current default,
// never a crash.

export type UiVersion = 'classic' | 'cards';

/** What everyone gets until they choose otherwise. Flipping THIS constant is how a new UI
 *  eventually becomes the default for everyone — one line, reversible, no data change. */
export const DEFAULT_UI_VERSION: UiVersion = 'classic';

export const UI_VERSION_KEY = 'imbewu_ui_version';
export const UI_VERSION_EVENT = 'imbewu-ui-version-change';

const KNOWN: readonly UiVersion[] = ['classic', 'cards'];

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
