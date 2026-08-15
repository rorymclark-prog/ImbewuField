import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// A screen reader has no way to know a full-screen div is a dialog unless it is told, and a
// keyboard-only farmer using a Bluetooth keyboard on a cheap Android phone has no way to back out
// of one without Escape. Four sheets — the evidence library, an evidence group, the profile
// editor and the site questionnaire — drew themselves as a plain <div> with an onClick-outside
// handler and nothing else: no role, no aria-modal, no aria-label, and Escape did nothing at all.
// Every OTHER sheet in the app (AddSheet, ThemePanel, JournalEntrySheet) already had this.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const SHEETS = [
  '../components/EvidenceCatalogue.tsx',
  '../components/EvidenceSheet.tsx',
  '../components/ProfileSheet.tsx',
  '../components/SiteSurveySheet.tsx',
];

test('every evidence/profile/survey sheet announces itself as a modal dialog', () => {
  for (const rel of SHEETS) {
    const s = source(rel);
    assert.match(s, /role="dialog"/, `${rel} does not identify itself as a dialog`);
    assert.match(s, /aria-modal="true"/, `${rel} does not mark itself modal`);
    assert.match(s, /aria-label=/, `${rel} gives no accessible name for its dialog`);
  }
});

test('every evidence/profile/survey sheet closes on Escape', () => {
  for (const rel of SHEETS) {
    const s = source(rel);
    assert.match(s, /e\.key === 'Escape'/, `${rel} does not listen for Escape`);
    assert.match(s, /addEventListener\('keydown', onKey\)/, `${rel} wires no keydown listener`);
  }
});

test('every icon-only close/dismiss/remove button in these sheets has an accessible name', () => {
  for (const rel of SHEETS) {
    const s = source(rel);
    // Every bare `<X size=...` icon close glyph must sit behind a button carrying aria-label —
    // a lone "X" is unreadable to a screen reader either way.
    // closeWithConfirm landed later (a data-loss guard wrapping the site questionnaire's own X in
    // a confirm() before it calls onClose underneath) — still the same close-shaped button.
    const closeButtons = s.match(/<button[^>]*onClick=\{[^}]*(onClose|closeWithConfirm|setStorageFull|handleRemove)[^}]*\}[^>]*>/g) ?? [];
    assert.ok(closeButtons.length > 0, `${rel} has no close-shaped button to check — did the markup change?`);
    for (const btn of closeButtons) {
      assert.match(btn, /aria-label/, `${rel} has an icon button with no aria-label: ${btn}`);
    }
  }
});

test('the survey questionnaire toggles expose switch semantics, not silent divs', () => {
  const s = source('../components/SiteSurveySheet.tsx');
  assert.match(s, /role="switch"/, 'the on/off toggle no longer identifies as a switch');
  assert.match(s, /aria-checked=\{on\}/, 'the toggle state is not exposed to assistive tech');
});

test('the profile screen toggle exposes switch semantics too', () => {
  const s = source('../components/ProfileSheet.tsx');
  assert.match(s, /role="switch"/, 'ProfileSheet\'s toggle no longer identifies as a switch');
  assert.match(s, /aria-checked=\{on\}/, 'ProfileSheet\'s toggle state is not exposed to assistive tech');
});

test('a person\'s own card in the people list is a real button, not a clickable div', () => {
  // Only YOUR OWN card in the People panel does anything (it opens your profile) — everyone
  // else's card is inert. A plain <div onClick> is invisible to keyboard and screen-reader
  // navigation; it must render as an actual <button> when it is interactive.
  const s = source('../components/PeoplePanel.tsx');
  assert.match(s, /const Wrapper = isCurrentUser \? 'button' : 'div'/,
    'PersonCard no longer switches its own root element to a button when clickable');
  assert.match(s, /aria-label=\{isCurrentUser \? 'Open your profile' : undefined\}/,
    'the clickable own-profile card lost its accessible name');
});

test('the plant catalog picker renders each species as a real button', () => {
  // The species list in the Design Studio's plant catalog was a <div onClick> per row — tappable
  // with a mouse, invisible to a keyboard or a screen reader's swipe navigation. It must be a
  // <button> like every other list-of-choices in this app.
  const s = source('../components/design/SpeciesPicker.tsx');
  assert.doesNotMatch(s, /<div\s*\n\s*key=\{s\.id\}\s*\n\s*onClick=\{\(\) => onSelect\(s\.id\)\}/,
    'the species row is a clickable div again');
  assert.match(s, /<button\s*\n\s*key=\{s\.id\}\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => onSelect\(s\.id\)\}/,
    'the species row is not rendered as a real button');
});
