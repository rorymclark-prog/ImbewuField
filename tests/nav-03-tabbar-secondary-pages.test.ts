import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// nav-03 (2026-10-16 visual/UX audit): Home, Map, Records, Learn, Prices and Journal showed the
// TabBar, but Offline, Tour, Tips, Updates, Samples, Example and Manual did not, so a farmer lost
// the way home on exactly the secondary pages. This covers the ones this track owns — offline,
// tour, tips, samples, samples/gardens, samples/farm. (/student's LimaBar mid-page placement and
// /updates, /example, /manual are owned by other tracks or carry their own architecture risk —
// not touched here; see the PR body.)
//
// TabBar.tsx itself documents its own contract: "it's the last child of the h-[100dvh] flex
// flex-col… layout" — not position:fixed. Every page below was restructured to that shape
// (flex column shell + a flex:1 overflow-y:auto scroll area + TabBar as the final sibling)
// rather than just dropping <TabBar/> at the end of an already-scrolling single container,
// which would have made it scroll away with the content instead of staying docked.
//
// w14: these pages render components/layout/AppHeader, which shows the same tabs at desktop
// width, so TabBar mounts with hideAtDesktop (AppHeader's own contract) — still the final flex
// sibling, still inside the no-print wrapper.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

for (const [label, rel] of [
  ['/tour', '../app/tour/page.tsx'],
  ['/tips', '../app/tips/page.tsx'],
  ['/offline', '../app/offline/page.tsx'],
  ['/samples', '../app/samples/page.tsx'],
  ['/samples/farm', '../app/samples/farm/page.tsx'],
  ['/samples/gardens', '../app/samples/gardens/page.tsx'],
] as const) {
  test(`${label} mounts TabBar as a flex-column sibling, not inside the scrolling area`, () => {
    const src = source(rel);
    assert.match(src, /import TabBar from '@\/components\/TabBar';/, `${label} must import TabBar`);
    assert.match(src, /<TabBar hideAtDesktop\s*\/>/, `${label} must render TabBar (hidden at desktop, where AppHeader carries the tabs)`);
    // TabBar sits in a no-print wrapper so printing these pages does not print the nav bar too.
    assert.match(src, /<div className="no-print"><TabBar hideAtDesktop\/><\/div>/, `${label}'s TabBar must be wrapped so it can be hidden on print`);
    assert.match(src, /import AppHeader from '@\/components\/layout\/AppHeader';/, `${label} must render the shared AppHeader that justifies hiding TabBar at desktop`);
  });
}

test('ProductTour.module.css splits .page into a flex-column shell and a .scroll content area', () => {
  const css = source('../components/ProductTour.module.css');
  assert.match(css, /\.page\{height:100dvh;overflow:hidden;display:flex;flex-direction:column/, '.page must become the flex-column shell TabBar needs');
  assert.match(css, /\.scroll\{flex:1;overflow-y:auto/, '.scroll must be the new scrolling content area');
  assert.match(css, /\.scroll\{flex:1;overflow-y:auto;padding:24px 20px calc\(var\(--bottom-nav-height,0px\)/, '.scroll padding must account for the real TabBar height now that one can be mounted');
});
