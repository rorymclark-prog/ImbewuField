import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Verified bug: app/assessments/page.tsx rendered `<MelDashboard />` and nothing else — no header,
// no way back except the browser's own back button, no <TabBar />. Every sibling screen in this
// area (mentor, ngo, funder, surveys, reports) shares the same header shell + TabBar; this page
// did not.
//
// desk-06/sdesk-04: the header shell moved into one shared components/layout/AppHeader.tsx so
// /mentor, /ngo, /funder, /reports, /assessments and /surveys stop each assembling their own
// slightly different bar. The guard now checks the shell's actual contract at AppHeader itself,
// plus that this page still wires AppHeader + TabBar in.

const source = () => readFileSync(new URL('../app/assessments/page.tsx', import.meta.url), 'utf8');
const appHeaderSource = () => readFileSync(new URL('../components/layout/AppHeader.tsx', import.meta.url), 'utf8');

test('/assessments uses the shared AppHeader shell', () => {
  const src = source();
  assert.match(src, /import AppHeader from '@\/components\/layout\/AppHeader'/, 'AppHeader is gone');
  assert.match(src, /<AppHeader\b/, 'AppHeader is no longer rendered');
});

test('AppHeader itself still carries MenuButton, BackButton, BrandLogo, Settings', () => {
  const src = appHeaderSource();
  assert.match(src, /import MenuButton from '@\/components\/MenuButton'/, 'MenuButton is gone from the shared header');
  assert.match(src, /import BackButton from '@\/components\/BackButton'/, 'BackButton is gone from the shared header');
  assert.match(src, /import BrandLogo from '@\/components\/BrandLogo'/, 'BrandLogo is gone from the shared header');
  assert.match(src, /import SettingsButton from '@\/components\/SettingsButton'/, 'SettingsButton is gone from the shared header');
  assert.match(src, /<MenuButton\s*\/>/, 'MenuButton is no longer rendered by the shared header');
  assert.match(src, /<BackButton[\s\S]*?\/>/, 'BackButton is no longer rendered by the shared header');
  assert.match(src, /<BrandLogo\s*\/>/, 'BrandLogo is no longer rendered by the shared header');
  assert.match(src, /<SettingsButton\s*\/>/, 'SettingsButton is no longer rendered by the shared header');
});

test('/assessments still has a way back to the app: TabBar', () => {
  const src = source();
  assert.match(src, /import TabBar from '@\/components\/TabBar'/, 'TabBar import is gone');
  assert.match(src, /<TabBar\b[^>]*\/>/, 'TabBar is no longer rendered — this page is a dead end again');
});

test('the header shell wraps MelDashboard rather than replacing it', () => {
  const src = source();
  assert.match(src, /<MelDashboard\s*\/>/, 'MelDashboard is no longer rendered on this route');
});
