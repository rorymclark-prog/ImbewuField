import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Verified bug: app/assessments/page.tsx rendered `<MelDashboard />` and nothing else — no header,
// no way back except the browser's own back button, no <TabBar />. Every sibling screen in this
// area (mentor, ngo, funder, surveys) shares the same header shell + TabBar; this page did not.

const source = () => readFileSync(new URL('../app/assessments/page.tsx', import.meta.url), 'utf8');

test('/assessments has the shared header shell: MenuButton, BackButton, BrandLogo, Settings', () => {
  const src = source();
  assert.match(src, /import MenuButton from '@\/components\/MenuButton'/, 'MenuButton is gone');
  assert.match(src, /import BackButton from '@\/components\/BackButton'/, 'BackButton is gone');
  assert.match(src, /import BrandLogo from '@\/components\/BrandLogo'/, 'BrandLogo is gone');
  assert.match(src, /import SettingsButton from '@\/components\/SettingsButton'/, 'SettingsButton is gone');
  assert.match(src, /<MenuButton\s*\/>/, 'MenuButton is no longer rendered');
  assert.match(src, /<BackButton[\s\S]*?\/>/, 'BackButton is no longer rendered');
  assert.match(src, /<BrandLogo\s*\/>/, 'BrandLogo is no longer rendered');
  assert.match(src, /<SettingsButton\s*\/>/, 'SettingsButton is no longer rendered');
});

test('/assessments still has a way back to the app: TabBar', () => {
  const src = source();
  assert.match(src, /import TabBar from '@\/components\/TabBar'/, 'TabBar import is gone');
  assert.match(src, /<TabBar\s*\/>/, 'TabBar is no longer rendered — this page is a dead end again');
});

test('the header shell wraps MelDashboard rather than replacing it', () => {
  const src = source();
  assert.match(src, /<MelDashboard\s*\/>/, 'MelDashboard is no longer rendered on this route');
});
