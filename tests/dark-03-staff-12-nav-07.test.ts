import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// dark-03/staff-12/nav-07 (2026-10-16 visual/UX audit), owned-files portion: NetworkMap's five
// ink/paper constants were hex literals, so they stayed bright-paper-on-dark no matter the
// theme/mode even though every call site referenced a "constant" rather than a literal; the
// atlas first-run hint's near-white pill made its own --text-muted caption effectively
// invisible in dark mode; and /contact had two back controls side by side.
//
// app/atlas/page.tsx's own `background:'#E4DCC6'` and app/network/page.tsx's INK/LINE/PAPER
// constants (also named in this finding) are NOT in this track's owned files and are not
// touched here.

const network = readFileSync(new URL('../components/network/NetworkMap.tsx', import.meta.url), 'utf8');
const atlas = readFileSync(new URL('../components/atlas/AtlasExplorer.tsx', import.meta.url), 'utf8');
const contact = readFileSync(new URL('../app/contact/page.tsx', import.meta.url), 'utf8');

test('NetworkMap ink/paper constants resolve to theme tokens, not hex literals', () => {
  assert.match(network, /const INK = 'var\(--text-primary\)'/);
  assert.match(network, /const INK_SOFT = 'var\(--text-secondary\)'/);
  assert.match(network, /const INK_MUTED = 'var\(--text-muted\)'/);
  assert.match(network, /const LINE = 'var\(--border\)'/);
  assert.match(network, /const PAPER = 'var\(--bg-1\)'/);
  // The pin-status palette is deliberately fixed across themes (so two funder-facing screens
  // never disagree about what "thriving" looks like) and must stay untouched by this fix.
  assert.match(network, /thriving: \{ color: '#1F4D2B' \}/);
});

test('NetworkMap has no more literal near-white fills standing in for the paper token', () => {
  assert.doesNotMatch(network, /rgba\(255,254,250/, 'every near-white fill must route through var(--bg-1) via color-mix, not a literal rgba');
});

test('AtlasExplorer\'s first-run hint pill follows the theme instead of staying a bright card in dark mode', () => {
  assert.doesNotMatch(atlas, /rgba\(255,254,250,0\.94\)/);
  assert.match(atlas, /color-mix\(in srgb, var\(--bg-1\) 94%, transparent\)/);
  assert.doesNotMatch(atlas, /#1F4D2B/, 'the Earth/Loader2 icon colours must also route through the forest token');
});

test('nav-07: /contact has exactly one back control', () => {
  // w14 (desk-02): the hand-built MenuButton · BackButton pair became the shared AppHeader, whose
  // BackButton (fallback /home by default) is now the page's only back control.
  assert.match(contact, /import AppHeader from '@\/components\/layout\/AppHeader';/);
  assert.equal((contact.match(/<AppHeader\b/g) ?? []).length, 1, 'exactly one AppHeader, so exactly one BackButton');
  assert.doesNotMatch(contact, /<BackButton|<MenuButton/, 'no hand-built back control may sit beside AppHeader\'s');
  assert.doesNotMatch(contact, /<ChevronLeft/, 'the duplicate chevron Link to \/home must be gone');
  assert.doesNotMatch(contact, /^import Link from 'next\/link';$/m, 'an unused import left behind is its own small regression');
});
