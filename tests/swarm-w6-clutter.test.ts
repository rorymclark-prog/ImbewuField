import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// "Less clutter for farmers" (swarm/w6-clutter) — audit leftovers, round 2. Source-text guards
// in the style of tests/home-next-step-links.test.ts: these screens are not pure functions of
// exported data, so the guard reads the real shipped file and pins the wiring a farmer would
// actually see.
//
// Four of the six tasks handed to this track (learning-10's Standard/Higher offline-quality
// picker split aside — see below) were already fixed by earlier waves and are pinned by their
// own existing test files:
//   - platform-08 (app/offline/page.tsx debug affordances)  — tests/offline-simple-mode.test.ts
//   - money-11    (app/invoice/page.tsx advanced disclosures) — tests/invoice-simple-mode.test.ts
//   - money-10    (app/records/page.tsx "Crop performance")  — tests/records-simple.test.ts
//     (fixed via a broader mechanism: the whole Charts tab that houses the per-crop table is
//     hidden from Simple outright, and Simple gets a farm-wide SimpleMoneySummary money card
//     instead of a crop-by-crop one — same end result, farmers never see the per-m² table, no
//     redundant per-card fix needed)
// This file adds the two genuinely-not-yet-fixed items: learning-09/learning-10 (which were
// gated on Simple/All tools alone, so a student — who defaults to All tools, lib/app-level-core.ts
// — would still see staff-only content) and crops-05 (the Planting Calendar nav row was still in
// Simple's allow-list).

const STUDENT_SOURCE = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8');
const OFFLINE_DOWNLOAD_SOURCE = readFileSync(new URL('../components/course/OfflineDownload.tsx', import.meta.url), 'utf8');
const APP_LEVEL_CORE_SOURCE = readFileSync(new URL('../lib/app-level-core.ts', import.meta.url), 'utf8');
const NAV_DRAWER_SOURCE = readFileSync(new URL('../components/NavDrawer.tsx', import.meta.url), 'utf8');

test('isStaffRole exists and recognises exactly the four staff roles', () => {
  assert.match(APP_LEVEL_CORE_SOURCE, /export function isStaffRole\(role: string \| null \| undefined\): boolean/);
  const staffSetBlock = APP_LEVEL_CORE_SOURCE.match(/const STAFF_ROLES = new Set\(\[([^\]]*)\]\);/);
  assert.ok(staffSetBlock, 'STAFF_ROLES set is missing');
  for (const role of ['mentor', 'ngo', 'funder', 'admin']) {
    assert.match(staffSetBlock![1], new RegExp(`'${role}'`), `${role} must be a staff role`);
  }
  assert.doesNotMatch(staffSetBlock![1], /'farmer'|'student'/, 'farmer and student must never be staff roles');
});

// learning-09 ─────────────────────────────────────────────────────────────────────────────────

test('learning-09: the production-readiness badge is gated on Simple AND staff role, not Simple alone', () => {
  // Gating on !simple alone left it visible to any student browsing in their All-tools default
  // (lib/app-level-core.ts: only 'farmer' and null default to Simple) — this is content-QA info
  // about the course itself, not a farmer or student decision, per CLAUDE.md's staff-only rule.
  assert.match(STUDENT_SOURCE, /const isStaff = isStaffRole\(gatingCtx\.role\);/);
  const badge = STUDENT_SOURCE.slice(STUDENT_SOURCE.indexOf('HOW FINISHED THIS MODULE IS'));
  assert.match(badge, /\{!simple && isStaff && \(/, 'the readiness badge must require both !simple and isStaff');
});

// learning-10 ─────────────────────────────────────────────────────────────────────────────────

test('learning-10: the offline Standard/Higher quality picker is gated on Simple AND staff role', () => {
  assert.match(OFFLINE_DOWNLOAD_SOURCE, /const isStaff = isStaffRole\(navigationRole\);/);
  assert.match(OFFLINE_DOWNLOAD_SOURCE, /hasHigher && !busy && phase !== 'done' && !simple && isStaff && \(/);
  // Farmers (and students) get the silent default regardless — the state itself never changes.
  assert.match(OFFLINE_DOWNLOAD_SOURCE, /useState<PackQuality>\('standard'\)/);
});

// crops-05 ────────────────────────────────────────────────────────────────────────────────────

test('crops-05: the Planting Calendar row is dropped from Simple\'s nav allow-list, kept for All tools', () => {
  const setBlock = NAV_DRAWER_SOURCE.match(/const SIMPLE_NAV_HREFS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(setBlock, 'could not find the Simple allow-list');
  assert.doesNotMatch(setBlock![1], /'\/calendar'/, "/calendar must not be in Simple's allow-list — it duplicates /facilitator/crops");
  // The row itself is still a real Farm Tools entry — All tools (and any direct link) still reaches it.
  assert.match(NAV_DRAWER_SOURCE, /href: '\/calendar', Icon: Calendar,\s*label: t\('navPlantingCalendar'\)/);
});
