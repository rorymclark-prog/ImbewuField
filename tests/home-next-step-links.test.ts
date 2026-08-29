import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// These two files hold the FRONT DOOR of the app — the tab-bar Home screen and its hamburger
// menu (app/home/page.tsx, components/NavDrawer.tsx). Neither renders as pure functions of
// exported data, so unlike lib/*.ts modules there is nothing to import and call: the guard here
// is the same source-text pattern tests/locked-polish-flow.test.ts uses for DesignGlossy.tsx —
// read the real shipped file and assert the wiring a farmer would actually tap is present.

const HOME_SOURCE = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
const NAV_DRAWER_SOURCE = readFileSync(new URL('../components/NavDrawer.tsx', import.meta.url), 'utf8');

test('the "Your farm plan" boundary step actually lands on the boundary tool', () => {
  // Was `boundary: { label: 'Trace your boundary', href: () => '/farmer' }` — tapping it
  // dropped the farmer on the default map with no site loaded and no draw tool armed, so the
  // coaching card told them to do a thing the link never started. It must now carry the same
  // ?arm=site handoff the "+Add → Boundary" row on the map itself fires (components/Map.tsx,
  // imbewu-arm-draw), and land on the farmer's own site rather than a blank map.
  const boundaryBlock = HOME_SOURCE.match(/boundary:\s*\{[\s\S]*?\},\n\s*\/\/ The real survey/);
  assert.ok(boundaryBlock, 'could not find the boundary STEP_ACTIONS entry in app/home/page.tsx');
  assert.match(boundaryBlock![0], /arm=site/, 'boundary href must arm the map\'s boundary draw tool');
  assert.match(boundaryBlock![0], /siteId/, 'boundary href must thread the farmer\'s own site id through, not a blank map');
});

test('home leads with the recommendation and next action before weather or repeated site facts', () => {
  const priority = HOME_SOURCE.indexOf('home-priority-primary');
  const hero = HOME_SOURCE.indexOf('<HomeHeroCard', priority);
  const nextAction = HOME_SOURCE.indexOf('<FarmPlanCard', hero);
  const weather = HOME_SOURCE.indexOf('<MainSiteWeatherCard', nextAction);
  assert.ok(priority > 0 && hero > priority && nextAction > hero && weather > nextAction,
    'the signed-in home must answer what to do next before it asks the farmer to read weather data');

  assert.match(HOME_SOURCE, /lastSiteMatchesMain[\s\S]*Math\.abs[\s\S]*0\.00001/,
    'the last-viewed and main-site cards need one coordinate comparison instead of repeating one farm');
  assert.match(HOME_SOURCE, /lastSite && !lastSiteMatchesMain && <LastSiteCard/,
    'the recent-site card should render only when it is genuinely a different place');
  assert.match(HOME_SOURCE, /STEP_COPY\[nextStep\][\s\S]*t\(nextStepCopy\.titleKey\)/,
    'the highlighted action and the guided journey must name one step from the same copy authority');
});

test('home uses a two-column priority area on wide screens but keeps one reading order on phones', () => {
  assert.match(HOME_SOURCE, /max-w-5xl/, 'the desktop home is back to a narrow phone column');
  assert.match(HOME_SOURCE, /@media \(min-width: 900px\)[\s\S]*home-priority-grid\.has-main-site[\s\S]*grid-template-columns/,
    'the signed-in priority area must use the available desktop width');
  assert.match(HOME_SOURCE, /home-quick-grid[\s\S]*repeat\(6/,
    'six quick actions should form one calm desktop row rather than two phone rows');
});

test('the farmer page still understands ?arm=site — the link above depends on it', () => {
  // app/farmer/page.tsx's one-shot ?arm=site|water deep link is what the Home link above
  // relies on. If that handler is ever removed without updating the Home link, this is the
  // canary — Home would silently go back to landing farmers on a blank, unarmed map.
  const farmerSource = readFileSync(new URL('../app/farmer/page.tsx', import.meta.url), 'utf8');
  assert.match(farmerSource, /searchParams\.get\('arm'\)/, 'app/farmer/page.tsx must still consume ?arm=');
  assert.match(farmerSource, /imbewu-arm-draw/, 'app/farmer/page.tsx must still dispatch imbewu-arm-draw for ?arm=');
});

test('the hamburger menu does not list the crop planner twice', () => {
  // '/plan' is a pure redirect to /facilitator/crops (see app/plan/page.tsx — "one
  // crop-planning authority"). NavDrawer used to list BOTH: '/plan' under the translated
  // "Crop Planner" label and '/facilitator/crops' under "Bed-by-Bed Crop Plan" — two rows in
  // the same section, in the same menu, that land on the exact same screen. Guard against the
  // duplicate coming back rather than the specific wording, so a future rename doesn't
  // re-trip this test for no reason.
  const farmToolsSection = NAV_DRAWER_SOURCE.match(/navSectionFarmTools[\s\S]*?\],\s*\n\s*\},/);
  assert.ok(farmToolsSection, 'could not find the Farm Tools nav section in NavDrawer.tsx');
  assert.doesNotMatch(farmToolsSection![0], /href: '\/plan'/, 'Farm Tools should not list /plan alongside /facilitator/crops — same destination, two rows');
  assert.match(farmToolsSection![0], /href: '\/facilitator\/crops'/, 'the direct Bed-by-Bed Crop Plan row must still be present');
});
