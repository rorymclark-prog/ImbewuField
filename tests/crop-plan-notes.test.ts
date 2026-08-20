// ── Notes Engine v2 gates ────────────────────────────────────────────────────
//
// The auto-suggest notes used to be a flat string[] rendered as one amber wall.
// Measured over 25,344 generated plans (2026-08-19 audit): median 9 notes, 90th
// percentile 23, worst 55; 35% of them one repeated per-bed rest template; and
// 46.8% of those rest notes named a month in which the SAME plan harvests that
// SAME bed. The two load-bearing vine warnings sat at positions 5-6, under
// twenty-six copies of the rest template, and the first line a farmer read was
// identical on three quarters of the farms in the country.
//
// These tests hold the shape (kind + ordering), the truth (a gap month is never
// a picking month), the reachability of the "Later this year" panel, and the
// farmer voice.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  autoSuggestPlan,
  PLAN_NOTES_PANEL_COPY,
  recomputeLaterThisYear,
  type AutoSuggestAnswers,
  type PlanNote,
  type PlanNoteKind,
} from '@/lib/crop-autosuggest';
import { cropByKey, CROPS, type RainPattern } from '@/lib/crop-catalog';
import {
  buildYearReport,
  harvestEndMonthForCrop,
  harvestMonthForCrop,
  occupiedMonthsForPlanting,
  tasksForPlan,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';
import { buildBuyingSchedule } from '@/lib/crop-export-schedule';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KIND_RANK: Record<PlanNoteKind, number> = { warning: 0, choice: 1, gap: 2, basis: 3 };

const wrapMonth = (month: number): number => ((month - 1) % 12 + 12) % 12 + 1;
/** Distance forward from `from` to `to`, wrapping at December — the ordering
 * the planner itself uses to decide which sowing month comes next. */
const monthsForward = (from: number, to: number): number => (to - from + 12) % 12;
/** The months the winter bridger exists to cover (lib/crop-autosuggest
 * WINTER_MONTHS). Mirrored here because the constant is module-private. */
const WINTER_MONTHS = [5, 6, 7, 8];

function bedsFor(bedCount: number, plotCount: number, areaM2: number): PlanBed[] {
  const beds: PlanBed[] = [];
  for (let i = 1; i <= bedCount; i++) {
    beds.push({ id: `b${i}`, label: `Bed ${i}`, areaM2, minDimM: i % 3 === 1 ? 0.8 : i % 3 === 2 ? 1.2 : 3 });
  }
  for (let i = 1; i <= plotCount; i++) {
    beds.push({ id: `p${i}`, label: `Plot ${i}`, areaM2: 90 + i * 12, minDimM: 11, kind: 'plot' });
  }
  return beds;
}

interface SweepCase {
  label: string;
  beds: PlanBed[];
  pattern: RainPattern;
  nowMonth: number;
  answers: AutoSuggestAnswers;
}

/**
 * A deliberately small but structurally representative sweep: every rainfall
 * pattern, every goal, both rhythms, farms with and without staple plots, and
 * four starting months. Sized to stay inside the unit-suite budget — the huge
 * version of this question is tests/crop-plan-stress.ts.
 */
function* sweep(): Generator<SweepCase> {
  let n = 0;
  for (const bedCount of [1, 3, 9, 14]) {
    for (const plotCount of [0, 4]) {
      for (const pattern of ['summer', 'winter', 'all-year', 'mild-frost'] as RainPattern[]) {
        for (const goal of ['family', 'commercial', 'hybrid'] as const) {
          for (const nowMonth of [1, 4, 8, 11]) {
            n++;
            const beds = bedsFor(bedCount, plotCount, [4, 9, 16][n % 3]);
            yield {
              label: `${bedCount}b/${plotCount}p ${pattern} ${goal} now=${nowMonth}`,
              beds,
              pattern,
              nowMonth,
              answers: {
                goal,
                householdSize: 'medium',
                focusCropCount: (n % 3) + 1,
                groups: [],
                cropKeys: n % 5 === 0 ? ['cabbage', 'carrots'] : undefined,
                rhythm: n % 2 === 0 ? 'steady' : 'few-big',
                rotateCrops: n % 3 !== 0,
                allowVinesInBeds: n % 4 === 0,
                allowMixedCropsInBed: n % 2 === 0,
                reliableIrrigation: true,
              },
            };
          }
        }
      }
    }
  }
}

/** Months each bed is being PICKED in, read off the annual template the same
 * way the farmer's own calendar is. */
function pickingMonthsByBed(plantings: readonly Planting[]): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const planting of plantings) {
    const crop = cropByKey(planting.cropKey);
    if (!crop || crop.timingVerified === false) continue;
    let months = out.get(planting.bedId);
    if (!months) { months = new Set(); out.set(planting.bedId, months); }
    const end = harvestEndMonthForCrop(planting.sowMonth, crop);
    let month = harvestMonthForCrop(planting.sowMonth, crop);
    for (let step = 0; step < 12; step++) {
      months.add(month);
      if (month === end) break;
      month = wrapMonth(month + 1);
    }
  }
  return out;
}

/** "Bed 1 (Aug), Bed 3 (May-Jul)" → the months claimed bare, per bed label. */
function gapMonthsByBedLabel(note: PlanNote): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const marker = 'no new sowing: ';
  const at = note.text.indexOf(marker);
  if (at < 0) return out;
  for (const match of note.text.slice(at + marker.length).matchAll(/([A-Za-z]+ \d+) \(([^)]+)\)/g)) {
    const label = match[2];
    const months: number[] = [];
    if (label === 'all year') {
      for (let m = 1; m <= 12; m++) months.push(m);
    } else {
      for (const token of label.split(/,\s*/)) {
        const [from, to] = token.split('-');
        const start = MONTHS_SHORT.indexOf(from) + 1;
        if (!start) continue;
        if (!to) { months.push(start); continue; }
        const end = MONTHS_SHORT.indexOf(to) + 1;
        let month = start;
        for (let step = 0; step < 12; step++) {
          months.push(month);
          if (month === end) break;
          month = wrapMonth(month + 1);
        }
      }
    }
    out.set(match[1], months);
  }
  return out;
}

// ── A. the contract ─────────────────────────────────────────────────────────

test('every note carries a valid kind and the array is ordered warning → choice → gap → basis', () => {
  const offenders: string[] = [];
  for (const scenario of sweep()) {
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    let previous = -1;
    for (const note of result.notes) {
      if (!(note.kind in KIND_RANK)) { offenders.push(`${scenario.label}: unknown kind ${note.kind}`); continue; }
      if (!note.text.trim()) offenders.push(`${scenario.label}: empty note text`);
      if (KIND_RANK[note.kind] < previous) {
        offenders.push(`${scenario.label}: ${note.kind} after a later kind — "${note.text.slice(0, 60)}"`);
      }
      previous = Math.max(previous, KIND_RANK[note.kind]);
    }
  }
  assert.deepEqual(offenders.slice(0, 6), [], `${offenders.length} ordering/kind violations`);
});

test('a note that names growing areas carries their ids, and every id is a real bed', () => {
  const offenders: string[] = [];
  for (const scenario of sweep()) {
    const ids = new Set(scenario.beds.map((bed) => bed.id));
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    for (const note of result.notes) {
      for (const bedId of note.bedIds ?? []) {
        if (!ids.has(bedId)) offenders.push(`${scenario.label}: note cites unknown bed ${bedId}`);
      }
      if (note.kind !== 'gap') continue;
      assert.ok(note.bedIds?.length, `a gap note must name the ground it is about: ${note.text}`);
    }
  }
  assert.deepEqual(offenders.slice(0, 6), [], `${offenders.length} notes cite a bed the farm does not have`);
});

// ── B. the collapse ─────────────────────────────────────────────────────────

test('rest notes are grouped, not one per bed — a 14-bed farm never gets a wall of them', () => {
  let worstGapNotes = 0;
  let worstTotal = 0;
  for (const scenario of sweep()) {
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    const gaps = result.notes.filter((note) => note.kind === 'gap' && note.text.includes('no new sowing'));
    // Three causes exist (another crop could; the plan is full; nothing
    // reaches), so at most three grouped notes however many beds are bare.
    assert.ok(gaps.length <= 3, `${scenario.label}: ${gaps.length} grouped rest notes, expected at most one per cause`);
    worstGapNotes = Math.max(worstGapNotes, gaps.length);
    worstTotal = Math.max(worstTotal, result.notes.length);
  }
  // Before the collapse the worst plan in this sweep class carried 55 notes.
  assert.ok(worstTotal <= 20, `the worst plan still carries ${worstTotal} notes`);
});

test('more than two winter-bridged beds become one compressed note, not one sentence each', () => {
  const result = autoSuggestPlan({
    goal: 'commercial', householdSize: 'medium', focusCropCount: 2, groups: [],
    rhythm: 'steady', rotateCrops: true, allowVinesInBeds: false,
    allowMixedCropsInBed: true, reliableIrrigation: true,
  }, 'summer', bedsFor(12, 0, 9), [], 1);
  const bridge = result.notes.filter((note) => note.text.includes('would otherwise rest all winter'));
  assert.equal(bridge.length, 1, `expected exactly one grouped winter-bridge note, got ${bridge.length}`);
  assert.match(bridge[0].text, /^\d+ growing areas would otherwise rest all winter/);
  assert.ok((bridge[0].bedIds?.length ?? 0) >= 3,
    'the grouped note must still name every bed it covers');
  // Beds sharing one crop, month and share collapse into a single clause.
  const clauses = bridge[0].text.split('; ').length;
  assert.ok(clauses < (bridge[0].bedIds?.length ?? 0),
    `identical bridges were not compressed: ${bridge[0].text}`);
});

// ── C. rest-note truth ──────────────────────────────────────────────────────

test('no gap-note month is a month the same plan is picking that same bed', () => {
  const offenders: string[] = [];
  for (const scenario of sweep()) {
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    const picking = pickingMonthsByBed(result.plantings);
    for (const note of result.notes) {
      if (note.kind !== 'gap') continue;
      // strandedBedNote carries no "no new sowing: " marker, so the month
      // parser above is structurally blind to it — and it is filed under the
      // same "Ground with no new sowing" heading. Its claim is STRONGER (the
      // bed has nothing planted at all), so check that claim directly rather
      // than leaving a whole class of gap note outside this gate.
      const stranded = /^(.+?) has nothing planted:/.exec(note.text);
      if (stranded) {
        const bed = scenario.beds.find((candidate) => candidate.label === stranded[1]);
        if (!bed) {
          offenders.push(`${scenario.label}: stranded note names unknown ${stranded[1]}`);
        } else if (result.plantings.some((planting) => planting.bedId === bed.id)) {
          offenders.push(`${scenario.label}: ${stranded[1]} is called empty while the plan plants it`);
        }
      }
      for (const [label, months] of gapMonthsByBedLabel(note)) {
        const bed = scenario.beds.find((candidate) => candidate.label === label);
        if (!bed) { offenders.push(`${scenario.label}: gap note names unknown ${label}`); continue; }
        const picked = picking.get(bed.id);
        const clash = months.filter((month) => picked?.has(month));
        if (clash.length) {
          offenders.push(`${scenario.label}: ${label} is called bare in ${clash.map((m) => MONTHS_SHORT[m - 1]).join('/')} while the plan picks it then`);
        }
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 6), [], `${offenders.length} gap notes contradict the plan's own harvests`);
});

test('a bed called "has nothing planted" really has nothing planted', () => {
  // The other half of the C gate. strandedBedNote makes the strongest gap
  // claim in the product and is filed under the same "Ground with no new
  // sowing" heading, but it carries no "no new sowing: " marker, so the month
  // parser above cannot see it. The sweep in that test produces none of these
  // notes at all (measured: 0 across its 384 plans), so this fixture — the
  // commercial-focus shape that does produce them — carries the check, with a
  // population counter so a green result cannot come from an empty sweep.
  const offenders: string[] = [];
  let strandedNotesSeen = 0;
  for (const pattern of ['summer', 'winter', 'all-year', 'mild-frost'] as RainPattern[]) {
    for (const nowMonth of [1, 4, 6, 8, 11]) {
      for (const [cropA, cropB] of [['tomatoes', 'cabbage'], ['cabbage', 'tomatoes']]) {
        const beds: PlanBed[] = [
          { id: 'b1', label: 'Bed 01', areaM2: 5, minDimM: 1.2 },
          { id: 'b2', label: 'Bed 02', areaM2: 6, minDimM: 1.2 },
          { id: 'b3', label: 'Bed 03', areaM2: 7, minDimM: 1.2 },
        ];
        const history: Planting[] = [
          { id: 'h0', bedId: 'b1', cropKey: cropA, sowMonth: 1, existing: true },
          { id: 'h1', bedId: 'b2', cropKey: cropB, sowMonth: 6, existing: true },
        ];
        const result = autoSuggestPlan({
          goal: 'commercial', focusCropCount: 2, groups: [], cropKeys: ['tomatoes', 'cabbage'],
          rhythm: 'few-big', rotateCrops: true, allowVinesInBeds: false,
          allowMixedCropsInBed: true, reliableIrrigation: true,
        }, pattern, beds, history, nowMonth);
        const where = `${pattern} now=${nowMonth} history=${cropA}/${cropB}`;
        for (const note of result.notes) {
          const stranded = /^(.+?) has nothing planted:/.exec(note.text);
          if (!stranded) continue;
          strandedNotesSeen++;
          if (note.kind !== 'gap') offenders.push(`${where}: stranded note is kind ${note.kind}`);
          const bed = beds.find((candidate) => candidate.label === stranded[1]);
          if (!bed) { offenders.push(`${where}: names unknown ${stranded[1]}`); continue; }
          const planted = result.plantings.filter((planting) => planting.bedId === bed.id);
          if (planted.length) {
            offenders.push(`${where}: ${bed.label} is called empty while the plan sows ${planted.map((p) => p.cropKey).join('/')} in it`);
          }
        }
      }
    }
  }
  assert.ok(strandedNotesSeen > 0, 'this fixture no longer produces stranded-bed notes — the gate is testing nothing');
  assert.deepEqual(offenders.slice(0, 6), [], `${offenders.length} beds are called empty by a plan that plants them`);
});

test('the gap wording says what is missing — a new sowing — and never claims the ground is idle', () => {
  const beds = bedsFor(9, 0, 9);
  const result = autoSuggestPlan({
    goal: 'family', householdSize: 'medium', groups: [], rhythm: 'steady',
    rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true,
  }, 'mild-frost', beds, [], 7);
  const gaps = result.notes.filter((note) => note.kind === 'gap');
  assert.ok(gaps.length, 'this fixture must still disclose bare stretches');
  for (const note of gaps) {
    assert.doesNotMatch(note.text, /still rests|rests in|lies idle|nothing grows/i,
      `a bed with a crop maturing on it is not resting: "${note.text}"`);
  }
});

// ── D. Later this year ──────────────────────────────────────────────────────

test('a crop chosen out of season fills the Later this year panel that could never populate before', () => {
  // Green beans have no summer-pattern sowing window in February; the next one
  // opens in September. Before this change the panel was fed by a
  // `gap > PLAN_HORIZON_MONTHS` branch that no input could reach, so it had
  // never rendered once in 26,640 generated plans.
  const beans = cropByKey('green-beans')!;
  assert.ok(!beans.sowMonths.summer.includes(2), 'fixture assumes February is outside the window');
  const result = autoSuggestPlan({
    goal: 'commercial', householdSize: 'medium', focusCropCount: 2, groups: [],
    cropKeys: ['green-beans', 'beetroot', 'swiss-chard'], rhythm: 'few-big',
    rotateCrops: false, allowVinesInBeds: false, allowMixedCropsInBed: true,
    reliableIrrigation: true,
  }, 'summer', bedsFor(3, 0, 9), [], 2);
  assert.ok(!result.plantings.some((planting) => planting.cropKey === 'green-beans'),
    'fixture assumes green beans did not make it into the plan');
  const entry = result.laterThisYear.find((later) => later.cropKey === 'green-beans');
  assert.ok(entry, `green beans must be named as waiting on its window: ${JSON.stringify(result.laterThisYear)}`);
  assert.equal(entry!.nextWindowMonth, 9, 'September is the true start of the next window');
  assert.equal(entry!.firstFitMonth, 9, 'and this plan has room for it then');
  assert.ok(beans.sowMonths.summer.includes(entry!.nextWindowMonth),
    'the named month must be one of the crop\'s own sow months');
  assert.match(entry!.text, /next sowing window opens in Sep/);
  assert.doesNotMatch(entry!.text, /nowhere to put it/,
    'nothing blocked September here, so no full-then clause belongs in the sentence');
});

test('a window blocked for SPACE is never reported as a later window — both months are said out loud', () => {
  // The 2026-08-20 blocker, as the verifier reproduced it. Beetroot's summer
  // window is Feb, Mar, Aug, Sep, Oct: it opens NEXT MONTH. Both beds are full
  // in February and March (swiss chard sown Feb, green beans sown Jan), so the
  // first draft printed "the next sowing window starts around Aug" — a space
  // rejection dressed up as the crop's own calendar.
  const beetroot = cropByKey('beetroot')!;
  const result = autoSuggestPlan({
    goal: 'family', householdSize: 'medium', groups: [],
    cropKeys: ['green-beans', 'beetroot', 'swiss-chard'], rhythm: 'few-big',
    rotateCrops: true, allowVinesInBeds: false, allowMixedCropsInBed: false,
    reliableIrrigation: true,
  }, 'summer', [
    { id: 'b1', label: 'Bed 1', areaM2: 9, minDimM: 0.8 },
    { id: 'b2', label: 'Bed 2', areaM2: 9, minDimM: 1.2 },
  ], [], 1);
  const entry = result.laterThisYear.find((later) => later.cropKey === 'beetroot');
  assert.ok(entry, `beetroot must still be named: ${JSON.stringify(result.laterThisYear)}`);
  assert.equal(entry!.nextWindowMonth, 2, 'beetroot\'s summer window opens in February, whatever the beds hold');
  assert.equal(entry!.firstFitMonth, 8, 'August is where the plan could first fit it, and that is a different fact');
  assert.ok(beetroot.sowMonths.summer.includes(2) && beetroot.sowMonths.summer.includes(8));
  // The sentence must carry BOTH, and must not present August as the window.
  assert.match(entry!.text, /next sowing window opens in Feb/);
  assert.match(entry!.text, /nowhere to put it that month/);
  assert.match(entry!.text, /fit into is Aug/);
  assert.doesNotMatch(entry!.text, /window opens in Aug|window starts around Aug/);
  // And the panel's own subtitle must not promise room the plan does not have.
  assert.doesNotMatch(PLAN_NOTES_PANEL_COPY.laterSubtitle, /there is room|room for (each|them|all)/i);
});

test('a chosen crop that actually got planted never appears in Later this year', () => {
  const offenders: string[] = [];
  for (const scenario of sweep()) {
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    const planted = new Set(result.plantings.map((planting) => planting.cropKey));
    for (const later of result.laterThisYear) {
      if (planted.has(later.cropKey)) offenders.push(`${scenario.label}: ${later.cropKey} is both planted and "later"`);
      const crop = CROPS.find((candidate) => candidate.key === later.cropKey);
      if (!crop) { offenders.push(`${scenario.label}: unknown crop ${later.cropKey}`); continue; }
      // It must be a TIMING story about a real month of the crop's window.
      // (A window CONTAINING the current month is allowed since the
      // 2026-08-20 open-now fix — but only when the plan has no room this
      // month, checked in the sentence branch below.)
      const window = crop.sowMonths[scenario.pattern];
      if (!window.includes(later.nextWindowMonth)) {
        offenders.push(`${scenario.label}: ${later.cropKey} points at a month outside its own window`);
      }
      if (!window.includes(later.firstFitMonth)) {
        offenders.push(`${scenario.label}: ${later.cropKey} would be fitted in a month outside its own window`);
      }
      // MEMBERSHIP IS NOT ENOUGH — the blocker this gate missed the first time.
      // The month printed as "the next sowing window" must be the window's own
      // START, not simply some month of it that happened to have room.
      const trueStart = [...window]
        .sort((a, b) => monthsForward(scenario.nowMonth, a) - monthsForward(scenario.nowMonth, b))[0];
      if (later.nextWindowMonth !== trueStart) {
        offenders.push(`${scenario.label}: ${later.cropKey} calls ${MONTHS_SHORT[later.nextWindowMonth - 1]} the next window when it opens in ${MONTHS_SHORT[trueStart - 1]}`);
      }
      if (monthsForward(scenario.nowMonth, later.firstFitMonth)
        < monthsForward(scenario.nowMonth, later.nextWindowMonth)) {
        offenders.push(`${scenario.label}: ${later.cropKey} fits before its window opens`);
      }
      // ...and the printed sentence must be either the true window alone, or
      // the true window WITH the reason a later month is the real chance.
      const opens = MONTHS_SHORT[later.nextWindowMonth - 1];
      const fits = MONTHS_SHORT[later.firstFitMonth - 1];
      if (later.nextWindowMonth === scenario.nowMonth) {
        // The window is open RIGHT NOW. Only the blocked form may appear —
        // an entry with room this month would contradict the plan that just
        // declined to place the crop, so the producer must have skipped it.
        if (later.firstFitMonth === scenario.nowMonth) {
          offenders.push(`${scenario.label}: ${later.cropKey} claims to be waiting while the plan has room right now`);
        }
        if (!/sowing window is open right now/.test(later.text) || !later.text.includes(`nowhere to put it until ${fits}`)) {
          offenders.push(`${scenario.label}: ${later.cropKey} open-now sentence must carry both facts: "${later.text}"`);
        }
      } else if (!later.text.includes(`next sowing window opens in ${opens}`)) {
        offenders.push(`${scenario.label}: ${later.cropKey} sentence does not name the true window month ${opens}: "${later.text}"`);
      } else if (later.firstFitMonth === later.nextWindowMonth) {
        if (/nowhere to put it|could still fit into/.test(later.text)) {
          offenders.push(`${scenario.label}: ${later.cropKey} explains away a block that did not happen: "${later.text}"`);
        }
      } else {
        if (!/nowhere to put it that month/.test(later.text) || !later.text.includes(`fit into is ${fits}`)) {
          offenders.push(`${scenario.label}: ${later.cropKey} hides that ${opens} is blocked and ${fits} is the real chance: "${later.text}"`);
        }
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 6), [], `${offenders.length} dishonest Later-this-year entries`);
});

test('a crop whose window is open RIGHT NOW but has no room is reported, not silently dropped', () => {
  // The 2026-08-20 gap: the old producer skipped any crop whose window
  // contained the current month, so a farmer generating in August was never
  // told that peas (window open in August) had nowhere to go until February —
  // the crop just vanished from both the plan and the panel.
  const peas = cropByKey('peas')!;
  assert.deepEqual(peas.sowMonths.summer, [2, 3, 8], 'fixture assumes the Aug window with Feb/Mar as the wrap-around fits');
  const answers: AutoSuggestAnswers = {
    goal: 'family', householdSize: 'medium', groups: [],
    cropKeys: ['peas'], rhythm: 'few-big',
    rotateCrops: false, allowVinesInBeds: false, allowMixedCropsInBed: false,
    reliableIrrigation: true,
  };
  const beds: PlanBed[] = [{ id: 'b1', label: 'Bed 1', areaM2: 9, minDimM: 1.2 }];
  // Swiss chard sown July holds the only bed Jul-Dec (2 months to maturity,
  // 3 picking months, +1), so August is full while Jan-Jun stay free.
  const proposed: Planting[] = [{ id: 'p1', bedId: 'b1', cropKey: 'swiss-chard', sowMonth: 7 }];
  const entries = recomputeLaterThisYear(answers, 'summer', beds, proposed, [], 8);
  const entry = entries.find((later) => later.cropKey === 'peas');
  assert.ok(entry, `peas must appear even though its window contains August: ${JSON.stringify(entries)}`);
  assert.equal(entry!.nextWindowMonth, 8, 'the window that matters is the one open right now');
  assert.equal(entry!.firstFitMonth, 2, 'February is the first month of its window with room — a WRAP past December');
  assert.match(entry!.text, /sowing window is open right now/);
  assert.match(entry!.text, /nowhere to put it until Feb/);
  assert.doesNotMatch(entry!.text, /next sowing window opens/,
    'an open window must never be narrated as a future one');
});

test('recomputeLaterThisYear rebuilds exactly what autoSuggestPlan reported', () => {
  // The ideal-year feature re-derives the waiting panel at the REAL current
  // month after planning from a different anchor. That is only honest if the
  // standalone recompute agrees byte-for-byte with the engine's own output
  // whenever it is fed the same inputs back.
  let compared = 0;
  for (const scenario of sweep()) {
    if (!scenario.answers.cropKeys?.length) continue; // panel is explicit-crops-only
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    const recomputed = recomputeLaterThisYear(
      scenario.answers, scenario.pattern, scenario.beds, result.plantings, [], scenario.nowMonth,
    );
    assert.deepEqual(recomputed, result.laterThisYear, `${scenario.label}: recompute disagrees with the engine`);
    compared++;
  }
  assert.ok(compared >= 20, `the sweep must actually exercise this (${compared} explicit-crop scenarios)`);
});

// ── E. the bridge clause ────────────────────────────────────────────────────

/**
 * Is every winter month of this bed fully spoken for by the finished plan?
 *
 * Read off the plantings themselves — area fractions summed over the annual
 * template — so the answer is a fact about the ground, not about how the note
 * happened to be phrased.
 */
function bedIsFullEveryWinterMonth(bedId: string, plantings: readonly Planting[]): boolean {
  const occupied = new Map<number, number>();
  for (const planting of plantings) {
    if (planting.bedId !== bedId) continue;
    for (const month of occupiedMonthsForPlanting(planting)) {
      occupied.set(month, (occupied.get(month) ?? 0) + (planting.areaFraction ?? 1));
    }
  }
  return WINTER_MONTHS.every((month) => (occupied.get(month) ?? 0) >= 0.999);
}

/**
 * Does this sentence tell the farmer something else can still go in beside the
 * crop? Broad on the promise side (any wording that offers space) and narrow on
 * the denial side, so a rephrasing has to get MORE explicit to pass, not less.
 */
function promisesRoomAlongside(text: string): boolean {
  const promise = /\balongside\b|\broom\b|\bspace for\b|\broom for\b|\bstill fits?\b/i.test(text);
  const denial = /\bno room\b|\bnothing else can be sown\b|\bno other sowing\b/i.test(text);
  return promise && !denial;
}

test('a winter crop taking the whole area never promises room for sowings alongside', () => {
  // SEMANTIC, not wording-locked. The first version of this gate recognised a
  // whole-area bridge only by the FIXED sentences the fix introduced, so
  // reinstating origin/main's "leaving room for winter sowings alongside"
  // clause left it 12/12 green over 153 real whole-area bridges. The question
  // it asks now is the farmer's own: for the beds this note is about, does the
  // plan actually leave any area free in winter — and if not, does the note
  // still promise some?
  const offenders: string[] = [];
  let fullAreaBridges = 0;
  for (const scenario of sweep()) {
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    for (const note of result.notes) {
      if (!note.text.includes('would otherwise rest all winter')) continue;
      const bedIds = note.bedIds ?? [];
      const full = bedIds.filter((bedId) => bedIsFullEveryWinterMonth(bedId, result.plantings));
      fullAreaBridges += full.length;
      // A promise of space beside the bridge is allowed only if EVERY bed the
      // note covers actually has some area free in every winter month of the
      // finished plan. One full bed is enough to make the sentence false for
      // the farmer standing in front of it.
      if (full.length && promisesRoomAlongside(note.text)) {
        offenders.push(`${scenario.label}: ${full.length}/${bedIds.length} bed(s) full every winter month — "${note.text.slice(0, 150)}"`);
      }
    }
  }
  // Guards the gate against going vacuous if the bridger stops taking whole
  // beds: the population it is written for must actually exist in the sweep.
  assert.ok(fullAreaBridges >= 50, `only ${fullAreaBridges} whole-area winter bridges in the sweep — this gate is no longer testing anything`);
  assert.deepEqual(offenders.slice(0, 4), [], `${offenders.length} winter bridges promise room they took`);
});

// ── F. farmer voice ─────────────────────────────────────────────────────────

const BANNED_TERMS = [
  'automatic layout',
  'occupancy',
  'planning basis',
  'timing flag',
  'final plant positions',
  'Auto-suggest',
];

test('no farmer-visible string leaks engine vocabulary', () => {
  const offenders: string[] = [];
  const check = (where: string, text: string): void => {
    for (const term of BANNED_TERMS) {
      if (text.includes(term)) offenders.push(`${where} — "${term}" in: ${text.slice(0, 110)}`);
    }
  };
  for (const scenario of sweep()) {
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    for (const note of result.notes) check(`${scenario.label} note`, note.text);
    for (const paragraph of buildYearReport(result.plantings, scenario.beds)) {
      check(`${scenario.label} report`, paragraph);
    }
    for (const task of tasksForPlan(result.plantings, scenario.beds)) {
      if (task.prepText) check(`${scenario.label} task`, task.prepText);
    }
    for (const month of buildBuyingSchedule(result.plantings, scenario.beds, scenario.nowMonth)) {
      for (const item of month.items) check(`${scenario.label} buying`, item.note);
    }
    for (const later of result.laterThisYear) check(`${scenario.label} later`, later.text);
  }
  // The panel headings and subtitle the review screen wraps around all of the
  // above. They used to be hardcoded in page.tsx, where no test could read
  // them — which is how a subtitle promising room the plan did not have got
  // past a review whose whole subject was truthfulness.
  for (const [key, text] of Object.entries(PLAN_NOTES_PANEL_COPY)) check(`panel copy ${key}`, text);
  assert.deepEqual(offenders.slice(0, 6), [], `${offenders.length} farmer-visible strings still use engine vocabulary`);
});

test('the Later this year panel copy makes no promise the entries below it may break', () => {
  // Every sentence in this panel must hold for EVERY entry that can reach it,
  // including a crop whose window opens into a plan with no space that month.
  assert.doesNotMatch(PLAN_NOTES_PANEL_COPY.laterSubtitle, /there is room|room for (each|them|all)|when its window opens/i,
    'the subtitle cannot promise room: entries with a blocked window month render under it');
  assert.match(PLAN_NOTES_PANEL_COPY.laterSubtitle, /does not sow yet/,
    'it must still say what the panel is');
  for (const [key, text] of Object.entries(PLAN_NOTES_PANEL_COPY)) {
    assert.ok(text.trim().length > 0, `${key} must not be blank`);
  }
});

// ── G. the boilerplate demotion ─────────────────────────────────────────────

test('the two universal disclaimers are basis, so they are never the first thing a farmer reads', () => {
  for (const scenario of sweep()) {
    const result = autoSuggestPlan(scenario.answers, scenario.pattern, scenario.beds, [], scenario.nowMonth);
    for (const note of result.notes) {
      if (/How many people you feed is not used/.test(note.text)
        || /have a common evidence basis/.test(note.text)
        || /missing kilograms are never invented/.test(note.text)) {
        assert.equal(note.kind, 'basis', `a farm-independent disclaimer must be 'basis': "${note.text.slice(0, 70)}"`);
      }
    }
    const first = result.notes[0];
    if (!first) continue;
    assert.notEqual(first.kind, 'basis',
      `${scenario.label}: the plan opens with a methodology note — "${first.text.slice(0, 70)}"`);
  }
});

test('the out-of-KZN calendar caveat leads with the action and stays prominent', () => {
  const result = autoSuggestPlan({
    goal: 'family', householdSize: 'medium', groups: [], rhythm: 'steady',
    rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true,
  }, 'summer', bedsFor(3, 0, 9), [], 3);
  const caveat = result.notes.find((note) => /extension officer/.test(note.text));
  assert.ok(caveat, `the regional caveat must still be raised: ${JSON.stringify(result.notes)}`);
  assert.equal(caveat!.kind, 'warning', 'it is actionable, so it must not be demoted to basis');
  assert.match(caveat!.text, /^Check each sowing month/, 'the action must come first');
  assert.doesNotMatch(caveat!.text, /primary-source audit|crop-by-crop KZN warm/,
    'the provenance wording was the part a farmer could not act on');

  // ...and it is absent where it does not apply.
  const kzn = autoSuggestPlan({
    goal: 'family', householdSize: 'medium', groups: [], rhythm: 'steady',
    rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true,
  }, 'mild-frost', bedsFor(3, 0, 9), [], 3);
  assert.ok(!kzn.notes.some((note) => /extension officer/.test(note.text)),
    'the audited calendar must not carry the caveat');
});
