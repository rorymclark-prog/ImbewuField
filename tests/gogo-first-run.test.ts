/*
 * THE FIRST FIVE MINUTES, GUARDED.
 *
 * Gogo Test items 4 and 6 — the choices a farmer makes before she knows anything about the app,
 * and the strip that sits under her thumb afterwards. Each rule here replaces something that was
 * quietly wrong on a 375px phone:
 *
 *   • The onboarding modal put a big green "Start" ABOVE the language grid, so the obvious tap
 *     landed her in English.
 *   • That modal promises "you can change this later" — and on a phone she could not. The only
 *     switcher is `hidden md:block`, and the /account Language select wrote a Firestore field
 *     nothing read back.
 *   • The home screen's most valuable strip was a free-text box, in hardcoded English, addressed
 *     from a proper noun ("Lima") that the app never introduced.
 *
 * Source-shape tests, same style as tests/nav-role-filtering.test.ts: these are facts about what
 * the source declares and in what ORDER, which is exactly what regressed and exactly what a
 * rendering test would be worst at pinning down.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('onboarding asks which language BEFORE it offers the way out', () => {
  const body = code(read('components/Onboarding.tsx'));
  const grid = body.indexOf('APP_LANGS.map');
  const start = body.indexOf('completeOnboarding(picked)');
  assert.ok(grid > 0 && start > 0, 'both the language grid and the Start button must exist');
  assert.ok(grid < start,
    'the language grid must render ABOVE the primary button. A farmer who does not read English ' +
    'taps the obvious control first; if that control is Start, she is in an English app she then ' +
    'has to find her way out of.');
});

test('the language control she is promised actually exists on a phone', () => {
  // pickLangSub tells her the choice is changeable. LangSwitcher is `hidden md:block`, so the
  // panel reachable from the home gear and from Account is the only place that promise can live.
  const panel = code(read('components/ThemePanel.tsx'));
  assert.match(panel, /APP_LANGS\.map/, 'ThemePanel must offer the language list');
  assert.match(panel, /setLang\(/, 'and must actually switch the app, not just display the list');
  assert.ok(!/hidden md:block[\s\S]{0,300}APP_LANGS/.test(panel),
    'the language control must not be desktop-only — that is the bug it exists to fix');
});

test('the /account language select is wired to something that reads it', () => {
  // It wrote profile.language and nothing anywhere read that field back: a control that saved
  // without error and changed nothing.
  const acct = code(read('app/account/page.tsx'));
  const save = acct.match(/async function saveProfile\(\)[\s\S]*?\n  \}/);
  assert.ok(save, 'saveProfile must exist');
  assert.match(save[0], /setLang\(form\.language\)/,
    'saving the profile must apply the chosen language to the running app');
});

test('the home help strip is a labelled button, not an open composer', () => {
  const bar = code(read('components/LimaBar.tsx'));
  assert.ok(!/<input/.test(bar),
    'a free-text box is the hardest control there is for someone who types slowly, and it sat in ' +
    'the most valuable strip of the home screen by default. Free text is a place she CHOOSES to go.');
  assert.match(bar, /t\('limaAskButton'\)/, 'the ask control must be a translated label');
  assert.match(bar, /t\('limaWhoIs'\)/, '"Lima" is a proper noun with no referent until it is introduced');
  assert.match(bar, /t\('limaPhotoButton'\)/, 'the camera must say what it does — an unlabelled icon is a guess');
  assert.ok(!/Ask Lima anything/.test(bar),
    'the old placeholder was hardcoded English, so the most prominent line on the home screen was ' +
    'untranslated in all ten languages');
});

test('the new first-run copy is pending review in every locale, not silently translated', () => {
  const pending = read('lib/i18n-pending.ts');
  assert.match(pending, /LIMA_ENGLISH_PENDING/, 'the new keys must be declared as pending English');
  for (const f of readdirSync(join(ROOT, 'lib/locales')).filter((n) => n.endsWith('.ts'))) {
    const src = read(`lib/locales/${f}`);
    assert.match(src, /\.\.\.LIMA_ENGLISH_PENDING,/,
      `${f} must spread LIMA_ENGLISH_PENDING so the untranslated slot is explicit in this locale ` +
      "rather than hidden behind translate()'s English fallback");
  }
});
