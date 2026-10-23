import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// desk-07/sdesk-04/sdesk-05/staff-10: at 1280px the only navigation on these screens was the
// phone bottom tab bar stretched edge to edge (desk-07), and that bar itself used to give a
// mentor/ngo/funder the farmer's own Home/Map/My Records/Account tabs, or — for /funder — no bar
// at all (sdesk-05/staff-10). This guards the fix: TabBar now has one role-aware tab set shared
// with the new components/layout/AppHeader.tsx, which shows those same destinations as desktop
// text links at lg+ instead of the phone bar, and TabBar can step aside there via hideAtDesktop.

const tabBarSource = () => readFileSync(new URL('../components/TabBar.tsx', import.meta.url), 'utf8');
const appHeaderSource = () => readFileSync(new URL('../components/layout/AppHeader.tsx', import.meta.url), 'utf8');
const dashboardTabsCss = () => readFileSync(new URL('../components/DashboardTabs.module.css', import.meta.url), 'utf8');

test('TabBar exports one tabsForRole shared with AppHeader, not a second copy of the tab sets', () => {
  const src = tabBarSource();
  assert.match(src, /export function tabsForRole/, 'tabsForRole is no longer exported for AppHeader to reuse');
});

test('mentor, ngo and funder share one staff tab shape: Home, Dashboard, Network, Account', () => {
  const src = tabBarSource();
  const staffAt = src.indexOf('const STAFF_TABS');
  assert.ok(staffAt > 0, 'could not find STAFF_TABS');
  const staffBlock = src.slice(staffAt, src.indexOf('} as const', staffAt));
  for (const role of ['mentor', 'ngo', 'funder']) {
    const roleAt = staffBlock.indexOf(`${role}: [`);
    assert.ok(roleAt >= 0, `${role} is missing its own tab set`);
    const roleBlock = staffBlock.slice(roleAt, staffBlock.indexOf(']', roleAt));
    assert.match(roleBlock, /href: '\/home'/, `${role}'s first tab is not Home`);
    assert.match(roleBlock, /key: 'tabDashboard'/, `${role} has no Dashboard tab — a mentor/ngo/funder's own dashboard must be a tab, not absent (sdesk-05)`);
    assert.match(roleBlock, /href: '\/network'/, `${role} is missing the Network tab`);
    assert.match(roleBlock, /href: '\/account'/, `${role} is missing the Account tab`);
  }
});

test('student gets Home, Studies, Records, Account — not the farmer tab set', () => {
  const src = tabBarSource();
  const staffAt = src.indexOf('const STAFF_TABS');
  const studentAt = src.indexOf('student: [', staffAt);
  assert.ok(studentAt > staffAt, 'student has no dedicated tab set — it would fall back to the farmer tabs');
  const studentBlock = src.slice(studentAt, src.indexOf(']', studentAt));
  assert.match(studentBlock, /href: '\/home'/);
  assert.match(studentBlock, /key: 'tabStudies'/);
  assert.match(studentBlock, /href: '\/records'/);
  assert.match(studentBlock, /href: '\/account'/);
});

test('the farmer tab bar uses the short tabRecords label, not the two-line "My Records"', () => {
  const src = tabBarSource();
  const farmerAt = src.indexOf('const FARMER_TABS');
  assert.ok(farmerAt > 0, 'could not find FARMER_TABS');
  const farmerBlock = src.slice(farmerAt, src.indexOf(']', farmerAt));
  assert.match(farmerBlock, /key: 'tabRecords'/, 'ux-08: still wired to the long homeQuickMyRecords label, which wraps');
});

test('TabBar can step aside on desktop via hideAtDesktop', () => {
  const src = tabBarSource();
  assert.match(src, /hideAtDesktop/, 'the hideAtDesktop prop is gone');
  assert.match(src, /'flex lg:hidden'/, 'hideAtDesktop no longer hides the bar at lg+');
});

test('the tab bar label is single-line (nowrap) so it cannot sit lower than its siblings', () => {
  const src = tabBarSource();
  assert.match(src, /whiteSpace:\s*'nowrap'/, 'ux-08/zu-08: the tab label can wrap again');
});

test('AppHeader renders the same tabsForRole destinations as real desktop nav links at lg+', () => {
  const src = appHeaderSource();
  assert.match(src, /import \{ tabsForRole \} from '@\/components\/TabBar'/, 'AppHeader stopped reusing TabBar\'s tab sets');
  assert.match(src, /hidden lg:flex/, 'desk-07: the desktop nav no longer appears only at lg+');
  assert.match(src, /fontSize:\s*16/, 'desk-07 asked for 16px desktop nav links');
  assert.match(src, /fontWeight:\s*600/, 'desk-07 asked for 600-weight desktop nav links');
});

test('DashboardTabs wraps at md+ instead of chevron-scrolling, so no tab truncates on a wide frame', () => {
  const css = dashboardTabsCss();
  assert.match(css, /min-width:768px\)/, 'sdesk-04: no md+ breakpoint — the chevron-scroll strip is unchanged');
  assert.match(css, /flex-wrap:\s*wrap/, 'sdesk-04: tabs no longer wrap at md+');
});
