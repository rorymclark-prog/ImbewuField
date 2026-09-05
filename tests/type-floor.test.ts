import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// "A third of the app's type is set below 12px." — the Gogo Test audit, 27 August, run against
// an isiZulu-speaking KZN smallholder on a hand-me-down Android at 375 × 812.
//
// 584 of 1,632 font-size declarations were under 12px, the smallest at 7.5px. Past about
// forty-five, 10px grey-on-cream is not small — it is gone. The audit's own fairness applies:
// most of the tiny type is in the facilitator, design-studio and NGO tools, where the reader is
// younger and sitting at a laptop. Her four screens are the better part of the app. But the home
// tile subtitles she needs to tell Journal from My Records from Finance were among the small ones,
// and so was the tab-bar label under every screen.
//
// This file is the guard, modelled on tests/tap-targets.test.ts — a source-shape test that fails
// when someone shrinks something a farmer has to read.
//
// TWO REGISTERS, AND NEITHER IS AN EXEMPTION.
//
//   FARMER_SURFACES — floor of 12px, budget zero. Anything she reads to navigate, to find her own
//   numbers, or to record something. No sub-12 declaration may exist here at all.
//
//   EXPERT_SURFACES — a RATCHET, not a pass. Each file carries the count of sub-12 declarations it
//   had when this test was written. The count is asserted EXACTLY: adding one fails, and so does
//   removing one without lowering the number. A blanket exemption would let these files quietly
//   get worse forever and would let a fix go unrecorded; a ratchet cannot. The numbers are meant
//   to come down, and every one of them is a line of work still owed.
//
// The third test is the one that actually stops the regression: every .tsx reachable from the
// routes below must appear in exactly one register. Drop a new component onto /home and this
// file fails until someone has decided, in writing, which kind of screen it is.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const FLOOR = 12;

// /finances is still listed even though the Picked · Sold · Spent merge left it a thin
// server-side redirect onto /records: it is a route a farmer still reaches (an installed PWA's
// old tab, a bookmark, the Journal's link), so if anyone ever puts markup back on it, the floor
// should apply from the first line rather than from whenever someone remembers this file.
const ROUTES = [
  'app/home/page.tsx',
  'app/records/page.tsx',
  'app/finances/page.tsx',
  'app/farmer/page.tsx',
];

// The NGO, funder and public-showcase routes — added 29 August after the same audit found
// /funder and /ngo permanently mounting components/NgoDashboard.tsx (PR #371) with two live
// sub-floor lines, and /partners uncovered entirely. Walked into the SAME reachable() sweep as
// the farmer routes above, so nothing they mount goes unclassified either — but the reader here
// is an NGO coordinator, a funder or a prospective partner, at a laptop far more often than not,
// the same "expert" audience tests/type-floor.test.ts already carves out for components/Map.tsx
// and components/DataPanel.tsx, not the phone-literacy-constrained farmer FARMER_SURFACES exists
// to protect. That is why everything newly reachable ONLY from these three lands in
// EXPERT_SURFACES below, never FARMER_SURFACES — audited (they are opened on phones too, and
// this whole file exists because 375×812 is where tiny type disappears), but ratcheted, not
// held to a zero floor.
const STAFF_ROUTES = [
  'app/funder/page.tsx',
  'app/ngo/page.tsx',
  'app/partners/page.tsx',
];

/** Files whose type she reads. Floor of 12px, no allowance. */
const FARMER_SURFACES: Record<string, string> = {
  'components/DashboardTabs.tsx': 'touch and keyboard navigation across staff sections',
  'components/SampleProgramme.tsx': 'NGO and funder sample analysis and access controls',
  'components/AreaReturnCards.tsx': 'farmers compare the recorded return from their growing space',
  'components/ProductionAreas.tsx': 'staff record and read checked production areas',
  'components/MelDashboard.tsx': 'farmer assessment forms and NGO analysis',
  'components/funder/FunderAssessments.tsx': 'approved assessment summaries',
  'app/home/page.tsx': 'the first screen, and the tile subtitles the audit was about',
  'app/records/page.tsx': 'the money book — Picked, Sold, Spent, and the charts inside it',
  'app/finances/page.tsx': 'the old money door, now a redirect onto the book — it must stay empty of type',
  'app/farmer/page.tsx': 'her own farm',
  'components/TabBar.tsx': 'the four labels under every single screen',
  'components/NavDrawer.tsx': 'the menu',
  'components/MyRecords.tsx': 'the records list itself',
  'components/FinanceGraphs.tsx': 'picked and sold, in her own numbers',
  'components/CashflowChart.tsx': 'in and out, in her own numbers',
  'components/HarvestReconciliation.tsx': 'picked against sold — the arithmetic she is checking',
  'components/ComingUpHarvests.tsx': 'what is ready soon',
  'components/WeatherWidget.tsx': 'the rain, on the home screen',
  'components/RainfallChart.tsx': 'the rain again, with its axis',
  'components/WaterBalance.tsx': 'whether the water lasts',
  'components/NextStepCoach.tsx': 'the one thing to do next',
  'components/LifeGuide.tsx': 'when to sow and when to pick',
  'components/home/HomeHeroCard.tsx': 'the card at the top of the first screen',
  'components/AddSheet.tsx': 'the sheet she records into',
  'components/PhotoUpload.tsx': 'adding a photo',
  'components/ProfileSheet.tsx': 'her own account',
  'components/ThemePanel.tsx': 'language and text size — the last place that may be unreadable',
  'components/design/LessonLink.tsx': 'the "Learn" button in the /finances and /home headers — farmer chrome, '
    + 'despite living under design/. The deployed build settled this: it renders in her header.',
  'components/LimaBar.tsx': 'the help she is offered',
  'components/ChatPanel.tsx': 'the answer she is given',
  'components/EmptyState.tsx': 'what a screen says when it has nothing yet',
  'components/AppConfirm.tsx': 'a yes/no she cannot afford to misread',
  'components/CropSelect.tsx': 'choosing what she planted',
  'components/CropIcon.tsx': 'the crop label beside it',
  'components/SpeakButton.tsx': 'the read-aloud control — the fallback for not reading at all',
  'components/LangSwitcher.tsx': 'changing language',
  'components/AccountButton.tsx': 'chrome she taps',
  'components/MenuButton.tsx': 'chrome she taps',
  'components/SettingsButton.tsx': 'chrome she taps',
  'components/BackButton.tsx': 'chrome she taps',
  'components/BackControl.tsx': 'chrome she taps',
  'components/BrandLogo.tsx': 'chrome she looks at',
  'components/Illustration.tsx': 'chrome she looks at',
  'components/ChartBreakMark.tsx': 'the mark that says a bar was drawn short',
  'components/SavedPlaces.tsx': 'the names she gave her own land',
  'components/PeoplePanel.tsx': 'the people on her farm',
  'lib/auth.tsx': 'renders sign-in state',
  'lib/i18n.tsx': 'the language provider',
  'lib/theme.tsx': 'the theme provider',
};

/**
 * A ratchet, not a pass. `budget` is the number of sub-12px declarations the file had on
 * 27 August 2026. It is asserted exactly, so it can only ever be edited downwards on purpose.
 */
const EXPERT_SURFACES: Record<string, { reason: string; budget: number }> = {
  'components/Map.tsx': {
    reason: 'the map toolbar — layer toggles, ruler ticks, draw-mode chrome. The two labels a '
      + 'farmer actually taps are 12px and 13px already and are guarded by tap-targets.test.ts.',
    budget: 23,
  },
  'components/DataPanel.tsx': {
    reason: 'the site analysis panel — dense climate and soil figures read at a laptop',
    budget: 33,
  },
  'components/SiteSurveySheet.tsx': {
    reason: 'the facilitator survey, filled in by a field officer',
    budget: 11,
  },
  'components/ReportView.tsx': {
    reason: 'screen report captions are now at least 12px; PDF type is handled separately',
    budget: 0,
  },
  'components/report/CompletionScore.tsx': {
    reason: 'the report scorecard, same print scale',
    budget: 3,
  },
  'components/design/LessonPanel.tsx': { reason: 'design studio, laptop tool', budget: 3 },
  'components/AreaPanel.tsx': { reason: 'the drawing tool\'s measurement readout', budget: 0 },
  'components/InsightsPanel.tsx': { reason: 'the analysis side panel', budget: 0 },
  'components/EvidenceCatalogue.tsx': { reason: 'the NGO evidence library', budget: 0 },
  'components/EvidenceSheet.tsx': { reason: 'the NGO evidence library', budget: 0 },
  'components/SiteDesign.tsx': { reason: 'the design surface', budget: 0 },
  'components/SiteManageMenu.tsx': { reason: 'site administration', budget: 0 },
  'components/RoleSwitcher.tsx': { reason: 'an operator control, not a farmer one', budget: 0 },
  'components/report/SavedReportsList.tsx': { reason: 'the report shelf', budget: 0 },

  // STAFF_ROUTES — /funder, /ngo, /partners. See that const's own comment for why these land
  // here and not in FARMER_SURFACES.
  'app/funder/page.tsx': { reason: 'the funder dashboard shell — a funder at a laptop', budget: 0 },
  'app/ngo/page.tsx': { reason: 'the NGO dashboard shell — a coordinator at a laptop', budget: 0 },
  'app/partners/page.tsx': {
    reason: 'the public showcase for NGOs and funders, deliberately outside the farmer app shell '
      + '(no auth check, not linked from TabBar or NavDrawer)',
    budget: 0,
  },
  'components/NgoDashboard.tsx': {
    reason: 'the NGO/funder gardens-and-gardeners dashboard (PR #371). Its two sub-floor lines '
      + '(the produce-photo crop-name label, the 26px avatar initials) were fixed outright rather '
      + 'than budgeted, so this starts at zero — any new one here is a genuine regression.',
    budget: 0,
  },
  'components/funder/CohortDashboard.tsx': { reason: 'the funder cohort dashboard', budget: 0 },
  'components/funder/CohortCharts.tsx': { reason: 'the funder cohort charts', budget: 0 },
  'components/network/FarmerPanel.tsx': {
    reason: 'a funder/NGO\'s drill-down into one farmer\'s record, reached from the cohort '
      + 'dashboard — dense metrics read at a laptop by staff, not the farmer\'s own screen. '
      + 'Pre-existing debt, not fixed here: out of this change\'s scope.',
    budget: 39,
  },
  'components/partners/Screenshot.tsx': {
    reason: 'a captioned screenshot tile on the public /partners showcase',
    budget: 0,
  },
  'components/ContactInbox.tsx': {
    reason: 'the mentor/org side of the farmer contact inbox, mounted on /ngo — staff reading and '
      + 'replying, not the farmer\'s own /contact screen',
    budget: 2,
  },
};

const source = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

/** Resolve a `@/…` or relative import to a repo-relative file, or null if it is a package. */
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(path.join(ROOT, fromFile)), spec);
  else return null;
  for (const c of [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (existsSync(c)) return path.relative(ROOT, c);
  }
  return null;
}

/** Every file reachable from the farmer routes or the staff routes, static imports and dynamic alike. */
function reachable(): string[] {
  const seen = new Set<string>();
  const queue = [...ROUTES, ...STAFF_ROUTES];
  while (queue.length) {
    const f = queue.shift() as string;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = source(f);
    const specs = [...src.matchAll(/from\s+'([^']+)'/g), ...src.matchAll(/import\(\s*'([^']+)'/g)];
    for (const m of specs) {
      const r = resolveImport(m[1], f);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return [...seen].sort();
}

type Small = { line: number; px: number; text: string };

/**
 * SVG font-size ATTRIBUTES, counted apart from DOM type.
 *
 * `fontSize="7"` on a <text> inside a chart is a different animal from `style={{ fontSize: 7 }}`,
 * and this test was blind to it on its first run — the source scan reported a clean sweep while
 * the deployed /finances at 375px still had 32 labels rendering at 6–7px. Measured in the browser,
 * not inferred. LOOK AT THE SCREEN.
 *
 * They are not fixed here because the fix is not a number. The axis lives in a 320-unit-wide
 * viewBox with a 28–34 unit gutter: "−R6.3k" at 12px needs ~45 units, and twelve month labels at
 * 12px need ~260 of the ~262 units the plot has, so they would collide. Making these legible means
 * widening the gutter and labelling every third month — a chart change worth looking at, not
 * worth guessing at.
 *
 * So they are COUNTED. Exactly, like every other ratchet here. They cannot grow, they cannot be
 * forgotten, and the day someone lays the axes out properly this table goes to zero.
 */
const CHART_AXIS_DEBT: Record<string, { reason: string; budget: number }> = {
  'components/FinanceGraphs.tsx': { reason: 'picked/sold y-ticks and month labels', budget: 3 },
  'components/CashflowChart.tsx': { reason: 'in/out ticks, running-total ticks, month + year', budget: 7 },
  'components/WaterBalance.tsx': { reason: 'the water chart\'s own axis', budget: 2 },
};

const DOM_SIZE = [
  /text-\[(\d+(?:\.\d+)?)px\]/g,                          // text-[10px]
  /fontSize:\s*'?"?(\d+(?:\.\d+)?)(?:px)?'?"?/g,           // style={{ fontSize: 10 }}
] as const;
const SVG_ATTR_SIZE = /fontSize=(?:"(\d+(?:\.\d+)?)"|\{(\d+(?:\.\d+)?)\})/g;

/** Font-size declarations under the floor. `kind` picks DOM styling or SVG attributes. */
function belowFloor(rel: string, kind: 'dom' | 'svg'): Small[] {
  assert.ok(
    existsSync(path.join(ROOT, rel)),
    `${rel} is listed in a register but does not exist. Remove it — a classification pointing at `
    + 'nothing protects nothing.',
  );
  const out: Small[] = [];
  source(rel).split('\n').forEach((line, i) => {
    const add = (px: number) => {
      if (px < FLOOR) out.push({ line: i + 1, px, text: line.trim().slice(0, 100) });
    };
    if (kind === 'dom') {
      for (const re of DOM_SIZE) for (const m of line.matchAll(re)) add(Number(m[1]));
      for (const m of line.matchAll(/text-\[(\d*\.?\d+)rem\]/g)) add(Number(m[1]) * 16);
    } else {
      for (const m of line.matchAll(SVG_ATTR_SIZE)) add(Number(m[1] ?? m[2]));
    }
  });
  return out;
}

const all = (rel: string) => [...belowFloor(rel, 'dom'), ...belowFloor(rel, 'svg')];

const report = (rel: string, small: Small[]) =>
  small.map((s) => `\n    ${rel}:${s.line}  ${s.px}px  ${s.text}`).join('');

test('nothing a farmer has to read is set below 12px', () => {
  const failures: string[] = [];
  for (const [rel, why] of Object.entries(FARMER_SURFACES)) {
    const small = belowFloor(rel, 'dom');
    if (small.length) failures.push(`\n  ${rel} — ${why}${report(rel, small)}`);
  }
  assert.equal(
    failures.length, 0,
    `${failures.length} farmer surface(s) set type below ${FLOOR}px. Past about forty-five this `
    + `is not small, it is gone:${failures.join('')}\n`,
  );
});

test('the chart axes she cannot read are counted, not overlooked', () => {
  // Exact, both directions — the same ratchet as the expert tools. These are the 6–8px labels the
  // browser found on the deployed /finances while the source scan said the sweep was clean.
  for (const [rel, { reason, budget }] of Object.entries(CHART_AXIS_DEBT)) {
    const found = belowFloor(rel, 'svg').length;
    assert.ok(
      found <= budget,
      `${rel} (${reason}) now draws ${found} axis labels under ${FLOOR}px, up from ${budget}. `
      + `Her money screen does not need more type she cannot read:${report(rel, belowFloor(rel, 'svg'))}\n`,
    );
    assert.equal(
      found, budget,
      `${rel} is down to ${found} sub-${FLOOR}px axis labels from ${budget}. Lower its budget in `
      + 'CHART_AXIS_DEBT to lock that in.',
    );
  }
  // A farmer file that starts drawing SVG text without declaring the debt is the real leak: the
  // DOM check above would pass it, and nobody would be looking at the chart.
  const undeclared = Object.keys(FARMER_SURFACES)
    .filter((rel) => !(rel in CHART_AXIS_DEBT) && belowFloor(rel, 'svg').length > 0);
  assert.deepEqual(
    undeclared, [],
    `${undeclared.length} farmer surface(s) draw sub-${FLOOR}px SVG text without an entry in `
    + `CHART_AXIS_DEBT:\n    ${undeclared.join('\n    ')}\n`,
  );
});

test('the expert tools cannot get worse, and a fix cannot go unrecorded', () => {
  // Exact equality in BOTH directions, the same shape as tests/nav-role-filtering.test.ts. Over
  // budget means someone added tiny type. Under budget means someone fixed some and left the
  // ratchet where it was — which would leave room for a future regression to slip in unseen.
  for (const [rel, { reason, budget }] of Object.entries(EXPERT_SURFACES)) {
    const found = all(rel).length;
    assert.ok(
      found <= budget,
      `${rel} (${reason}) now has ${found} declarations under ${FLOOR}px, up from ${budget}. `
      + `The ratchet only turns one way:${report(rel, all(rel))}\n`,
    );
    assert.equal(
      found, budget,
      `${rel} is down to ${found} sub-${FLOOR}px declarations from ${budget} — good. Lower its `
      + 'budget in EXPERT_SURFACES to lock the win in, or the room you just made stays open.',
    );
  }
});

test('every screen reachable from a farmer or staff route has been classified', () => {
  // The regression this whole file exists to stop: a new component lands on /home (or /funder,
  // /ngo, /partners), nobody thinks about type size, and the floor quietly applies to one file
  // fewer than it used to.
  const known = new Set<string>([...Object.keys(FARMER_SURFACES), ...Object.keys(EXPERT_SURFACES)]);
  const seen = reachable().filter((f) => f.endsWith('.tsx'));

  const unclassified = seen.filter((f) => !known.has(f));
  assert.deepEqual(
    unclassified, [],
    `${unclassified.length} file(s) render on a farmer or staff route but are in neither register. `
    + 'Add each to FARMER_SURFACES (floor of 12px) or to EXPERT_SURFACES with its current count '
    + `and a reason:\n    ${unclassified.join('\n    ')}\n`,
  );

  const stale = [...known].filter((f) => !seen.includes(f));
  assert.deepEqual(
    stale, [],
    `${stale.length} classified file(s) no longer render on any farmer or staff route. Remove `
    + `them, or the registers drift into fiction:\n    ${stale.join('\n    ')}\n`,
  );

  const both = Object.keys(FARMER_SURFACES).filter((f) => f in EXPERT_SURFACES);
  assert.deepEqual(both, [], `classified twice, with opposite meanings: ${both.join(', ')}`);
});

test('the floor cannot be undercut by a named Tailwind size', () => {
  // `text-xs` is 12px and sits exactly on the floor. The escape hatch is a custom smaller step in
  // the config — `text-2xs` at 10px would sail past every check above, because the number would
  // live in the config rather than in the markup.
  const config = source('tailwind.config.ts');
  const block = config.match(/fontSize:\s*\{([\s\S]*?)\n\s{6}\}/);
  if (!block) return; // no custom scale at all, which is the state this was written in
  for (const m of block[1].matchAll(/(\d+(?:\.\d+)?)(px|rem)/g)) {
    const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
    assert.ok(
      px >= FLOOR,
      `tailwind.config.ts declares a ${px}px font size. A named step below ${FLOOR}px puts the `
      + 'number out of reach of every check in this file.',
    );
  }
});
